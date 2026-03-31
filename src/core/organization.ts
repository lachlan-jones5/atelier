import { join } from 'node:path';
import { readYaml, writeYaml } from '../util/yaml.js';

export interface Organization {
  name: string;
  tagline: string;
  mission: string;
  culture: string;
  domain: string;
  teams: string[]; // team slugs
}

export interface OrgStatus {
  name: string;
  teamCount: number;
  totalBeads: number;
  activeIncident: boolean;
}

export class OrganizationManager {
  private org: Organization | null = null;

  /** Load organization definition from org.yaml in the atelier directory. */
  async load(atelierDir: string): Promise<Organization | null> {
    const filePath = join(atelierDir, 'org.yaml');
    try {
      this.org = await readYaml<Organization>(filePath);
      return this.org;
    } catch {
      this.org = null;
      return null;
    }
  }

  /** Save organization definition to org.yaml in the atelier directory. */
  async save(atelierDir: string): Promise<void> {
    if (!this.org) {
      throw new Error('Organization not loaded');
    }
    const filePath = join(atelierDir, 'org.yaml');
    await writeYaml(filePath, this.org);
  }

  /** Get the loaded organization. Throws if not yet loaded. */
  get(): Organization {
    if (!this.org) {
      throw new Error('Organization not loaded');
    }
    return this.org;
  }

  /** Aggregate status across all teams. */
  getStatus(): OrgStatus {
    const org = this.get();
    return {
      name: org.name,
      teamCount: org.teams.length,
      totalBeads: 0, // Populated by caller with actual bead counts
      activeIncident: false, // Populated by caller with incident state
    };
  }
}
