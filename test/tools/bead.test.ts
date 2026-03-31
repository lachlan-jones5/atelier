import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('bead tools', () => {
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

  describe('atelier_bead_list', () => {
    it('returns all beads from fixtures', async () => {
      const result = await callTool('atelier_bead_list', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.total).toBeGreaterThanOrEqual(2);
      expect(data.beads).toBeArray();

      const ids = data.beads.map((b: any) => b.id);
      expect(ids).toContain('bead-001');
      expect(ids).toContain('bead-002');
    });

    it('filters by status', async () => {
      const result = await callTool(
        'atelier_bead_list',
        { status: 'open' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(data.beads.length).toBeGreaterThanOrEqual(1);
      for (const bead of data.beads) {
        expect(bead.status).toBe('open');
      }
    });

    it('filters by team', async () => {
      const result = await callTool(
        'atelier_bead_list',
        { team: 'backend' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(data.beads.length).toBeGreaterThanOrEqual(1);
      for (const bead of data.beads) {
        expect(bead.team).toBe('backend');
      }
    });

    it('filters by assigned_to', async () => {
      const result = await callTool(
        'atelier_bead_list',
        { assigned_to: 'alex' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(data.beads.length).toBeGreaterThanOrEqual(1);
      for (const bead of data.beads) {
        expect(bead.assigned_to).toBe('alex');
      }
    });
  });

  describe('atelier_bead_detail', () => {
    it('returns bead with dependencies and dependents', async () => {
      const result = await callTool(
        'atelier_bead_detail',
        { id: 'bead-001' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.bead.id).toBe('bead-001');
      expect(data.bead.title).toBe(
        'Add input validation to user creation endpoint',
      );
      expect(data.dependencies).toBeArray();
      expect(data.dependents).toBeArray();
    });

    it('returns error for nonexistent bead', async () => {
      const result = await callTool(
        'atelier_bead_detail',
        { id: 'nonexistent' },
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Bead not found');
    });
  });

  describe('atelier_bead_claim', () => {
    it('assigns bead to user', async () => {
      const result = await callTool(
        'atelier_bead_claim',
        { id: 'bead-001' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.bead.id).toBe('bead-001');
      expect(data.bead.status).toBe('claimed');
      expect(data.suggestedBranch).toBe('feature/bead-001');
    });
  });

  describe('atelier_bead_create', () => {
    it('adds a new bead', async () => {
      const result = await callTool(
        'atelier_bead_create',
        {
          title: 'Test bead creation',
          description: 'A test bead',
          team: 'backend',
          priority: 'low',
          type: 'feature',
          acceptance_criteria: ['It works'],
        },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.bead.title).toBe('Test bead creation');
      expect(data.bead.team).toBe('backend');
      expect(data.bead.status).toBe('open');
      expect(data.bead.id).toBeDefined();

      // Verify it appears in list
      const listResult = await callTool('atelier_bead_list', {}, ctx);
      const listData = parseResult(listResult) as any;
      const ids = listData.beads.map((b: any) => b.id);
      expect(ids).toContain(data.bead.id);
    });
  });

  describe('atelier_bead_update', () => {
    it('changes bead status', async () => {
      const result = await callTool(
        'atelier_bead_update',
        { id: 'bead-001', status: 'in_progress' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.bead.status).toBe('in_progress');
    });

    it('changes bead assignee', async () => {
      const result = await callTool(
        'atelier_bead_update',
        { id: 'bead-001', assigned_to: 'jordan' },
        ctx,
      );
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.bead.assigned_to).toBe('jordan');
    });

    it('returns error for nonexistent bead', async () => {
      const result = await callTool(
        'atelier_bead_update',
        { id: 'nonexistent', status: 'done' },
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Bead not found');
    });
  });
});
