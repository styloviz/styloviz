import { DestroyRef, effect, inject, PLATFORM_ID, signal, untracked, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * delayed-visibility.ts — show a loader late, and keep it long enough to read
 * (FL-J3-OF-06, `OF-18-M2`, `OF-17-M4`).
 *
 * ★★★ TWO OPPOSITE FLICKERS, ONE CAUSE. A request that answers in 80 ms
 *     flashes a spinner for 80 ms — a frame of "something is wrong" for a
 *     wait the user never noticed. And one that answers 50 ms after the
 *     spinner finally appeared yanks it away mid-glance. Both are a loader
 *     whose visibility follows the request exactly. The fix is the same
 *     primitive both ways round: appear only after `showAfterMs`, and once
 *     shown stay at least `minVisibleMs`.
 *
 * ★★ THE HOST NEEDS THE SAME SIGNAL, not only the loader. If the loader
 *    lingers for its minimum while the host has already swapped the content
 *    in, the screen shows both. So this is exported from core, and the host
 *    drives its own `@if` from it:
 *
 * ```ts
 * readonly showLoader = createDelayedVisibility(() => this.loading(), {
 *   showAfterMs: 200,
 *   minVisibleMs: 400,
 * });
 * ```
 * ```html
 * @if (showLoader()) { <sv-spinner /> } @else if (!loading()) { …content… }
 * ```
 *
 * Both delays default to 0, which is "follow `active` exactly" — the
 * behaviour every loader had before.
 */

/** Options for {@link createDelayedVisibility}. Read on every transition, so signals and inputs work. */
export interface SvDelayedVisibilityOptions {
  /** Wait this long after `active` turns on before showing, in ms. @default 0 */
  readonly showAfterMs?: number | (() => number);
  /** Once shown, stay shown at least this long, in ms. @default 0 */
  readonly minVisibleMs?: number | (() => number);
}

const msOf = (value: number | (() => number) | undefined): number => {
  const ms = typeof value === 'function' ? value() : (value ?? 0);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
};

/**
 * A signal that follows `active` with a show delay and a minimum visible time.
 *
 * Must be called in an injection context (it creates an effect and cleans its
 * timers up on destroy). On the server it follows `active` exactly: a delay
 * there would only ever render the page without its loader.
 */
export function createDelayedVisibility(
  active: () => boolean,
  options: SvDelayedVisibilityOptions = {},
): Signal<boolean> {
  const visible = signal(false);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let shownAt = 0;

  const clearShow = (): void => {
    if (showTimer !== null) { clearTimeout(showTimer); showTimer = null; }
  };
  const clearHide = (): void => {
    if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
  };
  const show = (): void => {
    shownAt = Date.now();
    visible.set(true);
  };

  effect(() => {
    const on = active();
    untracked(() => {
      if (!isBrowser) { visible.set(on); return; }
      if (on) {
        // ★ Back on while a hide was pending: the loader never left, so it
        //   simply stays — no second fade, no restarted minimum.
        clearHide();
        if (visible() || showTimer !== null) return;
        const delay = msOf(options.showAfterMs);
        if (delay === 0) { show(); return; }
        showTimer = setTimeout(() => { showTimer = null; show(); }, delay);
        return;
      }
      // Off before it was ever shown: the wait was short enough not to mention.
      clearShow();
      if (!visible() || hideTimer !== null) return;
      const remaining = msOf(options.minVisibleMs) - (Date.now() - shownAt);
      if (remaining <= 0) { visible.set(false); return; }
      hideTimer = setTimeout(() => { hideTimer = null; visible.set(false); }, remaining);
    });
  });

  inject(DestroyRef).onDestroy(() => { clearShow(); clearHide(); });

  return visible.asReadonly();
}
