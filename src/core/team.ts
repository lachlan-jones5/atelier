import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml } from '../util/yaml.js';
import { getTeamsDir, getTeamDir } from '../util/paths.js';

export interface Team {
  name: string;
  slug: string;
  domain: string;
  techStack: string[];
  codebasePaths: string[];
  personas: string[]; // persona slugs
}

export class TeamManager {
  private teams: Map<string, Team> = new Map();

  /** Load all teams from teams/{slug}/team.yaml within the atelier directory. */
  async loadAll(atelierDir: string): Promise<void> {
    this.teams.clear();
    const teamsDir = getTeamsDir(atelierDir);

    let entries: string[];
    try {
      const dirents = await readdir(teamsDir, { withFileTypes: true });
      entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      throw new Error(`TeamManager: teams directory not found at ${teamsDir}`);
    }

    for (const slug of entries) {
      const teamFile = join(getTeamDir(atelierDir, slug), 'team.yaml');
      try {
        const team = await readYaml<Team>(teamFile);
        team.slug = slug; // Ensure slug matches directory name
        this.teams.set(slug, team);
      } catch {
        throw new Error(`TeamManager: failed to load team at ${teamFile}`);
      }
    }
  }

  /** Get a team by slug. Returns undefined if not found. */
  getTeam(slug: string): Team | undefined {
    return this.teams.get(slug);
  }

  /** Find the team that owns a given file path via codebasePaths prefix matching. */
  getTeamForPath(filePath: string): Team | undefined {
    for (const team of this.teams.values()) {
      for (const basePath of team.codebasePaths) {
        if (filePath.startsWith(basePath)) {
          return team;
        }
      }
    }
    return undefined;
  }

  /** List all loaded teams. */
  listTeams(): Team[] {
    return Array.from(this.teams.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Filter to teams the user belongs to by slug. */
  getUserTeams(userTeams: string[]): Team[] {
    const slugSet = new Set(userTeams);
    return this.listTeams().filter((t) => slugSet.has(t.slug));
  }
}
