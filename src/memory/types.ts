import { MemoryEntryType } from '../util/types.js';

export interface MemoryEntry {
  type: MemoryEntryType;
  ts: string;           // ISO 8601 timestamp
  content: string;      // Natural language description
  tags: string[];       // For search/filtering
  bead_id?: string;     // If related to a specific bead
  session_id?: string;  // Which session this was created in
}

export interface RecallOptions {
  limit?: number;
  tags?: string[];
  since?: string;       // ISO 8601 timestamp — only entries at or after this time
}
