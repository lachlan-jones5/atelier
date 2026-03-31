import { SkillDimension } from '../util/types.js';

export interface SkillProfile {
  dimensions: Record<SkillDimension, SkillLevel>;
  last_updated: string;
}

export interface SkillLevel {
  level: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  observation_count: number;
  last_assessment: string;
}

export interface SkillEvidence {
  timestamp: string;
  dimension: SkillDimension;
  score: number; // 1-5 for this observation
  bead_id?: string;
  evidence: string; // What was observed
  observer: string; // Which persona observed this
}

export interface Portfolio {
  completed_beads: PortfolioBead[];
  skill_summary: Record<SkillDimension, { level: number; trend: string }>;
  strongest_areas: SkillDimension[];
  growth_areas: SkillDimension[];
  total_beads_completed: number;
  review_feedback_summary: string;
}

export interface PortfolioBead {
  id: string;
  title: string;
  type: string;
  skill_targets: SkillDimension[];
  review_verdict?: string;
}
