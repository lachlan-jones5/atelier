import { getMemoryDir } from '../util/paths.js';
import { MemoryFileStore } from './store.js';
import type { MemoryEntry, RecallOptions } from './types.js';

export type { MemoryEntry, RecallOptions } from './types.js';
export { MemoryFileStore } from './store.js';

/**
 * High-level memory manager that routes operations to the correct
 * team-scoped MemoryFileStore.
 */
export class MemoryManager {
  private stores: Map<string, MemoryFileStore> = new Map();

  constructor(private atelierDir: string) {}

  /**
   * Get (or lazily create) the MemoryFileStore for a given team.
   */
  private getStore(teamSlug: string): MemoryFileStore {
    let store = this.stores.get(teamSlug);
    if (!store) {
      const dir = getMemoryDir(this.atelierDir, teamSlug);
      store = new MemoryFileStore(dir);
      this.stores.set(teamSlug, store);
    }
    return store;
  }

  /**
   * Recall memories for a persona within a team.
   */
  async recall(
    personaSlug: string,
    teamSlug: string,
    opts?: RecallOptions,
  ): Promise<MemoryEntry[]> {
    return this.getStore(teamSlug).read(personaSlug, opts);
  }

  /**
   * Store a new memory entry for a persona within a team.
   * Timestamp is auto-set if omitted.
   */
  async store(
    personaSlug: string,
    teamSlug: string,
    entry: Omit<MemoryEntry, 'ts'>,
  ): Promise<void> {
    const full: MemoryEntry = {
      ...entry,
      ts: new Date().toISOString(),
    };
    await this.getStore(teamSlug).append(personaSlug, full);
  }

  /**
   * Keyword search across a persona's memories in a team.
   */
  async search(
    personaSlug: string,
    teamSlug: string,
    query: string,
  ): Promise<MemoryEntry[]> {
    return this.getStore(teamSlug).search(personaSlug, query);
  }

  /**
   * Get the N most recent memory entries for context injection.
   */
  async getRecentContext(
    personaSlug: string,
    teamSlug: string,
    limit?: number,
  ): Promise<MemoryEntry[]> {
    return this.getStore(teamSlug).getRecent(personaSlug, limit);
  }
}
