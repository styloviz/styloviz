import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import type { SvSensitiveCopyEvent } from '@styloviz/core';
import {
  childrenOf,
  classNameOf,
  classify,
  containerPreview,
  isContainer,
  joinPath,
  omissionNote,
  redactedProjection,
  scalarText,
  type JsonCopyEvent,
  type JsonNodeClick,
  type JsonNodeKind,
  type JsonRedactor,
  type JsonRow,
  type JsonViewerSize,
} from './json-viewer.types';

/**
 * JsonViewer — an expandable tree over any value.
 *
 * The panel every admin tool, webhook inspector and debug drawer needs: show me
 * what actually came back.
 *
 * ★★★ WHY NOT `JSON.stringify(value, null, 2)` IN A `<pre>`
 *
 * Because it lies, and it lies hardest about the values you are looking at it
 * to understand. `NaN` and `Infinity` come out as `null`; `undefined` vanishes
 * in an object and becomes `null` in an array; a `Map` and a `Set` both render
 * as `{}`; a `BigInt` throws; and a circular reference throws and takes the
 * panel with it. See `classify()` and `scalarText()` — every one of those is
 * handled rather than smoothed over.
 *
 * ★★ IT FLATTENS RATHER THAN RECURSING. One component and one `@for` over
 * visible rows, not a component that renders itself. Recursive templates make
 * a component instance per node — thousands of them for an ordinary API
 * response — and there is no way to virtualise or to jump the caret across a
 * subtree once the DOM is a nest. Flattening also makes "what is visible right
 * now" a plain derivation of `expanded`, which is what the keyboard model needs.
 *
 * ★★ IT DOES NOT RUN THE VALUE'S CODE, AND IT SAYS WHAT IT SKIPPED. Accessor
 * properties are listed unevaluated by default and hidden own properties are
 * counted out loud — opening a panel to look at an object is not consent to
 * execute it, and a viewer that shows a partial object without saying so is
 * making a claim it has not earned.
 *
 * ## Sensitive-value boundary
 *
 * This component is **display-only**: it renders a value the host already holds
 * and never fetches, stores or transmits it. Masking is opt-in through `redact`
 * (a viewer cannot know which of your fields is a secret), and once a predicate
 * is set it holds for every exit — the rows, "Copy value" on any ancestor, and
 * the `nodeClick` payload all go through the same redacting walk. Copies are
 * audited through `copyAudited`, whose payload never carries the copied text.
 * See `docs/sensitive-value-policy.md`.
 *
 * @example
 * ```html
 * <sv-json-viewer [value]="response()" rootLabel="response" [expandDepth]="2" />
 * ```
 */
@Component({
  selector: 'sv-json-viewer',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './json-viewer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvJsonViewerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** The value to show. Anything at all — this is not restricted to parsed JSON. */
  readonly value = input<unknown>(undefined);

  /** Name of the root node. @default 'root' */
  readonly rootLabel = input<string>('root');

  /**
   * Auto-expand to this depth on load.
   *
   * ★ 1, not 0 and not Infinity. A collapsed root shows nothing and reads as
   * broken; a fully expanded 4 MB response locks the tab.
   *
   * @default 1
   */
  readonly expandDepth = input<number>(1);

  /**
   * Maximum children rendered per container before a "… N more" row.
   *
   * ★ A 50,000-element array is not a rendering problem to solve with patience:
   * it is a row per element, and the browser stops responding. The cap is
   * visible and counted rather than silent — a viewer that quietly drops rows
   * is worse than one that shows fewer.
   *
   * @default 100
   */
  readonly maxChildren = input<number>(100);

  /**
   * Maximum rows rendered in total, across the whole tree.
   *
   * ★★★ `maxChildren` IS NOT A CEILING, IT IS A WIDTH LIMIT. A hundred children
   *     each with a hundred children is ten thousand rows, and every one of them
   *     passed the per-container cap. Nesting multiplies, and `expandAll()` /
   *     `*` reaches all of it at once — which is how a debug panel becomes the
   *     reason the tab stopped responding.
   *
   *     This is the actual ceiling, and the walk stops *at* it rather than
   *     building the rest and slicing: the cost of a payload nobody can read is
   *     paid in the traversal, not just in the DOM. Reaching it prints a row
   *     saying so, because a tree that silently ends is a tree the reader
   *     believes they finished.
   *
   * @default 2000
   */
  readonly maxRows = input<number>(2000);

  /** Type scale and row density. @default 'md' */
  readonly size = input<JsonViewerSize>('md');

  /** Sort object keys alphabetically instead of insertion order. @default false */
  readonly sortKeys = input<boolean>(false);

  /** Render strings with quotes and escapes, as JSON would. @default true */
  readonly quoteStrings = input<boolean>(true);

  /** Show the copy-path / copy-value action on the focused row. @default true */
  readonly showCopy = input<boolean>(true);

  /**
   * Masks matching nodes before they are rendered.
   *
   * ★★★ A JSON VIEWER IS WHERE AN API KEY ENDS UP IN A SCREENSHOT. Bearer tokens,
   *     card numbers and session cookies all arrive inside perfectly ordinary
   *     payloads, and the person who pastes one into a debug drawer is not
   *     thinking about the screen recording.
   *
   *     Return `true` from the predicate and the row prints `redactedLabel`
   *     instead of the value, stops being expandable, and — the part that
   *     matters — carries the MASK as its value, so "Copy value" and `nodeClick`
   *     cannot hand the secret out either. Redaction that only changed the pixels
   *     would be redaction the clipboard walks straight past.
   *
   *     Redacting a container masks the entire subtree: the walk does not descend,
   *     so nothing underneath is rendered, counted or copyable.
   *
   *     There is no default. A component cannot know which of your fields is a
   *     secret, and one that guessed would hide data the reader needed. Pass the
   *     exported `secretKeyRedactor` for the usual suspects.
   *
   * @default null
   */
  readonly redact = input<JsonRedactor | null>(null);

  /** What a masked row shows in place of its value. @default '[redacted]' */
  readonly redactedLabel = input<string>('[redacted]');

  /**
   * Read accessor properties instead of listing them unevaluated.
   *
   * ★★★ OFF, BECAUSE LOOKING AT AN OBJECT IS NOT CONSENT TO RUN ITS CODE. A
   *     getter can hit the network, mutate state, throw, or be an intentionally
   *     expensive lazy field; `Object.entries` calls every one of them just to
   *     enumerate. Off, each accessor gets a row that says it is a getter and
   *     was not read. On, each is called inside a `try` and a thrower renders its
   *     message rather than taking the panel down.
   *
   * @default false
   */
  readonly evaluateGetters = input<boolean>(false);

  /** Accessible name for the tree. @default 'JSON' */
  readonly ariaLabel = input<string>('JSON');

  /** Extra classes on the root element. @default '' */
  readonly customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** A row was activated (click or Enter). */
  readonly nodeClick = output<JsonNodeClick>();

  /**
   * Something reached the clipboard.
   *
   * Reports the path, which button was pressed and whether the row was masked,
   * so a host can keep an audit trail without logging a second copy of the
   * value it just tried to protect.
   */
  readonly copied = output<JsonCopyEvent>();

  /**
   * Something reached the clipboard — the audit-safe twin of `copied`.
   *
   * Carries the source, the path, whether the copied text contained a mask and
   * when, and never the text itself, so it can be logged as-is.
   */
  readonly copyAudited = output<SvSensitiveCopyEvent>();

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * Paths that are open.
   *
   * ★ `linkedSignal` on the value: a NEW value must not inherit the previous
   * one's expansion, because the paths mean something different — `data[3]` in
   * the old response is a different node from `data[3]` in the new one. It
   * re-seeds from `expandDepth` instead.
   */
  private readonly expanded = linkedSignal<unknown, Set<string>>({
    source: () => this.value(),
    computation: () => this.seedExpansion(),
  });

  /** The focused row's path — the tree's single tab stop. */
  private readonly focusedPath = signal<string>('');

  /** Last thing copied, so the button can say so briefly. */
  protected readonly justCopied = signal<string>('');

  // ── The flattened tree ────────────────────────────────────────────────────

  /**
   * Every visible row, in document order.
   *
   * Walks the value depth-first, descending only into expanded containers, and
   * carries the ANCESTOR CHAIN as it goes.
   *
   * ★★★ THE ANCESTOR CHAIN IS THE CYCLE DETECTOR, AND IT MUST BE THE CHAIN —
   * NOT A GLOBAL "SEEN" SET.
   *
   * A cycle is a value that contains ITSELF: it is on the path from the root to
   * here. The same object appearing twice in two different branches — one
   * `author` object referenced by three posts — is a DAG, which is ordinary and
   * perfectly renderable. A global seen-set marks the second, third and fourth
   * appearance as `[Circular]`, which is a lie that hides the data. The chain is
   * pushed on the way down and popped on the way out.
   */
  protected readonly rows = computed<JsonRow[]>(() => {
    const out: JsonRow[] = [];
    const cap = Math.max(1, this.maxChildren());
    const ceiling = Math.max(1, this.maxRows());
    const expanded = this.expanded();
    const sortKeys = this.sortKeys();
    const quote = this.quoteStrings();
    const evaluateGetters = this.evaluateGetters();
    const redact = this.redact();
    const mask = this.redactedLabel();
    /** The chain from the root to the node being walked. */
    const chain = new Set<object>();
    let truncated = false;

    /** True when this row was the last one there was room for. */
    const push = (row: JsonRow): boolean => {
      out.push(row);
      if (out.length >= ceiling) truncated = true;
      return !truncated;
    };

    // ★ No "already truncated?" test at the top of `walk`: it is entered once for
    //   the root (nothing pushed yet) and otherwise only from the child loop
    //   below, which checks `truncated` before every call.
    const walk = (key: string, value: unknown, path: string, depth: number): void => {
      const kind = classify(value);

      if (redact !== null && redact({ path, key, kind, value })) {
        push({
          path, depth, key, kind, preview: mask,
          expandable: false, expanded: false, count: 0,
          // The MASK, not the value: this is what "Copy value" reads.
          value: mask, redacted: true,
        });
        return;
      }

      if (isContainer(kind)) {
        const obj = value as object;
        if (chain.has(obj)) {
          push({
            path, depth, key, kind: 'circular', preview: '[Circular]',
            expandable: false, expanded: false, count: 0, value, redacted: false,
          });
          return;
        }
      }

      if (!isContainer(kind)) {
        push({
          path, depth, key, kind,
          preview: scalarText(value, kind, quote),
          expandable: false, expanded: false, count: 0, value, redacted: false,
        });
        return;
      }

      const children = childrenOf(value, kind, sortKeys, evaluateGetters);
      const kids = children.items;
      const isOpen = expanded.has(path);
      const room = push({
        path, depth, key, kind,
        preview: containerPreview(kind, kids.length, kind === 'object' ? classNameOf(value) : ''),
        expandable: kids.length > 0,
        expanded: isOpen && kids.length > 0,
        count: kids.length,
        value, redacted: false,
      });
      if (!room || !isOpen || kids.length === 0) return;

      chain.add(value as object);
      for (const child of kids.slice(0, cap)) {
        if (truncated) break;
        const childPath = joinPath(path, child.key, kind);
        if (child.unreadGetter === true || child.threw === true) {
          // The placeholder is also the row's value, so "Copy value" says what
          // the row says rather than pasting the `undefined` standing in for it.
          const preview =
            child.unreadGetter === true
              ? '(getter — not read)'
              : `(getter threw: ${String(child.value)})`;
          push({
            path: childPath, depth: depth + 1, key: child.key, kind: 'getter',
            preview,
            expandable: false, expanded: false, count: 0,
            value: preview, redacted: false,
          });
          continue;
        }
        walk(child.key, child.value, childPath, depth + 1);
      }

      if (!truncated && kids.length > cap) {
        push({
          path: `${path}::more`, depth: depth + 1, key: '',
          kind: 'truncated',
          preview: `… ${kids.length - cap} more (raise maxChildren to show)`,
          expandable: false, expanded: false, count: kids.length - cap,
          value: undefined, redacted: false,
        });
      }

      // What `Object.entries` would have dropped without a word.
      const omitted = omissionNote(children);
      if (!truncated && omitted !== '') {
        push({
          path: `${path}::omitted`, depth: depth + 1, key: '',
          kind: 'omitted', preview: omitted,
          expandable: false, expanded: false, count: 0,
          value: undefined, redacted: false,
        });
      }

      chain.delete(value as object);
    };

    walk(this.rootLabel(), this.value(), '$', 0);

    if (truncated) {
      out.push({
        path: '$::ceiling', depth: 0, key: '', kind: 'truncated',
        preview: `… stopped at ${ceiling} rows (raise maxRows to show more)`,
        expandable: false, expanded: false, count: 0,
        value: undefined, redacted: false,
      });
    }
    return out;
  });

  /** Rows that can take focus — everything but the notices. */
  private readonly focusable = computed<JsonRow[]>(() =>
    this.rows().filter((r) => r.kind !== 'truncated' && r.kind !== 'omitted'),
  );

  /** Index of the focused row, clamped into range as the tree changes shape. */
  private readonly focusedIndex = computed<number>(() => {
    const rows = this.focusable();
    const i = rows.findIndex((r) => r.path === this.focusedPath());
    return i >= 0 ? i : 0;
  });

  protected isFocused(path: string): boolean {
    return this.focusable()[this.focusedIndex()]?.path === path;
  }

  protected tabIndexFor(path: string): number {
    return this.isFocused(path) ? 0 : -1;
  }

  /**
   * Seed `expanded` with every container path down to `expandDepth`.
   *
   * Redacted subtrees are not seeded: the mask is not a container, and opening
   * something that renders as one row is a state with nothing behind it.
   */
  private seedExpansion(): Set<string> {
    const limit = Math.max(0, this.expandDepth());
    const redact = this.redact();
    const open = new Set<string>();
    const chain = new Set<object>();
    const walk = (key: string, value: unknown, path: string, depth: number): void => {
      const kind = classify(value);
      if (!isContainer(kind)) return;
      if (redact !== null && redact({ path, key, kind, value })) return;
      const obj = value as object;
      if (chain.has(obj)) return;
      if (depth >= limit) return;
      open.add(path);
      chain.add(obj);
      for (const child of childrenOf(value, kind, this.sortKeys(), this.evaluateGetters()).items) {
        walk(child.key, child.value, joinPath(path, child.key, kind), depth + 1);
      }
      chain.delete(obj);
    };
    walk(this.rootLabel(), this.value(), '$', 0);
    return open;
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  /** Open or close an expandable row. Callers check `expandable` (an `expanded` row always is). */
  protected toggle(row: JsonRow): void {
    const next = new Set(this.expanded());
    if (next.has(row.path)) next.delete(row.path);
    else next.add(row.path);
    this.expanded.set(next);
  }

  /**
   * Open every container.
   *
   * ★ It stops once it has opened enough containers to fill `maxRows`. Walking a
   * 4 MB response to build a set of paths the tree will never render is work
   * whose only product is the pause before it.
   */
  expandAll(): void {
    const ceiling = Math.max(1, this.maxRows());
    const redact = this.redact();
    const open = new Set<string>();
    const chain = new Set<object>();
    const walk = (key: string, value: unknown, path: string): void => {
      if (open.size >= ceiling) return;
      const kind = classify(value);
      if (!isContainer(kind)) return;
      if (redact !== null && redact({ path, key, kind, value })) return;
      const obj = value as object;
      if (chain.has(obj)) return;
      open.add(path);
      chain.add(obj);
      for (const child of childrenOf(value, kind, this.sortKeys(), this.evaluateGetters()).items) {
        walk(child.key, child.value, joinPath(path, child.key, kind));
      }
      chain.delete(obj);
    };
    walk(this.rootLabel(), this.value(), '$');
    this.expanded.set(open);
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }

  protected onRowClick(row: JsonRow): void {
    this.focusedPath.set(row.path);
    if (row.expandable) this.toggle(row);
    // With a redactor set, a container's payload is the redacted projection, not
    // the live object — otherwise a masked descendant is one property access away.
    let value = row.value;
    if (this.redact() !== null && !row.redacted) {
      if (isContainer(row.kind)) value = this.project(row).value;
      else if (row.kind === 'circular') value = '[Circular]';
    }
    this.nodeClick.emit({ path: row.path, key: row.key, value });
  }

  /**
   * A container row's value as it may leave the viewer: re-walked with the same
   * redaction, getter and cycle rules as `rows`. See `redactedProjection`.
   */
  private project(row: JsonRow): { readonly value: unknown; readonly redacted: boolean } {
    let redacted = false;
    const value = redactedProjection(row.value, row.key, row.path, {
      redact: this.redact(),
      redactedLabel: this.redactedLabel(),
      evaluateGetters: this.evaluateGetters(),
      sortKeys: this.sortKeys(),
      onRedact: () => (redacted = true),
    });
    return { value, redacted };
  }

  /**
   * Copy the row's value, or its path.
   *
   * ★ `JSON.stringify` is used for the VALUE because that is what a caller
   * pastes into a test fixture — but it is the one place the viewer accepts
   * stringify's lossiness, so a value it cannot represent falls back to the same
   * text the row displays.
   *
   * ★ A masked row carries the mask as its value, so this copies the mask
   * without needing to know it was masked. The event says so anyway, because a
   * host keeping an audit trail wants to record the attempt.
   *
   * ★★★ A CONTAINER IS COPIED THROUGH THE REDACTED PROJECTION, NEVER RAW.
   *     Stringifying the live object would paste every masked descendant and call
   *     every getter the tree deliberately left unread.
   */
  protected async copy(row: JsonRow, what: 'value' | 'path'): Promise<void> {
    let redacted = row.redacted;
    let text: string;
    if (what === 'path') {
      text = row.path;
    } else if (!row.redacted && isContainer(row.kind)) {
      const projection = this.project(row);
      redacted = projection.redacted;
      // The projection is JSON-safe by construction (BigInt, NaN, functions and
      // cycles are already the row's own text), so plain stringify cannot throw.
      text = JSON.stringify(projection.value, null, 2);
    } else {
      text = safeStringify(row.value) ?? scalarText(row.value, row.kind, true);
    }
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // A denied clipboard permission is not a reason to break the panel; the
      // row still shows the value, which is what the user came for.
      return;
    }
    this.justCopied.set(row.path);
    this.copied.emit({ path: row.path, what, text, redacted: row.redacted });
    this.copyAudited.emit({ source: 'sv-json-viewer', field: row.path, redacted, at: Date.now() });
  }

  // ── Keyboard: the APG tree model ──────────────────────────────────────────

  /**
   * ★★ Right/Left are not just Down/Up.
   *
   * In a tree, Right on a CLOSED node opens it and on an OPEN node moves to its
   * first child; Left on an OPEN node closes it and on a CLOSED one moves to its
   * PARENT. Collapsing that into plain vertical movement is what makes a
   * hand-rolled tree feel like a list with indentation.
   */
  protected onKeydown(event: KeyboardEvent): void {
    // Never empty: the root is always a focusable row (the ceiling is at least 1
    // and the root is pushed first; only notices are left out).
    const rows = this.focusable();
    const i = this.focusedIndex();
    const row = rows[i];

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusRow(rows[Math.min(i + 1, rows.length - 1)]);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.focusRow(rows[Math.max(i - 1, 0)]);
        return;
      case 'Home':
        event.preventDefault();
        this.focusRow(rows[0]);
        return;
      case 'End':
        event.preventDefault();
        this.focusRow(rows[rows.length - 1]);
        return;
      case 'ArrowRight':
        event.preventDefault();
        if (row.expandable && !row.expanded) this.toggle(row);
        else if (row.expanded) this.focusRow(rows[i + 1]);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        if (row.expanded) this.toggle(row);
        else this.focusRow(this.parentOf(row, rows));
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onRowClick(row);
        return;
      case '*':
        event.preventDefault();
        this.expandAll();
        return;
    }
  }

  /** The nearest row above with a smaller depth. */
  private parentOf(row: JsonRow, rows: readonly JsonRow[]): JsonRow | undefined {
    for (let i = rows.indexOf(row) - 1; i >= 0; i--) {
      if (rows[i].depth < row.depth) return rows[i];
    }
    return undefined;
  }

  private focusRow(row: JsonRow | undefined): void {
    if (!row) return;
    this.focusedPath.set(row.path);
    queueMicrotask(() => {
      const root = this.host.nativeElement as HTMLElement;
      root
        .querySelector<HTMLElement>(`[data-sv-json-row="${cssEscape(row.path)}"]`)
        ?.focus();
    });
  }

  // ── Classes ───────────────────────────────────────────────────────────────

  protected readonly rootClasses = computed<string>(() =>
    [
      'overflow-auto rounded-lg border border-gray-200 bg-white font-mono',
      'dark:border-gray-800 dark:bg-gray-900',
      this.size() === 'sm' ? 'p-1.5 text-[11px]' : 'p-2 text-xs',
      this.customClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected rowClasses(focused: boolean): string {
    return [
      'flex w-full items-start gap-1 rounded px-1 text-left leading-5',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      focused ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
    ].join(' ');
  }

  /**
   * ★ Colour carries the TYPE, which is the one thing a reader is scanning for.
   * `null` and `undefined` are deliberately distinct — they are different facts,
   * and a viewer that paints them the same undoes the work `classify` did.
   *
   * ★ AND THAT IS WHY THE TYPES STAY LITERAL. This is a syntax palette: a string
   * is not a success and a boolean is not a brand, so pointing these at token
   * families would say something false and, worse, collapse two types into one
   * colour the moment a buyer rebranded — which is exactly the distinction the
   * reader is scanning for. `circular` is the one entry that DID move: a cycle is
   * a fault in the data, and it should look like every other fault in the kit.
   * Recorded in `scripts/theme-literal.allow.json`.
   *
   * ★ A REDACTED ROW IS NOT COLOURED BY TYPE. Its type is not what the reader
   * needs to know about it, and painting a masked token the same green as a
   * visible string invites the reading that it is one.
   */
  protected valueClasses(kind: JsonNodeKind, redacted = false): string {
    if (redacted) return 'rounded bg-gray-100 px-1 font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    switch (kind) {
      case 'string': return 'text-emerald-700 dark:text-emerald-400';
      case 'number':
      case 'bigint': return 'text-sky-700 dark:text-sky-400';
      case 'boolean': return 'text-violet-700 dark:text-violet-400';
      case 'null': return 'text-gray-500 dark:text-gray-400';
      case 'undefined': return 'italic text-gray-500 dark:text-gray-400';
      case 'date': return 'text-amber-700 dark:text-amber-400';
      case 'circular': return 'font-semibold text-danger-600 dark:text-danger-400';
      case 'getter': return 'italic text-gray-500 dark:text-gray-400';
      case 'truncated':
      case 'omitted': return 'italic text-gray-500 dark:text-gray-400';
      case 'function':
      case 'symbol': return 'text-fuchsia-700 dark:text-fuchsia-400';
      default: return 'text-gray-600 dark:text-gray-300';
    }
  }

  protected indentFor(depth: number): string {
    // Inline width rather than a computed padding class: Tailwind only generates
    // classes it can see, so `pl-${n}` would be a class that never exists.
    return `${depth * (this.size() === 'sm' ? 10 : 12)}px`;
  }
}

/** `JSON.stringify` that returns `null` instead of throwing on a cycle/BigInt. */
function safeStringify(value: unknown): string | null {
  try {
    const text = JSON.stringify(value, null, 2);
    return text ?? null;
  } catch {
    return null;
  }
}

/** Minimal attribute-selector escape — paths contain quotes, dots and brackets. */
function cssEscape(path: string): string {
  return path.replace(/["\\]/g, '\\$&');
}
