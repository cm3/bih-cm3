import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { isSafeCollectionName, syncBibCollection } from '../lib/sync-bib-collection';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = path.resolve(projectRoot, 'public');
const infoJsonPath = path.resolve(publicRoot, 'info.json');
const indexJsonPath = path.resolve(publicRoot, 'index.json');

function normalizePublicRequestPath(requestPath: string): string {
  if (requestPath.startsWith('./')) {
    return requestPath.slice(1);
  }
  if (requestPath.startsWith('/')) {
    return requestPath;
  }
  return `/${requestPath}`;
}

function resolvePublicPath(requestPath: string): string {
  const normalized = normalizePublicRequestPath(requestPath);
  return path.resolve(publicRoot, `.${normalized}`);
}

function toIssuerIndexPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  return value.replace(/^\.\.\//, './');
}

function isSafeWritableJsonPath(requestPath: string): boolean {
  const resolved = resolvePublicPath(requestPath);
  return resolved.startsWith(publicRoot) && resolved.endsWith('.json');
}

async function readJsonBody<T>(req: NodeJS.ReadableStream): Promise<T> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

interface HubLinkPayload {
  link_id?: unknown;
  property?: unknown;
  label?: unknown;
  description?: unknown;
  url?: unknown;
  target_type?: unknown;
  target_value?: unknown;
  note?: unknown;
}

interface HubEntryPayload {
  viewer_category?: unknown;
  contextual_description?: unknown;
  display_identifier?: unknown;
  links?: unknown;
}

interface HubJsonPayload {
  $schema?: unknown;
  default_viewer_category?: unknown;
  entries?: Record<string, HubEntryPayload>;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function extractCollectionAndUlidFromEntryPath(requestPath: string): { collection: string; ulid: string } | null {
  const normalized = normalizePublicRequestPath(requestPath).replace(/^\//, '');
  const match = normalized.match(/^([a-z][a-z0-9-]{2,39})\/([0-9A-HJKMNP-TV-Z]{26})\.json$/i);
  if (!match) {
    return null;
  }
  return {
    collection: match[1],
    ulid: match[2],
  };
}

async function loadHubJson(collection: string): Promise<HubJsonPayload> {
  const hubPath = path.join(publicRoot, collection, 'hub.json');
  try {
    const content = await readFile(hubPath, 'utf8');
    return JSON.parse(content) as HubJsonPayload;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === 'ENOENT') {
      return {
        $schema: 'https://w3id.org/bih/schema/hub.schema.json',
        default_viewer_category: 'references',
        entries: {},
      };
    }
    throw error;
  }
}

async function writeHubJson(collection: string, hub: HubJsonPayload): Promise<void> {
  const hubPath = path.join(publicRoot, collection, 'hub.json');
  await writeFile(hubPath, `${JSON.stringify(hub, null, 2)}\n`, 'utf8');
}

function buildHubLinks(links: unknown): HubLinkPayload[] | undefined {
  if (!Array.isArray(links)) {
    return undefined;
  }

  const hubLinks = links
    .map((link): HubLinkPayload | null => {
      if (!link || typeof link !== 'object') {
        return null;
      }

      const item = link as Record<string, unknown>;
      const property = normalizeOptionalString(item.property);
      const targetType = normalizeOptionalString(item.target_type);
      const targetValue = normalizeOptionalString(item.target_value);
      if (!property || !targetType || !targetValue) {
        return null;
      }

      const hubLink: HubLinkPayload = {
        link_id: normalizeOptionalString(item.link_id) ?? crypto.randomUUID(),
        property,
        target_type: targetType,
        target_value: targetValue,
      };

      const label = normalizeOptionalString(item.label);
      if (label) {
        hubLink.label = label;
      }

      const description = normalizeOptionalString(item.description);
      if (description) {
        hubLink.description = description;
      }

      const url = normalizeOptionalString(item.url);
      if (url) {
        hubLink.url = url;
      }

      const note = normalizeOptionalString(item.note);
      if (note) {
        hubLink.note = note;
      }

      return hubLink;
    })
    .filter((link): link is HubLinkPayload => link != null);

  return hubLinks.length > 0 ? hubLinks : undefined;
}

async function updateHubEntryFromSavedEntry(entryPath: string, entry: Record<string, unknown>): Promise<void> {
  const entryLocation = extractCollectionAndUlidFromEntryPath(entryPath);
  if (!entryLocation) {
    return;
  }

  const hub = await loadHubJson(entryLocation.collection);
  const entries = hub.entries ?? {};
  const currentEntry = (entries[entryLocation.ulid] ?? {}) as HubEntryPayload;
  const nextEntry: HubEntryPayload = { ...currentEntry };

  const contextualDescription = normalizeOptionalString(entry.contextual_description);
  if (contextualDescription) {
    nextEntry.contextual_description = contextualDescription;
  } else {
    delete nextEntry.contextual_description;
  }

  const hubLinks = buildHubLinks(entry.links);
  if (hubLinks) {
    nextEntry.links = hubLinks;
  } else {
    delete nextEntry.links;
  }

  entries[entryLocation.ulid] = nextEntry;
  hub.entries = entries;
  await writeHubJson(entryLocation.collection, hub);
}

export function localSavePlugin(): Plugin {
  return {
    name: 'local-save',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }
        const url = new URL(req.url ?? '/', 'http://localhost');
        const pathname = url.pathname;
        const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
        if (
          pathname === '/' ||
          pathname === '/index.html' ||
          pathname.startsWith('/__local') ||
          pathname.includes('.') ||
          ['@fs', '@id', '@vite', 'src', 'node_modules', 'assets', 'data', 'schema'].includes(firstSegment)
        ) {
          next();
          return;
        }
        req.url = '/collection.html';
        next();
      });

      server.middlewares.use('/__local/save-index-json', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as {
            path: string;
            index: Record<string, unknown>;
          };
          if (!isSafeWritableJsonPath(body.path)) {
            throw new Error('Index path must be a JSON file under public/.');
          }

          const targetPath = resolvePublicPath(body.path);
          await writeFile(targetPath, `${JSON.stringify(body.index, null, 2)}\n`, 'utf8');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });

      server.middlewares.use('/__local/save-entry', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as {
            path: string;
            entry: Record<string, unknown>;
            index_update?: Record<string, unknown>;
            index_path?: string;
          };

          if (!isSafeWritableJsonPath(body.path)) {
            throw new Error('Entry path must be a JSON file under public/.');
          }

          const entryPath = resolvePublicPath(body.path);
          await writeFile(entryPath, `${JSON.stringify(body.entry, null, 2)}\n`, 'utf8');
          await updateHubEntryFromSavedEntry(body.path, body.entry);

          if (body.index_update && typeof body.entry.hub_id === 'string' && body.index_path) {
            if (!isSafeWritableJsonPath(body.index_path)) {
              throw new Error('Index path must be a JSON file under public/.');
            }
            const currentIndexPath = resolvePublicPath(body.index_path);
            const current = JSON.parse(await readFile(currentIndexPath, 'utf8')) as {
              entries?: Array<Record<string, unknown>>;
            };
            const entries = current.entries ?? [];
            const target = entries.find((item) => item.hub_id === body.entry.hub_id);
            if (target) {
              Object.assign(target, body.index_update);
              await writeFile(currentIndexPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });

      server.middlewares.use('/__local/create-collection', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as {
            collection: string;
            bib_content: string;
          };

          if (!isSafeCollectionName(body.collection)) {
            throw new Error('Collection name must match /^[a-z][a-z0-9-]{2,39}$/');
          }
          if (!body.bib_content.trim()) {
            throw new Error('BibTeX content is empty.');
          }
          const currentIndex = JSON.parse(await readFile(indexJsonPath, 'utf8')) as {
            collections?: Array<{ collection?: string }>;
          };
          if ((currentIndex.collections ?? []).some((item) => item.collection === body.collection)) {
            throw new Error(`Collection already exists: ${body.collection}`);
          }

          await syncBibCollection({
            collection: body.collection,
            bibContent: body.bib_content,
            publicRoot,
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, collection: body.collection }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });

      server.middlewares.use('/__local/delete-collection', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as {
            collection: string;
          };

          if (!isSafeCollectionName(body.collection)) {
            throw new Error('Collection name must match /^[a-z][a-z0-9-]{2,39}$/');
          }

          const currentInfo = JSON.parse(await readFile(infoJsonPath, 'utf8')) as {
            [key: string]: unknown;
          };
          const currentIndex = JSON.parse(await readFile(indexJsonPath, 'utf8')) as {
            collections?: Array<{ collection?: string }>;
          };
          const currentCollections = currentIndex.collections ?? [];
          if (!currentCollections.some((item) => item.collection === body.collection)) {
            throw new Error(`Collection not found: ${body.collection}`);
          }
          delete currentInfo.collections;
          currentInfo.collections_index_url = './index.json';
          await writeFile(infoJsonPath, `${JSON.stringify(currentInfo, null, 2)}\n`, 'utf8');
          currentIndex.collections = currentCollections.filter((item) => item.collection !== body.collection);
          await writeFile(indexJsonPath, `${JSON.stringify(currentIndex, null, 2)}\n`, 'utf8');

          const collectionPaths = [path.join(publicRoot, body.collection)];
          await Promise.all(collectionPaths.map((targetPath) => rm(targetPath, { recursive: true, force: true })));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, collection: body.collection }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });

      server.middlewares.use('/__local/save-issuer-info', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as {
            title: string | null;
            description: string | null;
          };

          const currentInfo = JSON.parse(await readFile(infoJsonPath, 'utf8')) as {
            title?: unknown;
            description?: unknown;
            [key: string]: unknown;
          };

          currentInfo.title = typeof body.title === 'string' ? body.title : null;
          currentInfo.description = typeof body.description === 'string' ? body.description : null;
          await writeFile(infoJsonPath, `${JSON.stringify(currentInfo, null, 2)}\n`, 'utf8');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });

      server.middlewares.use('/__local/save-collection-info', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as {
            collection: string;
            info: Record<string, unknown>;
          };

          if (!isSafeCollectionName(body.collection)) {
            throw new Error('Collection name must match /^[a-z][a-z0-9-]{2,39}$/');
          }

          const collectionInfoPath = path.join(publicRoot, body.collection, 'info.json');
          await mkdir(path.dirname(collectionInfoPath), { recursive: true });
          await writeFile(collectionInfoPath, `${JSON.stringify(body.info, null, 2)}\n`, 'utf8');

          const issuerIndex = JSON.parse(await readFile(indexJsonPath, 'utf8')) as {
            collections?: Array<Record<string, unknown>>;
          };
          issuerIndex.collections = (issuerIndex.collections ?? []).map((collection) =>
            collection.collection === body.collection
              ? {
                  ...collection,
                  title: body.info.title ?? null,
                  description: body.info.description ?? null,
                  manifest_url: toIssuerIndexPath(body.info.manifest_url) ?? collection.manifest_url ?? null,
                  collection_bib_url:
                    toIssuerIndexPath(body.info.collection_bib_url) ?? collection.collection_bib_url ?? null,
                  notes_url: toIssuerIndexPath(body.info.notes_url),
                  index_url: toIssuerIndexPath(body.info.index_url) ?? collection.index_url ?? null,
                  item_base_url: toIssuerIndexPath(body.info.item_base_url) ?? collection.item_base_url ?? null,
                }
              : collection,
          );
          await writeFile(indexJsonPath, `${JSON.stringify(issuerIndex, null, 2)}\n`, 'utf8');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });
    },
  };
}
