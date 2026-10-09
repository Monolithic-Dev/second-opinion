import { createHash, randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ToolError, ID_PATTERN } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';

/** Household/person/hold ids: prefixed, bounded, safe characters. */
export const idSchema = z.string().max(80).regex(ID_PATTERN, 'must look like prefix_id');

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_.:-]+$/, 'letters, digits and _ . : - only')
  .describe('Optional. Retrying with the same key and arguments returns the first result with replayed=true; the same key with different arguments is a CONFLICT.');

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

/** JSON with sorted keys so the same arguments always hash the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export interface ToolContext {
  /** Correlates logs, audit rows and decisions for one request (x-request-id or generated). */
  traceId: string;
}

type RequestExtra = { requestInfo?: { headers?: Record<string, string | string[] | undefined> } };

function traceIdFrom(extra: RequestExtra | undefined): string {
  const h = extra?.requestInfo?.headers?.['x-request-id'];
  const v = Array.isArray(h) ? h[0] : h;
  return v && /^[\w.-]{8,64}$/.test(v) ? v : randomUUID();
}

interface Spec<I extends z.ZodRawShape, O extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  input: I;
  output: O;
  annotations: ToolAnnotations;
  /** Adds an optional `idempotencyKey` input and `replayed` output. Handlers must be synchronous so the result and its key commit atomically. */
  idempotent?: boolean;
  handler: (args: z.infer<z.ZodObject<I>>, ctx: ToolContext) => z.infer<z.ZodObject<O>>;
  /** household the call acts on, for audit + logs */
  household?: (args: z.infer<z.ZodObject<I>>) => string | undefined;
}

/**
 * Register a tool following docs/mcp-best-practices.md: title, outputSchema, structuredContent + text,
 * business/validation failures as tool execution errors (isError), unexpected errors as INTERNAL without details,
 * one audit row and one log line per call, optional idempotency keys with replay.
 */
export function defineTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(server: McpServer, deps: Deps, spec: Spec<I, O>): void {
  const input = spec.idempotent ? { ...spec.input, idempotencyKey: idempotencyKeySchema.optional() } : spec.input;
  const output = spec.idempotent ? { ...spec.output, replayed: z.boolean().optional() } : spec.output;

  server.registerTool(
    spec.name,
    { title: spec.title, description: spec.description, inputSchema: input, outputSchema: output, annotations: spec.annotations },
    (async (rawArgs: Record<string, unknown>, extra: RequestExtra): Promise<CallToolResult> => {
      const started = performance.now();
      const traceId = traceIdFrom(extra);
      const { idempotencyKey, ...args } = rawArgs as { idempotencyKey?: string } & z.infer<z.ZodObject<I>>;
      const household = spec.household?.(args as z.infer<z.ZodObject<I>>) ?? null;
      const finish = (extraFields: Record<string, unknown>) =>
        deps.log.info('tool', { tool: spec.name, traceId, household, ms: Math.round(performance.now() - started), ...extraFields });
      try {
        let replayed = false;
        const out = deps.repos.transaction(() => {
          if (spec.idempotent && idempotencyKey) {
            const requestHash = createHash('sha256').update(stableStringify(args)).digest('hex');
            const prior = deps.repos.idempotency.get(spec.name, idempotencyKey);
            if (prior) {
              if (prior.request_hash !== requestHash) {
                throw new ToolError('CONFLICT', 'idempotencyKey was already used with different arguments');
              }
              replayed = true;
              return JSON.parse(prior.response_json) as z.infer<z.ZodObject<O>>;
            }
            const fresh = spec.handler(args as z.infer<z.ZodObject<I>>, { traceId });
            deps.repos.idempotency.put({ tool: spec.name, key: idempotencyKey, householdId: household, requestHash, response: fresh });
            return fresh;
          }
          return spec.handler(args as z.infer<z.ZodObject<I>>, { traceId });
        });
        deps.repos.audit.write(replayed ? `tool.${spec.name}.replayed` : `tool.${spec.name}`, household, { ok: true, traceId });
        finish({ isError: false, replayed });
        return okResult((replayed ? { ...(out as object), replayed: true } : out) as Record<string, unknown>);
      } catch (e) {
        if (e instanceof ToolError) {
          deps.repos.audit.write(`tool.${spec.name}`, household, { ok: false, code: e.code, traceId });
          finish({ isError: true, code: e.code });
          return errorResult(e.code, e.message);
        }
        deps.log.error('tool_failed', { tool: spec.name, traceId, household, error: e instanceof Error ? e.message : String(e) });
        return errorResult('INTERNAL', 'Something went wrong. The action was not taken.');
      }
    }) as never,
  );
}
