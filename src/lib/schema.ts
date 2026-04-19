import { ulid } from '../../lib/ulid';
import propertyCatalogPayload from './property-catalog.json';
import type {
  BihEntry,
  Creator,
  LinkItem,
  PrimaryIdProperty,
  PropertyCatalogEntry,
  PropertyCatalogResponse,
  RecordCache,
} from '../types';

export function emptyCreator(): Creator {
  return { role: 'author', family: '', given: '', literal: '' };
}

export function sortPropertyCatalog(entries: PropertyCatalogEntry[]): PropertyCatalogEntry[] {
  return [...entries].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.property.localeCompare(right.property);
  });
}

export const DEFAULT_PROPERTY_CATALOG: PropertyCatalogEntry[] = sortPropertyCatalog(
  (propertyCatalogPayload as PropertyCatalogResponse).properties,
);

export function propertyCatalogMap(entries: PropertyCatalogEntry[]): Map<string, PropertyCatalogEntry> {
  return new Map(entries.map((entry) => [entry.property, entry]));
}

export function getIdentifierPrefix(
  property: string,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): string | null {
  return catalog.find((entry) => entry.property === property)?.identifier_prefix ?? null;
}

export function isIdentifierProperty(
  property: string,
  targetType?: string,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): boolean {
  const catalogEntry = catalog.find((entry) => entry.property === property);
  if (catalogEntry) {
    return catalogEntry.identifier;
  }

  if (property === 'dcterms:identifier' || property === 'bih:hasBihId') {
    return true;
  }

  if (targetType === 'identifier') {
    return true;
  }

  return /^bih:has[A-Z]/.test(property);
}

export function getPrimaryIdentifierCandidates(
  entry: BihEntry,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): PrimaryIdProperty[] {
  const candidates = new Set<PrimaryIdProperty>(['bih:hasBihId']);

  entry.links.forEach((link) => {
    if (isIdentifierProperty(link.property, link.target_type, catalog)) {
      candidates.add(link.property);
    }
  });

  return Array.from(candidates).sort((left, right) => comparePrimaryIdentifierPriority(left, right, catalog));
}

export function formatIdentifierValue(
  value: string,
  property: string,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): string {
  const coreValue = normalizeIdentifierCoreValue(value, property, catalog);
  if (!coreValue) {
    return '';
  }

  const prefix = getIdentifierPrefix(property, catalog);
  return prefix ? `${prefix}${coreValue}` : coreValue;
}

export function stripIdentifierPrefix(
  value: string,
  property: string,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): string {
  return normalizeIdentifierCoreValue(value, property, catalog);
}

export function computePrimaryIdentifierValue(
  entry: BihEntry,
  property = entry.primary_id_property,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): string {
  const sourceValue = property === 'bih:hasBihId' ? entry.hub_id.replace(/^bih:/, '') : null;

  const matchedLink = entry.links.find(
    (link) => link.property === property && isIdentifierProperty(link.property, link.target_type, catalog),
  );

  return formatIdentifierValue(sourceValue ?? matchedLink?.target_value.trim() ?? entry.primary_id_value, property, catalog);
}

export function synchronizePrimaryIdentifier(
  entry: BihEntry,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): BihEntry {
  const candidates = getPrimaryIdentifierCandidates(entry, catalog);
  const primaryProperty = candidates.includes(entry.primary_id_property)
    ? entry.primary_id_property
    : (candidates[0] ?? 'bih:hasBihId');

  entry.primary_id_property = primaryProperty;
  entry.primary_id_value = computePrimaryIdentifierValue(entry, primaryProperty, catalog);
  return entry;
}

export function emptyLink(): LinkItem {
  return {
    link_id: ulid(),
    property: 'dcterms:identifier',
    label: '',
    description: '',
    target_type: 'record',
    target_value: '',
    normalized_target: '',
    source: '',
    url: '',
    access_note: '',
    last_checked_at: '',
    note: '',
  };
}

export function normalizeNullableString(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function creatorLabel(creator: Creator): string {
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

export function buildEntrySummary(recordCache: RecordCache): string {
  const creators = buildCreatorsSummary(recordCache.creators);
  const year = recordCache.issued_year ? String(recordCache.issued_year) : 'n.d.';
  return [creators, year].filter(Boolean).join(' / ');
}

export function buildCreatorsSummary(creators: Creator[]): string {
  return creators.map(creatorLabel).filter(Boolean).join('; ');
}

export function validateEntry(entry: BihEntry): string[] {
  const issues: string[] = [];

  if (!entry.hub_id.startsWith('bih:')) {
    issues.push('`hub_id` should start with `bih:`.');
  }

  if (!entry.primary_id_value.trim()) {
    issues.push('`primary_id_value` is required.');
  }

  if (entry.contextual_description != null && !entry.contextual_description.trim()) {
    issues.push('`contextual_description` should be null or a non-empty string.');
  }

  if (!entry.record_cache.title.trim()) {
    issues.push('`record_cache.title` is required.');
  }

  if (entry.record_cache.creators.length === 0) {
    issues.push('At least one creator is recommended.');
  }

  entry.links.forEach((link, index) => {
    if (!link.target_value.trim()) {
      issues.push(`links[${index}].target_value is required.`);
    }
    if (!link.source.trim()) {
      issues.push(`links[${index}].source is required.`);
    }
  });

  return issues;
}

function normalizeIdentifierCoreValue(
  value: string,
  property: string,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (property === 'bih:hasDOI') {
    const doi = extractDoiValue(trimmed);
    if (doi) {
      return doi;
    }
  }

  const prefix = getIdentifierPrefix(property, catalog);
  if (!prefix) {
    return trimmed;
  }

  return startsWithIgnoreCase(trimmed, prefix) ? trimmed.slice(prefix.length) : trimmed;
}

function extractDoiValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutPrefix = startsWithIgnoreCase(trimmed, 'doi:') ? trimmed.slice(4) : trimmed;
  const match = withoutPrefix.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\S+)$/i);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]).replace(/[)>.,;]+$/, '');
}

function startsWithIgnoreCase(value: string, prefix: string): boolean {
  return value.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}

function comparePrimaryIdentifierPriority(
  left: string,
  right: string,
  catalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG,
): number {
  const leftRank = primaryIdentifierRank(left);
  const rightRank = primaryIdentifierRank(right);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftOrder = catalog.find((entry) => entry.property === left)?.order ?? 999;
  const rightOrder = catalog.find((entry) => entry.property === right)?.order ?? 999;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.localeCompare(right);
}

function primaryIdentifierRank(property: string): number {
  if (property === 'bih:hasDOI') {
    return 0;
  }
  if (property !== 'schema:url' && property !== 'bih:hasBihId' && isIdentifierProperty(property, 'identifier')) {
    return 1;
  }
  if (property === 'schema:url') {
    return 2;
  }
  if (property === 'bih:hasBihId') {
    return 3;
  }
  return 4;
}
