export interface ProgressParams {
  maturity: number;
  codeVolume: 'minimal' | 'moderate' | 'substantial' | 'large';
  gitHistoryDepth: number;
  beadDistribution: { open: number; inProgress: number; done: number };
  techDebtLevel: 'none' | 'low' | 'moderate' | 'high';
  documentationLevel: 'sparse' | 'moderate' | 'thorough';
  testCoverage: 'minimal' | 'moderate' | 'good' | 'excellent';
  establishedPatterns: boolean;
}

/**
 * Map a maturity value (0.0 to 0.9) to a set of generation parameters
 * that control the simulated project state.
 *
 * 0.0 = brand-new project, almost nothing exists
 * 0.9 = mature codebase with deep history and thorough coverage
 */
export function getProgressParams(maturity: number): ProgressParams {
  // Clamp to valid range
  const m = Math.max(0, Math.min(0.9, maturity));

  return {
    maturity: m,
    codeVolume: getCodeVolume(m),
    gitHistoryDepth: getGitHistoryDepth(m),
    beadDistribution: getBeadDistribution(m),
    techDebtLevel: getTechDebtLevel(m),
    documentationLevel: getDocumentationLevel(m),
    testCoverage: getTestCoverage(m),
    establishedPatterns: m >= 0.4,
  };
}

function getCodeVolume(
  m: number,
): 'minimal' | 'moderate' | 'substantial' | 'large' {
  if (m < 0.2) return 'minimal';
  if (m < 0.5) return 'moderate';
  if (m < 0.75) return 'substantial';
  return 'large';
}

function getGitHistoryDepth(m: number): number {
  // Roughly: 0.0 → 5 commits, 0.9 → 500 commits
  return Math.round(5 + m * 550);
}

function getBeadDistribution(
  m: number,
): { open: number; inProgress: number; done: number } {
  // Early projects have mostly open beads, mature ones have mostly done
  const total = Math.round(10 + m * 90); // 10 at 0.0, 100 at 1.0
  const doneRatio = m * 0.8; // 0% done at 0.0, 72% at 0.9
  const inProgressRatio = 0.1 + (1 - m) * 0.1; // ~10-20%

  const done = Math.round(total * doneRatio);
  const inProgress = Math.round(total * inProgressRatio);
  const open = Math.max(0, total - done - inProgress);

  return { open, inProgress, done };
}

function getTechDebtLevel(m: number): 'none' | 'low' | 'moderate' | 'high' {
  // Tech debt peaks in the middle (rapid growth phase), lower at extremes
  if (m < 0.15) return 'none';
  if (m < 0.35) return 'low';
  if (m < 0.65) return 'high'; // active development accumulates debt
  if (m < 0.8) return 'moderate'; // mature projects pay it down
  return 'low';
}

function getDocumentationLevel(
  m: number,
): 'sparse' | 'moderate' | 'thorough' {
  if (m < 0.3) return 'sparse';
  if (m < 0.7) return 'moderate';
  return 'thorough';
}

function getTestCoverage(
  m: number,
): 'minimal' | 'moderate' | 'good' | 'excellent' {
  if (m < 0.2) return 'minimal';
  if (m < 0.5) return 'moderate';
  if (m < 0.75) return 'good';
  return 'excellent';
}
