# BIH App Development Notes

## Scope
- This document records implementation-facing decisions for `bih-app`.
- It complements `DESIGN.md`, which is reserved for visual and interaction guidance.

## Runtime Split
- `npm run dev` is the editing environment.
- `npm run build` and `npm run preview` represent the static viewer deployment shape.
- Dev-only file writes are provided through the Vite plugin in [dev/local-save-plugin.ts](/Users/user/local/bibcli.local/repos/bih-app/dev/local-save-plugin.ts), wired from [vite.config.ts](/Users/user/local/bibcli.local/repos/bih-app/vite.config.ts).
- `npm run sync-collection` is the authoring-time normalization step and currently depends on local Node dependencies, including `citation-js`.
- TypeScript scripts are run with `tsx`; `tsc --noEmit` remains a separate validation step.

## Directory Roles
- `src/ui/` holds browser-facing Lit components and style modules.
- `src/lib/` holds browser-safe application logic shared by UI components, such as property formatting, citation meta generation, RDF export helpers, and link inference.
- `lib/` holds authoring-time and build-time Node logic. This is where collection normalization and static artifact generation live.
- `scripts/` holds thin CLI entrypoints that call code in `lib/`. These are intentionally small wrappers around reusable Node modules.
- `dev/` holds dev-server-only behavior that should not be part of the static viewer runtime, such as local file write-back endpoints for editor mode.

## Placement Rules
- If code must run in the browser bundle, it belongs in `src/`.
- If code requires Node APIs such as filesystem access, child processes, or path resolution, it belongs in `lib/` or `dev/`, not `src/`.
- If code is reusable Node logic, prefer `lib/`; if it is only a command launcher, prefer `scripts/`.
- If code exists only to extend `vite dev` with local editing capabilities, prefer `dev/` rather than growing `vite.config.ts`.
- JSON files under `src/lib/` are treated as browser-bundled configuration, not as authoring-time data sources.

## Sources Of Truth
- Issuer metadata lives in `public/info.json`.
- Issuer-level collections index lives in `public/index.json`.
- Collection metadata lives in `public/{collection}/info.json`.
- Entry data lives in `public/{collection}/*.json`.
- Normalized CSL-JSON lives in `public/{collection}/*.csl.json` and `public/{collection}/all.csl.json`.
- Collection-level item index lives in `public/{collection}/index.json`.
- Property semantics live in the external `bih-top` ontology repository.
- UI-facing property metadata lives in `src/lib/property-catalog.json`.

## Ontology And Catalog
- The ontology is the semantic source for BIH classes and properties.
- The property catalog is the UI-facing intermediary for concerns such as:
  - display labels
  - ordering
  - filtering
  - whether a property counts as an identifier in the editor
  - whether a property is eligible as a primary identifier candidate
- The intended workflow is `ontology -> property catalog JSON -> app UI`.
- The app should prefer the catalog for runtime UI behavior rather than parsing Turtle in the browser.
- If the catalog is edited manually for a while, it should still be treated as a derived UI layer rather than the long-term semantic source.

## BibTeX Normalization
- Public `.bib` files are kept close to the source and remain a distribution format.
- App-native JSON should be treated as a normalized derivative, not as a direct BibTeX parse.
- `sync-collection` uses `citation-js` to derive CSL-JSON from BibTeX/BibLaTeX during local authoring.
- The static viewer and GitHub Pages deploy do not invoke `sync-collection`; they consume already-generated files under `public/`.

## Primary Identifier Handling
- `primary_id_property` is chosen at the hub-entry level.
- `primary_id_value` is treated as a cached derived value.
- In the editor, `bih:hasBihId` is always a candidate.
- Other primary identifier candidates are limited to identifier properties that actually appear in `links`.
- When links or `primary_id_property` change, `primary_id_value` should be recomputed.

## Save Model
- Collection `info.json` is saved as a whole document.
- Collection item `index.json` is saved as a whole document.
- Individual entry JSON files are saved independently.
- This app assumes local, mostly single-user editing, so whole-document saves are acceptable for now.

## Forking And Reuse
- A fork will likely want to change:
  - namespace and URI policy
  - BIH-like local identifier conventions
  - property labels and language coverage
  - issuer copy in `public/info.json`
  - collection copy in `public/{collection}/info.json`
  - theme variables in `src/ui/styles/base-styles.ts`
- If a fork changes identifiers or namespaces, it should review:
  - the external `bih-top` ontology repository
  - `src/lib/property-catalog.json`
  - `src/lib/rdf.ts`
  - entry JSON files under `public/{collection}/`

## Current Architectural Shape
- `src/ui/bih-app.ts` acts as the controller/root state holder.
- `src/ui/bih-app-shell.ts` renders top bar and sidebar.
- `src/ui/bih-app-detail.ts` renders the selected entry detail.
- `src/ui/bih-issuer.ts` acts as the issuer-level editor/viewer.
- `src/ui/styles/*.ts` are split into `base`, `shell`, `detail`, and `topbar`.
- `lib/sync-bib-collection.ts` coordinates collection synchronization.
- `lib/dataset-build.ts` builds normalized entry/index outputs from BibTeX, CSL JSON, and hub metadata.
- `dev/local-save-plugin.ts` contains the dev-only persistence surface used by editor mode.

## Near-Term Direction
- Keep JSON flat enough to edit comfortably.
- Keep ontology more structured than the JSON if that helps downstream RDF/OWL use.
- Prefer small helper functions over adding a full client-side store until state pressure actually appears.
