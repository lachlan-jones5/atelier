import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface DirectoryInfo {
  path: string;
  purpose: string;
  fileCount: number;
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.next', '.nuxt', '.output', 'target', 'vendor', '.venv',
  'venv', 'env', '.env', '.tox', 'coverage', '.cache',
  '.atelier',
]);

/** Infer the purpose of a directory from its name. */
function inferPurpose(dirName: string, parentName: string): string {
  const name = dirName.toLowerCase();

  const purposeMap: Record<string, string> = {
    'src': 'source code',
    'lib': 'library code',
    'test': 'tests',
    'tests': 'tests',
    '__tests__': 'tests',
    'spec': 'test specifications',
    'specs': 'test specifications',
    'e2e': 'end-to-end tests',
    'integration': 'integration tests',
    'unit': 'unit tests',
    'fixtures': 'test fixtures',
    'docs': 'documentation',
    'doc': 'documentation',
    'scripts': 'build/utility scripts',
    'bin': 'executables/CLI entry points',
    'cmd': 'CLI commands',
    'config': 'configuration',
    'configs': 'configuration',
    'public': 'static public assets',
    'static': 'static assets',
    'assets': 'assets (images, fonts, etc.)',
    'images': 'image assets',
    'styles': 'stylesheets',
    'css': 'stylesheets',
    'components': 'UI components',
    'pages': 'page components/routes',
    'routes': 'route definitions',
    'api': 'API layer',
    'services': 'service layer',
    'models': 'data models',
    'schemas': 'data schemas',
    'types': 'type definitions',
    'utils': 'utility functions',
    'util': 'utility functions',
    'helpers': 'helper functions',
    'hooks': 'React hooks / lifecycle hooks',
    'middleware': 'middleware',
    'controllers': 'request controllers',
    'handlers': 'request/event handlers',
    'views': 'view templates',
    'templates': 'templates',
    'migrations': 'database migrations',
    'seeds': 'database seeds',
    'db': 'database layer',
    'database': 'database layer',
    'store': 'state management',
    'stores': 'state management',
    'redux': 'Redux state management',
    'actions': 'action definitions',
    'reducers': 'state reducers',
    'selectors': 'state selectors',
    'context': 'React context providers',
    'providers': 'dependency/context providers',
    'plugins': 'plugins',
    'extensions': 'extensions',
    'core': 'core/shared logic',
    'common': 'shared/common code',
    'shared': 'shared code',
    'internal': 'internal implementation',
    'pkg': 'packages',
    'packages': 'monorepo packages',
    'apps': 'monorepo applications',
    'modules': 'feature modules',
    'features': 'feature modules',
    'domain': 'domain logic',
    'entities': 'domain entities',
    'repositories': 'data repositories',
    'infrastructure': 'infrastructure/platform code',
    'deploy': 'deployment configuration',
    'ci': 'CI/CD configuration',
    'docker': 'Docker configuration',
    'k8s': 'Kubernetes configuration',
    'terraform': 'Terraform infrastructure',
    'proto': 'Protocol Buffer definitions',
    'generated': 'auto-generated code',
    'vendor': 'vendored dependencies',
    'third_party': 'third-party code',
    'tools': 'development tools',
    'examples': 'example code',
    'demo': 'demo/example code',
    'benchmark': 'benchmarks',
    'benchmarks': 'benchmarks',
    'perf': 'performance tests',
    'i18n': 'internationalization',
    'l10n': 'localization',
    'locales': 'locale files',
    'frontend': 'frontend application',
    'backend': 'backend application',
    'server': 'server-side code',
    'client': 'client-side code',
    'web': 'web application',
    'mobile': 'mobile application',
    'desktop': 'desktop application',
    'cli': 'CLI implementation',
    'compiler': 'compiler implementation',
    'runtime': 'runtime implementation',
    'parser': 'parser implementation',
    'lexer': 'lexer implementation',
    'codegen': 'code generation',
    'analysis': 'code analysis',
    'simulation': 'simulation logic',
    'generation': 'generation logic',
    'review': 'code review',
    'memory': 'memory/state management',
    'skills': 'skill definitions',
    'archetypes': 'archetype definitions',
    'curriculum': 'curriculum/learning paths',
    'incidents': 'incident management',
  };

  if (purposeMap[name]) return purposeMap[name];

  // Check if parent provides context
  if (parentName === 'src' || parentName === 'lib') {
    return `${name} module`;
  }

  return 'project directory';
}

/** Count files recursively in a directory, skipping ignored subdirs. */
async function countFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;

      if (entry.isDirectory()) {
        count += await countFiles(join(dir, entry.name));
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch {
    // permission denied or similar
  }
  return count;
}

/** Map the directory structure of a project, listing significant directories with inferred purposes. */
export async function mapStructure(projectRoot: string): Promise<DirectoryInfo[]> {
  const results: DirectoryInfo[] = [];

  async function walk(dir: string, depth: number, parentName: string): Promise<void> {
    if (depth > 3) return; // don't go too deep

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name));

    for (const entry of dirs) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(projectRoot, fullPath);
      const fileCount = await countFiles(fullPath);

      if (fileCount === 0) continue; // skip empty directories

      results.push({
        path: relPath,
        purpose: inferPurpose(entry.name, parentName),
        fileCount,
      });

      await walk(fullPath, depth + 1, entry.name);
    }
  }

  await walk(projectRoot, 0, '');
  return results.sort((a, b) => b.fileCount - a.fileCount);
}
