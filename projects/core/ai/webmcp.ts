import {
  Directive,
  booleanAttribute,
  PLATFORM_ID,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { svWarnOnce } from '@styloviz/core/dev';
import { SV_WEBMCP_SOURCE, svIsWebMcpName, svModelContext } from './webmcp.source';

/**
 * ============================================================================
 *  `FL-E2` — WebMCP: the big widgets as tools a browser agent can call
 * ============================================================================
 *
 * WebMCP (`navigator.modelContext`, W3C Web Machine Learning CG draft) lets a
 * page hand an in-browser agent typed tools instead of making it click
 * through pixels. Angular 22 ships `declareExperimentalWebMcpTool`; this is
 * the kit's own registration because the packages still support Angular 21,
 * and because a widget's tools have to come and go with the widget, not with
 * an environment injector.
 *
 * ★★ THE AGENT'S ARGUMENTS ARE UNTRUSTED INPUT. Every call is checked against
 *    the tool's own `inputSchema` (`svCheckWebMcpArgs`) before `execute` sees
 *    it, and a widget's `execute` still validates meaning (a column that is
 *    not sortable, a card id that does not exist) and answers with a refusal
 *    the agent can read, never a thrown stack.
 *
 * ★★ A TOOL CHANGES STATE THROUGH THE SAME PATH AS A CLICK. Sorting from a
 *    tool emits `sortChange` and a server-side `queryChange` exactly as a
 *    header click does; moving a card runs the same transition rules and WIP
 *    limits. A host wired for users is wired for agents.
 *
 * ★ Nothing registers on the server, or where the browser has no
 *   `modelContext` — the directive is then inert and costs one check.
 */

/**
 * `svWebMcp` — exposes the widget it sits on to a browser agent as WebMCP tools.
 *
 * ```html
 * <sv-data-table-pro svWebMcp="orders" [columns]="columns" [rows]="rows" />
 * <!-- registers orders_describe, orders_sort, orders_search, orders_filter, orders_select, orders_rows -->
 * ```
 *
 * The tools live exactly as long as the widget; changing the prefix or the
 * filters re-registers them. Inert on the server and where the browser has no
 * `modelContext`.
 */
@Directive({
  selector: '[svWebMcp]',
  standalone: true,
  exportAs: 'svWebMcp',
  host: { '[attr.data-sv-webmcp]': 'prefix()' },
})
export class SvWebMcpDirective {
  /** Tool-name prefix, unique on the page: `orders` → `orders_sort`. A letter, then letters, digits, `_` or `-`. */
  readonly prefix = input.required<string>({ alias: 'svWebMcp' });
  /** Only these tools (local names, e.g. `['describe', 'sort']`); `null` exposes all. @default null */
  readonly include = input<readonly string[] | null>(null, { alias: 'svWebMcpInclude' });
  /** Expose only the tools marked read-only — an agent can look but not change anything. @default false */
  readonly readOnly = input<boolean, unknown>(false, { alias: 'svWebMcpReadOnly', transform: booleanAttribute });

  /** The full names registered right now — `[]` with no WebMCP in the browser. */
  readonly registered = signal<readonly string[]>([]);

  private readonly source = inject(SV_WEBMCP_SOURCE, { self: true, optional: true });

  /**
   * Calls one of the widget's tools (by local name) exactly as an agent's call
   * runs — arguments checked first, the answer as text — whether or not the
   * browser has WebMCP. For a demo, a test, or an in-page assistant.
   */
  async call(name: string, args: Readonly<Record<string, unknown>> = {}): Promise<string> {
    const [{ svRunWebMcpTool }, tools] = await Promise.all([import('./webmcp.register'), this.source?.svWebMcpTools() ?? []]);
    const tool = tools.find((t) => t.name === name);
    return tool ? svRunWebMcpTool(tool, args, new AbortController().signal) : `Refused: no tool "${name}".`;
  }

  constructor() {
    const source = this.source;
    if (!source) {
      svWarnOnce('webmcp-no-source', '[svWebMcp] this element exposes no tools — put it on a widget that provides SV_WEBMCP_SOURCE (data table, scheduler, Gantt, kanban, form builder).');
      return;
    }
    const document = inject(DOCUMENT);
    // No registry, no work: the widget's tool set is never even downloaded.
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || !svModelContext(document)) return;
    // The effect's cleanup runs before each re-registration and on destroy.
    effect((onCleanup) => {
      const prefix = this.prefix();
      const include = this.include();
      const readOnly = this.readOnly();
      const current = new AbortController();
      onCleanup(() => current.abort());
      untracked(() => this.registered.set([]));
      if (!svIsWebMcpName(prefix)) {
        svWarnOnce(`webmcp-prefix:${prefix}`, `[svWebMcp] "${prefix}" is not a usable prefix (a letter, then letters, digits, _ or -) — no tools registered.`);
        return;
      }
      void (async () => {
        const [{ svRegisterWebMcpTools }, all] = await Promise.all([import('./webmcp.register'), source.svWebMcpTools()]);
        const tools = all.filter((tool) =>
          (!include || include.includes(tool.name)) && (!readOnly || tool.annotations?.readOnlyHint === true));
        const names = await svRegisterWebMcpTools(document, tools, { signal: current.signal, prefix });
        if (!current.signal.aborted) this.registered.set(names);
      })();
    });
  }
}
