import { join } from 'node:path';

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate that a slug is safe to use in file paths.
 * Allows only alphanumeric characters, hyphens, and underscores.
 * Throws on empty strings, path separators, or '..' sequences.
 */
export function validateSlug(slug: string): string {
  if (!slug) {
    throw new Error('Slug must not be empty');
  }
  if (slug.includes('..')) {
    throw new Error(`Slug contains path traversal sequence '..': ${slug}`);
  }
  if (slug.includes('/') || slug.includes('\\')) {
    throw new Error(`Slug contains path separator: ${slug}`);
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `Slug contains invalid characters (only alphanumeric, hyphens, and underscores allowed): ${slug}`,
    );
  }
  return slug;
}

/** Returns the .atelier directory for a project. */
export function getAtelierDir(projectRoot: string): string {
  return join(projectRoot, '.atelier');
}

/** Returns the teams directory. */
export function getTeamsDir(atelierDir: string): string {
  return join(atelierDir, 'teams');
}

/** Returns the directory for a specific team. */
export function getTeamDir(atelierDir: string, teamSlug: string): string {
  return join(atelierDir, 'teams', validateSlug(teamSlug));
}

/** Returns the beads directory for a team. */
export function getBeadsDir(atelierDir: string, teamSlug: string): string {
  return join(atelierDir, 'teams', validateSlug(teamSlug), 'beads');
}

/** Returns the cross-team beads directory. */
export function getCrossTeamBeadsDir(atelierDir: string): string {
  return join(atelierDir, 'cross-team-beads');
}

/** Returns the memory directory for a team. */
export function getMemoryDir(atelierDir: string, teamSlug: string): string {
  return join(atelierDir, 'teams', validateSlug(teamSlug), 'memory');
}

/** Returns the personas directory for a team. */
export function getPersonasDir(atelierDir: string, teamSlug: string): string {
  return join(atelierDir, 'teams', validateSlug(teamSlug), 'personas');
}

/** Returns the history directory. */
export function getHistoryDir(atelierDir: string): string {
  return join(atelierDir, 'history');
}

/** Returns the Claude Code agents directory. */
export function getAgentsDir(projectRoot: string): string {
  return join(projectRoot, '.claude', 'agents');
}
