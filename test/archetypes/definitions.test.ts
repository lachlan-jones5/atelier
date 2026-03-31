import { describe, it, expect } from 'bun:test';
import { BUILTIN_ARCHETYPES } from '../../src/archetypes/definitions.js';

describe('Archetype definitions', () => {
  it('defines all 10 archetypes', () => {
    expect(BUILTIN_ARCHETYPES.length).toBe(10);
  });

  it('has no duplicate IDs', () => {
    const ids = BUILTIN_ARCHETYPES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  const expectedIds = [
    'mentor',
    'gatekeeper',
    'pragmatist',
    'newbie',
    'domain-expert',
    'firefighter',
    'architect',
    'connector',
    'skeptic',
    'craftsperson',
  ];

  it('includes all expected archetype IDs', () => {
    const ids = new Set(BUILTIN_ARCHETYPES.map((a) => a.id));
    for (const expected of expectedIds) {
      expect(ids.has(expected as any)).toBe(true);
    }
  });

  describe('each archetype has required fields', () => {
    for (const archetype of BUILTIN_ARCHETYPES) {
      describe(archetype.id, () => {
        it('has a non-empty name', () => {
          expect(archetype.name.length).toBeGreaterThan(0);
        });

        it('has a non-empty description', () => {
          expect(archetype.description.length).toBeGreaterThan(0);
        });

        it('has non-empty communication_patterns array', () => {
          expect(archetype.communication_patterns.length).toBeGreaterThan(0);
        });

        it('has non-empty review_patterns array', () => {
          expect(archetype.review_patterns.length).toBeGreaterThan(0);
        });

        it('has non-empty behavioral_traits array', () => {
          expect(archetype.behavioral_traits.length).toBeGreaterThan(0);
        });

        it('has a valid helpfulness_range', () => {
          const [lo, hi] = archetype.helpfulness_range;
          expect(lo).toBeGreaterThanOrEqual(0);
          expect(hi).toBeLessThanOrEqual(1);
          expect(lo).toBeLessThan(hi);
        });

        it('has non-empty typical_roles array', () => {
          expect(archetype.typical_roles.length).toBeGreaterThan(0);
        });

        it('has a non-empty teaching_style', () => {
          expect(archetype.teaching_style.length).toBeGreaterThan(0);
        });

        it('has a non-empty conflict_style', () => {
          expect(archetype.conflict_style.length).toBeGreaterThan(0);
        });

        it('has non-empty strengths array', () => {
          expect(archetype.strengths.length).toBeGreaterThan(0);
        });

        it('has non-empty blind_spots array', () => {
          expect(archetype.blind_spots.length).toBeGreaterThan(0);
        });
      });
    }
  });
});
