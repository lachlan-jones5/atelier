import { z } from 'zod';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import type { registerTool as RegisterToolFn } from './index.js';
import { analyseCodebase } from '../analysis/index.js';
import { buildOrgGenerationPrompt, validateOrgOutput } from '../generation/org-generator.js';
import { planPersonaGeneration } from '../generation/persona-generator.js';
import { validateTeamOutput } from '../generation/team-generator.js';
import { AgentTemplateEngine } from '../generation/agent-templates.js';
import { OrganizationManager } from '../core/organization.js';
import { TeamManager } from '../core/team.js';
import { getTeamDir, getPersonasDir, getAgentsDir, validateSlug } from '../util/paths.js';
import { writeYaml, readYaml } from '../util/yaml.js';
import type { Organization } from '../core/organization.js';
import type { Team } from '../core/team.js';
import type { Persona } from '../core/persona.js';
import type { ExperienceLevel } from '../util/types.js';

export function registerInitTools(register: typeof RegisterToolFn) {
  // --- atelier_init_analyse ---
  register(
    'atelier_init_analyse',
    'Analyse the codebase and return a CodebaseAnalysis JSON object. Run this first during init to understand the project structure, languages, frameworks, and suggest team decomposition.',
    z.object({}),
    async (_args, ctx) => {
      const analysis = await analyseCodebase(ctx.projectRoot);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_init_generate_org ---
  register(
    'atelier_init_generate_org',
    'Generate an OrgGenerationPrompt from the codebase analysis. Returns system prompt, user prompt, and output schema that the agent should use to generate the organization JSON.',
    z.object({
      analysis_summary: z.string().describe('JSON string of the CodebaseAnalysis from atelier_init_analyse'),
      flavor: z.string().optional().describe('Creative direction for the organization personality'),
      project_description: z.string().optional().describe('Brief description of what the project does'),
    }),
    async (args, _ctx) => {
      const { analysis_summary, flavor, project_description } = args as {
        analysis_summary: string;
        flavor?: string;
        project_description?: string;
      };

      let analysis;
      try {
        analysis = JSON.parse(analysis_summary);
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'Error: analysis_summary must be valid JSON' }],
          isError: true,
        };
      }

      const prompt = buildOrgGenerationPrompt({
        analysis,
        flavor,
        projectDescription: project_description,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(prompt, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_init_save_org ---
  register(
    'atelier_init_save_org',
    'Validate and save the generated organization to .atelier/org.yaml. The org object must match the Organization schema (name, tagline, mission, culture, domain, teams array).',
    z.object({
      org: z.object({
        name: z.string(),
        tagline: z.string(),
        mission: z.string(),
        culture: z.string(),
        domain: z.string(),
        teams: z.array(z.object({
          name: z.string(),
          slug: z.string(),
          domain: z.string(),
          techStack: z.array(z.string()),
          codebasePaths: z.array(z.string()),
          teamSize: z.number(),
        })),
      }).describe('The organization object to validate and save'),
    }),
    async (args, ctx) => {
      const { org: rawOrg } = args as { org: Record<string, unknown> };

      try {
        const validated = validateOrgOutput(rawOrg);

        // Save org.yaml (without teamDetails)
        const orgData: Organization = {
          name: validated.name,
          tagline: validated.tagline,
          mission: validated.mission,
          culture: validated.culture,
          domain: validated.domain,
          teams: validated.teams,
        };

        const orgPath = join(ctx.atelierDir, 'org.yaml');
        await writeYaml(orgPath, orgData);

        // Create team directories
        for (const team of validated.teamDetails) {
          const teamDir = getTeamDir(ctx.atelierDir, team.slug);
          await mkdir(teamDir, { recursive: true });
          await mkdir(getPersonasDir(ctx.atelierDir, team.slug), { recursive: true });
          await mkdir(join(teamDir, 'beads'), { recursive: true });
          await mkdir(join(teamDir, 'memory'), { recursive: true });
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                saved: true,
                path: orgPath,
                teams: validated.teamDetails.map((t) => ({
                  name: t.name,
                  slug: t.slug,
                  teamSize: t.teamSize,
                })),
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Validation error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // --- atelier_init_generate_team ---
  register(
    'atelier_init_generate_team',
    'Generate a PersonaGenerationPlan for a team. Returns archetype assignments and generation prompts that the agent should use to create persona JSON objects.',
    z.object({
      team_slug: z.string().describe('Team slug identifier'),
      team_domain: z.string().describe('What this team owns and works on'),
      tech_stack: z.array(z.string()).describe('Languages and frameworks this team uses'),
      org_name: z.string().describe('Organization name'),
      org_culture: z.string().describe('Organization culture description'),
      experience_level: z.enum(['apprentice', 'journeyman', 'craftsperson', 'master']).describe('User experience level'),
      flavor: z.string().optional().describe('Creative direction for persona personalities'),
    }),
    async (args, ctx) => {
      const {
        team_slug,
        team_domain,
        tech_stack,
        org_name,
        org_culture,
        experience_level,
        flavor,
      } = args as {
        team_slug: string;
        team_domain: string;
        tech_stack: string[];
        org_name: string;
        org_culture: string;
        experience_level: ExperienceLevel;
        flavor?: string;
      };

      // Load org
      const orgMgr = new OrganizationManager();
      const org = await orgMgr.load(ctx.atelierDir);
      if (!org) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Organization not found. Run atelier_init_save_org first.' }],
          isError: true,
        };
      }

      // Build a minimal team object for the planner
      const team: Team = {
        name: team_domain, // Will be refined
        slug: team_slug,
        domain: team_domain,
        techStack: tech_stack,
        codebasePaths: [],
        personas: [], // Will be populated; planner uses length for team size
      };

      // Read org.yaml to get codebasePaths for this team
      try {
        const orgPath = join(ctx.atelierDir, 'org.yaml');
        const orgRaw = await readYaml<Organization & { teams: unknown }>(orgPath);
        // org.yaml stores team slugs, but the full team details were validated during save
        // We need to check if there's additional team metadata stored
      } catch {
        // Fine, proceed without codebasePaths
      }

      const plan = planPersonaGeneration({
        team,
        org,
        experienceLevel: experience_level,
        flavor,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              team: plan.team,
              archetypes: plan.archetypes,
              prompts: plan.prompts,
            }, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_init_save_team ---
  register(
    'atelier_init_save_team',
    'Validate and save a team definition and its personas. Writes team.yaml and individual persona YAML files under .atelier/teams/<slug>/.',
    z.object({
      team: z.object({
        name: z.string(),
        slug: z.string(),
        domain: z.string(),
        techStack: z.array(z.string()),
        codebasePaths: z.array(z.string()),
      }).describe('Team definition'),
      personas: z.array(z.object({
        name: z.string(),
        slug: z.string(),
        archetype: z.string(),
        role: z.string(),
        seniority: z.string(),
        expertise: z.array(z.string()),
        communication_style: z.string(),
        review_style: z.string(),
        opinions: z.array(z.string()),
        helpfulness: z.number(),
        availability: z.string(),
        quirks: z.array(z.string()),
        backstory: z.string(),
      })).describe('Array of persona objects for this team'),
    }),
    async (args, ctx) => {
      const { team: rawTeam, personas: rawPersonas } = args as {
        team: Record<string, unknown>;
        personas: Record<string, unknown>[];
      };

      try {
        // Validate using team generator's validator
        const validated = validateTeamOutput(
          { team: rawTeam, personas: rawPersonas },
          rawTeam.slug as string,
        );

        // Write team.yaml
        const teamDir = getTeamDir(ctx.atelierDir, validated.team.slug);
        await mkdir(teamDir, { recursive: true });
        const teamPath = join(teamDir, 'team.yaml');
        await writeYaml(teamPath, validated.team);

        // Write persona YAMLs
        const personasDir = getPersonasDir(ctx.atelierDir, validated.team.slug);
        await mkdir(personasDir, { recursive: true });

        const savedPersonas: string[] = [];
        for (const persona of validated.personas) {
          const personaData: Persona = {
            ...persona,
            team: validated.team.slug,
            archetype: persona.archetype,
            helpfulness: persona.helpfulness,
          };
          const personaPath = join(personasDir, `${validateSlug(persona.slug)}.yaml`);
          await writeYaml(personaPath, personaData);
          savedPersonas.push(persona.slug);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                saved: true,
                teamPath,
                personaCount: savedPersonas.length,
                personas: savedPersonas,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Validation error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // --- atelier_init_generate_agents ---
  register(
    'atelier_init_generate_agents',
    'Generate all Claude Code agent files (.claude/agents/*.md) from templates based on the saved organization, teams, and personas. Deletes the bootstrap atelier-init.md agent.',
    z.object({}),
    async (_args, ctx) => {
      try {
        // Load org
        const orgMgr = new OrganizationManager();
        const org = await orgMgr.load(ctx.atelierDir);
        if (!org) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Organization not found.' }],
            isError: true,
          };
        }

        // Load all teams
        const teamMgr = new TeamManager();
        await teamMgr.loadAll(ctx.atelierDir);
        const allTeams = teamMgr.listTeams();

        // Load all personas
        const allPersonas: Persona[] = [];
        for (const team of allTeams) {
          const personasDir = getPersonasDir(ctx.atelierDir, team.slug);
          try {
            const { readdir } = await import('node:fs/promises');
            const files = await readdir(personasDir);
            for (const file of files) {
              if (file.endsWith('.yaml')) {
                const persona = await readYaml<Persona>(join(personasDir, file));
                persona.team = team.slug;
                allPersonas.push(persona);
              }
            }
          } catch {
            // No personas dir yet, skip
          }
        }

        // Read persona_model from config (default to claude-opus-4-6)
        let personaModel = 'claude-opus-4-6';
        try {
          const configPath = join(ctx.atelierDir, 'config.yaml');
          const config = await readYaml<{ persona_model?: string }>(configPath);
          if (config.persona_model) {
            personaModel = config.persona_model;
          }
        } catch {
          // Config may not exist yet, use default
        }

        // Generate agents
        const engine = new AgentTemplateEngine();
        const result = await engine.generateAll(ctx.projectRoot, {
          org,
          allTeams,
          allPersonas,
          mcpServerName: 'atelier',
          personaModel,
          mcpServerCommand: 'bun',
          mcpServerArgsJson: JSON.stringify(['run', join(dirname(fileURLToPath(import.meta.url)), '..', 'index.ts')]),
          projectRoot: ctx.projectRoot,
        });

        // Delete bootstrap agent
        const bootstrapPath = join(getAgentsDir(ctx.projectRoot), 'atelier-init.md');
        try {
          await unlink(bootstrapPath);
        } catch {
          // May not exist, that's fine
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                generated: result.generated.map((p) => p.replace(ctx.projectRoot + '/', '')),
                agentsDir: result.agentsDir.replace(ctx.projectRoot + '/', ''),
                bootstrapRemoved: true,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating agents: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // --- atelier_init_finalize ---
  register(
    'atelier_init_finalize',
    'Finalize Atelier initialization. Updates config with confirmed settings and prints a summary of the generated organization.',
    z.object({}),
    async (_args, ctx) => {
      try {
        // Load org for summary
        const orgMgr = new OrganizationManager();
        const org = await orgMgr.load(ctx.atelierDir);

        // Load teams for summary
        const teamMgr = new TeamManager();
        let allTeams: Team[] = [];
        try {
          await teamMgr.loadAll(ctx.atelierDir);
          allTeams = teamMgr.listTeams();
        } catch {
          // Teams may not be fully set up
        }

        // Count personas
        let totalPersonas = 0;
        for (const team of allTeams) {
          totalPersonas += team.personas.length;
        }

        // Count agent files
        const agentsDir = getAgentsDir(ctx.projectRoot);
        let agentCount = 0;
        try {
          const { readdir } = await import('node:fs/promises');
          const files = await readdir(agentsDir);
          agentCount = files.filter((f) => f.endsWith('.md')).length;
        } catch {
          // Fine
        }

        const summary = {
          status: 'initialized',
          organization: org ? {
            name: org.name,
            tagline: org.tagline,
            teams: org.teams.length,
          } : null,
          teams: allTeams.map((t) => ({
            name: t.name,
            slug: t.slug,
            personas: t.personas.length,
          })),
          totalPersonas,
          agentFiles: agentCount,
          nextStep: 'Use @"persona-name" to talk to teammates, or @"atelier-review" for code review.',
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error finalizing: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
