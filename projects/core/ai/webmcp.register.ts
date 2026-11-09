import { svWarnOnce } from '@styloviz/core/dev';
import { svIsWebMcpName, svModelContext, type SvWebMcpSchema, type SvWebMcpTool } from './webmcp.source';

/**
 * `FL-E2` — the half of WebMCP that runs only where a browser has
 * `modelContext`: the argument check and the registration. `svWebMcp` loads it
 * with `import()` once it has found a registry, and `call()` when a host asks.
 */

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Checks `value` against `schema` and returns the first problem as a sentence,
 * or `null` when it fits. Enforces the subset in `SvWebMcpSchema`; unknown
 * object keys are refused unless `additionalProperties` is `true`.
 */
export function svCheckWebMcpArgs(schema: SvWebMcpSchema, value: unknown, path = 'arguments'): string | null {
  if (schema.anyOf) {
    return schema.anyOf.some((option) => svCheckWebMcpArgs(option, value, path) === null)
      ? null
      : `${path} matches none of the allowed shapes.`;
  }
  const actual = typeOf(value);
  switch (schema.type) {
    case 'object': {
      if (actual !== 'object') return `${path} must be an object, got ${actual}.`;
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (record[key] === undefined) return `${path}.${key} is required.`;
      }
      const properties = schema.properties ?? {};
      for (const [key, entry] of Object.entries(record)) {
        const child = Object.hasOwn(properties, key) ? properties[key] : undefined;
        if (!child) {
          if (schema.additionalProperties === true) continue;
          return `${path}.${key} is not a known argument.`;
        }
        if (entry === undefined) continue;
        const problem = svCheckWebMcpArgs(child, entry, `${path}.${key}`);
        if (problem) return problem;
      }
      return null;
    }
    case 'array': {
      if (actual !== 'array') return `${path} must be an array, got ${actual}.`;
      const list = value as readonly unknown[];
      if (schema.minItems !== undefined && list.length < schema.minItems) return `${path} needs at least ${schema.minItems} item(s).`;
      if (schema.maxItems !== undefined && list.length > schema.maxItems) return `${path} takes at most ${schema.maxItems} item(s).`;
      if (schema.items) {
        for (let i = 0; i < list.length; i++) {
          const problem = svCheckWebMcpArgs(schema.items, list[i], `${path}[${i}]`);
          if (problem) return problem;
        }
      }
      return null;
    }
    case 'string': {
      if (actual !== 'string') return `${path} must be a string, got ${actual}.`;
      const text = value as string;
      if (schema.minLength !== undefined && text.length < schema.minLength) return `${path} must be at least ${schema.minLength} character(s).`;
      if (schema.maxLength !== undefined && text.length > schema.maxLength) return `${path} must be at most ${schema.maxLength} character(s).`;
      break;
    }
    case 'number':
    case 'integer': {
      if (actual !== 'number' || !Number.isFinite(value as number)) return `${path} must be a finite number.`;
      const n = value as number;
      if (schema.type === 'integer' && !Number.isInteger(n)) return `${path} must be a whole number.`;
      if (schema.minimum !== undefined && n < schema.minimum) return `${path} must be at least ${schema.minimum}.`;
      if (schema.maximum !== undefined && n > schema.maximum) return `${path} must be at most ${schema.maximum}.`;
      break;
    }
    case 'boolean':
      if (actual !== 'boolean') return `${path} must be true or false.`;
      break;
  }
  if (schema.enum && !schema.enum.includes(value as string | number)) {
    return `${path} must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}.`;
  }
  return null;
}

/**
 * Runs one tool as an agent's call does: the arguments are checked against its
 * schema first, a refusal or a thrown error comes back as text, and nothing
 * runs once `signal` has aborted.
 */
export async function svRunWebMcpTool(tool: SvWebMcpTool, args: unknown, signal: AbortSignal): Promise<string> {
  const input = args ?? {};
  const problem = svCheckWebMcpArgs(tool.inputSchema, input);
  if (problem) return `Refused: ${problem}`;
  if (signal.aborted) return 'Refused: the widget is no longer on the page.';
  try {
    return await tool.execute(input as Readonly<Record<string, unknown>>, { signal });
  } catch (error) {
    return `Failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Options for `svRegisterWebMcpTools`. */
export interface SvWebMcpRegisterOptions {
  /** Unregisters every tool when aborted. */
  readonly signal: AbortSignal;
  /** Prepended to each tool's name with `_` (`orders` + `sort` → `orders_sort`). */
  readonly prefix?: string;
  /** Called with each registered name, or with the reason a tool was skipped. */
  readonly onRegistered?: (name: string) => void;
}

/**
 * Registers `tools` with the browser's `modelContext`, each wrapped so its
 * arguments are checked before it runs and a thrown error comes back as text.
 * Resolves to the names registered — `[]` when the browser has no WebMCP.
 */
export async function svRegisterWebMcpTools(
  doc: Document,
  tools: readonly SvWebMcpTool[],
  options: SvWebMcpRegisterOptions,
): Promise<readonly string[]> {
  const context = svModelContext(doc);
  if (!context || options.signal.aborted) return [];
  const registered: string[] = [];
  for (const tool of tools) {
    const name = options.prefix ? `${options.prefix}_${tool.name}` : tool.name;
    if (!svIsWebMcpName(name)) {
      svWarnOnce(`webmcp-name:${name}`, `[svWebMcp] "${name}" is not a usable tool name (a letter, then letters, digits, _ or -, up to 64) — skipped.`);
      continue;
    }
    const wrapped = {
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
      execute: (args: unknown, client?: { signal?: AbortSignal }): Promise<string> => {
        const signal = client?.signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([options.signal, client.signal]) : options.signal;
        return svRunWebMcpTool(tool, args, signal);
      },
    };
    try {
      await context.registerTool(wrapped, { signal: options.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return registered;
      svWarnOnce(`webmcp-register:${name}`, `[svWebMcp] the browser refused "${name}": ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    registered.push(name);
    options.onRegistered?.(name);
    // Builds whose registerTool ignores `signal` unregister by name instead.
    options.signal.addEventListener('abort', () => {
      try { context.unregisterTool?.(name); } catch { /* already gone */ }
    }, { once: true });
  }
  return registered;
}
