import { selectArchetypesForTeam } from '../archetypes/selector.js';
import { buildPersonaGenerationPrompt, PersonaGenerationPrompt } from '../archetypes/instantiator.js';
import { ArchetypeRegistry } from '../archetypes/index.js';
import { Team } from '../core/team.js';
import { Organization } from '../core/organization.js';
import { Persona } from '../core/persona.js';
import { ExperienceLevel, ArchetypeId, Seniority } from '../util/types.js';

export interface PersonaGenerationPlan {
  team: Team;
  prompts: PersonaGenerationPrompt[];
  archetypes: Array<{ archetype: ArchetypeId; role: string; seniority: string }>;
}

/**
 * Map from archetype ID to the default seniority that best fits the archetype's
 * behavioral profile. Mentors and architects skew senior; newbies skew junior.
 */
const ARCHETYPE_SENIORITY: Record<ArchetypeId, Seniority> = {
  'architect': 'staff',
  'gatekeeper': 'senior',
  'mentor': 'senior',
  'domain-expert': 'senior',
  'skeptic': 'senior',
  'firefighter': 'mid',
  'craftsperson': 'mid',
  'connector': 'mid',
  'pragmatist': 'mid',
  'newbie': 'junior',
};

/**
 * Experience level shifts the default seniority up or down.
 * Positive values promote, negative values demote (clamped to valid range).
 */
const EXPERIENCE_SENIORITY_OFFSET: Record<ExperienceLevel, number> = {
  apprentice: -1,
  journeyman: 0,
  craftsperson: 1,
  master: 1,
};

const SENIORITY_LADDER: Seniority[] = ['junior', 'mid', 'senior', 'staff', 'principal'];

function shiftSeniority(base: Seniority, offset: number): Seniority {
  const idx = SENIORITY_LADDER.indexOf(base);
  const shifted = Math.max(0, Math.min(SENIORITY_LADDER.length - 1, idx + offset));
  return SENIORITY_LADDER[shifted];
}

/**
 * Pick a role from the archetype's typical_roles that best matches the team
 * domain. Falls back to the first typical role if no keyword overlap is found.
 */
function pickRole(typicalRoles: string[], teamDomain: string): string {
  if (typicalRoles.length === 0) return 'Software Engineer';
  if (typicalRoles.length === 1) return typicalRoles[0];

  const domainWords = teamDomain.toLowerCase().split(/\s+/);

  // Score each role by keyword overlap with the team domain
  let bestRole = typicalRoles[0];
  let bestScore = 0;

  for (const role of typicalRoles) {
    const roleWords = role.toLowerCase().split(/\s+/);
    const score = roleWords.filter((w) => domainWords.some((dw) => dw.includes(w) || w.includes(dw))).length;
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  return bestRole;
}

/**
 * Plan persona generation for a team.
 *
 * Selects archetypes via the selector, assigns roles and seniority levels,
 * then builds a generation prompt for each persona. The returned prompts are
 * intended to be executed by the init agent (one LLM call per persona).
 */
export function planPersonaGeneration(input: {
  team: Team;
  org: Organization;
  experienceLevel: ExperienceLevel;
  flavor?: string;
  existingOrgArchetypes?: ArchetypeId[];
  existingPersonas?: Persona[];
}): PersonaGenerationPlan {
  const {
    team,
    org,
    experienceLevel,
    flavor,
    existingOrgArchetypes = [],
    existingPersonas = [],
  } = input;

  const registry = new ArchetypeRegistry();

  // Select archetypes appropriate for this team
  const selectedArchetypes = selectArchetypesForTeam(
    {
      teamDomain: team.domain,
      teamSize: team.personas.length > 0 ? team.personas.length : 3, // default 3 if not specified
      experienceLevel,
      existingArchetypes: existingOrgArchetypes,
    },
    registry,
  );

  const seniorityOffset = EXPERIENCE_SENIORITY_OFFSET[experienceLevel];

  // Build assignment and prompt for each archetype
  const archetypes: PersonaGenerationPlan['archetypes'] = [];
  const prompts: PersonaGenerationPrompt[] = [];

  // Track personas as we plan them so subsequent prompts can avoid name collisions
  const runningPersonas = [...existingPersonas];

  for (const archetype of selectedArchetypes) {
    const baseSeniority = ARCHETYPE_SENIORITY[archetype.id];
    const seniority = shiftSeniority(baseSeniority, seniorityOffset);
    const role = pickRole(archetype.typical_roles, team.domain);

    archetypes.push({
      archetype: archetype.id,
      role,
      seniority,
    });

    const prompt = buildPersonaGenerationPrompt({
      archetype,
      team,
      org,
      role,
      seniority,
      flavor,
      existingPersonas: runningPersonas,
    });

    prompts.push(prompt);
  }

  return { team, prompts, archetypes };
}
