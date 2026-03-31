#!/usr/bin/env bun
import { AtelierServer } from './server.js';

const projectRoot = process.env.ATELIER_PROJECT_ROOT || process.cwd();
const server = new AtelierServer(projectRoot);
server.start().catch((err) => {
  console.error('Atelier MCP server failed to start:', err);
  process.exit(1);
});
