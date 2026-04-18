import { html, type TemplateResult } from 'lit';

export function renderPlusIcon(): TemplateResult {
  return html`<svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.2" />
  </svg>`;
}

export function renderWandIcon(): TemplateResult {
  return html`<svg class="wand-icon" viewBox="0 0 128 128" aria-hidden="true">
    <g class="wand-icon" fill="currentColor">
      <rect x="22" y="80" width="62" height="14" rx="7" transform="rotate(-45 22 80)" />
      <rect x="16" y="90" width="16" height="16" rx="4" transform="rotate(-45 16 90)" opacity="0.75" />
      <path d="M93 15l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" />
      <path d="M73 45l3.5 9.5L86 58l-9.5 3.5L73 71l-3.5-9.5L60 58l9.5-3.5z" opacity="0.95" />
      <path d="M104 55l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" opacity="0.92" />
    </g>
  </svg>`;
}

export function renderTrashIcon(): TemplateResult {
  return html`<svg class="trash-icon" viewBox="17 17 22 24" aria-hidden="true">
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M36 26v10.997c0 1.659-1.337 3.003-3.009 3.003h-9.981c-1.662 0-3.009-1.342-3.009-3.003v-10.997h16zm-2 0v10.998c0 .554-.456 1.002-1.002 1.002h-9.995c-.554 0-1.002-.456-1.002-1.002v-10.998h12zm-9-5c0-.552.451-1 .991-1h4.018c.547 0 .991.444.991 1 0 .552-.451 1-.991 1h-4.018c-.547 0-.991-.444-.991-1zm0 6.997c0-.551.444-.997 1-.997.552 0 1 .453 1 .997v6.006c0 .551-.444.997-1 .997-.552 0-1-.453-1-.997v-6.006zm4 0c0-.551.444-.997 1-.997.552 0 1 .453 1 .997v6.006c0 .551-.444.997-1 .997-.552 0-1-.453-1-.997v-6.006zm-6-5.997h-4.008c-.536 0-.992.448-.992 1 0 .556.444 1 .992 1h18.016c.536 0 .992-.448.992-1 0-.556-.444-1-.992-1h-4.008v-1c0-1.653-1.343-3-3-3h-3.999c-1.652 0-3 1.343-3 3v1z"
    />
  </svg>`;
}
