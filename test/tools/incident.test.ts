import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('incident tools', () => {
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

  describe('atelier_incident_trigger', () => {
    it('creates an incident from a random scenario', async () => {
      const result = await callTool('atelier_incident_trigger', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
      expect(data.severity).toBeDefined();
      expect(data.symptoms).toBeArray();
      expect(data.affected_systems).toBeArray();
      expect(data.status).toBe('active');
      expect(data.triggered_at).toBeDefined();
      expect(data.timeline).toBeArray();
      expect(data.timeline.length).toBeGreaterThanOrEqual(1);
      // Root cause should NOT be exposed
      expect(data.root_cause).toBeUndefined();
      expect(data.hint).toContain('Root cause is hidden');
    });

    it('rejects triggering when an incident is already active', async () => {
      // Trigger first incident
      await callTool('atelier_incident_trigger', {}, ctx);

      // Trigger second should fail
      const result = await callTool('atelier_incident_trigger', {}, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('already active');
    });
  });

  describe('atelier_incident_status', () => {
    it('returns available scenarios when no incident is active', async () => {
      const result = await callTool('atelier_incident_status', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.active_incident).toBeNull();
      expect(data.available_scenarios).toBeArray();
      expect(data.available_scenarios.length).toBeGreaterThanOrEqual(1);
    });

    it('returns active incident details after trigger', async () => {
      // Trigger an incident first
      const triggerResult = await callTool(
        'atelier_incident_trigger',
        {},
        ctx,
      );
      const triggerData = parseResult(triggerResult) as any;

      // Now check status
      const result = await callTool('atelier_incident_status', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.id).toBe(triggerData.id);
      expect(data.status).toBe('active');
      expect(data.escalation).toBeDefined();
      // Root cause should NOT be exposed
      expect(data.root_cause).toBeUndefined();
    });
  });
});
