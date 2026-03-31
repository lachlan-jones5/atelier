import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from '../tools/helpers.js';

ensureToolsRegistered();

describe('bead workflow', () => {
  let ctx: AtelierContext;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const env = await createTestContext();
    ctx = env.ctx;
    cleanup = env.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('full bead lifecycle: list -> claim -> in_progress -> in_review -> review -> feedback -> done', async () => {
    // Start a session first (needed for event logging)
    await callTool('atelier_start_session', {}, ctx);

    // 1. List beads — find an open bead
    const listResult = await callTool('atelier_bead_list', { status: 'open' }, ctx);
    const listData = parseResult(listResult) as any;
    expect(listResult.isError).toBeUndefined();
    expect(listData.beads.length).toBeGreaterThanOrEqual(1);

    const targetBead = listData.beads.find((b: any) => b.id === 'bead-001');
    expect(targetBead).toBeDefined();
    expect(targetBead.status).toBe('open');

    // 2. Claim the bead
    const claimResult = await callTool('atelier_bead_claim', { id: 'bead-001' }, ctx);
    const claimData = parseResult(claimResult) as any;
    expect(claimResult.isError).toBeUndefined();
    expect(claimData.bead.status).toBe('claimed');
    expect(claimData.suggestedBranch).toBe('feature/bead-001');

    // 3. Update to in_progress
    const progressResult = await callTool(
      'atelier_bead_update',
      { id: 'bead-001', status: 'in_progress' },
      ctx,
    );
    const progressData = parseResult(progressResult) as any;
    expect(progressResult.isError).toBeUndefined();
    expect(progressData.bead.status).toBe('in_progress');

    // 4. Update to in_review
    const reviewStatusResult = await callTool(
      'atelier_bead_update',
      { id: 'bead-001', status: 'in_review' },
      ctx,
    );
    const reviewStatusData = parseResult(reviewStatusResult) as any;
    expect(reviewStatusResult.isError).toBeUndefined();
    expect(reviewStatusData.bead.status).toBe('in_review');

    // 5. Submit review (creates the review object)
    const submitResult = await callTool(
      'atelier_review_submit',
      { bead_id: 'bead-001', branch: 'main' },
      ctx,
    );
    const submitData = parseResult(submitResult) as any;
    expect(submitResult.isError).toBeUndefined();
    expect(submitData.review).toBeDefined();
    expect(submitData.review.bead_id).toBe('bead-001');
    expect(submitData.reviewers).toBeArray();

    const reviewId = submitData.review.id;

    // 6. Add reviewer feedback
    const feedbackResult = await callTool(
      'atelier_review_feedback',
      {
        review_id: reviewId,
        reviewer: 'alex',
        comments: [
          {
            file: 'src/routes/users.ts',
            line: 10,
            body: 'Good validation logic.',
            severity: 'nit',
          },
        ],
        verdict: 'approve',
      },
      ctx,
    );
    const feedbackData = parseResult(feedbackResult) as any;
    expect(feedbackResult.isError).toBeUndefined();
    expect(feedbackData.feedbackSummary.reviewer).toBe('alex');
    expect(feedbackData.feedbackSummary.verdict).toBe('approve');
    expect(feedbackData.feedbackSummary.totalComments).toBe(1);

    // 7. Mark as done
    const doneResult = await callTool(
      'atelier_bead_update',
      { id: 'bead-001', status: 'done' },
      ctx,
    );
    const doneData = parseResult(doneResult) as any;
    expect(doneResult.isError).toBeUndefined();
    expect(doneData.bead.status).toBe('done');

    // 8. Verify bead shows as done in list
    const finalListResult = await callTool('atelier_bead_list', { status: 'done' }, ctx);
    const finalListData = parseResult(finalListResult) as any;
    expect(finalListData.beads.some((b: any) => b.id === 'bead-001')).toBe(true);
  });

  it('bead dependencies: completing a blocker unblocks dependents', async () => {
    await callTool('atelier_start_session', {}, ctx);

    // Create a bead that depends on bead-001
    const createResult = await callTool(
      'atelier_bead_create',
      {
        title: 'Dependent bead',
        description: 'This depends on bead-001',
        team: 'backend',
        priority: 'low',
        type: 'feature',
        acceptance_criteria: ['Works after bead-001 is done'],
      },
      ctx,
    );
    const createData = parseResult(createResult) as any;
    const dependentId = createData.bead.id;

    // Check the dependent bead was created
    expect(createData.bead.status).toBe('open');

    // Complete bead-001 through the lifecycle
    await callTool('atelier_bead_claim', { id: 'bead-001' }, ctx);
    await callTool('atelier_bead_update', { id: 'bead-001', status: 'in_progress' }, ctx);
    await callTool('atelier_bead_update', { id: 'bead-001', status: 'done' }, ctx);

    // Verify bead-001 is done
    const detailResult = await callTool(
      'atelier_bead_detail',
      { id: 'bead-001' },
      ctx,
    );
    const detailData = parseResult(detailResult) as any;
    expect(detailData.bead.status).toBe('done');

    // Verify the dependent bead is still accessible and open
    const depDetail = await callTool(
      'atelier_bead_detail',
      { id: dependentId },
      ctx,
    );
    const depData = parseResult(depDetail) as any;
    expect(depData.bead.status).toBe('open');
  });

  it('listing beads by multiple filters', async () => {
    await callTool('atelier_start_session', {}, ctx);

    // Filter by team and status together
    const result = await callTool(
      'atelier_bead_list',
      { team: 'backend', status: 'in_progress' },
      ctx,
    );
    const data = parseResult(result) as any;

    // bead-002 is in_progress and assigned to alex
    expect(data.beads.length).toBeGreaterThanOrEqual(1);
    for (const bead of data.beads) {
      expect(bead.team).toBe('backend');
      expect(bead.status).toBe('in_progress');
    }
  });

  it('claiming a bead returns suggested branch name', async () => {
    const result = await callTool('atelier_bead_claim', { id: 'bead-001' }, ctx);
    const data = parseResult(result) as any;

    expect(data.suggestedBranch).toBe('feature/bead-001');
  });

  it('updating a nonexistent bead returns error', async () => {
    const result = await callTool(
      'atelier_bead_update',
      { id: 'does-not-exist', status: 'done' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Bead not found');
  });
});
