import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('skill tools', () => {
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

  describe('atelier_skill_summary', () => {
    it('returns skill profile with all dimensions', async () => {
      const result = await callTool('atelier_skill_summary', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();

      expect(data).toBeDefined();
      expect(data.dimensions).toBeDefined();

      // Check that standard dimensions are present in the profile
      const dimensionNames = [
        'reading_code',
        'testing',
        'debugging',
        'design',
        'review',
        'communication',
        'ops_awareness',
      ];

      for (const dim of dimensionNames) {
        expect(data.dimensions[dim]).toBeDefined();
        expect(data.dimensions[dim].level).toBeDefined();
      }
    });
  });
});
