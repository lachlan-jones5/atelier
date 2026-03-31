import { IncidentSeverity, IncidentStatus } from '../util/types.js';

export interface Incident {
  id: string;
  scenario_id: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  symptoms: string[];
  root_cause: string; // Hidden from user until resolved
  red_herrings: string[]; // Misleading signals
  affected_systems: string[];
  status: IncidentStatus;
  timeline: IncidentTimelineEvent[];
  triggered_at: string;
  resolved_at: string | null;
  resolution?: string;
  on_call: string; // "user" typically
  escalation_level: number; // 0-3
}

export interface IncidentTimelineEvent {
  timestamp: string;
  type:
    | 'triggered'
    | 'escalated'
    | 'update'
    | 'identified'
    | 'mitigated'
    | 'resolved';
  description: string;
  actor: string;
}

export interface IncidentScenario {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  symptoms: string[];
  root_cause: string;
  red_herrings: string[];
  resolution_steps: string[];
  affected_systems: string[];
  escalation_triggers: string[];
  persona_reactions: Record<string, string>; // archetype -> reaction description
}

export interface EscalationState {
  level: number;
  hours_until_next: number;
  stakeholder_pressure: 'low' | 'medium' | 'high' | 'critical';
}
