import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { runInit } from '../../src/cli/init.js';

describe('init flow', () => {
  const tempDirs: string[] = [];

  async function makeTempGitRepo(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'atelier-init-test-'));
    tempDirs.push(dir);
    // Initialize a git repo so runInit doesn't bail
    const proc = Bun.spawnSync(['git', 'init'], { cwd: dir });
    if (proc.exitCode !== 0) {
      throw new Error(`git init failed: ${proc.stderr.toString()}`);
    }
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('creates .atelier/ directory with correct subdirectories', async () => {
    const dir = await makeTempGitRepo();
    await runInit(dir);

    const atelierDir = join(dir, '.atelier');
    expect(existsSync(atelierDir)).toBe(true);
    expect(existsSync(join(atelierDir, 'teams'))).toBe(true);
    expect(existsSync(join(atelierDir, 'cross-team', 'beads'))).toBe(true);
    expect(existsSync(join(atelierDir, 'history'))).toBe(true);
    expect(existsSync(join(atelierDir, 'curriculum'))).toBe(true);
    expect(existsSync(join(atelierDir, 'incidents'))).toBe(true);
  });

  it('writes config.yaml with defaults', async () => {
    const dir = await makeTempGitRepo();
    await runInit(dir);

    const configPath = join(dir, '.atelier', 'config.yaml');
    expect(existsSync(configPath)).toBe(true);

    const content = await readFile(configPath, 'utf-8');
    const config = parse(content);
    expect(config.experience_level).toBe('journeyman');
    expect(config.flavor).toBe('');
    expect(config.progress).toBe(0.0);
    expect(config.persona_model).toBe('claude-opus-4-6');
  });

  it('writes state.json', async () => {
    const dir = await makeTempGitRepo();
    await runInit(dir);

    const statePath = join(dir, '.atelier', 'state.json');
    expect(existsSync(statePath)).toBe(true);

    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    expect(state.session).toBeDefined();
  });

  it('creates .mcp.json with atelier server entry', async () => {
    const dir = await makeTempGitRepo();
    await runInit(dir);

    const mcpPath = join(dir, '.mcp.json');
    expect(existsSync(mcpPath)).toBe(true);

    const content = await readFile(mcpPath, 'utf-8');
    const mcp = JSON.parse(content);
    expect(mcp.mcpServers).toBeDefined();
    expect(mcp.mcpServers.atelier).toBeDefined();
    expect(mcp.mcpServers.atelier.command).toBe('bun');
    expect(mcp.mcpServers.atelier.args).toBeArray();
    expect(mcp.mcpServers.atelier.env.ATELIER_PROJECT_ROOT).toBe(dir);
  });

  it('merges into existing .mcp.json without clobbering', async () => {
    const dir = await makeTempGitRepo();

    // Pre-populate an existing .mcp.json with another server
    const mcpPath = join(dir, '.mcp.json');
    await Bun.write(
      mcpPath,
      JSON.stringify({
        mcpServers: { other: { command: 'node', args: ['server.js'] } },
      }),
    );

    await runInit(dir);

    const content = await readFile(mcpPath, 'utf-8');
    const mcp = JSON.parse(content);
    expect(mcp.mcpServers.other).toBeDefined();
    expect(mcp.mcpServers.atelier).toBeDefined();
  });

  it('creates .claude/agents/atelier-init.md bootstrap agent', async () => {
    const dir = await makeTempGitRepo();
    await runInit(dir);

    const agentPath = join(dir, '.claude', 'agents', 'atelier-init.md');
    expect(existsSync(agentPath)).toBe(true);

    const content = await readFile(agentPath, 'utf-8');
    expect(content).toContain('Atelier Init Agent');
    expect(content).toContain('atelier_init_analyse');
    expect(content).toContain('tools:');
    expect(content).not.toContain('allowedTools');
  });

  it('does not overwrite existing config on re-init', async () => {
    const dir = await makeTempGitRepo();
    await runInit(dir);

    // Modify config to verify it is not overwritten
    const configPath = join(dir, '.atelier', 'config.yaml');
    await Bun.write(configPath, 'experience_level: master\nflavor: pirate\nprogress: 0.5\n');

    await runInit(dir);

    const content = await readFile(configPath, 'utf-8');
    const config = parse(content);
    expect(config.experience_level).toBe('master');
  });
});
