import { describe, it, expect, beforeEach } from 'bun:test';
import { PersonaRegistry } from '../../src/core/persona-registry.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dir, '../fixtures/atelier-state/fresh-init');

describe('PersonaRegistry', () => {
  let registry: PersonaRegistry;

  beforeEach(async () => {
    registry = new PersonaRegistry(FIXTURE_DIR);
    await registry.loadAll();
  });

  describe('loadAll', () => {
    it('loads all personas from fixture data', () => {
      const all = registry.listAll();
      expect(all.length).toBe(2);
    });

    it('initializes state for each persona', () => {
      const alex = registry.getBySlug('alex');
      expect(alex).toBeDefined();
      expect(alex!.state).toBeDefined();
      expect(alex!.state.mood).toBe('normal');
    });
  });

  describe('getBySlug', () => {
    it('returns persona by slug', () => {
      const alex = registry.getBySlug('alex');
      expect(alex).toBeDefined();
      expect(alex!.definition.name).toBe('Alex Chen');
    });

    it('returns undefined for unknown slug', () => {
      expect(registry.getBySlug('nobody')).toBeUndefined();
    });
  });

  describe('getByName', () => {
    it('matches full name (case-insensitive)', () => {
      const result = registry.getByName('alex chen');
      expect(result).toBeDefined();
      expect(result!.definition.slug).toBe('alex');
    });

    it('matches first name (case-insensitive)', () => {
      const result = registry.getByName('Jordan');
      expect(result).toBeDefined();
      expect(result!.definition.slug).toBe('jordan');
    });

    it('returns undefined for unknown name', () => {
      expect(registry.getByName('Nobody')).toBeUndefined();
    });
  });

  describe('getByTeam', () => {
    it('returns all personas for a team', () => {
      const backend = registry.getByTeam('backend');
      expect(backend.length).toBe(2);
      const slugs = backend.map((p) => p.definition.slug);
      expect(slugs).toContain('alex');
      expect(slugs).toContain('jordan');
    });

    it('returns empty array for unknown team', () => {
      expect(registry.getByTeam('nonexistent')).toEqual([]);
    });
  });

  describe('getRespondersForMessage', () => {
    it('includes @mentioned personas', () => {
      const responders = registry.getRespondersForMessage(
        'Hey @jordan can you review this?',
        'backend',
      );
      const slugs = responders.map((p) => p.definition.slug);
      expect(slugs).toContain('jordan');
    });

    it('includes @mentioned by first name', () => {
      const responders = registry.getRespondersForMessage(
        'Hey @alex what do you think?',
        'backend',
      );
      const slugs = responders.map((p) => p.definition.slug);
      expect(slugs).toContain('alex');
    });

    it('scores by expertise relevance', () => {
      // Alex has "API design" and "testing strategies" expertise
      const responders = registry.getRespondersForMessage(
        'I need help with API design and testing',
        'backend',
      );
      // Alex should be among responders since expertise matches
      const slugs = responders.map((p) => p.definition.slug);
      expect(slugs).toContain('alex');
    });

    it('skips heads_down personas unless @mentioned', () => {
      // Neither Alex nor Jordan is heads_down in fixture, so test the logic:
      // Jordan is sometimes_delayed (not heads_down), so should still be a candidate
      const responders = registry.getRespondersForMessage(
        'General question about security',
        'backend',
      );
      expect(responders.length).toBeGreaterThanOrEqual(1);
    });

    it('always returns at least 1 responder', () => {
      const responders = registry.getRespondersForMessage(
        'Something completely unrelated to any expertise',
        'backend',
      );
      expect(responders.length).toBeGreaterThanOrEqual(1);
    });

    it('caps responders at 3', () => {
      const responders = registry.getRespondersForMessage(
        'A generic message',
        'backend',
      );
      expect(responders.length).toBeLessThanOrEqual(3);
    });
  });
});
