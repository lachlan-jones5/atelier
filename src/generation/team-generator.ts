import type { TeamSuggestion } from '../analysis/index.js';
import type { Organization } from '../core/organization.js';
import type { Team } from '../core/team.js';
import type { Archetype } from '../archetypes/types.js';
import type { Seniority, Availability } from '../util/types.js';

export interface TeamGenerationInput {
  suggestion: TeamSuggestion;
  org: Organization;
  archetypes: Archetype[];
  flavor?: string;
}

export interface TeamGenerationPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: Record<string, unknown>;
}

/** Schema for a single generated persona. */
const PERSONA_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: [
    'name', 'slug', 'role', 'seniority', 'expertise',
    'communication_style', 'review_style', 'opinions',
    'helpfulness', 'availability', 'quirks', 'backstory',
  ],
  properties: {
    name: { type: 'string', description: 'Full name (first and last)' },
    slug: { type: 'string', description: 'URL-safe identifier derived from name (lowercase, hyphens)' },
    role: { type: 'string', description: 'Job title (e.g., "Senior Frontend Engineer", "Staff SRE")' },
    seniority: {
      type: 'string',
      enum: ['junior', 'mid', 'senior', 'staff', 'principal'],
      description: 'Experience level',
    },
    expertise: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 6,
      description: 'Areas of deep technical knowledge',
    },
    communication_style: {
      type: 'string',
      description: 'How this person communicates in code reviews and chat (e.g., "terse and direct", "warm and encouraging with lots of examples")',
    },
    review_style: {
      type: 'string',
      description: 'How this person approaches code review (e.g., "focuses on architecture", "catches edge cases", "nitpicks style")',
    },
    opinions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 5,
      description: 'Strong technical opinions this person holds (e.g., "believes all functions should be under 20 lines")',
    },
    helpfulness: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'How helpful vs. demanding (0 = very demanding, 1 = very helpful)',
    },
    availability: {
      type: 'string',
      enum: ['always', 'sometimes_delayed', 'heads_down'],
      description: 'How responsive to pings and review requests',
    },
    quirks: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 4,
      description: 'Personality quirks that make this person feel real (e.g., "always references obscure RFCs", "uses too many emoji")',
    },
    backstory: {
      type: 'string',
      description: 'A 2-3 sentence background: where they worked before, what shaped their views, why they joined this org',
    },
  },
  additionalProperties: false,
};

/** JSON schema for the full team generation output. */
const TEAM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['team', 'personas'],
  properties: {
    team: {
      type: 'object',
      required: ['name', 'slug', 'domain', 'techStack', 'codebasePaths'],
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        domain: { type: 'string' },
        techStack: { type: 'array', items: { type: 'string' } },
        codebasePaths: { type: 'array', items: { type: 'string' } },
      },
    },
    personas: {
      type: 'array',
      items: PERSONA_SCHEMA,
      description: 'One persona per archetype provided',
    },
  },
  additionalProperties: false,
};

function formatArchetypeForPrompt(archetype: Archetype): string {
  return `### ${archetype.name} (${archetype.id})
${archetype.description}

**Communication patterns:** ${archetype.communication_patterns.join('; ')}
**Review patterns:** ${archetype.review_patterns.join('; ')}
**Behavioral traits:** ${archetype.behavioral_traits.join(', ')}
**Helpfulness range:** ${archetype.helpfulness_range[0]}-${archetype.helpfulness_range[1]}
**Typical roles:** ${archetype.typical_roles.join(', ')}
**Teaching style:** ${archetype.teaching_style}
**Conflict style:** ${archetype.conflict_style}
**Strengths:** ${archetype.strengths.join(', ')}
**Blind spots:** ${archetype.blind_spots.join(', ')}`;
}

/**
 * Construct a prompt for the init agent to generate a team with concrete personas.
 *
 * The prompt includes the org context, team domain, tech stack, archetypes, and flavor.
 * It instructs Claude Code to make each persona feel like a real, distinct person.
 */
export function buildTeamGenerationPrompt(input: TeamGenerationInput): TeamGenerationPrompt {
  const { suggestion, org, archetypes, flavor } = input;

  const archetypeDescriptions = archetypes
    .map(formatArchetypeForPrompt)
    .join('\n\n');

  const flavorInstruction = flavor
    ? `\n\n## Flavor\nApply this creative direction to the personas' personalities:\n${flavor}`
    : '';

  const systemPrompt = `You are a creative writing assistant specializing in building fictional software engineer personas.

Your job is to instantiate concrete, believable people from archetype templates. Each persona should feel like someone you might actually work with — distinct voice, real opinions, plausible backstory. They are NOT caricatures; they are nuanced individuals who happen to lean toward certain patterns.

Guidelines for persona creation:
- Names should be diverse (varied cultural backgrounds, genders)
- Slugs should be derived from the full name (e.g., "maria-chen", "alex-okafor")
- Roles should match their archetype's typical seniority and the team's domain
- Expertise should combine the archetype's strengths with the team's tech stack
- Communication style should reflect the archetype but with individual texture
- Opinions should be specific and technical, not vague platitudes
- Quirks should be subtle and endearing, not cartoonish
- Backstories should explain why they think the way they do
- Helpfulness should fall within the archetype's helpfulness_range
- No two personas on the same team should feel interchangeable

Output ONLY valid JSON matching the provided schema. No markdown, no explanation.`;

  const userPrompt = `Generate personas for the "${suggestion.name}" team in the "${org.name}" organization.

## Organization Context
- **Name:** ${org.name}
- **Tagline:** ${org.tagline}
- **Mission:** ${org.mission}
- **Culture:** ${org.culture}
- **Domain:** ${org.domain}

## Team Context
- **Team name:** ${suggestion.name}
- **Team domain:** ${suggestion.domain}
- **Tech stack:** ${suggestion.techStack.join(', ')}
- **Codebase paths:** ${suggestion.codebasePaths.join(', ')}

## Archetypes to Instantiate
Create exactly one persona for each archetype below. The archetype defines the behavioral template; your job is to make it a real person.

${archetypeDescriptions}${flavorInstruction}

Respond with a single JSON object matching this schema:
\`\`\`json
${JSON.stringify(TEAM_OUTPUT_SCHEMA, null, 2)}
\`\`\`

The team object should use slug "${suggestion.slug}" and include the codebase paths and tech stack from the team context above. The personas array must have exactly ${archetypes.length} entries, one per archetype.`;

  return {
    systemPrompt,
    userPrompt,
    outputSchema: TEAM_OUTPUT_SCHEMA,
  };
}

/** A validated persona extracted from team generation output. */
export interface GeneratedPersona {
  name: string;
  slug: string;
  role: string;
  seniority: Seniority;
  expertise: string[];
  communication_style: string;
  review_style: string;
  opinions: string[];
  helpfulness: number;
  availability: Availability;
  quirks: string[];
  backstory: string;
}

/**
 * Validate that the init agent's response matches the expected team + personas schema.
 * Throws descriptive errors for missing or invalid fields.
 */
export function validateTeamOutput(
  output: unknown,
  teamSlug: string,
): { team: Team; personas: GeneratedPersona[] } {
  if (output === null || output === undefined || typeof output !== 'object') {
    throw new TeamValidationError('Team output must be a non-null object');
  }

  const obj = output as Record<string, unknown>;

  // Validate team object
  if (typeof obj.team !== 'object' || obj.team === null) {
    throw new TeamValidationError('Team output must contain a "team" object');
  }

  const rawTeam = obj.team as Record<string, unknown>;
  for (const field of ['name', 'slug', 'domain'] as const) {
    if (typeof rawTeam[field] !== 'string' || (rawTeam[field] as string).trim() === '') {
      throw new TeamValidationError(`team.${field} must be a non-empty string`);
    }
  }

  if (!Array.isArray(rawTeam.techStack) || rawTeam.techStack.length === 0) {
    throw new TeamValidationError('team.techStack must be a non-empty string array');
  }

  if (!Array.isArray(rawTeam.codebasePaths) || rawTeam.codebasePaths.length === 0) {
    throw new TeamValidationError('team.codebasePaths must be a non-empty string array');
  }

  // Validate personas array
  if (!Array.isArray(obj.personas) || obj.personas.length === 0) {
    throw new TeamValidationError('Team output must contain a non-empty "personas" array');
  }

  const VALID_SENIORITIES: Seniority[] = ['junior', 'mid', 'senior', 'staff', 'principal'];
  const VALID_AVAILABILITIES: Availability[] = ['always', 'sometimes_delayed', 'heads_down'];

  const personaSlugs = new Set<string>();
  const personas: GeneratedPersona[] = [];

  for (let i = 0; i < obj.personas.length; i++) {
    const p = obj.personas[i] as Record<string, unknown>;
    if (typeof p !== 'object' || p === null) {
      throw new TeamValidationError(`personas[${i}] must be an object`);
    }

    // Required strings
    for (const field of ['name', 'slug', 'role', 'communication_style', 'review_style', 'backstory'] as const) {
      if (typeof p[field] !== 'string' || (p[field] as string).trim() === '') {
        throw new TeamValidationError(`personas[${i}].${field} must be a non-empty string`);
      }
    }

    const slug = p.slug as string;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new TeamValidationError(
        `personas[${i}].slug "${slug}" must be lowercase alphanumeric with hyphens`,
      );
    }
    if (personaSlugs.has(slug)) {
      throw new TeamValidationError(`Duplicate persona slug: "${slug}"`);
    }
    personaSlugs.add(slug);

    // Seniority enum
    if (!VALID_SENIORITIES.includes(p.seniority as Seniority)) {
      throw new TeamValidationError(
        `personas[${i}].seniority must be one of: ${VALID_SENIORITIES.join(', ')}`,
      );
    }

    // Availability enum
    if (!VALID_AVAILABILITIES.includes(p.availability as Availability)) {
      throw new TeamValidationError(
        `personas[${i}].availability must be one of: ${VALID_AVAILABILITIES.join(', ')}`,
      );
    }

    // Helpfulness range
    if (typeof p.helpfulness !== 'number' || p.helpfulness < 0 || p.helpfulness > 1) {
      throw new TeamValidationError(
        `personas[${i}].helpfulness must be a number between 0 and 1`,
      );
    }

    // Required arrays
    for (const field of ['expertise', 'opinions', 'quirks'] as const) {
      if (!Array.isArray(p[field]) || p[field].length === 0) {
        throw new TeamValidationError(`personas[${i}].${field} must be a non-empty array of strings`);
      }
      for (const item of p[field] as unknown[]) {
        if (typeof item !== 'string') {
          throw new TeamValidationError(`personas[${i}].${field} items must be strings`);
        }
      }
    }

    personas.push({
      name: p.name as string,
      slug: p.slug as string,
      role: p.role as string,
      seniority: p.seniority as Seniority,
      expertise: p.expertise as string[],
      communication_style: p.communication_style as string,
      review_style: p.review_style as string,
      opinions: p.opinions as string[],
      helpfulness: p.helpfulness as number,
      availability: p.availability as Availability,
      quirks: p.quirks as string[],
      backstory: p.backstory as string,
    });
  }

  const team: Team = {
    name: rawTeam.name as string,
    slug: teamSlug, // Use the canonical slug, not whatever the LLM returned
    domain: rawTeam.domain as string,
    techStack: rawTeam.techStack as string[],
    codebasePaths: rawTeam.codebasePaths as string[],
    personas: personas.map((p) => p.slug),
  };

  return { team, personas };
}

export class TeamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamValidationError';
  }
}
