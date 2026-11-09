import { computed, signal, type Signal } from '@angular/core';
import { resolveItemKey } from './item-key';
import type { SvItemKey } from './types';

/**
 * A live layer over a host-owned list.
 *
 * @see createStreamOverlay
 */
export interface SvStreamOverlay<T> {
  /** The host's list with everything the stream added or changed applied. */
  readonly merged: Signal<readonly T[]>;
  /** True while the overlay is holding anything on top of the host's list. */
  readonly dirty: Signal<boolean>;
  /**
   * Append one item. Re-delivering a key already present patches that item
   * instead of adding a second copy.
   */
  append(item: T): void;
  /** Change fields on an item already on screen. */
  patch(key: string | number, changes: Partial<T>): void;
  /** Drop the whole layer, leaving the host's list exactly as given. */
  clear(): void;
}

interface Layer<T> {
  /** The base array this layer was built against — identity, not contents. */
  readonly base: readonly T[];
  readonly added: readonly T[];
  readonly patches: ReadonlyMap<string | number, Partial<T>>;
}

const EMPTY_BASE: readonly never[] = [];

/**
 * Let a component take events one at a time without the host rebuilding its
 * whole array.
 *
 * A component fed by SSE or a WebSocket has two bad options otherwise: the host
 * clones the entire list per token (O(n) per event, and every row re-renders
 * for one status change), or the component keeps private state that silently
 * diverges from what the host passed in. This is the third: the host's input
 * stays the source of truth, and the overlay sits on top of it.
 *
 * **The overlay evaporates when the host's list changes.** A fresh array from
 * the host is the new truth — anything the socket pushed against the *previous*
 * one must not survive onto it, or a reconnect that refetches shows every event
 * twice. Identity, not contents, is the trigger, so a host that re-emits the
 * same array reference keeps its stream.
 *
 * ```ts
 * private readonly overlay = createStreamOverlay(() => this.events(), 'id');
 * readonly allEvents = this.overlay.merged;
 *
 * appendEvent(e: ActivityEvent) { this.overlay.append(e); }
 * ```
 */
export function createStreamOverlay<T>(
  base: () => readonly T[],
  itemKey: SvItemKey<T>,
): SvStreamOverlay<T> {
  const layer = signal<Layer<T>>({ base: EMPTY_BASE as readonly T[], added: [], patches: new Map() });

  const keyOf = (item: T, index: number): string | number => resolveItemKey(item, itemKey, index);

  /** The layer if it still belongs to the current base, else nothing. */
  const live = computed<Layer<T> | null>(() => {
    const current = base();
    const l = layer();
    return l.base === current ? l : null;
  });

  const merged = computed<readonly T[]>(() => {
    const current = base();
    const l = live();
    if (!l) return current;
    const all = l.added.length ? [...current, ...l.added] : current;
    if (l.patches.size === 0) return all;
    return all.map((item, i) => {
      const patch = l.patches.get(keyOf(item, i));
      return patch ? { ...item, ...patch } : item;
    });
  });

  const dirty = computed(() => {
    const l = live();
    return !!l && (l.added.length > 0 || l.patches.size > 0);
  });

  /** Re-base onto the host's current array, dropping a layer that went stale. */
  const current = (): Layer<T> => {
    const b = base();
    const l = layer();
    return l.base === b ? l : { base: b, added: [], patches: new Map() };
  };

  return {
    merged,
    dirty,
    append(item: T): void {
      const l = current();
      const key = keyOf(item, -1);
      const known =
        l.base.some((existing, i) => keyOf(existing, i) === key) ||
        l.added.some((existing, i) => keyOf(existing, i) === key);
      if (known) {
        layer.set({ ...l, patches: new Map(l.patches).set(key, { ...(l.patches.get(key) ?? {}), ...item }) });
        return;
      }
      layer.set({ ...l, added: [...l.added, item] });
    },
    patch(key: string | number, changes: Partial<T>): void {
      const l = current();
      const patches = new Map(l.patches);
      patches.set(key, { ...(patches.get(key) ?? {}), ...changes });
      layer.set({ ...l, patches });
    },
    clear(): void {
      layer.set({ base: base(), added: [], patches: new Map() });
    },
  };
}
