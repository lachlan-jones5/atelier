import { z } from 'zod';
import { PersonaRegistry } from '../core/persona-registry.js';
import { appendChatLog, readChatLog } from '../util/chat-log.js';
import { getHistoryDir } from '../util/paths.js';
import { join } from 'node:path';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerPersonaTools(register: typeof RegisterToolFn) {
  // --- atelier_persona_get ---
  register(
    'atelier_persona_get',
    'Get the full definition and current state for a specific persona',
    z.object({
      slug: z.string().describe('Persona slug'),
    }),
    async (args, ctx) => {
      const { slug } = args as { slug: string };

      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();
      const persona = registry.getBySlug(slug);

      if (!persona) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Persona "${slug}" not found` }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              definition: persona.definition,
              state: persona.state,
            }),
          },
        ],
      };
    },
  );

  // --- atelier_persona_list ---
  register(
    'atelier_persona_list',
    'List all personas, optionally filtered by team',
    z.object({
      team: z.string().optional().describe('Filter by team slug'),
    }),
    async (args, ctx) => {
      const { team: teamSlug } = args as { team?: string };

      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();

      const personas = teamSlug
        ? registry.getByTeam(teamSlug)
        : registry.listAll();

      const summary = personas.map((p) => ({
        slug: p.definition.slug,
        name: p.definition.name,
        team: p.definition.team,
        role: p.definition.role,
        archetype: p.definition.archetype,
        seniority: p.definition.seniority,
        availability: p.definition.availability,
        mood: p.state.mood,
        currentBead: p.state.currentBead,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              personas: summary,
              count: summary.length,
              ...(teamSlug ? { team: teamSlug } : {}),
            }),
          },
        ],
      };
    },
  );

  // --- atelier_persona_dm ---
  register(
    'atelier_persona_dm',
    'Send a direct message to a persona. Logs the DM and returns persona context for response generation.',
    z.object({
      slug: z.string().describe('Persona slug'),
      message: z.string().describe('Direct message to send'),
    }),
    async (args, ctx) => {
      const { slug, message } = args as { slug: string; message: string };

      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();
      const persona = registry.getBySlug(slug);

      if (!persona) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Persona "${slug}" not found` }),
            },
          ],
          isError: true,
        };
      }

      // Log the DM to chat history
      await appendChatLog(ctx.atelierDir, {
        ts: new Date().toISOString(),
        channel: 'dm',
        to: slug,
        from: 'user',
        message,
      });

      // Gather recent DM history for this persona
      const chatFile = join(getHistoryDir(ctx.atelierDir), 'chat.jsonl');
      const allEntries = await readChatLog(chatFile, 100);
      const recentDMs = allEntries
        .filter((e: Record<string, unknown>) =>
          e.channel === 'dm' && (e.to === slug || e.from === slug))
        .slice(-10);

      // Build memory summary from state
      const memorySummary = {
        currentBead: persona.state.currentBead,
        beadsCompleted: persona.state.beadsCompleted.length,
        lastActiveAt: persona.state.lastActiveAt,
        mood: persona.state.mood,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              persona: {
                definition: persona.definition,
                memorySummary,
                state: persona.state,
              },
              message,
              recentDMs,
            }),
          },
        ],
      };
    },
  );
}
