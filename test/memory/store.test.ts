import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MemoryFileStore } from '../../src/memory/store.js';
import { MemoryEntry } from '../../src/memory/types.js';
import { join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('MemoryFileStore', () => {
  let tmpDir: string;
  let store: MemoryFileStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'memory-store-test-'));
    store = new MemoryFileStore(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
    return {
      type: 'observation',
      ts: new Date().toISOString(),
      content: 'Test entry',
      tags: ['test'],
      ...overrides,
    };
  }

  describe('append', () => {
    it('creates file if missing', async () => {
      await store.append('alice', makeEntry());
      const content = await readFile(join(tmpDir, 'alice.jsonl'), 'utf-8');
      expect(content.trim()).toBeTruthy();
    });

    it('adds entries to existing file', async () => {
      await store.append('bob', makeEntry({ content: 'first' }));
      await store.append('bob', makeEntry({ content: 'second' }));

      const content = await readFile(join(tmpDir, 'bob.jsonl'), 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(2);
    });

    it('auto-sets ts if not already present', async () => {
      const entry = makeEntry({ ts: '' });
      await store.append('charlie', entry);

      const entries = await store.read('charlie');
      expect(entries[0].ts).toBeTruthy();
    });
  });

  describe('read', () => {
    it('returns entries most recent first', async () => {
      await store.append(
        'dave',
        makeEntry({ ts: '2026-01-01T00:00:00Z', content: 'old' }),
      );
      await store.append(
        'dave',
        makeEntry({ ts: '2026-06-01T00:00:00Z', content: 'new' }),
      );

      const entries = await store.read('dave');
      expect(entries[0].content).toBe('new');
      expect(entries[1].content).toBe('old');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await store.append(
          'eve',
          makeEntry({ content: `entry-${i}`, ts: `2026-0${i + 1}-01T00:00:00Z` }),
        );
      }

      const entries = await store.read('eve', { limit: 2 });
      expect(entries.length).toBe(2);
    });

    it('filters by tag', async () => {
      await store.append(
        'frank',
        makeEntry({ tags: ['bug'], content: 'a bug' }),
      );
      await store.append(
        'frank',
        makeEntry({ tags: ['feature'], content: 'a feature' }),
      );
      await store.append(
        'frank',
        makeEntry({ tags: ['bug', 'urgent'], content: 'urgent bug' }),
      );

      const bugs = await store.read('frank', { tags: ['bug'] });
      expect(bugs.length).toBe(2);
      expect(bugs.every((e) => e.tags.includes('bug'))).toBe(true);
    });

    it('handles missing/empty files gracefully', async () => {
      const entries = await store.read('nonexistent');
      expect(entries).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.append(
        'grace',
        makeEntry({ content: 'Fixed the database migration', tags: ['db'] }),
      );
      await store.append(
        'grace',
        makeEntry({ content: 'Reviewed API endpoint', tags: ['review'] }),
      );
      await store.append(
        'grace',
        makeEntry({ content: 'Discussed testing strategies', tags: ['testing'] }),
      );
    });

    it('finds entries by content keyword', async () => {
      const results = await store.search('grace', 'database');
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('database');
    });

    it('finds entries by tag keyword', async () => {
      const results = await store.search('grace', 'review');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', async () => {
      const results = await store.search('grace', 'nonexistent-term');
      expect(results).toEqual([]);
    });

    it('handles missing persona file', async () => {
      const results = await store.search('nobody', 'anything');
      expect(results).toEqual([]);
    });
  });
});
