import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { applyCitationMetaToDocument } from '../lib/citation-meta';
import { inferLinksForEntry } from '../lib/link-inference';
import type {
  BihEntry,
  CollectionInfoResponse,
  EntryIndexItem,
  EntryIndexResponse,
  IssuerCollectionIndexItem,
  IssuerIndexResponse,
  IssuerInfoResponse,
  LinkItem,
  PropertyCatalogEntry,
  ViewerCategoryOption,
} from '../types';
import {
  buildCreatorsSummary,
  computePrimaryIdentifierValue,
  DEFAULT_PROPERTY_CATALOG,
  formatIdentifierValue,
  getPrimaryIdentifierCandidates,
  isIdentifierProperty,
  propertyCatalogMap,
  stripIdentifierPrefix,
  synchronizePrimaryIdentifier,
} from '../lib/schema';
import { renderRichText } from './bih-rich-text';
import { renderDetailPanel } from './bih-app-detail';
import { renderSidebar, renderTopBar } from './bih-app-shell';
import { detailStyles } from './styles/detail-styles';
import { baseStyles } from './styles/base-styles';
import { shellStyles } from './styles/shell-styles';
import { topbarStyles } from './styles/topbar-styles';

@customElement('bih-app')
export class BihApp extends LitElement {
  static styles = [baseStyles, topbarStyles, shellStyles, detailStyles];

  @state() private indexItems: EntryIndexItem[] = [];
  @state() private selectedUlid: string | null = null;
  @state() private selectedEntry: BihEntry | null = null;
  @state() private draftEntry: BihEntry | null = null;
  @state() private searchQuery = '';
  @state() private loadError: string | null = null;
  @state() private loading = true;
  @state() private collectionInfo: CollectionInfoResponse | null = null;
  @state() private collectionInfoDraft: CollectionInfoResponse | null = null;
  @state() private collectionInfoSaveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @state() private collectionInfoSaveMessage: string | null = null;
  @state() private entrySaveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  @state() private entrySaveMessage: string | null = null;
  @state() private visibleViewerCategories: string[] = [];
  @state() private propertyCatalog: PropertyCatalogEntry[] = DEFAULT_PROPERTY_CATALOG;
  @state() private issuerInfo: IssuerInfoResponse | null = null;
  @state() private issuerIndex: IssuerIndexResponse | null = null;
  @state() private activeCollection: IssuerCollectionIndexItem | null = null;

  private readonly isDevRuntime = import.meta.env.DEV;
  private readonly issuerRootUrl = import.meta.env.DEV
    ? new URL('/', window.location.href)
    : new URL(/* @vite-ignore */ '../', import.meta.url);
  @state() private currentMode: 'editor' | 'viewer' = import.meta.env.DEV ? 'editor' : 'viewer';

  private get isEditorMode(): boolean {
    return this.currentMode === 'editor';
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadIndex();
    window.addEventListener('popstate', this.handlePopState);
    applyCitationMetaToDocument(this.selectedEntry, this.collectionInfoDraft ?? this.collectionInfo);
  }

  disconnectedCallback(): void {
    window.removeEventListener('popstate', this.handlePopState);
    applyCitationMetaToDocument(null, this.collectionInfoDraft ?? this.collectionInfo);
    super.disconnectedCallback();
  }

  private handlePopState = () => {
    const entryUlid = this.readUlidFromLocation();
    if (!entryUlid) {
      return;
    }

    const found = this.indexItems.find((item) => item.ulid === entryUlid);
    if (found && found.ulid !== this.selectedUlid) {
      void this.selectEntry(found.ulid, false);
    }
  };

  private get activeIndexPath(): string | null {
    return this.activeCollection?.index_url ?? null;
  }

  private get viewerCategoryOptions(): ViewerCategoryOption[] {
    const activeCollectionInfo = this.collectionInfoDraft ?? this.collectionInfo;
    const configured = Array.isArray(activeCollectionInfo?.viewer_categories) ? activeCollectionInfo.viewer_categories : [];
    const byCategory = new Map(configured.map((option) => [option.id, option]));
    for (const item of this.indexItems) {
      if (!byCategory.has(item.viewer_category)) {
        byCategory.set(item.viewer_category, {
          id: item.viewer_category,
          visible_by_default: false,
        });
      }
    }
    return Array.from(byCategory.values());
  }

  private get defaultVisibleViewerCategories(): string[] {
    const visible = this.viewerCategoryOptions.filter((option) => option.visible_by_default).map((option) => option.id);
    if (visible.length > 0) {
      return visible;
    }
    if (this.viewerCategoryOptions.length > 0) {
      return this.viewerCategoryOptions.map((option) => option.id);
    }
    return this.indexItems.map((item) => item.viewer_category);
  }

  private resolveIssuerUrl(relativePath: string): string {
    return new URL(relativePath, this.issuerRootUrl).toString();
  }

  private resolveDatasetUrl(relativePath: string): string {
    if (!this.activeCollection) {
      throw new Error('No active collection');
    }
    const activeCollectionInfo = this.collectionInfoDraft ?? this.collectionInfo;
    const collectionBase =
      activeCollectionInfo?.item_base_url != null
        ? new URL(activeCollectionInfo.item_base_url, this.resolveIssuerUrl(this.activeCollection.info_url))
        : new URL(this.activeCollection.item_base_url, this.resolveIssuerUrl(this.activeCollection.info_url));
    return new URL(relativePath, collectionBase).toString();
  }

  private resolveLinkUrl(url: string | null): string | null {
    if (!url) {
      return null;
    }
    if (/^[a-z][a-z\d+\-.]*:/i.test(url) || url.startsWith('//')) {
      return url;
    }
    return this.resolveDatasetUrl(url);
  }

  private readCollectionFromLocation(collectionNames: string[]): string | null {
    const pathname = new URL(window.location.href).pathname;
    return collectionNames.find((collection) => new RegExp(`/${escapeRegExp(collection)}(?:/|$)`).test(pathname)) ?? null;
  }

  private readUlidFromLocation(): string | null {
    if (!this.activeCollection) {
      return null;
    }
    const pathname = new URL(window.location.href).pathname;
    const match = pathname.match(new RegExp(`/${escapeRegExp(this.activeCollection.collection)}(?:/([^/]+))?/?$`));
    return match?.[1] ? decodeURIComponent(match[1].replace(/\.html$/, '')) : null;
  }

  private buildEntryUrl(entryUlid: string): string {
    return new URL(`${this.activeCollection?.collection}/${entryUlid}`, this.issuerRootUrl).toString();
  }

  private buildItemJsonPublicPath(entryUlid: string): string {
    return `./${this.activeCollection?.collection}/${entryUlid}.json`;
  }

  private async loadIndex() {
    this.loading = true;
    this.loadError = null;

    try {
      const configResponse = await fetch(this.resolveIssuerUrl('info.json'));
      if (!configResponse.ok) {
        throw new Error(`Failed to load info: ${configResponse.status}`);
      }
      const configPayload = (await configResponse.json()) as IssuerInfoResponse;
      this.issuerInfo = configPayload;
      const issuerIndexResponse = await fetch(this.resolveIssuerUrl(configPayload.collections_index_url));
      if (!issuerIndexResponse.ok) {
        throw new Error(`Failed to load collections index: ${issuerIndexResponse.status}`);
      }
      const issuerIndexPayload = (await issuerIndexResponse.json()) as IssuerIndexResponse;
      if (!Array.isArray(issuerIndexPayload.collections)) {
        throw new Error('Issuer collections index is malformed: collections must be an array');
      }
      this.issuerIndex = issuerIndexPayload;
      const collectionParam = this.readCollectionFromLocation(issuerIndexPayload.collections.map((item) => item.collection));
      const activeCollection =
        issuerIndexPayload.collections.find((item) => item.collection === collectionParam) ??
        issuerIndexPayload.collections[0] ??
        null;
      if (!activeCollection) {
        throw new Error('No collections found in index.json');
      }
      this.activeCollection = activeCollection;

      const collectionInfoResponse = await fetch(this.resolveIssuerUrl(activeCollection.info_url));
      if (!collectionInfoResponse.ok) {
        throw new Error(`Failed to load collection info: ${collectionInfoResponse.status}`);
      }
      const collectionInfoPayload = (await collectionInfoResponse.json()) as CollectionInfoResponse;
      const normalizedCollectionInfo = {
        ...collectionInfoPayload,
        viewer_categories: Array.isArray(collectionInfoPayload.viewer_categories) ? collectionInfoPayload.viewer_categories : [],
      };
      this.collectionInfo = normalizedCollectionInfo;
      this.collectionInfoDraft = structuredClone(normalizedCollectionInfo);
      applyCitationMetaToDocument(this.selectedEntry, this.collectionInfoDraft ?? this.collectionInfo);
      const collectionIndexUrl = new URL(
        normalizedCollectionInfo.index_url ?? activeCollection.index_url,
        this.resolveIssuerUrl(activeCollection.info_url),
      ).toString();
      const indexResponse = await fetch(collectionIndexUrl);
      if (!indexResponse.ok) {
        throw new Error(`Failed to load index: ${indexResponse.status}`);
      }

      const payload = (await indexResponse.json()) as EntryIndexResponse;
      if (!Array.isArray(payload.entries)) {
        throw new Error('Collection index is malformed: entries must be an array');
      }
      this.propertyCatalog = DEFAULT_PROPERTY_CATALOG;
      this.indexItems = payload.entries.map((item) => {
        const viewerCategory = item.viewer_category ?? 'references';
        return {
          ...item,
          viewer_category: viewerCategory,
          primary_id_value: formatIdentifierValue(item.primary_id_value, item.primary_id_property, this.propertyCatalog),
        };
      });
      this.visibleViewerCategories = Array.from(new Set(this.defaultVisibleViewerCategories));
      const initialUlid = this.readUlidFromLocation();
      const initial = this.indexItems.find((item) => item.ulid === initialUlid) ?? this.indexItems[0] ?? null;

      if (initial) {
        await this.selectEntry(initial.ulid, false);
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  }

  private async selectEntry(entryUlid: string, pushHistory = true) {
    this.selectedUlid = entryUlid;
    this.selectedEntry = null;
    this.draftEntry = null;
    this.loadError = null;

    try {
      const item = this.indexItems.find((entry) => entry.ulid === entryUlid);
      if (!item) {
        throw new Error(`Unknown entry: ${entryUlid}`);
      }
      const response = await fetch(this.resolveDatasetUrl(item.item_json_url));
      if (!response.ok) {
        throw new Error(`Failed to load entry: ${response.status}`);
      }

      const entry = synchronizePrimaryIdentifier((await response.json()) as BihEntry, this.propertyCatalog);
      this.selectedEntry = entry;
      this.draftEntry = structuredClone(entry);
      applyCitationMetaToDocument(entry, this.collectionInfoDraft ?? this.collectionInfo);
      if (pushHistory) {
        window.history.pushState({}, '', this.buildEntryUrl(entryUlid));
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
      applyCitationMetaToDocument(null, this.collectionInfoDraft ?? this.collectionInfo);
    }
  }

  private get filteredItems(): EntryIndexItem[] {
    const query = this.searchQuery.trim().toLowerCase();
    const listedItems = this.isEditorMode
      ? this.indexItems
      : this.indexItems.filter((item) => this.visibleViewerCategories.includes(item.viewer_category));
    if (!query) {
      return listedItems;
    }

    return listedItems.filter((item) =>
      [item.search_text, item.title, item.creators_summary, item.hub_id, item.primary_id_value].some((value) =>
        typeof value === 'string' &&
        value.toLowerCase().includes(query),
      ),
    );
  }

  private get ulidByHubId(): Map<string, string> {
    return new Map(this.indexItems.map((item) => [item.hub_id, item.ulid]));
  }

  private get itemByHubId(): Map<string, EntryIndexItem> {
    return new Map(this.indexItems.map((item) => [item.hub_id, item]));
  }

  private resolveLinkedEntry(target: string): EntryIndexItem | null {
    return this.itemByHubId.get(target) ?? null;
  }

  private renderLinkAction(link: LinkItem) {
    const targetItem = this.resolveLinkedEntry(link.target_value);
    const fallbackLabel = targetItem?.title ?? this.getLinkLabel(link);
    const targetUlid = this.ulidByHubId.get(link.target_value);
    const resolvedUrl = this.resolveLinkUrl(link.url);
    if (targetUlid) {
      return html`
        <a
          href=${this.buildEntryUrl(targetUlid)}
          @click=${(event: Event) => {
            event.preventDefault();
            void this.selectEntry(targetUlid);
          }}
        >
          ${fallbackLabel ?? link.target_value}
        </a>
      `;
    }

    if (resolvedUrl) {
      return html`
        <a href=${resolvedUrl} target="_blank" rel="noreferrer">${fallbackLabel ?? link.url}</a>
      `;
    }

    return null;
  }

  private renderLinkJump(link: LinkItem) {
    const targetUlid = this.ulidByHubId.get(link.target_value);
    const resolvedUrl = this.resolveLinkUrl(link.url);
    if (targetUlid) {
      return html`
        <button
          class="secondary"
          type="button"
          title="Open linked entry"
          @click=${() => {
            void this.selectEntry(targetUlid);
          }}
        >
          ↗
        </button>
      `;
    }

    const externalUrl = /^https?:\/\//i.test(link.target_value) ? link.target_value : resolvedUrl;
    if (externalUrl) {
      return html`
        <a class="link-jump" href=${externalUrl} target="_blank" rel="noreferrer" title="Open target">
          ↗
        </a>
      `;
    }

    return null;
  }

  private getLinkLabel(link: LinkItem) {
    if (isIdentifierProperty(link.property, link.target_type, this.propertyCatalog)) {
      return formatIdentifierValue(link.target_value, link.property, this.propertyCatalog);
    }
    const fallback = this.resolveLinkedEntry(link.target_value)?.title ?? link.url;
    return link.label?.trim() || fallback || link.target_value;
  }

  private getLinkDescription(link: LinkItem) {
    const fallback = this.resolveLinkedEntry(link.target_value)?.contextual_description_summary ?? null;
    return link.description?.trim() || fallback || null;
  }

  private getPropertyLabel(property: string): string {
    const entry = propertyCatalogMap(this.propertyCatalog).get(property);
    return entry?.label ?? property;
  }

  private getPrimaryIdentifierPropertyCandidates(entry: BihEntry): string[] {
    return getPrimaryIdentifierCandidates(entry, this.propertyCatalog);
  }

  private computePrimaryIdentifierValueForEntry(entry: BihEntry, property: string): string {
    return computePrimaryIdentifierValue(entry, property, this.propertyCatalog);
  }

  private getHubIdDisplay(entry: BihEntry): string {
    return stripIdentifierPrefix(entry.hub_id, 'bih:hasBihId', this.propertyCatalog);
  }

  private get linkPropertyOptions(): PropertyCatalogEntry[] {
    return this.propertyCatalog;
  }

  private resolveRichTextTarget(target: string): string | null {
    const targetUlid = this.ulidByHubId.get(target);
    return targetUlid ? this.buildEntryUrl(targetUlid) : null;
  }

  private renderRichText(text: string) {
    return renderRichText(text, {
      resolveInternalTarget: (target) => this.resolveRichTextTarget(target),
      openInternalTarget: (targetUrl) => {
        const targetEntryUlid = decodeURIComponent(targetUrl.split('/').at(-1) ?? '');
        if (targetEntryUlid) {
          void this.selectEntry(targetEntryUlid);
        }
      },
    });
  }

  private updateDraft(mutator: (draft: BihEntry) => void) {
    if (!this.draftEntry) {
      return;
    }

    const next = structuredClone(this.draftEntry);
    mutator(next);
    this.draftEntry = synchronizePrimaryIdentifier(next, this.propertyCatalog);
    this.entrySaveState = 'idle';
    this.entrySaveMessage = null;
  }

  private updateCollectionInfoDraft(mutator: (draft: CollectionInfoResponse) => void) {
    if (!this.collectionInfoDraft) {
      return;
    }

    const next = structuredClone(this.collectionInfoDraft);
    mutator(next);
    this.collectionInfoDraft = next;
    this.collectionInfoSaveState = 'idle';
    this.collectionInfoSaveMessage = null;
  }

  private buildIndexJsonPayload(overrides: Partial<Pick<EntryIndexResponse, 'entries'>> = {}): EntryIndexResponse {
    return {
      entries: overrides.entries ?? this.indexItems,
    };
  }

  private saveIndexJson = async (payload: EntryIndexResponse) => {
    if (!this.activeIndexPath) {
      throw new Error('No active collection index path');
    }

    const response = await fetch('/__local/save-index-json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: this.activeIndexPath,
        index: payload,
      }),
    });

    const result = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? `Failed to save index.json: ${response.status}`);
    }
  };

  private saveCollectionInfo = async () => {
    if (!this.isEditorMode || !this.collectionInfoDraft || !this.activeCollection) {
      return;
    }

    this.collectionInfoSaveState = 'saving';
    this.collectionInfoSaveMessage = null;

    try {
      const response = await fetch('/__local/save-collection-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: this.activeCollection.collection,
          info: this.collectionInfoDraft,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? `Failed to save collection info: ${response.status}`);
      }

      this.collectionInfo = structuredClone(this.collectionInfoDraft);
      this.activeCollection = {
        ...this.activeCollection,
        title: this.collectionInfoDraft.title,
        description: this.collectionInfoDraft.description,
      };
      this.issuerIndex = this.issuerIndex
        ? {
            collections: this.issuerIndex.collections.map((item) =>
              item.collection === this.activeCollection?.collection
                ? {
                    ...item,
                    title: this.collectionInfoDraft?.title ?? null,
                    description: this.collectionInfoDraft?.description ?? null,
                  }
                : item,
            ),
          }
        : this.issuerIndex;
      this.collectionInfoSaveState = 'saved';
      this.collectionInfoSaveMessage = `Saved to ${this.activeCollection.info_url}`;
    } catch (error) {
      this.collectionInfoSaveState = 'error';
      this.collectionInfoSaveMessage = error instanceof Error ? error.message : String(error);
    }
  };

  private saveSelectedEntry = async () => {
    if (!this.isEditorMode || !this.draftEntry || !this.selectedUlid) {
      return;
    }

    const nextDraft = synchronizePrimaryIdentifier(structuredClone(this.draftEntry), this.propertyCatalog);
    this.draftEntry = nextDraft;

    if (this.selectedEntry && JSON.stringify(this.selectedEntry) === JSON.stringify(nextDraft)) {
      return;
    }

    this.entrySaveState = 'saving';
    this.entrySaveMessage = null;

    try {
      const selectedItem = this.indexItems.find((item) => item.ulid === this.selectedUlid);
      if (!selectedItem) {
        throw new Error(`Unknown selected entry: ${this.selectedUlid}`);
      }
      const response = await fetch('/__local/save-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: this.buildItemJsonPublicPath(selectedItem.ulid),
          index_path: this.activeIndexPath,
          entry: nextDraft,
          index_update: {
            title: nextDraft.record_cache.title,
            contextual_description_summary: nextDraft.contextual_description,
            creators_summary: buildCreatorsSummary(nextDraft.record_cache.creators),
            issued_year: nextDraft.record_cache.issued_year,
            primary_id_property: nextDraft.primary_id_property,
            primary_id_value: nextDraft.primary_id_value,
          },
        }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `Failed to save entry: ${response.status}`);
      }

      this.selectedEntry = structuredClone(nextDraft);
      this.indexItems = this.indexItems.map((item) =>
        item.hub_id === nextDraft.hub_id
          ? {
              ...item,
              title: nextDraft.record_cache.title,
              contextual_description_summary: nextDraft.contextual_description,
              creators_summary: buildCreatorsSummary(nextDraft.record_cache.creators),
              issued_year: nextDraft.record_cache.issued_year,
              primary_id_property: nextDraft.primary_id_property,
              primary_id_value: nextDraft.primary_id_value,
            }
          : item,
      );
      this.entrySaveState = 'saved';
      this.entrySaveMessage = 'Entry saved';
    } catch (error) {
      this.entrySaveState = 'error';
      this.entrySaveMessage = error instanceof Error ? error.message : String(error);
    }
  };

  private resetDraft = () => {
    if (!this.selectedEntry) {
      return;
    }

    this.draftEntry = structuredClone(this.selectedEntry);
  };

  private downloadDraft = () => {
    if (!this.draftEntry) {
      return;
    }

    const blob = new Blob([JSON.stringify(this.draftEntry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.draftEntry.hub_id.replace(/[:/]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  private groupedLinks(entry: BihEntry): Map<string, LinkItem[]> {
    const grouped = new Map<string, LinkItem[]>();
    entry.links.forEach((link) => {
      const list = grouped.get(link.property) ?? [];
      list.push(link);
      grouped.set(link.property, list);
    });
    return grouped;
  }

  private runLinkInference = async () => {
    if (!this.isEditorMode || !this.draftEntry) {
      return;
    }

    this.entrySaveState = 'saving';
    this.entrySaveMessage = 'Inferring links…';

    try {
      const { addedLinks } = await inferLinksForEntry(this.draftEntry);
      if (addedLinks.length === 0) {
        this.entrySaveState = 'idle';
        this.entrySaveMessage = 'No new links were inferred.';
        return;
      }

      this.updateDraft((draft) => {
        draft.links.push(...addedLinks);
      });
      await this.saveSelectedEntry();
      this.entrySaveState = 'saved';
      this.entrySaveMessage = `Added ${addedLinks.length} inferred link${addedLinks.length === 1 ? '' : 's'}.`;
    } catch (error) {
      this.entrySaveState = 'error';
      this.entrySaveMessage = error instanceof Error ? error.message : String(error);
    }
  };

  private saveIndexItem = async (hubId: string, updates: Partial<EntryIndexItem>) => {
    if (!this.isDevRuntime) {
      return;
    }

    try {
      const nextEntries = this.indexItems.map((item) => (item.hub_id === hubId ? { ...item, ...updates } : item));
      this.indexItems = nextEntries;
      await this.saveIndexJson(
        this.buildIndexJsonPayload({
          entries: nextEntries,
        }),
      );
    } catch (error) {
      this.entrySaveState = 'error';
      this.entrySaveMessage = error instanceof Error ? error.message : String(error);
    }
  };


  private renderSidebar() {
    return renderSidebar({
      isEditorMode: this.isEditorMode,
      searchQuery: this.searchQuery,
      categoryOptions: this.viewerCategoryOptions,
      visibleViewerCategories: this.visibleViewerCategories,
      filteredItems: this.filteredItems,
      totalItems: this.indexItems.length,
      selectedUlid: this.selectedUlid,
      onSearchInput: (value) => {
        this.searchQuery = value;
      },
      onVisibleViewerCategoriesChange: (value) => {
        this.visibleViewerCategories = value;
      },
      onSelectEntry: (entryUlid) => {
        void this.selectEntry(entryUlid);
      },
      onCategoryChange: async (item, category) => {
        this.indexItems = this.indexItems.map((current) =>
          current.hub_id === item.hub_id
            ? { ...current, viewer_category: category }
            : current,
        );
        await this.saveIndexItem(item.hub_id, { viewer_category: category });
      },
    });
  }

  private renderTopBar() {
    const activeCollectionInfo = this.collectionInfoDraft ?? this.collectionInfo;
    const viewerTitle = activeCollectionInfo?.title ?? 'Reference List';
    const viewerDescription = activeCollectionInfo?.description ?? 'Reference entries for the current bibliography.';

    return renderTopBar({
      isDevRuntime: this.isDevRuntime,
      isEditorMode: this.isEditorMode,
      currentMode: this.currentMode,
      issuerLogoUrl: this.resolveIssuerUrl('assets/logo.png'),
      issuerLabel: this.issuerInfo?.issuer ?? null,
      issuerUrl: this.issuerInfo ? this.resolveIssuerUrl('./') : null,
      viewerTitle,
      viewerDescription,
      viewerDescriptionContent: this.renderRichText(viewerDescription),
      onViewerTitleInput: (value) =>
        this.updateCollectionInfoDraft((next) => {
          next.title = value;
        }),
      onViewerDescriptionInput: (value) =>
        this.updateCollectionInfoDraft((next) => {
          next.description = value;
        }),
      onSaveViewerCollection: this.saveCollectionInfo,
      onModeChange: (mode) => {
        this.currentMode = mode;
      },
    });
  }

  private renderDetail() {
    return renderDetailPanel({
      loading: this.loading,
      loadError: this.loadError,
      selectedEntry: this.selectedEntry,
      draftEntry: this.draftEntry,
      isEditorMode: this.isEditorMode,
      metadataSourceLabel: (this.collectionInfoDraft ?? this.collectionInfo)?.metadata_source_label ?? null,
      entrySaveState: this.entrySaveState,
      entrySaveMessage: this.entrySaveMessage,
      groupedLinks: (entry) => this.groupedLinks(entry),
      resolveLinkedEntry: (target) => this.resolveLinkedEntry(target),
      getLinkLabel: (link) => this.getLinkLabel(link),
      getLinkDescription: (link) => this.getLinkDescription(link),
      getPropertyLabel: (property) => this.getPropertyLabel(property),
      getHubIdDisplay: (entry) => this.getHubIdDisplay(entry),
      renderRichText: (text) => this.renderRichText(text),
      renderLinkAction: (link) => this.renderLinkAction(link),
      renderLinkJump: (link) => this.renderLinkJump(link),
      getPrimaryIdentifierCandidates: (entry) => this.getPrimaryIdentifierPropertyCandidates(entry),
      computePrimaryIdentifierValue: (entry, property) => this.computePrimaryIdentifierValueForEntry(entry, property),
      updateDraft: (mutator) => this.updateDraft(mutator),
      saveSelectedEntry: this.saveSelectedEntry,
      runLinkInference: this.runLinkInference,
    });
  }

  render() {
    return html`
      <div class="app-shell">
        ${this.renderTopBar()}
        <main class="shell ${this.isEditorMode ? 'editor-mode' : 'viewer'}">
          ${this.renderSidebar()}
          ${this.renderDetail()}
        </main>
        <datalist id="link-property-options">
          ${this.linkPropertyOptions.map((entry) => html`<option value=${entry.property}></option>`)}
        </datalist>
      </div>
    `;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

declare global {
  interface HTMLElementTagNameMap {
    'bih-app': BihApp;
  }
}
