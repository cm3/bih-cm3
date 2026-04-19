import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { IssuerIndexResponse, IssuerInfoResponse } from '../types';
import { renderRichText } from './bih-rich-text';
import { baseStyles } from './styles/base-styles';
import { topbarStyles } from './styles/topbar-styles';
import { renderTrashIcon } from './icons';

@customElement('bih-issuer')
export class BihIssuer extends LitElement {
  static styles = [
    baseStyles,
    topbarStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        padding: 0 24px 24px;
      }

      .issuer-shell {
        display: grid;
        gap: 18px;
      }

      .panel {
        padding: 20px;
      }

      .actions,
      .collection-links,
      .section-head {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }

      .section-head {
        justify-content: space-between;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(260px, 360px) minmax(260px, 1fr);
        gap: 18px;
      }

      .grid.viewer-mode {
        grid-template-columns: minmax(0, 1fr);
      }

      .grid > * {
        min-width: 0;
      }

      .collection-list {
        display: grid;
        gap: 12px;
      }

      .collection-card {
        display: grid;
        gap: 8px;
        padding: 16px;
        border-radius: 18px;
        background: var(--bih-color-input-bg-soft);
        border: 1px solid var(--bih-color-panel-border);
      }

      .collection-title {
        font-size: 1.02rem;
        font-weight: 600;
      }

      .collection-card-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .pill-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.2rem;
        padding: 0 0.85rem;
        border-radius: 999px;
        background: var(--bih-color-accent-soft);
        color: var(--bih-color-accent-soft-text);
        text-decoration: none;
      }

      .status {
        font-size: 0.9rem;
        color: var(--bih-color-meta);
      }

      .status[data-state='error'] {
        color: var(--bih-color-danger);
      }

      .status[data-state='saved'] {
        color: var(--bih-color-accent);
      }

      .danger-button {
        background: var(--bih-color-danger);
      }

      .danger-button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.2rem;
        min-width: 2.2rem;
        height: 2.2rem;
        padding: 0;
        border-radius: 999px;
      }

      .icon-button svg {
        width: 1.3rem;
        height: 1.3rem;
      }

      .icon-button svg.trash-icon {
        width: 1.65rem;
        height: 1.65rem;
      }

      .danger-icon-button {
        background: var(--bih-color-danger-soft);
        color: var(--bih-color-danger);
      }

      label,
      input,
      textarea {
        min-width: 0;
      }

      input[type='file'] {
        max-width: 100%;
        overflow: hidden;
      }

      @media (max-width: 800px) {
        :host {
          padding: 0 12px 12px;
        }

        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private info: IssuerInfoResponse | null = null;
  @state() private issuerIndex: IssuerIndexResponse | null = null;
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private collectionName = '';
  @state() private bibContent = '';
  @state() private bibFileName: string | null = null;
  @state() private createState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @state() private createMessage: string | null = null;
  @state() private deleteState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @state() private deleteMessage: string | null = null;
  @state() private deletingCollection: string | null = null;
  @state() private issuerInfoSaveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @state() private issuerInfoSaveMessage: string | null = null;
  @state() private currentMode: 'editor' | 'viewer' = this.readModeFromUrl();

  private readonly isDevRuntime = import.meta.env.DEV;

  private get isEditorMode(): boolean {
    return this.currentMode === 'editor';
  }

  private get publicRootUrl(): URL {
    return import.meta.env.DEV
      ? new URL('/', window.location.href)
      : new URL(/* @vite-ignore */ '../', import.meta.url);
  }

  private resolvePublicUrl(relativePath: string): string {
    return new URL(relativePath, this.publicRootUrl).toString();
  }

  private readModeFromUrl(): 'editor' | 'viewer' {
    const isDevRuntime = import.meta.env.DEV;
    const mode = new URL(window.location.href).searchParams.get('mode');
    if (mode === 'viewer') {
      return 'viewer';
    }
    if (mode === 'editor') {
      return isDevRuntime ? 'editor' : 'viewer';
    }
    return isDevRuntime ? 'editor' : 'viewer';
  }

  private setMode(mode: 'editor' | 'viewer') {
    this.currentMode = mode;
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    window.history.replaceState({}, '', url);
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadInfo();
  }

  private async loadInfo() {
    this.loading = true;
    this.error = null;

    try {
      const infoResponse = await fetch(this.resolvePublicUrl('./info.json'));
      if (!infoResponse.ok) {
        throw new Error(`Failed to load info.json: ${infoResponse.status}`);
      }
      const infoPayload = (await infoResponse.json()) as IssuerInfoResponse;
      const indexResponse = await fetch(this.resolvePublicUrl(infoPayload.collections_index_url));
      if (!indexResponse.ok) {
        throw new Error(`Failed to load index.json: ${indexResponse.status}`);
      }
      this.info = infoPayload;
      this.issuerIndex = (await indexResponse.json()) as IssuerIndexResponse;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  }

  private async handleBibFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.bibContent = '';
      this.bibFileName = null;
      return;
    }

    this.bibContent = await file.text();
    this.bibFileName = file.name;
    if (!this.collectionName) {
      this.collectionName = file.name.replace(/\.bib$/i, '').trim();
    }
    this.createState = 'idle';
    this.createMessage = null;
  }

  private async createCollection() {
    if (!this.isDevRuntime) {
      this.createState = 'error';
      this.createMessage = 'Collection creation is only available in `npm run dev`.';
      return;
    }
    if (!this.collectionName.trim()) {
      this.createState = 'error';
      this.createMessage = 'Collection name is required.';
      return;
    }
    if (!this.bibContent.trim()) {
      this.createState = 'error';
      this.createMessage = 'Select a BibTeX file first.';
      return;
    }

    this.createState = 'saving';
    this.createMessage = null;

    try {
      const response = await fetch('/__local/create-collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: this.collectionName.trim(),
          bib_content: this.bibContent,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; collection?: string };
      if (!response.ok || !payload.ok || !payload.collection) {
        throw new Error(payload.error ?? `Failed to create collection: ${response.status}`);
      }

      this.createState = 'saved';
      this.createMessage = `Created collection ${payload.collection}`;
      this.deleteState = 'idle';
      this.deleteMessage = null;
      this.collectionName = '';
      this.bibContent = '';
      this.bibFileName = null;
      await this.loadInfo();
    } catch (error) {
      this.createState = 'error';
      this.createMessage = error instanceof Error ? error.message : String(error);
    }
  }

  private async deleteCollection(collection: string) {
    if (!this.isDevRuntime) {
      this.deleteState = 'error';
      this.deleteMessage = 'Collection deletion is only available in `npm run dev`.';
      return;
    }
    const confirmed = window.confirm(
      `Delete collection "${collection}"?\n\nThis will remove its manifest, collection .bib, notes file, item .bib files, and generated JSON.`,
    );
    if (!confirmed) {
      return;
    }

    this.deleteState = 'saving';
    this.deleteMessage = null;
    this.deletingCollection = collection;

    try {
      const response = await fetch('/__local/delete-collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ collection }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; collection?: string };
      if (!response.ok || !payload.ok || !payload.collection) {
        throw new Error(payload.error ?? `Failed to delete collection: ${response.status}`);
      }

      this.deleteState = 'saved';
      this.deleteMessage = `Deleted collection ${payload.collection}`;
      this.createState = 'idle';
      this.createMessage = null;
      await this.loadInfo();
    } catch (error) {
      this.deleteState = 'error';
      this.deleteMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.deletingCollection = null;
    }
  }

  private updateIssuerInfo(mutator: (info: IssuerInfoResponse) => void) {
    if (!this.info) {
      return;
    }
    const next = structuredClone(this.info);
    mutator(next);
    this.info = next;
    this.issuerInfoSaveState = 'idle';
    this.issuerInfoSaveMessage = null;
  }

  private async saveIssuerInfo() {
    if (!this.isDevRuntime) {
      this.issuerInfoSaveState = 'error';
      this.issuerInfoSaveMessage = 'Issuer info editing is only available in `npm run dev`.';
      return;
    }
    if (!this.info) {
      return;
    }

    this.issuerInfoSaveState = 'saving';
    this.issuerInfoSaveMessage = null;

    try {
      const response = await fetch('/__local/save-issuer-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: this.info.title,
          description: this.info.description,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `Failed to save issuer info: ${response.status}`);
      }

      this.issuerInfoSaveState = 'saved';
      this.issuerInfoSaveMessage = 'Saved issuer title and description';
    } catch (error) {
      this.issuerInfoSaveState = 'error';
      this.issuerInfoSaveMessage = error instanceof Error ? error.message : String(error);
    }
  }

  private resolveRichTextTarget(target: string): string | null {
    const bihTarget = target.trim();
    const bihMatch = bihTarget.match(/^bih:([^/]+)\/([^/]+)\/([^/]+)$/i);
    if (bihMatch) {
      const [, _issuer, collection, entryId] = bihMatch;
      return this.resolvePublicUrl(`./${encodeURIComponent(collection)}/${encodeURIComponent(entryId)}`);
    }
    if (/^[a-z][a-z\d+\-.]*:/i.test(bihTarget) || bihTarget.startsWith('//')) {
      return null;
    }
    return this.resolvePublicUrl(bihTarget);
  }

  private renderRichText(text: string) {
    return renderRichText(text, {
      resolveInternalTarget: (target) => this.resolveRichTextTarget(target),
      openInternalTarget: (path) => {
        window.location.assign(path);
      },
    });
  }

  render() {
    return html`
      <div class="issuer-shell">
        <header class="topbar">
          <div class="topbar-main">
            ${this.isEditorMode
              ? html`
                  <input
                    class="editable-input topbar-title-input"
                    .value=${this.info?.title ?? this.info?.issuer ?? ''}
                    @input=${(event: Event) => {
                      this.updateIssuerInfo((info) => {
                        info.title = (event.target as HTMLInputElement).value;
                      });
                    }}
                    @blur=${() => void this.saveIssuerInfo()}
                  />
                  <textarea
                    class="editable-textarea topbar-description-input"
                    .value=${this.info?.description ?? ''}
                    @input=${(event: Event) => {
                      this.updateIssuerInfo((info) => {
                        info.description = (event.target as HTMLTextAreaElement).value;
                      });
                    }}
                    @blur=${() => void this.saveIssuerInfo()}
                  ></textarea>
                `
              : html`
                  <h1 class="topbar-title">${this.info?.title ?? this.info?.issuer ?? 'BIH Issuer'}</h1>
                  <p class="topbar-description rich-text">
                    ${this.renderRichText(this.info?.description ?? 'Inspect the published collection set.')}
                  </p>
                `}
            ${this.isEditorMode && this.issuerInfoSaveMessage
              ? html`<div class="status" data-state=${this.issuerInfoSaveState}>${this.issuerInfoSaveMessage}</div>`
              : ''}
          </div>
          <div class="topbar-right">
            <div class="mode-switch">
              <button
                ?selected=${this.currentMode === 'editor'}
                @click=${() => {
                  this.setMode('editor');
                }}
              >
                Editor
              </button>
              <button
                ?selected=${this.currentMode === 'viewer'}
                @click=${() => {
                  this.setMode('viewer');
                }}
              >
                Viewer
              </button>
            </div>
            <span class="bih-mark" aria-label="BIH issuer mark">
              <img class="bih-logo" src=${this.resolvePublicUrl('./assets/logo.png')} alt="BIH" />
              <span class="bih-mark-link bih-mark-static">${this.info?.issuer ?? '...'}</span>
            </span>
          </div>
        </header>

        ${this.loading
          ? html`<section class="panel"><div class="empty">Loading issuer info…</div></section>`
          : this.error
            ? html`<section class="panel"><div class="empty">${this.error}</div></section>`
            : html`
                <div class="grid ${this.isEditorMode ? 'editor-mode' : 'viewer-mode'}">
                  ${this.isEditorMode
                    ? html`
                        <section class="panel">
                          <div class="stack">
                            <h2>Create Collection</h2>
                            <label>
                              <span>Collection name</span>
                              <input
                                type="text"
                                placeholder="ch141-open-citations"
                                .value=${this.collectionName}
                                @input=${(event: Event) => {
                                  this.collectionName = (event.target as HTMLInputElement).value;
                                  this.createState = 'idle';
                                  this.createMessage = null;
                                }}
                              />
                            </label>
                            <label>
                              <span>BibTeX file</span>
                              <input
                                type="file"
                                accept=".bib"
                                @change=${(event: Event) => void this.handleBibFileChange(event)}
                              />
                            </label>
                            <div class="actions">
                              <button type="button" @click=${() => void this.createCollection()}>Create collection</button>
                              <div class="meta">
                                ${this.bibFileName ? `Selected: ${this.bibFileName}` : 'No BibTeX file selected'}
                              </div>
                            </div>
                            ${this.createMessage
                              ? html`<div class="status" data-state=${this.createState}>${this.createMessage}</div>`
                              : ''}
                          </div>
                        </section>
                      `
                    : ''}

                  <section class="panel">
                    <div class="stack">
                      <div class="section-head">
                        <h2>Collections</h2>
                      </div>
                      ${this.isEditorMode && this.deleteMessage
                        ? html`<div class="status" data-state=${this.deleteState}>${this.deleteMessage}</div>`
                        : ''}
                      <div class="collection-list">
                        ${(this.issuerIndex?.collections ?? []).map(
                          (collection) => html`
                            <article class="collection-card">
                              <div class="collection-card-head">
                                <div class="stack">
                                  <div class="collection-title">${collection.title ?? collection.collection}</div>
                                  ${collection.title && collection.title !== collection.collection
                                    ? html`<div class="meta">${collection.collection}</div>`
                                    : ''}
                                </div>
                                ${this.isEditorMode
                                  ? html`
                                      <button
                                        type="button"
                                        class="icon-button danger-icon-button"
                                        title="Delete collection"
                                        aria-label="Delete collection"
                                        ?disabled=${this.deletingCollection === collection.collection}
                                        @click=${() => void this.deleteCollection(collection.collection)}
                                      >
                                        ${renderTrashIcon()}
                                      </button>
                                    `
                                  : ''}
                              </div>
                              <div class="meta rich-text">
                                ${collection.description
                                  ? this.renderRichText(collection.description)
                                  : html`Collection <code>${collection.collection}</code> generated from BibTeX source.`}
                              </div>
                              <div class="collection-links">
                                <a class="pill-link" href=${this.resolvePublicUrl(`./${encodeURIComponent(collection.collection)}/`)}
                                  >Viewer</a
                                >
                                <a class="pill-link" href=${this.resolvePublicUrl(collection.collection_bib_url)}>Bib</a>
                                <a class="pill-link" href=${this.resolvePublicUrl(collection.manifest_url)}>Manifest</a>
                                ${collection.notes_url
                                  ? html`<a class="pill-link" href=${this.resolvePublicUrl(collection.notes_url)}>Notes</a>`
                                  : ''}
                              </div>
                            </article>
                          `,
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bih-issuer': BihIssuer;
  }
}
