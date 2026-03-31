import type { Archetype } from './types.js';
import { ArchetypeRegistry } from './index.js';
import { ExperienceLevel, ArchetypeId } from '../util/types.js';

export interface SelectionInput {
  teamDomain: string;
  teamSize: number;
  experienceLevel: ExperienceLevel;
  existingArchetypes?: ArchetypeId[];
}

// Archetype categories for constraint checking
const STANDARDS_ARCHETYPES: ArchetypeId[] = ['gatekeeper', 'craftsperson'];
const PRODUCTIVITY_ARCHETYPES: ArchetypeId[] = ['pragmatist', 'firefighter', 'connector'];
const SENIOR_ARCHETYPES: ArchetypeId[] = ['mentor', 'gatekeeper', 'architect'];

// Seniority ordering for final sort
const SENIORITY_ORDER: ArchetypeId[] = [
  'architect',
  'gatekeeper',
  'mentor',
  'domain-expert',
  'skeptic',
  'firefighter',
  'craftsperson',
  'connector',
  'pragmatist',
  'newbie',
];

interface DomainProfile {
  keywords: string[];
  weights: Partial<Record<ArchetypeId, number>>;
}

const DOMAIN_PROFILES: DomainProfile[] = [
  {
    keywords: ['systems', 'infra', 'infrastructure', 'devops', 'ops', 'sre', 'platform', 'cloud', 'kubernetes', 'docker'],
    weights: { firefighter: 0.3, 'domain-expert': 0.2, pragmatist: 0.2 },
  },
  {
    keywords: ['web', 'frontend', 'ui', 'ux', 'react', 'vue', 'angular', 'css', 'design system'],
    weights: { pragmatist: 0.3, craftsperson: 0.2, connector: 0.2 },
  },
  {
    keywords: ['compiler', 'language', 'formal', 'verification', 'type system', 'parser', 'ast', 'llvm'],
    weights: { gatekeeper: 0.3, architect: 0.2, 'domain-expert': 0.3 },
  },
  {
    keywords: ['ml', 'machine learning', 'data', 'ai', 'deep learning', 'nlp', 'model', 'training', 'inference'],
    weights: { 'domain-expert': 0.3, skeptic: 0.2, architect: 0.2 },
  },
];

const EXPERIENCE_ADJUSTMENTS: Record<ExperienceLevel, Partial<Record<ArchetypeId, number>>> = {
  apprentice: { mentor: 0.3, pragmatist: 0.2, skeptic: -0.2, gatekeeper: -0.1 },
  journeyman: { craftsperson: 0.1 },
  craftsperson: { gatekeeper: 0.2, architect: 0.2 },
  master: { skeptic: 0.3, gatekeeper: 0.2, mentor: -0.2 },
};

/**
 * Compute domain-based weights for all archetypes.
 * Matches domain string against known profiles and accumulates weights.
 * Unknown domains get a uniform baseline.
 */
export function getArchetypeWeightsForDomain(domain: string): Map<ArchetypeId, number> {
  const ALL_IDS: ArchetypeId[] = [
    'mentor', 'gatekeeper', 'pragmatist', 'newbie', 'domain-expert',
    'firefighter', 'architect', 'connector', 'skeptic', 'craftsperson',
  ];

  const weights = new Map<ArchetypeId, number>();
  for (const id of ALL_IDS) {
    weights.set(id, 0.5); // baseline
  }

  const lowerDomain = domain.toLowerCase();
  let matched = false;

  for (const profile of DOMAIN_PROFILES) {
    if (profile.keywords.some((kw) => lowerDomain.includes(kw))) {
      matched = true;
      for (const [id, delta] of Object.entries(profile.weights)) {
        const current = weights.get(id as ArchetypeId) ?? 0.5;
        weights.set(id as ArchetypeId, current + delta);
      }
    }
  }

  // If no domain matched, leave uniform weights
  if (!matched) {
    // already uniform at 0.5
  }

  return weights;
}

/**
 * Select archetypes for a team based on domain, experience level, team size,
 * and existing org-wide archetype usage (for diversity).
 */
export function selectArchetypesForTeam(input: SelectionInput, registry: ArchetypeRegistry): Archetype[] {
  const { teamDomain, teamSize, experienceLevel, existingArchetypes = [] } = input;
  const allArchetypes = registry.getAll();

  if (teamSize <= 0) return [];
  if (teamSize > allArchetypes.length) {
    // Can't select more than available; return all in seniority order
    return sortBySeniority(allArchetypes);
  }

  // Step 1: Compute base domain weights
  const scores = getArchetypeWeightsForDomain(teamDomain);

  // Step 2: Apply experience level adjustments
  const adjustments = EXPERIENCE_ADJUSTMENTS[experienceLevel] ?? {};
  for (const [id, delta] of Object.entries(adjustments)) {
    const current = scores.get(id as ArchetypeId) ?? 0.5;
    scores.set(id as ArchetypeId, current + delta);
  }

  // Step 3: Penalize archetypes already used on other teams (diversity preference)
  const existingSet = new Set(existingArchetypes);
  for (const id of existingSet) {
    const current = scores.get(id) ?? 0.5;
    scores.set(id, current - 0.15);
  }

  // Step 4: Apply constraints via mandatory slot filling
  const selected = new Set<ArchetypeId>();

  // Helper: pick the highest-scoring archetype from a candidate list, not already selected
  const pickBest = (candidates: ArchetypeId[]): ArchetypeId | null => {
    let best: ArchetypeId | null = null;
    let bestScore = -Infinity;
    for (const id of candidates) {
      if (selected.has(id)) continue;
      const score = scores.get(id) ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  };

  // Constraint: at least one standards archetype
  const standardsPick = pickBest(STANDARDS_ARCHETYPES);
  if (standardsPick) selected.add(standardsPick);

  // Constraint: at least one productivity archetype
  const productivityPick = pickBest(PRODUCTIVITY_ARCHETYPES);
  if (productivityPick) selected.add(productivityPick);

  // Constraint: if teamSize >= 3, include at least one senior archetype
  if (teamSize >= 3) {
    const hasSenior = [...selected].some((id) => SENIOR_ARCHETYPES.includes(id));
    if (!hasSenior) {
      const seniorPick = pickBest(SENIOR_ARCHETYPES);
      if (seniorPick) selected.add(seniorPick);
    }
  }

  // Step 5: Fill remaining slots by highest score
  const remaining = allArchetypes
    .filter((a) => !selected.has(a.id))
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));

  for (const archetype of remaining) {
    if (selected.size >= teamSize) break;
    selected.add(archetype.id);
  }

  // If constraints pushed us over teamSize, trim lowest-scoring non-mandatory picks.
  // This can happen if teamSize < number of constraint slots (e.g., teamSize=1).
  // In that case, keep only the top teamSize by score.
  if (selected.size > teamSize) {
    const sorted = [...selected].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
    const keep = new Set(sorted.slice(0, teamSize));
    for (const id of selected) {
      if (!keep.has(id)) selected.delete(id);
    }
  }

  // Step 6: Resolve to Archetype objects and sort by seniority
  const result: Archetype[] = [];
  for (const id of selected) {
    const archetype = registry.get(id);
    if (archetype) result.push(archetype);
  }

  return sortBySeniority(result);
}

function sortBySeniority(archetypes: Archetype[]): Archetype[] {
  return [...archetypes].sort(
    (a, b) => SENIORITY_ORDER.indexOf(a.id) - SENIORITY_ORDER.indexOf(b.id),
  );
}
