import { getHistoryDir } from './paths.js';
import { join } from 'node:path';
import { mkdir, appendFile, readFile } from 'node:fs/promises';

export interface ChatLogEntry {
  ts: string;
  channel: string;
  from: string;
  message: string;
  [key: string]: unknown;
}

export async function appendChatLog(atelierDir: string, entry: ChatLogEntry): Promise<void> {
  const historyDir = getHistoryDir(atelierDir);
  await mkdir(historyDir, { recursive: true });
  const filePath = join(historyDir, 'chat.jsonl');
  const line = JSON.stringify(entry) + '\n';
  await appendFile(filePath, line, 'utf-8');
}

export async function readChatLog(filePath: string, limit?: number): Promise<any[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }
  const entries = content.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  if (limit !== undefined) {
    return entries.slice(-limit);
  }
  return entries;
}
