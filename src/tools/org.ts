import { z } from 'zod';
import { OrganizationManager } from '../core/organization.js';
import { TeamManager } from '../core/team.js';
import { PersonaRegistry } from '../core/persona-registry.js';
import { appendChatLog } from '../util/chat-log.js';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerOrgTools(register: typeof RegisterToolFn) {
  // --- atelier_org_status ---
  register(
    'atelier_org_status',
    'Get organization-level status including all teams, cross-team dependencies, and summary',
    z.object({}),
    async (_args, ctx) => {
      const orgMgr = new OrganizationManager();
      const org = await orgMgr.load(ctx.atelierDir);

      if (!org) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Organization not configured' }),
            },
          ],
          isError: true,
        };
      }

      const teamMgr = new TeamManager();
      try {
        await teamMgr.loadAll(ctx.atelierDir);
      } catch {
        // Teams may not exist yet
      }
      const teams = teamMgr.listTeams();

      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();
      const allPersonas = registry.listAll();

      // Build per-team summaries
      const teamSummaries = teams.map((t) => {
        const teamPersonas = registry.getByTeam(t.slug);
        const activeBeads = teamPersonas.filter((p) => p.state.currentBead !== null).length;
        return {
          slug: t.slug,
          name: t.name,
          domain: t.domain,
          personaCount: teamPersonas.length,
          activeBeads,
        };
      });

      // Cross-team dependencies: personas working on beads from other teams
      const crossTeamDeps: Array<{
        persona: string;
        personaTeam: string;
        bead: string;
      }> = [];
      // Note: full cross-team dependency tracking requires bead metadata.
      // For now, report personas with active beads as potential cross-team items.

      const status = orgMgr.getStatus();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              org: {
                name: org.name,
                tagline: org.tagline,
                mission: org.mission,
                domain: org.domain,
              },
              teams: teamSummaries,
              totalPersonas: allPersonas.length,
              activePersonas: allPersonas.filter(
                (p) => p.definition.availability !== 'heads_down',
              ).length,
              crossTeamDeps,
              summary: {
                teamCount: status.teamCount,
                totalBeads: status.totalBeads,
                activeIncident: status.activeIncident,
              },
            }),
          },
        ],
      };
    },
  );

  // --- atelier_org_announce ---
  register(
    'atelier_org_announce',
    'Broadcast an organization-wide announcement to all teams. Logged to chat history.',
    z.object({
      message: z.string().describe('Announcement message'),
    }),
    async (args, ctx) => {
      const { message } = args as { message: string };

      const orgMgr = new OrganizationManager();
      const org = await orgMgr.load(ctx.atelierDir);

      if (!org) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Organization not configured' }),
            },
          ],
          isError: true,
        };
      }

      // Log the announcement
      await appendChatLog(ctx.atelierDir, {
        ts: new Date().toISOString(),
        channel: 'org',
        from: 'user',
        message,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              announced: true,
              org: org.name,
              teams: org.teams,
              message,
            }),
          },
        ],
      };
    },
  );
}
