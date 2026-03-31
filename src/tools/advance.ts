import { z } from 'zod';
import { SimulationClock } from '../simulation/clock.js';
import { AdvanceEngine } from '../simulation/advance-engine.js';
import { BeadStore } from '../core/bead-store.js';
import { PersonaRegistry } from '../core/persona-registry.js';
import { SessionManager } from '../core/session.js';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerAdvanceTools(register: typeof RegisterToolFn) {
  register(
    'atelier_advance',
    'Advance the simulation clock, resolving persona bead progress, generating events and chat messages. Returns the new time and all events that occurred.',
    z.object({
      days: z
        .number()
        .optional()
        .default(1)
        .describe(
          'Number of workdays to advance. Defaults to 1 (next morning).',
        ),
    }),
    async (args, ctx) => {
      const { days } = args as { days: number };

      // Load current session to get logical day
      const sessionMgr = new SessionManager();
      const session = await sessionMgr.load(ctx.atelierDir);

      // Initialize subsystems
      const clock = new SimulationClock(session.logicalDay, 9);
      const beadStore = new BeadStore(ctx.atelierDir);
      const personas = new PersonaRegistry(ctx.atelierDir);

      await beadStore.loadAll();
      await personas.loadAll();

      // Run the advance
      const engine = new AdvanceEngine(clock, beadStore, personas);
      const fromDay = session.logicalDay;
      const result = await engine.advance(days);

      // Persist updated session state
      session.logicalDay = result.newTime.logical_day;
      sessionMgr.logEvent({
        type: 'advance',
        data: {
          from_day: fromDay,
          to_day: result.newTime.logical_day,
          completed_beads: result.completedBeads,
          new_beads: result.newBeads,
          event_count: result.events.length,
        },
      });
      await sessionMgr.save(ctx.atelierDir);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                time: result.newTime,
                events: result.events,
                completedBeads: result.completedBeads,
                newBeads: result.newBeads,
                chatMessages: result.chatMessages,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
