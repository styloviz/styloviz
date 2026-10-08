import { DestroyRef, computed, inject, signal, type Signal } from '@angular/core';

/**
 * sheet-mode.ts — one answer to "what does this surface do on a phone?"
 * (`X-16`).
 *
 * ★★★ FIVE FAMILIES ASK FOR THE SAME FALLBACK. A centred dialog, an anchored
 *     popover, a dropdown menu, a context menu and a command palette all have
 *     the same problem at 375px: there is no room beside the anchor, so an
 *     anchored surface is clamped until it covers the thing it points at, and
 *     a centred one is a postage stamp in the middle of the screen with the
 *     keyboard over it. Implemented five times, it would be five slightly
 *     different breakpoints and five different bugs.
 *
 * ★★ AND THE HARD PART IS NOT THE BREAKPOINT — it is the two things everyone
 *    forgets: the safe area (a sheet's last row sits under the home indicator)
 *    and the virtual keyboard (a sheet with a field in it is covered by the
 *    keyboard the field just raised). Both are here, so an adopter gets them
 *    by adopting rather than by remembering.
 */

/** Options for {@link createSheetMode}. */
export interface SvSheetModeOptions {
  /**
   * Viewport width, in px, at or below which a surface becomes a sheet.
   * @default 640
   *
   * ★ 640 is Tailwind's `sm` boundary, so a host's own responsive classes and
   *   this switch change at the same width. A surface that becomes a sheet 8px
   *   before the layout around it reflows looks like a bug in the sheet.
   */
  readonly maxWidth?: number;
  /**
   * Also require a pointer that cannot hover. @default false
   *
   * ★ Off by default because a NARROW WINDOW ON A DESKTOP has the same problem
   *   — there is no room beside the anchor either way. Turn it on for a
   *   surface whose sheet form is really about the finger rather than the
   *   width.
   */
  readonly requireTouch?: boolean;
  /** Read on every evaluation, so a host can turn the fallback off entirely. */
  readonly enabled?: () => boolean;
}

/** A live sheet-mode subscription. */
export interface SvSheetMode {
  /** True when this surface should render as a bottom sheet. */
  readonly asSheet: Signal<boolean>;
  /**
   * Pixels of the viewport currently hidden by the virtual keyboard.
   *
   * ★★★ A SHEET WITH A FIELD IN IT IS COVERED BY THE KEYBOARD THAT FIELD JUST
   *     RAISED, and `window.innerHeight` does not change when it appears — so
   *     `bottom: 0` is behind the keyboard, and the input the user tapped is
   *     the part that is hidden. Bind this to the sheet's `bottom` and it sits
   *     on top of the keyboard instead.
   *
   * `0` where `visualViewport` is unavailable, which is the desktop answer and
   * the safe one.
   */
  readonly keyboardInset: Signal<number>;
  /** Stop listening. Idempotent. Called for you on destroy. */
  release(): void;
}

/**
 * The bottom padding a sheet needs so its last row clears the home indicator.
 *
 * ★★ `env()` WITH A FALLBACK, and the fallback is the point: `env()` resolves
 *    to nothing at all in a browser that does not know the variable, and
 *    `padding-bottom:` with nothing after it is a dropped declaration rather
 *    than a zero — so the whole rule silently disappears, which is the shape
 *    that ships looking fine on the developer's desktop.
 *
 * ★ It ALSO needs `viewport-fit=cover` in the host's `<meta name="viewport">`,
 *   without which the browser reports a zero inset on a notched device. That
 *   is the host's document, not ours, so it is documentation rather than code.
 */
export const SV_SHEET_SAFE_AREA_PADDING = 'env(safe-area-inset-bottom, 0px)';

/**
 * Watch the viewport for sheet mode.
 *
 * Must be called in an injection context: it takes a `DestroyRef` so a host
 * cannot forget to unsubscribe.
 */
export function createSheetMode(options: SvSheetModeOptions = {}): SvSheetMode {
  const maxWidth = options.maxWidth ?? 640;
  const requireTouch = options.requireTouch ?? false;
  const enabled = options.enabled ?? (() => true);

  const narrow = signal(false);
  const noHover = signal(false);
  const keyboardInset = signal(0);
  const stops: (() => void)[] = [];

  const hasWindow = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

  if (hasWindow) {
    // ★ `(max-width: Npx)` rather than reading `innerWidth` once: a phone
    //   rotating changes width without any scroll or resize the component sees
    //   otherwise, and a desktop window is dragged narrow all the time.
    const widthMql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    narrow.set(widthMql.matches);
    const onWidth = (e: MediaQueryListEvent): void => narrow.set(e.matches);
    widthMql.addEventListener('change', onWidth);
    stops.push(() => widthMql.removeEventListener('change', onWidth));

    const hoverMql = window.matchMedia('(hover: none)');
    noHover.set(hoverMql.matches);
    const onHover = (e: MediaQueryListEvent): void => noHover.set(e.matches);
    hoverMql.addEventListener('change', onHover);
    stops.push(() => hoverMql.removeEventListener('change', onHover));

    const vv = window.visualViewport;
    if (vv) {
      const measure = (): void => {
        // ★★ THE FORMULA IS NOT `innerHeight - vv.height`. On iOS the page
        //    scrolls under the keyboard, so `vv.offsetTop` is how far the
        //    visual viewport has moved down the layout viewport — and ignoring
        //    it reports a keyboard that is taller than it is the moment the
        //    user scrolls, pushing the sheet off the top of the screen.
        const hidden = window.innerHeight - (vv.height + vv.offsetTop);
        // Negative readings happen mid-animation on Android.
        keyboardInset.set(Math.max(0, Math.round(hidden)));
      };
      measure();
      vv.addEventListener('resize', measure);
      vv.addEventListener('scroll', measure);
      stops.push(() => {
        vv.removeEventListener('resize', measure);
        vv.removeEventListener('scroll', measure);
      });
    }
  }

  const release = (): void => {
    while (stops.length) stops.pop()!();
  };

  // ★ A `DestroyRef` rather than asking the caller to call `release()`: an
  //   overlay that forgets leaves two media-query listeners and two
  //   visualViewport listeners per instance, and overlays are created per row.
  inject(DestroyRef).onDestroy(release);

  return {
    asSheet: computed(
      () => enabled() && narrow() && (!requireTouch || noHover()),
    ),
    keyboardInset: computed(() => keyboardInset()),
    release,
  };
}
