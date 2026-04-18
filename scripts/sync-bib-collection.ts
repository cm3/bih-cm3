import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportHubImport, syncBibCollection } from '../lib/sync-bib-collection.ts';

interface CliArgs {
  collection: string;
  sourceBib?: string;
  publicRoot: string;
  notesSource?: string;
  hubImport?: string;
  hubImportMode: 'merge' | 'overwrite';
  exportHubImport?: string;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  let result: unknown;

  if (args.sourceBib) {
    const bibContent = await readFile(path.resolve(args.sourceBib), 'utf8');
    const notesContent = args.notesSource ? await readFile(path.resolve(args.notesSource), 'utf8') : undefined;
    const syncResult = await syncBibCollection({
      collection: args.collection,
      bibContent,
      publicRoot: path.resolve(args.publicRoot),
      notesContent,
      hubImportPath: args.hubImport,
      hubImportMode: args.hubImportMode,
    });
    result = syncResult;

    if (args.exportHubImport) {
      const exportResult = await exportHubImport({
        collection: args.collection,
        publicRoot: path.resolve(args.publicRoot),
        outputPath: args.exportHubImport,
      });
      result = {
        sync: syncResult,
        export: exportResult,
      };
    }
  } else if (args.exportHubImport) {
    result = await exportHubImport({
      collection: args.collection,
      publicRoot: path.resolve(args.publicRoot),
      outputPath: args.exportHubImport,
    });
  } else {
    throw new Error('Either --source-bib or --export-hub-import must be provided.');
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}

function parseArgs(argv: string[]): CliArgs {
  const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
  const defaultPublicRoot = path.resolve(scriptRoot, '..', 'public');
  const args: CliArgs = {
    collection: '',
    publicRoot: defaultPublicRoot,
    hubImportMode: 'merge',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--collection':
        args.collection = requireValue(argv, ++index, '--collection');
        break;
      case '--source-bib':
        args.sourceBib = requireValue(argv, ++index, '--source-bib');
        break;
      case '--hub-import':
        args.hubImport = requireValue(argv, ++index, '--hub-import');
        break;
      case '--hub-import-mode': {
        const value = requireValue(argv, ++index, '--hub-import-mode');
        if (value !== 'merge' && value !== 'overwrite') {
          throw new Error(`Invalid --hub-import-mode: ${value}`);
        }
        args.hubImportMode = value;
        break;
      }
      case '--export-hub-import':
        args.exportHubImport = requireValue(argv, ++index, '--export-hub-import');
        break;
      case '--public-root':
        args.publicRoot = requireValue(argv, ++index, '--public-root');
        break;
      case '--notes-source':
        args.notesSource = requireValue(argv, ++index, '--notes-source');
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.collection) {
    throw new Error('Missing required argument: --collection');
  }
  return args;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function printHelp(): void {
  process.stdout.write(`Usage:
  npm run sync-collection -- --collection COLLECTION --source-bib PATH [options]
  npm run sync-collection -- --collection COLLECTION --export-hub-import PATH [options]

Options:
  --public-root PATH     Output root. Defaults to bih-app/public.
  --notes-source PATH    Optional notes markdown to publish.
  --hub-import PATH      Optional hub-import.json path. Defaults to public/<collection>/hub-import.json if present.
  --hub-import-mode      merge | overwrite. Defaults to merge.
  --export-hub-import    Write cite-key based hub-import.json.
`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
