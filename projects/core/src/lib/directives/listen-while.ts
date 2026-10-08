import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, effect, inject, untracked } from '@angular/core';

/** Where the listeners go. */
export type SvListenTarget = 'document' | 'window';

/** Returned by {@link svListenWhile}. */
export interface SvListenWhileRef {
  /**
   * Re-read `active()` NOW and attach or detach accordingly. Call it from the
   * handler that starts the drag, right after setting the state: the effect
   * that does this automatically only runs on the next change-detection pass,
   * and a pointer can move before then.
   */
  sync(): void;
}

/**
 * Attach global listeners ONLY while `active()` is true.
 *
 * ★★ WHY (1.0 release audit, M2). Eight components declared
 *    `@HostListener('document:pointermove')` (or `mousemove` / `touchmove`) for
 *    a drag that is idle 99.9 % of the time. Angular wraps every host listener:
 *    each event marks the view dirty and, in a zoneless app, schedules a change
 *    detection pass — so moving the mouse anywhere on a dashboard with a line
 *    chart and a data table ran change detection continuously, even though every
 *    handler returned on its first line. This keeps the listener for exactly the
 *    span of the drag.
 *
 * ★ Moves only — keep the matching `pointerup` / `mouseup` as a host listener:
 *   it fires once per click, costs nothing between clicks, and is what clears
 *   the state. Call the returned `sync()` from the drag-START handler so the
 *   very first move is caught; an effect also follows `active()` on its own.
 *
 * Handlers are expected to write SIGNALS, which schedule their own render — the
 * listener is a plain DOM listener, not an Angular template listener.
 *
 * Call in an injection context (a constructor or field initializer). A no-op on
 * the server.
 *
 * @example
 * private readonly moves = svListenWhile(() => this.resizing() !== null, 'document', {
 *   pointermove: (e) => this.onResizeMove(e as PointerEvent),
 * });
 * onResizeStart(): void { this.resizing.set(…); this.moves.sync(); }
 */
export function svListenWhile(
  active: () => boolean,
  target: SvListenTarget,
  handlers: Readonly<Record<string, (event: Event) => void>>,
): SvListenWhileRef {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return { sync: () => undefined };
  const doc = inject(DOCUMENT);
  let detach: (() => void) | null = null;

  const attach = (): (() => void) | null => {
    const el: EventTarget | null = target === 'window' ? doc.defaultView : doc;
    if (!el) return null;
    const bound = Object.entries(handlers).map(([type, handler]) => {
      // `untracked`: a signal the handler reads must not become a dependency of
      // whatever reactive context happens to be running when the event fires.
      const fn = (event: Event): void => untracked(() => handler(event));
      el.addEventListener(type, fn, { passive: type !== 'touchmove' });
      return [type, fn] as const;
    });
    return () => {
      for (const [type, fn] of bound) el.removeEventListener(type, fn);
    };
  };

  const sync = (): void => {
    const on = untracked(active);
    if (on && !detach) detach = attach();
    else if (!on && detach) {
      detach();
      detach = null;
    }
  };

  // Follows `active()` on its own — an `up` handler that clears the drag state
  // detaches on the next pass even if nobody calls `sync()`.
  effect(() => {
    active();
    untracked(sync);
  });
  inject(DestroyRef).onDestroy(() => {
    detach?.();
    detach = null;
  });
  return { sync };
}
