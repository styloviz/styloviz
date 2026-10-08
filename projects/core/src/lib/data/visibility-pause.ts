import { DestroyRef, PLATFORM_ID, inject, signal, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * visibility-pause.ts — a background tab should cost nothing.
 *
 * ★★★ NOT ONE LIVE CHART LISTENED FOR `visibilitychange`. A dashboard left open
 *     behind another window kept its interval, its `requestAnimationFrame`
 *     chain and its change detection running for as long as it was there — on a
 *     laptop, for hours. Browsers throttle a hidden tab's timers but do not stop
 *     them, and they do nothing at all about the work each tick queues.
 *
 * ★★★ AND STOPPING IS ONLY HALF OF IT. A feed that silently resumes draws a
 *     continuous line across a stretch where nothing was sampled — the same lie
 *     as interpolating a missing reading, and worse, because the chart looks
 *     exactly like one that ran the whole time. See `svPauseNotice`.
 */

/** What a paused feed knows when it comes back. */
export interface SvLivePause {
  /** True while the document is hidden and the feed is stopped. */
  readonly paused: Signal<boolean>;
  /**
   * How long the most recent pause lasted, in milliseconds. `0` before the
   * first pause, and it keeps the LAST pause's duration after resuming so the
   * chart can disclose the gap it just skipped.
   */
  readonly lastPauseMs: Signal<number>;
  /**
   * Be told the moment the tab hides (`true`) or comes back (`false`), after
   * `paused` and `lastPauseMs` have been updated. Returns an unsubscribe.
   *
   * ★ This is what lets a caller STOP its interval rather than skip ticks. A
   *   skipped tick is still a timer firing, and in a zone.js host every one of
   *   those is a change-detection pass behind a tab nobody is looking at.
   */
  readonly onChange: (listener: (paused: boolean) => void) => () => void;
  /** Stop listening. Called for you when the injection context is destroyed. */
  readonly destroy: () => void;
}

/**
 * Stop a feed while its tab is hidden, and remember how long for.
 *
 * Must be called from an injection context — it takes its own `DestroyRef`, so
 * a component that creates one cannot leak the listener.
 *
 * ★ SSR-safe: with no `document` there is nothing to hide, so `paused` stays
 *   false and no listener is registered. A server render must not reach for a
 *   browser global, and a feed that "paused" on the server would render its
 *   disclosure into the static HTML.
 *
 * ★ It reports the pause but owns no timer — `onChange` tells the caller when
 *   to stop and restart its own. `createLiveTicker` is that caller for the
 *   common case of one interval.
 */
export function createVisibilityPause(): SvLivePause {
  const paused = signal(false);
  const lastPauseMs = signal(0);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId) || typeof document === 'undefined') {
    return { paused, lastPauseMs, onChange: () => () => undefined, destroy: () => undefined };
  }

  const listeners = new Set<(paused: boolean) => void>();
  const onChangeListener = (listener: (paused: boolean) => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // ★ A tab can be born hidden — a dashboard opened with a middle-click, or
  //   restored behind another window. No `visibilitychange` fires for that,
  //   so reading the state only on change left the feed running at full price
  //   until the reader had looked at it and looked away again.
  let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
  if (hiddenAt > 0) paused.set(true);

  const onChange = (): void => {
    if (document.visibilityState === 'hidden') {
      // A repeat `hidden` must not restart the clock — the pause began at the
      // first one, and resetting it would under-report the gap.
      if (hiddenAt > 0) return;
      hiddenAt = Date.now();
      paused.set(true);
      listeners.forEach(l => l(true));
    } else {
      // Visible-to-visible is not a resume: nothing paused, nothing to tell.
      if (hiddenAt === 0) return;
      // `hiddenAt` of zero means we were never hidden — a visibilitychange can
      // fire visible-to-visible on some platforms, and reporting `Date.now()`
      // as the gap would claim a pause since the epoch.
      lastPauseMs.set(Date.now() - hiddenAt);
      hiddenAt = 0;
      paused.set(false);
      listeners.forEach(l => l(false));
    }
  };

  document.addEventListener('visibilitychange', onChange);
  const destroy = (): void => {
    document.removeEventListener('visibilitychange', onChange);
    listeners.clear();
  };
  inject(DestroyRef).onDestroy(destroy);

  return { paused, lastPauseMs, onChange: onChangeListener, destroy };
}
