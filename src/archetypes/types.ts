import { ArchetypeId } from '../util/types.js';

export interface Archetype {
  id: ArchetypeId;
  name: string;                      // "The Mentor"
  description: string;               // What this archetype embodies
  communication_patterns: string[];  // How they talk
  review_patterns: string[];         // How they give feedback
  behavioral_traits: string[];       // Core personality traits
  helpfulness_range: [number, number]; // 0-1 range for instantiation variance
  typical_roles: string[];           // Roles this archetype commonly fills
  teaching_style: string;            // How they help others learn
  conflict_style: string;            // How they handle disagreements
  strengths: string[];
  blind_spots: string[];
}
