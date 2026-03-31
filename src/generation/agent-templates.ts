import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Organization } from '../core/organization.js';
import { Team } from '../core/team.js';
import { Persona } from '../core/persona.js';

export interface AgentTemplateContext {
  org: Organization;
  team?: Team;
  persona?: Persona;
  allTeams: Team[];
  allPersonas: Persona[];
  mcpServerName: string; // "atelier"
  // Computed fields added during rendering
  teamPersonas?: Persona[];
  otherTeams?: Team[];
  memories?: string;
  context?: string;
  userMessage?: string;
}

/**
 * Minimal template engine supporting:
 * - {{variable}} and {{object.field}} interpolation
 * - {{#each array}}...{{/each}} loops (with {{this}} for primitives, {{field}} for objects)
 * - {{#if value}}...{{/if}} conditionals (with optional {{else}})
 * - {{@last}}, {{@first}}, {{@index}} inside #each blocks
 */
export class AgentTemplateEngine {
  private templates: Map<string, string> = new Map();
  private templatesDir: string;

  constructor(templatesDir?: string) {
    // Default to templates/ relative to the package root (two levels up from src/generation/)
    const thisDir = dirname(fileURLToPath(import.meta.url));
    // From dist/generation/ or src/generation/, go up two levels to package root
    this.templatesDir = templatesDir ?? join(thisDir, '..', '..', 'templates');
  }

  /** Load all .hbs templates from the templates directory. */
  async loadTemplates(): Promise<void> {
    this.templates.clear();
    let entries: string[];
    try {
      const dirents = await readdir(this.templatesDir);
      entries = dirents.filter((f) => f.endsWith('.hbs'));
    } catch {
      throw new Error(`AgentTemplateEngine: templates directory not found at ${this.templatesDir}`);
    }

    for (const filename of entries) {
      const content = await readFile(join(this.templatesDir, filename), 'utf-8');
      const name = basename(filename, '.hbs');
      // Also strip .md if present (e.g., "org-orchestrator.md.hbs" -> "org-orchestrator")
      this.templates.set(name.replace(/\.md$/, ''), content);
    }
  }

  /** Render a named template with the given context. */
  render(templateName: string, context: AgentTemplateContext): string {
    const template = this.templates.get(templateName);
    if (!template) {
      const available = Array.from(this.templates.keys()).join(', ');
      throw new Error(
        `Template "${templateName}" not found. Available: ${available}`,
      );
    }
    return renderTemplate(template, context as unknown as Record<string, unknown>);
  }

  /** Generate all agent files for the project. */
  async generateAll(
    projectRoot: string,
    context: AgentTemplateContext,
  ): Promise<GenerationResult> {
    await this.loadTemplates();

    const agentsDir = join(projectRoot, '.claude', 'agents');
    await mkdir(agentsDir, { recursive: true });

    const generated: string[] = [];

    // 1. Org orchestrator -> .claude/agents/atelier.md
    const orgContent = this.render('org-orchestrator', context);
    const orgPath = join(agentsDir, 'atelier.md');
    await writeFile(orgPath, orgContent, 'utf-8');
    generated.push(orgPath);

    // 2. Per-team orchestrators -> .claude/agents/<team-slug>.md
    for (const team of context.allTeams) {
      const teamPersonas = context.allPersonas.filter((p) => p.team === team.slug);
      const otherTeams = context.allTeams.filter((t) => t.slug !== team.slug);
      const teamContext: AgentTemplateContext = {
        ...context,
        team,
        teamPersonas,
        otherTeams,
      };
      const teamContent = this.render('team-orchestrator', teamContext);
      const teamPath = join(agentsDir, `${team.slug}.md`);
      await writeFile(teamPath, teamContent, 'utf-8');
      generated.push(teamPath);
    }

    // 3. Per-persona DM agents -> .claude/agents/<persona-slug>.md
    for (const persona of context.allPersonas) {
      const team = context.allTeams.find((t) => t.slug === persona.team);
      if (!team) continue;
      const personaContext: AgentTemplateContext = {
        ...context,
        persona,
        team,
      };
      const personaContent = this.render('persona-dm', personaContext);
      const personaPath = join(agentsDir, `${persona.slug}.md`);
      await writeFile(personaPath, personaContent, 'utf-8');
      generated.push(personaPath);
    }

    // 4. Review agent -> .claude/agents/atelier-review.md
    const reviewContent = this.render('review-agent', context);
    const reviewPath = join(agentsDir, 'atelier-review.md');
    await writeFile(reviewPath, reviewContent, 'utf-8');
    generated.push(reviewPath);

    return { generated, agentsDir };
  }

  /** Render the sub-agent prompt template with inline context (not written to file). */
  renderSubAgentPrompt(context: AgentTemplateContext): string {
    return this.render('sub-agent-prompt', context);
  }
}

export interface GenerationResult {
  generated: string[];
  agentsDir: string;
}

// ---------------------------------------------------------------------------
// Template engine internals
// ---------------------------------------------------------------------------

/**
 * Resolve a dotted path (e.g., "persona.name") against a context object.
 * Returns undefined if any segment is missing.
 */
function resolvePath(context: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Format a value for template output.
 * Arrays are joined with ", ". Objects are JSON-stringified. Everything else is String().
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Find the matching closing tag for a block helper, handling nesting.
 * Returns the index in the source string where the closing tag starts.
 */
function findClosingTag(
  source: string,
  openTag: string,
  closeTag: string,
  startIndex: number,
): number {
  let depth = 1;
  let i = startIndex;
  while (i < source.length && depth > 0) {
    const nextOpen = source.indexOf(openTag, i);
    const nextClose = source.indexOf(closeTag, i);

    if (nextClose === -1) return -1; // Malformed template

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      i = nextClose + closeTag.length;
    }
  }
  return -1;
}

/**
 * Core template rendering function. Processes:
 * 1. {{#each array}}...{{/each}} blocks (with {{@index}}, {{@first}}, {{@last}}, {{this}})
 * 2. {{#if value}}...{{else}}...{{/if}} blocks
 * 3. {{path}} variable interpolation
 */
function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  let result = '';
  let i = 0;

  while (i < template.length) {
    // Look for next {{ tag
    const tagStart = template.indexOf('{{', i);
    if (tagStart === -1) {
      result += template.slice(i);
      break;
    }

    // Add text before the tag
    result += template.slice(i, tagStart);

    // Escaped \{{ — output literal {{
    if (tagStart > 0 && template[tagStart - 1] === '\\') {
      // Remove the trailing backslash we already appended
      result = result.slice(0, -1);
      result += '{{';
      i = tagStart + 2;
      continue;
    }

    const tagEnd = template.indexOf('}}', tagStart);
    if (tagEnd === -1) {
      result += template.slice(tagStart);
      break;
    }

    const tagContent = template.slice(tagStart + 2, tagEnd).trim();

    // --- {{#each variable}} ---
    if (tagContent.startsWith('#each ')) {
      const varName = tagContent.slice(6).trim();
      const closeTag = '{{/each}}';
      const openTag = '{{#each ';
      const bodyStart = tagEnd + 2;
      const bodyEnd = findClosingTag(template, openTag, closeTag, bodyStart);
      if (bodyEnd === -1) {
        result += `{{${tagContent}}}`;
        i = tagEnd + 2;
        continue;
      }

      const body = template.slice(bodyStart, bodyEnd);
      const items = resolvePath(context, varName);

      if (Array.isArray(items)) {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          // Build loop context: merge parent context with item fields + loop metadata
          const loopContext: Record<string, unknown> = { ...context };
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            Object.assign(loopContext, item as Record<string, unknown>);
          }
          loopContext['this'] = item;
          loopContext['@index'] = idx;
          loopContext['@first'] = idx === 0;
          loopContext['@last'] = idx === items.length - 1;
          result += renderTemplate(body, loopContext);
        }
      }

      i = bodyEnd + closeTag.length;
      continue;
    }

    // --- {{#if variable}} ---
    if (tagContent.startsWith('#if ')) {
      const varExpr = tagContent.slice(4).trim();
      const closeTag = '{{/if}}';
      const openTag = '{{#if ';
      const bodyStart = tagEnd + 2;
      const bodyEnd = findClosingTag(template, openTag, closeTag, bodyStart);
      if (bodyEnd === -1) {
        result += `{{${tagContent}}}`;
        i = tagEnd + 2;
        continue;
      }

      const fullBody = template.slice(bodyStart, bodyEnd);

      // Check for {{else}} — find the top-level else (not nested)
      let trueBody: string;
      let falseBody: string;
      const elseSplit = findTopLevelElse(fullBody);
      if (elseSplit !== -1) {
        trueBody = fullBody.slice(0, elseSplit);
        falseBody = fullBody.slice(elseSplit + '{{else}}'.length);
      } else {
        trueBody = fullBody;
        falseBody = '';
      }

      // Handle negation: {{#if !variable}}
      let negate = false;
      let resolveExpr = varExpr;
      if (varExpr.startsWith('!')) {
        negate = true;
        resolveExpr = varExpr.slice(1);
      }

      const value = resolvePath(context, resolveExpr);
      let truthyResult = isTruthy(value);
      if (negate) truthyResult = !truthyResult;

      if (truthyResult) {
        result += renderTemplate(trueBody, context);
      } else {
        result += renderTemplate(falseBody, context);
      }

      i = bodyEnd + closeTag.length;
      continue;
    }

    // --- Closing tags (should not appear here; they are consumed by openers) ---
    if (tagContent.startsWith('/')) {
      i = tagEnd + 2;
      continue;
    }

    // --- {{variable}} or {{object.field}} ---
    const value = resolvePath(context, tagContent);
    result += formatValue(value);
    i = tagEnd + 2;
  }

  return result;
}

/** Find the top-level {{else}} in a body string (not nested inside #if blocks). */
function findTopLevelElse(body: string): number {
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const nextIf = body.indexOf('{{#if ', i);
    const nextEndIf = body.indexOf('{{/if}}', i);
    const nextElse = body.indexOf('{{else}}', i);

    // Collect candidates and sort by position
    const candidates: Array<{ type: string; pos: number }> = [];
    if (nextIf !== -1) candidates.push({ type: 'if', pos: nextIf });
    if (nextEndIf !== -1) candidates.push({ type: 'endif', pos: nextEndIf });
    if (nextElse !== -1) candidates.push({ type: 'else', pos: nextElse });

    if (candidates.length === 0) break;
    candidates.sort((a, b) => a.pos - b.pos);

    const first = candidates[0];
    if (first.type === 'if') {
      depth++;
      i = first.pos + '{{#if '.length;
    } else if (first.type === 'endif') {
      depth--;
      i = first.pos + '{{/if}}'.length;
    } else if (first.type === 'else') {
      if (depth === 0) return first.pos;
      i = first.pos + '{{else}}'.length;
    }
  }
  return -1;
}

/** Determine truthiness for template conditionals. */
function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
