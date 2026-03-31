import { z } from 'zod';
import type { registerTool as RegisterToolFn } from './index.js';
import { BeadStore } from '../core/bead-store.js';
import type { AtelierContext } from '../util/types.js';

function jsonContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function withStore<T>(
  ctx: AtelierContext,
  fn: (store: BeadStore) => Promise<T>,
): Promise<T> {
  const store = new BeadStore(ctx.atelierDir);
  await store.loadAll();
  return fn(store);
}

export function registerBeadTools(register: typeof RegisterToolFn) {
  // 1. atelier_bead_list
  register(
    'atelier_bead_list',
    'List beads with optional filtering by team, status, assigned_to, or type',
    z.object({
      team: z.string().optional().describe('Filter by team slug'),
      status: z.string().optional().describe('Filter by status'),
      assigned_to: z.string().optional().describe('Filter by assignee'),
      type: z.string().optional().describe('Filter by bead type'),
    }),
    async (args, ctx) => {
      return withStore(ctx, async (store) => {
        const beads = store.list({
          team: args.team as string | undefined,
          status: args.status as string | undefined,
          assigned_to: args.assigned_to as string | undefined,
          type: args.type as string | undefined,
        });
        return jsonContent({ beads, total: beads.length });
      });
    },
  );

  // 2. atelier_bead_detail
  register(
    'atelier_bead_detail',
    'Get full bead details including dependencies and dependents',
    z.object({
      id: z.string().describe('Bead ID'),
    }),
    async (args, ctx) => {
      return withStore(ctx, async (store) => {
        const bead = store.getById(args.id as string);
        if (!bead) {
          throw new Error(`Bead not found: ${args.id}`);
        }

        // Resolve dependency beads
        const dependencies = bead.depends_on
          .map((depId) => store.getById(depId))
          .filter((b): b is NonNullable<typeof b> => b != null);

        // Find beads that depend on this one
        const allBeads = store.list();
        const dependents = allBeads.filter((b) =>
          b.depends_on.includes(bead.id),
        );

        return jsonContent({ bead, dependencies, dependents });
      });
    },
  );

  // 3. atelier_bead_claim
  register(
    'atelier_bead_claim',
    'Claim a bead for the user',
    z.object({
      id: z.string().describe('Bead ID to claim'),
    }),
    async (args, ctx) => {
      return withStore(ctx, async (store) => {
        const bead = await store.claim(args.id as string);
        return jsonContent({
          bead,
          suggestedBranch: `feature/${bead.id}`,
        });
      });
    },
  );

  // 4. atelier_bead_create
  register(
    'atelier_bead_create',
    'Create a new bead',
    z.object({
      title: z.string().describe('Bead title'),
      description: z.string().describe('Bead description'),
      team: z.string().describe('Team slug or "cross-team"'),
      priority: z.string().describe('Priority: critical, high, medium, low'),
      type: z.string().describe('Type: feature, bugfix, refactor, test, docs, perf, infra'),
      depends_on: z.array(z.string()).optional().describe('IDs of beads this depends on'),
      acceptance_criteria: z.array(z.string()).describe('List of acceptance criteria'),
      skill_targets: z.array(z.string()).optional().describe('Skill dimensions targeted'),
    }),
    async (args, ctx) => {
      return withStore(ctx, async (store) => {
        const bead = await store.create({
          title: args.title as string,
          description: args.description as string,
          team: args.team as string,
          priority: args.priority as any,
          type: args.type as any,
          status: 'open',
          assigned_to: null,
          depends_on: (args.depends_on as string[] | undefined) ?? [],
          acceptance_criteria: args.acceptance_criteria as string[],
          skill_targets: (args.skill_targets as any[] | undefined) ?? [],
        });
        return jsonContent({ bead });
      });
    },
  );

  // 5. atelier_bead_update
  register(
    'atelier_bead_update',
    'Update bead status or assignment',
    z.object({
      id: z.string().describe('Bead ID to update'),
      status: z.string().optional().describe('New status'),
      assigned_to: z.string().optional().describe('New assignee'),
    }),
    async (args, ctx) => {
      return withStore(ctx, async (store) => {
        const id = args.id as string;
        const bead = store.getById(id);
        if (!bead) {
          throw new Error(`Bead not found: ${id}`);
        }

        // Apply assigned_to before any status update so a single save captures both
        if (args.assigned_to != null) {
          bead.assigned_to = args.assigned_to as string;
        }

        if (args.status != null) {
          // updateStatus sets status, marks dirty, recomputes dependents, and saves
          await store.updateStatus(id, args.status as any);
        } else if (args.assigned_to != null) {
          // No status change — use updateStatus with current status to mark dirty and save
          await store.updateStatus(id, bead.status);
        }

        return jsonContent({ bead });
      });
    },
  );
}
