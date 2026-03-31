import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('persona tools', () => {
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

  describe('atelier_persona_get', () => {
    it('returns persona definition and state', async () => {
      const result = await callTool(
        'atelier_persona_get',
        { slug: 'alex' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.definition).toBeDefined();
      expect(data.definition.slug).toBe('alex');
      expect(data.definition.name).toBe('Alex Chen');
      expect(data.definition.role).toBe('Senior Backend Engineer');
      expect(data.definition.archetype).toBe('mentor');
      expect(data.state).toBeDefined();
    });

    it('returns error for nonexistent persona', async () => {
      const result = await callTool(
        'atelier_persona_get',
        { slug: 'nonexistent' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBe(true);
      expect(data.error).toContain('not found');
    });
  });

  describe('atelier_persona_list', () => {
    it('returns all personas', async () => {
      const result = await callTool('atelier_persona_list', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.count).toBeGreaterThanOrEqual(2);
      expect(data.personas).toBeArray();

      const slugs = data.personas.map((p: any) => p.slug);
      expect(slugs).toContain('alex');
      expect(slugs).toContain('jordan');
    });

    it('filters by team', async () => {
      const result = await callTool(
        'atelier_persona_list',
        { team: 'backend' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(data.team).toBe('backend');
      expect(data.personas.length).toBeGreaterThanOrEqual(2);
      for (const p of data.personas) {
        expect(p.team).toBe('backend');
      }
    });
  });
});
