import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from './helpers.js';

ensureToolsRegistered();

describe('session tools', () => {
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

  describe('atelier_status', () => {
    it('returns initialized:true with fixture data', async () => {
      const result = await callTool('atelier_status', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.initialized).toBe(true);
      expect(data.session).not.toBeNull();
      expect(data.session.id).toBe('sess-test-001');
      expect(data.session.day).toBe(1);
      expect(data.session.active).toBe(true);
    });

    it('includes org info', async () => {
      const result = await callTool('atelier_status', {}, ctx);
      const data = parseResult(result) as any;

      expect(data.org).not.toBeNull();
      expect(data.org.name).toBe('TestOrg');
      expect(data.org.teams).toContain('backend');
    });

    it('returns recent events (default non-verbose)', async () => {
      const result = await callTool('atelier_status', {}, ctx);
      const data = parseResult(result) as any;

      // Fresh fixture has no events, so recentEvents should be empty array
      expect(data.recentEvents).toBeArray();
    });
  });

  describe('atelier_start_session', () => {
    it('resumes an existing session when state.json exists', async () => {
      const result = await callTool('atelier_start_session', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.message).toBe('Welcome back');
      expect(data.session.id).toBe('sess-test-001');
      expect(data.session.day).toBe(1);
    });

    it('includes org info in response', async () => {
      const result = await callTool('atelier_start_session', {}, ctx);
      const data = parseResult(result) as any;

      expect(data.org).not.toBeNull();
      expect(data.org.name).toBe('TestOrg');
    });

    it('creates a new session when state.json does not exist', async () => {
      // Remove state.json to simulate fresh start
      const { unlink } = await import('node:fs/promises');
      await unlink(ctx.atelierDir + '/state.json');

      const result = await callTool('atelier_start_session', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.message).toBe('New session started');
      expect(data.session.id).toBeDefined();
    });
  });

  describe('atelier_end_session', () => {
    it('ends an active session and persists state', async () => {
      const result = await callTool('atelier_end_session', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBeUndefined();
      expect(data.summary).toContain('sess-test-001');
      expect(data.summary).toContain('ended');
      expect(data.eventsLogged).toBeGreaterThanOrEqual(1);
    });

    it('returns error when no active session exists', async () => {
      const { unlink } = await import('node:fs/promises');
      await unlink(ctx.atelierDir + '/state.json');

      const result = await callTool('atelier_end_session', {}, ctx);
      const data = parseResult(result) as any;

      expect(result.isError).toBe(true);
      expect(data.summary).toContain('No active session');
    });
  });
});
