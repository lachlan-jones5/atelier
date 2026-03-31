import { z } from 'zod';
import type { AtelierContext } from '../util/types.js';
import { registerSessionTools } from './session.js';
import { registerBeadTools } from './bead.js';
import { registerTeamTools } from './team.js';
import { registerPersonaTools } from './persona.js';
import { registerOrgTools } from './org.js';
import { registerReviewTools } from './review.js';
import { registerCurriculumTools } from './curriculum.js';
import { registerMemoryTools } from './memory.js';
import { registerSkillTools } from './skill.js';
import { registerAdvanceTools } from './advance.js';
import { registerIncidentTools } from './incident.js';
import { registerInitTools } from './init.js';
import { registerScaffoldTools } from './scaffold.js';

// Tool definition type matching MCP SDK expectations
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema from zod
}

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: AtelierContext,
) => Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}>;

const tools: Map<string, { definition: ToolDefinition; schema: z.ZodType; handler: ToolHandler }> =
  new Map();

export function registerTool(
  name: string,
  description: string,
  schema: z.ZodType,
  handler: ToolHandler,
) {
  const jsonSchema = zodToJsonSchema(schema);
  tools.set(name, {
    definition: { name, description, inputSchema: jsonSchema },
    schema,
    handler,
  });
}

// Convert Zod schema to JSON Schema (simplified)
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodVal = value as z.ZodType;
      properties[key] = getPropertySchema(zodVal);
      if (!(zodVal instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
  return { type: 'object', properties: {} };
}

// Helper to extract JSON Schema from Zod primitive types
function getPropertySchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodString)
    return { type: 'string', description: schema.description };
  if (schema instanceof z.ZodNumber)
    return { type: 'number', description: schema.description };
  if (schema instanceof z.ZodBoolean)
    return { type: 'boolean', description: schema.description };
  if (schema instanceof z.ZodEnum)
    return {
      type: 'string',
      enum: (schema as z.ZodEnum<[string, ...string[]]>).options,
      description: schema.description,
    };
  if (schema instanceof z.ZodOptional)
    return { ...getPropertySchema((schema as z.ZodOptional<z.ZodType>).unwrap()) };
  if (schema instanceof z.ZodArray)
    return {
      type: 'array',
      items: getPropertySchema((schema as z.ZodArray<z.ZodType>).element),
    };
  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodVal = value as z.ZodType;
      properties[key] = getPropertySchema(zodVal);
      if (!(zodVal instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    return { type: 'object', properties, required, description: schema.description };
  }
  return { type: 'string' };
}

export function registerAllTools(): ToolDefinition[] {
  // Only register if not already registered (idempotent)
  if (tools.size === 0) {
    initializeTools();
  }

  return Array.from(tools.values()).map((t) => t.definition);
}

function initializeTools() {
  registerSessionTools(registerTool);
  registerBeadTools(registerTool);
  registerTeamTools(registerTool);
  registerPersonaTools(registerTool);
  registerOrgTools(registerTool);
  registerReviewTools(registerTool);
  registerCurriculumTools(registerTool);
  registerMemoryTools(registerTool);
  registerSkillTools(registerTool);
  registerAdvanceTools(registerTool);
  registerIncidentTools(registerTool);
  registerInitTools(registerTool);
  registerScaffoldTools(registerTool);
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AtelierContext,
) {
  const tool = tools.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const parsed = tool.schema.parse(args);
    return await tool.handler(parsed, ctx);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      return {
        content: [
          {
            type: 'text' as const,
            text: `Validation error in ${name}:\n${issues}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error in ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
