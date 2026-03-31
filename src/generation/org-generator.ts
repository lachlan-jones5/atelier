import type { CodebaseAnalysis, TeamSuggestion } from '../analysis/index.js';
import type { Organization } from '../core/organization.js';

export interface OrgGenerationInput {
  analysis: CodebaseAnalysis;
  flavor?: string;
  projectDescription?: string;
}

export interface OrgGenerationPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: Record<string, unknown>;
}

/** JSON schema describing the expected org generation output. */
const ORG_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['name', 'tagline', 'mission', 'culture', 'domain', 'teams'],
  properties: {
    name: {
      type: 'string',
      description: 'A creative, memorable organization name that fits the project domain',
    },
    tagline: {
      type: 'string',
      description: 'A short, punchy tagline (under 80 characters)',
    },
    mission: {
      type: 'string',
      description: 'A 1-2 sentence mission statement that reflects the codebase purpose',
    },
    culture: {
      type: 'string',
      description: 'A brief description of the engineering culture (e.g., "move fast and break things" or "measure twice, cut once")',
    },
    domain: {
      type: 'string',
      description: 'The primary technical domain (e.g., "web platform", "developer tools", "data infrastructure")',
    },
    teams: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'slug', 'domain', 'techStack', 'codebasePaths', 'teamSize'],
        properties: {
          name: { type: 'string', description: 'Human-readable team name' },
          slug: { type: 'string', description: 'URL-safe identifier (lowercase, hyphens)' },
          domain: { type: 'string', description: 'What this team owns and works on' },
          techStack: {
            type: 'array',
            items: { type: 'string' },
            description: 'Languages, frameworks, and tools this team primarily uses',
          },
          codebasePaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Directory paths this team owns',
          },
          teamSize: {
            type: 'number',
            minimum: 2,
            maximum: 6,
            description: 'Number of personas to generate for this team',
          },
        },
      },
      description: 'Team decomposition for the organization',
    },
  },
  additionalProperties: false,
};

function summarizeAnalysis(analysis: CodebaseAnalysis): string {
  const totalFiles = analysis.languages.reduce((sum, l) => sum + l.fileCount, 0);
  const langSummary = analysis.languages
    .map((l) => {
      const pct = totalFiles > 0 ? ((l.fileCount / totalFiles) * 100).toFixed(0) : '?';
      return `${l.language} (${pct}%, ${l.fileCount} files)`;
    })
    .join(', ');

  const frameworkSummary = analysis.frameworks.length > 0
    ? analysis.frameworks.join(', ')
    : 'none detected';

  const structureSummary = analysis.structure
    .filter((d) => !d.path.includes('/') && !d.path.includes('\\'))
    .map((d) => `${d.path}/ — ${d.purpose}`)
    .join('\n  ');

  const teamSuggestions = analysis.suggestedTeams
    .map((t) => `- ${t.name} (${t.slug}): ${t.domain}\n    paths: ${t.codebasePaths.join(', ')}\n    rationale: ${t.rationale}`)
    .join('\n');

  return `## Codebase Analysis

**Files:** ${analysis.fileCount} | **Lines of code:** ~${analysis.loc.toLocaleString()}
**Languages:** ${langSummary}
**Frameworks/patterns:** ${frameworkSummary}
**Build system:** ${analysis.buildSystem ?? 'unknown'}
**Test framework:** ${analysis.testFramework ?? 'unknown'}
**Entry points:** ${analysis.entryPoints.join(', ') || 'none detected'}

### Directory Structure
  ${structureSummary}

### Suggested Team Decomposition
${teamSuggestions}`;
}

/**
 * Construct a detailed prompt for the init agent to generate an organization.
 *
 * The prompt includes the codebase analysis summary, detected languages/frameworks,
 * the flavor prompt, and instructions for generating a realistic org. The outputSchema
 * describes the expected JSON format.
 */
export function buildOrgGenerationPrompt(input: OrgGenerationInput): OrgGenerationPrompt {
  const analysisSummary = summarizeAnalysis(input.analysis);

  const flavorInstruction = input.flavor
    ? `\n\n## Flavor\nApply this creative direction to the organization's personality:\n${input.flavor}`
    : '';

  const projectDesc = input.projectDescription
    ? `\n\n## Project Description\n${input.projectDescription}`
    : '';

  const systemPrompt = `You are a creative writing assistant specializing in building fictional software organizations.

Your job is to take a real codebase analysis and generate a believable, internally consistent organization that could plausibly develop and maintain this codebase. The organization should feel like a real company or open-source project with a distinct culture and personality.

Guidelines:
- The organization name should be creative and memorable, not generic
- The tagline should be punchy and reflect what the codebase actually does
- The mission should connect to the real purpose of the code
- The culture description should feel authentic — avoid corporate buzzwords
- Teams should map to actual code ownership boundaries from the analysis
- Team tech stacks should reflect what's actually detected in the codebase
- Team sizes should be between 2-6 personas, scaled to code complexity
- Use the suggested team decomposition as a starting point, but feel free to rename, merge, or split teams for a more natural feel

Output ONLY valid JSON matching the provided schema. No markdown, no explanation.`;

  const userPrompt = `Generate a fictional software organization for this codebase.

${analysisSummary}${projectDesc}${flavorInstruction}

Use the suggested team decomposition as a starting point. You may rename teams to sound more natural (e.g., "Frontend" could become "Client Experience" or "Web Platform"), merge small teams, or split large ones. Each team must map to real codebase paths from the analysis.

Respond with a single JSON object matching this schema:
\`\`\`json
${JSON.stringify(ORG_OUTPUT_SCHEMA, null, 2)}
\`\`\``;

  return {
    systemPrompt,
    userPrompt,
    outputSchema: ORG_OUTPUT_SCHEMA,
  };
}

/**
 * Validate that the init agent's response matches the Organization schema.
 * Throws descriptive errors for missing or invalid fields.
 *
 * Returns a fully validated Organization plus the raw team details (which
 * include teamSize and techStack needed for subsequent team generation).
 */
export function validateOrgOutput(output: unknown): Organization & { teamDetails: OrgTeamDetail[] } {
  if (output === null || output === undefined || typeof output !== 'object') {
    throw new OrgValidationError('Organization output must be a non-null object');
  }

  const obj = output as Record<string, unknown>;

  // Validate required string fields
  const requiredStrings = ['name', 'tagline', 'mission', 'culture', 'domain'] as const;
  for (const field of requiredStrings) {
    if (typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') {
      throw new OrgValidationError(`Organization.${field} must be a non-empty string, got ${typeof obj[field]}`);
    }
  }

  // Validate teams array
  if (!Array.isArray(obj.teams) || obj.teams.length === 0) {
    throw new OrgValidationError('Organization.teams must be a non-empty array');
  }

  const teamSlugs = new Set<string>();
  const teamDetails: OrgTeamDetail[] = [];

  for (let i = 0; i < obj.teams.length; i++) {
    const team = obj.teams[i];
    if (typeof team !== 'object' || team === null) {
      throw new OrgValidationError(`Organization.teams[${i}] must be an object`);
    }

    const t = team as Record<string, unknown>;
    const teamRequiredStrings = ['name', 'slug', 'domain'] as const;
    for (const field of teamRequiredStrings) {
      if (typeof t[field] !== 'string' || (t[field] as string).trim() === '') {
        throw new OrgValidationError(`Organization.teams[${i}].${field} must be a non-empty string`);
      }
    }

    const slug = t.slug as string;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new OrgValidationError(
        `Organization.teams[${i}].slug "${slug}" must be lowercase alphanumeric with hyphens`,
      );
    }

    if (teamSlugs.has(slug)) {
      throw new OrgValidationError(`Duplicate team slug: "${slug}"`);
    }
    teamSlugs.add(slug);

    if (!Array.isArray(t.techStack) || t.techStack.length === 0) {
      throw new OrgValidationError(`Organization.teams[${i}].techStack must be a non-empty array of strings`);
    }
    for (const item of t.techStack) {
      if (typeof item !== 'string') {
        throw new OrgValidationError(`Organization.teams[${i}].techStack items must be strings`);
      }
    }

    if (!Array.isArray(t.codebasePaths) || t.codebasePaths.length === 0) {
      throw new OrgValidationError(`Organization.teams[${i}].codebasePaths must be a non-empty array of strings`);
    }

    if (typeof t.teamSize !== 'number' || t.teamSize < 2 || t.teamSize > 6) {
      throw new OrgValidationError(
        `Organization.teams[${i}].teamSize must be a number between 2 and 6, got ${t.teamSize}`,
      );
    }

    teamDetails.push({
      name: t.name as string,
      slug,
      domain: t.domain as string,
      techStack: t.techStack as string[],
      codebasePaths: t.codebasePaths as string[],
      teamSize: t.teamSize as number,
    });
  }

  return {
    name: obj.name as string,
    tagline: obj.tagline as string,
    mission: obj.mission as string,
    culture: obj.culture as string,
    domain: obj.domain as string,
    teams: teamDetails.map((t) => t.slug),
    teamDetails,
  };
}

/** Extra team details returned from org generation, needed for team generation. */
export interface OrgTeamDetail {
  name: string;
  slug: string;
  domain: string;
  techStack: string[];
  codebasePaths: string[];
  teamSize: number;
}

export class OrgValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgValidationError';
  }
}
