import { BeadType, BeadStatus, BeadPriority, SkillDimension } from '../util/types.js';

export interface Bead {
  id: string;
  title: string;
  description: string;
  team: string; // team slug or "cross-team"
  priority: BeadPriority;
  status: BeadStatus;
  assigned_to: string | null; // persona slug or "user"
  depends_on: string[]; // bead IDs
  blocked_by: string[]; // computed from depends_on statuses
  acceptance_criteria: string[];
  skill_targets: SkillDimension[];
  type: BeadType;
  files?: string[]; // relevant file paths
  branch?: string;
  hints?: string[]; // for lower difficulty levels
  created_at: string;
  completed_at: string | null;
  review_feedback?: string[];
}

export type BeadCreate = Omit<Bead, 'id' | 'created_at' | 'completed_at' | 'blocked_by'>;
