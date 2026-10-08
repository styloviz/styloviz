import type { SvItemKey } from './types';

declare const ngDevMode: boolean | undefined;

/**
 * ============================================================================
 *  The identity contract every collection family answers (audit item X-6)
 * ============================================================================
 *
 * Two questions, one answer per family, so a buyer who has learned the List
 * View already knows the Tree, the Kanban, the Transfer and the Data Table:
 *
 *  1. **What is this item's key?** An `itemKey` input typed {@link SvItemKey},
 *     defaulting to the property the family already assumed (`'id'` almost
 *     everywhere, `'key'` for the Transfer). A string names a property; a
 *     function builds a composite key, which is the case that used to be
 *     impossible — six families hardcoded `item.id` and the seventh took a
 *     `string`, so a row identified by `orderId + lineNo` had no way in.
 *
 *  2. **Who owns this item's state?** Anything the host might want to restore,
 *     persist, or drive — which selection, expansion and collapse all are — is
 *     a `model()`, so it can be both set and observed. Held in a plain
 *     `signal`, that state is invisible: a table's expanded rows could not be
 *     restored after a route change because the host had no way to write them
 *     and no way to learn they had changed.
 *
 * Both halves are enforced by `scripts/check-collection-identity.mjs` rather
 * than by review, because the drift they prevent is exactly the kind that
 * reappears one family at a time.
 * ============================================================================
 */

/** One warning per property name, so a 500-row list logs once, not 500 times. */
const warned = new Set<string>();

function warnOnce(key: string): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[styloviz] itemKey "${key}" is missing or not a string/number on at least one item — ` +
      'falling back to the list index. Server refreshes will reuse DOM by position: ' +
      'focus can jump, and the wrong row can appear selected. Pass an itemKey that exists ' +
      'on every item, or a function for composite keys.',
  );
}

/**
 * Resolve an item's stable identity, falling back to its index.
 *
 * The fallback keeps a misconfigured component rendering rather than throwing,
 * but it is a real defect — hence the dev-mode warning. It is silent in
 * production builds.
 */
export function resolveItemKey<T>(
  item: T,
  key: SvItemKey<T> | null | undefined,
  index: number,
): string | number {
  if (typeof key === 'function') return key(item, index);

  if (typeof key === 'string' && key) {
    const value = (item as Record<string, unknown> | null)?.[key];
    if (typeof value === 'string' || typeof value === 'number') return value;
    warnOnce(key);
  }

  return index;
}

/**
 * Build a `track` function for `@for` from a fixed key.
 *
 * The argument order matches Angular's `track` expression and the kit's
 * existing `trackByRow($index, row)` usage:
 *
 * ```ts
 * protected readonly trackItem = trackByItemKey<Order>('id');
 * ```
 * ```html
 * @for (item of items(); track trackItem($index, item)) { … }
 * ```
 *
 * When the key comes from a signal input, call {@link resolveItemKey} directly
 * instead — a `SvItemKey` may itself be a function, so a helper cannot tell a
 * key-function from a signal accessor without guessing:
 *
 * ```ts
 * protected readonly trackItem = (i: number, item: Order): string | number =>
 *   resolveItemKey(item, this.itemKey(), i);
 * ```
 */
export function trackByItemKey<T>(
  key: SvItemKey<T> | null | undefined,
): (index: number, item: T) => string | number {
  return (index, item) => resolveItemKey(item, key, index);
}

/**
 * Warn, in dev builds only, when two items resolve to the same key.
 *
 * Angular's own diagnostic for this is NG0955, which it raises from inside
 * `@for` after the duplicate has already destroyed the view: the collection
 * disappears and the message names neither the input that supplied it nor the
 * key that collided. The Kanban hit the same wall from the other side — two
 * cards confirmed inside one millisecond shared a `Date.now()` id — and the
 * only reason it was diagnosable was that someone happened to be looking.
 *
 * So the check runs first, where the component still knows which input the rows
 * arrived on and what the offending key was, and it does not throw: a warning
 * plus a rendered list beats a correct complaint about a blank screen.
 *
 * Call it from wherever the family already derives its rendered rows:
 *
 * ```ts
 * protected readonly rows = computed(() => {
 *   const rows = this.filtered();
 *   warnOnDuplicateItemKeys(rows, this.itemKey(), 'sv-data-table [rows]');
 *   return rows;
 * });
 * ```
 *
 * @param context Which component and input to name in the message — the reader
 *   is holding a page of several collections and needs to know which one.
 */
export function warnOnDuplicateItemKeys<T>(
  items: readonly T[] | null | undefined,
  key: SvItemKey<T> | null | undefined,
  context: string,
): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (!items || items.length < 2) return;
  if (warned.has(`dup:${context}`)) return;

  const seen = new Set<string | number>();
  for (let i = 0; i < items.length; i++) {
    const id = resolveItemKey(items[i], key, i);
    if (seen.has(id)) {
      warned.add(`dup:${context}`);
      console.warn(
        `[styloviz] ${context}: two items share the key ${JSON.stringify(id)}. ` +
          'Angular rejects a duplicate track key (NG0955) and destroys the view, so the ' +
          'collection renders blank. Give every item a unique key, or pass an itemKey ' +
          'function that combines fields into one.',
      );
      return;
    }
    seen.add(id);
  }
}
