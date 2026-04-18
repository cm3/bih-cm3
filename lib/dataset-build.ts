import type { BihEntry, Creator, EntryIndexResponse } from '../src/types';

export type BibField = [name: string, value: string];

export interface BibEntry {
  entryType: string;
  key: string;
  fields: BibField[];
}

export interface HubLink {
  link_id: string;
  property: string;
  label?: string;
  description?: string;
  url?: string;
  target_type: string;
  target_value: string;
  note?: string;
}

export interface HubEntry {
  viewer_category?: string;
  contextual_description?: string;
  display_identifier?: { property: string; value: string };
  links?: HubLink[];
}

export interface HubJson {
  $schema: string;
  default_viewer_category: string;
  entries: Record<string, HubEntry>;
}

interface CslDate {
  'date-parts'?: number[][] | null;
  literal?: string | null;
}

interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}

export interface CslItem {
  id: string;
  type?: string;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  translator?: CslName[];
  issued?: CslDate;
  DOI?: string;
  URL?: string;
  page?: string;
  volume?: string;
  issue?: string;
  publisher?: string;
  ISBN?: string;
  ISSN?: string;
  PMID?: string;
  abstract?: string;
  language?: string;
  keyword?: string;
  'container-title'?: string;
  'container-title-short'?: string;
  'collection-title'?: string;
  'page-first'?: string;
  journalAbbreviation?: string;
}

function fieldMap(entry: BibEntry): Map<string, string> {
  return new Map(entry.fields.map(([name, value]) => [name.toLowerCase(), value]));
}

function splitBibtexNames(value: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < value.length) {
    const char = value[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && value.slice(i, i + 5) === ' and ') {
      names.push(value.slice(start, i).trim());
      i += 5;
      start = i;
      continue;
    }
    i += 1;
  }
  const tail = value.slice(start).trim();
  if (tail) {
    names.push(tail);
  }
  return names;
}

function stripOuterBraces(value: string): string {
  const stripped = value.trim();
  if (stripped.startsWith('{') && stripped.endsWith('}')) {
    return stripped.slice(1, -1).trim();
  }
  return stripped;
}

function formatCreatorDisplay(creator: Creator): string {
  const name = creator.literal ?? [creator.family, creator.given].filter(Boolean).join(', ');
  if (!name) {
    return '';
  }
  switch (creator.role) {
    case 'translator':
      return `${name} (translator)`;
    case 'editor':
      return `${name} (editor)`;
    default:
      return name;
  }
}

function parseCreatorList(nameField: string, role: string): Creator[] {
  const creators: Creator[] = [];
  for (const part of splitBibtexNames(nameField.trim())) {
    const name = stripOuterBraces(part);
    if (!name) {
      continue;
    }
    if (name.includes(',')) {
      const [familyRaw, givenRaw] = name.split(',', 2);
      creators.push({
        role,
        family: familyRaw.trim() || null,
        given: givenRaw.trim() || null,
        literal: null,
      });
      continue;
    }
    if (name.includes(' ')) {
      const pieces = name.split(/\s+/);
      creators.push({
        role,
        family: pieces.at(-1) ?? null,
        given: pieces.slice(0, -1).join(' ') || null,
        literal: null,
      });
      continue;
    }
    creators.push({
      role,
      family: null,
      given: null,
      literal: name,
    });
  }
  return creators;
}

function parseCreators(authorField: string, editorField = '', translatorField = ''): Creator[] {
  const creators = parseCreatorList(authorField, 'author');
  if (creators.length === 0) {
    creators.push(...parseCreatorList(editorField, 'editor'));
  }
  creators.push(...parseCreatorList(translatorField, 'translator'));
  return creators;
}

function creatorsSummaryFromFields(authorField: string, editorField = '', translatorField = ''): string {
  return parseCreators(authorField, editorField, translatorField).map(formatCreatorDisplay).filter(Boolean).join('; ');
}

function parseCslCreators(item: CslItem | null): Creator[] {
  const creators: Creator[] = [];
  const pushNames = (names: CslName[] | undefined, role: string) => {
    creators.push(
      ...(names ?? []).map((name) => ({
        role,
        family: typeof name.family === 'string' ? name.family : null,
        given: typeof name.given === 'string' ? name.given : null,
        literal: typeof name.literal === 'string' ? name.literal : null,
      })),
    );
  };

  if ((item?.author?.length ?? 0) > 0) {
    pushNames(item?.author, 'author');
  } else {
    pushNames(item?.editor, 'editor');
  }
  pushNames(item?.translator, 'translator');
  return creators;
}

function cslCreatorsSummary(item: CslItem | null): string | null {
  const creators = parseCslCreators(item).map(formatCreatorDisplay).filter(Boolean);
  return creators.length > 0 ? creators.join('; ') : null;
}

function cslIssuedYear(item: CslItem | null): number | null {
  const year = item?.issued?.['date-parts']?.[0]?.[0];
  return typeof year === 'number' ? year : null;
}

function normalizeCacheText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = stripOuterBraces(value).trim();
  return trimmed || null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeCacheText(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function splitKeywords(value: string | null | undefined): string | null {
  const normalized = normalizeCacheText(value);
  if (!normalized) {
    return null;
  }
  const keywords = normalized
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return keywords.length > 0 ? keywords.join('; ') : null;
}

function normalizeHttpUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDoi(raw: string | undefined | null): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:/i, '');
}

function firstIdentifierToken(value: string | null | undefined): string | null {
  const normalized = normalizeCacheText(value);
  if (!normalized) {
    return null;
  }
  const first = normalized
    .split(',')
    .map((part) => part.trim())
    .find(Boolean);
  return first ?? null;
}

function deriveLinkUrl(property: string, targetType: string, targetValue: string): string | null {
  const trimmedTarget = targetValue.trim();
  const httpUrl = normalizeHttpUrl(trimmedTarget);
  if (httpUrl) {
    return httpUrl;
  }

  if (property === 'bih:hasDOI') {
    const doi = normalizeDoi(targetValue);
    return doi ? `https://doi.org/${encodeURIComponent(doi)}` : null;
  }

  if (property === 'bih:hasOCLC') {
    const oclc = firstIdentifierToken(targetValue);
    return oclc ? `https://search.worldcat.org/title/${encodeURIComponent(oclc)}` : null;
  }

  if (property === 'bih:hasNDLBibID') {
    const ndlBibId = firstIdentifierToken(targetValue);
    return ndlBibId ? `http://id.ndl.go.jp/bib/${encodeURIComponent(ndlBibId)}` : null;
  }

  if (targetType === 'page' || targetType === 'record' || targetType === 'distribution' || targetType === 'collection') {
    return trimmedTarget || null;
  }

  return null;
}

function pickYear(fields: Map<string, string>): string {
  for (const fieldName of ['year', 'date']) {
    const raw = fields.get(fieldName)?.trim() ?? '';
    const match = raw.match(/(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})/);
    if (match) {
      return match[1];
    }
  }
  return 'nd';
}

function issuedDateValue(item: CslItem | null, fallbackDate: string | null, fallbackYear: string | null): string | null {
  const dateParts = item?.issued?.['date-parts']?.[0];
  if (Array.isArray(dateParts) && dateParts.length > 0) {
    const [year, month, day] = dateParts;
    if (typeof year === 'number') {
      if (typeof month === 'number' && typeof day === 'number') {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      if (typeof month === 'number') {
        return `${year}-${String(month).padStart(2, '0')}`;
      }
      return String(year);
    }
  }
  return firstNonEmpty(fallbackDate, fallbackYear);
}

function buildDisplayIdentifier(
  hubId: string,
  doi: string | null,
  extraIdentifiers: Array<{ property: string; value: string }>,
  resourceUrl: string | null,
  curatedOverride?: { property: string; value: string },
): { property: string; value: string } {
  if (curatedOverride) {
    return curatedOverride;
  }
  if (doi) {
    return { property: 'bih:hasDOI', value: doi };
  }
  if (extraIdentifiers.length > 0) {
    return extraIdentifiers[0];
  }
  if (resourceUrl) {
    return { property: 'schema:url', value: resourceUrl };
  }
  return { property: 'bih:hasBihId', value: hubId };
}

function appendSearchTokens(tokens: string[], value: unknown): void {
  if (value == null) {
    return;
  }
  if (typeof value === 'string') {
    const normalized = normalizeCacheText(value);
    if (normalized) {
      tokens.push(normalized);
    }
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    tokens.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      appendSearchTokens(tokens, item);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value)) {
      appendSearchTokens(tokens, nested);
    }
  }
}

function buildSearchText(
  hubId: string,
  entryUlid: string,
  title: string,
  contextualDescription: string | null,
  displayId: { property: string; value: string },
  cleanedEntry: BibEntry,
  cslItem: CslItem | null,
): string {
  const tokens: string[] = [hubId, entryUlid, title, contextualDescription ?? '', displayId.property, displayId.value];
  appendSearchTokens(tokens, Object.fromEntries(cleanedEntry.fields));
  appendSearchTokens(tokens, cslItem);
  return Array.from(new Set(tokens)).join('\n');
}

function buildGeneratedLinks(
  entryUlid: string,
  doi: string | null,
  extraIdentifiers: Array<{ property: string; value: string }>,
  resourceUrl: string | null,
): BihEntry['links'] {
  const links: BihEntry['links'] = [];
  const seen = new Set<string>();

  const push = (
    property: string,
    targetType: BihEntry['links'][number]['target_type'],
    targetValue: string,
    source: string,
  ) => {
    const key = `${property}::${targetValue.trim()}`;
    if (!targetValue.trim() || seen.has(key)) {
      return;
    }
    seen.add(key);
    links.push({
      link_id: crypto.randomUUID(),
      property,
      label: null,
      description: null,
      target_type: targetType,
      target_value: targetValue,
      normalized_target: targetValue,
      source,
      url: deriveLinkUrl(property, targetType, targetValue),
      access_note: null,
      last_checked_at: null,
      note: null,
    });
  };

  push('bih:hasBibTeX', 'distribution', `./${entryUlid}.bib`, 'generated');
  push('bih:hasCSLJSON', 'distribution', `./${entryUlid}.csl.json`, 'generated');

  if (doi) {
    push('bih:hasDOI', 'identifier', doi, 'generated');
  }
  for (const identifier of extraIdentifiers) {
    push(identifier.property, 'identifier', identifier.value, 'generated');
  }
  if (resourceUrl) {
    push('schema:url', 'page', resourceUrl, 'generated');
  }

  return links;
}

function mergeLinks(
  generatedLinks: BihEntry['links'],
  hubLinks: Array<HubLink> | undefined,
): BihEntry['links'] {
  const merged = new Map<string, BihEntry['links'][number]>();

  for (const link of generatedLinks) {
    merged.set(`${link.property}::${link.target_value.trim()}`, link);
  }

  for (const link of hubLinks ?? []) {
    const key = `${link.property}::${link.target_value.trim()}`;
    const previous = merged.get(key);
    merged.set(key, {
      link_id: previous?.link_id ?? link.link_id,
      property: link.property,
      label: link.label ?? previous?.label ?? null,
      description: link.description ?? previous?.description ?? null,
      target_type: link.target_type as BihEntry['links'][0]['target_type'],
      target_value: link.target_value,
      normalized_target: link.target_value,
      source: 'hub',
      url: link.url ?? previous?.url ?? deriveLinkUrl(link.property, link.target_type, link.target_value),
      access_note: previous?.access_note ?? null,
      last_checked_at: previous?.last_checked_at ?? null,
      note: link.note ?? previous?.note ?? null,
    });
  }

  return Array.from(merged.values());
}

export function buildIndexJson(
  issuer: string,
  collection: string,
  bibEntries: BibEntry[],
  cleanedEntriesByKey: Map<string, BibEntry>,
  keyToUlid: Map<string, string>,
  cslItemsById: Map<string, CslItem>,
  hub: HubJson,
): EntryIndexResponse {
  return {
    entries: bibEntries.map((bibEntry) => {
      const entryUlid = keyToUlid.get(bibEntry.key)!;
      const hubId = `bih:${issuer}/${collection}/${entryUlid}`;
      const fields = fieldMap(bibEntry);
      const cleanedEntry = cleanedEntriesByKey.get(bibEntry.key) ?? bibEntry;
      const cslItem = cslItemsById.get(bibEntry.key) ?? null;
      const year = pickYear(fields);
      const doi = normalizeDoi(fields.get('doi') ?? cslItem?.DOI ?? null);
      const extraIdentifiers: Array<{ property: string; value: string }> = [];
      const oclc = firstIdentifierToken(fields.get('oclc'));
      if (oclc) {
        extraIdentifiers.push({ property: 'bih:hasOCLC', value: oclc });
      }
      const ndlBibId = firstIdentifierToken(fields.get('ndlbibid'));
      if (ndlBibId) {
        extraIdentifiers.push({ property: 'bih:hasNDLBibID', value: ndlBibId });
      }
      const resourceUrl = normalizeHttpUrl(fields.get('url') ?? cslItem?.URL ?? null);

      const hubEntry = hub.entries[entryUlid];
      const displayId = buildDisplayIdentifier(
        hubId,
        doi,
        extraIdentifiers,
        resourceUrl,
        hubEntry?.display_identifier,
      );

      const viewerCategory = hubEntry?.viewer_category ?? hub.default_viewer_category;
      const contextualDescription = hubEntry?.contextual_description ?? null;

      return {
        hub_id: hubId,
        ulid: entryUlid,
        item_json_url: `./${entryUlid}.json`,
        primary_id_property: displayId.property,
        primary_id_value: displayId.value,
        title: cslItem?.title ?? fields.get('title') ?? '',
        contextual_description_summary: contextualDescription,
        creators_summary:
          cslCreatorsSummary(cslItem) ??
          creatorsSummaryFromFields(
            fields.get('author') ?? '',
            fields.get('editor') ?? '',
            fields.get('translator') ?? '',
          ),
        issued_year: cslIssuedYear(cslItem) ?? (/^\d+$/.test(year) ? Number(year) : null),
        viewer_category: viewerCategory,
        search_text: buildSearchText(
          hubId,
          entryUlid,
          cslItem?.title ?? fields.get('title') ?? '',
          contextualDescription,
          displayId,
          cleanedEntry,
          cslItem,
        ),
      };
    }),
  };
}

export function buildItemJson(
  issuer: string,
  collection: string,
  entryUlid: string,
  originalEntry: BibEntry,
  cleanedEntry: BibEntry,
  cslItem: CslItem | null,
  hub: HubJson,
): BihEntry {
  const hubId = `bih:${issuer}/${collection}/${entryUlid}`;
  const fields = fieldMap(originalEntry);
  const doi = normalizeDoi(fields.get('doi') ?? cslItem?.DOI ?? null);
  const extraIdentifiers: Array<{ property: string; value: string }> = [];
  const oclc = firstIdentifierToken(fields.get('oclc'));
  if (oclc) {
    extraIdentifiers.push({ property: 'bih:hasOCLC', value: oclc });
  }
  const ndlBibId = firstIdentifierToken(fields.get('ndlbibid'));
  if (ndlBibId) {
    extraIdentifiers.push({ property: 'bih:hasNDLBibID', value: ndlBibId });
  }
  const year = pickYear(fields);
  const resourceUrl = normalizeHttpUrl(fields.get('url') ?? cslItem?.URL ?? null);

  const hubEntry = hub.entries[entryUlid];
  const displayId = buildDisplayIdentifier(hubId, doi, extraIdentifiers, resourceUrl, hubEntry?.display_identifier);
  const contextualDescription = hubEntry?.contextual_description ?? null;

  const creators = parseCslCreators(cslItem);
  const issuedYear = cslIssuedYear(cslItem) ?? (/^\d+$/.test(year) ? Number(year) : null);

  const recordCache = {
    title: firstNonEmpty(cslItem?.title, fields.get('title')) ?? '',
    creators:
      creators.length > 0
        ? creators
        : parseCreators(fields.get('author') ?? '', fields.get('editor') ?? '', fields.get('translator') ?? ''),
    issued_year: issuedYear,
    issued_date: issuedDateValue(cslItem, fields.get('date') ?? null, year),
    container_title: firstNonEmpty(cslItem?.['container-title'], fields.get('journal'), fields.get('booktitle')),
    container_title_short: firstNonEmpty(cslItem?.['container-title-short'], fields.get('shortjournal'), fields.get('journalabbr')),
    collection_title: firstNonEmpty(cslItem?.['collection-title'], fields.get('series')),
    publisher: firstNonEmpty(cslItem?.publisher, fields.get('publisher')),
    volume: firstNonEmpty(cslItem?.volume, fields.get('volume')),
    issue: firstNonEmpty(cslItem?.issue, fields.get('number'), fields.get('issue')),
    pages: firstNonEmpty(cslItem?.page, fields.get('pages')),
    journal_abbreviation: firstNonEmpty(cslItem?.journalAbbreviation, fields.get('shortjournal'), fields.get('journalabbr')),
    language: firstNonEmpty(cslItem?.language, fields.get('language'), fields.get('langid')),
    abstract: firstNonEmpty(cslItem?.abstract, fields.get('abstract'), fields.get('annotation')),
    note: firstNonEmpty(fields.get('note')),
    keywords: splitKeywords(cslItem?.keyword ?? fields.get('keywords') ?? null),
    isbn: firstNonEmpty(cslItem?.ISBN, fields.get('isbn')),
    issn: firstNonEmpty(cslItem?.ISSN, fields.get('issn')),
    pmid: firstNonEmpty(cslItem?.PMID, fields.get('pmid')),
    resource_type: firstNonEmpty(cslItem?.type, originalEntry.entryType),
    source_records: [
      {
        source: 'source-bib',
        retrieved_at: null,
        record: {
          source_citation_key: originalEntry.key,
          fields: Object.fromEntries(cleanedEntry.fields),
        },
      },
      ...(cslItem
        ? [
            {
              source: 'citation-js-csl-json',
              retrieved_at: null,
              record: cslItem as unknown as Record<string, unknown>,
            },
          ]
        : []),
    ],
  };

  const links = mergeLinks(buildGeneratedLinks(entryUlid, doi, extraIdentifiers, resourceUrl), hubEntry?.links);

  return {
    schema_version: '0.2.0',
    hub_id: hubId,
    primary_id_property: displayId.property,
    primary_id_value: displayId.value,
    contextual_description: contextualDescription,
    record_cache: recordCache,
    links,
  };
}
