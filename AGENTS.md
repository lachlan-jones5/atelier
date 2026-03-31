# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Development Conventions

### Runtime and Language

- **Runtime:** Bun (not Node)
- **Language:** TypeScript with `strict: true` (see `tsconfig.json`)
- **Module system:** ESNext modules (`"type": "module"` in package.json)
- **Target:** ES2022

### File Naming

- Source files use kebab-case: `persona-registry.ts`, `bead-store.ts`
- One module per file; filename matches the primary export concept
- Directory-level `index.ts` files re-export public API from that module
- Tool files in `src/tools/` match the domain they serve: `bead.ts`, `org.ts`, `review.ts`

### Tool Registration Pattern

MCP tools follow the `registerXTools` pattern. Each tool domain exports a single registration function:

```typescript
// src/tools/example.ts
import { z } from 'zod';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerExampleTools(register: typeof RegisterToolFn) {
  register(
    'atelier_example_action',
    'Description of what this tool does',
    z.object({
      param: z.string().describe('What this parameter means'),
    }),
    async (args, ctx) => {
      // Implementation
      return {
        content: [{ type: 'text', text: 'result' }],
      };
    },
  );
}
```

All tool names are prefixed with `atelier_`. Input schemas use Zod and are converted to JSON Schema automatically. The registration function is imported and called in `src/tools/index.ts`.

### Type Conventions

- Use `import type` for interfaces and type-only imports:
  ```typescript
  import type { AtelierContext } from '../util/types.js';
  import type { registerTool as RegisterToolFn } from './index.js';
  ```
- Shared types live in `src/util/types.ts` or domain-specific `types.ts` files (e.g., `src/archetypes/types.ts`)
- Prefer interfaces over type aliases for object shapes
- All file imports use `.js` extensions (required for ESNext module resolution with bundler)

### Testing

- Test framework: `bun:test` (built-in Bun test runner)
- Test files live in `test/` mirroring the `src/` directory structure
- Tests that touch the filesystem use temporary directories (cleaned up after)
- Run all tests: `bun test`
- Test directories: `test/tools/`, `test/core/`, `test/archetypes/`, `test/integration/`, etc.

### Project Structure

```
src/
├── server.ts           # MCP server (Server class, handler setup)
├── index.ts            # Entry point
├── tools/              # MCP tool registrations (one file per domain)
│   └── index.ts        # registerAllTools + callTool dispatcher
├── core/               # Domain models (Organization, Team, Persona, Bead, Session)
├── archetypes/         # Behavioral archetype definitions and instantiation
├── curriculum/         # Curriculum packs (YAML) and loader
├── simulation/         # Simulation clock and advance logic
├── generation/         # Codebase analysis and bead generation
├── review/             # Code review engine
├── memory/             # Cross-session agent memory
├── skills/             # Skill tracking and assessment
├── incidents/          # Incident simulation
├── analysis/           # Repository structure analysis
├── cli/                # CLI commands (init, scaffold)
├── util/               # Shared utilities, types, YAML helpers, paths
└── templates/          # Scaffolding templates
```

### Key Patterns

- **Context threading:** Tool handlers receive `AtelierContext` (`{ projectRoot, atelierDir }`) — all file paths are derived from these roots
- **YAML for config, JSON for runtime state:** Configuration files (team, org, beads, curriculum packs) use YAML; session state and chat logs use JSON/JSONL
- **Archetype instantiation:** Archetypes (in `src/archetypes/definitions.ts`) are templates; the instantiator creates concrete personas with individual variation from the archetype's ranges

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
