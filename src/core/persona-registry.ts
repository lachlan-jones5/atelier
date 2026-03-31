import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Persona, PersonaState, PersonaWithState } from './persona.js';
import { readYaml, writeYaml } from '../util/yaml.js';
import { getTeamsDir, getPersonasDir } from '../util/paths.js';

/** Raw shape of a persona YAML file (definition fields + optional state key). */
interface PersonaYaml extends Persona {
  state?: Partial<PersonaState>;
}

function defaultState(): PersonaState {
  return {
    currentBead: null,
    currentBranch: null,
    beadsCompleted: [],
    lastActiveAt: new Date().toISOString(),
    mood: 'normal',
  };
}

export class PersonaRegistry {
  private personas: Map<string, PersonaWithState> = new Map(); // keyed by slug
  private dirty: Set<string> = new Set(); // slugs that need saving
  private filePaths: Map<string, string> = new Map(); // slug → YAML file path
  private atelierDir: string;

  constructor(atelierDir: string) {
    this.atelierDir = atelierDir;
  }

  /**
   * Scan all teams/\*\/personas/\*.yaml, load each persona definition.
   * Initializes PersonaState for each from the YAML `state:` key or defaults.
   */
  async loadAll(): Promise<void> {
    this.personas.clear();
    this.dirty.clear();
    this.filePaths.clear();

    const teamsDir = getTeamsDir(this.atelierDir);

    let teamDirs: string[];
    try {
      const dirents = await readdir(teamsDir, { withFileTypes: true });
      teamDirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      // No teams directory yet — nothing to load.
      return;
    }

    for (const teamSlug of teamDirs) {
      const personasDir = getPersonasDir(this.atelierDir, teamSlug);

      let files: string[];
      try {
        const dirents = await readdir(personasDir);
        files = dirents.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
      } catch {
        // Team has no personas directory — skip.
        continue;
      }

      for (const file of files) {
        const filePath = join(personasDir, file);
        try {
          const raw = await readYaml<PersonaYaml>(filePath);

          // Separate state from definition fields.
          const { state: rawState, ...definitionFields } = raw;
          const definition: Persona = {
            ...definitionFields,
            team: definitionFields.team ?? teamSlug,
            slug: definitionFields.slug ?? file.replace(/\.ya?ml$/, ''),
          };

          const state: PersonaState = {
            ...defaultState(),
            ...rawState,
          };

          this.personas.set(definition.slug, { definition, state });
          this.filePaths.set(definition.slug, filePath);
        } catch {
          // Skip malformed persona files.
          continue;
        }
      }
    }
  }

  /** Get a persona by slug. */
  getBySlug(slug: string): PersonaWithState | undefined {
    return this.personas.get(slug);
  }

  /**
   * Get a persona by name (case-insensitive full match, then first-name match).
   */
  getByName(name: string): PersonaWithState | undefined {
    const lower = name.toLowerCase();
    for (const p of this.personas.values()) {
      if (p.definition.name.toLowerCase() === lower) return p;
    }
    // Try first-name match.
    for (const p of this.personas.values()) {
      const firstName = p.definition.name.split(/\s+/)[0].toLowerCase();
      if (firstName === lower) return p;
    }
    return undefined;
  }

  /** Get all personas belonging to a team. */
  getByTeam(teamSlug: string): PersonaWithState[] {
    return Array.from(this.personas.values()).filter(
      (p) => p.definition.team === teamSlug,
    );
  }

  /** List all loaded personas. */
  listAll(): PersonaWithState[] {
    return Array.from(this.personas.values());
  }

  /**
   * Determine which personas should respond to a message in a team chat.
   *
   * 1. Check for @mentions — always include mentioned personas.
   * 2. Filter by team membership.
   * 3. Filter by availability (skip 'heads_down' unless @mentioned).
   * 4. Score remaining by relevance (keyword match against expertise, current work).
   * 5. Cap at 2-3 responders to avoid overwhelming.
   * 6. Always include at least 1 responder.
   */
  getRespondersForMessage(message: string, teamSlug: string): PersonaWithState[] {
    const messageLower = message.toLowerCase();

    // 1. Detect @mentions.
    const mentionPattern = /@(\w+)/g;
    const mentions = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(messageLower)) !== null) {
      mentions.add(match[1]);
    }

    const teamPersonas = this.getByTeam(teamSlug);
    const mentioned: PersonaWithState[] = [];
    const candidates: PersonaWithState[] = [];

    for (const p of teamPersonas) {
      const slug = p.definition.slug.toLowerCase();
      const firstName = p.definition.name.split(/\s+/)[0].toLowerCase();

      if (mentions.has(slug) || mentions.has(firstName)) {
        // Always include mentioned personas regardless of availability.
        mentioned.push(p);
      } else if (p.definition.availability !== 'heads_down') {
        candidates.push(p);
      }
    }

    // 4. Score candidates by keyword relevance.
    const scored = candidates.map((p) => {
      let score = 0;
      const words = messageLower.split(/\s+/);

      for (const expertise of p.definition.expertise) {
        const expertiseLower = expertise.toLowerCase();
        // Check if any message word appears in the expertise string.
        for (const word of words) {
          if (word.length >= 3 && expertiseLower.includes(word)) {
            score += 1;
          }
        }
        // Check if the whole expertise phrase appears in the message.
        if (messageLower.includes(expertiseLower)) {
          score += 2;
        }
      }

      // Boost if persona's current work is related.
      if (p.state.currentBead) {
        const beadLower = p.state.currentBead.toLowerCase();
        for (const word of words) {
          if (word.length >= 3 && beadLower.includes(word)) {
            score += 1;
          }
        }
      }

      return { persona: p, score };
    });

    // Sort by score descending.
    scored.sort((a, b) => b.score - a.score);

    // 5. Pick top 2-3 candidates (cap varies by how many were mentioned).
    const maxCandidates = Math.max(0, 3 - mentioned.length);
    const topCandidates = scored.slice(0, maxCandidates).map((s) => s.persona);

    const responders = [...mentioned, ...topCandidates];

    // 6. Always include at least 1 responder.
    if (responders.length === 0 && teamPersonas.length > 0) {
      // Pick the first available persona, or just the first persona.
      const fallback =
        teamPersonas.find((p) => p.definition.availability !== 'heads_down') ??
        teamPersonas[0];
      responders.push(fallback);
    }

    return responders;
  }

  /** Return personas that are not heads_down. */
  getAllActive(): PersonaWithState[] {
    return Array.from(this.personas.values()).filter(
      (p) => p.definition.availability !== 'heads_down',
    );
  }

  /** Update a persona's mutable state and mark dirty for later save. */
  async updateState(slug: string, patch: Partial<PersonaState>): Promise<void> {
    const persona = this.personas.get(slug);
    if (!persona) {
      throw new Error(`PersonaRegistry: unknown persona slug "${slug}"`);
    }
    Object.assign(persona.state, patch);
    this.dirty.add(slug);
  }

  /** Write all dirty persona files back to YAML. */
  async save(): Promise<void> {
    for (const slug of this.dirty) {
      const persona = this.personas.get(slug);
      const filePath = this.filePaths.get(slug);
      if (!persona || !filePath) continue;

      // Merge definition + state into a single YAML document.
      const data: Record<string, unknown> = { ...persona.definition, state: persona.state };
      await writeYaml(filePath, data);
    }
    this.dirty.clear();
  }
}
