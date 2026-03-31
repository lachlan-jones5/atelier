import { mkdtemp, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AtelierContext } from '../../src/util/types.js';
import { registerAllTools, callTool } from '../../src/tools/index.js';

const FIXTURE_DIR = join(
  import.meta.dir,
  '..',
  'fixtures',
  'atelier-state',
  'fresh-init',
);

let toolsRegistered = false;

/**
 * Ensure tools are registered exactly once across all test files.
 */
export function ensureToolsRegistered(): void {
  if (!toolsRegistered) {
    registerAllTools();
    toolsRegistered = true;
  }
}

/**
 * Create a temporary .atelier directory populated from the fresh-init fixture.
 * Returns the AtelierContext and a cleanup function.
 */
export async function createTestContext(): Promise<{
  ctx: AtelierContext;
  tmpDir: string;
  cleanup: () => Promise<void>;
}> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'atelier-test-'));
  const atelierDir = join(tmpDir, '.atelier');

  // Copy fixture data into temp .atelier dir
  await cp(FIXTURE_DIR, atelierDir, { recursive: true });

  const ctx: AtelierContext = {
    projectRoot: tmpDir,
    atelierDir,
  };

  const cleanup = async () => {
    await rm(tmpDir, { recursive: true, force: true });
  };

  return { ctx, tmpDir, cleanup };
}

/**
 * Parse the JSON text content from a tool result.
 */
export function parseResult(result: {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}): unknown {
  return JSON.parse(result.content[0].text);
}

export { callTool };
