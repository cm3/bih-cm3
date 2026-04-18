import { html, type TemplateResult } from 'lit';
import type { BihEntry, LinkItem, RecordCache } from '../types';
import { buildCreatorsSummary, emptyLink, normalizeNullableString } from '../lib/schema';
import { renderPlusIcon, renderTrashIcon, renderWandIcon } from './icons';

export interface DetailPanelHost {
  loading: boolean;
  loadError: string | null;
  selectedEntry: BihEntry | null;
  draftEntry: BihEntry | null;
  isEditorMode: boolean;
  metadataSourceLabel: string | null;
  entrySaveState: 'idle' | 'saving' | 'saved' | 'error';
  entrySaveMessage: string | null;
  groupedLinks: (entry: BihEntry) => Map<string, LinkItem[]>;
  resolveLinkedEntry: (target: string) => { title: string; contextual_description_summary: string | null } | null;
  getLinkLabel: (link: LinkItem) => string;
  getLinkDescription: (link: LinkItem) => string | null;
  getPropertyLabel: (property: string) => string;
  getHubIdDisplay: (entry: BihEntry) => string;
  renderRichText: (text: string) => TemplateResult;
  renderLinkAction: (link: LinkItem) => TemplateResult | null;
  renderLinkJump: (link: LinkItem) => TemplateResult | null;
  getPrimaryIdentifierCandidates: (entry: BihEntry) => string[];
  computePrimaryIdentifierValue: (entry: BihEntry, property: string) => string;
  updateDraft: (mutator: (draft: BihEntry) => void) => void;
  saveSelectedEntry: () => void | Promise<void>;
  runLinkInference: () => void | Promise<void>;
}

function creatorLabel(recordCache: RecordCache): string {
  return buildCreatorsSummary(recordCache.creators) || '—';
}

function formatCacheSources(recordCache: RecordCache, metadataSourceLabel: string | null): string {
  const labels = new Set(
    recordCache.source_records
      .map((record) => {
        switch (record.source) {
          case 'source-bib':
          case 'citation-js-csl-json':
            return metadataSourceLabel ?? 'BibTeX file uploaded by the issuer';
          default:
            return record.source || null;
        }
      })
      .filter((label): label is string => Boolean(label)),
  );
  return labels.size > 0 ? Array.from(labels).join(', ') : '—';
}

function formatIssued(recordCache: RecordCache): string | null {
  return recordCache.issued_date ?? (recordCache.issued_year != null ? String(recordCache.issued_year) : null);
}

function resourceRows(recordCache: RecordCache): Array<{ key: string; value: string; block?: boolean }> {
  const rows: Array<{ key: string; value: string; block?: boolean }> = [
    { key: 'title', value: recordCache.title || '—' },
    { key: 'creators', value: creatorLabel(recordCache) },
    { key: 'issued', value: formatIssued(recordCache) ?? '—' },
    { key: 'resource type', value: recordCache.resource_type ?? '—' },
  ];

  const optionalRows: Array<{ key: string; value: string | null | undefined; block?: boolean }> = [
    { key: 'container title', value: recordCache.container_title },
    { key: 'container short title', value: recordCache.container_title_short },
    { key: 'collection title', value: recordCache.collection_title },
    { key: 'publisher', value: recordCache.publisher },
    { key: 'volume', value: recordCache.volume },
    { key: 'issue', value: recordCache.issue },
    { key: 'pages', value: recordCache.pages },
    { key: 'journal abbreviation', value: recordCache.journal_abbreviation },
    { key: 'language', value: recordCache.language },
    { key: 'note', value: recordCache.note, block: true },
    { key: 'keywords', value: recordCache.keywords },
    { key: 'ISBN', value: recordCache.isbn },
    { key: 'ISSN', value: recordCache.issn },
    { key: 'PMID', value: recordCache.pmid },
    { key: 'abstract', value: recordCache.abstract, block: true },
  ];

  rows.push(
    ...optionalRows.flatMap((row) => {
      const value = row.value?.trim();
      return value ? [{ key: row.key, value, block: row.block }] : [];
    }),
  );
  return rows;
}

function metadataRows(recordCache: RecordCache): Array<{ key: string; value: string; block?: boolean }> {
  return resourceRows(recordCache).filter((row) => row.key !== 'title');
}

function renderViewerDetail(
  host: DetailPanelHost,
  entry: BihEntry,
  grouped: Map<string, LinkItem[]>,
  cacheSourceLabel: string,
): TemplateResult {
  const title = entry.record_cache.title || 'Untitled';
  const literalRows = metadataRows(entry.record_cache);
  const bihIdentifierValue = host.computePrimaryIdentifierValue(entry, 'bih:hasBihId');
  const primaryIdentifierValue = host.computePrimaryIdentifierValue(entry, entry.primary_id_property);
  const primaryMatch = (property: string, displayValue: string) =>
    property === entry.primary_id_property && displayValue === primaryIdentifierValue;

  return html`
    <section class="panel detail">
      <h2 class="detail-title">${title}</h2>
      ${entry.contextual_description
        ? html`<div class="detail-description rich-text">${host.renderRichText(entry.contextual_description)}</div>`
        : ''}

      ${literalRows.length > 0
        ? html`
            <div class="section viewer-metadata-section">
              <div class="key-value">
                ${literalRows.map(
                  (row) => html`
                    <div class="key">${row.key}</div>
                    <div class=${row.block ? 'resource-block' : ''}>${row.value}</div>
                  `,
                )}
              </div>
            </div>
          `
        : ''}

      <div class="detail-provenance">cached from ${cacheSourceLabel}</div>
      <div class="section viewer-link-section">
        <div class="simple-link-list">
          <div class="simple-link-row" data-primary=${primaryMatch('bih:hasBihId', bihIdentifierValue) ? 'true' : 'false'}>
            <div class="key">BIH ID</div>
            <div>${bihIdentifierValue}</div>
          </div>
          ${Array.from(grouped.entries()).flatMap(([property, links]) =>
            property === 'bih:hasBihId'
              ? []
              :
            links.map((link) => {
              const targetLabel = host.getLinkLabel(link);
              const targetSnippet = host.getLinkDescription(link);
              const action = host.renderLinkAction(link);
              return html`
                <div class="simple-link-row" data-primary=${primaryMatch(property, targetLabel) ? 'true' : 'false'}>
                  <div class="key">${host.getPropertyLabel(property)}</div>
                  <div>
                    ${action ?? html`${targetLabel}`}
                    ${targetSnippet ? html`<div class="link-snippet">${targetSnippet}</div>` : ''}
                  </div>
                </div>
              `;
            }),
          )}
        </div>
      </div>
    </section>
  `;
}

function renderEditorDetail(
  host: DetailPanelHost,
  entry: BihEntry,
  primaryIdentifierCandidates: string[],
): TemplateResult {
  return html`
    <section class="panel detail">
      ${host.entrySaveMessage
        ? html`<div class="save-status" data-state=${host.entrySaveState}>${host.entrySaveMessage}</div>`
        : ''}

      <div class="section">
        <h3>Resource</h3>
        <div class="key-value">
          ${resourceRows(entry.record_cache).map(
            (row) => html`
              <div class="key">${row.key}</div>
              <div class=${row.block ? 'resource-block' : ''}>${row.value}</div>
            `,
          )}
        </div>
      </div>

      <div class="section">
        <h3>Hub Entry</h3>
        <div class="key-value">
          <div class="key">BIH ID</div>
          <div>${host.getHubIdDisplay(entry)}</div>
          <div class="key">primary identifier property</div>
          <div>
            <select
              class="editable-select"
              .value=${entry.primary_id_property}
              @change=${(event: Event) =>
                host.updateDraft((draft) => {
                  const property = (event.target as HTMLSelectElement).value;
                  draft.primary_id_property = property;
                  draft.primary_id_value = host.computePrimaryIdentifierValue(draft, property);
                })}
              @blur=${host.saveSelectedEntry}
            >
              ${primaryIdentifierCandidates.map(
                (property) => html`<option value=${property}>${host.getPropertyLabel(property)}</option>`,
              )}
            </select>
          </div>
          <div class="key">primary identifier</div>
          <div>${host.computePrimaryIdentifierValue(entry, entry.primary_id_property)}</div>
          <div class="key">Contextual Description</div>
          <div>
            <textarea
              class="editable-textarea hub-description-input"
              .value=${entry.contextual_description ?? ''}
              @input=${(event: Event) =>
                host.updateDraft((next) => {
                  next.contextual_description = normalizeNullableString((event.target as HTMLTextAreaElement).value);
                })}
              @blur=${host.saveSelectedEntry}
            ></textarea>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Links</h3>
          <div class="section-actions">
            <button
              class="icon-button accent-icon-button"
              title="Infer links"
              aria-label="Infer links"
              @click=${host.runLinkInference}
            >
              ${renderWandIcon()}
            </button>
            <button
              class="icon-button accent-icon-button"
              title="Add link"
              aria-label="Add link"
              @click=${() =>
                host.updateDraft((draft) => {
                  draft.links.push(emptyLink());
                })}
            >
              ${renderPlusIcon()}
            </button>
          </div>
        </div>
        <div class="link-editor-list">
          ${entry.links.map((link, index) => {
            const resolvedEntry = host.resolveLinkedEntry(link.target_value);
            const isAutoResolved = resolvedEntry != null;
            const targetLabel = host.getLinkLabel(link);
            const targetSnippet = host.getLinkDescription(link);
            return html`
              <div class="link-editor-row">
                <div class="link-form-stack">
                  <label class="form-field">
                    <span class="form-label">Property</span>
                    <input
                      list="link-property-options"
                      .value=${link.property}
                      @input=${(event: Event) =>
                        host.updateDraft((draft) => {
                          draft.links[index].property = (event.target as HTMLInputElement).value as LinkItem['property'];
                        })}
                      @blur=${host.saveSelectedEntry}
                    />
                  </label>
                  <label class="form-field">
                    <span class="form-label">Value</span>
                    <div class="value-with-jump">
                      <input
                        .value=${link.target_value}
                        @input=${(event: Event) =>
                          host.updateDraft((draft) => {
                            draft.links[index].target_value = (event.target as HTMLInputElement).value;
                          })}
                        @blur=${host.saveSelectedEntry}
                      />
                      ${host.renderLinkJump(link)}
                    </div>
                  </label>
                  <label class="form-field" data-auto=${isAutoResolved ? 'true' : 'false'}>
                    <span class="form-label">Label</span>
                    <input
                      .value=${isAutoResolved ? resolvedEntry.title : link.label ?? targetLabel}
                      ?disabled=${isAutoResolved}
                      @input=${(event: Event) =>
                        host.updateDraft((draft) => {
                          draft.links[index].label = normalizeNullableString((event.target as HTMLInputElement).value);
                        })}
                      @blur=${host.saveSelectedEntry}
                    />
                  </label>
                  <label class="form-field" data-auto=${isAutoResolved ? 'true' : 'false'}>
                    <span class="form-label">Description</span>
                    <textarea
                      .value=${isAutoResolved ? resolvedEntry.contextual_description_summary ?? '' : link.description ?? targetSnippet ?? ''}
                      ?disabled=${isAutoResolved}
                      @input=${(event: Event) =>
                        host.updateDraft((draft) => {
                          draft.links[index].description = normalizeNullableString(
                            (event.target as HTMLTextAreaElement).value,
                          );
                        })}
                      @blur=${host.saveSelectedEntry}
                    ></textarea>
                  </label>
                </div>
                <div class="link-row-actions">
                  <button
                    class="icon-button danger-icon-button"
                    title="Remove link"
                    aria-label="Remove link"
                    @click=${async () => {
                      host.updateDraft((draft) => {
                        draft.links.splice(index, 1);
                      });
                      await host.saveSelectedEntry();
                    }}
                  >
                    ${renderTrashIcon()}
                  </button>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

export function renderDetailPanel(host: DetailPanelHost): TemplateResult {
  if (host.loading) {
    return html`<section class="panel detail"><div class="empty">Loading…</div></section>`;
  }

  if (host.loadError) {
    return html`<section class="panel detail"><div class="empty">${host.loadError}</div></section>`;
  }

  if (!host.selectedEntry) {
    return html`<section class="panel detail"><div class="empty">No entry selected.</div></section>`;
  }

  const entry = host.isEditorMode ? host.draftEntry ?? host.selectedEntry : host.selectedEntry;
  const grouped = host.groupedLinks(entry);
  const primaryIdentifierCandidates = host.getPrimaryIdentifierCandidates(entry);
  const cacheSourceLabel = formatCacheSources(entry.record_cache, host.metadataSourceLabel);

  return host.isEditorMode
    ? renderEditorDetail(host, entry, primaryIdentifierCandidates)
    : renderViewerDetail(host, entry, grouped, cacheSourceLabel);
}
