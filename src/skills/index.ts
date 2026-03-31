import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { SkillDimension } from '../util/types.js';
import { SkillProfile, SkillLevel, SkillEvidence } from './types.js';

const ALL_DIMENSIONS: SkillDimension[] = [
  'reading_code',
  'testing',
  'debugging',
  'design',
  'review',
  'communication',
  'ops_awareness',
];

function makeDefaultLevel(): SkillLevel {
  return {
    level: 0,
    trend: 'stable',
    observation_count: 0,
    last_assessment: new Date().toISOString(),
  };
}

function makeDefaultProfile(): SkillProfile {
  const dimensions = {} as Record<SkillDimension, SkillLevel>;
  for (const dim of ALL_DIMENSIONS) {
    dimensions[dim] = makeDefaultLevel();
  }
  return {
    dimensions,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Recompute a dimension's level from all evidence for that dimension.
 *
 * Uses a weighted moving average: more recent observations carry more weight.
 * Scores (1-5) are mapped to the 0-100 range, and a trend is derived by
 * comparing the most recent window against the overall average.
 */
function recomputeLevel(
  current: SkillLevel,
  allEvidence: SkillEvidence[],
): SkillLevel {
  if (allEvidence.length === 0) return current;

  // Sort chronologically (oldest first)
  const sorted = [...allEvidence].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Weighted average — linearly increasing weights
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < sorted.length; i++) {
    const weight = i + 1;
    weightedSum += sorted[i].score * weight;
    weightTotal += weight;
  }
  const avgScore = weightedSum / weightTotal; // 1-5

  // Map 1-5 score to 0-100
  const level = Math.round(((avgScore - 1) / 4) * 100);

  // Determine trend by comparing recent half vs older half
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (sorted.length >= 4) {
    const mid = Math.floor(sorted.length / 2);
    const olderAvg =
      sorted.slice(0, mid).reduce((s, e) => s + e.score, 0) / mid;
    const recentAvg =
      sorted.slice(mid).reduce((s, e) => s + e.score, 0) /
      (sorted.length - mid);
    const diff = recentAvg - olderAvg;
    if (diff > 0.3) trend = 'improving';
    else if (diff < -0.3) trend = 'declining';
  }

  return {
    level,
    trend,
    observation_count: sorted.length,
    last_assessment: sorted[sorted.length - 1].timestamp,
  };
}

export class SkillTracker {
  private profile: SkillProfile | null = null;
  private evidence: SkillEvidence[] = [];

  constructor(private atelierDir: string) {}

  private get skillsPath(): string {
    return join(this.atelierDir, 'skills.json');
  }

  /**
   * Load from .atelier/skills.json.
   * Initialize with all dimensions at 0 if file doesn't exist.
   */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.skillsPath, 'utf-8');
      const data = JSON.parse(raw) as {
        profile: SkillProfile;
        evidence: SkillEvidence[];
      };
      this.profile = data.profile;
      this.evidence = data.evidence ?? [];

      // Ensure any newly-added dimensions are present
      for (const dim of ALL_DIMENSIONS) {
        if (!this.profile.dimensions[dim]) {
          this.profile.dimensions[dim] = makeDefaultLevel();
        }
      }
    } catch {
      this.profile = makeDefaultProfile();
      this.evidence = [];
    }
  }

  /**
   * Record a skill observation. Adds evidence and recomputes the affected
   * dimension's level.
   */
  recordObservation(obs: Omit<SkillEvidence, 'timestamp'>): void {
    if (!this.profile) {
      throw new Error('SkillTracker not loaded — call load() first');
    }

    const entry: SkillEvidence = {
      ...obs,
      timestamp: new Date().toISOString(),
    };
    this.evidence.push(entry);

    // Recompute the affected dimension
    const dimEvidence = this.evidence.filter(
      (e) => e.dimension === obs.dimension,
    );
    this.profile.dimensions[obs.dimension] = recomputeLevel(
      this.profile.dimensions[obs.dimension],
      dimEvidence,
    );
    this.profile.last_updated = new Date().toISOString();
  }

  /** Return the current skill profile. */
  getScores(): SkillProfile {
    if (!this.profile) {
      throw new Error('SkillTracker not loaded — call load() first');
    }
    return this.profile;
  }

  /** Return detailed info for a single dimension. */
  getDimensionDetail(
    dimension: SkillDimension,
  ): { level: SkillLevel; recentEvidence: SkillEvidence[] } {
    if (!this.profile) {
      throw new Error('SkillTracker not loaded — call load() first');
    }

    const level = this.profile.dimensions[dimension];
    if (!level) {
      throw new Error(`Unknown dimension: ${dimension}`);
    }

    const recentEvidence = this.evidence
      .filter((e) => e.dimension === dimension)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 10);

    return { level, recentEvidence };
  }

  /** Persist skills.json to disk. */
  async save(): Promise<void> {
    await mkdir(dirname(this.skillsPath), { recursive: true });
    const data = {
      profile: this.profile,
      evidence: this.evidence,
    };
    await writeFile(this.skillsPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
