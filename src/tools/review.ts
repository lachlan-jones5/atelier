import { z } from 'zod';
import type { registerTool as RegisterToolFn } from './index.js';
import { ReviewManager } from '../review/index.js';
import { extractDiffContext } from '../review/diff-context.js';
import { PersonaRegistry } from '../core/persona-registry.js';
import type { AtelierContext } from '../util/types.js';
import type { ReviewComment, ReviewerFeedback } from '../review/types.js';

function jsonContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerReviewTools(register: typeof RegisterToolFn) {
  // 1. atelier_review_submit
  register(
    'atelier_review_submit',
    'Submit a bead for code review. Creates a review request, extracts diff context, and assigns reviewers from the team.',
    z.object({
      bead_id: z.string().describe('ID of the bead to review'),
      branch: z.string().describe('Git branch containing the changes'),
    }),
    async (args, ctx: AtelierContext) => {
      const beadId = args.bead_id as string;
      const branch = args.branch as string;

      // Load the bead to determine its team.
      const { BeadStore } = await import('../core/bead-store.js');
      const store = new BeadStore(ctx.atelierDir);
      await store.loadAll();
      const bead = store.getById(beadId);
      if (!bead) {
        throw new Error(`Bead not found: ${beadId}`);
      }

      const manager = new ReviewManager(ctx.atelierDir);
      const review = await manager.submit(beadId, branch, bead.team);

      // Extract diff context for the reviewers.
      let diffContext;
      try {
        diffContext = await extractDiffContext(ctx.projectRoot, branch);
      } catch {
        diffContext = null;
      }

      // Load reviewer persona info for the response.
      const registry = new PersonaRegistry(ctx.atelierDir);
      await registry.loadAll();
      const reviewerInfo = review.reviewers.map((slug) => {
        const persona = registry.getBySlug(slug);
        return persona
          ? {
              slug,
              name: persona.definition.name,
              archetype: persona.definition.archetype,
              review_style: persona.definition.review_style,
            }
          : { slug, name: slug, archetype: 'unknown', review_style: '' };
      });

      // Update bead status to in_review.
      await store.updateStatus(beadId, 'in_review');

      return jsonContent({ review, diffContext, reviewers: reviewerInfo });
    },
  );

  // 2. atelier_review_request
  register(
    'atelier_review_request',
    'Get the existing review for a bead, including all rounds of feedback.',
    z.object({
      bead_id: z.string().describe('Bead ID to look up the review for'),
    }),
    async (args, ctx: AtelierContext) => {
      const beadId = args.bead_id as string;
      const manager = new ReviewManager(ctx.atelierDir);
      const reviews = await manager.listReviews();
      const review = reviews.find((r) => r.bead_id === beadId);

      if (!review) {
        throw new Error(`No review found for bead: ${beadId}`);
      }

      return jsonContent({ review });
    },
  );

  // 3. atelier_review_feedback
  register(
    'atelier_review_feedback',
    'Add reviewer feedback to an existing review. Automatically updates review status based on verdicts.',
    z.object({
      review_id: z.string().describe('Review ID'),
      reviewer: z.string().describe('Persona slug of the reviewer'),
      comments: z
        .array(
          z.object({
            file: z.string().describe('File path the comment refers to'),
            line: z.number().optional().describe('Line number (optional)'),
            body: z.string().describe('Comment text'),
            severity: z
              .enum(['blocking', 'suggestion', 'nit'])
              .describe('Comment severity'),
          }),
        )
        .describe('Review comments'),
      verdict: z
        .enum(['approve', 'request_changes', 'comment'])
        .describe('Overall verdict'),
    }),
    async (args, ctx: AtelierContext) => {
      const reviewId = args.review_id as string;
      const reviewer = args.reviewer as string;
      const comments = args.comments as ReviewComment[];
      const verdict = args.verdict as ReviewerFeedback['verdict'];

      const feedback: ReviewerFeedback = { reviewer, comments, verdict };

      const manager = new ReviewManager(ctx.atelierDir);
      const review = await manager.addFeedback(reviewId, feedback);

      const blockingCount = comments.filter(
        (c) => c.severity === 'blocking',
      ).length;
      const suggestionCount = comments.filter(
        (c) => c.severity === 'suggestion',
      ).length;
      const nitCount = comments.filter((c) => c.severity === 'nit').length;

      return jsonContent({
        review,
        feedbackSummary: {
          reviewer,
          verdict,
          blocking: blockingCount,
          suggestions: suggestionCount,
          nits: nitCount,
          totalComments: comments.length,
        },
      });
    },
  );
}
