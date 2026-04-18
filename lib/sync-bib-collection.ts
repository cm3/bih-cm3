import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Cite from 'citation-js';
import type {
  CollectionInfoResponse,
  IssuerCollectionIndexItem,
  IssuerIndexResponse,
  IssuerInfoResponse,
} from '../src/types';
import type { BibEntry, BibField, CslItem, HubJson, HubLink } from './dataset-build.ts';
import { buildIndexJson, buildItemJson } from './dataset-build.ts';
import { ulid } from './ulid.ts';

const PUBLIC_BLOCKED_FIELD_NAMES = new Set([
  'file',
  'files',
  'localfile',
  'localfiles',
  'x-local-path',
  'x-source-path',
]);

const MANIFEST_SCHEMA_URL = 'https://w3id.org/bih/schema/manifest.schema.json';
const ISSUER_INFO_SCHEMA_URL = 'https://w3id.org/bih/schema/issuer-info.schema.json';
const HUB_SCHEMA_URL = 'https://w3id.org/bih/schema/hub.schema.json';
const HUB_IMPORT_SCHEMA_URL = 'https://w3id.org/bih/schema/hub-import.schema.json';
const DEFAULT_VIEWER_CATEGORY_OPTIONS = [
  { id: 'references', visible_by_default: true },
  { id: 'citing-work', visible_by_default: false },
];

interface ManifestEntryV2 {
  source_citation_key: string;
  ulid: string;
}

interface CollectionManifestV2 {
  $schema: string;
  issuer: string;
  collection: string;
  entries: ManifestEntryV2[];
}

interface HubImportLink {
  link_id?: string;
  property: string;
  label?: string;
  description?: string;
  url?: string;
  target_type: string;
  target_value: string;
  note?: string;
}

interface HubImportEntry {
  viewer_category?: string;
  contextual_description?: string | null;
  display_identifier?: { property: string; value: string } | null;
  links?: HubImportLink[];
}

export interface HubImportJson {
  $schema: string;
  default_viewer_category?: string;
  entries: Record<string, HubImportEntry>;
}

export type HubImportMode = 'merge' | 'overwrite';

export interface SyncBibCollectionOptions {
  collection: string;
  bibContent: string;
  publicRoot: string;
  notesContent?: string;
  hubImportPath?: string;
  hubImportMode?: HubImportMode;
}

export interface SyncBibCollectionResult {
  manifestPath: string;
  collectionBibPath: string;
  hubJsonPath: string;
  indexJsonPath: string;
  entries: number;
  hubImportApplied: boolean;
  warnings: string[];
}

export interface ExportHubImportOptions {
  collection: string;
  publicRoot: string;
  outputPath?: string;
}

export interface ExportHubImportResult {
  outputPath: string;
  entries: number;
  warnings: string[];
}

class BibTeXParseError extends Error {}

export function isSafeCollectionName(collection: string): boolean {
  return /^[a-z][a-z0-9-]{2,39}$/.test(collection);
}

export async function syncBibCollection(options: SyncBibCollectionOptions): Promise<SyncBibCollectionResult> {
  const publicRoot = path.resolve(options.publicRoot);
  const infoPath = issuerInfoPath(publicRoot);
  const indexPath = issuerIndexPath(publicRoot);
  const issuerInfo = await loadIssuerInfo(infoPath);
  const issuer = issuerInfo.issuer;
  const collectionName = options.collection;
  const manifestPath = manifestOutputPath(publicRoot, collectionName);
  const hubPath = hubJsonPath(publicRoot, collectionName);

  const parsedEntries = parseBibtex(options.bibContent);
  const manifest = await loadManifest(manifestPath, issuer, collectionName);
  let hub = await loadHub(hubPath);
  const warnings: string[] = [];

  // Assign ULIDs to new entries
  const keyToUlid = new Map(manifest.entries.map((e) => [e.source_citation_key, e.ulid]));
  for (const entry of parsedEntries) {
    if (!keyToUlid.has(entry.key)) {
      const id = ulid();
      keyToUlid.set(entry.key, id);
      manifest.entries.push({ source_citation_key: entry.key, ulid: id });
    }
  }

  const loadedHubImport = await loadOptionalHubImport(resolveHubImportPath(publicRoot, collectionName, options.hubImportPath));
  if (loadedHubImport) {
    const applied = applyHubImport({
      hub,
      hubImport: loadedHubImport,
      manifest,
      keyToUlid,
      issuer,
      collection: collectionName,
      mode: options.hubImportMode ?? 'merge',
    });
    hub = applied.hub;
    warnings.push(...applied.warnings);
  }

  // Write all.bib (cleaned, preserving user's cite-keys)
  const collectionBibPath = path.join(publicRoot, collectionName, 'all.bib');
  const cleanedEntries = parsedEntries.map((entry) => ({
    ...entry,
    fields: sanitizePublicFields(stripXBihFields(entry.fields)),
  }));
  const cleanedEntriesByKey = new Map(cleanedEntries.map((entry) => [entry.key, entry]));
  const datasetBibText = `${cleanedEntries.map((entry) => serializeBibEntry(entry)).join('\n\n')}\n`;
  await writeText(collectionBibPath, datasetBibText);

  // Convert to CSL-JSON via Citation.js
  const cslItems = await convertBibToCslJson(datasetBibText);
  const cslItemsById = new Map(cslItems.map((item) => [item.id, item]));
  await writeJson(path.join(publicRoot, collectionName, 'all.csl.json'), cslItems);

  if (options.notesContent !== undefined) {
    await writeText(path.join(publicRoot, collectionName, 'notes.md'), options.notesContent);
  }

  // Write manifest
  manifest.$schema = MANIFEST_SCHEMA_URL;
  manifest.issuer = issuer;
  manifest.collection = collectionName;
  await writeJson(manifestPath, manifest);
  await writeHubJson(hubPath, hub);

  // Update collection info
  const currentCollectionInfo = await loadCollectionInfo(
    collectionInfoFilePath(publicRoot, collectionName),
    issuer,
    collectionName,
    options.notesContent !== undefined,
  );
  const nextCollectionInfo = updateCollectionInfo(
    currentCollectionInfo,
    issuer,
    collectionName,
    options.notesContent !== undefined,
  );
  await writeJson(collectionInfoFilePath(publicRoot, collectionName), nextCollectionInfo);

  // Update issuer info/index
  const currentIssuerIndex = await loadIssuerIndex(indexPath);
  const nextIssuerInfo = updateIssuerInfo(issuerInfo, issuer);
  await writeJson(infoPath, nextIssuerInfo);
  const nextIssuerIndex = updateIssuerIndex(currentIssuerIndex, nextCollectionInfo);
  await writeJson(indexPath, nextIssuerIndex);

  // Build collection index.json
  const indexJsonPath = path.join(publicRoot, collectionName, 'index.json');
  const indexJson = buildIndexJson(issuer, collectionName, parsedEntries, cleanedEntriesByKey, keyToUlid, cslItemsById, hub);
  await writeJson(indexJsonPath, indexJson);

  // Write individual entry files
  await Promise.all(
    parsedEntries.map(async (entry) => {
      const entryUlid = keyToUlid.get(entry.key)!;
      const cleanedEntry = cleanedEntries.find((e) => e.key === entry.key)!;

      // {ulid}.bib
      await writeText(
        path.join(publicRoot, collectionName, `${entryUlid}.bib`),
        `${serializeBibEntry(cleanedEntry)}\n`,
      );

      // {ulid}.csl.json
      const cslItem = cslItemsById.get(entry.key) ?? null;
      await writeJson(
        path.join(publicRoot, collectionName, `${entryUlid}.csl.json`),
        cslItem ?? {},
      );

      // {ulid}.json
      const itemJson = buildItemJson(
        issuer,
        collectionName,
        entryUlid,
        entry,
        cleanedEntry,
        cslItem,
        hub,
      );
      await writeJson(
        path.join(publicRoot, collectionName, `${entryUlid}.json`),
        itemJson,
      );
    }),
  );

  return {
    manifestPath,
    collectionBibPath,
    hubJsonPath: hubPath,
    indexJsonPath,
    entries: parsedEntries.length,
    hubImportApplied: loadedHubImport != null,
    warnings,
  };
}

export async function exportHubImport(options: ExportHubImportOptions): Promise<ExportHubImportResult> {
  const publicRoot = path.resolve(options.publicRoot);
  const collectionName = options.collection;
  const manifest = await loadManifest(manifestOutputPath(publicRoot, collectionName), '', collectionName);
  const issuerInfo = await loadIssuerInfo(issuerInfoPath(publicRoot));
  const hub = await loadHub(hubJsonPath(publicRoot, collectionName));
  const ulidToKey = new Map(manifest.entries.map((entry) => [entry.ulid, entry.source_citation_key]));
  const warnings: string[] = [];

  const exported: HubImportJson = {
    $schema: HUB_IMPORT_SCHEMA_URL,
    default_viewer_category: hub.default_viewer_category,
    entries: {},
  };

  for (const [ulid, entry] of Object.entries(hub.entries ?? {})) {
    const citeKey = ulidToKey.get(ulid);
    if (!citeKey) {
      warnings.push(`Skipped orphan hub entry without manifest mapping: ${ulid}`);
      continue;
    }

    const nextEntry: HubImportEntry = {};
    if (entry.viewer_category) {
      nextEntry.viewer_category = entry.viewer_category;
    }
    if (typeof entry.contextual_description === 'string') {
      nextEntry.contextual_description = entry.contextual_description;
    }
    if (entry.display_identifier) {
      nextEntry.display_identifier = { ...entry.display_identifier };
    }
    if (Array.isArray(entry.links) && entry.links.length > 0) {
      nextEntry.links = entry.links.map((link) =>
        exportHubImportLink(link, issuerInfo.issuer, collectionName, ulidToKey),
      );
    }

    exported.entries[citeKey] = nextEntry;
  }

  const outputPath = options.outputPath
    ? path.resolve(options.outputPath)
    : resolveHubImportPath(publicRoot, collectionName);
  await writeJson(outputPath, exported);
  return {
    outputPath,
    entries: Object.keys(exported.entries).length,
    warnings,
  };
}

// --- BibTeX parsing ---

function parseBibtex(text: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '@') {
      i += 1;
      continue;
    }
    i += 1;
    const [entryTypeRaw, nextIndex] = readUntil(text, i, '{(');
    const entryType = entryTypeRaw.trim();
    if (!entryType) {
      throw new BibTeXParseError('Missing entry type');
    }
    i = nextIndex;
    if (i >= text.length) {
      throw new BibTeXParseError('Unexpected end of file after entry type');
    }

    const opener = text[i];
    const closer = opener === '{' ? '}' : ')';
    i += 1;

    const [keyRaw, keyIndex] = readUntil(text, i, ',');
    const key = keyRaw.trim();
    if (!key) {
      throw new BibTeXParseError(`Missing citation key for @${entryType}`);
    }
    i = keyIndex;
    if (i >= text.length || text[i] !== ',') {
      throw new BibTeXParseError(`Expected ',' after citation key ${key}`);
    }
    i += 1;

    const fields: BibField[] = [];
    while (i < text.length) {
      i = skipWhitespace(text, i);
      if (i >= text.length) {
        throw new BibTeXParseError(`Unexpected EOF inside entry ${key}`);
      }
      if (text[i] === closer) {
        i += 1;
        break;
      }
      const [fieldNameRaw, fieldIndex] = readUntil(text, i, '=');
      const fieldName = fieldNameRaw.trim();
      if (!fieldName) {
        throw new BibTeXParseError(`Missing field name in entry ${key}`);
      }
      i = fieldIndex;
      if (i >= text.length || text[i] !== '=') {
        throw new BibTeXParseError(`Expected '=' after field name ${fieldName}`);
      }
      i += 1;
      i = skipWhitespace(text, i);
      const [fieldValue, valueIndex] = readValue(text, i);
      fields.push([fieldName, fieldValue]);
      i = skipWhitespace(text, valueIndex);
      if (i < text.length && text[i] === ',') {
        i += 1;
      }
    }
    entries.push({ entryType, key, fields });
  }
  return entries;
}

function skipWhitespace(text: string, index: number): number {
  let i = index;
  while (i < text.length && /\s/.test(text[i])) {
    i += 1;
  }
  return i;
}

function readUntil(text: string, start: number, delimiters: string): [string, number] {
  let i = start;
  while (i < text.length && !delimiters.includes(text[i])) {
    i += 1;
  }
  return [text.slice(start, i), i];
}

function readValue(text: string, start: number): [string, number] {
  if (start >= text.length) {
    throw new BibTeXParseError('Unexpected EOF while reading field value');
  }
  if (text[start] === '{') {
    return readBracedValue(text, start);
  }
  if (text[start] === '"') {
    return readQuotedValue(text, start);
  }
  let i = start;
  while (i < text.length && !',}\n\r'.includes(text[i])) {
    i += 1;
  }
  return [text.slice(start, i).trim(), i];
}

function readBracedValue(text: string, start: number): [string, number] {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const char = text[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return [text.slice(start + 1, i), i + 1];
      }
    }
    i += 1;
  }
  throw new BibTeXParseError('Unterminated braced value');
}

function readQuotedValue(text: string, start: number): [string, number] {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '"' && text[i - 1] !== '\\') {
      return [text.slice(start + 1, i), i + 1];
    }
    i += 1;
  }
  throw new BibTeXParseError('Unterminated quoted value');
}

function serializeBibEntry(entry: BibEntry): string {
  const lines = [`@${entry.entryType}{${entry.key},`];
  for (const [name, value] of entry.fields) {
    lines.push(`  ${name.padEnd(12, ' ')} = {${value}},`);
  }
  lines.push('}');
  return lines.join('\n');
}

// --- Field utilities ---

function stripXBihFields(fields: BibField[]): BibField[] {
  return fields.filter(([name]) => !name.toLowerCase().startsWith('x-bih-'));
}

function sanitizePublicFields(fields: BibField[]): BibField[] {
  return fields.filter(([name, value]) => !PUBLIC_BLOCKED_FIELD_NAMES.has(name.toLowerCase()) && !isLocalPathish(value));
}

function isLocalPathish(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (
    normalized.startsWith('_local/') ||
    normalized.startsWith('./_local/') ||
    normalized.startsWith('../_local/') ||
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.startsWith('~/') ||
    normalized.startsWith('file://')
  ) {
    return true;
  }
  return /^[A-Za-z]:\\/.test(normalized);
}

// --- Citation.js ---

async function convertBibToCslJson(bibContent: string): Promise<CslItem[]> {
  const cite = new Cite(bibContent);
  const parsed = cite.format('data', { format: 'object' }) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Citation.js did not return a CSL JSON array.');
  }
  return parsed as CslItem[];
}

// --- File I/O ---

function issuerInfoPath(publicRoot: string): string {
  return path.join(publicRoot, 'info.json');
}

function issuerIndexPath(publicRoot: string): string {
  return path.join(publicRoot, 'index.json');
}

function manifestOutputPath(publicRoot: string, collection: string): string {
  return path.join(publicRoot, collection, 'manifest.json');
}

function hubJsonPath(publicRoot: string, collection: string): string {
  return path.join(publicRoot, collection, 'hub.json');
}

function resolveHubImportPath(publicRoot: string, collection: string, explicitPath?: string): string {
  return explicitPath ? path.resolve(explicitPath) : path.join(publicRoot, collection, 'hub-import.json');
}

function collectionInfoFilePath(publicRoot: string, collection: string): string {
  return path.join(publicRoot, collection, 'info.json');
}

async function loadManifest(manifestPath: string, issuer: string, collection: string): Promise<CollectionManifestV2> {
  try {
    const content = await readFile(manifestPath, 'utf8');
    return JSON.parse(content) as CollectionManifestV2;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { $schema: MANIFEST_SCHEMA_URL, issuer, collection, entries: [] };
    }
    throw error;
  }
}

async function loadHub(hubPath: string): Promise<HubJson> {
  try {
    const content = await readFile(hubPath, 'utf8');
    return JSON.parse(content) as HubJson;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        $schema: HUB_SCHEMA_URL,
        default_viewer_category: 'references',
        entries: {},
      };
    }
    throw error;
  }
}

async function writeHubJson(hubPath: string, hub: HubJson): Promise<void> {
  await writeJson(hubPath, {
    ...hub,
    $schema: HUB_SCHEMA_URL,
  });
}

async function loadOptionalHubImport(hubImportPath: string): Promise<HubImportJson | null> {
  try {
    const content = await readFile(hubImportPath, 'utf8');
    return JSON.parse(content) as HubImportJson;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function loadIssuerInfo(infoPath: string): Promise<IssuerInfoResponse> {
  try {
    const content = await readFile(infoPath, 'utf8');
    return JSON.parse(content) as IssuerInfoResponse;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`Missing issuer info file: ${infoPath}`);
    }
    throw error;
  }
}

async function loadIssuerIndex(indexPath: string): Promise<IssuerIndexResponse> {
  try {
    const content = await readFile(indexPath, 'utf8');
    return JSON.parse(content) as IssuerIndexResponse;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { collections: [] };
    }
    throw error;
  }
}

async function loadCollectionInfo(
  filePath: string,
  issuer: string,
  collection: string,
  hasNotes: boolean,
): Promise<CollectionInfoResponse> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as CollectionInfoResponse;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return buildCollectionInfoTemplate(issuer, collection, hasNotes);
    }
    throw error;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function writeText(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, 'utf8');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function buildHubEntryId(issuer: string, collection: string, ulidValue: string): string {
  return `bih:${issuer}/${collection}/${ulidValue}`;
}

function extractCollectionUlid(targetValue: string, issuer: string, collection: string): string | null {
  const prefix = `bih:${issuer}/${collection}/`;
  if (!targetValue.startsWith(prefix)) {
    return null;
  }
  const suffix = targetValue.slice(prefix.length).trim();
  return suffix || null;
}

function normalizeHubImportLinks(
  links: unknown,
  keyToUlid: Map<string, string>,
  issuer: string,
  collection: string,
  warnings: string[],
  entryKey: string,
): HubLink[] | null | undefined {
  if (links === undefined) {
    return undefined;
  }
  if (!Array.isArray(links)) {
    return null;
  }

  const normalized: HubLink[] = [];
  for (const link of links) {
    if (!link || typeof link !== 'object') {
      continue;
    }
    const item = link as Record<string, unknown>;
    const property = normalizeOptionalString(item.property);
    const targetType = normalizeOptionalString(item.target_type);
    let targetValue = normalizeOptionalString(item.target_value);
    if (!property || !targetType || !targetValue) {
      continue;
    }

    if (targetType === 'entry' && !targetValue.startsWith('bih:')) {
      const targetUlid = keyToUlid.get(targetValue);
      if (!targetUlid) {
        warnings.push(`Skipped unresolved entry link target "${targetValue}" in ${entryKey}`);
        continue;
      }
      targetValue = buildHubEntryId(issuer, collection, targetUlid);
    }

    normalized.push({
      link_id: normalizeOptionalString(item.link_id) ?? crypto.randomUUID(),
      property,
      target_type: targetType,
      target_value: targetValue,
      ...(normalizeOptionalString(item.label) ? { label: normalizeOptionalString(item.label) } : {}),
      ...(normalizeOptionalString(item.description) ? { description: normalizeOptionalString(item.description) } : {}),
      ...(normalizeOptionalString(item.url) ? { url: normalizeOptionalString(item.url) } : {}),
      ...(normalizeOptionalString(item.note) ? { note: normalizeOptionalString(item.note) } : {}),
    });
  }

  return normalized;
}

function normalizeHubImportEntry(
  entry: unknown,
  keyToUlid: Map<string, string>,
  issuer: string,
  collection: string,
  warnings: string[],
  entryKey: string,
): {
  hasViewerCategory: boolean;
  viewer_category?: string;
  hasContextualDescription: boolean;
  contextual_description: string | null;
  hasDisplayIdentifier: boolean;
  display_identifier: { property: string; value: string } | null;
  hasLinks: boolean;
  links: HubLink[] | null;
} | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const item = entry as Record<string, unknown>;
  const hasViewerCategory = Object.prototype.hasOwnProperty.call(item, 'viewer_category');
  const hasContextualDescription = Object.prototype.hasOwnProperty.call(item, 'contextual_description');
  const hasDisplayIdentifier = Object.prototype.hasOwnProperty.call(item, 'display_identifier');
  const hasLinks = Object.prototype.hasOwnProperty.call(item, 'links');
  const displayIdentifierRaw = item.display_identifier;
  const displayIdentifier =
    displayIdentifierRaw && typeof displayIdentifierRaw === 'object'
      ? {
          property: normalizeOptionalString((displayIdentifierRaw as Record<string, unknown>).property) ?? '',
          value: normalizeOptionalString((displayIdentifierRaw as Record<string, unknown>).value) ?? '',
        }
      : null;

  return {
    hasViewerCategory,
    viewer_category: normalizeOptionalString(item.viewer_category),
    hasContextualDescription,
    contextual_description: normalizeOptionalString(item.contextual_description) ?? null,
    hasDisplayIdentifier,
    display_identifier:
      displayIdentifier && displayIdentifier.property && displayIdentifier.value ? displayIdentifier : null,
    hasLinks,
    links: normalizeHubImportLinks(item.links, keyToUlid, issuer, collection, warnings, entryKey) ?? null,
  };
}

function compactHubEntry(entry: {
  viewer_category?: string;
  contextual_description?: string | null;
  display_identifier?: { property: string; value: string } | null;
  links?: HubLink[] | null;
}): import('./dataset-build.ts').HubEntry {
  const next: import('./dataset-build.ts').HubEntry = {};
  if (entry.viewer_category) {
    next.viewer_category = entry.viewer_category;
  }
  if (typeof entry.contextual_description === 'string' && entry.contextual_description.trim()) {
    next.contextual_description = entry.contextual_description;
  }
  if (entry.display_identifier?.property && entry.display_identifier?.value) {
    next.display_identifier = entry.display_identifier;
  }
  if (Array.isArray(entry.links) && entry.links.length > 0) {
    next.links = entry.links;
  }
  return next;
}

function applyHubImport(args: {
  hub: HubJson;
  hubImport: HubImportJson;
  manifest: CollectionManifestV2;
  keyToUlid: Map<string, string>;
  issuer: string;
  collection: string;
  mode: HubImportMode;
}): { hub: HubJson; warnings: string[] } {
  const { hub, hubImport, keyToUlid, issuer, collection, mode } = args;
  const warnings: string[] = [];
  const nextHub: HubJson = {
    $schema: HUB_SCHEMA_URL,
    default_viewer_category: hubImport.default_viewer_category ?? hub.default_viewer_category,
    entries: mode === 'overwrite' ? {} : { ...(hub.entries ?? {}) },
  };

  for (const [citeKey, rawEntry] of Object.entries(hubImport.entries ?? {})) {
    const entryUlid = keyToUlid.get(citeKey);
    if (!entryUlid) {
      warnings.push(`Skipped hub-import entry with unknown cite-key: ${citeKey}`);
      continue;
    }
    const normalized = normalizeHubImportEntry(rawEntry, keyToUlid, issuer, collection, warnings, citeKey);
    if (!normalized) {
      continue;
    }

    if (mode === 'overwrite') {
      const overwritten = compactHubEntry({
        viewer_category: normalized.hasViewerCategory ? normalized.viewer_category : undefined,
        contextual_description: normalized.hasContextualDescription ? normalized.contextual_description : undefined,
        display_identifier: normalized.hasDisplayIdentifier ? normalized.display_identifier : undefined,
        links: normalized.hasLinks ? normalized.links : undefined,
      });
      if (Object.keys(overwritten).length > 0) {
        nextHub.entries[entryUlid] = overwritten;
      }
      continue;
    }

    const current = { ...(nextHub.entries[entryUlid] ?? {}) };
    if (normalized.hasViewerCategory) {
      if (normalized.viewer_category) {
        current.viewer_category = normalized.viewer_category;
      } else {
        delete current.viewer_category;
      }
    }
    if (normalized.hasContextualDescription) {
      if (normalized.contextual_description) {
        current.contextual_description = normalized.contextual_description;
      } else {
        delete current.contextual_description;
      }
    }
    if (normalized.hasDisplayIdentifier) {
      if (normalized.display_identifier) {
        current.display_identifier = normalized.display_identifier;
      } else {
        delete current.display_identifier;
      }
    }
    if (normalized.hasLinks) {
      if (normalized.links && normalized.links.length > 0) {
        current.links = normalized.links;
      } else {
        delete current.links;
      }
    }

    const compacted = compactHubEntry(current);
    if (Object.keys(compacted).length > 0) {
      nextHub.entries[entryUlid] = compacted;
    } else {
      delete nextHub.entries[entryUlid];
    }
  }

  return { hub: nextHub, warnings };
}

function exportHubImportLink(
  link: HubLink,
  issuer: string,
  collection: string,
  ulidToKey: Map<string, string>,
): HubImportLink {
  const targetUlid = extractCollectionUlid(link.target_value, issuer, collection);
  const mappedTargetValue =
    link.target_type === 'entry' && targetUlid && ulidToKey.has(targetUlid)
      ? (ulidToKey.get(targetUlid) as string)
      : link.target_value;

  return {
    link_id: link.link_id,
    property: link.property,
    target_type: link.target_type,
    target_value: mappedTargetValue,
    ...(link.label ? { label: link.label } : {}),
    ...(link.description ? { description: link.description } : {}),
    ...(link.url ? { url: link.url } : {}),
    ...(link.note ? { note: link.note } : {}),
  };
}

// --- Collection/issuer info ---

function buildCollectionInfoTemplate(issuer: string, collection: string, hasNotes: boolean): CollectionInfoResponse {
  return {
    issuer,
    collection,
    title: collection,
    description: `Collection \`${collection}\` generated from BibTeX source.`,
    metadata_source_label: 'BibTeX file uploaded by the issuer',
    viewer_categories: structuredClone(DEFAULT_VIEWER_CATEGORY_OPTIONS),
    manifest_url: './manifest.json',
    collection_bib_url: './all.bib',
    notes_url: hasNotes ? './notes.md' : null,
    index_url: './index.json',
    item_base_url: './',
  };
}

function updateCollectionInfo(
  current: CollectionInfoResponse,
  issuer: string,
  collection: string,
  hasNotes: boolean,
): CollectionInfoResponse {
  const template = buildCollectionInfoTemplate(issuer, collection, hasNotes);
  const rest = current;
  return {
    ...rest,
    title: rest.title ?? template.title,
    description: rest.description ?? template.description,
    metadata_source_label: rest.metadata_source_label ?? template.metadata_source_label,
    viewer_categories: rest.viewer_categories ?? template.viewer_categories,
    issuer,
    collection,
    manifest_url: './manifest.json',
    collection_bib_url: './all.bib',
    notes_url: hasNotes ? './notes.md' : null,
    index_url: './index.json',
    item_base_url: './',
  };
}

function updateIssuerInfo(issuerInfo: IssuerInfoResponse, issuer: string): IssuerInfoResponse {
  const { collections: _legacyCollections, ...rest } = issuerInfo as IssuerInfoResponse & { collections?: unknown };
  return {
    ...rest,
    $schema: ISSUER_INFO_SCHEMA_URL,
    issuer,
    w3id_issuer_url: issuerInfo.w3id_issuer_url ?? null,
    collections_index_url: './index.json',
  };
}

function buildIssuerCollectionIndexItem(collectionInfo: CollectionInfoResponse): IssuerCollectionIndexItem {
  return {
    collection: collectionInfo.collection,
    info_url: `./${collectionInfo.collection}/info.json`,
    title: collectionInfo.title,
    description: collectionInfo.description,
    manifest_url: `./${collectionInfo.collection}/manifest.json`,
    collection_bib_url: `./${collectionInfo.collection}/all.bib`,
    notes_url: collectionInfo.notes_url ? `./${collectionInfo.collection}/notes.md` : null,
    index_url: `./${collectionInfo.collection}/index.json`,
    item_base_url: `./${collectionInfo.collection}/`,
  };
}

function updateIssuerIndex(issuerIndex: IssuerIndexResponse, collectionInfo: CollectionInfoResponse): IssuerIndexResponse {
  const collectionsByName = new Map(issuerIndex.collections.map((entry) => [entry.collection, entry]));
  collectionsByName.set(collectionInfo.collection, buildIssuerCollectionIndexItem(collectionInfo));
  return {
    collections: [...collectionsByName.values()].sort((a, b) => a.collection.localeCompare(b.collection)),
  };
}
