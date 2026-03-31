import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { getAtelierDir } from '../util/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The bootstrap agent markdown content.
 * This agent guides the user through interactive Atelier setup
 * and is deleted once agent generation is complete.
 */
function buildBootstrapAgent(mcpServerName: string): string {
  return `---
allowedTools:
  - mcp__${mcpServerName}__atelier_init_analyse
  - mcp__${mcpServerName}__atelier_init_generate_org
  - mcp__${mcpServerName}__atelier_init_save_org
  - mcp__${mcpServerName}__atelier_init_generate_team
  - mcp__${mcpServerName}__atelier_init_save_team
  - mcp__${mcpServerName}__atelier_init_generate_agents
  - mcp__${mcpServerName}__atelier_init_finalize
  - Read
  - Glob
  - Grep
---

# Atelier Init Agent

You are the Atelier initialization agent. Your job is to guide the user through setting up their fictional software organization that will inhabit their codebase.

## Setup Flow

Follow these steps in order. Be conversational and helpful. Explain what each step does before doing it.

### Step 1: Gather Preferences

Ask the user these questions (one at a time, be conversational):

1. **Experience level**: How would you describe your software engineering experience?
   - **Apprentice** — I'm just getting started, give me lots of guidance
   - **Journeyman** — I have some experience, a good mix of challenge and support
   - **Craftsperson** — I'm experienced, bring on the hard stuff
   - **Master** — I want maximum challenge and ambiguity

2. **Flavor** (optional): Do you have a creative direction for your organization's personality? For example: "a scrappy startup", "a government agency", "a pirate ship crew", "a group of wizards". Leave blank for a natural fit based on the codebase.

3. **Project description** (optional): Can you briefly describe what this project does? This helps create a more fitting organization. Leave blank and I'll infer it from the codebase analysis.

### Step 2: Analyse Codebase

Tell the user you're scanning their codebase, then call:
\`\`\`
atelier_init_analyse({})
\`\`\`

Share a brief summary of what was found (languages, frameworks, structure). This helps the user verify the analysis is correct.

### Step 3: Generate Organization

Call the org generation tool with the analysis summary and user preferences:
\`\`\`
atelier_init_generate_org({
  analysis_summary: "<summary from step 2>",
  flavor: "<user's flavor or omit>",
  project_description: "<user's description or omit>"
})
\`\`\`

This returns a prompt. Use that prompt's instructions to generate a complete organization JSON object, including:
- name, tagline, mission, culture, domain
- teams array with name, slug, domain, techStack, codebasePaths, teamSize

Present the organization to the user for approval. If they want changes, regenerate.

### Step 4: Save Organization

Once approved, save it:
\`\`\`
atelier_init_save_org({ org: <the org JSON> })
\`\`\`

### Step 5: Generate Teams and Personas

For each team in the organization, call:
\`\`\`
atelier_init_generate_team({
  team_slug: "<slug>",
  team_domain: "<domain>",
  tech_stack: ["<tech1>", "<tech2>"],
  org_name: "<org name>",
  org_culture: "<org culture>",
  experience_level: "<user's level>",
  flavor: "<flavor or omit>"
})
\`\`\`

This returns a PersonaGenerationPlan with prompts. For each prompt, generate a persona following the instructions, then collect all personas for the team.

Save each team:
\`\`\`
atelier_init_save_team({
  team: { name, slug, domain, techStack, codebasePaths },
  personas: [<persona objects>]
})
\`\`\`

Give the user a brief summary of each team and its members as you go.

### Step 6: Generate Agent Files

Once all teams and personas are saved:
\`\`\`
atelier_init_generate_agents({})
\`\`\`

This writes all the Claude Code agent files (.claude/agents/*.md) and removes this bootstrap agent.

### Step 7: Finalize

\`\`\`
atelier_init_finalize({})
\`\`\`

Tell the user setup is complete and they should switch to the main Atelier agent:

> Setup complete! Your organization is ready. Switch to \`/agent atelier\` to start working with your team.

## Guidelines

- Be enthusiastic but not over-the-top
- If the user seems confused, explain the concept of Atelier briefly: it creates a fictional software organization that inhabits your codebase, with team members who review code, assign work, and help you grow
- If a tool call fails, explain what went wrong and try to recover
- Never skip steps — each one builds on the previous
`;
}

/**
 * Run the full Atelier init sequence:
 * 1. Verify git repo
 * 2. Create .atelier/ directory structure
 * 3. Write default config.yaml
 * 4. Write/merge .mcp.json
 * 5. Write bootstrap agent
 * 6. Print instructions
 */
export async function runInit(projectRoot: string): Promise<void> {
  console.log('Initializing Atelier...');

  // Check we're in a git repo
  const gitDir = join(projectRoot, '.git');
  if (!existsSync(gitDir)) {
    console.error('Error: Not a git repository. Run "git init" first.');
    process.exit(1);
  }

  const atelierDir = getAtelierDir(projectRoot);

  // Create .atelier/ and subdirectories
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
  } else {
    console.log('  config.yaml already exists, skipping');
  }

  // Write initial state.json
  const statePath = join(atelierDir, 'state.json');
  if (!existsSync(statePath)) {
    const initialState = {
      session: {},
    };
    writeFileSync(statePath, JSON.stringify(initialState, null, 2) + '\n', 'utf-8');
    console.log('  Created .atelier/state.json');
  } else {
    console.log('  state.json already exists, skipping');
  }

  // Write/merge .mcp.json
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

  // Write bootstrap agent
  const agentsDir = join(projectRoot, '.claude', 'agents');
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }
  const bootstrapPath = join(agentsDir, 'atelier-init.md');
  writeFileSync(bootstrapPath, buildBootstrapAgent('atelier'), 'utf-8');
  console.log('  Created .claude/agents/atelier-init.md (bootstrap agent)');

  console.log();
  console.log('Setup started. Run /agent atelier-init in Claude Code to complete initialization.');
}
