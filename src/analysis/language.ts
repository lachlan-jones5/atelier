import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

export interface LanguageInfo {
  language: string;
  fileCount: number;
  extensions: string[];
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.next', '.nuxt', '.output', 'target', 'vendor', '.venv',
  'venv', 'env', '.env', '.tox', 'coverage', '.cache',
]);

const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.m': 'Objective-C',
  '.mm': 'Objective-C',
  '.lua': 'Lua',
  '.zig': 'Zig',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.ml': 'OCaml',
  '.clj': 'Clojure',
  '.dart': 'Dart',
  '.r': 'R',
  '.R': 'R',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.css': 'CSS',
  '.scss': 'CSS',
  '.sass': 'CSS',
  '.less': 'CSS',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

/** Recursively collect all file paths, skipping ignored directories. */
async function collectFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return; // permission denied or similar
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/** Detect programming languages used in the project by scanning file extensions. */
export async function detectLanguages(projectRoot: string): Promise<LanguageInfo[]> {
  const files = await collectFiles(projectRoot);
  const langMap = new Map<string, Set<string>>();
  const langCount = new Map<string, number>();

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const language = EXT_TO_LANGUAGE[ext];
    if (!language) continue;

    if (!langMap.has(language)) {
      langMap.set(language, new Set());
      langCount.set(language, 0);
    }
    langMap.get(language)!.add(ext);
    langCount.set(language, (langCount.get(language) ?? 0) + 1);
  }

  const results: LanguageInfo[] = [];
  for (const language of Array.from(langMap.keys())) {
    results.push({
      language,
      fileCount: langCount.get(language) ?? 0,
      extensions: Array.from(langMap.get(language)!).sort(),
    });
  }

  return results.sort((a, b) => b.fileCount - a.fileCount);
}

/** Read and parse a JSON file, returning null on failure. */
async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Check if a file exists by attempting to read it. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Detect frameworks used in the project by checking marker files and dependencies. */
export async function detectFrameworks(projectRoot: string): Promise<string[]> {
  const frameworks: string[] = [];

  // Node.js / JavaScript ecosystem
  const pkg = await readJson(join(projectRoot, 'package.json'));
  if (pkg) {
    const allDeps: Record<string, unknown> = {
      ...(pkg.dependencies as Record<string, unknown> ?? {}),
      ...(pkg.devDependencies as Record<string, unknown> ?? {}),
    };
    const depNames = new Set(Object.keys(allDeps));

    const jsFrameworks: [string, string][] = [
      ['next', 'Next.js'],
      ['react', 'React'],
      ['vue', 'Vue'],
      ['nuxt', 'Nuxt'],
      ['@angular/core', 'Angular'],
      ['svelte', 'Svelte'],
      ['express', 'Express'],
      ['fastify', 'Fastify'],
      ['koa', 'Koa'],
      ['hono', 'Hono'],
      ['@nestjs/core', 'NestJS'],
      ['electron', 'Electron'],
      ['tailwindcss', 'Tailwind CSS'],
      ['prisma', 'Prisma'],
      ['drizzle-orm', 'Drizzle'],
      ['typeorm', 'TypeORM'],
      ['sequelize', 'Sequelize'],
      ['graphql', 'GraphQL'],
      ['@trpc/server', 'tRPC'],
      ['socket.io', 'Socket.IO'],
      ['redux', 'Redux'],
      ['zustand', 'Zustand'],
      ['vite', 'Vite'],
      ['webpack', 'webpack'],
      ['esbuild', 'esbuild'],
      ['storybook', 'Storybook'],
      ['@storybook/react', 'Storybook'],
    ];

    for (const [dep, name] of jsFrameworks) {
      if (depNames.has(dep)) {
        frameworks.push(name);
      }
    }
  }

  // Rust
  const cargoToml = await fileExists(join(projectRoot, 'Cargo.toml'));
  if (cargoToml) frameworks.push('Rust/Cargo');

  // Python
  const pyproject = await readJson(join(projectRoot, 'pyproject.toml'));
  const requirementsTxt = await fileExists(join(projectRoot, 'requirements.txt'));
  if (pyproject || requirementsTxt) {
    // Try reading requirements.txt or pyproject.toml for framework hints
    try {
      const reqContent = await readFile(join(projectRoot, 'requirements.txt'), 'utf-8');
      const pyFrameworks: [string, string][] = [
        ['django', 'Django'],
        ['flask', 'Flask'],
        ['fastapi', 'FastAPI'],
        ['pytorch', 'PyTorch'],
        ['torch', 'PyTorch'],
        ['tensorflow', 'TensorFlow'],
        ['numpy', 'NumPy'],
        ['pandas', 'pandas'],
        ['sqlalchemy', 'SQLAlchemy'],
        ['celery', 'Celery'],
        ['scrapy', 'Scrapy'],
      ];
      const lower = reqContent.toLowerCase();
      for (const [marker, name] of pyFrameworks) {
        if (lower.includes(marker)) {
          frameworks.push(name);
        }
      }
    } catch {
      // requirements.txt doesn't exist, that's fine
    }
  }

  // Go
  if (await fileExists(join(projectRoot, 'go.mod'))) {
    frameworks.push('Go');
  }

  // C/C++
  if (await fileExists(join(projectRoot, 'CMakeLists.txt'))) {
    frameworks.push('CMake');
  }

  return Array.from(new Set(frameworks));
}

/** Detect the build system used in the project. */
export async function detectBuildSystem(projectRoot: string): Promise<string | null> {
  // Check in priority order
  if (await fileExists(join(projectRoot, 'bun.lockb')) || await fileExists(join(projectRoot, 'bun.lock'))) {
    return 'bun';
  }
  if (await fileExists(join(projectRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await fileExists(join(projectRoot, 'yarn.lock'))) {
    return 'yarn';
  }
  if (await fileExists(join(projectRoot, 'package-lock.json'))) {
    return 'npm';
  }
  if (await fileExists(join(projectRoot, 'package.json'))) {
    return 'npm'; // fallback if package.json exists but no lockfile
  }
  if (await fileExists(join(projectRoot, 'Cargo.toml'))) {
    return 'cargo';
  }
  if (await fileExists(join(projectRoot, 'go.mod'))) {
    return 'go';
  }
  if (await fileExists(join(projectRoot, 'CMakeLists.txt'))) {
    return 'cmake';
  }
  if (await fileExists(join(projectRoot, 'Makefile'))) {
    return 'make';
  }
  if (await fileExists(join(projectRoot, 'build.gradle')) || await fileExists(join(projectRoot, 'build.gradle.kts'))) {
    return 'gradle';
  }
  if (await fileExists(join(projectRoot, 'pom.xml'))) {
    return 'maven';
  }
  return null;
}

/** Detect the test framework used in the project. */
export async function detectTestFramework(projectRoot: string): Promise<string | null> {
  const pkg = await readJson(join(projectRoot, 'package.json'));
  if (pkg) {
    const allDeps: Record<string, unknown> = {
      ...(pkg.dependencies as Record<string, unknown> ?? {}),
      ...(pkg.devDependencies as Record<string, unknown> ?? {}),
    };
    const depNames = new Set(Object.keys(allDeps));

    if (depNames.has('vitest')) return 'vitest';
    if (depNames.has('jest')) return 'jest';
    if (depNames.has('mocha')) return 'mocha';
    if (depNames.has('ava')) return 'ava';
    if (depNames.has('@playwright/test')) return 'playwright';
    if (depNames.has('cypress')) return 'cypress';

    // Check scripts for test runner hints
    const scripts = pkg.scripts as Record<string, string> | undefined;
    if (scripts?.test) {
      if (scripts.test.includes('vitest')) return 'vitest';
      if (scripts.test.includes('jest')) return 'jest';
      if (scripts.test.includes('mocha')) return 'mocha';
      if (scripts.test.includes('bun test')) return 'bun:test';
    }
  }

  if (await fileExists(join(projectRoot, 'Cargo.toml'))) {
    return 'cargo test';
  }

  if (await fileExists(join(projectRoot, 'pytest.ini')) ||
      await fileExists(join(projectRoot, 'pyproject.toml')) ||
      await fileExists(join(projectRoot, 'setup.cfg'))) {
    // Check for pytest markers
    try {
      const content = await readFile(join(projectRoot, 'pyproject.toml'), 'utf-8');
      if (content.includes('pytest') || content.includes('[tool.pytest')) return 'pytest';
    } catch {
      // ignore
    }
    if (await fileExists(join(projectRoot, 'pytest.ini'))) return 'pytest';
  }

  return null;
}

export { collectFiles, SKIP_DIRS };
