import { readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml, writeYaml } from '../util/yaml.js';
import { generateReviewId } from '../util/id.js';
import { getTeamsDir } from '../util/paths.js';
import type { ReviewStatus } from '../util/types.js';
import type { ReviewRequest, ReviewerFeedback } from './types.js';

/** Directory for reviews within a team. */
function getReviewsDir(atelierDir: string, teamSlug: string): string {
  return join(getTeamsDir(atelierDir), teamSlug, 'reviews');
}

export class ReviewManager {
  constructor(private atelierDir: string) {}

  /**
   * Submit a new review request for a bead on a given branch.
   * Assigns reviewers based on team composition and bead type.
   */
  async submit(
    beadId: string,
    branch: string,
    team: string,
    submittedBy: string = 'user',
  ): Promise<ReviewRequest> {
    const id = generateReviewId();
    const now = new Date().toISOString();

    // Load team personas to select reviewers.
    const reviewers = await this.selectReviewersForTeam(team);

    const review: ReviewRequest = {
      id,
      bead_id: beadId,
      submitted_by: submittedBy,
      branch,
      team,
      reviewers,
      status: 'pending',
      rounds: [],
      created_at: now,
      updated_at: now,
    };

    const dir = getReviewsDir(this.atelierDir, team);
    await mkdir(dir, { recursive: true });
    await writeYaml(join(dir, `${id}.yaml`), review);

    return review;
  }

  /**
   * Add a round of feedback to an existing review.
   * If the review has no rounds yet, creates round 1. Otherwise appends to the
   * latest open round, or starts a new round if the previous one was resolved.
   */
  async addFeedback(
    reviewId: string,
    feedback: ReviewerFeedback,
  ): Promise<ReviewRequest> {
    const review = await this.findReviewById(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const now = new Date().toISOString();
    const lastRound = review.data.rounds[review.data.rounds.length - 1];

    if (!lastRound || lastRound.resolved_at) {
      // Start a new round.
      review.data.rounds.push({
        round_number: (lastRound?.round_number ?? 0) + 1,
        feedback: [feedback],
        submitted_at: now,
      });
    } else {
      // Append to the existing open round.
      lastRound.feedback.push(feedback);
    }

    // Update status based on verdicts.
    // Consider only the latest feedback per reviewer (highest round number).
    const latestByReviewer = new Map<string, ReviewerFeedback>();
    for (const round of review.data.rounds) {
      for (const f of round.feedback) {
        latestByReviewer.set(f.reviewer, f);
      }
    }
    const latestFeedback = [...latestByReviewer.values()];
    const hasChangesRequested = latestFeedback.some(
      (f) => f.verdict === 'request_changes',
    );
    const allApproved =
      review.data.reviewers.length > 0 &&
      review.data.reviewers.every((slug) =>
        latestFeedback.some(
          (f) => f.reviewer === slug && f.verdict === 'approve',
        ),
      );

    if (allApproved) {
      review.data.status = 'approved';
    } else if (hasChangesRequested) {
      review.data.status = 'changes_requested';
    } else {
      review.data.status = 'in_review';
    }

    review.data.updated_at = now;
    await writeYaml(review.filePath, review.data);

    return review.data;
  }

  /** Get a review by ID. */
  async getReview(id: string): Promise<ReviewRequest | undefined> {
    const found = await this.findReviewById(id);
    return found?.data;
  }

  /** List reviews with optional team/status filter. */
  async listReviews(
    filter?: { team?: string; status?: string },
  ): Promise<ReviewRequest[]> {
    const results: ReviewRequest[] = [];
    const teamsDir = getTeamsDir(this.atelierDir);

    let teamDirs: string[];
    try {
      const dirents = await readdir(teamsDir, { withFileTypes: true });
      teamDirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return results;
    }

    // If filtering by team, only scan that team.
    if (filter?.team) {
      teamDirs = teamDirs.filter((d) => d === filter.team);
    }

    for (const teamSlug of teamDirs) {
      const reviewsDir = getReviewsDir(this.atelierDir, teamSlug);
      let files: string[];
      try {
        const dirents = await readdir(reviewsDir);
        files = dirents.filter(
          (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
        );
      } catch {
        continue;
      }

      for (const file of files) {
        try {
          const review = await readYaml<ReviewRequest>(
            join(reviewsDir, file),
          );
          if (filter?.status && review.status !== filter.status) continue;
          results.push(review);
        } catch {
          continue;
        }
      }
    }

    return results;
  }

  /** Update a review's status. */
  async updateStatus(
    id: string,
    status: ReviewStatus,
  ): Promise<ReviewRequest> {
    const found = await this.findReviewById(id);
    if (!found) {
      throw new Error(`Review not found: ${id}`);
    }

    found.data.status = status;
    found.data.updated_at = new Date().toISOString();
    await writeYaml(found.filePath, found.data);

    return found.data;
  }

  /**
   * Select 1-2 reviewers from a list of personas.
   * Prefers gatekeeper and craftsperson archetypes, then by expertise breadth.
   */
  selectReviewers(
    _team: string,
    personas: Array<{ slug: string; archetype: string; expertise: string[] }>,
  ): string[] {
    if (personas.length === 0) return [];

    // Preferred archetypes for code review.
    const preferredArchetypes = new Set(['gatekeeper', 'craftsperson']);

    const scored = personas.map((p) => {
      let score = 0;
      if (preferredArchetypes.has(p.archetype)) score += 10;
      // Broader expertise = better reviewer.
      score += p.expertise.length;
      return { slug: p.slug, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Pick 1-2 reviewers.
    const count = Math.min(2, scored.length);
    return scored.slice(0, count).map((s) => s.slug);
  }

  // --- Private helpers ---

  /**
   * Select reviewers for a team by loading persona YAML files.
   * Falls back to selectReviewers with loaded persona data.
   */
  private async selectReviewersForTeam(teamSlug: string): Promise<string[]> {
    const personasDir = join(
      getTeamsDir(this.atelierDir),
      teamSlug,
      'personas',
    );

    let files: string[];
    try {
      const dirents = await readdir(personasDir);
      files = dirents.filter(
        (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
      );
    } catch {
      return [];
    }

    const personas: Array<{
      slug: string;
      archetype: string;
      expertise: string[];
    }> = [];

    for (const file of files) {
      try {
        const raw = await readYaml<{
          slug?: string;
          archetype?: string;
          expertise?: string[];
        }>(join(personasDir, file));
        personas.push({
          slug: raw.slug ?? file.replace(/\.ya?ml$/, ''),
          archetype: raw.archetype ?? 'pragmatist',
          expertise: raw.expertise ?? [],
        });
      } catch {
        continue;
      }
    }

    return this.selectReviewers(teamSlug, personas);
  }

  /**
   * Search all teams for a review by ID.
   * Returns both the parsed data and the file path for writing back.
   */
  private async findReviewById(
    id: string,
  ): Promise<{ data: ReviewRequest; filePath: string } | undefined> {
    const teamsDir = getTeamsDir(this.atelierDir);

    let teamDirs: string[];
    try {
      const dirents = await readdir(teamsDir, { withFileTypes: true });
      teamDirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return undefined;
    }

    for (const teamSlug of teamDirs) {
      const filePath = join(
        getReviewsDir(this.atelierDir, teamSlug),
        `${id}.yaml`,
      );
      try {
        const data = await readYaml<ReviewRequest>(filePath);
        if (data.id === id) return { data, filePath };
      } catch {
        continue;
      }
    }

    return undefined;
  }
}
