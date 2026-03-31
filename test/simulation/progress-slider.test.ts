import { describe, it, expect } from 'bun:test';
import { getProgressParams, ProgressParams } from '../../src/simulation/progress-slider.js';

describe('Progress slider', () => {
  function assertValidParams(params: ProgressParams): void {
    expect(params.maturity).toBeGreaterThanOrEqual(0);
    expect(params.maturity).toBeLessThanOrEqual(0.9);
    expect(['minimal', 'moderate', 'substantial', 'large']).toContain(
      params.codeVolume,
    );
    expect(params.gitHistoryDepth).toBeGreaterThanOrEqual(0);
    expect(params.beadDistribution.open).toBeGreaterThanOrEqual(0);
    expect(params.beadDistribution.inProgress).toBeGreaterThanOrEqual(0);
    expect(params.beadDistribution.done).toBeGreaterThanOrEqual(0);
    expect(['none', 'low', 'moderate', 'high']).toContain(params.techDebtLevel);
    expect(['sparse', 'moderate', 'thorough']).toContain(
      params.documentationLevel,
    );
    expect(['minimal', 'moderate', 'good', 'excellent']).toContain(
      params.testCoverage,
    );
    expect(typeof params.establishedPatterns).toBe('boolean');
  }

  describe('maturity 0.0', () => {
    it('returns minimal params', () => {
      const params = getProgressParams(0.0);
      expect(params.maturity).toBe(0);
      expect(params.codeVolume).toBe('minimal');
      expect(params.testCoverage).toBe('minimal');
      expect(params.documentationLevel).toBe('sparse');
      expect(params.techDebtLevel).toBe('none');
      expect(params.establishedPatterns).toBe(false);
      expect(params.gitHistoryDepth).toBeLessThanOrEqual(10);
    });
  });

  describe('maturity 0.5', () => {
    it('returns moderate params', () => {
      const params = getProgressParams(0.5);
      expect(params.maturity).toBe(0.5);
      expect(params.codeVolume).toBe('substantial');
      expect(params.testCoverage).toBe('good');
      expect(params.documentationLevel).toBe('moderate');
      expect(params.establishedPatterns).toBe(true);
    });
  });

  describe('maturity 0.9', () => {
    it('returns near-complete params', () => {
      const params = getProgressParams(0.9);
      expect(params.maturity).toBe(0.9);
      expect(params.codeVolume).toBe('large');
      expect(params.testCoverage).toBe('excellent');
      expect(params.documentationLevel).toBe('thorough');
      expect(params.establishedPatterns).toBe(true);
      expect(params.gitHistoryDepth).toBeGreaterThan(400);
    });
  });

  describe('all maturity levels return valid params', () => {
    const levels = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

    for (const level of levels) {
      it(`maturity ${level} produces valid params`, () => {
        const params = getProgressParams(level);
        assertValidParams(params);
      });
    }
  });

  describe('clamping', () => {
    it('clamps negative values to 0', () => {
      const params = getProgressParams(-0.5);
      expect(params.maturity).toBe(0);
    });

    it('clamps values above 0.9 to 0.9', () => {
      const params = getProgressParams(1.5);
      expect(params.maturity).toBe(0.9);
    });
  });

  describe('bead distribution progression', () => {
    it('early maturity has mostly open beads', () => {
      const params = getProgressParams(0.0);
      const { open, done } = params.beadDistribution;
      expect(open).toBeGreaterThan(done);
    });

    it('high maturity has mostly done beads', () => {
      const params = getProgressParams(0.9);
      const { open, done } = params.beadDistribution;
      expect(done).toBeGreaterThan(open);
    });
  });
});
