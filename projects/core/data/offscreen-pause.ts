import { DestroyRef, PLATFORM_ID, inject, signal, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * offscreen-pause.ts — a live surface below the fold should cost nothing either.
 *
 * ★★★ `visibilitychange` IS ONLY HALF THE SAVING. It fires when the *tab* goes
 *     away, and a wallboard, a long dashboard or a queue three screens down a
 *     scrolling page is visible to the browser and invisible to the reader. The
 *     tick costs the same either way: a timer, a signal write, a change
 *     detection pass and a reflow, once a second, for a surface nobody is
 *     looking at.
 *
 * ★★★ AND THE FALLBACK IS TODAY'S BEHAVIOUR, NOT A PAUSE. With no
 *     `IntersectionObserver` — SSR, a DOM shim, an old browser — `offscreen`
 *     stays false and the caller keeps ticking. A pause that fires because the
 *     environment lacks an observer would freeze a queue the reader is watching,
 *     which is a far worse failure than a wasted interval.
 *
 * Pairs with `createVisibilityPause`: a caller that wants both stops when either
 * says so, which is one `||` at the tick site.
 */

/** What a caller needs to know about its own element's position. */
export interface SvOffscreenPause {
  /**
   * True while the observed element is known to be outside the viewport.
   *
   * ★ "Known to be" is load-bearing: false means *not known to be offscreen*,
   *   which covers both a visible element and an environment that cannot tell.
   */
  readonly offscreen: Signal<boolean>;
  /**
   * Start watching an element, replacing any previous one. Passing `null` stops
   * watching and resets `offscreen` to false — an element nobody is watching is
   * not known to be offscreen.
   */
  readonly observe: (element: Element | null) => void;
  /** Stop watching. Called for you when the injection context is destroyed. */
  readonly destroy: () => void;
}

/**
 * Pause a feed while its own element is scrolled out of view.
 *
 * Must be called from an injection context — it takes its own `DestroyRef`, so a
 * component that creates one cannot leak the observer.
 *
 * @param rootMargin How far outside the viewport still counts as visible.
 *   Defaults to `'200px'`: the surface resumes just *before* it scrolls into
 *   view, so the reader never arrives at a frozen clock and watches it catch up.
 */
export function createOffscreenPause(rootMargin = '200px'): SvOffscreenPause {
  const offscreen = signal(false);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId) || typeof IntersectionObserver === 'undefined') {
    return { offscreen, observe: () => undefined, destroy: () => undefined };
  }

  let observer: IntersectionObserver | null = null;

  const destroy = (): void => {
    observer?.disconnect();
    observer = null;
  };

  const observe = (element: Element | null): void => {
    destroy();
    if (!element) {
      offscreen.set(false);
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        // ★ The LAST entry, not the first. A batch can carry several crossings
        //   for one element when scrolling fast, and the first of them is the
        //   oldest — acting on it leaves the flag describing where the element
        //   used to be.
        const latest = entries[entries.length - 1];
        if (latest) offscreen.set(!latest.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(element);
  };

  inject(DestroyRef).onDestroy(destroy);

  return { offscreen, observe, destroy };
}
