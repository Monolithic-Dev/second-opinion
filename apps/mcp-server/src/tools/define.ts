import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ToolError, ID_PATTERN } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';

/** Household/person/hold ids: prefixed, bounded, safe characters. */
export const idSchema = z.string().max(80).regex(ID_PATTERN, 'must look like prefix_id');

const MAX_LIST_ITEMS = 200;
export function cap<T>(items: T[]): { items: T[]; truncated: boolean } {
  return items.length > MAX_LIST_ITEMS ? { items: items.slice(0, MAX_LIST_ITEMS), truncated: true } : { items, truncated: false };
}

export function okResult<T extends Record<string, unknown>>(structured: T): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(structured) }], structuredContent: structured };
}

export function errorResult(code: string, message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: `${code}: ${message}` }], structuredContent: { code, message } };
}

interface Spec<I extends z.ZodRawShape, O extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  input: I;
  output: O;
  annotations: ToolAnnotations;
  handler: (args: z.infer<z.ZodObject<I>>) => Promise<z.infer<z.ZodObject<O>>> | z.infer<z.ZodObject<O>>;
  /** household the call acts on, for audit + logs */
  household?: (args: z.infer<z.ZodObject<I>>) => string | undefined;
}

/**
 * Register a tool following docs/mcp-best-practices.md: title, outputSchema, structuredContent + text,
 * business/validation failures as tool execution errors (isError), unexpected errors as INTERNAL without details,
 * one audit row and one log line per call.
 */
export function defineTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(server: McpServer, deps: Deps, spec: Spec<I, O>): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.input,
      outputSchema: spec.output,
      annotations: spec.annotations,
    },
    (async (args: z.infer<z.ZodObject<I>>): Promise<CallToolResult> => {
      const started = performance.now();
      const household = spec.household?.(args) ?? null;
      try {
        const out = await spec.handler(args);
        deps.repos.audit.write(`tool.${spec.name}`, household, { ok: true });
        deps.log.info('tool', { tool: spec.name, household, ms: Math.round(performance.now() - started), isError: false });
        return okResult(out as Record<string, unknown>);
      } catch (e) {
        if (e instanceof ToolError) {
          deps.repos.audit.write(`tool.${spec.name}`, household, { ok: false, code: e.code });
          deps.log.info('tool', { tool: spec.name, household, ms: Math.round(performance.now() - started), isError: true, code: e.code });
          return errorResult(e.code, e.message);
        }
        deps.log.error('tool_failed', { tool: spec.name, household, error: e instanceof Error ? e.message : String(e) });
        return errorResult('INTERNAL', 'Something went wrong. The action was not taken.');
      }
    }) as never,
  );
}
