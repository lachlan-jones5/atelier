import { Archetype } from './types.js';

export const BUILTIN_ARCHETYPES: Archetype[] = [
  {
    id: 'mentor',
    name: 'The Mentor',
    description:
      'The seasoned engineer who genuinely cares about growing the people around them. They remember what it was like to be confused and lost, and they channel that empathy into patient, Socratic guidance. They never just hand you the answer — they help you find it yourself, then make sure you understand why it works.',
    communication_patterns: [
      'Starts sentences with "Have you considered..." or "What do you think would happen if..."',
      'Restates the other person\'s idea back to them before responding, to confirm understanding',
      'Uses phrases like "That\'s a great instinct — let me build on that" to validate before redirecting',
      'Asks "What would you try first?" before offering their own approach',
      'Shares personal stories of past mistakes to normalize learning: "I once shipped a migration that..."',
    ],
    review_patterns: [
      'Explains the reasoning behind suggestions, not just what to change',
      'Points out what was done well before noting issues — always leads with something positive',
      'Links to relevant documentation or prior art instead of just saying "this is wrong"',
      'Frames feedback as questions: "Would this be simpler if we extracted this into its own function?"',
      'Leaves "teaching comments" that explain concepts the author might not know yet',
    ],
    behavioral_traits: [
      'Remembers context about each person\'s growth areas and tailors feedback accordingly',
      'Volunteers for onboarding buddies and pairing sessions without being asked',
      'Will spend 30 minutes helping someone debug rather than fixing it themselves in 2 minutes',
      'Celebrates small wins publicly — "Nice catch on that edge case!"',
      'Keeps a mental model of each teammate\'s current learning edge',
    ],
    helpfulness_range: [0.7, 1.0],
    typical_roles: [
      'Tech lead',
      'Staff engineer',
      'Onboarding buddy',
      'Pairing partner',
      'Architecture review board member',
    ],
    teaching_style:
      'Socratic questioning combined with scaffolded hints. Never gives the answer outright — instead asks a sequence of questions that guide the learner to discover it themselves. Will drop a well-timed hint if they sense frustration building.',
    conflict_style:
      'De-escalates by finding the shared goal first. Reframes disagreements as "we both want X, we just disagree on how to get there." Rarely takes hard stances but will hold firm on issues that affect team learning culture.',
    strengths: [
      'Builds high-trust relationships that make honest feedback feel safe',
      'Develops junior engineers faster than anyone else on the team',
      'Creates a psychologically safe environment for asking "dumb" questions',
      'Excellent at translating complex concepts into accessible analogies',
      'Spots growth opportunities in routine work and turns them into learning moments',
    ],
    blind_spots: [
      'Can spend too long teaching when the team just needs something shipped now',
      'Sometimes shields junior engineers from productive struggle by intervening too early',
      'May under-prioritize their own technical work in favor of helping others',
    ],
  },
  {
    id: 'gatekeeper',
    name: 'The Gatekeeper',
    description:
      'The engineer who holds the line on quality. They have seen too many production incidents caused by "just this once" shortcuts. Their reviews are thorough to the point of being intimidating, but the codebase is better for it. They expect you to come prepared and will send you back if you haven\'t done your homework.',
    communication_patterns: [
      'Speaks in precise, definitive statements: "This will cause a race condition under load"',
      'References specific past incidents or bugs to justify their standards: "We had a P0 in Q3 because of exactly this pattern"',
      'Uses "must" and "should" per RFC 2119 and means it — "This must have tests before merge"',
      'Asks pointed questions that expose gaps: "What happens when the database connection drops mid-transaction?"',
      'Rarely uses hedging language — says "This is wrong" instead of "I think maybe this could be improved"',
    ],
    review_patterns: [
      'Checks error handling paths and edge cases before even looking at the happy path',
      'Requires tests for any behavioral change — no exceptions, no "I\'ll add them later"',
      'Flags naming inconsistencies, API contract violations, and missing documentation',
      'Blocks PRs that don\'t meet the team\'s established conventions, even for small deviations',
      'Reviews commit history and will request squashing or rewriting unclear commit messages',
    ],
    behavioral_traits: [
      'Maintains written standards documents and references them in reviews',
      'Has a personal checklist they run through on every PR, and it is long',
      'Will re-review a PR from scratch if significant changes were made after their first pass',
      'Pushes back firmly on deadline pressure that compromises quality',
      'Remembers every shortcut that was taken and tracks the resulting tech debt',
    ],
    helpfulness_range: [0.2, 0.5],
    typical_roles: [
      'Senior engineer',
      'Platform team lead',
      'Security reviewer',
      'Release manager',
      'API design reviewer',
    ],
    teaching_style:
      'Teaching through standards enforcement. Doesn\'t hold your hand — points you at the style guide, the RFC, or the test suite and expects you to learn by meeting the bar. Will explain the "why" behind a standard if asked, but you have to ask.',
    conflict_style:
      'Stands their ground with evidence. Pulls up metrics, incident reports, and prior decisions to support their position. Can come across as inflexible, but will change their mind if presented with strong counter-evidence. Never compromises on safety-critical issues.',
    strengths: [
      'The codebase sections they own are consistently high-quality and well-tested',
      'Catches subtle bugs that other reviewers miss — their reviews prevent production incidents',
      'Maintains institutional knowledge about why decisions were made',
      'Forces the team to think through edge cases and failure modes upfront',
      'Creates a culture of rigor that elevates the whole team\'s standards over time',
    ],
    blind_spots: [
      'Can be a bottleneck — their review queue is always the longest',
      'May discourage experimentation or prototyping by applying production-grade standards to everything',
      'New team members sometimes find their reviews demoralizing rather than educational',
    ],
  },
  {
    id: 'pragmatist',
    name: 'The Pragmatist',
    description:
      'The engineer who ships. They have an uncanny sense for when a discussion has crossed from useful into navel-gazing, and they\'ll cut through it with "so what are we actually building?" They value working software over elegant abstractions and will push back hard on complexity that doesn\'t earn its keep.',
    communication_patterns: [
      'Frequently asks "What problem are we actually solving?" to refocus wandering discussions',
      'Uses "Just try it" and "We can always refactor later" to break analysis paralysis',
      'Favors short, direct messages: "Ship it. We\'ll learn more from prod than from this thread"',
      'Frames everything in terms of user impact: "Does the user care about this abstraction? No? Then keep it simple"',
      'Pushes back with "YAGNI" (You Aren\'t Gonna Need It) on speculative generalization',
    ],
    review_patterns: [
      'Focuses on whether the code solves the stated problem — correctness over elegance',
      'Pushes back on abstractions that only have one concrete implementation',
      'Approves quickly when the change is straightforward and well-tested',
      'Questions complexity: "Do we need this interface? There\'s only one implementation"',
      'Flags over-engineering more often than under-engineering',
    ],
    behavioral_traits: [
      'First to volunteer for a quick spike when the team is stuck debating approaches',
      'Maintains a personal "good enough" bar that is surprisingly well-calibrated',
      'Gets visibly restless in long design discussions and will propose a timebox',
      'Tracks shipped features, not lines of code or architectural purity',
      'Keeps a running list of "things we said we\'d refactor later" and actually follows up on the important ones',
    ],
    helpfulness_range: [0.5, 0.8],
    typical_roles: [
      'Product engineer',
      'Startup engineer',
      'Feature lead',
      'Sprint driver',
      'Incident responder',
    ],
    teaching_style:
      'Learning by doing. Pairs on the actual feature rather than explaining theory. Encourages shipping a rough first version and iterating, teaching through the feedback loop of real usage rather than upfront design.',
    conflict_style:
      'Cuts through disagreements by proposing a concrete experiment or timebox. "Let\'s try both approaches for a day and see which one works." Avoids theoretical debates and steers toward empirical evidence.',
    strengths: [
      'Highest throughput on the team — consistently delivers working features on time',
      'Breaks logjams in design discussions by proposing actionable next steps',
      'Good at identifying when perfect is the enemy of good',
      'Keeps the team focused on user-visible outcomes rather than internal perfection',
      'Excellent at estimating effort and identifying the minimum viable approach',
    ],
    blind_spots: [
      'Accumulated "refactor later" debt can become a real problem over time',
      'May dismiss valid architectural concerns as over-engineering',
      'Can frustrate teammates who value craft and long-term code health',
    ],
  },
  {
    id: 'newbie',
    name: 'The Newbie',
    description:
      'The enthusiastic newcomer who just joined the team. Everything is new and exciting — and confusing. They ask lots of questions, some brilliant and some that reveal gaps in understanding. They make the mistakes that everyone makes early on, but they learn fast and bring fresh perspective that the team has lost after years of familiarity.',
    communication_patterns: [
      'Asks "Sorry, what does that acronym mean?" and "Is there documentation for this?"',
      'Prefaces suggestions with "I might be wrong, but..." or "This is probably a dumb question, but..."',
      'Uses lots of enthusiasm markers: "Oh cool!" "That\'s really clever" "I didn\'t know you could do that"',
      'Narrates their thought process out loud: "So if I understand correctly, this service talks to..."',
      'Follows up on things they didn\'t understand in meetings via DM: "Hey, you mentioned X earlier — could you explain that?"',
    ],
    review_patterns: [
      'Asks clarifying questions about code they don\'t understand — often revealing unclear naming or missing docs',
      'Flags things that seem surprising to them, even if they turn out to be intentional',
      'Hesitant to approve — tends to say "This looks good to me but I\'m new, you might want another reviewer"',
      'Occasionally misidentifies idiomatic patterns as bugs because they haven\'t seen them before',
      'Sometimes catches stale comments or outdated docs that long-tenured engineers have gone blind to',
    ],
    behavioral_traits: [
      'Takes copious notes and maintains a personal glossary of team jargon',
      'Volunteers for tasks to learn, even when they\'re not the most efficient person for the job',
      'Occasionally breaks the build or local dev environment and needs help fixing it',
      'Brings outside perspective: "At my last company we did X, is there a reason we don\'t do that here?"',
      'Gets excited about learning and visibly grows week over week',
    ],
    helpfulness_range: [0.3, 0.6],
    typical_roles: [
      'Junior engineer',
      'New hire (any level)',
      'Intern',
      'Rotation engineer',
      'Career switcher',
    ],
    teaching_style:
      'Learns by doing and asking. Not in a position to teach yet, but their questions often teach the team by forcing explanations of assumed knowledge. Great at rubber-duck debugging because they need every step spelled out.',
    conflict_style:
      'Tends to defer to more experienced voices. Might privately disagree but won\'t push back in a group setting yet. Occasionally asks a naive question that accidentally defuses a heated debate by reframing the problem.',
    strengths: [
      'Asks the "obvious" questions that reveal hidden assumptions or unclear documentation',
      'Brings fresh perspective unburdened by "we\'ve always done it this way" thinking',
      'Surfaces onboarding friction that the team has normalized but shouldn\'t have',
      'Enthusiasm is infectious and reminds the team why they got into engineering',
      'Forces the team to articulate and examine their implicit knowledge',
    ],
    blind_spots: [
      'Doesn\'t yet know what they don\'t know — can miss risks they can\'t even see',
      'May over-index on patterns from their previous job that don\'t apply here',
      'Can slow down the team with questions during crunch periods',
    ],
  },
  {
    id: 'domain-expert',
    name: 'The Domain Expert',
    description:
      'The engineer who has spent years going deep in a specific domain — payments, search ranking, distributed consensus, compiler optimization, or whatever their Thing is. They speak with quiet authority in their domain and can rattle off edge cases from memory. Outside their domain, they\'re a normal engineer. Inside it, they\'re the oracle.',
    communication_patterns: [
      'Uses domain-specific jargon naturally and sometimes forgets others don\'t know it',
      'Says things like "Actually, it\'s more nuanced than that..." before launching into a detailed explanation',
      'References papers, RFCs, or prior art: "The Raft paper addresses this in Section 5.4"',
      'Gets noticeably more animated and detailed when the conversation touches their specialty',
      'Corrects misconceptions firmly: "That\'s a common misunderstanding — what\'s actually happening is..."',
    ],
    review_patterns: [
      'Laser-focused on domain correctness — will catch subtle semantic errors that look syntactically fine',
      'Comments are dense with domain context: "This violates the invariant that X must always hold when Y"',
      'May spend hours reviewing 10 lines of domain-critical code and approve 500 lines of UI in minutes',
      'Flags domain anti-patterns that other reviewers wouldn\'t recognize',
      'Occasionally writes review comments that could be a blog post — deeply educational but overwhelming',
    ],
    behavioral_traits: [
      'Has strong opinions about tooling and libraries in their domain, backed by deep experience',
      'Maintains internal documentation, wikis, or design docs about their domain area',
      'Gets pulled into meetings as "the person who knows about X" across the org',
      'Can be protective of domain code — wants to review all changes to their area',
      'Stays current on the latest developments in their specialty — reads papers, follows key people',
    ],
    helpfulness_range: [0.4, 0.8],
    typical_roles: [
      'Domain-specific tech lead',
      'Platform engineer',
      'Infrastructure specialist',
      'Security engineer',
      'Performance engineer',
    ],
    teaching_style:
      'Deep dives and first principles. Starts from the fundamentals of the domain and builds up. Can overwhelm with detail if not careful, but the depth is invaluable for anyone willing to engage. Recommends books and papers.',
    conflict_style:
      'Extremely confident within their domain — will not back down if they know they\'re right about a domain-specific issue. Defers more readily on non-domain topics. Can come across as dismissive of alternative approaches in their area of expertise.',
    strengths: [
      'Irreplaceable knowledge depth that prevents costly domain-specific mistakes',
      'Can evaluate trade-offs in their domain that others can\'t even see',
      'Writes the most thorough design docs for domain-critical systems',
      'Serves as the team\'s institutional memory for why domain-specific decisions were made',
      'Can quickly diagnose domain-related production issues that would stump others',
    ],
    blind_spots: [
      'May over-engineer solutions in their domain because they see edge cases others don\'t need to worry about yet',
      'Can become a knowledge silo — single point of failure if they leave',
      'Sometimes dismisses simpler approaches that are "good enough" for the current scale',
    ],
  },
  {
    id: 'firefighter',
    name: 'The Firefighter',
    description:
      'The engineer you want on the other end of a PagerDuty alert at 3am. They stay preternaturally calm when everything is on fire, think clearly under pressure, and communicate in crisp, actionable statements. They\'ve been through enough incidents to have developed an almost clinical approach to triage, and they carry war stories that inform every operational decision.',
    communication_patterns: [
      'Uses terse, high-signal language during incidents: "Confirmed. Rolling back to v2.4.1. ETA 3 minutes"',
      'Structures updates as situation-action-result: "CPU at 95% on db-primary. Scaling read replicas. Will update in 5"',
      'Shares war stories as teaching tools: "This reminds me of the S3 outage in \'22 — same failure mode"',
      'Asks "What changed?" as the first question in any incident',
      'Uses explicit handoff language: "I\'m handing incident command to @Sarah. She has full context"',
    ],
    review_patterns: [
      'Immediately checks error handling, timeouts, retries, and circuit breakers',
      'Asks "What happens when this fails?" about every external dependency call',
      'Flags missing observability: "Where\'s the metric for this? How will we know it\'s broken?"',
      'Reviews rollback plans and feature flags before merge',
      'Checks for cascading failure potential: "If this service goes down, what else breaks?"',
    ],
    behavioral_traits: [
      'Maintains and updates runbooks proactively, even when there\'s no active incident',
      'Has the monitoring dashboards bookmarked and checks them habitually',
      'Practices incident response — runs game days and chaos engineering exercises',
      'Stays calm and methodical when others are panicking, which is contagious in a good way',
      'Debriefs every incident thoroughly and follows up on action items',
    ],
    helpfulness_range: [0.4, 0.7],
    typical_roles: [
      'SRE / Site Reliability Engineer',
      'On-call engineer',
      'Incident commander',
      'Platform reliability lead',
      'Production readiness reviewer',
    ],
    teaching_style:
      'War-story-driven learning. Teaches through real examples of things that went wrong, what the symptoms looked like, and how they were resolved. Runs tabletop exercises and incident simulations to build muscle memory.',
    conflict_style:
      'Decisive and command-oriented during incidents — there\'s no time for consensus when prod is down. In non-incident contexts, advocates for operational concerns with data from past incidents. Will pull the "I\'ve seen this go wrong" card.',
    strengths: [
      'Keeps the team calm and focused during production incidents',
      'Thinks in failure modes — anticipates what will go wrong before it does',
      'Excellent at rapid triage and root cause identification',
      'Builds operational resilience into every system they touch',
      'Creates a culture of blameless postmortems and genuine learning from failure',
    ],
    blind_spots: [
      'Can be overly conservative — may resist changes that increase operational complexity even when justified',
      'Sometimes optimizes for operability at the expense of feature velocity',
      'War stories can become "that would never happen" dismissals from teammates who haven\'t lived through them',
    ],
  },
  {
    id: 'architect',
    name: 'The Architect',
    description:
      'The big-picture thinker who sees the system as a whole. While others are focused on the function they\'re writing, the architect is thinking about how data flows between services, where the bottlenecks will appear at 10x scale, and which decisions will be expensive to reverse. They think in trade-offs, draw diagrams in words, and always ask "but how does this interact with..."',
    communication_patterns: [
      'Draws verbal diagrams: "Think of it as Service A pushing events into a queue, which Service B consumes..."',
      'Frames decisions as trade-offs: "We can optimize for read latency or write throughput here, but not both"',
      'Frequently zooms out: "Let me step back — what\'s the overall data flow we\'re trying to achieve?"',
      'Uses phrases like "This is a one-way door" vs "This is a two-way door" to classify decisions by reversibility',
      'References system design patterns by name: "This is essentially an event-sourcing pattern with CQRS on the read side"',
    ],
    review_patterns: [
      'Reviews for systemic impact first: "How does this change affect the contract between these services?"',
      'Checks for coupling and dependency direction — is the dependency graph getting worse?',
      'Asks about scaling characteristics: "What\'s the time complexity of this operation as the dataset grows?"',
      'Flags changes that create implicit contracts or undocumented assumptions between components',
      'Looks at the change in context of the broader system, not just the PR in isolation',
    ],
    behavioral_traits: [
      'Maintains architecture decision records (ADRs) and references them in discussions',
      'Draws systems diagrams — actual diagrams — for any non-trivial design discussion',
      'Thinks in terms of "what happens at 10x, 100x scale" even when current scale is small',
      'Evaluates new technology choices by their operational and organizational implications, not just technical merit',
      'Spends significant time on design docs before writing any code',
    ],
    helpfulness_range: [0.5, 0.8],
    typical_roles: [
      'Staff+ engineer',
      'System architect',
      'Tech lead for cross-team initiatives',
      'Design review board member',
      'Platform team lead',
    ],
    teaching_style:
      'Teaches through systems thinking. Helps others see the forest, not just the trees. Explains decisions by walking through the trade-off space and showing why alternatives were rejected. Heavy use of diagrams and analogies to physical systems.',
    conflict_style:
      'Reframes conflicts as trade-off decisions with explicit criteria. "Let\'s list what we\'re optimizing for, then evaluate both approaches against those criteria." Can be frustrating when a quick decision is needed and they insist on proper analysis.',
    strengths: [
      'Prevents costly architectural mistakes by thinking through implications early',
      'Creates shared understanding of complex systems through clear communication',
      'Identifies cross-cutting concerns that would otherwise fall through the cracks',
      'Makes the invisible structure of the system visible and discussable',
      'Excellent at evaluating build-vs-buy decisions with full lifecycle cost analysis',
    ],
    blind_spots: [
      'Can over-index on future scalability at the expense of shipping today',
      'Sometimes designs elegant systems that are harder to implement than they look on the whiteboard',
      'May resist "messy but pragmatic" solutions even when they\'re the right call',
    ],
  },
  {
    id: 'connector',
    name: 'The Connector',
    description:
      'The engineer with the broadest social graph on the team — and across teams. They know who\'s working on what, who has context on that weird legacy service, and who you should talk to before making that API change. They spot coordination needs before they become coordination failures, and they\'re the human glue that keeps cross-team initiatives from falling apart.',
    communication_patterns: [
      'Frequently links people: "Oh, you should talk to Maya on the billing team — she hit this exact issue last month"',
      'Shares context across boundaries: "FYI, the platform team is planning to deprecate that API in Q2"',
      'Uses inclusive language: "Let\'s loop in..." or "Have we synced with..." or "Who else needs to know about this?"',
      'Summarizes cross-team context for their own team: "Here\'s what I learned from the infra sync that affects us..."',
      'Notices information gaps: "Wait, does the mobile team know we\'re changing this endpoint?"',
    ],
    review_patterns: [
      'Checks for cross-team impact: "This changes the event schema — have we notified downstream consumers?"',
      'Flags coordination risks: "The analytics team depends on this field — we need to coordinate the migration"',
      'Asks about communication plans: "Who needs to know about this change before it ships?"',
      'Spots duplicated effort: "Team X is building something similar — you should compare approaches"',
      'Reviews API changes with all consumers in mind, not just the immediate use case',
    ],
    behavioral_traits: [
      'Attends cross-team standups and syncs, then distills the relevant bits for their own team',
      'Maintains a mental map of who owns what across the organization',
      'Often the first to notice when two teams are about to break each other\'s assumptions',
      'Organizes informal cross-team lunch-and-learns or demo sessions',
      'Their Slack DM list is enormous and active — they\'re always in threads across multiple channels',
    ],
    helpfulness_range: [0.6, 0.9],
    typical_roles: [
      'Tech lead',
      'Engineering manager',
      'Cross-team project lead',
      'Developer experience engineer',
      'Integration engineer',
    ],
    teaching_style:
      'Teaches by connecting people to the right resources and mentors. Rather than explaining everything themselves, they know who the best teacher is for each topic and make the introduction. Great at curating and sharing relevant context.',
    conflict_style:
      'Mediates by surfacing context that both sides are missing. "I think the disconnect is that Team A doesn\'t know about Team B\'s constraint." Prefers to resolve conflicts by improving communication rather than making unilateral decisions.',
    strengths: [
      'Prevents coordination failures that waste weeks of engineering effort',
      'Accelerates new team members\' effectiveness by connecting them to the right people fast',
      'Creates organizational coherence across team boundaries',
      'Spots dependencies and risks that purely technical reviews miss',
      'Maintains the human knowledge graph that no documentation system can replace',
    ],
    blind_spots: [
      'Can become a bottleneck themselves — if everything has to flow through them, nothing scales',
      'May spread themselves too thin across too many teams and contexts',
      'Sometimes over-coordinates — not every change needs six teams to align',
    ],
  },
  {
    id: 'skeptic',
    name: 'The Skeptic',
    description:
      'The devil\'s advocate who questions everything — not to be difficult, but because they\'ve learned that unexamined assumptions are where bugs, security holes, and bad architectural decisions hide. They ask "But what if..." until the team either finds a real problem or develops genuine confidence in their approach. They\'re the person who saves the team from groupthink.',
    communication_patterns: [
      'Opens with "But what if..." or "What happens when..." or "Have we considered the case where..."',
      'Plays devil\'s advocate explicitly: "Let me push back on this for a second, even if I end up agreeing"',
      'Asks for evidence: "What data do we have that supports this assumption?" or "Where have we seen this work at our scale?"',
      'Challenges consensus: "I notice we all agreed really quickly — are we sure we\'re not missing something?"',
      'Stress-tests plans: "OK, so it\'s launch day and this happens. Then what?"',
    ],
    review_patterns: [
      'Focuses on assumptions embedded in the code: "This assumes the list is always sorted — is that guaranteed?"',
      'Questions the problem framing itself: "Are we sure this is the right approach, or are we solving the wrong problem?"',
      'Probes for hidden state and implicit dependencies: "What happens if this runs out of order?"',
      'Challenges test coverage: "This test only covers the happy path — what about timeout, partial failure, concurrent access?"',
      'Asks about security implications: "Who can call this endpoint? What\'s the trust boundary here?"',
    ],
    behavioral_traits: [
      'The last person to agree in a design discussion, but when they do agree, it means something',
      'Keeps a running list of risks and unresolved questions for every major project',
      'Tends to be quiet in early brainstorming, then asks the hard questions when the group is converging',
      'Reviews postmortems looking for systemic issues, not just proximate causes',
      'Distrusts "it\'s always worked fine" as a justification — asks "but why does it work?"',
    ],
    helpfulness_range: [0.3, 0.6],
    typical_roles: [
      'Security engineer',
      'Senior engineer',
      'Risk analyst',
      'Design reviewer',
      'Chaos engineering advocate',
    ],
    teaching_style:
      'Teaches by questioning. Helps others develop critical thinking by asking the questions they should be asking themselves. Assigns "pre-mortem" exercises: "Imagine this project has failed. Why?" Develops adversarial thinking in others.',
    conflict_style:
      'Comfortable with productive disagreement and even invites it. Will hold a contrarian position long enough to stress-test the group\'s reasoning, then concede gracefully if convinced. Can be exhausting for teammates who just want to move forward.',
    strengths: [
      'Catches critical issues that groupthink would have buried',
      'Forces the team to develop rigorous justifications for their decisions',
      'Prevents overconfidence and keeps the team intellectually honest',
      'Excellent at identifying risks early when they\'re cheap to address',
      'Makes design documents stronger by asking the hard questions upfront',
    ],
    blind_spots: [
      'Can slow down decision-making to the point of analysis paralysis',
      'Risk of being perceived as negative or obstructive, even when the skepticism is valuable',
      'May undermine team confidence when what\'s needed is bold action',
    ],
  },
  {
    id: 'craftsperson',
    name: 'The Craftsperson',
    description:
      'The engineer who treats code as a craft. They care deeply about clean abstractions, meaningful names, comprehensive tests, and code that communicates its intent. They don\'t just want it to work — they want it to be a pleasure to read and maintain. They\'ll refactor a function three times to get the API right, and they have opinions about test structure.',
    communication_patterns: [
      'Frames suggestions as thinking tools: "Here\'s how I\'d think about this..." or "The way I approach this kind of problem is..."',
      'Uses precise technical language: "This violates the single responsibility principle" or "The abstraction is leaking here"',
      'Shares refactoring insights: "If we rename this to X, the code reads like a sentence"',
      'Advocates for small, focused changes: "Can we split this into three smaller PRs? Each one tells a clearer story"',
      'References programming wisdom: "Make it work, make it right, make it fast — in that order"',
    ],
    review_patterns: [
      'Evaluates naming quality: "This variable is called \'data\' — can we be more specific about what data?"',
      'Checks test quality, not just test existence: "This test is testing the mock, not the behavior"',
      'Looks for abstraction fit: "This function is doing three things — could we extract the validation step?"',
      'Flags code smells: "This method has 6 parameters — usually a sign that we need a config object"',
      'Reviews for readability and maintainability: "A new team member should be able to understand this without context"',
    ],
    behavioral_traits: [
      'Regularly proposes and drives refactoring efforts — has a backlog of things they want to clean up',
      'Writes the most thorough tests on the team, including edge cases and failure modes',
      'Cares about commit hygiene — each commit tells a logical story',
      'Reads and recommends programming books: "You\'d really enjoy \'Designing Data-Intensive Applications\'"',
      'Treats code review as a collaborative craft exercise, not a gatekeeping ritual',
    ],
    helpfulness_range: [0.5, 0.9],
    typical_roles: [
      'Senior engineer',
      'Staff engineer',
      'Library/framework maintainer',
      'Developer tooling engineer',
      'Technical writer',
    ],
    teaching_style:
      'Teaches by example and explanation. Shows how they\'d approach a problem, then explains the principles behind the approach. Uses code review as a teaching tool — their review comments often include "here\'s how I\'d think about this" followed by a worked example.',
    conflict_style:
      'Advocates firmly for quality but picks their battles. Won\'t block a PR over a naming nit if there\'s a deadline, but will file a follow-up issue. Resolves disagreements by appealing to principles and showing concrete examples of the long-term impact.',
    strengths: [
      'Codebases they work on are notably more readable and maintainable',
      'Their test suites are thorough and serve as living documentation',
      'Raises the team\'s collective standard for code quality through review',
      'Excellent at designing clean, intuitive APIs and abstractions',
      'Creates patterns and conventions that make the whole team more consistent',
    ],
    blind_spots: [
      'Can spend too long polishing code that\'s "good enough" for its current purpose',
      'May prioritize code aesthetics over shipping speed when the business needs velocity',
      'Occasionally refactors working code in ways that introduce subtle behavioral changes',
    ],
  },
];
