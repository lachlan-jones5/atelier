import { randomBytes } from 'node:crypto';

function hexChars(n: number): string {
  return randomBytes(n).toString('hex').slice(0, n);
}

/** Returns `bead-<12 random hex chars>`, e.g. `bead-a3f2dd91bc04`. */
export function generateBeadId(): string {
  return `bead-${hexChars(12)}`;
}

/** Returns `session-<ISO date>-<12 random hex>`, e.g. `session-2026-03-31-a3f2dd91bc04`. */
export function generateSessionId(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `session-${date}-${hexChars(12)}`;
}

/** Returns `incident-<12 random hex chars>`. */
export function generateIncidentId(): string {
  return `incident-${hexChars(12)}`;
}

/** Returns `review-<12 random hex chars>`. */
export function generateReviewId(): string {
  return `review-${hexChars(12)}`;
}
