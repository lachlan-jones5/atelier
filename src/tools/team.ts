import { z } from 'zod';
import { TeamManager } from '../core/team.js';
import { PersonaRegistry } from '../core/persona-registry.js';
import { appendChatLog, readChatLog } from '../util/chat-log.js';
import { getHistoryDir } from '../util/paths.js';
import { join } from 'node:path';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerTeamTools(register: typeof RegisterToolFn) {
  // --- atelier_team_list ---
  register(
    'atelier_team_list',
    'List all teams with a summary of each',
    z.object({}),
    async (_args, ctx) => {
      const teamMgr = new TeamManager();
      await teamMgr.loadAll(ctx.atelierDir);
      const teams = teamMgr.listTeams();

      const summary = teams.map((t) => ({
        slug: t.slug,
        name: t.name,
        domain: t.domain,
        personaCount: t.personas.length,
        techStack: t.techStack,
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ teams: summary, count: summary.length }),
          },
        ],
      };
    },
  );

  // --- atelier_team_status ---
  register(
    'atelier_team_status',
    'Get detailed status for a specific team including personas and active beads count',
    z.object({
      team: z.string().describe('Team slug'),
    }),
    async (args, ctx) => {
      const { team: teamSlug } = args as { team: string };

      const teamMgr = new TeamManager();
      await teamMgr.loadAll(ctx.atelierDir);
      const team = teamMgr.getTeam(teamSlug);

      if (!team) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Team "${teamSlug}" not found` }),
            },
          ],
          isError: true,
        };
      }

      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();
      const personas = registry.getByTeam(teamSlug);

      const activeBeads = personas.filter((p) => p.state.currentBead !== null).length;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              team: {
                slug: team.slug,
                name: team.name,
                domain: team.domain,
                techStack: team.techStack,
                codebasePaths: team.codebasePaths,
              },
              personas: personas.map((p) => ({
                slug: p.definition.slug,
                name: p.definition.name,
                role: p.definition.role,
                availability: p.definition.availability,
                currentBead: p.state.currentBead,
                mood: p.state.mood,
              })),
              activeBeads,
            }),
          },
        ],
      };
    },
  );

  // --- atelier_team_chat ---
  register(
    'atelier_team_chat',
    'Send a message to a team channel. Logs the message and determines which personas should respond.',
    z.object({
      team: z.string().describe('Team slug'),
      message: z.string().describe('Message to send to the team'),
    }),
    async (args, ctx) => {
      const { team: teamSlug, message } = args as { team: string; message: string };

      const teamMgr = new TeamManager();
      await teamMgr.loadAll(ctx.atelierDir);
      const team = teamMgr.getTeam(teamSlug);

      if (!team) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Team "${teamSlug}" not found` }),
            },
          ],
          isError: true,
        };
      }

      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();

      // Log the message to chat history
      await appendChatLog(ctx.atelierDir, {
        ts: new Date().toISOString(),
        channel: 'team',
        team: teamSlug,
        from: 'user',
        message,
      });

      // Determine responders
      const responders = registry.getRespondersForMessage(message, teamSlug);

      // Read recent chat context (last 20 lines)
      const chatFile = join(getHistoryDir(ctx.atelierDir), 'chat.jsonl');
      const recentContext = await readChatLog(chatFile, 20);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              team: teamSlug,
              message,
              responders: responders.map((p) => ({
                slug: p.definition.slug,
                name: p.definition.name,
                role: p.definition.role,
              })),
              recentContext,
            }),
          },
        ],
      };
    },
  );
}
