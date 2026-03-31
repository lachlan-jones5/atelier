import { describe, it, expect } from 'bun:test';
import {
  selectArchetypesForTeam,
  getArchetypeWeightsForDomain,
} from '../../src/archetypes/selector.js';
import { ArchetypeRegistry } from '../../src/archetypes/index.js';

describe('Archetype selector', () => {
  const registry = new ArchetypeRegistry();

  describe('selectArchetypesForTeam', () => {
    it('returns 0 archetypes for teamSize 0', () => {
      const result = selectArchetypesForTeam(
        { teamDomain: 'web', teamSize: 0, experienceLevel: 'journeyman' },
        registry,
      );
      expect(result).toEqual([]);
    });

    it('selects correct number for teamSize 3', () => {
      const result = selectArchetypesForTeam(
        { teamDomain: 'web', teamSize: 3, experienceLevel: 'journeyman' },
        registry,
      );
      expect(result.length).toBe(3);
    });

    it('selects correct number for teamSize 5', () => {
      const result = selectArchetypesForTeam(
        { teamDomain: 'systems', teamSize: 5, experienceLevel: 'journeyman' },
        registry,
      );
      expect(result.length).toBe(5);
    });

    it('returns all archetypes when teamSize exceeds count', () => {
      const result = selectArchetypesForTeam(
        { teamDomain: 'web', teamSize: 20, experienceLevel: 'journeyman' },
        registry,
      );
      expect(result.length).toBe(10);
    });

    it('has no duplicates on same team', () => {
      const result = selectArchetypesForTeam(
        { teamDomain: 'web', teamSize: 5, experienceLevel: 'journeyman' },
        registry,
      );
      const ids = result.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('domain weighting', () => {
    it('compiler domain weights gatekeeper higher', () => {
      const weights = getArchetypeWeightsForDomain('compiler design');
      const gatekeeperWeight = weights.get('gatekeeper')!;
      // Baseline is 0.5, compiler adds 0.3 to gatekeeper
      expect(gatekeeperWeight).toBeGreaterThan(0.5);
    });

    it('compiler domain selects gatekeeper for small team', () => {
      const result = selectArchetypesForTeam(
        { teamDomain: 'compiler', teamSize: 3, experienceLevel: 'journeyman' },
        registry,
      );
      const ids = result.map((a) => a.id);
      expect(ids).toContain('gatekeeper');
    });

    it('web domain weights pragmatist higher', () => {
      const weights = getArchetypeWeightsForDomain('web frontend');
      const pragWeight = weights.get('pragmatist')!;
      expect(pragWeight).toBeGreaterThan(0.5);
    });

    it('unknown domain gives uniform weights', () => {
      const weights = getArchetypeWeightsForDomain('alien-technology');
      const values = Array.from(weights.values());
      // All should be 0.5 (baseline) for unknown domain
      expect(values.every((v) => v === 0.5)).toBe(true);
    });
  });

  describe('constraints', () => {
    it('includes at least one standards archetype', () => {
      const standardsIds = new Set(['gatekeeper', 'craftsperson']);
      for (const domain of ['web', 'systems', 'ml', 'compiler']) {
        const result = selectArchetypesForTeam(
          { teamDomain: domain, teamSize: 3, experienceLevel: 'journeyman' },
          registry,
        );
        const ids = result.map((a) => a.id);
        const hasStandards = ids.some((id) => standardsIds.has(id));
        expect(hasStandards).toBe(true);
      }
    });

    it('includes at least one productivity archetype', () => {
      const productivityIds = new Set([
        'pragmatist',
        'firefighter',
        'connector',
      ]);
      for (const domain of ['web', 'systems', 'ml', 'compiler']) {
        const result = selectArchetypesForTeam(
          { teamDomain: domain, teamSize: 3, experienceLevel: 'journeyman' },
          registry,
        );
        const ids = result.map((a) => a.id);
        const hasProductivity = ids.some((id) => productivityIds.has(id));
        expect(hasProductivity).toBe(true);
      }
    });
  });
});
