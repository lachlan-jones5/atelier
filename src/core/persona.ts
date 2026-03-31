import { Seniority, Availability, ArchetypeId } from '../util/types.js';

export interface Persona {
  name: string;
  slug: string;
  team: string; // team slug
  archetype: ArchetypeId;
  role: string;
  seniority: Seniority;
  expertise: string[];
  communication_style: string;
  review_style: string;
  opinions: string[];
  helpfulness: number;
  availability: Availability;
  quirks: string[];
  backstory: string;
}

export interface PersonaState {
  currentBead: string | null;
  currentBranch: string | null;
  beadsCompleted: string[];
  lastActiveAt: string;
  mood: 'normal' | 'busy' | 'frustrated' | 'excited';
}

export interface PersonaWithState {
  definition: Persona;
  state: PersonaState;
}
