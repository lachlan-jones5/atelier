import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateSessionId } from '../util/id.js';

export interface SessionState {
  sessionId: string;
  startedAt: string;
  lastActiveAt: string;
  logicalDay: number;
  events: SessionEvent[];
}

export interface SessionEvent {
  timestamp: string;
  type:
    | 'chat'
    | 'bead_claim'
    | 'bead_complete'
    | 'review_submit'
    | 'review_complete'
    | 'advance'
    | 'incident'
    | 'skill_observation';
  data: Record<string, unknown>;
}

export class SessionManager {
  private state: SessionState | null = null;

  /**
   * Load session state from state.json, or create a new session if none exists.
   */
  async load(atelierDir: string): Promise<SessionState> {
    const filePath = join(atelierDir, 'state.json');
    try {
      const content = await readFile(filePath, 'utf-8');
      this.state = JSON.parse(content) as SessionState;
    } catch {
      // No existing session; create a fresh one
      const now = new Date().toISOString();
      this.state = {
        sessionId: generateSessionId(),
        startedAt: now,
        lastActiveAt: now,
        logicalDay: 1,
        events: [],
      };
    }
    return this.state;
  }

  /** Persist session state to state.json. */
  async save(atelierDir: string): Promise<void> {
    if (!this.state) {
      throw new Error('SessionManager: no session loaded. Call load() first.');
    }
    const filePath = join(atelierDir, 'state.json');
    this.state.lastActiveAt = new Date().toISOString();
    await writeFile(filePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  /** Get the current session. Throws if not loaded. */
  get(): SessionState {
    if (!this.state) {
      throw new Error('SessionManager: no session loaded. Call load() first.');
    }
    return this.state;
  }

  /** Add an event with an auto-generated timestamp. */
  logEvent(event: Omit<SessionEvent, 'timestamp'>): void {
    const session = this.get();
    session.events.push({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /** Check whether a session is currently loaded. */
  isActive(): boolean {
    return this.state !== null;
  }
}
