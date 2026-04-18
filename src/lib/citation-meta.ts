import type { BihEntry, CollectionInfoResponse } from '../types';

export interface CitationMetaTag {
  name: string;
  content: string;
}

function asStringRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getSourceBibFields(entry: BihEntry): Record<string, string> {
  const sourceRecord = entry.record_cache.source_records.find((item) => item.source === 'source-bib');
  const record = asStringRecord(sourceRecord?.record);
  const fields = asStringRecord(record?.fields);
  if (!fields) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => (typeof value === 'string' ? [[key.toLowerCase(), value]] : [])),
  );
}

function getCslRecord(entry: BihEntry): Record<string, unknown> | null {
  const sourceRecord = entry.record_cache.source_records.find((item) => item.source === 'citation-js-csl-json');
  return asStringRecord(sourceRecord?.record);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function plainText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const text = normalizeWhitespace(value.replace(/\[(.*?)\]\((.*?)\)/g, '$1').replace(/[`*_#>~-]/g, ' '));
  return text || null;
}

function creatorName(creator: BihEntry['record_cache']['creators'][number]): string | null {
  if (creator.literal) {
    return normalizeWhitespace(creator.literal);
  }
  const parts = [creator.family, creator.given].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  if (creator.family && creator.given) {
    return `${creator.family}, ${creator.given}`;
  }
  return normalizeWhitespace(parts.join(' '));
}

function addMeta(tags: CitationMetaTag[], name: string, value: string | null | undefined): void {
  if (!value) {
    return;
  }
  const content = normalizeWhitespace(value);
  if (!content) {
    return;
  }
  tags.push({ name, content });
}

function addRepeatedMeta(tags: CitationMetaTag[], name: string, values: Array<string | null | undefined>): void {
  for (const value of values) {
    addMeta(tags, name, value);
  }
}

function formatPublicationDate(rawDate: string | undefined, rawYear: string | undefined): string | null {
  const date = rawDate?.trim();
  if (date) {
    const fullMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (fullMatch) {
      return `${fullMatch[1]}/${Number(fullMatch[2])}/${Number(fullMatch[3])}`;
    }
    const partialMatch = date.match(/^(\d{4})-(\d{2})$/);
    if (partialMatch) {
      return `${partialMatch[1]}/${Number(partialMatch[2])}`;
    }
    const yearMatch = date.match(/^(\d{4})$/);
    if (yearMatch) {
      return yearMatch[1];
    }
    return date;
  }
  const year = rawYear?.trim();
  return year && /^\d{4}$/.test(year) ? year : null;
}

function splitPages(rawPages: string | undefined): { first: string | null; last: string | null } {
  const pages = rawPages?.trim();
  if (!pages) {
    return { first: null, last: null };
  }
  const match = pages.match(/^(.+?)(?:--?|–|—)(.+)$/);
  if (!match) {
    return { first: pages, last: null };
  }
  return {
    first: match[1].trim(),
    last: match[2].trim(),
  };
}

function splitKeywords(rawKeywords: string | undefined): string | null {
  const keywords = rawKeywords?.trim();
  if (!keywords) {
    return null;
  }
  return normalizeWhitespace(
    keywords
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .join('; '),
  );
}

export function buildCitationMetaTags(entry: BihEntry, collectionInfo: CollectionInfoResponse | null): CitationMetaTag[] {
  const fields = getSourceBibFields(entry);
  const csl = getCslRecord(entry);
  const tags: CitationMetaTag[] = [];
  const cslYear = Array.isArray(csl?.issued) ? null : asStringRecord(csl?.issued)?.['date-parts'];
  const cslDateParts = Array.isArray(cslYear) ? cslYear as unknown[] : [];
  const firstDatePart = Array.isArray(cslDateParts[0]) ? cslDateParts[0] as unknown[] : [];
  const publicationDate =
    firstDatePart.length > 0
      ? firstDatePart.map((part) => String(part)).join('/')
      : formatPublicationDate(fields.date, fields.year);
  const pages = splitPages(typeof csl?.page === 'string' ? csl.page : fields.pages);

  addMeta(tags, 'citation_title', entry.record_cache.title);
  addRepeatedMeta(
    tags,
    'citation_author',
    entry.record_cache.creators.map((creator) => creatorName(creator)),
  );

  addMeta(tags, 'citation_date', publicationDate);
  addMeta(tags, 'citation_publication_date', publicationDate);
  addMeta(tags, 'citation_year', typeof firstDatePart[0] === 'number' ? String(firstDatePart[0]) : fields.year ?? publicationDate);

  addMeta(tags, 'citation_journal_title', typeof csl?.['container-title'] === 'string' ? csl['container-title'] : fields.journal);
  addMeta(
    tags,
    'citation_journal_abbrev',
    typeof csl?.journalAbbreviation === 'string' ? csl.journalAbbreviation : fields.shortjournal ?? fields.journalabbr,
  );
  addMeta(tags, 'citation_book_title', typeof csl?.['container-title'] === 'string' ? csl['container-title'] : fields.booktitle);
  addMeta(tags, 'citation_inbook_title', typeof csl?.['container-title'] === 'string' ? csl['container-title'] : fields.booktitle);
  addMeta(tags, 'citation_conference_title', typeof csl?.['container-title'] === 'string' ? csl['container-title'] : fields.booktitle);
  addMeta(tags, 'citation_conference', typeof csl?.['container-title'] === 'string' ? csl['container-title'] : fields.booktitle);
  addMeta(tags, 'citation_series_title', typeof csl?.['collection-title'] === 'string' ? csl['collection-title'] : fields.series);
  addMeta(tags, 'citation_volume', typeof csl?.volume === 'string' ? csl.volume : fields.volume);
  addMeta(tags, 'citation_issue', typeof csl?.issue === 'string' ? csl.issue : fields.number ?? fields.issue);
  addMeta(tags, 'citation_firstpage', pages.first);
  addMeta(tags, 'citation_lastpage', pages.last);
  addMeta(tags, 'citation_publisher', typeof csl?.publisher === 'string' ? csl.publisher : fields.publisher);
  addMeta(tags, 'citation_doi', typeof csl?.DOI === 'string' ? csl.DOI : fields.doi?.replace(/^doi:\s*/i, ''));
  addMeta(tags, 'citation_isbn', typeof csl?.ISBN === 'string' ? csl.ISBN : fields.isbn);
  addMeta(tags, 'citation_issn', typeof csl?.ISSN === 'string' ? csl.ISSN : fields.issn);
  addMeta(tags, 'citation_eissn', fields.eissn);
  addMeta(tags, 'citation_pmid', typeof csl?.PMID === 'string' ? csl.PMID : fields.pmid);
  addMeta(tags, 'citation_public_url', typeof csl?.URL === 'string' ? csl.URL : fields.url);
  addMeta(tags, 'citation_abstract_html_url', typeof csl?.URL === 'string' ? csl.URL : fields.url);
  addMeta(tags, 'citation_fulltext_html_url', typeof csl?.URL === 'string' ? csl.URL : fields.url);
  addMeta(
    tags,
    'citation_abstract',
    typeof csl?.abstract === 'string' ? plainText(csl.abstract) : plainText(entry.contextual_description),
  );
  addMeta(tags, 'citation_language', typeof csl?.language === 'string' ? csl.language : fields.language ?? fields.langid);
  addMeta(tags, 'citation_keywords', typeof csl?.keyword === 'string' ? splitKeywords(csl.keyword) : splitKeywords(fields.keywords));

  if (collectionInfo?.collection_bib_url) {
    addMeta(tags, 'citation_pdf_url', null);
  }

  return dedupeMetaTags(tags);
}

function dedupeMetaTags(tags: CitationMetaTag[]): CitationMetaTag[] {
  const seen = new Set<string>();
  const result: CitationMetaTag[] = [];
  for (const tag of tags) {
    const key = `${tag.name}\u0000${tag.content}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export function buildDocumentTitle(entry: BihEntry | null, collectionInfo: CollectionInfoResponse | null): string {
  const collectionTitle = collectionInfo?.title ?? collectionInfo?.collection ?? 'BIH';
  if (!entry) {
    return collectionTitle;
  }
  return `${entry.record_cache.title} | ${collectionTitle}`;
}

export function applyCitationMetaToDocument(entry: BihEntry | null, collectionInfo: CollectionInfoResponse | null): void {
  document.title = buildDocumentTitle(entry, collectionInfo);

  for (const element of document.head.querySelectorAll('[data-bih-citation-meta="true"]')) {
    element.remove();
  }

  if (!entry) {
    return;
  }

  for (const tag of buildCitationMetaTags(entry, collectionInfo)) {
    const meta = document.createElement('meta');
    meta.name = tag.name;
    meta.content = tag.content;
    meta.dataset.bihCitationMeta = 'true';
    document.head.appendChild(meta);
  }

  document.dispatchEvent(
    new Event('ZoteroItemUpdated', {
      bubbles: true,
      cancelable: true,
    }),
  );
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
