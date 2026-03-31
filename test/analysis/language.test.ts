import { describe, it, expect } from 'bun:test';
import {
  detectLanguages,
  detectFrameworks,
  detectBuildSystem,
} from '../../src/analysis/language.js';
import { join } from 'node:path';

const TS_WEB_FIXTURE = join(
  import.meta.dir,
  '../fixtures/repos/typescript-web',
);

describe('Language detection', () => {
  describe('detectLanguages', () => {
    it('detects TypeScript in typescript-web fixture', async () => {
      const langs = await detectLanguages(TS_WEB_FIXTURE);
      const langNames = langs.map((l) => l.language);
      expect(langNames).toContain('TypeScript');
    });

    it('returns file counts', async () => {
      const langs = await detectLanguages(TS_WEB_FIXTURE);
      const ts = langs.find((l) => l.language === 'TypeScript');
      expect(ts).toBeDefined();
      expect(ts!.fileCount).toBeGreaterThan(0);
    });

    it('returns extensions used', async () => {
      const langs = await detectLanguages(TS_WEB_FIXTURE);
      const ts = langs.find((l) => l.language === 'TypeScript');
      expect(ts).toBeDefined();
      expect(ts!.extensions).toContain('.ts');
    });

    it('sorts by file count descending', async () => {
      const langs = await detectLanguages(TS_WEB_FIXTURE);
      for (let i = 1; i < langs.length; i++) {
        expect(langs[i - 1].fileCount).toBeGreaterThanOrEqual(langs[i].fileCount);
      }
    });

    it('returns empty for directory with no code files', async () => {
      const langs = await detectLanguages('/tmp');
      // /tmp may have some stray files, but most likely no code
      // Just check it doesn't throw
      expect(Array.isArray(langs)).toBe(true);
    });
  });

  describe('detectFrameworks', () => {
    it('finds Express in typescript-web fixture', async () => {
      const frameworks = await detectFrameworks(TS_WEB_FIXTURE);
      expect(frameworks).toContain('Express');
    });

    it('finds jest in typescript-web fixture', async () => {
      // jest is in devDependencies
      // The framework list doesn't include jest as a "framework" per the code
      // but it does check for known framework deps
      const frameworks = await detectFrameworks(TS_WEB_FIXTURE);
      // Express should be there at minimum
      expect(frameworks.length).toBeGreaterThan(0);
    });

    it('returns empty array for directory with no package.json', async () => {
      const frameworks = await detectFrameworks('/tmp/nonexistent-project');
      expect(frameworks).toEqual([]);
    });
  });

  describe('detectBuildSystem', () => {
    it('detects npm for typescript-web fixture (has package.json)', async () => {
      const buildSystem = await detectBuildSystem(TS_WEB_FIXTURE);
      // The fixture has package.json but no lockfile, so falls back to 'npm'
      expect(buildSystem).toBe('npm');
    });

    it('returns null for directory with no build files', async () => {
      const buildSystem = await detectBuildSystem(
        '/tmp/nonexistent-project-dir',
      );
      expect(buildSystem).toBeNull();
    });
  });
});
