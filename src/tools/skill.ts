import { z } from 'zod';
import { SkillTracker } from '../skills/index.js';
import { generatePortfolio } from '../skills/portfolio.js';
import { BeadStore } from '../core/bead-store.js';
import type { registerTool as RegisterToolFn } from './index.js';

const DIMENSION_VALUES = [
  'reading_code',
  'testing',
  'debugging',
  'design',
  'review',
  'communication',
  'ops_awareness',
] as const;

export function registerSkillTools(register: typeof RegisterToolFn) {
  // --- atelier_skill_summary ---
  register(
    'atelier_skill_summary',
    'Return the learner\'s current skill profile across all dimensions',
    z.object({}),
    async (_args, ctx) => {
      const tracker = new SkillTracker(ctx.atelierDir);
      await tracker.load();
      const profile = tracker.getScores();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(profile, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_skill_detail ---
  register(
    'atelier_skill_detail',
    'Return detailed skill data for a single dimension, including recent evidence',
    z.object({
      dimension: z
        .enum(DIMENSION_VALUES)
        .describe('The skill dimension to inspect'),
    }),
    async (args, ctx) => {
      const { dimension } = args as { dimension: (typeof DIMENSION_VALUES)[number] };

      const tracker = new SkillTracker(ctx.atelierDir);
      await tracker.load();
      const detail = tracker.getDimensionDetail(dimension);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(detail, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_skill_portfolio ---
  register(
    'atelier_skill_portfolio',
    'Generate a full portfolio of the learner\'s completed work and skill assessment',
    z.object({}),
    async (_args, ctx) => {
      const tracker = new SkillTracker(ctx.atelierDir);
      await tracker.load();

      const beadStore = new BeadStore(ctx.atelierDir);
      await beadStore.loadAll();

      const portfolio = await generatePortfolio(tracker, beadStore);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(portfolio, null, 2),
          },
        ],
      };
    },
  );
}
