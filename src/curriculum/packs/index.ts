import { parse } from 'yaml';
import type { CurriculumPack } from '../types.js';

// All built-in pack filenames (without extension)
const PACK_FILES = [
  'rest-api',
  'debugging',
  'code-review',
  'testing',
  'open-source',
] as const;

let cachedPacks: CurriculumPack[] | null = null;

/**
 * Load all built-in curriculum packs from YAML files.
 * Results are cached after first load.
 */
export async function loadBuiltinPacks(): Promise<CurriculumPack[]> {
  if (cachedPacks) return cachedPacks;

  const packs: CurriculumPack[] = [];
  const packsDir = import.meta.dir;

  for (const name of PACK_FILES) {
    const file = Bun.file(`${packsDir}/${name}.yaml`);
    const content = await file.text();
    const pack = parse(content) as CurriculumPack;
    packs.push(pack);
  }

  cachedPacks = packs;
  return packs;
}

/**
 * Get a single pack by ID, or null if not found.
 */
export async function getPackById(id: string): Promise<CurriculumPack | null> {
  const packs = await loadBuiltinPacks();
  return packs.find((p) => p.id === id) ?? null;
}
