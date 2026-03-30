# Atelier — Design Document

**A craftsperson's workshop for software engineers.**

Atelier is an MCP server for Claude Code that transforms any Git repository — or one it generates from scratch — into a simulated collaborative software engineering environment. AI-powered teammates work alongside you on real code, but you do your own work by hand. The goal is to build genuine engineering skill, intuition, and team fluency through practice, not automation.

---

## 1. Problem Statement

There is a growing gap between "can write code" and "can operate as a software engineer." The missing skills are not syntactic — they are collaborative, contextual, and situational:

- Reading and understanding someone else's code and intent
- Scoping work into coherent, reviewable units
- Asking the right questions when requirements are ambiguous
- Navigating dependencies, blockers, and shifting interfaces
- Giving and receiving code review
- Working in a codebase you didn't write, alongside people whose context you don't fully share

Solo projects, tutorials, and LeetCode don't build these muscles. AI-assisted coding actively atrophies them. Atelier creates a space where you can develop these skills through deliberate practice in a realistic team environment.

---

## 2. Core Principles

1. **You do the work.** AI teammates collaborate with you — they don't write your code. The learning comes from the doing.
2. **The codebase is real.** Whether you bring an existing repo or have Atelier scaffold one, you work in a full codebase with build systems, tests, and history — not a toy example.
3. **The friction is the feature.** Merge conflicts, unclear requirements, incomplete documentation, blocking dependencies — these aren't bugs in the simulation, they're the curriculum.
4. **Personas matter.** Teammates have distinct expertise, communication styles, and opinions. Learning to work with different people is part of the craft.
5. **Progressive mastery.** The system meets you where you are and grows with you.

---

## 3. User Experience

### 3.1 Setup

Atelier supports two modes of starting a project:

**Mode A: Bring Your Own Repo**

```bash
# Install the MCP server
npm install -g atelier-dev

# Initialise in any existing repository
cd my-project
atelier init
```

`atelier init` performs a one-time setup:

- Analyses the repository (language, framework, structure, existing tests, build system)
- Generates an `.atelier/` directory containing team configuration, project state, and bead backlog
- Registers the Atelier MCP server in the local Claude Code configuration

**Mode B: Scaffold a Project**

```bash
atelier scaffold
```

Scaffold mode lets you describe a project and a point in its development timeline. Atelier generates a realistic codebase as if a team has already been working on it — complete with git history, existing patterns, partial implementations, technical debt, and TODO comments. You join the team mid-flight.

```
$ atelier scaffold

What kind of project? > An MLIR-based compiler for a novel AI accelerator
                        with block floating point support

What stage is it at?  > Mid-development. The frontend parsing and basic
                        IR passes work. The backend code generation for
                        the accelerator's ISA is partially implemented.
                        The team is working on optimisation passes and
                        the BFP numerics library.

Your experience level? > Craftsperson
```

The scaffold process:

1. Claude Code generates the codebase structure, source files, tests, build system, and README
2. Creates a realistic git history (multiple authors, feature branches merged, some rough edges)
3. Initialises the Atelier team with expertise matched to the project domain
4. Generates an initial bead backlog based on what's "in flight" and what's next
5. You start with a codebase that feels like something you'd encounter on your first week at a new job

### 3.2 Starting a Session

When you open Claude Code in an Atelier-initialised repo, the MCP server boots and you enter the **team workspace** — a persistent group chat with your AI teammates.

A typical session opening might look like:

```
[Atelier] Good morning. The team is online.

[Priya — Tech Lead] Hey! So we've got a few things in flight today.
James is finishing up the auth middleware refactor on his branch.
I've pulled in a new feature request — we need to add rate limiting
to the public API endpoints. I'm going to break that into a few beads.

[James — Senior Engineer] Yeah, the auth stuff is close. Might need
someone to review it later today. Heads up — I changed the middleware
signature, so anything touching request handlers will need to adapt.

[Priya] @you — I've got a bead for you. Take a look.
```

### 3.3 Beads

A **bead** is the established term in agentic coding for a unit of work — a scoped, actionable task. Atelier adopts beads as its native work unit. Beads are scoped, described, and assigned like real engineering work:

```
┌─────────────────────────────────────────────────┐
│ BEAD #014                                       │
│ Title: Add rate limiting to /api/v1/search      │
│ Priority: Medium                                │
│ Assigned: You                                   │
│ Depends on: BEAD #012 (James — in review)       │
│                                                  │
│ Description:                                    │
│ Add rate limiting (100 req/min per API key) to   │
│ the search endpoint. Should return 429 with      │
│ Retry-After header when exceeded. Check how      │
│ James handled it for the /users endpoint —       │
│ we want consistency.                             │
│                                                  │
│ Acceptance criteria:                             │
│ - Rate limit enforced per API key                │
│ - 429 response with correct headers              │
│ - Unit tests covering limit hit and reset        │
│ - Consistent with existing rate limit patterns   │
└─────────────────────────────────────────────────┘
```

Key properties of beads:

- **Dependency-aware.** Your bead may depend on another teammate's work landing first. You might need to check out their branch, read their PR, or wait.
- **Deliberately incomplete.** Like real tickets, beads don't spell out every implementation detail. You'll need to explore the codebase and possibly ask questions.
- **Scoped to your level.** The system calibrates bead complexity based on your configured experience level and observed performance.

### 3.4 Doing the Work

You check out a branch, read the relevant code, and make your changes — **without AI code generation.** You use your editor, your terminal, your brain.

If you get stuck or have questions, you ask the team:

```
[You] Hey, I'm looking at the rate limiter. Are we using an in-memory
store or Redis for tracking request counts?

[James] We went with Redis for the /users endpoint since it needs to
work across multiple instances. Check src/middleware/rate-limit.ts —
the store interface is abstracted so you can swap backends.

[Priya] Good question. Let's keep it consistent — use Redis. And make
sure you read James's tests, he covered some edge cases around TTL
expiry that are easy to miss.
```

Agents respond in character. They have different knowledge, opinions, and communication styles. They can:

- Answer questions about the codebase, architecture, or requirements
- Point you toward relevant files or documentation
- Give opinions or push back on your approach
- Review your code when you submit it

They will **not** write your code for you or give you copy-pasteable solutions.

### 3.5 Submitting for Review

When your work is done:

```
[You] Bead #014 is ready for review. I've pushed to feature/rate-limit-search.

[Priya] Nice, I'll take a look.
...
[Priya] A few comments:
1. The Retry-After value is in seconds but your test asserts milliseconds — 
   check the RFC.
2. You're creating a new Redis connection per request in the middleware. 
   James's implementation reuses a shared client — look at how he did it.
3. Good test coverage otherwise. Fix those two things and I'll approve.
```

Reviews are substantive. Agents read your actual diff and give real, contextual feedback.

### 3.6 The Living Codebase

While you work, your teammates are also working. Their branches get merged. The codebase evolves. You might need to:

- Rebase onto main after a teammate's PR lands
- Adapt your approach because an interface changed
- Review a teammate's PR when asked

This creates the authentic, dynamic experience of working in a team.

---

## 4. Architecture

### 4.1 System Overview

Atelier runs as an MCP server within a Claude Code subscription session. Claude Code is the brain — it generates all agent responses, produces teammate code, and drives the simulation. The MCP server is a state machine and context provider: it tracks project state, manages personas, and feeds Claude Code the right context to respond in character.

```
┌──────────────────────────────────────────────────────┐
│                    Claude Code                        │
│              (User's terminal session)                │
│                                                       │
│  Claude Code handles:                                │
│  - Generating agent responses in character            │
│  - Producing teammate code (commits, branches)        │
│  - Reviewing user diffs with persona-appropriate      │
│    feedback                                           │
│  - Orchestrating multi-agent conversations            │
│                                                       │
│  ┌─────────────┐    ┌─────────────────────────────┐  │
│  │   User's     │    │   Atelier MCP Server        │  │
│  │   prompts    │◄──►│   (state + context)         │  │
│  └─────────────┘    │                             │  │
│                      │  ┌───────────────────────┐  │  │
│                      │  │   Session Manager      │  │  │
│                      │  └──────────┬────────────┘  │  │
│                      │             │                │  │
│                      │  ┌──────────▼────────────┐  │  │
│                      │  │   Persona Registry     │  │  │
│                      │  │  ┌─────┐ ┌─────┐      │  │  │
│                      │  │  │Priya│ │James│ ...   │  │  │
│                      │  │  └─────┘ └─────┘      │  │  │
│                      │  └──────────┬────────────┘  │  │
│                      │             │                │  │
│                      │  ┌──────────▼────────────┐  │  │
│                      │  │   Project Engine        │  │  │
│                      │  │  ┌──────┐ ┌────────┐  │  │  │
│                      │  │  │Beads │ │Codebase│  │  │  │
│                      │  │  │      │ │Analyser│  │  │  │
│                      │  │  └──────┘ └────────┘  │  │  │
│                      │  └───────────────────────┘  │  │
│                      └─────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ .atelier/   │
                    │  state.json │
                    │  team.yaml  │
                    │  beads/     │
                    │  history/   │
                    └─────────────┘
```

This architecture means there are no separate API calls or costs beyond the Claude Code subscription. Every interaction — chat, code generation, review — runs through the same Claude Code session. The MCP server simply provides tools that shape what Claude Code does.

### 4.2 Components

#### MCP Server

The core runtime. Exposes tools to Claude Code for:

| Tool | Description |
|---|---|
| `atelier_status` | Show current session state: active beads, team activity, blockers |
| `atelier_chat` | Send a message to the team group chat; returns agent persona context for Claude Code to generate responses |
| `atelier_bead_list` | List all beads (backlog, in progress, done) |
| `atelier_bead_detail` | Get full details on a specific bead |
| `atelier_bead_claim` | Claim an available bead from the backlog |
| `atelier_submit_review` | Submit your branch for team review; returns diff context and reviewer persona for Claude Code |
| `atelier_review_request` | Request to review a teammate's branch; returns their diff and context |
| `atelier_ask` | Ask a specific teammate a direct question; returns their persona and relevant context |
| `atelier_advance` | Fast-forward the simulation (teammates make progress, generate commits) |
| `atelier_scaffold` | Generate a new project codebase from a description and development stage |

#### Session Manager

Manages the lifecycle of an Atelier session:

- Boots the team and loads project state from `.atelier/`
- Tracks session time, events, and history
- Persists state between sessions (you can close your terminal and resume later)
- Handles the "advance" mechanic — simulating teammate progress between sessions

#### Persona Registry

Manages the AI teammates. For each agent, the registry stores:

- A **persona definition** (name, role, seniority, expertise, communication style, opinions)
- A **context scope** — which parts of the codebase, which beads, and which conversations this agent has visibility into
- **State** — what they're currently working on, their branch, their progress

When the user sends a message to the team chat, the MCP server determines which agents should respond and returns their persona definitions plus relevant context to Claude Code. Claude Code then generates responses in character for each agent. The MCP server is a librarian, not a brain — it retrieves the right context; Claude Code does the thinking.

This means agent quality scales with Claude Code's capability. As the underlying model improves, agent responses, code generation, and reviews all improve with no changes to Atelier itself.

#### Project Engine

Manages the codebase analysis, bead generation, and simulation logic:

- **Codebase Analyser:** Scans the repository to build a structural understanding — modules, dependencies, test coverage, code patterns, entry points. Used to generate contextually appropriate beads and to give agents realistic knowledge of the codebase.
- **Bead Generator:** Creates beads based on the project's actual state. Can generate beads that are: feature additions, bug fixes, refactors, test coverage improvements, documentation, performance optimisations, or infrastructure work. Beads are generated with realistic dependencies and scoping.
- **Simulation Clock:** Controls the pacing of teammate activity. Teammates don't work in real-time — their progress is advanced explicitly (`atelier_advance`) or between sessions. This keeps the user in control of pacing while maintaining the illusion of concurrent work.

### 4.3 State and Persistence

All state lives in `.atelier/` within the repository:

```
.atelier/
├── config.yaml          # Project and user configuration
├── team.yaml            # Team composition and persona definitions
├── state.json           # Current simulation state
├── beads/
│   ├── 001.yaml         # Individual bead definitions
│   ├── 002.yaml
│   └── ...
└── history/
    ├── chat.jsonl        # Full chat history
    └── sessions.jsonl    # Session metadata and summaries
```

This directory should be `.gitignore`d (it's your personal training state, not part of the project).

---

## 5. Agent Personas

Agents are not generic chatbots wearing name tags. Each persona is defined along several dimensions:

### 5.1 Persona Dimensions

| Dimension | Description | Example |
|---|---|---|
| **Role** | Their position on the team | Tech Lead, Senior Engineer, Junior Engineer, SRE |
| **Expertise** | What they know deeply | Backend systems, frontend, databases, DevOps, security |
| **Communication style** | How they talk | Terse and precise, verbose and friendly, Socratic |
| **Review style** | How they give feedback | Nitpicky about style, focused on architecture, catches edge cases |
| **Opinions** | Technical preferences | Prefers composition over inheritance, dislikes ORMs, loves types |
| **Helpfulness** | How much they hand-hold | Gives direct answers vs. asks leading questions vs. says "read the docs" |
| **Availability** | How responsive they are | Always online vs. sometimes delayed vs. "I'm heads-down, ask me later" |

### 5.2 Default Team Roster

Atelier ships with a default team that covers a range of archetypes:

**Priya — Tech Lead**
Experienced, opinionated, high-bandwidth communicator. Gives clear direction but expects you to figure out the details. Reviews focus on architecture and consistency. Will push back if your approach doesn't fit the broader system design. Asks "have you considered..." a lot.

**James — Senior Engineer**
Pragmatic, collaborative, detail-oriented. The person who's touched every part of the codebase. Gives thorough, specific code review. Happy to explain things but won't spoon-feed. His code is clean and well-tested — good to learn from.

**Mika — Junior Engineer**
Enthusiastic, asks lots of questions, sometimes makes mistakes in their own work. Useful for practicing mentorship and code review from the other side. Might ask you for help with their beads. Occasionally commits code with subtle bugs that you might catch in review.

**Sam — SRE / DevOps**
Cares about reliability, observability, and deployment. Will flag performance issues, missing error handling, or operational concerns in review. Terse communicator. Responds with links to docs and runbooks.

### 5.3 Custom Teams

Users can define custom teams in `team.yaml`:

```yaml
team:
  - name: "Elena"
    role: "Principal Engineer"
    expertise: ["distributed systems", "Rust", "performance"]
    style: "Socratic — asks questions rather than giving answers"
    review_focus: "performance, correctness, error handling"
    personality: >
      Brilliant but impatient. Doesn't suffer sloppy thinking.
      If you come with a well-reasoned approach, she's your
      strongest ally. If you haven't thought it through, she'll
      make you feel it (constructively).
```

---

## 6. Difficulty and Progression

### 6.1 Experience Levels

Users configure their level at init, which calibrates bead complexity:

| Level | Bead characteristics |
|---|---|
| **Apprentice** | Well-scoped, clear acceptance criteria, limited dependencies, hints available |
| **Journeyman** | Moderate ambiguity, cross-module work, dependency chains, fewer hints |
| **Craftsperson** | Vague requirements, architectural decisions required, complex dependencies |
| **Master** | Adversarial: shifting requirements mid-bead, conflicting teammate opinions, production incidents |

### 6.2 Skill Tracks

Beads can target specific skill areas:

- **Reading code** — understand and extend unfamiliar modules
- **Testing** — write meaningful tests, interpret failures, improve coverage
- **Debugging** — diagnose and fix issues from bug reports
- **Design** — make architectural decisions with trade-offs
- **Review** — give constructive, thorough feedback on teammate PRs
- **Communication** — write clear commit messages, PR descriptions, and technical explanations
- **Ops awareness** — consider deployment, monitoring, and failure modes

---

## 7. Technical Considerations

### 7.1 Agent Code Generation

Agents produce real code artifacts (commits, branches, diffs). This code needs to be:

- **Syntactically valid** for the project's language and framework
- **Contextually appropriate** — uses existing patterns, imports, and conventions
- **Varied in quality by persona** — James writes clean code; Mika occasionally has bugs
- **Integrated with the actual codebase** — imports resolve, tests can run

This is the hardest technical challenge. The codebase analyser feeds structural context into agent prompts, and agents generate code scoped to their persona and bead. Generated code is validated (syntax check, linting, test execution) before being committed.

### 7.2 Resource Management

Atelier runs entirely within a Claude Code subscription — no separate API costs. However, Claude Code sessions have context limits and usage caps, so Atelier should be efficient:

- Agent "background work" (commits, branch updates) is batched and generated on explicit advance or between sessions, not continuously
- Chat responses are scoped — only agents relevant to the message respond; the MCP server filters who "hears" each message
- Codebase context is chunked and cached in `.atelier/`; the MCP server returns only the portions relevant to the current interaction
- Scaffold generation (which is the most token-intensive operation) is a one-time cost at project setup

### 7.3 No-AI Enforcement

Atelier takes a trust-based approach — the constraint is philosophical, not policed. However, the system reinforces it:

- Beads are described in terms of *what* to do, not *how* — discouraging prompt-and-paste
- Teammates respond to questions with guidance, not solutions
- The review process catches code that doesn't match the user's demonstrated style or understanding (stretch goal)
- Session summaries track what you learned, not what was generated

---

## 8. Future Directions

- **Multiplayer mode.** Multiple humans join the same Atelier workspace, working alongside AI teammates and each other.
- **Curriculum packs.** Pre-built project + bead sequences targeting specific learning goals (e.g., "Build a REST API from scratch," "Contribute to an open-source project," "Debug a production incident").
- **Skill assessment.** Track progression across skill dimensions over time. Generate a portfolio of completed beads with review feedback.
- **Agent memory.** Agents remember your patterns, growth areas, and preferences across sessions — becoming genuinely useful mentors over time.
- **Incident simulation.** A production alert fires. The team scrambles. You're on call. Debug under pressure with teammates coordinating in chat.

---

## 9. Open Questions

1. **How should agent-generated code be validated before committing?** Syntax checking and linting are table stakes, but running tests on generated code could be slow or flaky. What's the right trade-off?
2. **How rich should scaffold generation be?** A scaffolded MLIR compiler needs realistic IR definitions, pass infrastructure, test cases, and build config. How deep does the initial generation go before diminishing returns? Should scaffold "depth" be configurable?
3. **What's the right pacing model?** Real-time teammate activity could feel overwhelming or artificial. Explicit advancement gives control but breaks immersion. What's the sweet spot?
4. **How do we handle multi-language repos?** The codebase analyser needs to understand project structure across languages. Start with a few well-supported ecosystems (TypeScript/Node, Python, Rust, C++) and expand?
5. **Licensing and distribution.** MIT? Apache 2.0? Should Atelier itself be open source from day one?
6. **Claude Code context limits.** Scaffold generation and multi-agent conversations can be token-heavy. How aggressively should the MCP server compress context, and should it support "resumable" scaffold generation across multiple sessions?

---

*Atelier: where the craft is learned by doing, alongside others who care about the work.*
