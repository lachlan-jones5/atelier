import { z } from 'zod';
import type { registerTool as RegisterToolFn } from './index.js';
import { CurriculumManager } from '../curriculum/index.js';
import type { AtelierContext } from '../util/types.js';

function jsonContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerCurriculumTools(register: typeof RegisterToolFn) {
  // --- atelier_curriculum_list ---
  register(
    'atelier_curriculum_list',
    'List all available curriculum packs with their descriptions, target skills, and estimated hours',
    z.object({}),
    async (_args, ctx) => {
      const mgr = new CurriculumManager(ctx.atelierDir);
      const packs = await mgr.listAvailable();

      const summary = packs.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        target_skills: p.target_skills,
        experience_level: p.experience_level,
        estimated_hours: p.estimated_hours,
        sequences: p.sequences.length,
        total_beads: p.sequences.reduce(
          (sum, s) => sum + s.bead_templates.length,
          0,
        ),
      }));

      return jsonContent({ packs: summary, total: summary.length });
    },
  );

  // --- atelier_curriculum_start ---
  register(
    'atelier_curriculum_start',
    'Start a curriculum pack by ID. Creates an active curriculum session that tracks progress through sequences and bead templates.',
    z.object({
      pack_id: z.string().describe('ID of the curriculum pack to start'),
    }),
    async (args, ctx) => {
      const mgr = new CurriculumManager(ctx.atelierDir);
      const packId = args.pack_id as string;

      try {
        const state = await mgr.start(packId);
        const pack = (await mgr.listAvailable()).find(
          (p) => p.id === packId,
        );

        return jsonContent({
          message: `Started curriculum: ${pack?.title ?? packId}`,
          state,
          current_sequence: pack?.sequences[0]
            ? {
                id: pack.sequences[0].id,
                title: pack.sequences[0].title,
                description: pack.sequences[0].description,
                beads: pack.sequences[0].bead_templates.length,
              }
            : null,
        });
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // --- atelier_curriculum_progress ---
  register(
    'atelier_curriculum_progress',
    'Get current curriculum progress including active sequence, completed sequences, and current bead templates',
    z.object({}),
    async (_args, ctx) => {
      const mgr = new CurriculumManager(ctx.atelierDir);
      const state = await mgr.getState();

      if (!state) {
        return jsonContent({
          active: false,
          message:
            'No active curriculum. Use atelier_curriculum_list to see available packs.',
        });
      }

      const packs = await mgr.listAvailable();
      const pack = packs.find((p) => p.id === state.pack_id);
      const templates = await mgr.getCurrentBeadTemplates();

      const currentSeq = pack?.sequences[state.current_sequence];

      return jsonContent({
        active: state.status === 'active',
        pack: pack
          ? { id: pack.id, title: pack.title }
          : { id: state.pack_id },
        state,
        current_sequence: currentSeq
          ? {
              id: currentSeq.id,
              title: currentSeq.title,
              description: currentSeq.description,
              completion_criteria: currentSeq.completion_criteria,
            }
          : null,
        current_bead_templates: templates,
        progress: pack
          ? {
              sequences_completed: state.completed_sequences.length,
              sequences_total: pack.sequences.length,
              percent: Math.round(
                (state.completed_sequences.length / pack.sequences.length) *
                  100,
              ),
            }
          : null,
      });
    },
  );
}
