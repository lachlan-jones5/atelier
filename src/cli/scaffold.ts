import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { getAtelierDir } from '../util/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The scaffold bootstrap agent markdown content.
 * Guides Claude Code through project generation using the atelier_scaffold_generate tool.
 */
function buildScaffoldAgent(mcpServerName: string): string {
  return `---
allowedTools:
  - mcp__${mcpServerName}__atelier_scaffold_generate
  - mcp__${mcpServerName}__atelier_init_analyse
  - mcp__${mcpServerName}__atelier_init_generate_org
  - mcp__${mcpServerName}__atelier_init_save_org
  - mcp__${mcpServerName}__atelier_init_generate_team
  - mcp__${mcpServerName}__atelier_init_save_team
  - mcp__${mcpServerName}__atelier_init_generate_agents
  - mcp__${mcpServerName}__atelier_init_finalize
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Atelier Scaffold Agent

You are the Atelier scaffold agent. Your job is to guide the user through creating a brand-new project from scratch, complete with generated code, git history, and a fictional software organization.

## Setup Flow

Follow these steps in order. Be conversational and helpful.

### Step 1: Gather Project Details

Ask the user these questions (one at a time, conversationally):

1. **Project description**: What kind of project do you want to create? Describe it in a sentence or two.

2. **Development stage**: How mature should the project appear? Use the progress slider:
   - **0.0** — Brand new, barely started
   - **0.1-0.2** — Early prototype, minimal code
   - **0.3-0.4** — Active development, forming patterns
   - **0.5-0.6** — Mid-development, established patterns
   - **0.7-0.8** — Mature, comprehensive tests and docs
   - **0.9** — Production-grade, deep history

3. **Experience level**: How would you describe your software engineering experience?
   - **Apprentice** — Just getting started, lots of guidance
   - **Journeyman** — Some experience, mix of challenge and support
   - **Craftsperson** — Experienced, bring on the hard stuff
   - **Master** — Maximum challenge and ambiguity

4. **Language**: What programming language? (TypeScript, Python, Rust, Go, etc.)

5. **Flavor** (optional): Any creative direction for the organization? (e.g. "a scrappy startup", "a pirate crew", "a wizard academy")

### Step 2: Generate Scaffold Plan

Call the scaffold tool with the gathered inputs:
\`\`\`
atelier_scaffold_generate({
  description: "<project description>",
  maturity: <0.0-0.9>,
  experience_level: "<level>",
  language: "<language>",
  flavor: "<flavor or omit>"
})
\`\`\`

Present the plan summary to the user for approval. Show:
- Project structure
- Code volume target
- Git history depth
- Bead distribution

### Step 3: Execute the Plan

Once approved, create the project:

1. **Create the directory structure** — Make all directories from the plan
2. **Write project files** — Create each file with realistic content matching the maturity level
3. **Set up build system** — Package manifest, config files, etc.
4. **Write initial code** — Generate source code proportional to the code volume target
5. **Add tests** — Matching the test coverage level in the plan
6. **Add documentation** — Matching the documentation level in the plan

Follow the generationPrompt from the plan for detailed guidance.

### Step 4: Generate Git History

Create realistic git history:
1. Stage and commit the initial project structure first
2. Build up commits incrementally to tell the project's evolution story
3. Use conventional commit messages
4. Target the commit count from the plan
5. Attribute commits to placeholder names (these will be updated after personas are generated)

Use \`git commit --author="Name <name@example.com>"\` for attribution.

### Step 5: Run Atelier Init Flow

Now run the standard init flow to populate the organization:

1. Call \`atelier_init_analyse\` to analyse the generated codebase
2. Call \`atelier_init_generate_org\` with the analysis and user preferences
3. Generate and present the organization, get approval
4. Call \`atelier_init_save_org\` to persist it
5. For each team, call \`atelier_init_generate_team\` then \`atelier_init_save_team\`
6. Call \`atelier_init_generate_agents\` to create agent files
7. Call \`atelier_init_finalize\` to complete setup

### Step 6: Finalize

Tell the user their scaffolded project is ready:

> Scaffold complete! Your project has been generated with ${'{'}commitCount{'}'} commits of history and a full Atelier organization.
> Switch to \`/agent atelier\` to start working with your team.

## Guidelines

- Be enthusiastic but grounded
- Show progress as you create files (brief summaries, not full content dumps)
- If a tool call fails, explain what went wrong and try to recover
- The generated code should be realistic and functional, not lorem ipsum
- Match the maturity level: a 0.1 project should look like an early prototype, a 0.8 project should look production-ready
- Never skip steps — each one builds on the previous
`;
}

/**
 * Run the Atelier scaffold sequence:
 * 1. Create or use project directory
 * 2. Initialize git repo
 * 3. Create .atelier/ directory structure
 * 4. Write .mcp.json
 * 5. Write scaffold bootstrap agent
 * 6. Print instructions
 */
export async function runScaffold(projectRoot: string): Promise<void> {
  console.log('Scaffolding new Atelier project...');

  // Initialize git repo if not already one
  const gitDir = join(projectRoot, '.git');
  if (!existsSync(gitDir)) {
    const { execSync } = await import('node:child_process');
    try {
      execSync('git init', { cwd: projectRoot, stdio: 'pipe' });
      console.log('  Initialized git repository');
    } catch (err) {
      console.error('Error: Failed to initialize git repository.');
      process.exit(1);
    }
  } else {
    console.log('  Git repository already exists');
  }

  const atelierDir = getAtelierDir(projectRoot);

  // Create .atelier/ and subdirectories (same as init)
  const subdirs = [
    '',
    'teams',
    join('cross-team', 'beads'),
    'history',
    'curriculum',
    'incidents',
  ];

  for (const sub of subdirs) {
    const dir = join(atelierDir, sub);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`  Created ${dir.replace(projectRoot + '/', '')}/`);
    }
  }

  // Write default config.yaml
  const configPath = join(atelierDir, 'config.yaml');
  if (!existsSync(configPath)) {
    const defaultConfig = {
      experience_level: 'journeyman',
      flavor: '',
      progress: 0.0,
    };
    writeFileSync(configPath, stringify(defaultConfig), 'utf-8');
    console.log('  Created .atelier/config.yaml');
  }

  // Write initial state.json
  const statePath = join(atelierDir, 'state.json');
  if (!existsSync(statePath)) {
    const initialState = {
      session: {},
    };
    writeFileSync(statePath, JSON.stringify(initialState, null, 2) + '\n', 'utf-8');
    console.log('  Created .atelier/state.json');
  }

  // Write .mcp.json
  const mcpJsonPath = join(projectRoot, '.mcp.json');
  const atelierSrcIndex = resolve(__dirname, '..', 'index.ts');
  const mcpEntry = {
    command: 'bun',
    args: ['run', atelierSrcIndex],
    env: {
      ATELIER_PROJECT_ROOT: projectRoot,
    },
  };

  let mcpConfig: Record<string, unknown>;
  if (existsSync(mcpJsonPath)) {
    try {
      const existing = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
      mcpConfig = existing;
      if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
        mcpConfig.mcpServers = {};
      }
    } catch {
      mcpConfig = { mcpServers: {} };
    }
  } else {
    mcpConfig = { mcpServers: {} };
  }

  (mcpConfig.mcpServers as Record<string, unknown>).atelier = mcpEntry;
  writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf-8');
  console.log('  Wrote .mcp.json (MCP server registration)');

  // Write scaffold bootstrap agent
  const agentsDir = join(projectRoot, '.claude', 'agents');
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }
  const scaffoldAgentPath = join(agentsDir, 'atelier-scaffold.md');
  writeFileSync(scaffoldAgentPath, buildScaffoldAgent('atelier'), 'utf-8');
  console.log('  Created .claude/agents/atelier-scaffold.md (scaffold agent)');

  console.log();
  console.log('Run /agent atelier-scaffold in Claude Code to generate your project');
}
