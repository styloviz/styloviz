/**
 * anchor-scroll-guard — tell a scroll EVENT apart from the anchor having MOVED.
 *
 * Portalled panels pin themselves to a trigger with fixed coordinates read from
 * `getBoundingClientRect()`, so they listen for scroll and close. But the
 * browser also emits scroll when the document grows, when a focused input is
 * revealed, and when a panel's own insertion lengthens the page — `sv-mention`
 * shipped a bug where it closed the panel it had just opened, for that last
 * reason. Closing on the event is wrong twice: it fires when nothing moved, and
 * users read it as the panel vanishing for free.
 *
 * This records where the anchor sat at open and only acts once it really moved.
 * rAF throttling, ignoring scrolls from inside the panel, and an optional grace
 * window after opening are folded in so callers do not re-derive them.
 *
 * Nothing touches the DOM at construction, so it is safe in a field initialiser
 * under SSR. See [[portal-insertion-order]] for the full history.
 */

/** Viewport position of the anchor. Only the origin matters for pinning. */
interface AnchorPosition {
  readonly top: number;
  readonly left: number;
}

export interface SvAnchorScrollGuardOptions {
  /** Element the panel is pinned to. Read lazily, so a late `viewChild` works. */
  readonly anchor: () => Element | null | undefined;

  /** Whether the panel is open. Checked before any DOM work. */
  readonly isOpen: () => boolean;

  /** Run when the anchor has genuinely moved — typically `close()`. */
  readonly onMoved: () => void;

  /** Portal host — scrolling inside the panel is not the anchor moving. */
  readonly portal?: () => Element | null | undefined;

  /**
   * Movement below this many px is no movement — sub-pixel jitter from zoom and
   * fractional layout is not a scroll. @default 1
   */
  readonly threshold?: number;

  /**
   * Ignore scrolls within this many ms of `capture()`. Opening often focuses
   * something inside the panel, and a short viewport scrolls to reveal it — a
   * real move the user never asked for. @default 0 (disabled)
   */
  readonly graceMs?: number;
}

export interface SvAnchorScrollGuard {
  /** Pass straight to `addEventListener('scroll', …, { capture: true })`. */
  readonly handler: (event: Event) => void;
  /** Call immediately after the panel is inserted and positioned. */
  capture(): void;
  /** Cancel any pending frame. Call from `ngOnDestroy`. */
  destroy(): void;
}

/** `performance.now()` where available, so the grace survives a clock change. */
function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * `event.target` is not always a Node — a scroll dispatched on `window` makes it
 * a Window, and handing that to `Node.contains()` throws. A regression test here
 * once passed against unfixed code because that throw skipped the branch under
 * test, so duck-type rather than trusting the cast.
 */
function isNode(value: unknown): value is Node {
  return !!value && typeof (value as Node).nodeType === 'number';
}

export function createAnchorScrollGuard(
  options: SvAnchorScrollGuardOptions,
): SvAnchorScrollGuard {
  const threshold = options.threshold ?? 1;
  const graceMs = options.graceMs ?? 0;

  let anchorAt: AnchorPosition | null = null;
  let capturedAt = 0;
  let rafId: number | null = null;

  const read = (): AnchorPosition | null => {
    const el = options.anchor();
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  };

  const handler = (event: Event): void => {
    if (!options.isOpen()) return;

    const target = event.target;
    const portal = options.portal?.();
    if (portal && isNode(target) && portal.contains(target)) return;

    if (graceMs > 0 && now() - capturedAt < graceMs) return;
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!options.isOpen()) return;

      const current = read();
      // Cannot prove it moved. Staying open is the safer failure: a lingering
      // panel is recoverable, one that vanishes mid-interaction is not.
      if (!current || !anchorAt) return;
      if (
        Math.abs(current.top - anchorAt.top) < threshold &&
        Math.abs(current.left - anchorAt.left) < threshold
      ) {
        return;
      }

      options.onMoved();
    });
  };

  return {
    handler,
    capture(): void {
      anchorAt = read();
      capturedAt = now();
    },
    destroy(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
