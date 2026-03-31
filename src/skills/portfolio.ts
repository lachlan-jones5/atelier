import { SkillDimension } from '../util/types.js';
import { SkillTracker } from './index.js';
import { Portfolio, PortfolioBead } from './types.js';
import { BeadStore } from '../core/bead-store.js';

/**
 * Compile a portfolio from completed beads and skill scores.
 *
 * - Strongest areas = dimensions with the highest levels
 * - Growth areas = dimensions with the lowest levels
 */
export async function generatePortfolio(
  skillTracker: SkillTracker,
  beadStore: BeadStore,
): Promise<Portfolio> {
  const profile = skillTracker.getScores();

  // Gather completed beads
  const completedBeads = beadStore.list({ status: 'done' });

  const portfolioBeads: PortfolioBead[] = completedBeads.map((b) => ({
    id: b.id,
    title: b.title,
    type: b.type,
    skill_targets: b.skill_targets,
    review_verdict: b.review_feedback?.length
      ? b.review_feedback[b.review_feedback.length - 1]
      : undefined,
  }));

  // Build skill summary
  const dimensions = Object.keys(profile.dimensions) as SkillDimension[];
  const skillSummary = {} as Record<
    SkillDimension,
    { level: number; trend: string }
  >;
  for (const dim of dimensions) {
    const dl = profile.dimensions[dim];
    skillSummary[dim] = { level: dl.level, trend: dl.trend };
  }

  // Sort dimensions by level for strongest/growth
  const ranked = [...dimensions].sort(
    (a, b) => profile.dimensions[b].level - profile.dimensions[a].level,
  );

  const strongestAreas = ranked.slice(0, 3);
  const growthAreas = ranked.slice(-3).reverse();

  // Build review feedback summary
  const allFeedback = completedBeads.flatMap((b) => b.review_feedback ?? []);
  const reviewFeedbackSummary =
    allFeedback.length > 0
      ? `${allFeedback.length} review comments across ${completedBeads.length} completed beads.`
      : 'No review feedback yet.';

  return {
    completed_beads: portfolioBeads,
    skill_summary: skillSummary,
    strongest_areas: strongestAreas,
    growth_areas: growthAreas,
    total_beads_completed: completedBeads.length,
    review_feedback_summary: reviewFeedbackSummary,
  };
}
