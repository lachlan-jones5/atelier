import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('team tools', () => {
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

  describe('atelier_team_list', () => {
    it('returns teams from fixture', async () => {
      const result = await callTool('atelier_team_list', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.teams).toBeArray();

      const backend = data.teams.find((t: any) => t.slug === 'backend');
      expect(backend).toBeDefined();
      expect(backend.name).toBe('Backend');
      expect(backend.domain).toBe('API and data services');
      expect(backend.techStack).toContain('typescript');
    });
  });

  describe('atelier_team_status', () => {
    it('returns team with personas', async () => {
      const result = await callTool(
        'atelier_team_status',
        { team: 'backend' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.team.slug).toBe('backend');
      expect(data.team.name).toBe('Backend');
      expect(data.personas).toBeArray();
      expect(data.personas.length).toBeGreaterThanOrEqual(2);

      const slugs = data.personas.map((p: any) => p.slug);
      expect(slugs).toContain('alex');
      expect(slugs).toContain('jordan');
    });

    it('returns error for nonexistent team', async () => {
      const result = await callTool(
        'atelier_team_status',
        { team: 'nonexistent' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBe(true);
      expect(data.error).toContain('not found');
    });
  });
});
