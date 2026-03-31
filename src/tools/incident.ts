import { z } from 'zod';
import { IncidentManager } from '../incidents/index.js';
import type { registerTool as RegisterToolFn } from './index.js';

export function registerIncidentTools(register: typeof RegisterToolFn) {
  // --- atelier_incident_trigger ---
  register(
    'atelier_incident_trigger',
    'Trigger a new incident simulation. Picks a random scenario if none specified. Returns incident details (symptoms, affected systems) but hides root cause.',
    z.object({
      scenario_id: z
        .string()
        .optional()
        .describe(
          'Specific scenario ID to trigger (e.g. "memory-leak", "cascading-failure"). Omit for random.',
        ),
      severity: z
        .enum(['sev1', 'sev2', 'sev3'])
        .optional()
        .describe('Override severity level. Defaults to the scenario severity.'),
    }),
    async (args, ctx) => {
      const { scenario_id, severity } = args as {
        scenario_id?: string;
        severity?: 'sev1' | 'sev2' | 'sev3';
      };

      const mgr = new IncidentManager(ctx.atelierDir);
      const incident = await mgr.trigger(scenario_id, severity);

      // Return incident info but hide root cause
      const visible = {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        description: incident.description,
        symptoms: incident.symptoms,
        red_herrings: incident.red_herrings,
        affected_systems: incident.affected_systems,
        status: incident.status,
        triggered_at: incident.triggered_at,
        on_call: incident.on_call,
        escalation_level: incident.escalation_level,
        timeline: incident.timeline,
        hint: 'Root cause is hidden. Investigate the symptoms and resolve the incident to reveal it.',
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(visible, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_incident_status ---
  register(
    'atelier_incident_status',
    'Get the currently active incident status, escalation state, and timeline. Also lists available scenarios if no incident is active.',
    z.object({}),
    async (_args, ctx) => {
      const mgr = new IncidentManager(ctx.atelierDir);
      const incident = await mgr.getActive();

      if (!incident) {
        const scenarios = await mgr.getScenarios();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  active_incident: null,
                  message: 'No active incident.',
                  available_scenarios: scenarios.map((s) => ({
                    id: s.id,
                    title: s.title,
                    severity: s.severity,
                    description: s.description,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const escalation = mgr.getEscalation(incident);

      // Return incident info but hide root cause
      const visible = {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        description: incident.description,
        symptoms: incident.symptoms,
        red_herrings: incident.red_herrings,
        affected_systems: incident.affected_systems,
        status: incident.status,
        triggered_at: incident.triggered_at,
        on_call: incident.on_call,
        timeline: incident.timeline,
        escalation,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(visible, null, 2),
          },
        ],
      };
    },
  );

  // --- atelier_incident_resolve ---
  register(
    'atelier_incident_resolve',
    'Resolve the active incident. Provide your diagnosis (root_cause) and resolution. The actual root cause will be revealed and your accuracy scored.',
    z.object({
      resolution: z
        .string()
        .describe('What was done to resolve the incident.'),
      root_cause: z
        .string()
        .describe(
          'Your diagnosis of the root cause. Will be compared against the actual root cause.',
        ),
    }),
    async (args, ctx) => {
      const { resolution, root_cause } = args as {
        resolution: string;
        root_cause: string;
      };

      const mgr = new IncidentManager(ctx.atelierDir);
      const result = await mgr.resolve(resolution, root_cause);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                incident_id: result.incident.id,
                title: result.incident.title,
                status: 'resolved',
                resolved_at: result.incident.resolved_at,
                your_resolution: resolution,
                your_root_cause: root_cause,
                actual_root_cause: result.actual_root_cause,
                root_cause_accuracy: result.root_cause_accuracy,
                timeline: result.incident.timeline,
                message:
                  result.root_cause_accuracy === 'correct'
                    ? 'Excellent diagnosis! You correctly identified the root cause.'
                    : result.root_cause_accuracy === 'partial'
                      ? 'Partial match. You were on the right track but missed some key details.'
                      : 'The actual root cause was different from your diagnosis. Review the details above.',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
