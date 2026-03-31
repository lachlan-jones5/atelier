import { z } from 'zod';
import { SessionManager } from '../core/session.js';
import { OrganizationManager } from '../core/organization.js';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerSessionTools(register: typeof RegisterToolFn) {
  // --- atelier_status ---
  register(
    'atelier_status',
    'Get current Atelier session status including session and organization info',
    z.object({
      verbose: z.boolean().optional().describe('Include full event list'),
    }),
    async (args, ctx) => {
      const verbose = (args as { verbose?: boolean }).verbose ?? false;

      const sessionMgr = new SessionManager();
      const orgMgr = new OrganizationManager();

      let session: {
        id: string;
        day: number;
        active: boolean;
      } | null = null;
      let recentEvents: unknown[] = [];

      const configExists = await Bun.file(
        ctx.atelierDir + '/config.yaml',
      ).exists();
      const stateExists = await Bun.file(
        ctx.atelierDir + '/state.json',
      ).exists();

      if (stateExists) {
        const state = await sessionMgr.load(ctx.atelierDir);
        session = {
          id: state.sessionId,
          day: state.logicalDay,
          active: true,
        };
        recentEvents = verbose
          ? state.events
          : state.events.slice(-5);
      }

      const org = await orgMgr.load(ctx.atelierDir);
      const orgInfo = org
        ? { name: org.name, teams: org.teams }
        : null;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              initialized: configExists,
              session,
              org: orgInfo,
              recentEvents,
            }),
          },
        ],
      };
    },
  );

  // --- atelier_start_session ---
  register(
    'atelier_start_session',
    'Begin or resume an Atelier session',
    z.object({}),
    async (_args, ctx) => {
      const sessionMgr = new SessionManager();
      const orgMgr = new OrganizationManager();

      const stateExists = await Bun.file(
        ctx.atelierDir + '/state.json',
      ).exists();

      const state = await sessionMgr.load(ctx.atelierDir);
      const org = await orgMgr.load(ctx.atelierDir);

      const isResume = stateExists;
      const message = isResume
        ? 'Welcome back'
        : 'New session started';

      // Persist immediately so state.json exists for future calls
      await sessionMgr.save(ctx.atelierDir);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              session: {
                id: state.sessionId,
                day: state.logicalDay,
                startedAt: state.startedAt,
                lastActiveAt: state.lastActiveAt,
              },
              org: org
                ? { name: org.name, teams: org.teams }
                : null,
              message,
            }),
          },
        ],
      };
    },
  );

  // --- atelier_end_session ---
  register(
    'atelier_end_session',
    'End the current Atelier session and save state',
    z.object({}),
    async (_args, ctx) => {
      const sessionMgr = new SessionManager();

      const stateExists = await Bun.file(
        ctx.atelierDir + '/state.json',
      ).exists();
      if (!stateExists) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                summary: 'No active session to end',
                eventsLogged: 0,
              }),
            },
          ],
          isError: true,
        };
      }

      const state = await sessionMgr.load(ctx.atelierDir);
      const eventsLogged = state.events.length;

      // Log the session-end event before saving
      sessionMgr.logEvent({
        type: 'chat',
        data: { action: 'session_end' },
      });

      await sessionMgr.save(ctx.atelierDir);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              summary: `Session ${state.sessionId} ended (day ${state.logicalDay})`,
              eventsLogged: eventsLogged + 1, // includes the session_end event
            }),
          },
        ],
      };
    },
  );
}
