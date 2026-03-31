import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('memory tools', () => {
  let ctx: AtelierContext;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const env = await createTestContext();
    ctx = env.ctx;
    cleanup = env.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('atelier_memory_store', () => {
    it('creates a memory entry', async () => {
      const result = await callTool(
        'atelier_memory_store',
        {
          persona: 'alex',
          type: 'observation',
          content: 'User demonstrated good understanding of async patterns',
          tags: ['async', 'learning'],
        },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.stored).toBe(true);
      expect(data.persona).toBe('alex');
      expect(data.type).toBe('observation');
    });
  });

  describe('atelier_memory_recall', () => {
    it('reads existing memory entries from fixture', async () => {
      const result = await callTool(
        'atelier_memory_recall',
        { persona: 'alex' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.entries).toBeArray();
    });

    it('reads back a stored entry', async () => {
      // Store first
      await callTool(
        'atelier_memory_store',
        {
          persona: 'alex',
          type: 'observation',
          content: 'Unique test memory entry for recall',
          tags: ['test-recall'],
        },
        ctx,
      );

      // Recall
      const result = await callTool(
        'atelier_memory_recall',
        { persona: 'alex' },
        ctx,
      );
      const data = parseResult(result) as any;

      const contents = data.entries.map((e: any) => e.content);
      expect(contents).toContain('Unique test memory entry for recall');
    });
  });

  describe('atelier_memory_search', () => {
    it('finds entries by keyword', async () => {
      const result = await callTool(
        'atelier_memory_search',
        { persona: 'alex', query: 'validation' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.entries).toBeArray();
      // The fixture has a memory entry about validation
      expect(data.count).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for no matches', async () => {
      const result = await callTool(
        'atelier_memory_search',
        { persona: 'alex', query: 'xyznonexistentterm' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(data.count).toBe(0);
      expect(data.entries).toEqual([]);
    });
  });
});
