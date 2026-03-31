import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('curriculum tools', () => {
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

  describe('atelier_curriculum_list', () => {
    it('returns available curriculum packs', async () => {
      const result = await callTool('atelier_curriculum_list', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.packs).toBeArray();
      expect(data.total).toBeGreaterThanOrEqual(1);

      // Each pack should have required fields
      for (const pack of data.packs) {
        expect(pack.id).toBeDefined();
        expect(pack.title).toBeDefined();
        expect(pack.description).toBeDefined();
        expect(pack.target_skills).toBeArray();
        expect(pack.sequences).toBeGreaterThanOrEqual(1);
        expect(pack.total_beads).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
