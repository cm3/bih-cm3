import { css } from 'lit';

export const shellStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
    min-height: 100vh;
    padding: 0 24px 24px;
  }

  .app-shell {
    display: grid;
    gap: 18px;
  }

  .shell {
    display: grid;
    grid-template-columns: minmax(420px, 1.05fr) minmax(420px, 1.05fr) minmax(340px, 0.9fr);
    gap: 18px;
    align-items: start;
  }

  .panel {
  }

  .sidebar,
  .detail,
  .editor {
    padding: 18px;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: calc(100vh - 168px);
    overflow: hidden;
  }

  .shell.viewer {
    grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  }

  .shell.editor-mode {
    grid-template-columns: minmax(480px, 1fr) minmax(480px, 1fr);
  }

  .editable-input,
  .editable-textarea {
    display: block;
    width: 100%;
    border: 1px dashed var(--bih-color-input-border-strong);
    background: var(--bih-color-input-bg-soft);
    line-height: 1.35;
  }

  .editable-input {
    font-size: inherit;
    font-weight: inherit;
    padding: 0.35rem 0.5rem;
    margin: 0;
  }

  .editable-textarea {
    min-height: 84px;
    padding: 0.55rem 0.65rem;
  }

  .editable-input + .editable-input,
  .editable-input + .editable-textarea,
  .editable-textarea + .editable-input,
  .editable-textarea + .editable-textarea {
    margin-top: 10px;
  }

  .context-card {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
    padding: 0.95rem 1rem;
    border-radius: 18px;
    background: var(--bih-color-chip-bg);
    border: 1px solid var(--bih-color-line-soft);
  }

  .context-card .meta {
    margin-top: 6px;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .search {
    width: 100%;
    border: 1px solid var(--bih-color-input-border);
    border-radius: 999px;
    background: var(--bih-color-input-bg);
    padding: 0.7rem 1rem;
    margin-bottom: 12px;
  }

  .sidebar-count {
    margin: -2px 2px 12px;
    text-align: right;
    color: var(--bih-color-meta);
    font-size: 0.86rem;
  }

  .viewer-role-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 14px;
  }

  .viewer-role-pill {
    border: 1px solid var(--bih-color-line-strong);
    border-radius: 999px;
    background: var(--bih-color-input-bg);
    color: var(--bih-color-chip-text);
    padding: 0.42rem 0.82rem;
    font-size: 0.84rem;
    letter-spacing: 0.04em;
    text-transform: lowercase;
  }

  .viewer-role-pill[selected] {
    border-color: var(--bih-color-selected-border);
    background: rgba(127, 85, 34, 0.14);
    color: var(--bih-color-selected-text);
  }

  .entry-list {
    display: grid;
    flex: 1;
    min-height: 0;
    align-content: start;
    gap: 10px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
  }

  .entry-row {
    display: grid;
    grid-template-columns: 124px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  }

  .entry-role-select {
    display: grid;
    gap: 6px;
    align-content: start;
    padding-top: 6px;
  }

  .entry-role-select span {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bih-color-heading);
  }

  .entry-role-select select {
    min-width: 0;
  }

  .entry-card {
    border: 1px solid var(--bih-color-panel-border);
    border-radius: 18px;
    background: var(--bih-color-input-bg-soft);
    padding: 14px;
    cursor: pointer;
    text-align: left;
  }

  .entry-card[selected] {
    border-color: var(--bih-color-selected-border);
    background: var(--bih-color-selected-bg);
    box-shadow: inset 0 0 0 1px var(--bih-color-selected-outline);
  }

  .entry-title {
    font-size: 1.02rem;
    margin-bottom: 6px;
  }

  @media (max-width: 1180px) {
    .shell {
      grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
    }

    .editor {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 800px) {
    :host {
      padding: 0 12px 12px;
    }

    .topbar {
      grid-template-columns: 1fr;
      min-height: 0;
    }

    .topbar-right {
      justify-content: flex-start;
    }

    .shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      max-height: none;
      overflow: visible;
    }

    .entry-list {
      overflow: visible;
    }

    .entry-row {
      grid-template-columns: 1fr;
    }
  }
`;
