import type { LanguageInfo } from './language.js';
import type { DirectoryInfo } from './structure.js';

export interface TeamSuggestion {
  name: string;
  slug: string;
  domain: string;
  codebasePaths: string[];
  rationale: string;
}

/** Known frontend/backend split patterns. */
const FRONTEND_DIRS = new Set(['frontend', 'client', 'web', 'app', 'ui', 'pages', 'components']);
const BACKEND_DIRS = new Set(['backend', 'server', 'api', 'services']);
const INFRA_DIRS = new Set(['deploy', 'infrastructure', 'terraform', 'k8s', 'docker', 'ci']);
const DATA_DIRS = new Set(['db', 'database', 'migrations', 'seeds', 'models', 'schemas']);

/** Suggest teams based on codebase analysis. */
export function suggestTeams(
  languages: LanguageInfo[],
  structure: DirectoryInfo[],
  frameworks: string[],
): TeamSuggestion[] {
  const topLevelDirs = structure
    .filter(d => !d.path.includes('/') && !d.path.includes('\\'))
    .map(d => d.path.toLowerCase());

  const teams: TeamSuggestion[] = [];

  // Check for frontend/backend split
  const hasFrontend = topLevelDirs.some(d => FRONTEND_DIRS.has(d));
  const hasBackend = topLevelDirs.some(d => BACKEND_DIRS.has(d));

  if (hasFrontend && hasBackend) {
    const frontendPaths = structure
      .filter(d => {
        const top = d.path.split(/[/\\]/)[0].toLowerCase();
        return FRONTEND_DIRS.has(top);
      })
      .map(d => d.path);

    const backendPaths = structure
      .filter(d => {
        const top = d.path.split(/[/\\]/)[0].toLowerCase();
        return BACKEND_DIRS.has(top);
      })
      .map(d => d.path);

    teams.push({
      name: 'Frontend',
      slug: 'frontend',
      domain: 'User interface and client-side logic',
      codebasePaths: frontendPaths.length > 0 ? frontendPaths : ['frontend/', 'client/'],
      rationale: 'Detected separate frontend directory with client-side code',
    });

    teams.push({
      name: 'Backend',
      slug: 'backend',
      domain: 'Server-side logic and API',
      codebasePaths: backendPaths.length > 0 ? backendPaths : ['backend/', 'server/'],
      rationale: 'Detected separate backend directory with server-side code',
    });
  }

  // Check for monorepo packages
  const packagesDir = structure.find(d =>
    d.path.toLowerCase() === 'packages' || d.path.toLowerCase() === 'apps'
  );
  if (packagesDir) {
    const subPackages = structure.filter(d => {
      const parts = d.path.split(/[/\\]/);
      return parts.length === 2 && parts[0].toLowerCase() === packagesDir.path.toLowerCase();
    });

    for (const pkg of subPackages) {
      const pkgName = pkg.path.split(/[/\\]/)[1];
      teams.push({
        name: capitalize(pkgName),
        slug: slugify(pkgName),
        domain: pkg.purpose !== 'project directory' ? pkg.purpose : `${pkgName} package`,
        codebasePaths: [pkg.path],
        rationale: `Monorepo package detected at ${pkg.path}`,
      });
    }
  }

  // Check for infra
  const hasInfra = topLevelDirs.some(d => INFRA_DIRS.has(d));
  if (hasInfra) {
    const infraPaths = structure
      .filter(d => INFRA_DIRS.has(d.path.split(/[/\\]/)[0].toLowerCase()))
      .map(d => d.path);

    teams.push({
      name: 'Platform',
      slug: 'platform',
      domain: 'Infrastructure, deployment, and CI/CD',
      codebasePaths: infraPaths,
      rationale: 'Detected infrastructure/deployment directories',
    });
  }

  // Check for data layer
  const hasData = topLevelDirs.some(d => DATA_DIRS.has(d));
  if (hasData && teams.length > 0) {
    const dataPaths = structure
      .filter(d => DATA_DIRS.has(d.path.split(/[/\\]/)[0].toLowerCase()))
      .map(d => d.path);

    teams.push({
      name: 'Data',
      slug: 'data',
      domain: 'Database, migrations, and data models',
      codebasePaths: dataPaths,
      rationale: 'Detected database/data directories',
    });
  }

  // If no clear split was detected, suggest a single team
  if (teams.length === 0) {
    const primaryLang = languages.length > 0 ? languages[0].language : 'General';
    const frameworkHint = frameworks.length > 0 ? ` (${frameworks.slice(0, 3).join(', ')})` : '';
    const allPaths = structure
      .filter(d => !d.path.includes('/') && !d.path.includes('\\'))
      .map(d => d.path);

    teams.push({
      name: 'Engineering',
      slug: 'engineering',
      domain: `${primaryLang} development${frameworkHint}`,
      codebasePaths: allPaths.length > 0 ? allPaths : ['src/'],
      rationale: 'Single cohesive codebase — one team recommended',
    });
  }

  return teams;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
