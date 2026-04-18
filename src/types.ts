export type PrimaryIdProperty = string;

export type LinkProperty = string;

export type LinkTargetType =
  | 'identifier'
  | 'record'
  | 'entry'
  | 'page'
  | 'collection'
  | 'distribution'
  | 'annotation'
  | 'citation'
  | 'other';

export interface Creator {
  role: string;
  family: string | null;
  given: string | null;
  literal: string | null;
}

export interface SourceRecord {
  source: string;
  retrieved_at: string | null;
  record: Record<string, unknown>;
}

export interface RecordCache {
  title: string;
  creators: Creator[];
  issued_year: number | null;
  issued_date: string | null;
  container_title: string | null;
  container_title_short?: string | null;
  collection_title?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  journal_abbreviation?: string | null;
  language?: string | null;
  abstract?: string | null;
  note?: string | null;
  keywords?: string | null;
  isbn?: string | null;
  issn?: string | null;
  pmid?: string | null;
  resource_type: string | null;
  source_records: SourceRecord[];
}

export interface LinkItem {
  link_id: string;
  property: LinkProperty;
  label?: string | null;
  description?: string | null;
  target_type: LinkTargetType;
  target_value: string;
  normalized_target: string;
  source: string;
  url: string | null;
  access_note: string | null;
  last_checked_at: string | null;
  note: string | null;
}

export interface BihEntry {
  schema_version: string;
  hub_id: string;
  primary_id_property: PrimaryIdProperty;
  primary_id_value: string;
  contextual_description: string | null;
  record_cache: RecordCache;
  links: LinkItem[];
}

export interface EntryIndexItem {
  hub_id: string;
  ulid: string;
  item_json_url: string;
  primary_id_property: PrimaryIdProperty;
  primary_id_value: string;
  title: string;
  contextual_description_summary: string | null;
  creators_summary: string;
  issued_year: number | null;
  viewer_category: string;
  search_text?: string;
}

export interface ViewerCategoryOption {
  id: string;
  visible_by_default: boolean;
}

export interface ViewerCollectionMeta {
  title: string;
  description: string;
  metadata_source_label?: string | null;
  viewer_categories: ViewerCategoryOption[];
}

export interface EntryIndexResponse {
  entries: EntryIndexItem[];
}

export interface CollectionInfoResponse extends ViewerCollectionMeta {
  $schema?: string;
  issuer: string;
  collection: string;
  manifest_url: string;
  collection_bib_url: string;
  notes_url: string | null;
  index_url: string;
  item_base_url: string;
}

export interface IssuerCollectionIndexItem {
  collection: string;
  info_url: string;
  title: string | null;
  description: string | null;
  manifest_url: string;
  collection_bib_url: string;
  notes_url: string | null;
  index_url: string;
  item_base_url: string;
}

export interface IssuerInfoResponse {
  $schema?: string;
  issuer: string;
  title: string | null;
  description: string | null;
  homepage_url: string | null;
  repository_url: string | null;
  w3id_issuer_url: string | null;
  collections_index_url: string;
}

export interface IssuerIndexResponse {
  collections: IssuerCollectionIndexItem[];
}

export interface PropertyCatalogEntry {
  property: string;
  subproperty_of: string | null;
  identifier: boolean;
  primary_identifier_candidate: boolean;
  identifier_prefix?: string;
  label: string;
  order: number;
}

export interface PropertyCatalogResponse {
  properties: PropertyCatalogEntry[];
}
