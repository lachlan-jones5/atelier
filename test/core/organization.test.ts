import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { OrganizationManager } from '../../src/core/organization.js';
import { join } from 'node:path';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const FIXTURE_DIR = join(import.meta.dir, '../fixtures/atelier-state/fresh-init');

describe('OrganizationManager', () => {
  describe('load from fixture', () => {
    let mgr: OrganizationManager;

    beforeEach(async () => {
      mgr = new OrganizationManager();
      await mgr.load(FIXTURE_DIR);
    });

    it('loads organization from org.yaml', () => {
      const org = mgr.get();
      expect(org.name).toBe('TestOrg');
      expect(org.tagline).toBe('Building great software');
      expect(org.domain).toBe('internal-tools');
      expect(org.teams).toEqual(['backend']);
    });

    it('returns the org from load()', async () => {
      const mgr2 = new OrganizationManager();
      const result = await mgr2.load(FIXTURE_DIR);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('TestOrg');
    });
  });

  describe('get() throws when not loaded', () => {
    it('throws if load has not been called', () => {
      const mgr = new OrganizationManager();
      expect(() => mgr.get()).toThrow('Organization not loaded');
    });
  });

  describe('load returns null for missing file', () => {
    it('returns null when org.yaml does not exist', async () => {
      const mgr = new OrganizationManager();
      const result = await mgr.load('/tmp/nonexistent-dir');
      expect(result).toBeNull();
    });
  });

  describe('save and reload roundtrip', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'org-test-'));
      await cp(FIXTURE_DIR, tmpDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('persists changes and reloads them', async () => {
      const mgr = new OrganizationManager();
      await mgr.load(tmpDir);

      // Mutate
      const org = mgr.get();
      org.name = 'UpdatedOrg';
      org.teams.push('frontend');

      await mgr.save(tmpDir);

      // Reload in a new instance
      const mgr2 = new OrganizationManager();
      await mgr2.load(tmpDir);
      const reloaded = mgr2.get();

      expect(reloaded.name).toBe('UpdatedOrg');
      expect(reloaded.teams).toContain('frontend');
    });
  });

  describe('getStatus', () => {
    it('returns correct shape', async () => {
      const mgr = new OrganizationManager();
      await mgr.load(FIXTURE_DIR);

      const status = mgr.getStatus();
      expect(status.name).toBe('TestOrg');
      expect(status.teamCount).toBe(1);
      expect(typeof status.totalBeads).toBe('number');
      expect(typeof status.activeIncident).toBe('boolean');
    });
  });
});
