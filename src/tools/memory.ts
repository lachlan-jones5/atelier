import { z } from 'zod';
import { MemoryManager } from '../memory/index.js';
import { PersonaRegistry } from '../core/persona-registry.js';
import type { registerTool as RegisterToolFn } from './index.js';

/**
 * Resolve a persona slug to their team slug via the PersonaRegistry.
 * Throws if the persona is not found.
 */
async function resolveTeam(
  atelierDir: string,
  persona: string,
): Promise<string> {
  const registry = new PersonaRegistry(atelierDir);
  await registry.loadAll();

  const found = registry.getBySlug(persona) ?? registry.getByName(persona);
  if (!found) {
    throw new Error(`Persona not found: "${persona}"`);
  }
  return found.definition.team;
}

export function registerMemoryTools(register: typeof RegisterToolFn) {
  // --- atelier_memory_recall ---
  register(
    'atelier_memory_recall',
    'Recall memories for a persona, optionally filtered by limit, tags, or time range',
    z.object({
      persona: z.string().describe('Persona slug or name'),
      limit: z.number().optional().describe('Max number of entries to return'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      since: z.string().optional().describe('ISO 8601 timestamp — only entries at or after this time'),
    }),
    async (args, ctx) => {
      const { persona, limit, tags, since } = args as {
        persona: string;
        limit?: number;
        tags?: string[];
        since?: string;
      };

      const teamSlug = await resolveTeam(ctx.atelierDir, persona);
      const mm = new MemoryManager(ctx.atelierDir);

      const entries = await mm.recall(persona, teamSlug, { limit, tags, since });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ entries, count: entries.length }, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_memory_store ---
  register(
    'atelier_memory_store',
    'Store a new memory entry for a persona',
    z.object({
      persona: z.string().describe('Persona slug or name'),
      type: z
        .enum(['observation', 'interaction', 'opinion', 'skill_note', 'context'])
        .describe('Memory entry type'),
      content: z.string().describe('Natural language description of the memory'),
      tags: z.array(z.string()).describe('Tags for search/filtering'),
      bead_id: z.string().optional().describe('Related bead ID, if any'),
    }),
    async (args, ctx) => {
      const { persona, type, content, tags, bead_id } = args as {
        persona: string;
        type: 'observation' | 'interaction' | 'opinion' | 'skill_note' | 'context';
        content: string;
        tags: string[];
        bead_id?: string;
      };

      const teamSlug = await resolveTeam(ctx.atelierDir, persona);
      const mm = new MemoryManager(ctx.atelierDir);

      await mm.store(persona, teamSlug, { type, content, tags, bead_id });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ stored: true, persona, type }, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_memory_search ---
  register(
    'atelier_memory_search',
    'Search a persona\'s memories by keyword query',
    z.object({
      persona: z.string().describe('Persona slug or name'),
      query: z.string().describe('Keyword search query'),
    }),
    async (args, ctx) => {
      const { persona, query } = args as {
        persona: string;
        query: string;
      };

      const teamSlug = await resolveTeam(ctx.atelierDir, persona);
      const mm = new MemoryManager(ctx.atelierDir);

      const entries = await mm.search(persona, teamSlug, query);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ entries, count: entries.length }, null, 2),
          },
        ],
      };
    },
  );
}
