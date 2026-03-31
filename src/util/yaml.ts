import { readFile, readFileSync, writeFile, rename, unlink } from 'node:fs';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse, stringify } from 'yaml';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const renameAsync = promisify(rename);
const unlinkAsync = promisify(unlink);

/**
 * Read and parse a YAML file.
 */
export async function readYaml<T>(filePath: string): Promise<T> {
  const content = await readFileAsync(filePath, 'utf-8');
  return parse(content) as T;
}

/**
 * Write data as YAML to a file.
 * Uses atomic write: writes to a temp file in the same directory, then renames.
 */
export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  const content = stringify(data);
  const dir = dirname(filePath);
  const tmpFile = join(dir, `.tmp-${randomBytes(4).toString('hex')}`);
  await writeFileAsync(tmpFile, content, 'utf-8');
  try {
    await renameAsync(tmpFile, filePath);
  } catch (err) {
    try { await unlinkAsync(tmpFile); } catch {} // best-effort cleanup
    throw err;
  }
}

/**
 * Synchronous version of readYaml for use during startup.
 */
export function readYamlSync<T>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return parse(content) as T;
}
