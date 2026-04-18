import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCitationMetaTags, buildDocumentTitle, escapeHtml } from '../src/lib/citation-meta.ts';
import type { BihEntry, CollectionInfoResponse, EntryIndexResponse, IssuerIndexResponse } from '../src/types.ts';

async function main(): Promise<void> {
  const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
  const distRoot = path.resolve(scriptRoot, '..', 'dist');
  const collectionHtml = await readFile(path.join(distRoot, 'collection.html'), 'utf8');
  const issuerIndex = JSON.parse(await readFile(path.join(distRoot, 'index.json'), 'utf8')) as IssuerIndexResponse;

  await writeFile(path.join(distRoot, '404.html'), collectionHtml, 'utf8');

  for (const collection of issuerIndex.collections) {
    const collectionDir = path.join(distRoot, collection.collection);
    await mkdir(collectionDir, { recursive: true });
    const nestedHtml = rewriteAssetPaths(collectionHtml, '../');
    await writeFile(path.join(collectionDir, 'index.html'), nestedHtml, 'utf8');

    const collectionInfo = JSON.parse(await readFile(path.join(collectionDir, 'info.json'), 'utf8')) as CollectionInfoResponse;
    const collectionIndex = JSON.parse(await readFile(path.join(collectionDir, 'index.json'), 'utf8')) as EntryIndexResponse;
    await Promise.all(
      collectionIndex.entries.map(async (entry) => {
        const itemJson = JSON.parse(await readFile(path.join(collectionDir, `${entry.ulid}.json`), 'utf8')) as BihEntry;
        const itemHtml = injectCitationHead(nestedHtml, itemJson, collectionInfo);
        await writeFile(path.join(collectionDir, `${entry.ulid}.html`), itemHtml, 'utf8');
      }),
    );
  }
}

function rewriteAssetPaths(html: string, assetPrefix: string): string {
  return html.replaceAll('./assets/', `${assetPrefix}assets/`);
}

function injectCitationHead(html: string, entry: BihEntry, collectionInfo: CollectionInfoResponse): string {
  const title = escapeHtml(buildDocumentTitle(entry, collectionInfo));
  const metaTags = buildCitationMetaTags(entry, collectionInfo)
    .map((tag) => `    <meta name="${escapeHtml(tag.name)}" content="${escapeHtml(tag.content)}" data-bih-citation-meta="true" />`)
    .join('\n');

  const withTitle = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
  if (!metaTags) {
    return withTitle;
  }
  return withTitle.replace('</head>', `${metaTags}\n  </head>`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
