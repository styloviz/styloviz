import { computed, signal, type DestroyRef, type Signal } from '@angular/core';

/** Options for {@link createDebouncer}. */
export interface SvDebouncerOptions {
  /**
   * Delay before the value settles. Accepts a signal so a component can expose
   * `debounceMs` as an input and have changes take effect immediately.
   * A delay of `0` or less applies synchronously — no timer is scheduled.
   * @default 300
   */
  readonly delayMs?: number | Signal<number>;
  /**
   * Destroy hook. Pass `inject(DestroyRef)` from a field initializer and the
   * pending timer is cleared automatically; omit it and you must call
   * `destroy()` yourself. A stray timer firing after teardown writes to a
   * destroyed component — the kind of leak that only shows up under a router
   * that reuses the route.
   */
  readonly destroyRef?: DestroyRef | null;
}

/** A value that trails its input by a delay. */
export interface SvDebouncer<T> {
  /** The settled value. This is what you fire requests from. */
  readonly value: Signal<T>;
  /** The latest value, un-delayed. This is what you bind to the input box. */
  readonly raw: Signal<T>;
  /** True between a `set()` and the value settling. */
  readonly pending: Signal<boolean>;
  /** Record a new value and (re)start the delay. */
  set(next: T): void;
  /** Settle immediately — for Enter, or blur, where waiting is wrong. */
  flush(): void;
  /** Drop the pending value; `value` keeps its last settled contents. */
  cancel(): void;
  /** Clear the timer. Called for you when `destroyRef` was supplied. */
  destroy(): void;
}

const DEFAULT_DELAY_MS = 300;

/**
 * Debounce a value into a signal, with no rxjs and no injection context.
 *
 * ```ts
 * protected readonly search = createDebouncer('', {
 *   delayMs: this.debounceMs,
 *   destroyRef: inject(DestroyRef),
 * });
 *
 * constructor() {
 *   effect(() => this.queryChange.emit(patchQuery(this.query(), {
 *     search: this.search.value(),
 *   })));
 * }
 * ```
 *
 * Pair it with {@link createRequestGuard}: debouncing cuts the number of
 * requests, the guard makes the ones that do overlap land in the right order.
 * Neither replaces the other.
 */
export function createDebouncer<T>(initial: T, options: SvDebouncerOptions = {}): SvDebouncer<T> {
  const delay = options.delayMs ?? DEFAULT_DELAY_MS;
  const delayOf = (): number => {
    const ms = typeof delay === 'number' ? delay : delay();
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  };

  const settled = signal(initial);
  const raw = signal(initial);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const api: SvDebouncer<T> = {
    value: settled.asReadonly(),
    raw: raw.asReadonly(),
    // Derived rather than a third signal: one source of truth, and it cannot
    // drift out of sync with the timer.
    pending: computed(() => !Object.is(raw(), settled())),

    set: (next: T) => {
      raw.set(next);
      clear();
      const ms = delayOf();
      if (ms === 0) {
        settled.set(next);
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        settled.set(next);
      }, ms);
    },

    flush: () => {
      clear();
      settled.set(raw());
    },

    cancel: () => {
      clear();
      raw.set(settled());
    },

    destroy: clear,
  };

  options.destroyRef?.onDestroy(clear);

  return api;
}
