import { parse, stringify } from 'yaml';
import type { CurriculumPack, CurriculumState, CurriculumBeadTemplate } from './types.js';
import { loadBuiltinPacks, getPackById } from './packs/index.js';

const CURRICULUM_DIR = 'curriculum';
const ACTIVE_FILE = 'active.yaml';

export class CurriculumManager {
  private curriculumPath: string;

  constructor(private atelierDir: string) {
    this.curriculumPath = `${atelierDir}/${CURRICULUM_DIR}`;
  }

  /**
   * Return all built-in curriculum packs.
   */
  async listAvailable(): Promise<CurriculumPack[]> {
    return loadBuiltinPacks();
  }

  /**
   * Start a curriculum pack. Creates active.yaml in .atelier/curriculum/.
   * Throws if a curriculum is already active or pack is not found.
   */
  async start(packId: string): Promise<CurriculumState> {
    const existing = await this.getState();
    if (existing && existing.status === 'active') {
      throw new Error(
        `Curriculum "${existing.pack_id}" is already active. Complete or reset it first.`,
      );
    }

    const pack = await getPackById(packId);
    if (!pack) {
      throw new Error(`Curriculum pack "${packId}" not found.`);
    }

    const state: CurriculumState = {
      pack_id: packId,
      started_at: new Date().toISOString(),
      current_sequence: 0,
      current_bead: 0,
      completed_sequences: [],
      status: 'active',
    };

    await this.saveState(state);
    return state;
  }

  /**
   * Load the current curriculum state from active.yaml, or null if none exists.
   */
  async getState(): Promise<CurriculumState | null> {
    const filePath = `${this.curriculumPath}/${ACTIVE_FILE}`;
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      return null;
    }

    const content = await file.text();
    return parse(content) as CurriculumState;
  }

  /**
   * Advance to the next sequence. If all sequences are done, mark completed.
   */
  async advanceSequence(): Promise<CurriculumState> {
    const state = await this.getState();
    if (!state) {
      throw new Error('No active curriculum. Start one first.');
    }
    if (state.status === 'completed') {
      throw new Error('Curriculum is already completed.');
    }

    const pack = await getPackById(state.pack_id);
    if (!pack) {
      throw new Error(`Pack "${state.pack_id}" not found.`);
    }

    // Record the completed sequence
    const completedSeq = pack.sequences[state.current_sequence];
    if (completedSeq) {
      state.completed_sequences.push(completedSeq.id);
    }

    // Move to next sequence
    const nextIndex = state.current_sequence + 1;
    if (nextIndex >= pack.sequences.length) {
      state.status = 'completed';
    } else {
      state.current_sequence = nextIndex;
      state.current_bead = 0;
    }

    await this.saveState(state);
    return state;
  }

  /**
   * Get bead templates for the current sequence.
   * Returns empty array if no curriculum is active.
   */
  async getCurrentBeadTemplates(): Promise<CurriculumBeadTemplate[]> {
    const state = await this.getState();
    if (!state || state.status === 'completed') {
      return [];
    }

    const pack = await getPackById(state.pack_id);
    if (!pack) return [];

    const sequence = pack.sequences[state.current_sequence];
    if (!sequence) return [];

    return sequence.bead_templates;
  }

  /**
   * Persist state to active.yaml, creating the directory if needed.
   */
  private async saveState(state: CurriculumState): Promise<void> {
    const dirPath = this.curriculumPath;
    // Ensure directory exists
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dirPath, { recursive: true });

    const filePath = `${dirPath}/${ACTIVE_FILE}`;
    const content = stringify(state);
    await Bun.write(filePath, content);
  }
}

export type { CurriculumPack, CurriculumState, CurriculumBeadTemplate } from './types.js';
