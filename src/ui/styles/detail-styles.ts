import { css } from 'lit';

export const detailStyles = css`
  .detail-title {
    margin: 0;
    font-size: 1.45rem;
    line-height: 1.2;
    color: var(--bih-color-text);
  }

  .detail-description {
    margin-top: 14px;
    color: var(--bih-color-body);
    line-height: 1.6;
  }

  .detail-provenance {
    text-align: right;
    color: var(--bih-color-meta);
    font-size: 0.88rem;
    margin-top: 16px;
  }

  .section {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--bih-color-line-soft);
  }

  .section:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .key-value {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 8px 12px;
    font-size: 0.95rem;
  }

  .key {
    color: var(--bih-color-heading);
  }

  .simple-link-list {
    display: grid;
    gap: 8px;
  }

  .viewer-link-section {
    margin-top: 8px;
  }

  .viewer-metadata-section {
    border-top: 0;
    padding-top: 0;
  }

  .link-editor-list {
    display: grid;
    gap: 10px;
  }

  .link-editor-row {
    display: grid;
    gap: 12px;
    border: 1px solid var(--bih-color-line-mid);
    border-radius: 16px;
    padding: 14px;
    background: var(--bih-gradient-soft-panel);
    box-shadow: var(--bih-shadow-inset-soft);
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.3rem;
    min-width: 2.3rem;
    height: 2.3rem;
    padding: 0;
    border-radius: 999px;
  }

  .section-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .icon-button svg {
    width: 1.3rem;
    height: 1.3rem;
  }

  .icon-button .wand-icon,
  .icon-button svg.wand-icon {
    width: 1.6rem;
    height: 1.6rem;
  }

  .icon-button svg.trash-icon {
    width: 1.65rem;
    height: 1.65rem;
  }

  .danger-icon-button {
    background: var(--bih-color-danger-soft);
    color: var(--bih-color-danger);
  }

  .accent-icon-button {
    background: var(--bih-color-input-bg-soft);
    background: var(--bih-color-danger-soft);
    color: var(--bih-color-danger);
  }

  .link-form-stack {
    display: grid;
    gap: 10px;
  }

  .link-row-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-top: 2px;
  }

  .form-field {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--bih-color-line-soft);
    border-radius: 14px;
    background: var(--bih-color-input-bg);
  }

  .form-label {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bih-color-heading);
  }

  .form-field input,
  .form-field textarea {
    border: none;
    border-radius: 0;
    background: transparent;
    padding: 0.12rem 0.08rem;
    line-height: 1.45;
  }

  .form-field textarea {
    min-height: 72px;
  }

  .value-with-jump {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }

  .link-jump,
  .value-with-jump button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.2rem;
    min-width: 2.2rem;
    height: 2.2rem;
    padding: 0;
    line-height: 1;
    text-decoration: none;
  }

  .form-field[data-auto='true'] {
    background: var(--bih-color-disabled-bg);
    border-color: var(--bih-color-disabled-border);
  }

  .form-field input:disabled,
  .form-field textarea:disabled {
    color: var(--bih-color-disabled-text);
    cursor: not-allowed;
    opacity: 1;
  }

  .hub-description-input {
    min-height: 110px;
  }

  .resource-block {
    white-space: pre-wrap;
  }

  .simple-link-row {
    position: relative;
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 8px 12px;
    font-size: 0.95rem;
    line-height: 1.55;
    padding-left: 12px;
  }

  .simple-link-row[data-primary='true']::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.2rem;
    bottom: 0.2rem;
    width: 3px;
    border-radius: 999px;
    background: var(--bih-color-accent);
  }

  .simple-link-row .key {
    color: var(--bih-color-body);
  }

  .link-snippet {
    margin-top: 2px;
    color: var(--bih-color-link-snippet);
    font-size: 0.9rem;
  }

  .row-note {
    color: var(--bih-color-meta);
    font-size: 0.92rem;
  }

  @media (max-width: 800px) {
    .key-value {
      grid-template-columns: 1fr;
    }

    .simple-link-row {
      grid-template-columns: 1fr;
    }
  }
`;
