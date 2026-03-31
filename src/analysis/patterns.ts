import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.next', '.nuxt', '.output', 'target', 'vendor', '.venv',
]);

/** Detect architectural and code patterns in the project. */
export async function detectPatterns(projectRoot: string): Promise<string[]> {
  const patterns: string[] = [];

  const topDirs = await getTopLevelDirs(projectRoot);
  const topDirNames = topDirs.map(d => d.toLowerCase());

  // MVC pattern
  const mvcDirs = ['models', 'views', 'controllers'];
  if (mvcDirs.every(d => topDirNames.includes(d)) ||
      await hasNestedDirs(projectRoot, 'src', mvcDirs)) {
    patterns.push('MVC (Model-View-Controller) architecture');
  }

  // MVVM pattern
  if (topDirNames.includes('viewmodels') || topDirNames.includes('view-models')) {
    patterns.push('MVVM (Model-View-ViewModel) architecture');
  }

  // Microservices pattern
  const serviceIndicators = topDirNames.filter(d =>
    d.endsWith('-service') || d.endsWith('-svc') || d.startsWith('service-')
  );
  if (serviceIndicators.length >= 2) {
    patterns.push(`Microservices architecture (${serviceIndicators.length} services detected)`);
  }

  // Monorepo pattern
  if (topDirNames.includes('packages') || topDirNames.includes('apps')) {
    patterns.push('Monorepo structure');
    // Check for workspace config
    try {
      const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.workspaces) {
        patterns.push('npm/yarn workspaces');
      }
    } catch {
      // not a JS monorepo
    }
    if (topDirNames.includes('apps') && topDirNames.includes('packages')) {
      patterns.push('Turborepo/Nx-style monorepo (apps + packages)');
    }
  }

  // Event-driven / message queue patterns
  const eventDirs = ['events', 'listeners', 'handlers', 'subscribers', 'queues', 'jobs'];
  const eventChecks = await Promise.all(
    eventDirs.map(async d => topDirNames.includes(d) || await hasNestedDir(projectRoot, 'src', d))
  );
  const foundEventDirs = eventDirs.filter((_, i) => eventChecks[i]);
  if (foundEventDirs.length >= 2) {
    patterns.push('Event-driven architecture');
  }

  // Hexagonal / Clean architecture
  const hexDirs = ['domain', 'infrastructure', 'application', 'ports', 'adapters'];
  const foundHexDirs = hexDirs.filter(d => topDirNames.includes(d));
  if (foundHexDirs.length >= 3) {
    patterns.push('Hexagonal/Clean architecture');
  }

  // DDD patterns
  const dddDirs = ['domain', 'entities', 'repositories', 'aggregates', 'value-objects'];
  const foundDddDirs = dddDirs.filter(d => topDirNames.includes(d));
  if (foundDddDirs.length >= 2) {
    patterns.push('Domain-Driven Design patterns');
  }

  // Plugin/extension architecture
  if (topDirNames.includes('plugins') || topDirNames.includes('extensions') || topDirNames.includes('addons')) {
    patterns.push('Plugin/extension architecture');
  }

  // REST API
  if (topDirNames.includes('routes') || topDirNames.includes('api') || topDirNames.includes('endpoints')) {
    patterns.push('REST API structure');
  }

  // GraphQL
  if (topDirNames.includes('graphql') || topDirNames.includes('resolvers') || topDirNames.includes('schema')) {
    patterns.push('GraphQL API structure');
  }

  // Feature-based organization
  if (topDirNames.includes('features') || topDirNames.includes('modules')) {
    patterns.push('Feature-based module organization');
  }

  // Layered architecture
  const layers = ['presentation', 'business', 'data', 'persistence'];
  const foundLayers = layers.filter(d => topDirNames.includes(d));
  if (foundLayers.length >= 2) {
    patterns.push('Layered architecture');
  }

  // Check for Docker
  try {
    await readFile(join(projectRoot, 'Dockerfile'), 'utf-8');
    patterns.push('Containerized (Dockerfile present)');
  } catch {
    try {
      await readFile(join(projectRoot, 'docker-compose.yml'), 'utf-8');
      patterns.push('Docker Compose multi-container setup');
    } catch {
      try {
        await readFile(join(projectRoot, 'docker-compose.yaml'), 'utf-8');
        patterns.push('Docker Compose multi-container setup');
      } catch {
        // no docker
      }
    }
  }

  // Check for CI/CD
  const ciFiles = ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci'];
  for (const ciFile of ciFiles) {
    try {
      await readFile(join(projectRoot, ciFile), 'utf-8');
      patterns.push('CI/CD pipeline configured');
      break;
    } catch {
      try {
        await readdir(join(projectRoot, ciFile));
        patterns.push('CI/CD pipeline configured');
        break;
      } catch {
        // not this one
      }
    }
  }

  return patterns;
}

/** Get top-level directory names. */
async function getTopLevelDirs(projectRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(projectRoot, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .map(e => e.name);
  } catch {
    return [];
  }
}

/** Check if a nested path contains specific subdirectories. */
async function hasNestedDirs(projectRoot: string, parent: string, dirs: string[]): Promise<boolean> {
  try {
    const entries = await readdir(join(projectRoot, parent), { withFileTypes: true });
    const names = entries.filter(e => e.isDirectory()).map(e => e.name.toLowerCase());
    return dirs.every(d => names.includes(d));
  } catch {
    return false;
  }
}

/** Check if a nested path contains a specific subdirectory. */
async function hasNestedDir(projectRoot: string, parent: string, dir: string): Promise<boolean> {
  try {
    const entries = await readdir(join(projectRoot, parent), { withFileTypes: true });
    return entries.some(e => e.isDirectory() && e.name.toLowerCase() === dir);
  } catch {
    return false;
  }
}
