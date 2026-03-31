import { z } from 'zod';
import type { registerTool as RegisterToolFn } from './index.js';
import { getProgressParams, type ProgressParams } from '../simulation/progress-slider.js';

export interface ScaffoldPlan {
  description: string;
  language: string;
  maturity: number;
  progressParams: ProgressParams;
  structure: { path: string; type: 'directory' | 'file'; purpose: string }[];
  gitHistoryPlan: { commitCount: number; authorDistribution: string };
  beadTargets: { open: number; inProgress: number; done: number };
  generationPrompt: string;
}

/**
 * Build a scaffold plan from user inputs and progress parameters.
 */
function buildScaffoldPlan(
  description: string,
  maturity: number,
  experienceLevel: string,
  language: string,
  flavor: string | undefined,
): ScaffoldPlan {
  const progressParams = getProgressParams(maturity);

  const structure = buildProjectStructure(language, progressParams);
  const beadTargets = progressParams.beadDistribution;

  const generationPrompt = buildGenerationPrompt({
    description,
    language,
    maturity,
    experienceLevel,
    flavor,
    progressParams,
    structure,
  });

  return {
    description,
    language,
    maturity,
    progressParams,
    structure,
    gitHistoryPlan: {
      commitCount: progressParams.gitHistoryDepth,
      authorDistribution: getAuthorDistribution(maturity),
    },
    beadTargets,
    generationPrompt,
  };
}

function getAuthorDistribution(maturity: number): string {
  if (maturity < 0.2) {
    return '1-2 authors, mostly the project creator';
  }
  if (maturity < 0.5) {
    return '2-3 authors, a small founding team';
  }
  if (maturity < 0.75) {
    return '3-5 authors, a growing team with varying commit frequencies';
  }
  return '5-8 authors, a mature team with clear ownership areas';
}

function buildProjectStructure(
  language: string,
  params: ProgressParams,
): { path: string; type: 'directory' | 'file'; purpose: string }[] {
  const structure: { path: string; type: 'directory' | 'file'; purpose: string }[] = [];

  // Common structure
  structure.push(
    { path: 'src/', type: 'directory', purpose: 'Main source code' },
    { path: 'README.md', type: 'file', purpose: 'Project documentation' },
    { path: '.gitignore', type: 'file', purpose: 'Git ignore rules' },
  );

  // Language-specific files
  const langLower = language.toLowerCase();
  if (langLower === 'typescript' || langLower === 'javascript') {
    structure.push(
      { path: 'package.json', type: 'file', purpose: 'Node.js package manifest' },
      { path: 'tsconfig.json', type: 'file', purpose: 'TypeScript configuration' },
      { path: 'src/index.ts', type: 'file', purpose: 'Application entry point' },
    );
  } else if (langLower === 'python') {
    structure.push(
      { path: 'pyproject.toml', type: 'file', purpose: 'Python project configuration' },
      { path: 'src/__init__.py', type: 'file', purpose: 'Package init' },
      { path: 'src/main.py', type: 'file', purpose: 'Application entry point' },
    );
  } else if (langLower === 'rust') {
    structure.push(
      { path: 'Cargo.toml', type: 'file', purpose: 'Rust package manifest' },
      { path: 'src/main.rs', type: 'file', purpose: 'Application entry point' },
      { path: 'src/lib.rs', type: 'file', purpose: 'Library root' },
    );
  } else if (langLower === 'go') {
    structure.push(
      { path: 'go.mod', type: 'file', purpose: 'Go module definition' },
      { path: 'main.go', type: 'file', purpose: 'Application entry point' },
      { path: 'internal/', type: 'directory', purpose: 'Internal packages' },
    );
  } else {
    structure.push(
      { path: 'src/main.' + langLower, type: 'file', purpose: 'Application entry point' },
    );
  }

  // Test directory (based on maturity)
  if (params.testCoverage !== 'minimal') {
    structure.push(
      { path: 'tests/', type: 'directory', purpose: 'Test suite' },
    );
  }

  // Docs directory (based on maturity)
  if (params.documentationLevel !== 'sparse') {
    structure.push(
      { path: 'docs/', type: 'directory', purpose: 'Project documentation' },
    );
  }

  // CI/CD (moderate+ maturity)
  if (params.maturity >= 0.3) {
    structure.push(
      { path: '.github/workflows/', type: 'directory', purpose: 'CI/CD pipelines' },
    );
  }

  return structure;
}

function buildGenerationPrompt(opts: {
  description: string;
  language: string;
  maturity: number;
  experienceLevel: string;
  flavor: string | undefined;
  progressParams: ProgressParams;
  structure: { path: string; type: 'directory' | 'file'; purpose: string }[];
}): string {
  const { description, language, maturity, experienceLevel, flavor, progressParams, structure } = opts;

  const structureList = structure
    .map((s) => `  - ${s.path} (${s.type}) — ${s.purpose}`)
    .join('\n');

  const flavorNote = flavor
    ? `\nCreative direction / flavor: "${flavor}". Infuse this personality into naming, comments, and culture.`
    : '';

  return `Generate a ${language} project scaffold for the following:

**Description:** ${description}
**Maturity:** ${maturity} (${progressParams.codeVolume} code volume)
**Experience level:** ${experienceLevel}
**Tech debt:** ${progressParams.techDebtLevel}
**Documentation:** ${progressParams.documentationLevel}
**Test coverage:** ${progressParams.testCoverage}
**Established patterns:** ${progressParams.establishedPatterns ? 'yes' : 'no'}
${flavorNote}

## Project Structure

${structureList}

## Code Volume Targets

- **Volume:** ${progressParams.codeVolume}
- Generate code proportional to a ${progressParams.codeVolume} codebase
- Include realistic implementations, not just stubs (unless maturity is very low)
${progressParams.establishedPatterns ? '- Follow consistent architectural patterns throughout' : '- Patterns are still forming; some inconsistency is natural'}

## Git History

- Target **${progressParams.gitHistoryDepth} commits** of realistic git history
- Commits should tell the story of the project's evolution
- Use conventional commit messages
- Attribute commits to generated persona names (will be created during init)

## Bead Targets (Issue Tracker State)

- **Open:** ${progressParams.beadDistribution.open} tasks
- **In Progress:** ${progressParams.beadDistribution.inProgress} tasks
- **Done:** ${progressParams.beadDistribution.done} tasks
- Beads should reflect realistic work: features, bugs, refactors, docs

## After Code Generation

Run the standard Atelier init flow:
1. Generate organization structure
2. Generate teams and personas
3. Generate agent files
4. Attribute git history to generated personas`;
}

export function registerScaffoldTools(register: typeof RegisterToolFn) {
  register(
    'atelier_scaffold_generate',
    'Generate a structured scaffold plan for a new project. Returns a ScaffoldPlan with project structure, code volume targets, git history depth, and bead distribution based on the specified maturity level. The calling agent should execute this plan to create the project.',
    z.object({
      description: z.string().describe('Description of the project to scaffold'),
      maturity: z.number().describe('Project maturity from 0 (brand new) to 0.9 (mature). Controls code volume, git history depth, test coverage, and documentation level.'),
      experience_level: z.string().describe('User experience level: apprentice, journeyman, craftsperson, or master'),
      language: z.string().optional().describe('Primary programming language (e.g. typescript, python, rust, go). Defaults to typescript.'),
      flavor: z.string().optional().describe('Creative direction for the organization personality (e.g. "a scrappy startup", "a pirate ship crew")'),
    }),
    async (args, _ctx) => {
      const description = args.description as string;
      const maturity = args.maturity as number;
      const experienceLevel = args.experience_level as string;
      const language = (args.language as string) || 'typescript';
      const flavor = args.flavor as string | undefined;

      const plan = buildScaffoldPlan(description, maturity, experienceLevel, language, flavor);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ plan }, null, 2),
          },
        ],
      };
    },
  );
}
