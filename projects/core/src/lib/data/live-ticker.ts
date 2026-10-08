import { DestroyRef, PLATFORM_ID, computed, inject, signal, untracked, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { svPauseNotice } from './live-feed';
import { createVisibilityPause, type SvLivePause } from './visibility-pause';

/**
 * live-ticker.ts — one interval that is actually off while its tab is hidden,
 * and a gap notice that is only ever about that interval.
 *
 * ★★★ SKIPPING A TICK IS NOT STOPPING A TIMER. The live charts used to check
 *     `paused()` inside the tick and return — the interval kept firing, and in a
 *     zone.js host every firing is a change-detection pass behind a tab nobody
 *     is looking at. This clears the interval on hide and creates a new one on
 *     return.
 *
 * ★★★ AND THE GAP NOTICE BELONGS TO THE GENERATOR, NOT TO THE TAB. "Updates
 *     stopped … nothing was sampled" is true of a chart whose own timer was
 *     stopped. It is false of a chart the host feeds — the host's socket kept
 *     delivering while the tab was hidden. So `gapMs` is set only when THIS
 *     ticker was running at the moment the tab hid.
 */

/** What a live chart hands the ticker. Every callback is read lazily, never at construction. */
export interface SvLiveTickerOptions {
  /** Called once per interval while the ticker runs. */
  readonly tick: () => void;
  /** Interval in ms. A value ≤ 0 or non-finite keeps the ticker off. */
  readonly intervalMs: () => number;
  /**
   * Whether the component wants its generator running — "the user has not
   * paused it, and there is a generator at all". Visibility is layered on top;
   * do not fold it in here.
   */
  readonly enabled: () => boolean;
}

/** A visibility-aware interval. */
export interface SvLiveTicker {
  /** The tab-visibility state the ticker listens to. */
  readonly visibility: SvLivePause;
  /** True while an interval is actually scheduled. */
  readonly active: Signal<boolean>;
  /**
   * Length of the last hidden stretch during which this ticker was running and
   * so was stopped. `0` until then — a hidden tab while the ticker was already
   * off (user-paused, or a host-fed chart with no generator) leaves it alone.
   */
  readonly gapMs: Signal<number>;
  /** `svPauseNotice(gapMs())` — the sentence to put under the plot, or null. */
  readonly notice: Signal<string | null>;
  /**
   * Re-evaluate whether the interval should run: call after anything
   * `enabled` or `intervalMs` reads has changed. Idempotent — never schedules
   * a second interval.
   */
  readonly sync: () => void;
  /** Forget the last gap, e.g. when the history it described was reset. */
  readonly clearGap: () => void;
}

/**
 * Create a visibility-aware interval in an injection context. The interval is
 * cleared on destroy, and never scheduled during SSR.
 */
export function createLiveTicker(options: SvLiveTickerOptions): SvLiveTicker {
  const visibility = createVisibilityPause();
  const browser = isPlatformBrowser(inject(PLATFORM_ID));
  const active = signal(false);
  const gapMs = signal(0);

  let handle: ReturnType<typeof setInterval> | null = null;
  let runningMs = 0;
  /** Whether the ticker was running — and generating — when the tab hid. */
  let stoppedByHide = false;

  const stop = (): void => {
    if (handle !== null) clearInterval(handle);
    handle = null;
    active.set(false);
  };

  const sync = (): void =>
    untracked(() => {
      const ms = options.intervalMs();
      const want =
        browser && !visibility.paused() && Number.isFinite(ms) && ms > 0 && options.enabled();
      if (!want) {
        stop();
        return;
      }
      if (handle !== null && runningMs === ms) return;
      stop();
      runningMs = ms;
      handle = setInterval(() => options.tick(), ms);
      active.set(true);
    });

  visibility.onChange(hidden => {
    if (hidden) {
      // `enabled()` too, not just the handle: a chart whose generator was
      // switched off since the last sync (a host started supplying data) was
      // not generating, so it has no gap of its own to report.
      stoppedByHide = handle !== null && untracked(() => options.enabled());
      stop();
    } else {
      if (stoppedByHide) gapMs.set(untracked(() => visibility.lastPauseMs()));
      stoppedByHide = false;
      sync();
    }
  });

  inject(DestroyRef).onDestroy(stop);

  return {
    visibility,
    active: active.asReadonly(),
    gapMs: gapMs.asReadonly(),
    notice: computed(() => svPauseNotice(gapMs())),
    sync,
    clearGap: () => gapMs.set(0),
  };
}
