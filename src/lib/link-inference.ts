import type { BihEntry, LinkItem, SourceRecord } from '../types';

interface LinkInferenceResult {
  addedLinks: LinkItem[];
}

interface RegistrationAgencyRecord {
  DOI?: string;
  RA?: string;
  status?: number;
}

export async function inferLinksForEntry(entry: BihEntry): Promise<LinkInferenceResult> {
  const addedLinks: LinkItem[] = [];
  const seen = buildExistingLinkKeySet(entry.links);
  const dois = extractDois(entry);
  const pageUrls = extractPageUrls(entry);
  const checkedAt = new Date().toISOString();

  for (const doi of dois) {
    const doiUrl = `https://doi.org/${encodeURIComponent(doi)}`;
    pushIfNew(
      seen,
      addedLinks,
      makeLink({
        property: 'bih:hasDOI',
        targetType: 'identifier',
        targetValue: doi,
        source: 'link-inference',
        label: 'DOI',
        url: doiUrl,
        note: 'Inferred from source metadata.',
        checkedAt,
      }),
    );

    const ra = await lookupRegistrationAgency(doi);
    if (ra === 'crossref') {
      const bibtexUrl = `https://api.crossref.org/v1/works/${encodeURIComponent(doi)}/transform/application/x-bibtex`;
      pushIfNew(
        seen,
        addedLinks,
        makeLink({
          property: 'bih:hasBibTeX',
          targetType: 'distribution',
          targetValue: bibtexUrl,
          source: 'link-inference',
          label: 'BibTeX',
          url: bibtexUrl,
          note: 'Inferred from DOI via Crossref registration agency lookup.',
          checkedAt,
        }),
      );
    } else if (ra === 'datacite') {
      const bibtexUrl = `https://data.crosscite.org/application/x-bibtex/${doi}`;
      const cslJsonUrl = `https://data.crosscite.org/application/vnd.citationstyles.csl+json/${doi}`;
      pushIfNew(
        seen,
        addedLinks,
        makeLink({
          property: 'bih:hasBibTeX',
          targetType: 'distribution',
          targetValue: bibtexUrl,
          source: 'link-inference',
          label: 'BibTeX',
          url: bibtexUrl,
          note: 'Inferred from DOI via DataCite registration agency lookup.',
          checkedAt,
        }),
      );
      pushIfNew(
        seen,
        addedLinks,
        makeLink({
          property: 'bih:hasCSLJSON',
          targetType: 'distribution',
          targetValue: cslJsonUrl,
          source: 'link-inference',
          label: 'CSL JSON',
          url: cslJsonUrl,
          note: 'Inferred from DOI via DataCite registration agency lookup.',
          checkedAt,
        }),
      );
    }

    const landingPage = pageUrls.find((url) => !isDoiUrl(url)) ?? null;
    if (landingPage) {
      pushIfNew(
        seen,
        addedLinks,
        makeLink({
          property: 'foaf:page',
          targetType: 'page',
          targetValue: landingPage,
          source: 'link-inference',
          label: 'Landing page',
          url: landingPage,
          note: 'Inferred from source metadata.',
          checkedAt,
        }),
      );
    }
  }

  return { addedLinks };
}

function makeLink(input: {
  property: string;
  targetType: LinkItem['target_type'];
  targetValue: string;
  source: string;
  label: string;
  url?: string | null;
  note?: string | null;
  checkedAt: string;
}): LinkItem {
  return {
    link_id: crypto.randomUUID(),
    property: input.property,
    label: input.label,
    description: null,
    target_type: input.targetType,
    target_value: input.targetValue,
    normalized_target: input.targetValue,
    source: input.source,
    url: input.url ?? null,
    access_note: null,
    last_checked_at: input.checkedAt,
    note: input.note ?? null,
  };
}

function buildExistingLinkKeySet(links: LinkItem[]): Set<string> {
  return new Set(links.map((link) => linkKey(link.property, link.target_value)));
}

function pushIfNew(seen: Set<string>, links: LinkItem[], candidate: LinkItem): void {
  const key = linkKey(candidate.property, candidate.target_value);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  links.push(candidate);
}

function linkKey(property: string, targetValue: string): string {
  return `${property}::${targetValue.trim()}`;
}

function extractDois(entry: BihEntry): string[] {
  const values = new Set<string>();
  for (const link of entry.links) {
    const doi = normalizeDoi(link.target_value);
    if (doi) {
      values.add(doi);
    }
  }
  for (const sourceRecord of entry.record_cache.source_records) {
    collectDoisFromValue(sourceRecord.record, values);
  }
  return Array.from(values);
}

function collectDoisFromValue(value: unknown, sink: Set<string>): void {
  if (typeof value === 'string') {
    const doi = normalizeDoi(value);
    if (doi) {
      sink.add(doi);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectDoisFromValue(item, sink);
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  for (const nested of Object.values(value)) {
    collectDoisFromValue(nested, sink);
  }
}

function extractPageUrls(entry: BihEntry): string[] {
  const values = new Set<string>();
  for (const link of entry.links) {
    if (isHttpUrl(link.target_value)) {
      values.add(link.target_value);
    }
    if (link.url && isHttpUrl(link.url)) {
      values.add(link.url);
    }
  }
  for (const sourceRecord of entry.record_cache.source_records) {
    collectUrlsFromSourceRecord(sourceRecord, values);
  }
  return Array.from(values);
}

function collectUrlsFromSourceRecord(sourceRecord: SourceRecord, sink: Set<string>): void {
  collectUrlsFromValue(sourceRecord.record, sink);
}

function collectUrlsFromValue(value: unknown, sink: Set<string>): void {
  if (typeof value === 'string') {
    if (isHttpUrl(value)) {
      sink.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrlsFromValue(item, sink);
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  for (const nested of Object.values(value)) {
    collectUrlsFromValue(nested, sink);
  }
}

function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withoutPrefix = trimmed
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
  return /^10\.\S+\/\S+$/i.test(withoutPrefix) ? withoutPrefix : null;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function isDoiUrl(value: string): boolean {
  return /^https?:\/\/(?:dx\.)?doi\.org\//i.test(value.trim());
}

async function lookupRegistrationAgency(doi: string): Promise<'crossref' | 'datacite' | null> {
  try {
    const response = await fetch(`https://doi.org/doiRA/${encodeURIComponent(doi)}`);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as RegistrationAgencyRecord[] | RegistrationAgencyRecord;
    const record = Array.isArray(payload) ? payload[0] : payload;
    const ra = record?.RA?.trim().toLowerCase() ?? null;
    if (ra === 'crossref' || ra === 'datacite') {
      return ra;
    }
    return null;
  } catch {
    return null;
  }
}
