import type { ExperienceLevel, SkillDimension, BeadType, BeadPriority } from '../util/types.js';

export interface CurriculumPack {
  id: string;
  title: string;
  description: string;
  target_skills: SkillDimension[];
  experience_level: ExperienceLevel;
  estimated_hours: number;
  sequences: CurriculumSequence[];
}

export interface CurriculumSequence {
  id: string;
  title: string;
  description: string;
  bead_templates: CurriculumBeadTemplate[];
  completion_criteria: string;
  team_overrides?: Record<string, unknown>; // Optional persona state overrides
}

export interface CurriculumBeadTemplate {
  id: string;
  title: string;
  description: string;
  type: BeadType;
  priority: BeadPriority;
  acceptance_criteria: string[];
  skill_targets: SkillDimension[];
  hints?: string[];
  depends_on_template?: string[]; // References other template IDs in same sequence
}

export interface CurriculumState {
  pack_id: string;
  started_at: string;
  current_sequence: number;
  current_bead: number;
  completed_sequences: string[];
  status: 'active' | 'completed';
}
