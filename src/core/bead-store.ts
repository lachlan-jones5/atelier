import { readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Bead, BeadCreate } from './bead.js';
import { BeadStatus, BeadPriority } from '../util/types.js';
import { readYaml, writeYaml } from '../util/yaml.js';
import { getBeadsDir, getCrossTeamBeadsDir, getTeamsDir } from '../util/paths.js';
import { generateBeadId } from '../util/id.js';

export interface BeadFilter {
  team?: string;
  status?: string;
  assigned_to?: string;
  type?: string;
  skill_target?: string;
}

const PRIORITY_ORDER: Record<BeadPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class BeadStore {
  private beads: Map<string, Bead> = new Map();
  private atelierDir: string;
  private dirty: Set<string> = new Set();

  constructor(atelierDir: string) {
    this.atelierDir = atelierDir;
  }

  /**
   * Load beads from all teams/<team>/beads/*.yaml AND cross-team beads.
   * Computes blocked_by for every bead after loading.
   */
  async loadAll(): Promise<void> {
    this.beads.clear();
    this.dirty.clear();

    // Load team beads
    const teamsDir = getTeamsDir(this.atelierDir);
    const teamSlugs = await readdirSafe(teamsDir);
    for (const teamSlug of teamSlugs) {
      const beadsDir = getBeadsDir(this.atelierDir, teamSlug);
      await this.loadBeadsFromDir(beadsDir);
    }

    // Load cross-team beads
    const crossTeamDir = getCrossTeamBeadsDir(this.atelierDir);
    await this.loadBeadsFromDir(crossTeamDir);

    // Compute blocked_by for all beads after the full graph is loaded
    for (const bead of this.beads.values()) {
      bead.blocked_by = this.computeBlockedBy(bead);
    }
  }

  getById(id: string): Bead | undefined {
    return this.beads.get(id);
  }

  /**
   * Filter beads by team, status, assigned_to, type, or skill_target.
   * Results are sorted by priority (critical first).
   */
  list(filter?: BeadFilter): Bead[] {
    let result = Array.from(this.beads.values());

    if (filter) {
      if (filter.team != null) {
        result = result.filter((b) => b.team === filter.team);
      }
      if (filter.status != null) {
        result = result.filter((b) => b.status === filter.status);
      }
      if (filter.assigned_to != null) {
        result = result.filter((b) => b.assigned_to === filter.assigned_to);
      }
      if (filter.type != null) {
        result = result.filter((b) => b.type === filter.type);
      }
      if (filter.skill_target != null) {
        result = result.filter((b) =>
          b.skill_targets.includes(filter.skill_target as any),
        );
      }
    }

    return result.sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }

  getByTeam(teamSlug: string): Bead[] {
    return this.list({ team: teamSlug });
  }

  /** Return beads where team === 'cross-team'. */
  getCrossTeam(): Bead[] {
    return this.list({ team: 'cross-team' });
  }

  /** Return beads assigned to 'user' or unassigned and open. */
  getForUser(): Bead[] {
    return this.list().filter(
      (b) =>
        b.assigned_to === 'user' ||
        (b.assigned_to == null && b.status === 'open'),
    );
  }

  /** Return beads with status 'open' and no blockers. */
  getReady(): Bead[] {
    return this.list({ status: 'open' }).filter(
      (b) => b.blocked_by.length === 0,
    );
  }

  /** Return beads that have at least one unresolved blocker. */
  getBlocked(): Bead[] {
    return this.list().filter((b) => b.blocked_by.length > 0);
  }

  /**
   * Claim a bead for the user. Throws if already claimed or not open.
   */
  async claim(beadId: string): Promise<Bead> {
    const bead = this.requireBead(beadId);

    if (bead.status === 'claimed' || bead.status === 'in_progress') {
      throw new Error(
        `Bead ${beadId} is already claimed by ${bead.assigned_to}`,
      );
    }
    if (bead.status !== 'open') {
      throw new Error(
        `Cannot claim bead ${beadId} with status '${bead.status}'`,
      );
    }

    bead.assigned_to = 'user';
    bead.status = 'claimed';
    this.markDirty(beadId);
    await this.save();
    return bead;
  }

  /** Update a bead's status. Sets completed_at when transitioning to 'done'. */
  async updateStatus(beadId: string, status: BeadStatus): Promise<Bead> {
    const bead = this.requireBead(beadId);

    bead.status = status;
    if (status === 'done') {
      bead.completed_at = new Date().toISOString();
    }

    this.markDirty(beadId);

    // Recompute blocked_by for all beads that depend on this one
    if (status === 'done') {
      this.recomputeDependents(beadId);
    }

    await this.save();
    return bead;
  }

  /** Create a new bead, compute its blocked_by, persist, and return it. */
  async create(input: BeadCreate): Promise<Bead> {
    let id = generateBeadId();
    while (this.beads.has(id)) {
      id = generateBeadId();
    }
    const now = new Date().toISOString();

    const bead: Bead = {
      ...input,
      id,
      created_at: now,
      completed_at: null,
      blocked_by: [],
    };

    // Check for cycles before inserting into the graph.
    // Temporarily add the bead so wouldCreateCycle can traverse through it.
    this.beads.set(id, bead);
    for (const depId of bead.depends_on) {
      if (this.wouldCreateCycle(id, depId)) {
        this.beads.delete(id);
        throw new Error(
          `Creating bead ${id} with dependency on ${depId} would create a cycle`,
        );
      }
    }

    bead.blocked_by = this.computeBlockedBy(bead);
    this.markDirty(id);
    await this.save();
    return bead;
  }

  /**
   * Add a dependency: childId depends on parentId.
   * Throws if the dependency would create a cycle in the graph.
   */
  async addDependency(childId: string, parentId: string): Promise<Bead> {
    const child = this.requireBead(childId);
    this.requireBead(parentId);

    if (child.depends_on.includes(parentId)) {
      return child; // already exists
    }

    if (this.wouldCreateCycle(childId, parentId)) {
      throw new Error(
        `Adding dependency ${childId} -> ${parentId} would create a cycle`,
      );
    }

    child.depends_on.push(parentId);
    child.blocked_by = this.computeBlockedBy(child);
    this.markDirty(childId);
    await this.save();
    return child;
  }

  /**
   * Return the transitive chain of unresolved blockers for a bead.
   * Walks depends_on recursively, collecting any dependency not yet 'done'.
   */
  getBlockedBy(beadId: string): string[] {
    const visited = new Set<string>();
    const blockers: string[] = [];
    this.collectBlockers(beadId, visited, blockers);
    return blockers;
  }

  /** Write all dirty beads back to their YAML files. */
  async save(): Promise<void> {
    const writes: Promise<void>[] = [];

    for (const id of this.dirty) {
      const bead = this.beads.get(id);
      if (!bead) continue;

      const filePath = this.getBeadPath(bead);
      // Strip computed field before persisting
      const { blocked_by: _, ...persistable } = bead;
      writes.push(
        mkdir(join(filePath, '..'), { recursive: true }).then(() =>
          writeYaml(filePath, persistable),
        ),
      );
    }

    await Promise.all(writes);
    this.dirty.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute immediate blockers: any depends_on whose status !== 'done'.
   */
  private computeBlockedBy(bead: Bead): string[] {
    return bead.depends_on.filter((depId) => {
      const dep = this.beads.get(depId);
      return dep != null && dep.status !== 'done';
    });
  }

  /** Recompute blocked_by for every bead that lists beadId in depends_on. */
  private recomputeDependents(beadId: string): void {
    for (const bead of this.beads.values()) {
      if (bead.depends_on.includes(beadId)) {
        bead.blocked_by = this.computeBlockedBy(bead);
      }
    }
  }

  /**
   * Check if adding "childId depends on parentId" would create a cycle.
   * Performs a DFS from parentId following depends_on edges to see if childId is reachable.
   */
  private wouldCreateCycle(childId: string, parentId: string): boolean {
    if (childId === parentId) return true;

    const visited = new Set<string>();
    const stack = [parentId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === childId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const bead = this.beads.get(current);
      if (bead) {
        for (const depId of bead.depends_on) {
          if (!visited.has(depId)) {
            stack.push(depId);
          }
        }
      }
    }

    return false;
  }

  /** Recursively collect transitive unresolved blockers. */
  private collectBlockers(
    beadId: string,
    visited: Set<string>,
    blockers: string[],
  ): void {
    const bead = this.beads.get(beadId);
    if (!bead) return;

    for (const depId of bead.depends_on) {
      if (visited.has(depId)) continue;
      visited.add(depId);

      const dep = this.beads.get(depId);
      if (dep && dep.status !== 'done') {
        blockers.push(depId);
        this.collectBlockers(depId, visited, blockers);
      }
    }
  }

  /** Return the file path for a bead based on its team. */
  private getBeadPath(bead: Bead): string {
    if (bead.team === 'cross-team') {
      return join(getCrossTeamBeadsDir(this.atelierDir), `${bead.id}.yaml`);
    }
    return join(getBeadsDir(this.atelierDir, bead.team), `${bead.id}.yaml`);
  }

  private markDirty(id: string): void {
    this.dirty.add(id);
  }

  private requireBead(id: string): Bead {
    const bead = this.beads.get(id);
    if (!bead) {
      throw new Error(`Bead not found: ${id}`);
    }
    return bead;
  }

  /** Load all .yaml files from a directory into the beads map. */
  private async loadBeadsFromDir(dir: string): Promise<void> {
    const entries = await readdirSafe(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.yaml')) continue;
      const filePath = join(dir, entry);
      try {
        const bead = await readYaml<Bead>(filePath);
        // Initialise computed field so it's always present
        bead.blocked_by = [];
        this.beads.set(bead.id, bead);
      } catch {
        // Skip malformed files
      }
    }
  }
}

/**
 * Safely read a directory, returning an empty array if it doesn't exist.
 */
async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
