import { html, type TemplateResult } from 'lit';

const LINK_PATTERN = /\[([^[\]]+)\]\(([^()]+)\)/g;

export interface RichTextRenderer {
  resolveInternalTarget: (target: string) => string | null;
  openInternalTarget: (path: string) => void;
}

export function renderRichText(text: string, renderer: RichTextRenderer): TemplateResult {
  const parts: Array<string | TemplateResult> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const fullMatch = match[0];
    const label = match[1];
    const target = match[2].trim();
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    const internalPath = renderer.resolveInternalTarget(target);
    if (internalPath) {
      parts.push(html`
        <a
          href=${internalPath}
          @click=${(event: Event) => {
            event.preventDefault();
            renderer.openInternalTarget(internalPath);
          }}
        >
          ${label}
        </a>
      `);
    } else if (/^https?:\/\//i.test(target)) {
      parts.push(html`<a href=${target} target="_blank" rel="noreferrer">${label}</a>`);
    } else {
      parts.push(fullMatch);
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return html`${parts.flatMap((part, index) => renderTextChunk(part, index))}`;
}

function renderTextChunk(part: string | TemplateResult, index: number): Array<string | TemplateResult> {
  if (typeof part !== 'string') {
    return [part];
  }

  const lines = part.split('\n');
  return lines.flatMap((line, lineIndex) => {
    if (lineIndex === lines.length - 1) {
      return [line];
    }

    return [line, html`<br data-key=${`${index}-${lineIndex}`} />`];
  });
}
