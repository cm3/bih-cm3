# bih-app

Static viewer and dev-time editor for small Bibliographic Information Hub collections.

## Documentation
- [README.md](/Users/user/local/bibcli.local/repos/bih-app/README.md): entry point and document map
- [DESIGN.md](/Users/user/local/bibcli.local/repos/bih-app/DESIGN.md): visual and interaction principles
- [DEVELOPMENT.md](/Users/user/local/bibcli.local/repos/bih-app/DEVELOPMENT.md): implementation notes, data flow, ontology/catalog relationship

## Key Files
- `public/info.json`: issuer metadata
- `public/index.json`: issuer-level collections index
- `public/{collection}/info.json`: collection metadata
- `public/{collection}/index.json`: item index for a collection
- `public/{collection}/*.json`: hub entry data
- `public/{collection}/*.csl.json`: per-item CSL-JSON generated at sync time
- `public/{collection}/all.bib`: collection-wide BibTeX export
- `public/{collection}/all.csl.json`: collection-wide CSL-JSON generated at sync time
- `public/{collection}/manifest.json`: collection manifest
- `public/{collection}/notes.md`: collection notes
- `src/lib/property-catalog.json`: UI-facing property labels and filtering metadata
- external `bih-top` repository: `ontology/bih-properties.ttl`

## Runtime
- `npm run dev`: local editor with file write-back through Vite
- `npm run build`: static build for deployment
- `npm run preview`: local preview of the built viewer
- `npm run sync-collection -- --collection ... --source-bib ...`: local sync step that normalizes BibTeX/BibLaTeX through `citation-js`

## Deployment
- This repository is designed to be forked.
- The fork owns the data under `public/` and any issuer-specific customization.
- `npm run dev` and `npm run sync-collection` are authoring-time steps run locally by the fork owner.
- On push to `main`, `.github/workflows/deploy.yml` runs `npm run build` and publishes `dist/` to GitHub Pages.
- The deployed site is a static viewer; it does not run `sync-collection` or the dev save endpoints.
- For a hosted editor that does not require running `npm run dev` (e.g. non-technical contributors), see the separate `bih-hosting` service rather than deploying this app in editor mode.

## Editing Model
- `public/{collection}/all.bib` is the bibliographic source of truth.
- `public/{collection}/hub.json` stores BIH-side hub metadata such as `viewer_category`, `contextual_description`, display identifier overrides, and hub links.
- `public/{collection}/hub-import.json` is the cite-key keyed import/export form for hub metadata.
- BibTeX `note` is treated as non-contextual source metadata and is shown read-only through `record_cache.note`.
- `contextual_description` is a separate BIH-side field for collection-contextual explanation.
- Editing `contextual_description` in the app writes to `hub.json`, not back to BibTeX `note`.

## Dependencies
- `citation-js` is used for BibTeX/BibLaTeX -> CSL-JSON normalization during `sync-collection` and collection creation in dev/admin mode.
- GitHub Pages build/deploy does not run `sync-collection`; generated JSON and CSL-JSON are committed under `public/`.
- TypeScript helper scripts are executed with `tsx`, while `tsc --noEmit` remains the type checker.

## Forking
- If you fork this app for another namespace or collection, start with:
  - the external `bih-top` ontology repository
  - `src/lib/property-catalog.json`
  - `public/info.json`
  - `public/index.json`
  - `src/lib/rdf.ts`
  - `src/ui/styles/base-styles.ts`
