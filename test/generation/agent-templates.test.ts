import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AgentTemplateEngine,
  type AgentTemplateContext,
} from '../../src/generation/agent-templates.js';
import type { Organization } from '../../src/core/organization.js';
import type { Team } from '../../src/core/team.js';
import type { Persona } from '../../src/core/persona.js';

function createMockOrg(): Organization {
  return {
    name: 'Test Org',
    tagline: 'Building great things',
    mission: 'Ship quality software',
    culture: 'Collaborative and pragmatic',
    domain: 'web',
    teams: ['backend'],
  };
}

function createMockTeam(): Team {
  return {
    name: 'Backend',
    slug: 'backend',
    domain: 'API development',
    techStack: ['TypeScript', 'Node.js'],
    codebasePaths: ['src/api/', 'src/services/'],
    personas: ['test-person'],
  };
}

function createMockPersona(): Persona {
  return {
    name: 'Test Person',
    slug: 'test-person',
    role: 'Engineer',
    seniority: 'mid',
    archetype: 'pragmatist',
    expertise: ['TypeScript', 'REST APIs'],
    communication_style: 'direct and concise',
    review_style: 'thorough',
    helpfulness: 0.8,
    availability: 'always',
    opinions: ['tests matter', 'keep it simple'],
    quirks: ['drinks too much coffee'],
    backstory: 'Joined the team 2 years ago after a stint at a startup.',
    team: 'backend',
  };
}

function createMockContext(overrides?: Partial<AgentTemplateContext>): AgentTemplateContext {
  const org = createMockOrg();
  const team = createMockTeam();
  const persona = createMockPersona();

  return {
    org,
    team,
    persona,
    allTeams: [team],
    allPersonas: [persona],
    teamPersonas: [persona],
    otherTeams: [],
    mcpServerName: 'atelier',
    personaModel: 'claude-opus-4-6',
    mcpServerCommand: 'bun',
    mcpServerArgsJson: '["run", "/tmp/test/src/index.ts"]',
    projectRoot: '/tmp/test',
    ...overrides,
  };
}

describe('AgentTemplateEngine', () => {
  let engine: AgentTemplateEngine;

  async function loadEngine(): Promise<AgentTemplateEngine> {
    if (!engine) {
      engine = new AgentTemplateEngine();
      await engine.loadTemplates();
    }
    return engine;
  }

  // ----- Template rendering tests -----

  describe('persona-dm template', () => {
    it('renders correct frontmatter with human name', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('persona-dm', ctx);

      expect(output).toContain('name: "Test Person"');
    });

    it('renders model field', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('persona-dm', ctx);

      expect(output).toContain('model: claude-opus-4-6');
    });

    it('renders tools (not allowedTools)', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('persona-dm', ctx);

      expect(output).toContain('- Read');
      expect(output).toContain('- Grep');
      expect(output).toContain('- Glob');
      expect(output).toContain('- mcp__atelier__atelier_persona_get');
      expect(output).toContain('- mcp__atelier__atelier_memory_recall');
      expect(output).toContain('- mcp__atelier__atelier_memory_store');
      expect(output).not.toContain('allowedTools');
    });

    it('renders mcpServers block', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('persona-dm', ctx);

      expect(output).toContain('mcpServers:');
      expect(output).toContain('atelier:');
      expect(output).toContain('command: "bun"');
    });

    it('does not contain /agent command syntax', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('persona-dm', ctx);

      expect(output).not.toContain('/agent ');
    });

    it('escapes double quotes in persona names in YAML frontmatter', async () => {
      const eng = await loadEngine();
      const persona = createMockPersona();
      persona.name = 'Sarah "Sal" Johnson';
      const ctx = createMockContext({ persona, allPersonas: [persona] });
      const output = eng.render('persona-dm', ctx);

      // Frontmatter name field should have escaped quotes
      expect(output).toContain('name: "Sarah \\"Sal\\" Johnson"');
      // Description field should also have escaped quotes
      expect(output).toContain('DM Sarah \\"Sal\\" Johnson');
    });

    it('does not escape double quotes outside YAML frontmatter', async () => {
      const eng = await loadEngine();
      const persona = createMockPersona();
      persona.name = 'Sarah "Sal" Johnson';
      const ctx = createMockContext({ persona, allPersonas: [persona] });
      const output = eng.render('persona-dm', ctx);

      // In the markdown body, the name should appear unescaped
      const body = output.split('---').slice(2).join('---');
      expect(body).toContain('Sarah "Sal" Johnson');
    });
  });

  describe('review-agent template', () => {
    it('renders correct name', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('review-agent', ctx);

      expect(output).toContain('name: atelier-review');
    });

    it('renders model field', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('review-agent', ctx);

      expect(output).toContain('model: claude-opus-4-6');
    });

    it('renders tools with Bash and MCP tools but without Agent', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('review-agent', ctx);

      expect(output).toContain('- Read');
      expect(output).toContain('- Grep');
      expect(output).toContain('- Glob');
      expect(output).toContain('- Bash');
      expect(output).toContain('- mcp__atelier__atelier_persona_get');
      expect(output).toContain('- mcp__atelier__atelier_review_submit');
      expect(output).toContain('- mcp__atelier__atelier_review_request');
      expect(output).toContain('- mcp__atelier__atelier_review_feedback');
      expect(output).toContain('- mcp__atelier__atelier_team_list');
      // Agent should not be in the tools list
      expect(output).not.toContain('- Agent');
    });

    it('does not contain allowedTools', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('review-agent', ctx);

      expect(output).not.toContain('allowedTools');
    });
  });

  describe('session-context template', () => {
    it('renders ATELIER context markers', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('session-context', ctx);

      expect(output).toContain('<!-- BEGIN ATELIER CONTEXT -->');
      expect(output).toContain('<!-- END ATELIER CONTEXT -->');
    });

    it('contains org name', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('session-context', ctx);

      expect(output).toContain('Test Org');
    });

    it('contains persona names with @"name" syntax', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('session-context', ctx);

      expect(output).toContain('Test Person');
      expect(output).toContain('@"Test Person"');
    });

    it('does not contain YAML frontmatter', async () => {
      const eng = await loadEngine();
      const ctx = createMockContext();
      const output = eng.render('session-context', ctx);

      // session-context is injected into CLAUDE.md, not a standalone agent file
      // so it should not have --- frontmatter delimiters
      const lines = output.split('\n');
      const dashLines = lines.filter((l) => l.trim() === '---');
      // The template may have horizontal rules, but should not start with ---
      expect(lines[0].trim()).not.toBe('---');
    });
  });

  // ----- generateAll() tests -----

  describe('generateAll', () => {
    const tempDirs: string[] = [];

    async function makeTempDir(): Promise<string> {
      const dir = await mkdtemp(join(tmpdir(), 'atelier-gen-test-'));
      tempDirs.push(dir);
      return dir;
    }

    afterEach(async () => {
      for (const dir of tempDirs) {
        await rm(dir, { recursive: true, force: true });
      }
      tempDirs.length = 0;
    });

    it('produces persona, review, and CLAUDE.md files', async () => {
      const eng = await loadEngine();
      const dir = await makeTempDir();
      const ctx = createMockContext({ projectRoot: dir });

      const result = await eng.generateAll(dir, ctx);

      // Persona agent file
      const personaPath = join(dir, '.claude', 'agents', 'test-person.md');
      expect(existsSync(personaPath)).toBe(true);

      // Review agent file
      const reviewPath = join(dir, '.claude', 'agents', 'atelier-review.md');
      expect(existsSync(reviewPath)).toBe(true);

      // CLAUDE.md
      const claudePath = join(dir, '.claude', 'CLAUDE.md');
      expect(existsSync(claudePath)).toBe(true);
      const claudeContent = await readFile(claudePath, 'utf-8');
      expect(claudeContent).toContain('<!-- BEGIN ATELIER CONTEXT -->');
      expect(claudeContent).toContain('<!-- END ATELIER CONTEXT -->');

      // No orchestrator files should exist
      expect(existsSync(join(dir, '.claude', 'agents', 'atelier.md'))).toBe(false);
      // Team slug file should not exist (cleanup removes them)
      expect(existsSync(join(dir, '.claude', 'agents', 'backend.md'))).toBe(false);

      // Result should list all generated files
      expect(result.generated).toContain(personaPath);
      expect(result.generated).toContain(reviewPath);
      expect(result.generated).toContain(claudePath);
    });

    it('cleans up old orchestrator files', async () => {
      const eng = await loadEngine();
      const dir = await makeTempDir();
      const ctx = createMockContext({ projectRoot: dir });
      const agentsDir = join(dir, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });

      // Pre-create old orchestrator files
      const oldOrgPath = join(agentsDir, 'atelier.md');
      const oldTeamPath = join(agentsDir, 'backend.md');
      await writeFile(oldOrgPath, '# Old org orchestrator', 'utf-8');
      await writeFile(oldTeamPath, '# Old team orchestrator', 'utf-8');

      expect(existsSync(oldOrgPath)).toBe(true);
      expect(existsSync(oldTeamPath)).toBe(true);

      await eng.generateAll(dir, ctx);

      // Both old orchestrator files should be deleted
      expect(existsSync(oldOrgPath)).toBe(false);
      expect(existsSync(oldTeamPath)).toBe(false);
    });

    it('updates CLAUDE.md idempotently preserving surrounding content', async () => {
      const eng = await loadEngine();
      const dir = await makeTempDir();
      const ctx = createMockContext({ projectRoot: dir });
      const claudeDir = join(dir, '.claude');
      await mkdir(claudeDir, { recursive: true });
      const claudePath = join(claudeDir, 'CLAUDE.md');

      // Write initial CLAUDE.md with markers and surrounding content
      const existingContent = [
        '# My Project Notes',
        '',
        'Some important stuff here.',
        '',
        '<!-- BEGIN ATELIER CONTEXT -->',
        'Old atelier content that should be replaced.',
        '<!-- END ATELIER CONTEXT -->',
        '',
        '# More content below',
        'This should also be preserved.',
      ].join('\n');
      await writeFile(claudePath, existingContent, 'utf-8');

      await eng.generateAll(dir, ctx);

      const updatedContent = await readFile(claudePath, 'utf-8');

      // Content before markers is preserved
      expect(updatedContent).toContain('# My Project Notes');
      expect(updatedContent).toContain('Some important stuff here.');

      // Content after markers is preserved
      expect(updatedContent).toContain('# More content below');
      expect(updatedContent).toContain('This should also be preserved.');

      // Old content between markers is replaced
      expect(updatedContent).not.toContain('Old atelier content that should be replaced.');

      // New content is present
      expect(updatedContent).toContain('<!-- BEGIN ATELIER CONTEXT -->');
      expect(updatedContent).toContain('<!-- END ATELIER CONTEXT -->');
      expect(updatedContent).toContain('Test Org');
    });

    it('appends to existing CLAUDE.md without markers', async () => {
      const eng = await loadEngine();
      const dir = await makeTempDir();
      const ctx = createMockContext({ projectRoot: dir });
      const claudeDir = join(dir, '.claude');
      await mkdir(claudeDir, { recursive: true });
      const claudePath = join(claudeDir, 'CLAUDE.md');

      // Write CLAUDE.md without markers
      await writeFile(claudePath, '# Existing content\n\nKeep this.\n', 'utf-8');

      await eng.generateAll(dir, ctx);

      const content = await readFile(claudePath, 'utf-8');
      expect(content).toContain('# Existing content');
      expect(content).toContain('Keep this.');
      expect(content).toContain('<!-- BEGIN ATELIER CONTEXT -->');
    });
  });
});

// ----- Config default test (in init-flow context) -----

describe('config defaults', () => {
  const tempDirs: string[] = [];

  async function makeTempGitRepo(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'atelier-config-test-'));
    tempDirs.push(dir);
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

  it('config.yaml defaults include persona_model set to claude-opus-4-6', async () => {
    const { runInit } = await import('../../src/cli/init.js');
    const { parse } = await import('yaml');

    const dir = await makeTempGitRepo();
    await runInit(dir);

    const configPath = join(dir, '.atelier', 'config.yaml');
    const content = await readFile(configPath, 'utf-8');
    const config = parse(content);

    expect(config.persona_model).toBe('claude-opus-4-6');
  });
});
