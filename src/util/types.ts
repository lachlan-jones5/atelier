// Experience levels
export type ExperienceLevel = 'apprentice' | 'journeyman' | 'craftsperson' | 'master';

// Skill dimensions
export type SkillDimension = 'reading_code' | 'testing' | 'debugging' | 'design' | 'review' | 'communication' | 'ops_awareness';

// Bead types
export type BeadType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'perf' | 'infra';
export type BeadStatus = 'open' | 'claimed' | 'in_progress' | 'in_review' | 'done';
export type BeadPriority = 'critical' | 'high' | 'medium' | 'low';

// Persona types
export type Seniority = 'junior' | 'mid' | 'senior' | 'staff' | 'principal';
export type Availability = 'always' | 'sometimes_delayed' | 'heads_down';
export type ArchetypeId = 'mentor' | 'gatekeeper' | 'pragmatist' | 'newbie' | 'domain-expert' | 'firefighter' | 'architect' | 'connector' | 'skeptic' | 'craftsperson';

// Memory types
export type MemoryEntryType = 'observation' | 'interaction' | 'opinion' | 'skill_note' | 'context';

// Incident types
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3';
export type IncidentStatus = 'active' | 'investigating' | 'mitigating' | 'resolved' | 'postmortem';

// Review types
export type ReviewStatus = 'pending' | 'in_review' | 'changes_requested' | 'approved';
export type ReviewVerdict = 'approve' | 'request_changes' | 'comment';
export type CommentSeverity = 'blocking' | 'suggestion' | 'nit';

// Curriculum types
export type CurriculumStatus = 'available' | 'active' | 'completed';

// The central context object passed to all MCP tool handlers
export interface AtelierContext {
  projectRoot: string;
  atelierDir: string;
  // Sub-managers are added as they're implemented
  // This interface will be extended by other modules
}

// Common result wrapper
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
