/**
 * ============================================================================
 *  Keyboard at scale — the one contract for long collections (`X-10`)
 * ============================================================================
 *
 * A virtual list with 50,000 rows cannot have 50,000 tab stops. Every
 * collection family in the kit (List View, Tree, Data Table, Transfer, Kanban)
 * answers the same four questions the same way:
 *
 * 1. **One tab stop per collection.** Roving tabindex: the active item carries
 *    `tabindex="0"`, every other item `-1`. Tab enters the collection once and
 *    leaves it once, however many rows it holds. A container that wraps roving
 *    items is NOT itself a second tab stop.
 * 2. **Arrows, Home/End** move one item / to the ends — {@link svRovingTarget}
 *    semantics, except that arrows **clamp** at the ends by default (the APG
 *    listbox, tree and grid patterns do not wrap, and every collection in the
 *    kit already clamped — wrapping would be a behaviour change). A widget that
 *    wants wrapping passes `wrap: true`.
 * 3. **PageUp/PageDown** jump by a page and **clamp** at the ends — they never
 *    wrap. A page jump that wrapped from row 49,990 to row 8 would throw the
 *    reader to the other end of the data without telling them.
 * 4. **Typeahead**: printable characters typed within a short window form a
 *    prefix; focus moves to the next item whose label starts with it
 *    ({@link createTypeahead}).
 *
 * ── The documented ceiling ──────────────────────────────────────────────────
 * A collection that renders every row (not virtualized) keeps one tab stop, but
 * its DOM still grows with the data. {@link SV_UNVIRTUALIZED_ROW_CEILING} is the
 * number of rendered rows past which a family either virtualizes, paginates, or
 * warns in development mode. It is a documented limit, not a hard cap: nothing
 * is truncated, the host is told.
 *
 * Movement only. Whether moving focus also selects is the caller's decision —
 * see `roving.ts` for why that split matters.
 */
import { svWarnOnce } from '../dev/warn-once';
import { svRovingTarget } from './roving';
import { svIsTextEntryTarget } from './shortcut';

/**
 * The number of rows an un-virtualized collection renders before the kit
 * considers it past its keyboard/DOM budget. Above it a family virtualizes, is
 * paginated (the page size is then the ceiling), or warns once in dev mode.
 */
export const SV_UNVIRTUALIZED_ROW_CEILING = 2000;

/** Options for {@link svCollectionTarget}. */
export interface SvCollectionTargetOptions {
  /**
   * How many items PageUp/PageDown move. Usually the number of rows visible in
   * the viewport. Values below 1 are treated as 1. @default 10
   */
  readonly pageSize?: number;
  /**
   * Whether ArrowUp/ArrowDown (and Left/Right) wrap from one end to the other,
   * as {@link svRovingTarget} does. Page keys never wrap. @default false
   */
  readonly wrap?: boolean;
}

/**
 * Where a key should move focus inside a long collection.
 *
 * Arrows move one item (clamped, or wrapping with `wrap: true`), Home and End
 * go to the ends. PageUp/PageDown move by `pageSize` and clamp at the first /
 * last item — always.
 *
 * @returns the target index, or `null` when the key is not a navigation key —
 * let it through untouched.
 */
export function svCollectionTarget(
  key: string,
  count: number,
  current: number,
  options: SvCollectionTargetOptions = {},
): number | null {
  if (count <= 0) return null;
  const from = current >= 0 && current < count ? current : 0;
  const page = Math.max(1, Math.floor(options.pageSize ?? 10));
  switch (key) {
    case 'PageDown':
      return Math.min(count - 1, from + page);
    case 'PageUp':
      return Math.max(0, from - page);
    case 'ArrowDown':
    case 'ArrowRight':
      if (!options.wrap) return current >= 0 && current < count ? Math.min(count - 1, from + 1) : 0;
      return svRovingTarget(key, count, current);
    case 'ArrowUp':
    case 'ArrowLeft':
      if (!options.wrap) return current >= 0 && current < count ? Math.max(0, from - 1) : count - 1;
      return svRovingTarget(key, count, current);
    default:
      return svRovingTarget(key, count, current);
  }
}

/** Options for {@link createTypeahead}. */
export interface SvTypeaheadOptions<T> {
  /** The text an item is matched by — usually its visible label. */
  readonly labelOf: (item: T) => string;
  /** How long a pause resets the typed prefix, in ms. @default 500 */
  readonly timeoutMs?: number;
  /** Clock seam for tests. @default Date.now */
  readonly now?: () => number;
}

/** A typeahead buffer; see {@link createTypeahead}. */
export interface SvTypeahead<T> {
  /**
   * Feed one key. Returns the index of the item to focus, or `null` when the
   * key is not a typeahead character or nothing matches.
   */
  handle(key: string, items: readonly T[], current: number): number | null;
  /** Forget the typed prefix. */
  reset(): void;
}

/**
 * True for a single printable character with no modifier, typed somewhere that
 * is not a text field — the keys typeahead listens to.
 */
export function svIsTypeaheadKey(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'> & { readonly target?: EventTarget | null },
): boolean {
  if (event.key.length !== 1 || event.key === ' ' || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target ?? null;
  // A checkbox or radio is an `<input>`, but nothing is typed into it — a
  // transfer pane of checkboxes is exactly where typeahead is wanted.
  const input = target as Partial<HTMLInputElement> | null;
  if (input?.tagName === 'INPUT' && NON_TEXT_INPUTS.has(String(input.type))) return true;
  return !svIsTextEntryTarget(target);
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/**
 * Typeahead for a collection: type "ma" quickly to reach "Marketing".
 *
 * - Matching is case-insensitive and prefix-based.
 * - The search starts AFTER the current item and wraps, so typing the same
 *   letter repeatedly cycles through every item starting with it.
 * - A pause longer than `timeoutMs` starts a new prefix.
 *
 * Pure: no timers, no DOM. The caller decides whether the key was eligible
 * (see {@link svIsTypeaheadKey}) and what "focus index" means.
 */
export function createTypeahead<T>(options: SvTypeaheadOptions<T>): SvTypeahead<T> {
  const timeout = options.timeoutMs ?? 500;
  const now = options.now ?? Date.now;
  let buffer = '';
  let last = 0;

  return {
    handle(key, items, current) {
      if (key.length !== 1 || items.length === 0) return null;
      const t = now();
      if (t - last > timeout) buffer = '';
      last = t;
      const char = key.toLowerCase();
      // Repeating one letter cycles; a longer prefix refines.
      const repeating = buffer.length > 0 && [...buffer].every((c) => c === char);
      buffer = repeating ? char : buffer + char;
      const prefix = buffer;
      const count = items.length;
      const start = repeating || prefix.length === 1 ? current + 1 : current;
      for (let i = 0; i < count; i++) {
        const index = (((start + i) % count) + count) % count;
        if (options.labelOf(items[index]).trim().toLowerCase().startsWith(prefix)) return index;
      }
      return null;
    },
    reset() {
      buffer = '';
      last = 0;
    },
  };
}

/**
 * Dev-mode warning, once per `family`, when a collection renders more than
 * {@link SV_UNVIRTUALIZED_ROW_CEILING} rows without virtualization. Silent in
 * production and when `virtualized` is true.
 *
 * @returns whether the collection is past the ceiling (useful in tests).
 */
export function svWarnUnvirtualizedCeiling(family: string, rendered: number, virtualized: boolean): boolean {
  if (virtualized || rendered <= SV_UNVIRTUALIZED_ROW_CEILING) return false;
  svWarnOnce(
    `collection-ceiling:${family}`,
    `${family} renders ${rendered} rows without virtualization — past the documented ceiling of ` +
      `${SV_UNVIRTUALIZED_ROW_CEILING}. Turn virtualization on, or paginate, to keep the keyboard ` +
      `and DOM budget. Keyboard navigation still has one tab stop.`,
  );
  return true;
}
