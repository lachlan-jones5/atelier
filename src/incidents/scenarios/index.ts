import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml } from '../../util/yaml.js';
import type { IncidentScenario } from '../types.js';

const SCENARIOS_DIR = new URL('.', import.meta.url).pathname;

let cachedScenarios: IncidentScenario[] | null = null;

/**
 * Load all YAML scenario files from the scenarios directory.
 * Results are cached after the first load.
 */
export async function loadScenarios(): Promise<IncidentScenario[]> {
  if (cachedScenarios) return cachedScenarios;

  const scenarios: IncidentScenario[] = [];

  let files: string[];
  try {
    const dirents = await readdir(SCENARIOS_DIR);
    files = dirents.filter(
      (f) => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.'),
    );
  } catch {
    return [];
  }

  for (const file of files) {
    try {
      const scenario = await readYaml<IncidentScenario>(
        join(SCENARIOS_DIR, file),
      );
      scenarios.push(scenario);
    } catch {
      // Skip malformed scenario files.
      continue;
    }
  }

  cachedScenarios = scenarios;
  return scenarios;
}

/** Clear the scenario cache (useful for testing). */
export function clearScenarioCache(): void {
  cachedScenarios = null;
}
