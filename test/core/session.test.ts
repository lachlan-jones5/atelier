import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SessionManager } from '../../src/core/session.js';
import { join } from 'node:path';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const FIXTURE_DIR = join(import.meta.dir, '../fixtures/atelier-state/fresh-init');

describe('SessionManager', () => {
  describe('load existing session', () => {
    it('resumes existing session from state.json', async () => {
      const mgr = new SessionManager();
      const state = await mgr.load(FIXTURE_DIR);

      expect(state.sessionId).toBe('sess-test-001');
      expect(state.logicalDay).toBe(1);
      expect(state.events).toEqual([]);
    });
  });

  describe('load creates new session when no state.json', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'session-test-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('creates a fresh session', async () => {
      const mgr = new SessionManager();
      const state = await mgr.load(tmpDir);

      expect(state.sessionId).toMatch(/^session-/);
      expect(state.logicalDay).toBe(1);
      expect(state.events).toEqual([]);
      expect(state.startedAt).toBeTruthy();
    });
  });

  describe('logEvent', () => {
    it('adds timestamped events', async () => {
      const mgr = new SessionManager();
      await mgr.load(FIXTURE_DIR);

      mgr.logEvent({ type: 'chat', data: { message: 'hello' } });
      mgr.logEvent({ type: 'bead_claim', data: { beadId: 'bead-001' } });

      const state = mgr.get();
      expect(state.events.length).toBe(2);
      expect(state.events[0].type).toBe('chat');
      expect(state.events[0].timestamp).toBeTruthy();
      expect(state.events[1].type).toBe('bead_claim');
    });
  });

  describe('get() throws when not loaded', () => {
    it('throws if load has not been called', () => {
      const mgr = new SessionManager();
      expect(() => mgr.get()).toThrow('no session loaded');
    });
  });

  describe('isActive', () => {
    it('returns false before load', () => {
      const mgr = new SessionManager();
      expect(mgr.isActive()).toBe(false);
    });

    it('returns true after load', async () => {
      const mgr = new SessionManager();
      await mgr.load(FIXTURE_DIR);
      expect(mgr.isActive()).toBe(true);
    });
  });

  describe('save/load roundtrip', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'session-roundtrip-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('preserves state across save and reload', async () => {
      const mgr = new SessionManager();
      await mgr.load(tmpDir);

      mgr.logEvent({ type: 'chat', data: { msg: 'test' } });
      mgr.logEvent({ type: 'advance', data: { day: 2 } });

      await mgr.save(tmpDir);

      // Reload in a new instance
      const mgr2 = new SessionManager();
      const reloaded = await mgr2.load(tmpDir);

      expect(reloaded.sessionId).toBe(mgr.get().sessionId);
      expect(reloaded.events.length).toBe(2);
      expect(reloaded.events[0].type).toBe('chat');
      expect(reloaded.events[1].type).toBe('advance');
    });

    it('updates lastActiveAt on save', async () => {
      const mgr = new SessionManager();
      await mgr.load(tmpDir);
      const beforeSave = mgr.get().lastActiveAt;

      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 10));
      await mgr.save(tmpDir);

      const afterSave = mgr.get().lastActiveAt;
      expect(new Date(afterSave).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeSave).getTime(),
      );
    });
  });
});
