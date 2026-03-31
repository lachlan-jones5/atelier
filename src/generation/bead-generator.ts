import { BeadCreate } from '../core/bead.js';
import { CodebaseAnalysis } from '../analysis/index.js';
import { ProgressParams } from '../simulation/progress-slider.js';
import { ExperienceLevel, SkillDimension, BeadType, BeadStatus, BeadPriority } from '../util/types.js';

export interface BeadGenerationInput {
  analysis: CodebaseAnalysis;
  progressParams: ProgressParams;
  experienceLevel: ExperienceLevel;
  teamSlug: string;
  teamDomain: string;
}

export interface BeadGenerationPrompt {
  systemPrompt: string;
  userPrompt: string;
  outputSchema: Record<string, unknown>;
}

const VALID_BEAD_TYPES: BeadType[] = ['feature', 'bugfix', 'refactor', 'test', 'docs', 'perf', 'infra'];
const VALID_STATUSES: BeadStatus[] = ['open', 'claimed', 'in_progress', 'in_review', 'done'];
const VALID_PRIORITIES: BeadPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_SKILL_DIMENSIONS: SkillDimension[] = [
  'reading_code', 'testing', 'debugging', 'design', 'review', 'communication', 'ops_awareness',
];

const BEAD_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: [
    'title', 'description', 'team', 'priority', 'status',
    'assigned_to', 'depends_on', 'acceptance_criteria',
    'skill_targets', 'type',
  ],
  properties: {
    title: { type: 'string', description: 'Short descriptive title for the bead' },
    description: {
      type: 'string',
      description: 'Detailed description of the work to be done (2-5 sentences)',
    },
    team: { type: 'string', description: 'Team slug that owns this bead' },
    priority: { type: 'string', enum: VALID_PRIORITIES },
    status: { type: 'string', enum: VALID_STATUSES },
    assigned_to: {
      type: ['string', 'null'],
      description: 'Persona slug, "user", or null if unassigned',
    },
    depends_on: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of bead titles this bead depends on (will be resolved to IDs later)',
    },
    acceptance_criteria: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: 'Concrete, verifiable conditions that must hold when this bead is complete',
    },
    skill_targets: {
      type: 'array',
      items: { type: 'string', enum: VALID_SKILL_DIMENSIONS },
      minItems: 1,
      description: 'Skill dimensions exercised by this bead',
    },
    type: { type: 'string', enum: VALID_BEAD_TYPES },
    files: {
      type: 'array',
      items: { type: 'string' },
      description: 'Relevant file paths from the codebase (optional)',
    },
    hints: {
      type: 'array',
      items: { type: 'string' },
      description: 'Hints for lower-difficulty levels (optional)',
    },
  },
  additionalProperties: false,
};

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['beads'],
  properties: {
    beads: {
      type: 'array',
      items: BEAD_SCHEMA,
      description: 'Array of bead definitions forming the initial backlog',
    },
  },
  additionalProperties: false,
};

/**
 * Map experience level to prompt calibration hints.
 */
function getExperienceCalibration(level: ExperienceLevel): string {
  switch (level) {
    case 'apprentice':
      return `The user is a beginner. Generate beads that are:
- Well-scoped and achievable in isolation
- Focused on reading code, writing tests, and making small fixes
- Include generous hints for each bead
- Avoid complex architectural or cross-cutting concerns
- Acceptance criteria should be very specific and measurable`;

    case 'journeyman':
      return `The user has some experience. Generate beads that:
- Include a mix of straightforward and moderately challenging tasks
- Cover testing, small features, and simple refactors
- Include hints only for harder beads
- Start introducing design and review skill targets`;

    case 'craftsperson':
      return `The user is experienced. Generate beads that:
- Include challenging features, non-trivial refactors, and performance work
- Require understanding cross-cutting concerns
- Hints are optional and only for the most complex beads
- Include beads targeting design, review, and communication skills`;

    case 'master':
      return `The user is highly experienced. Generate beads that:
- Include complex architectural work, performance optimization, and tech debt reduction
- Require deep system understanding and cross-team coordination
- No hints needed
- Include beads targeting all skill dimensions including ops_awareness
- Some beads should be deliberately ambiguous to exercise judgment`;
  }
}

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

  return `**Files:** ${analysis.fileCount} | **Lines of code:** ~${analysis.loc.toLocaleString()}
**Languages:** ${langSummary}
**Frameworks/patterns:** ${frameworkSummary}
**Build system:** ${analysis.buildSystem ?? 'unknown'}
**Test framework:** ${analysis.testFramework ?? 'unknown'}
**Entry points:** ${analysis.entryPoints.join(', ') || 'none detected'}

### Directory Structure
  ${structureSummary}`;
}

/**
 * Construct a prompt for the init agent to generate an initial bead backlog.
 *
 * The prompt is calibrated based on codebase analysis, experience level, and
 * progress params (which control the simulated project maturity — how many
 * beads should be open vs done, tech debt level, etc.).
 */
export function buildBeadGenerationPrompt(input: BeadGenerationInput): BeadGenerationPrompt {
  const { analysis, progressParams, experienceLevel, teamSlug, teamDomain } = input;

  const analysisSummary = summarizeAnalysis(analysis);
  const calibration = getExperienceCalibration(experienceLevel);
  const { beadDistribution } = progressParams;
  const totalBeads = beadDistribution.open + beadDistribution.inProgress + beadDistribution.done;

  const systemPrompt = `You are a project planning assistant for a simulated software engineering environment. Your job is to generate a realistic backlog of work items ("beads") for a development team, based on an actual codebase analysis.

Each bead represents a unit of work — a feature, bugfix, refactor, test, documentation update, performance improvement, or infrastructure task. Together, the beads form a coherent backlog that tells the story of an evolving project.

Guidelines:
- Beads must be grounded in the REAL codebase structure and patterns detected
- Each bead should be self-contained enough to be worked on independently (unless it has explicit dependencies)
- Acceptance criteria must be concrete and verifiable — not vague goals
- Skill targets indicate which skills the user will practice by completing each bead
- Dependencies between beads should form a DAG (no cycles). Reference other beads by their exact title.
- File paths should reference actual directories/files from the codebase analysis
- Mix bead types realistically: most codebases need a mix of features, tests, bugfixes, and refactors
- Priority distribution should be realistic: few critical, some high, many medium, some low

Output ONLY valid JSON matching the provided schema. No markdown, no explanation.`;

  const userPrompt = `Generate a bead backlog for the "${teamDomain}" team (slug: "${teamSlug}").

## Codebase Analysis
${analysisSummary}

## Project Maturity
- **Code volume:** ${progressParams.codeVolume}
- **Tech debt level:** ${progressParams.techDebtLevel}
- **Documentation level:** ${progressParams.documentationLevel}
- **Test coverage:** ${progressParams.testCoverage}
- **Established patterns:** ${progressParams.establishedPatterns ? 'yes' : 'no'}

## Bead Distribution Target
Generate exactly ${totalBeads} beads with this status distribution:
- **open:** ${beadDistribution.open} beads (ready to be claimed)
- **in_progress:** ${beadDistribution.inProgress} beads (assigned to persona slugs or "user")
- **done:** ${beadDistribution.done} beads (completed — these represent project history)

All beads must have team set to "${teamSlug}".
For "done" beads, assigned_to should be a descriptive persona slug (e.g., "maya-chen").
For "in_progress" beads, assigned_to should be a persona slug or "user".
For "open" beads, assigned_to should be null.

## Experience Calibration
${calibration}

## Type Distribution
Distribute bead types roughly as follows (adjust based on project maturity):
- feature: 30-40%
- bugfix: 10-20%
- refactor: 10-15%
- test: 10-20%
- docs: 5-10%
- perf: 5-10%
- infra: 5-10%

## Dependency Guidelines
- 20-30% of beads should have at least one dependency
- Dependencies reference other beads by their exact title string
- "done" beads can depend on other "done" beads
- "open" beads can depend on "done" or "in_progress" beads
- No circular dependencies

Respond with a single JSON object matching this schema:
\`\`\`json
${JSON.stringify(OUTPUT_SCHEMA, null, 2)}
\`\`\``;

  return {
    systemPrompt,
    userPrompt,
    outputSchema: OUTPUT_SCHEMA,
  };
}

/**
 * Validate an array of bead definitions from LLM output.
 *
 * Checks types, enums, required fields, and dependency consistency.
 * Returns validated BeadCreate objects ready for storage.
 */
export function validateBeadOutput(output: unknown, teamSlug: string): BeadCreate[] {
  if (output === null || output === undefined || typeof output !== 'object') {
    throw new BeadValidationError('Bead output must be a non-null object');
  }

  const obj = output as Record<string, unknown>;

  if (!Array.isArray(obj.beads) || obj.beads.length === 0) {
    throw new BeadValidationError('Bead output must contain a non-empty "beads" array');
  }

  const titleSet = new Set<string>();
  const beads: BeadCreate[] = [];

  // First pass: collect all titles for dependency validation
  for (let i = 0; i < obj.beads.length; i++) {
    const raw = obj.beads[i] as Record<string, unknown>;
    if (typeof raw.title !== 'string' || raw.title.trim() === '') {
      throw new BeadValidationError(`beads[${i}].title must be a non-empty string`);
    }
    if (titleSet.has(raw.title as string)) {
      throw new BeadValidationError(`Duplicate bead title: "${raw.title}"`);
    }
    titleSet.add(raw.title as string);
  }

  // Second pass: full validation
  for (let i = 0; i < obj.beads.length; i++) {
    const raw = obj.beads[i] as Record<string, unknown>;

    // Required strings
    for (const field of ['title', 'description'] as const) {
      if (typeof raw[field] !== 'string' || (raw[field] as string).trim() === '') {
        throw new BeadValidationError(`beads[${i}].${field} must be a non-empty string`);
      }
    }

    // Type enum
    if (!VALID_BEAD_TYPES.includes(raw.type as BeadType)) {
      throw new BeadValidationError(
        `beads[${i}].type must be one of [${VALID_BEAD_TYPES.join(', ')}], got: "${raw.type}"`,
      );
    }

    // Status enum
    if (!VALID_STATUSES.includes(raw.status as BeadStatus)) {
      throw new BeadValidationError(
        `beads[${i}].status must be one of [${VALID_STATUSES.join(', ')}], got: "${raw.status}"`,
      );
    }

    // Priority enum
    if (!VALID_PRIORITIES.includes(raw.priority as BeadPriority)) {
      throw new BeadValidationError(
        `beads[${i}].priority must be one of [${VALID_PRIORITIES.join(', ')}], got: "${raw.priority}"`,
      );
    }

    // assigned_to: string or null
    if (raw.assigned_to !== null && typeof raw.assigned_to !== 'string') {
      throw new BeadValidationError(
        `beads[${i}].assigned_to must be a string or null, got: ${typeof raw.assigned_to}`,
      );
    }

    // acceptance_criteria: non-empty string array
    if (!Array.isArray(raw.acceptance_criteria) || raw.acceptance_criteria.length === 0) {
      throw new BeadValidationError(`beads[${i}].acceptance_criteria must be a non-empty array`);
    }
    for (let j = 0; j < raw.acceptance_criteria.length; j++) {
      if (typeof raw.acceptance_criteria[j] !== 'string' || (raw.acceptance_criteria[j] as string).trim() === '') {
        throw new BeadValidationError(`beads[${i}].acceptance_criteria[${j}] must be a non-empty string`);
      }
    }

    // skill_targets: array of valid SkillDimension
    if (!Array.isArray(raw.skill_targets) || raw.skill_targets.length === 0) {
      throw new BeadValidationError(`beads[${i}].skill_targets must be a non-empty array`);
    }
    for (const st of raw.skill_targets as unknown[]) {
      if (!VALID_SKILL_DIMENSIONS.includes(st as SkillDimension)) {
        throw new BeadValidationError(
          `beads[${i}].skill_targets contains invalid dimension: "${st}"`,
        );
      }
    }

    // depends_on: array of strings that must reference existing bead titles
    if (!Array.isArray(raw.depends_on)) {
      throw new BeadValidationError(`beads[${i}].depends_on must be an array`);
    }
    for (const dep of raw.depends_on as unknown[]) {
      if (typeof dep !== 'string') {
        throw new BeadValidationError(`beads[${i}].depends_on items must be strings`);
      }
      if (!titleSet.has(dep as string)) {
        throw new BeadValidationError(
          `beads[${i}].depends_on references unknown bead title: "${dep}"`,
        );
      }
      if (dep === raw.title) {
        throw new BeadValidationError(`beads[${i}] depends on itself`);
      }
    }

    // Optional arrays
    const files = Array.isArray(raw.files) ? (raw.files as string[]) : undefined;
    const hints = Array.isArray(raw.hints) ? (raw.hints as string[]) : undefined;

    beads.push({
      title: raw.title as string,
      description: raw.description as string,
      team: teamSlug, // Override with trusted input
      priority: raw.priority as BeadPriority,
      status: raw.status as BeadStatus,
      assigned_to: (raw.assigned_to as string | null),
      depends_on: raw.depends_on as string[], // Title-based; caller resolves to IDs
      acceptance_criteria: raw.acceptance_criteria as string[],
      skill_targets: raw.skill_targets as SkillDimension[],
      type: raw.type as BeadType,
      ...(files ? { files } : {}),
      ...(hints ? { hints } : {}),
    });
  }

  // Cycle detection across the dependency graph (title-based)
  detectCycles(beads);

  return beads;
}

/**
 * Detect cycles in the bead dependency graph.
 * Throws if a cycle is found.
 */
function detectCycles(beads: BeadCreate[]): void {
  const titleIndex = new Map<string, number>();
  for (let i = 0; i < beads.length; i++) {
    titleIndex.set(beads[i].title, i);
  }

  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;

  const state = new Array<number>(beads.length).fill(UNVISITED);

  function visit(idx: number, path: string[]): void {
    if (state[idx] === DONE) return;
    if (state[idx] === IN_PROGRESS) {
      throw new BeadValidationError(
        `Circular dependency detected: ${[...path, beads[idx].title].join(' -> ')}`,
      );
    }

    state[idx] = IN_PROGRESS;
    path.push(beads[idx].title);

    for (const dep of beads[idx].depends_on) {
      const depIdx = titleIndex.get(dep);
      if (depIdx !== undefined) {
        visit(depIdx, path);
      }
    }

    path.pop();
    state[idx] = DONE;
  }

  for (let i = 0; i < beads.length; i++) {
    if (state[i] === UNVISITED) {
      visit(i, []);
    }
  }
}

export class BeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeadValidationError';
  }
}
