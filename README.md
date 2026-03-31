# Atelier

**A craftsperson's workshop for software engineers.**

Atelier is an MCP server and multi-agent system for [Claude Code](https://claude.com/claude-code) that transforms any Git repository into a simulated collaborative software engineering organization. AI-powered teammates — dynamically generated from behavioral archetypes with distinct personalities — work alongside you on real code, but you do your own work by hand.

There is a growing gap between "can write code" and "can operate as a software engineer." The missing skills are collaborative, contextual, and situational: reading someone else's code, scoping work into reviewable units, navigating dependencies, giving and receiving code review, and working in a codebase you didn't write alongside people whose context you don't fully share. Atelier creates a space where you develop these skills through deliberate practice.

## Features

- **Organization model** — A generated company with teams, cross-team dependencies, and a living codebase. Your teammates have branches in flight, opinions about architecture, and work that interacts with yours.
- **Dynamic team generation** — Teams are assembled from behavioral archetypes and customized to your project's domain. Each teammate has a name, role, expertise, communication style, and opinions — all generated to fit your codebase.
- **Multi-agent architecture** — Each teammate is a dedicated Claude Code agent. Talk to the whole team in group chat, DM individual teammates, or coordinate across teams through an org hub.
- **Persona archetypes** — 10 built-in archetypes (The Mentor, The Gatekeeper, The Pragmatist, and more) that define how teammates think, communicate, and review code.
- **Beads (work units)** — Scoped, dependency-aware tasks assigned like real engineering work. Deliberately incomplete, just like real tickets — you'll need to explore the codebase and ask questions.
- **Code review** — Submit your branch for review and receive substantive, contextual feedback from teammates who read your actual diff and respond in character.
- **Curriculum packs** — Pre-built learning sequences targeting specific engineering skills, from REST API design to production debugging.
- **Skill assessment** — Track progression across skill dimensions: reading code, testing, debugging, design, review, communication, and ops awareness.
- **Incident simulation** — A production alert fires. The team scrambles. You're on call. Debug under pressure with teammates coordinating in chat.
- **Progress slider** — Select project maturity from greenfield (0%) to near-complete (90%), affecting code volume, git history depth, bead complexity, and tech debt levels.
- **User flavor** — Inject personality into team generation ("Make them all Australians", "startup energy", "grumpy Unix wizards") for a team that matches your vibe.
- **Persistent memory** — Each agent has append-only JSONL memory that survives across sessions, making ephemeral sub-agents effectively persistent.

## Quick Start

```bash
# Install dependencies
bun install

# Initialize in any Git repository
cd my-project
bunx atelier init

# Or scaffold a new project from a description
bunx atelier scaffold
```

`atelier init` analyzes your repository (language, framework, structure, tests, build system), generates an `.atelier/` directory with your organization, teams, personas, and bead backlog, then creates Claude Code agent files in `.claude/agents/`.

Once initialized, interact with your team through Claude Code's `/agent` command:

```
> /agent backend

[Backend Team Chat]
Good morning! The team is online.

[Marcus — Tech Lead] Hey! We've got a few things in flight today.
Aisha is finishing up the auth middleware refactor on her branch.
I've pulled in a new feature request — we need to add rate limiting
to the public API endpoints.

[Marcus] @you — I've got a bead for you. Take a look.
```

## Architecture

Atelier uses a multi-agent architecture where each teammate is a real Claude Code agent with its own persistent memory:

```
┌─────────────────────────────────────────────────────┐
│                 Claude Code Session                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │            /agent atelier (Org Hub)           │    │
│  │  Cross-team status, curriculum, incidents     │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │                                     │
│  ┌──────────────▼───────────────────────────────┐    │
│  │         /agent <team> (Team Orchestrator)     │    │
│  │  Group chat — spawns sub-agents per persona   │    │
│  └──┬──────────┬──────────┬─────────────────────┘    │
│     │          │          │                          │
│  ┌──▼───┐  ┌──▼───┐  ┌──▼───┐                      │
│  │Marcus│  │Aisha │  │Jordan│  ← Sub-agents         │
│  └──────┘  └──────┘  └──────┘    (ephemeral but     │
│                                   memory-persistent)  │
│  ┌──────────────────────────────────────────────┐    │
│  │     /agent <name> (Direct Messages)           │    │
│  │  1:1 conversation with any teammate           │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │     /agent atelier-review (Review Channel)    │    │
│  │  Cross-team code review workflow              │    │
│  └──────────────────────────────────────────────┘    │
│                     │                                │
│              ┌──────▼──────┐                         │
│              │ Atelier MCP │  ← State machine &      │
│              │   Server    │    context provider      │
│              └──────┬──────┘                         │
└─────────────────────┼───────────────────────────────┘
                      │
               ┌──────▼──────┐
               │  .atelier/  │
               │  org.yaml   │
               │  teams/     │
               │  beads/     │
               │  memory/    │
               │  history/   │
               └─────────────┘
```

The MCP server is **agent-gated** — it's not exposed to your normal Claude Code session. Tools are only accessible through the generated agent files in `.claude/agents/`, each with an `allowedTools` whitelist restricting access to `mcp__atelier__*` tools.

No separate API calls or costs beyond your Claude Code subscription. Every interaction runs through the same session. Agent quality scales with Claude's capability.

## Agent Channels

| Channel | Command | Description |
|---|---|---|
| Org hub | `/agent atelier` | Organization-wide status, cross-team activity, curriculum, incidents |
| Team chat | `/agent <team>` | Your team's group chat — ask questions, get updates, coordinate |
| Direct message | `/agent <name>` | DM a specific teammate for focused 1:1 discussion |
| Code review | `/agent atelier-review` | Submit work for review or review a teammate's branch |

## Archetypes

Atelier ships with 10 built-in behavioral archetypes that define how teammates think, communicate, and give feedback:

| Archetype | Description |
|---|---|
| **The Mentor** | Patient, Socratic guidance. Helps you find the answer yourself. Leads reviews with what you did well. |
| **The Gatekeeper** | Holds the line on quality. Thorough reviews, high standards, references past incidents. Won't let shortcuts through. |
| **The Pragmatist** | Ships working software. Cuts through analysis paralysis. Pushes back on over-engineering. |
| **The Newbie** | Enthusiastic newcomer. Asks revealing questions, occasionally makes mistakes. Practice mentoring from the other side. |
| **The Domain Expert** | Deep specialist who speaks with quiet authority in their area. Catches subtle semantic errors others miss. |
| **The Firefighter** | Calm under pressure, thinks in failure modes. First person you want on a production incident. |
| **The Architect** | Big-picture thinker. Sees the system as a whole, thinks in trade-offs, asks "how does this interact with..." |
| **The Connector** | Broadest social graph on the team. Spots coordination needs, links people across teams, prevents information silos. |
| **The Skeptic** | Devil's advocate. Questions assumptions, stress-tests plans, saves the team from groupthink. |
| **The Craftsperson** | Treats code as craft. Cares about clean abstractions, meaningful names, and tests that document behavior. |

Archetypes are selected dynamically based on your project domain — a compiler project gets more Gatekeepers and Domain Experts, a web app gets more Pragmatists and Connectors. Each archetype defines communication patterns, review style, helpfulness range, teaching approach, conflict style, strengths, and blind spots.

## Multi-Team / Organization Model

Atelier supports full organization simulation with multiple teams. This is particularly useful for monorepo projects:

```yaml
# Example: AI chip company monorepo
organization:
  name: "Tensor Systems"
  teams:
    - slug: rtl-design
      domain: "Hardware RTL"
      tech_stack: [SystemVerilog, Chisel]
    - slug: compiler
      domain: "ML Compiler"
      tech_stack: [C++, MLIR, LLVM]
    - slug: runtime
      domain: "Device Runtime"
      tech_stack: [Rust, CUDA]
    - slug: firmware
      domain: "Firmware"
      tech_stack: [C, Assembly]
```

You can be on multiple teams, wear different hats, and work on cross-team beads with dependencies that span team boundaries.

## Customization

### Flavor Prompts

Inject personality into your team during `atelier init`:

```
Experience level? journeyman
Any flavor for your team? Make them all Australians who love cricket metaphors
```

This influences name generation, communication style, cultural references, and team dynamics while preserving the underlying archetype behaviors.

### Experience Levels

| Level | What to expect |
|---|---|
| **Apprentice** | Well-scoped beads, clear acceptance criteria, limited dependencies, hints available |
| **Journeyman** | Moderate ambiguity, cross-module work, dependency chains, fewer hints |
| **Craftsperson** | Vague requirements, architectural decisions required, complex dependencies |
| **Master** | Adversarial: shifting requirements mid-bead, conflicting teammate opinions, production incidents |

### Progress Slider

Select project maturity at init to control the simulation starting point:

| Maturity | Code Volume | Git History | Tech Debt | Test Coverage |
|---|---|---|---|---|
| **0% (Greenfield)** | Minimal stubs | Days | None | Aspirational |
| **30%** | Core modules | Weeks | Emerging | Partial |
| **60%** | Full codebase | Months | Real | Moderate |
| **90% (Near-complete)** | Production-scale | Years | Legacy | Comprehensive |

## Curriculum Packs

Pre-built learning sequences targeting specific engineering skills:

| Pack | Focus |
|---|---|
| **Build a REST API from Scratch** | Project scaffolding, CRUD endpoints, authentication, production readiness |
| **Write Meaningful Tests** | Unit tests, integration tests, test design, coverage that catches real bugs |
| **Give and Receive Effective Code Review** | Constructive feedback, responding to comments, review from both sides |
| **Debug Production Incidents** | Log analysis, root cause identification, systematic debugging under pressure |
| **Contribute to Open Source** | Navigating unfamiliar codebases, focused changes, submitting quality contributions |

## Incident Simulation

Pre-built incident scenarios that test your ability to debug under pressure:

| Scenario | Description |
|---|---|
| **Memory Leak** | Gradual heap growth in production, requires profiling and root cause analysis |
| **Cascading Failure** | One service goes down, taking others with it. Find the domino. |
| **Data Corruption** | Silent data integrity issue. Trace it back through the write path. |
| **Deploy Rollback** | The latest deploy broke something. Triage, decide, and execute under pressure. |

## Configuration

All state lives in `.atelier/` within your repository (add to `.gitignore` — it's your personal training state):

```
.atelier/
├── config.yaml              # experience_level, flavor, progress
├── org.yaml                 # Organization: name, mission, culture, teams
├── archetypes.yaml          # Archetype configuration
├── state.json               # Session state
├── teams/<team-slug>/
│   ├── team.yaml            # Team definition, tech stack, codebase paths
│   ├── personas/<name>.yaml # Full persona definition + state
│   ├── beads/<id>.yaml      # Work units with dependencies
│   └── memory/<name>.jsonl  # Append-only persona memory
├── cross-team/beads/        # Beads spanning team boundaries
├── skills.json              # Skill progression tracking
├── curriculum/active.yaml   # Active curriculum pack state
├── incidents/active.yaml    # Active incident state
└── history/chat.jsonl       # Full chat history
```

## Development

Atelier is built with TypeScript in strict mode, running on [Bun](https://bun.sh).

```bash
# Install dependencies
bun install

# Run tests (284 tests)
bun test

# Run the MCP server
bun run src/index.ts
```

### Project Structure

```
src/
├── index.ts            # Entry point
├── server.ts           # MCP server setup and handler dispatch
├── tools/              # 30+ MCP tool handlers (session, bead, team, persona, ...)
├── core/               # Domain models: Organization, Team, Persona, Bead, Session
├── archetypes/         # 10 behavioral archetype definitions + selection algorithm
├── generation/         # Prompt builders for org/team/persona/bead/agent generation
├── simulation/         # Simulation clock, advance engine, progress slider
├── analysis/           # Repository analysis (language, framework, structure, ownership)
├── review/             # Multi-round code review engine
├── memory/             # JSONL append-only per-persona memory
├── curriculum/         # 5 curriculum packs with sequenced learning objectives
├── skills/             # Skill tracking with weighted moving average scoring
├── incidents/          # 4 incident scenarios with escalation mechanics
├── cli/                # CLI commands (init, scaffold)
└── util/               # Shared utilities, types, YAML helpers, path sanitization
templates/              # Handlebars-like agent templates (org, team, persona, review)
test/                   # 284 tests: unit, tool handler, and integration
```

### Dependencies

- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/sdk) — MCP server protocol
- [`zod`](https://github.com/colinhacks/zod) — Schema validation and runtime input parsing
- [`yaml`](https://github.com/eemeli/yaml) — YAML reading/writing for configuration
- [`simple-git`](https://github.com/steveukx/git-js) — Git operations for codebase analysis

## License

MIT

---

*Atelier: where the craft is learned by doing, alongside others who care about the work.*
