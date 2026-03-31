import { detectLanguages, detectFrameworks, detectBuildSystem, detectTestFramework, collectFiles } from './language.js';
import { mapStructure } from './structure.js';
import { suggestTeams } from './ownership.js';
import { detectPatterns } from './patterns.js';

import type { LanguageInfo } from './language.js';
import type { DirectoryInfo } from './structure.js';
import type { TeamSuggestion } from './ownership.js';

export interface CodebaseAnalysis {
  languages: LanguageInfo[];
  frameworks: string[];
  structure: DirectoryInfo[];
  entryPoints: string[];
  buildSystem: string | null;
  testFramework: string | null;
  suggestedTeams: TeamSuggestion[];
  fileCount: number;
  loc: number;
}

export type { LanguageInfo, DirectoryInfo, TeamSuggestion };

/** Approximate lines of code by counting newlines in all collected files. */
async function estimateLoc(projectRoot: string): Promise<{ fileCount: number; loc: number }> {
  const { readFile } = await import('node:fs/promises');
  const files = await collectFiles(projectRoot);
  let loc = 0;

  // Sample up to 500 files for LOC estimation to avoid being too slow
  const sampled = files.length > 500
    ? files.filter((_, i) => i % Math.ceil(files.length / 500) === 0)
    : files;

  for (const file of sampled) {
    try {
      const content = await readFile(file, 'utf-8');
      loc += content.split('\n').length;
    } catch {
      // binary file or permission issue, skip
    }
  }

  // Scale up if we sampled
  if (files.length > 500) {
    loc = Math.round(loc * (files.length / sampled.length));
  }

  return { fileCount: files.length, loc };
}

/** Detect common entry point files. */
async function detectEntryPoints(projectRoot: string): Promise<string[]> {
  const { readFile, access } = await import('node:fs/promises');
  const { join } = await import('node:path');

  const candidates = [
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
    'src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js',
    'index.ts', 'index.js', 'main.ts', 'main.js',
    'app.ts', 'app.js', 'server.ts', 'server.js',
    'src/lib.rs', 'src/main.rs',
    'main.go', 'cmd/main.go',
    'app.py', 'main.py', 'manage.py',
    'bin/cli.ts', 'bin/cli.js',
  ];

  const found: string[] = [];

  for (const candidate of candidates) {
    try {
      await access(join(projectRoot, candidate));
      found.push(candidate);
    } catch {
      // doesn't exist
    }
  }

  // Also check package.json main/bin fields
  try {
    const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
    if (pkg.main && !found.includes(pkg.main)) found.push(pkg.main);
    if (pkg.bin) {
      const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin) as string[];
      for (const b of bins) {
        if (!found.includes(b)) found.push(b);
      }
    }
  } catch {
    // no package.json
  }

  return found;
}

/** Analyse a codebase and return a comprehensive analysis. */
export async function analyseCodebase(projectRoot: string): Promise<CodebaseAnalysis> {
  // Run independent analyses in parallel
  const [languages, frameworks, structure, buildSystem, testFramework, entryPoints, patterns, locInfo] =
    await Promise.all([
      detectLanguages(projectRoot).catch((err) => {
        console.warn('Language detection failed:', err);
        return [] as LanguageInfo[];
      }),
      detectFrameworks(projectRoot).catch((err) => {
        console.warn('Framework detection failed:', err);
        return [] as string[];
      }),
      mapStructure(projectRoot).catch((err) => {
        console.warn('Structure mapping failed:', err);
        return [] as DirectoryInfo[];
      }),
      detectBuildSystem(projectRoot).catch((err) => {
        console.warn('Build system detection failed:', err);
        return null;
      }),
      detectTestFramework(projectRoot).catch((err) => {
        console.warn('Test framework detection failed:', err);
        return null;
      }),
      detectEntryPoints(projectRoot).catch((err) => {
        console.warn('Entry point detection failed:', err);
        return [] as string[];
      }),
      detectPatterns(projectRoot).catch((err) => {
        console.warn('Pattern detection failed:', err);
        return [] as string[];
      }),
      estimateLoc(projectRoot).catch((err) => {
        console.warn('LOC estimation failed:', err);
        return { fileCount: 0, loc: 0 };
      }),
    ]);

  // Suggest teams based on collected data
  const suggestedTeams = suggestTeams(languages, structure, frameworks);

  // Append detected patterns to frameworks list for visibility
  const allFrameworks = [...frameworks, ...patterns];

  return {
    languages,
    frameworks: allFrameworks,
    structure,
    entryPoints,
    buildSystem,
    testFramework,
    suggestedTeams,
    fileCount: locInfo.fileCount,
    loc: locInfo.loc,
  };
}

// Re-export sub-module functions for direct use
export { detectLanguages, detectFrameworks, detectBuildSystem, detectTestFramework } from './language.js';
export { mapStructure } from './structure.js';
export { suggestTeams } from './ownership.js';
export { detectPatterns } from './patterns.js';
