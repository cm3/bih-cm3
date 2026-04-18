import type { BihEntry, PrimaryIdProperty } from '../types';

const DEFAULT_BASE_IRI = 'https://w3id.org/bih/';

const IDENTIFIER_CLASS_BY_PROPERTY: Record<string, string> = {
  'bih:hasDOI': 'bih:DOIIdentifier',
  'bih:hasCRID': 'bih:CRIDIdentifier',
  'bih:hasBihId': 'bih:BIHIdentifier',
  'bih:hasISBN': 'bih:ISBNIdentifier',
  'bih:hasOpenAlexId': 'bih:OpenAlexIdentifier',
  'dcterms:identifier': 'bih:ExternalUriIdentifier',
};

const IDENTIFIER_LABEL_BY_PROPERTY: Record<string, string> = {
  'bih:hasDOI': 'DOI',
  'bih:hasCRID': 'CRID',
  'bih:hasBihId': 'BIH',
  'bih:hasISBN': 'ISBN',
  'bih:hasOpenAlexId': 'OpenAlex',
  'dcterms:identifier': 'URI',
};

export interface IdentifierNode {
  '@id': string;
  '@type': string;
  'schema:propertyID': string;
  'schema:value': string;
}

export function buildHubEntryIri(entry: BihEntry, baseIri = DEFAULT_BASE_IRI): string {
  return new URL(`hub/${encodeURIComponent(stripBihPrefix(entry.hub_id))}`, baseIri).toString();
}

export function buildResourceIri(entry: BihEntry, baseIri = DEFAULT_BASE_IRI): string {
  return new URL(`resource/${encodeURIComponent(stripBihPrefix(entry.hub_id))}`, baseIri).toString();
}

export function buildPrimaryIdentifierNodeId(entry: BihEntry, baseIri = DEFAULT_BASE_IRI): string {
  const propertySegment = encodeURIComponent(compactPropertyName(entry.primary_id_property));
  const valueSegment = encodeURIComponent(entry.primary_id_value.trim());
  return new URL(
    `resource/${encodeURIComponent(stripBihPrefix(entry.hub_id))}/identifier/${propertySegment}/${valueSegment}`,
    baseIri,
  ).toString();
}

export function buildPrimaryIdentifierNode(entry: BihEntry, baseIri = DEFAULT_BASE_IRI): IdentifierNode {
  return {
    '@id': buildPrimaryIdentifierNodeId(entry, baseIri),
    '@type': getIdentifierClass(entry.primary_id_property),
    'schema:propertyID': getIdentifierLabel(entry.primary_id_property),
    'schema:value': entry.primary_id_value,
  };
}

function getIdentifierClass(property: PrimaryIdProperty): string {
  return IDENTIFIER_CLASS_BY_PROPERTY[property] ?? 'bih:ExternalUriIdentifier';
}

function getIdentifierLabel(property: PrimaryIdProperty): string {
  return IDENTIFIER_LABEL_BY_PROPERTY[property] ?? compactPropertyName(property);
}

function stripBihPrefix(value: string): string {
  return value.startsWith('bih:') ? value.slice(4) : value;
}

function compactPropertyName(value: string): string {
  return value.replace(':', '-');
}
