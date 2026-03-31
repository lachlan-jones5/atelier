import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BeadStore } from '../../src/core/bead-store.js';
import { BeadCreate } from '../../src/core/bead.js';
import { join } from 'node:path';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const FIXTURE_DIR = join(import.meta.dir, '../fixtures/atelier-state/fresh-init');

describe('BeadStore', () => {
  describe('loadAll from fixture data', () => {
    let store: BeadStore;

    beforeEach(async () => {
      store = new BeadStore(FIXTURE_DIR);
      await store.loadAll();
    });

    it('loads all beads from fixture', () => {
      const all = store.list();
      expect(all.length).toBe(2);
    });

    it('retrieves a bead by ID', () => {
      const bead = store.getById('bead-001');
      expect(bead).toBeDefined();
      expect(bead!.title).toBe('Add input validation to user creation endpoint');
    });

    it('returns undefined for unknown ID', () => {
      expect(store.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('list with filters', () => {
    let store: BeadStore;

    beforeEach(async () => {
      store = new BeadStore(FIXTURE_DIR);
      await store.loadAll();
    });

    it('filters by team', () => {
      const result = store.list({ team: 'backend' });
      expect(result.length).toBe(2);
      expect(result.every((b) => b.team === 'backend')).toBe(true);
    });

    it('filters by status', () => {
      const open = store.list({ status: 'open' });
      expect(open.length).toBe(1);
      expect(open[0].id).toBe('bead-001');

      const inProgress = store.list({ status: 'in_progress' });
      expect(inProgress.length).toBe(1);
      expect(inProgress[0].id).toBe('bead-002');
    });

    it('filters by type', () => {
      const features = store.list({ type: 'feature' });
      expect(features.length).toBe(1);
      expect(features[0].id).toBe('bead-001');

      const tests = store.list({ type: 'test' });
      expect(tests.length).toBe(1);
      expect(tests[0].id).toBe('bead-002');
    });

    it('sorts results by priority (higher priority first)', () => {
      const all = store.list();
      // bead-002 is high priority, bead-001 is medium
      expect(all[0].id).toBe('bead-002');
      expect(all[1].id).toBe('bead-001');
    });

    it('returns empty array for non-matching filter', () => {
      const result = store.list({ team: 'nonexistent' });
      expect(result).toEqual([]);
    });
  });

  describe('write operations with temp directory', () => {
    let tmpDir: string;
    let store: BeadStore;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'bead-store-test-'));
      await cp(FIXTURE_DIR, tmpDir, { recursive: true });
      store = new BeadStore(tmpDir);
      await store.loadAll();
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('claims a bead successfully', async () => {
      const bead = await store.claim('bead-001');
      expect(bead.status).toBe('claimed');
      expect(bead.assigned_to).toBe('user');
    });

    it('throws when claiming an already claimed/in_progress bead', async () => {
      // bead-002 is already in_progress
      await expect(store.claim('bead-002')).rejects.toThrow(
        /already claimed/,
      );
    });

    it('throws when claiming a non-open bead', async () => {
      // First claim, then try claiming again after status change
      await store.claim('bead-001');
      await expect(store.claim('bead-001')).rejects.toThrow(
        /already claimed/,
      );
    });

    it('updates status to done and sets completed_at', async () => {
      const bead = await store.updateStatus('bead-001', 'done');
      expect(bead.status).toBe('done');
      expect(bead.completed_at).toBeTruthy();
      expect(typeof bead.completed_at).toBe('string');
    });

    it('updates status transitions', async () => {
      const bead = await store.updateStatus('bead-001', 'in_progress');
      expect(bead.status).toBe('in_progress');
    });

    it('creates a new bead with generated ID', async () => {
      const input: BeadCreate = {
        title: 'New test bead',
        description: 'A bead created in tests',
        team: 'backend',
        priority: 'low',
        status: 'open',
        assigned_to: null,
        depends_on: [],
        acceptance_criteria: ['It works'],
        skill_targets: ['testing'],
        type: 'test',
      };

      const bead = await store.create(input);
      expect(bead.id).toMatch(/^bead-/);
      expect(bead.title).toBe('New test bead');
      expect(bead.created_at).toBeTruthy();
      expect(bead.completed_at).toBeNull();
      expect(bead.blocked_by).toEqual([]);

      // Verify it's retrievable
      const fetched = store.getById(bead.id);
      expect(fetched).toBeDefined();
      expect(fetched!.title).toBe('New test bead');
    });

    it('persists new bead to disk and can reload', async () => {
      const input: BeadCreate = {
        title: 'Persisted bead',
        description: 'Should survive reload',
        team: 'backend',
        priority: 'medium',
        status: 'open',
        assigned_to: null,
        depends_on: [],
        acceptance_criteria: ['Roundtrips'],
        skill_targets: ['testing'],
        type: 'feature',
      };

      const created = await store.create(input);

      // Reload from disk
      const store2 = new BeadStore(tmpDir);
      await store2.loadAll();
      const reloaded = store2.getById(created.id);
      expect(reloaded).toBeDefined();
      expect(reloaded!.title).toBe('Persisted bead');
    });
  });

  describe('dependency graph', () => {
    let tmpDir: string;
    let store: BeadStore;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'bead-dep-test-'));
      await cp(FIXTURE_DIR, tmpDir, { recursive: true });
      store = new BeadStore(tmpDir);
      await store.loadAll();
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('getReady returns open beads with no blockers', () => {
      const ready = store.getReady();
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('bead-001');
    });

    it('getBlocked returns beads with unresolved blockers', () => {
      // In the fixture, neither bead has blockers
      const blocked = store.getBlocked();
      expect(blocked.length).toBe(0);
    });

    it('computes blocked_by when a dependency is not done', async () => {
      // Create a bead that depends on bead-001 (which is open)
      const dependent = await store.create({
        title: 'Depends on bead-001',
        description: 'Blocked until bead-001 is done',
        team: 'backend',
        priority: 'low',
        status: 'open',
        assigned_to: null,
        depends_on: ['bead-001'],
        acceptance_criteria: ['Unblocked'],
        skill_targets: ['testing'],
        type: 'feature',
      });

      expect(dependent.blocked_by).toEqual(['bead-001']);

      const blocked = store.getBlocked();
      expect(blocked.some((b) => b.id === dependent.id)).toBe(true);
    });

    it('resolves blocked_by when dependency completes', async () => {
      const dependent = await store.create({
        title: 'Depends on bead-001',
        description: 'Will be unblocked',
        team: 'backend',
        priority: 'low',
        status: 'open',
        assigned_to: null,
        depends_on: ['bead-001'],
        acceptance_criteria: ['Unblocked'],
        skill_targets: ['testing'],
        type: 'feature',
      });

      expect(dependent.blocked_by).toEqual(['bead-001']);

      // Complete the blocker
      await store.updateStatus('bead-001', 'done');

      // The dependent's blocked_by should now be empty
      const updated = store.getById(dependent.id);
      expect(updated!.blocked_by).toEqual([]);
    });

    it('getBlockedBy returns transitive blockers', async () => {
      // Create a chain: C depends on B, B depends on bead-001
      const B = await store.create({
        title: 'Middle blocker',
        description: 'Depends on bead-001',
        team: 'backend',
        priority: 'low',
        status: 'open',
        assigned_to: null,
        depends_on: ['bead-001'],
        acceptance_criteria: [],
        skill_targets: ['testing'],
        type: 'feature',
      });

      const C = await store.create({
        title: 'End of chain',
        description: 'Depends on B',
        team: 'backend',
        priority: 'low',
        status: 'open',
        assigned_to: null,
        depends_on: [B.id],
        acceptance_criteria: [],
        skill_targets: ['testing'],
        type: 'feature',
      });

      const blockers = store.getBlockedBy(C.id);
      // Should include B and transitively bead-001
      expect(blockers).toContain(B.id);
      expect(blockers).toContain('bead-001');
    });
  });
});
