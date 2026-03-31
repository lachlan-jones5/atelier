import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { registerAllTools, callTool } from './tools/index.js';

export class AtelierServer {
  private server: Server;
  private projectRoot: string;
  private atelierDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.atelierDir = path.join(projectRoot, '.atelier');

    this.server = new Server(
      { name: 'atelier', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // ListTools handler — returns all registered tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: registerAllTools() };
    });

    // CallTool handler — dispatches to the right handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return callTool(name, args ?? {}, {
        projectRoot: this.projectRoot,
        atelierDir: this.atelierDir,
      });
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
