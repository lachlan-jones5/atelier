import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { readYaml, writeYaml } from '../util/yaml.js';
import { loadScenarios } from './scenarios/index.js';
import type {
  Incident,
  IncidentScenario,
  IncidentTimelineEvent,
  EscalationState,
} from './types.js';
import type { IncidentSeverity, IncidentStatus } from '../util/types.js';

function getIncidentsDir(atelierDir: string): string {
  return join(atelierDir, 'incidents');
}

function getActiveFile(atelierDir: string): string {
  return join(getIncidentsDir(atelierDir), 'active.yaml');
}

function getHistoryDir(atelierDir: string): string {
  return join(getIncidentsDir(atelierDir), 'history');
}

export class IncidentManager {
  constructor(private atelierDir: string) {}

  /**
   * Trigger a new incident from a scenario.
   * Picks a random scenario if scenarioId is not specified.
   * Saves the incident to .atelier/incidents/active.yaml.
   */
  async trigger(
    scenarioId?: string,
    severity?: IncidentSeverity,
  ): Promise<Incident> {
    // Check for already-active incident
    const existing = await this.getActive();
    if (existing) {
      throw new Error(
        `An incident is already active: ${existing.id} ("${existing.title}"). ` +
          'Resolve it before triggering a new one.',
      );
    }

    const scenarios = await loadScenarios();
    if (scenarios.length === 0) {
      throw new Error('No incident scenarios available.');
    }

    let scenario: IncidentScenario | undefined;

    if (scenarioId) {
      scenario = scenarios.find((s) => s.id === scenarioId);
      if (!scenario) {
        const available = scenarios.map((s) => s.id).join(', ');
        throw new Error(
          `Unknown scenario "${scenarioId}". Available: ${available}`,
        );
      }
    } else {
      // Pick a random scenario, optionally filtering by severity.
      let pool = scenarios;
      if (severity) {
        pool = scenarios.filter((s) => s.severity === severity);
        if (pool.length === 0) {
          pool = scenarios;
        }
      }
      scenario = pool[Math.floor(Math.random() * pool.length)];
    }

    const now = new Date().toISOString();
    const id = `inc-${randomBytes(4).toString('hex')}`;

    const incident: Incident = {
      id,
      scenario_id: scenario.id,
      severity: severity ?? scenario.severity,
      title: scenario.title,
      description: scenario.description,
      symptoms: scenario.symptoms,
      root_cause: scenario.root_cause,
      red_herrings: scenario.red_herrings,
      affected_systems: scenario.affected_systems,
      status: 'active',
      timeline: [
        {
          timestamp: now,
          type: 'triggered',
          description: `Incident triggered: ${scenario.title}`,
          actor: 'system',
        },
      ],
      triggered_at: now,
      resolved_at: null,
      on_call: 'user',
      escalation_level: 0,
    };

    await this.saveActive(incident);
    return incident;
  }

  /** Load the currently active incident, or null if none. */
  async getActive(): Promise<Incident | null> {
    try {
      return await readYaml<Incident>(getActiveFile(this.atelierDir));
    } catch {
      return null;
    }
  }

  /** Update the status of the active incident and add a timeline event. */
  async updateStatus(
    status: IncidentStatus,
    notes?: string,
  ): Promise<Incident> {
    const incident = await this.getActive();
    if (!incident) {
      throw new Error('No active incident.');
    }

    const now = new Date().toISOString();
    const eventType = statusToEventType(status);

    const event: IncidentTimelineEvent = {
      timestamp: now,
      type: eventType,
      description: notes ?? `Status changed to ${status}`,
      actor: 'user',
    };

    incident.status = status;
    incident.timeline.push(event);

    await this.saveActive(incident);
    return incident;
  }

  /**
   * Resolve the active incident.
   * Reveals the actual root cause, moves the file to history.
   */
  async resolve(
    resolution: string,
    rootCause: string,
  ): Promise<{
    incident: Incident;
    root_cause_accuracy: 'correct' | 'partial' | 'incorrect';
    actual_root_cause: string;
  }> {
    const incident = await this.getActive();
    if (!incident) {
      throw new Error('No active incident.');
    }

    const now = new Date().toISOString();

    incident.status = 'resolved';
    incident.resolved_at = now;
    incident.resolution = resolution;

    incident.timeline.push({
      timestamp: now,
      type: 'resolved',
      description: `Resolved: ${resolution}`,
      actor: 'user',
    });

    // Score root cause accuracy
    const accuracy = scoreRootCauseAccuracy(
      rootCause,
      incident.root_cause,
    );

    // Move to history
    const historyDir = getHistoryDir(this.atelierDir);
    await mkdir(historyDir, { recursive: true });
    await writeYaml(join(historyDir, `${incident.id}.yaml`), incident);

    // Remove active file
    const { unlink } = await import('node:fs/promises');
    try {
      await unlink(getActiveFile(this.atelierDir));
    } catch {
      // File may already be gone.
    }

    return {
      incident,
      root_cause_accuracy: accuracy,
      actual_root_cause: incident.root_cause,
    };
  }

  /** Calculate escalation state based on time since trigger and severity. */
  getEscalation(incident: Incident): EscalationState {
    const triggeredAt = new Date(incident.triggered_at).getTime();
    const now = Date.now();
    const hoursElapsed = (now - triggeredAt) / (1000 * 60 * 60);

    // Escalation thresholds vary by severity
    const thresholds =
      incident.severity === 'sev1'
        ? [0.5, 1, 2] // sev1: escalates fast
        : incident.severity === 'sev2'
          ? [1, 3, 6] // sev2: moderate escalation
          : [2, 6, 12]; // sev3: slow escalation

    let level = 0;
    for (const threshold of thresholds) {
      if (hoursElapsed >= threshold) {
        level++;
      }
    }

    // Calculate hours until next escalation
    let hoursUntilNext = Infinity;
    if (level < thresholds.length) {
      hoursUntilNext = Math.max(0, thresholds[level] - hoursElapsed);
    }

    const pressureMap: Record<number, EscalationState['stakeholder_pressure']> =
      {
        0: 'low',
        1: 'medium',
        2: 'high',
        3: 'critical',
      };

    return {
      level: Math.min(level, 3),
      hours_until_next: Math.round(hoursUntilNext * 100) / 100,
      stakeholder_pressure: pressureMap[Math.min(level, 3)],
    };
  }

  /** Return all available incident scenarios. */
  async getScenarios(): Promise<IncidentScenario[]> {
    return loadScenarios();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async saveActive(incident: Incident): Promise<void> {
    const dir = getIncidentsDir(this.atelierDir);
    await mkdir(dir, { recursive: true });
    await writeYaml(getActiveFile(this.atelierDir), incident);
  }
}

function statusToEventType(
  status: IncidentStatus,
): IncidentTimelineEvent['type'] {
  switch (status) {
    case 'investigating':
      return 'update';
    case 'mitigating':
      return 'mitigated';
    case 'resolved':
      return 'resolved';
    case 'postmortem':
      return 'update';
    default:
      return 'update';
  }
}

/**
 * Score how accurately the user identified the root cause.
 * Uses simple keyword overlap heuristic.
 */
function scoreRootCauseAccuracy(
  userCause: string,
  actualCause: string,
): 'correct' | 'partial' | 'incorrect' {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

  const userWords = new Set(normalize(userCause));
  const actualWords = normalize(actualCause);

  if (actualWords.length === 0) return 'incorrect';

  let matchCount = 0;
  for (const word of actualWords) {
    if (userWords.has(word)) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / actualWords.length;

  if (matchRatio >= 0.4) return 'correct';
  if (matchRatio >= 0.15) return 'partial';
  return 'incorrect';
}

export type { Incident, IncidentScenario, IncidentTimelineEvent, EscalationState } from './types.js';
