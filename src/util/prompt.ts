export interface PersonaPromptInput {
  name: string;
  role: string;
  expertise: string[];
  communication_style: string;
  opinions: string[];
  quirks: string[];
}

export interface TeamContextInput {
  name: string;
  domain: string;
  techStack: string[];
}

/** Builds the character/persona section for an agent prompt. */
export function buildPersonaPrompt(persona: PersonaPromptInput): string {
  const expertiseList = persona.expertise.map(e => `- ${e}`).join('\n');
  const opinionsList = persona.opinions.map(o => `- ${o}`).join('\n');
  const quirksList = persona.quirks.map(q => `- ${q}`).join('\n');

  return `## Character: ${persona.name}
**Role:** ${persona.role}
**Communication style:** ${persona.communication_style}

### Expertise
${expertiseList}

### Opinions
${opinionsList}

### Quirks
${quirksList}`;
}

/** Builds the team context section for an agent prompt. */
export function buildTeamContextPrompt(team: TeamContextInput): string {
  const stackList = team.techStack.map(t => `- ${t}`).join('\n');

  return `## Team: ${team.name}
**Domain:** ${team.domain}

### Tech Stack
${stackList}`;
}

/** Formats a chat message as `[Sender] message`. */
export function formatChatMessage(sender: string, message: string): string {
  return `[${sender}] ${message}`;
}
