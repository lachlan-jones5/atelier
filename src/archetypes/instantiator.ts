import { Archetype } from './types.js';
import { Persona } from '../core/persona.js';
import { Organization } from '../core/organization.js';
import { Team } from '../core/team.js';
import { Seniority, Availability, ArchetypeId } from '../util/types.js';

export interface PersonaGenerationInput {
  archetype: Archetype;
  team: Team;
  org: Organization;
  role: string;
  seniority: string;
  flavor?: string;
  existingPersonas: Persona[];
}

export interface PersonaGenerationPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: Record<string, unknown>;
}

const VALID_SENIORITIES: Seniority[] = ['junior', 'mid', 'senior', 'staff', 'principal'];
const VALID_AVAILABILITIES: Availability[] = ['always', 'sometimes_delayed', 'heads_down'];

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: [
    'name', 'slug', 'role', 'seniority', 'expertise',
    'communication_style', 'review_style', 'opinions',
    'helpfulness', 'availability', 'quirks', 'backstory',
  ],
  properties: {
    name: { type: 'string', description: 'Full name of the persona (first and last)' },
    slug: { type: 'string', pattern: '^[a-z][a-z0-9-]*$', description: 'Lowercase hyphenated identifier derived from the name' },
    role: { type: 'string', description: 'Job title / role on the team' },
    seniority: { type: 'string', enum: VALID_SENIORITIES },
    expertise: { type: 'array', items: { type: 'string' }, minItems: 2, description: 'Specific technical areas of deep knowledge' },
    communication_style: { type: 'string', description: 'How this person communicates in code reviews and conversations' },
    review_style: { type: 'string', description: 'Their approach to reviewing code: what they focus on, how thorough they are, their tone' },
    opinions: { type: 'array', items: { type: 'string' }, minItems: 2, description: 'Strong technical opinions this person holds' },
    helpfulness: { type: 'number', minimum: 0, maximum: 1, description: 'How helpful vs. demanding (0 = very demanding, 1 = very helpful)' },
    availability: { type: 'string', enum: VALID_AVAILABILITIES },
    quirks: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Memorable behavioral quirks or habits' },
    backstory: { type: 'string', description: 'A 2-4 sentence backstory explaining how this person ended up on this team' },
  },
  additionalProperties: false,
};

export function buildPersonaGenerationPrompt(input: PersonaGenerationInput): PersonaGenerationPrompt {
  const { archetype, team, org, role, seniority, flavor, existingPersonas } = input;

  const existingNames = existingPersonas.map((p) => p.name);
  const existingSlugs = existingPersonas.map((p) => p.slug);

  const systemPrompt = `You are a character designer for a simulated software engineering organization. Your job is to create a single, vivid, believable software engineer persona who will participate in code reviews, mentoring, and team discussions.

The persona you create must feel like a real person — someone with specific opinions, habits, a distinct voice, and a history. They are NOT a generic archetype. They are a concrete individual who happens to embody certain traits.

CRITICAL RULES:
- The person must feel REAL. Give them specific, idiosyncratic opinions — not vague platitudes.
- Their communication style must be distinctive enough that you could identify them from an anonymous code review comment.
- Opinions should be concrete and technical, not abstract philosophy. "Every function over 15 lines is a design smell" is good. "Code should be clean" is bad.
- Quirks should be behavioral and observable, not internal feelings. "Responds to every PR with a one-line summary of what she thinks the change does before diving into specifics" is good. "Cares deeply about quality" is bad.
- Backstory should explain WHY they are the way they are — what shaped their opinions and style.
- The name must be a plausible full name. Do NOT reuse any of the existing team member names.
- The slug must be lowercase, hyphenated, and derived from the name (e.g., "maya-chen" for "Maya Chen").

OUTPUT FORMAT: Respond with a single JSON object matching the provided schema. No markdown, no explanation, just the JSON object.`;

  const archetypeBlock = `ARCHETYPE: ${archetype.name} (${archetype.id})
Description: ${archetype.description}

Communication patterns:
${archetype.communication_patterns.map((p) => `  - ${p}`).join('\n')}

Review patterns:
${archetype.review_patterns.map((p) => `  - ${p}`).join('\n')}

Behavioral traits:
${archetype.behavioral_traits.map((t) => `  - ${t}`).join('\n')}

Teaching style: ${archetype.teaching_style}
Conflict style: ${archetype.conflict_style}

Strengths:
${archetype.strengths.map((s) => `  - ${s}`).join('\n')}

Blind spots:
${archetype.blind_spots.map((b) => `  - ${b}`).join('\n')}

Helpfulness range: ${archetype.helpfulness_range[0]} to ${archetype.helpfulness_range[1]} (0=unhelpful, 1=maximally helpful)
Typical roles: ${archetype.typical_roles.join(', ')}`;

  const teamBlock = `TEAM: ${team.name} (${team.slug})
Domain: ${team.domain}
Tech stack: ${team.techStack.join(', ')}`;

  const orgBlock = `ORGANIZATION: ${org.name}
Tagline: ${org.tagline}
Mission: ${org.mission}
Culture: ${org.culture}
Domain: ${org.domain}`;

  const constraintBlock = `CONSTRAINTS:
- Role: ${role}
- Seniority: ${seniority}
- Availability must be one of: ${VALID_AVAILABILITIES.join(', ')}
- Expertise must include at least 2 specific technical areas relevant to the team's stack and domain
- Opinions must include at least 2 strong, concrete technical opinions
- Quirks must include at least 1 observable behavioral quirk`;

  const existingBlock = existingNames.length > 0
    ? `EXISTING TEAM MEMBERS (do NOT duplicate these names or create similar-sounding names):
${existingNames.map((n) => `  - ${n}`).join('\n')}

Existing slugs (yours must be different):
${existingSlugs.map((s) => `  - ${s}`).join('\n')}`
    : 'This is the first persona on the team. No existing members to avoid.';

  const flavorBlock = flavor
    ? `ADDITIONAL FLAVOR DIRECTION:\n${flavor}`
    : '';

  const examplesBlock = `EXAMPLES OF GOOD VS BAD OUTPUT:

GOOD communication_style: "Terse in Slack, thorough in PRs. Uses bullet points obsessively. Will reply to a question with a bulleted list of follow-up questions before answering. Prefixes disagreements with 'Hmm' and then a very long pause before typing."

BAD communication_style: "Communicates clearly and professionally with the team."

GOOD opinion: "Integration tests that hit a real database are worth 10x more than unit tests with mocked repositories. She will mass-downvote PRs that add unit tests for database logic without a corresponding integration test."

BAD opinion: "Believes in writing good tests."

GOOD quirk: "Names all his local git branches after 80s action movies. Refers to rebasing as 'the Thunderdome.' Has a shell alias that plays the Terminator theme when CI goes red."

BAD quirk: "Is passionate about technology."

GOOD backstory: "Spent 6 years at a fintech startup where a single misplaced decimal in a currency conversion cost them $2.3M. That incident made her pathologically careful about numeric precision and type safety. She joined ${org.name} after the startup was acqui-hired, bringing her paranoia about edge cases with her."

BAD backstory: "Has been a software engineer for several years and enjoys working on challenging problems."`;

  const blocks = [
    archetypeBlock,
    '',
    teamBlock,
    '',
    orgBlock,
    '',
    constraintBlock,
    '',
    existingBlock,
  ];
  if (flavorBlock) blocks.push('', flavorBlock);
  blocks.push(
    '',
    examplesBlock,
    '',
    `Generate a single JSON object for this persona. Remember: specific, vivid, and real. This person should feel like someone you'd actually work with — not a character sheet.`,
  );
  const userPrompt = blocks.join('\n');

  return {
    systemPrompt,
    userPrompt,
    outputSchema: OUTPUT_SCHEMA,
  };
}

export function validatePersonaOutput(output: unknown, teamSlug: string, archetypeId: string): Persona {
  if (output === null || output === undefined || typeof output !== 'object') {
    throw new Error('Persona output must be a non-null object');
  }

  const obj = output as Record<string, unknown>;

  // Validate required string fields
  const requiredStrings = [
    'name', 'slug', 'role', 'seniority',
    'communication_style', 'review_style',
    'availability', 'backstory',
  ] as const;

  for (const field of requiredStrings) {
    if (typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') {
      throw new Error(`Persona field "${field}" must be a non-empty string, got: ${JSON.stringify(obj[field])}`);
    }
  }

  // Validate slug format
  const slug = obj['slug'] as string;
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Persona slug must be lowercase and hyphenated (matching /^[a-z][a-z0-9-]*$/), got: "${slug}"`);
  }

  // Validate seniority enum
  const seniority = obj['seniority'] as string;
  if (!VALID_SENIORITIES.includes(seniority as Seniority)) {
    throw new Error(`Persona seniority must be one of [${VALID_SENIORITIES.join(', ')}], got: "${seniority}"`);
  }

  // Validate availability enum
  const availability = obj['availability'] as string;
  if (!VALID_AVAILABILITIES.includes(availability as Availability)) {
    throw new Error(`Persona availability must be one of [${VALID_AVAILABILITIES.join(', ')}], got: "${availability}"`);
  }

  // Validate required array fields
  const requiredArrays = ['expertise', 'opinions', 'quirks'] as const;
  for (const field of requiredArrays) {
    const value = obj[field];
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`Persona field "${field}" must be a non-empty array, got: ${JSON.stringify(value)}`);
    }
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || (value[i] as string).trim() === '') {
        throw new Error(`Persona field "${field}[${i}]" must be a non-empty string, got: ${JSON.stringify(value[i])}`);
      }
    }
  }

  // Minimum array lengths
  if ((obj['expertise'] as string[]).length < 2) {
    throw new Error('Persona must have at least 2 expertise entries');
  }
  if ((obj['opinions'] as string[]).length < 2) {
    throw new Error('Persona must have at least 2 opinions');
  }

  // Validate communication_style and review_style are substantive (not just a few words)
  const commStyle = obj['communication_style'] as string;
  if (commStyle.split(' ').length < 5) {
    throw new Error('Persona communication_style is too short — must be a substantive description');
  }

  const revStyle = obj['review_style'] as string;
  if (revStyle.split(' ').length < 5) {
    throw new Error('Persona review_style is too short — must be a substantive description');
  }

  // Validate helpfulness is a number in 0-1 range
  if (typeof obj['helpfulness'] !== 'number' || obj['helpfulness'] < 0 || obj['helpfulness'] > 1) {
    throw new Error(`Persona helpfulness must be a number between 0 and 1, got: ${JSON.stringify(obj['helpfulness'])}`);
  }

  // Build the Persona, overriding team and archetype with trusted inputs
  const persona: Persona = {
    name: obj['name'] as string,
    slug,
    team: teamSlug,
    archetype: archetypeId as ArchetypeId,
    role: obj['role'] as string,
    seniority: seniority as Seniority,
    expertise: obj['expertise'] as string[],
    communication_style: commStyle,
    review_style: revStyle,
    opinions: obj['opinions'] as string[],
    helpfulness: obj['helpfulness'] as number,
    availability: availability as Availability,
    quirks: obj['quirks'] as string[],
    backstory: obj['backstory'] as string,
  };

  return persona;
}
