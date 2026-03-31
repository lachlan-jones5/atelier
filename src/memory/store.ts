import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { validateSlug } from '../util/paths.js';
import { MemoryEntry } from './types.js';

/**
 * File-backed JSONL memory store.
 *
 * Each persona gets a `<personaSlug>.jsonl` file inside the provided
 * memory directory. Lines are append-only JSON objects.
 */
export class MemoryFileStore {
  constructor(private memoryDir: string) {}

  private filePath(personaSlug: string): string {
    return join(this.memoryDir, `${validateSlug(personaSlug)}.jsonl`);
  }

  /**
   * Read memory entries for a persona, with optional filtering.
   *
   * @param personaSlug  Persona identifier
   * @param opts.limit   Max entries to return (default 20, most recent first)
   * @param opts.tags    If provided, only entries matching at least one tag
   * @param opts.since   If provided, only entries at or after this ISO timestamp
   */
  async read(
    personaSlug: string,
    opts?: { limit?: number; tags?: string[]; since?: string },
  ): Promise<MemoryEntry[]> {
    const limit = opts?.limit ?? 20;
    const raw = await this.readRawLines(personaSlug);

    let entries = raw;

    if (opts?.tags && opts.tags.length > 0) {
      const filterTags = new Set(opts.tags.map((t) => t.toLowerCase()));
      entries = entries.filter((e) =>
        e.tags.some((t) => filterTags.has(t.toLowerCase())),
      );
    }

    if (opts?.since) {
      const sinceDate = new Date(opts.since);
      entries = entries.filter((e) => new Date(e.ts) >= sinceDate);
    }

    // Most recent first, then cap.
    entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return entries.slice(0, limit);
  }

  /**
   * Append a single memory entry to the persona's JSONL file.
   * Creates the file (and parent dirs) if they don't exist.
   * Auto-sets `ts` to now if not already present.
   */
  async append(personaSlug: string, entry: MemoryEntry): Promise<void> {
    const withTs: MemoryEntry = {
      ...entry,
      ts: entry.ts || new Date().toISOString(),
    };

    const fp = this.filePath(personaSlug);
    await mkdir(dirname(fp), { recursive: true });
    await appendFile(fp, JSON.stringify(withTs) + '\n', 'utf-8');
  }

  /**
   * Simple keyword search across content and tags.
   * Case-insensitive. Returns matching entries sorted by recency.
   */
  async search(personaSlug: string, query: string): Promise<MemoryEntry[]> {
    const raw = await this.readRawLines(personaSlug);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const matches = raw.filter((entry) => {
      const haystack = [entry.content, ...entry.tags].join(' ').toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });

    matches.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return matches;
  }

  /**
   * Shorthand: get the N most recent entries.
   */
  async getRecent(personaSlug: string, limit?: number): Promise<MemoryEntry[]> {
    return this.read(personaSlug, { limit: limit ?? 20 });
  }

  // ── internal ────────────────────────────────────────────────────────

  private async readRawLines(personaSlug: string): Promise<MemoryEntry[]> {
    const fp = this.filePath(personaSlug);
    let text: string;
    try {
      text = await readFile(fp, 'utf-8');
    } catch {
      // File doesn't exist yet — that's fine.
      return [];
    }

    const entries: MemoryEntry[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as MemoryEntry);
      } catch {
        // Skip malformed lines.
      }
    }
    return entries;
  }
}
