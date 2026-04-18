import { html, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { live } from 'lit/directives/live.js';
import type { EntryIndexItem, ViewerCategoryOption } from '../types';

export interface TopBarViewModel {
  isDevRuntime: boolean;
  isEditorMode: boolean;
  currentMode: 'editor' | 'viewer';
  issuerLogoUrl: string;
  issuerLabel: string | null;
  issuerUrl: string | null;
  viewerTitle: string;
  viewerDescription: string;
  viewerDescriptionContent: TemplateResult;
  onViewerTitleInput: (value: string) => void;
  onViewerDescriptionInput: (value: string) => void;
  onSaveViewerCollection: () => void;
  onModeChange: (mode: 'editor' | 'viewer') => void;
}

export function renderTopBar(viewModel: TopBarViewModel): TemplateResult {
  return html`
    <header class="topbar">
      <div class="topbar-main">
        ${viewModel.isEditorMode
          ? html`
              <input
                class="editable-input topbar-title-input"
                .value=${viewModel.viewerTitle}
                @input=${(event: Event) => {
                  viewModel.onViewerTitleInput((event.target as HTMLInputElement).value);
                }}
                @blur=${viewModel.onSaveViewerCollection}
              />
              <textarea
                class="editable-textarea topbar-description-input"
                .value=${viewModel.viewerDescription}
                @input=${(event: Event) => {
                  viewModel.onViewerDescriptionInput((event.target as HTMLTextAreaElement).value);
                }}
                @blur=${viewModel.onSaveViewerCollection}
              ></textarea>
            `
          : html`
              <h1 class="topbar-title">${viewModel.viewerTitle}</h1>
              <p class="topbar-description rich-text">${viewModel.viewerDescriptionContent}</p>
            `}
      </div>
      <div class="topbar-right">
        ${viewModel.isDevRuntime
          ? html`
              <div class="mode-switch">
                <button
                  ?selected=${viewModel.currentMode === 'editor'}
                  @click=${() => {
                    viewModel.onModeChange('editor');
                  }}
                >
                  Editor
                </button>
                <button
                  ?selected=${viewModel.currentMode === 'viewer'}
                  @click=${() => {
                    viewModel.onModeChange('viewer');
                  }}
                >
                  Viewer
                </button>
              </div>
            `
          : ''}
        <span class="bih-mark" aria-label="BIH issuer link">
          <img class="bih-logo" src=${viewModel.issuerLogoUrl} alt="BIH" />
          ${viewModel.issuerUrl && viewModel.issuerLabel
            ? html`<a class="bih-mark-link" href=${viewModel.issuerUrl}>${viewModel.issuerLabel}</a>`
            : html`<span class="bih-mark-disabled">...</span>`}
        </span>
      </div>
    </header>
  `;
}

export interface SidebarViewModel {
  isEditorMode: boolean;
  searchQuery: string;
  categoryOptions: ViewerCategoryOption[];
  visibleViewerCategories: string[];
  filteredItems: EntryIndexItem[];
  totalItems: number;
  selectedUlid: string | null;
  onSearchInput: (value: string) => void;
  onVisibleViewerCategoriesChange: (value: string[]) => void;
  onSelectEntry: (ulid: string) => void;
  onCategoryChange: (item: EntryIndexItem, category: string) => void | Promise<void>;
}

export function renderSidebar(viewModel: SidebarViewModel): TemplateResult {
  const categoryOptions = viewModel.categoryOptions ?? [];
  const visibleViewerCategories = viewModel.visibleViewerCategories ?? [];
  const filteredItems = viewModel.filteredItems ?? [];
  const totalItems = viewModel.totalItems ?? filteredItems.length;
  return html`
    <section class="panel sidebar">
      <input
        class="search"
        type="search"
        placeholder="cached bibliographic metadata"
        .value=${viewModel.searchQuery}
        @input=${(event: Event) => {
          viewModel.onSearchInput((event.target as HTMLInputElement).value);
        }}
      />
      <div class="sidebar-count">${filteredItems.length} / ${totalItems} items</div>
      ${!viewModel.isEditorMode
        ? html`
            <div class="viewer-role-pills">
              ${categoryOptions.map(
                (option) => html`
                  <button
                    class="viewer-role-pill"
                    ?selected=${visibleViewerCategories.includes(option.id)}
                    @click=${() => {
                      const current = visibleViewerCategories;
                      const next = current.includes(option.id)
                        ? current.filter((value) => value !== option.id)
                        : [...current, option.id];
                      viewModel.onVisibleViewerCategoriesChange(next);
                    }}
                    @dblclick=${(event: Event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      viewModel.onVisibleViewerCategoriesChange([option.id]);
                    }}
                  >
                    ${option.id}
                  </button>
                `,
              )}
            </div>
          `
        : ''}
      <div class="entry-list">
        ${repeat(
          filteredItems,
          (item) => item.hub_id,
          (item) =>
            viewModel.isEditorMode
              ? html`
                  <div class="entry-row">
                    <label class="entry-role-select">
                      <span>category</span>
                      <select
                        .value=${live(item.viewer_category)}
                        @click=${(event: Event) => event.stopPropagation()}
                        @change=${(event: Event) => {
                          void viewModel.onCategoryChange(item, (event.target as HTMLSelectElement).value);
                        }}
                      >
                        ${categoryOptions.map(
                          (option) =>
                            html`<option value=${option.id} ?selected=${option.id === item.viewer_category}>${option.id}</option>`,
                        )}
                      </select>
                    </label>
                    <div
                      class="entry-card"
                      data-role=${item.viewer_category}
                      ?selected=${item.ulid === viewModel.selectedUlid}
                      @click=${() => {
                        viewModel.onSelectEntry(item.ulid);
                      }}
                    >
                      ${renderEntryCardBody(item)}
                    </div>
                  </div>
                `
              : html`
                  <div
                    class="entry-card"
                    data-role=${item.viewer_category}
                    ?selected=${item.ulid === viewModel.selectedUlid}
                    @click=${() => {
                      viewModel.onSelectEntry(item.ulid);
                    }}
                  >
                    ${renderEntryCardBody(item)}
                  </div>
                `,
        )}
      </div>
    </section>
  `;
}

function renderEntryCardBody(item: EntryIndexItem): TemplateResult {
  return html`
    <div class="entry-title">${item.title}</div>
    <div class="meta">${item.creators_summary}</div>
    <div class="meta">${item.issued_year ?? 'n.d.'}</div>
  `;
}
