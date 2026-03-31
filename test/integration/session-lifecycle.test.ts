import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AtelierContext } from '../../src/util/types.js';
import {
  createTestContext,
  ensureToolsRegistered,
  parseResult,
  callTool,
} from '../tools/helpers.js';

ensureToolsRegistered();

describe('session lifecycle', () => {
  let ctx: AtelierContext;
  let tmpDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const env = await createTestContext();
    ctx = env.ctx;
    tmpDir = env.tmpDir;
    cleanup = env.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('full lifecycle: start -> chat -> claim -> advance -> end -> resume', async () => {
    // 1. Start session (resumes from fixture)
    const startResult = await callTool('atelier_start_session', {}, ctx);
    const startData = parseResult(startResult) as any;
    expect(startResult.isError).toBeUndefined();
    expect(startData.session).toBeDefined();
    expect(startData.session.id).toBe('sess-test-001');
    expect(startData.session.day).toBe(1);

    // 2. Team chat — verify responders returned
    const chatResult = await callTool(
      'atelier_team_chat',
      { team: 'backend', message: 'Hey team, what should I work on next?' },
      ctx,
    );
    const chatData = parseResult(chatResult) as any;
    expect(chatResult.isError).toBeUndefined();
    expect(chatData.team).toBe('backend');
    expect(chatData.responders).toBeArray();
    expect(chatData.responders.length).toBeGreaterThanOrEqual(1);

    // 3. Claim an open bead
    const claimResult = await callTool(
      'atelier_bead_claim',
      { id: 'bead-001' },
      ctx,
    );
    const claimData = parseResult(claimResult) as any;
    expect(claimResult.isError).toBeUndefined();
    expect(claimData.bead.id).toBe('bead-001');
    expect(claimData.bead.status).toBe('claimed');

    // 4. Advance — verify time progressed and events generated
    const advanceResult = await callTool('atelier_advance', { days: 1 }, ctx);
    const advanceData = parseResult(advanceResult) as any;
    expect(advanceResult.isError).toBeUndefined();
    expect(advanceData.time).toBeDefined();
    expect(advanceData.time.logical_day).toBeGreaterThanOrEqual(2);
    expect(advanceData.events).toBeArray();

    // 5. End session — verify state persisted
    const endResult = await callTool('atelier_end_session', {}, ctx);
    const endData = parseResult(endResult) as any;
    expect(endResult.isError).toBeUndefined();
    expect(endData.summary).toContain('ended');
    expect(endData.eventsLogged).toBeGreaterThanOrEqual(1);

    // Verify state.json was written to disk
    const stateOnDisk = JSON.parse(
      await readFile(join(ctx.atelierDir, 'state.json'), 'utf-8'),
    );
    expect(stateOnDisk.sessionId).toBeDefined();

    // 6. Resume — create a new context pointing to same dir, start session again
    const ctx2: AtelierContext = {
      projectRoot: tmpDir,
      atelierDir: ctx.atelierDir,
    };
    const resumeResult = await callTool('atelier_start_session', {}, ctx2);
    const resumeData = parseResult(resumeResult) as any;
    expect(resumeResult.isError).toBeUndefined();
    expect(resumeData.message).toBe('Welcome back');
    expect(resumeData.session.id).toBeDefined();
  });

  it('starting a session includes org info', async () => {
    const result = await callTool('atelier_start_session', {}, ctx);
    const data = parseResult(result) as any;

    expect(data.org).toBeDefined();
    expect(data.org.name).toBe('TestOrg');
    expect(data.org.teams).toContain('backend');
  });

  it('chat message is logged to history', async () => {
    await callTool('atelier_start_session', {}, ctx);

    await callTool(
      'atelier_team_chat',
      { team: 'backend', message: 'Testing history logging' },
      ctx,
    );

    const chatPath = join(ctx.atelierDir, 'history', 'chat.jsonl');
    const content = await readFile(chatPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    expect(lastEntry.from).toBe('user');
    expect(lastEntry.message).toBe('Testing history logging');
    expect(lastEntry.team).toBe('backend');
  });
});
