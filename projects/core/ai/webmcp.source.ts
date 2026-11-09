import { InjectionToken } from '@angular/core';

/**
 * `FL-E2` — the half of WebMCP a widget imports: the tool vocabulary, the
 * `SV_WEBMCP_SOURCE` token and `svWebMcpResult`. Kept apart from the directive
 * and the argument check (`./webmcp`) so a widget that is never exposed to an
 * agent ships a token and a few types, not the registration code.
 */

/** JSON Schema subset the kit's tools use, and the subset `svCheckWebMcpArgs` enforces. */
export interface SvWebMcpSchema {
  readonly type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  readonly description?: string;
  readonly enum?: readonly (string | number)[];
  readonly properties?: Readonly<Record<string, SvWebMcpSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: SvWebMcpSchema;
  readonly anyOf?: readonly SvWebMcpSchema[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
}

/** Behaviour hints an agent reads before it decides to call a tool (WebMCP `annotations`). */
export interface SvWebMcpAnnotations {
  /** The tool changes nothing the user can see. */
  readonly readOnlyHint?: boolean;
  /** The result carries the host's data, which the agent should treat as untrusted content. */
  readonly untrustedContentHint?: boolean;
  /** The tool has an effect beyond the screen (it saves, sends or deletes). */
  readonly consequentialHint?: boolean;
}

/** The context of one call: aborted when the widget goes away or the agent cancels. */
export interface SvWebMcpClient {
  readonly signal: AbortSignal;
}

/** One tool, as a widget describes it. `name` is local — the directive prefixes it. */
export interface SvWebMcpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: SvWebMcpSchema;
  readonly annotations?: SvWebMcpAnnotations;
  /** Runs with arguments already checked against `inputSchema`. Returns text for the agent. */
  execute(args: Readonly<Record<string, unknown>>, client: SvWebMcpClient): string | Promise<string>;
}

/** What a widget provides (as `SV_WEBMCP_SOURCE`) to be exposed by `svWebMcp`. */
export interface SvWebMcpToolSource {
  /**
   * The widget's tools; called once per registration. A promise, so a widget
   * can `import()` its tool set — nobody downloads tool code until a page
   * actually puts `svWebMcp` on the widget.
   */
  svWebMcpTools(): Promise<readonly SvWebMcpTool[]>;
}

/** Provided by every widget that can be exposed to an agent: `useExisting` the component. */
export const SV_WEBMCP_SOURCE = new InjectionToken<SvWebMcpToolSource>('SV_WEBMCP_SOURCE');

/** A refusal or an answer, as the text the agent reads. */
export function svWebMcpResult(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** The browser's registry, as far as the kit uses it (draft API; shapes differ between builds). */
export interface SvModelContextLike {
  registerTool(tool: object, options?: { signal?: AbortSignal }): unknown;
  unregisterTool?(name: string): unknown;
}

/** `document.modelContext` or `navigator.modelContext`, when the browser has one. */
export function svModelContext(doc: Document | null | undefined): SvModelContextLike | null {
  const candidates: unknown[] = [
    (doc as { modelContext?: unknown } | null | undefined)?.modelContext,
    (doc?.defaultView?.navigator as { modelContext?: unknown } | undefined)?.modelContext,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof (candidate as SvModelContextLike).registerTool === 'function') {
      return candidate as SvModelContextLike;
    }
  }
  return null;
}

const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** `true` for a usable tool prefix or name: a letter, then letters, digits, `_` or `-`, up to 64. */
export function svIsWebMcpName(value: string): boolean {
  return NAME.test(value);
}
