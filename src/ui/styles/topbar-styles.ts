import { css } from 'lit';

export const topbarStyles = css`
  .topbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    padding: 16px 18px;
    min-height: 118px;
    margin: 0 -24px;
    background: var(--bih-color-panel-strong);
    border-bottom: 1px solid var(--bih-color-panel-border);
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    border-top: 0;
    box-shadow: none;
    backdrop-filter: none;
  }

  .topbar-main,
  .topbar-right {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .topbar-main {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .topbar-title {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.15;
    color: var(--bih-color-text);
  }

  .topbar-description {
    margin: 0;
    max-width: none;
    color: var(--bih-color-body);
    line-height: 1.45;
  }

  .topbar-title-input {
    max-width: 34rem;
    font-size: 1.3rem;
    font-weight: 600;
    line-height: 1.15;
    padding: 0.45rem 0.6rem;
  }

  .topbar-description-input {
    max-width: none;
    min-height: 4.9rem;
  }

  .mode-switch {
    display: inline-flex;
    gap: 6px;
    padding: 4px;
    border-radius: 999px;
    background: var(--bih-color-chip-bg);
  }

  .mode-switch button {
    background: transparent;
    color: var(--bih-color-chip-text);
    padding: 0.42rem 0.78rem;
  }

  .mode-switch button[selected] {
    background: var(--bih-color-accent);
    color: #fff9f0;
  }

  .display-config {
    display: grid;
    gap: 4px;
    font-size: 0.82rem;
    color: var(--bih-color-meta);
    padding: 0.45rem 0.7rem;
    border-radius: 14px;
    background: var(--bih-color-chip-bg);
  }

  .display-config span {
    font-size: 0.74rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .display-config select {
    min-width: 8.5rem;
    padding: 0.42rem 0.55rem;
    font-size: 0.9rem;
    border-radius: 10px;
  }

  .bih-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-height: 2.4rem;
    padding: 0.2rem 0.45rem 0.2rem 0.3rem;
    border-radius: 999px;
    border: 1px solid var(--bih-color-line-strong);
    background: var(--bih-color-input-bg);
    color: var(--bih-color-body);
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .bih-mark:hover {
    background: var(--bih-color-chip-bg);
  }

  .bih-logo {
    display: block;
    height: 1.7rem;
    width: auto;
    object-fit: contain;
  }

  .bih-mark-link {
    color: inherit;
    text-decoration: none;
    padding-right: 0.1rem;
    text-transform: none;
  }

  .bih-mark-static {
    cursor: default;
  }

  .bih-mark-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.14em;
  }

  .bih-mark-static:hover {
    text-decoration: none;
  }

  .bih-mark-disabled,
  .bih-mark-issuer {
    padding-right: 0.1rem;
    text-transform: none;
  }

  .bih-mark-disabled {
    cursor: not-allowed;
    opacity: 0.64;
  }

  .topbar-right {
    justify-content: flex-end;
    align-self: start;
    padding-top: 2px;
  }

  .topbar-right > * {
    flex: 0 0 auto;
  }

  @media (max-width: 800px) {
    .topbar {
      margin: 0 -12px;
    }
  }
`;
