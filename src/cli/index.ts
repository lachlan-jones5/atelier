import { resolve } from 'node:path';
import { runInit } from './init.js';
import { runScaffold } from './scaffold.js';

const VERSION = '0.1.0';

const USAGE = `
atelier v${VERSION} — A craftsperson's workshop for software engineers

Usage:
  atelier <command> [options]

Commands:
  init       Initialize Atelier in the current project
  scaffold   Scaffold team structure (not yet implemented)
  help       Show this help message

Examples:
  atelier init
  atelier scaffold
  atelier help
`.trim();

function printUsage(): void {
  console.log(USAGE);
}

function cmdScaffold(): void {
  runScaffold(resolve('.')).catch((err) => {
    console.error('Scaffold failed:', err);
    process.exit(1);
  });
}

export function main(args: string[]): void {
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  switch (command) {
    case 'init':
      runInit(resolve('.')).catch((err) => {
        console.error('Init failed:', err);
        process.exit(1);
      });
      break;
    case 'scaffold':
      cmdScaffold();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "atelier help" for usage information.');
      process.exit(1);
  }
}
