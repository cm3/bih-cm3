import { css } from 'lit';

export const baseStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    --bih-color-text: #2f261b;
    --bih-color-body: #5d4931;
    --bih-color-meta: #71583b;
    --bih-color-heading: #7c6040;
    --bih-color-accent: #7f5522;
    --bih-color-accent-soft: #ede0cf;
    --bih-color-accent-soft-text: #5e4628;
    --bih-color-danger: #8b3300;
    --bih-color-danger-soft: rgba(139, 51, 0, 0.12);
    --bih-color-panel: rgba(255, 251, 245, 0.9);
    --bih-color-panel-strong: rgba(255, 251, 245, 0.96);
    --bih-color-panel-border: rgba(74, 54, 27, 0.14);
    --bih-color-input-bg: rgba(255, 255, 255, 0.92);
    --bih-color-input-bg-soft: rgba(255, 255, 255, 0.72);
    --bih-color-input-border: #d3c1a7;
    --bih-color-input-border-strong: rgba(127, 85, 34, 0.24);
    --bih-color-line-soft: rgba(112, 72, 15, 0.12);
    --bih-color-line-mid: rgba(112, 72, 15, 0.14);
    --bih-color-line-strong: rgba(112, 72, 15, 0.18);
    --bih-color-chip-bg: rgba(112, 72, 15, 0.08);
    --bih-color-chip-text: #6b5232;
    --bih-color-disabled-bg: rgba(235, 231, 226, 0.9);
    --bih-color-disabled-border: rgba(140, 131, 119, 0.2);
    --bih-color-disabled-text: #6b665f;
    --bih-color-selected-border: #8d5d21;
    --bih-color-selected-bg: #fff7eb;
    --bih-color-selected-text: #50391e;
    --bih-color-selected-outline: rgba(141, 93, 33, 0.18);
    --bih-color-context-bg: rgba(128, 120, 110, 0.12);
    --bih-color-context-text: #4e4942;
    --bih-color-context-selected-bg: rgba(235, 231, 226, 0.96);
    --bih-color-context-selected-border: #8c8377;
    --bih-color-context-selected-outline: rgba(140, 131, 119, 0.18);
    --bih-color-backdrop: rgba(26, 19, 12, 0.42);
    --bih-color-code-bg: #241b13;
    --bih-color-code-text: #f7efde;
    --bih-color-link-snippet: #7a6447;
    --bih-shadow-panel: 0 18px 40px rgba(80, 58, 32, 0.08);
    --bih-shadow-inset-soft: inset 0 1px 0 rgba(255, 255, 255, 0.72);
    --bih-gradient-soft-panel: linear-gradient(180deg, rgba(255, 253, 250, 0.94), rgba(251, 245, 236, 0.9));
    --bih-radius-panel: 22px;
    --bih-radius-soft: 16px;
    --bih-radius-control: 12px;
    --bih-radius-pill: 999px;
  }

  h1,
  h2,
  h3 {
    margin: 0;
    font-weight: 600;
    line-height: 1.15;
  }

  h1 {
    font-size: 1.9rem;
    margin-bottom: 10px;
  }

  h2 {
    font-size: 1.2rem;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 0.95rem;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--bih-color-heading);
  }

  p {
    margin: 0;
  }

  .panel {
    background: var(--bih-color-panel);
    border: 1px solid var(--bih-color-panel-border);
    border-radius: var(--bih-radius-panel);
    box-shadow: var(--bih-shadow-panel);
    backdrop-filter: blur(10px);
  }

  .lede {
    margin-bottom: 16px;
    color: var(--bih-color-body);
  }

  .meta {
    color: var(--bih-color-meta);
    font-size: 0.95rem;
  }

  .stack {
    display: grid;
    gap: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 0.92rem;
    color: var(--bih-color-body);
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid var(--bih-color-input-border);
    border-radius: var(--bih-radius-control);
    background: var(--bih-color-input-bg);
    padding: 0.62rem 0.75rem;
    color: var(--bih-color-text);
  }

  textarea {
    min-height: 100px;
    resize: vertical;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  button {
    border: none;
    border-radius: var(--bih-radius-pill);
    background: var(--bih-color-accent);
    color: #fff9f0;
    padding: 0.6rem 0.95rem;
    cursor: pointer;
  }

  button.secondary {
    background: var(--bih-color-accent-soft);
    color: var(--bih-color-accent-soft-text);
  }

  .save-status {
    font-size: 0.9rem;
    color: #6d512f;
    align-self: center;
  }

  .save-status[data-state='error'] {
    color: var(--bih-color-danger);
  }

  .empty {
    padding: 28px;
    text-align: center;
    color: var(--bih-color-heading);
  }

  .rich-text a {
    color: var(--bih-color-accent);
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.16em;
  }
`;
