/**
 * Resize / maximize geometry for `sv-modal`.
 *
 * ★★★ A RESIZABLE DIALOG THAT DOES NOT CLAMP IS A DIALOG YOU CAN DRAG AWAY.
 *
 * The naive handler is `width += dx; height += dy`. Two drags later the panel
 * is wider than the viewport, the header — and with it the × and every footer
 * button — is off screen, and there is no gesture left that brings it back:
 * the handle you would need to drag is also off screen. The user's only exit is
 * Escape, and a dialog with `closeOnEsc="false"` has trapped them for good.
 *
 * So every size that leaves this file is clamped to both a floor (a panel too
 * small to hold its own header is equally useless) and to the viewport.
 */

/** A panel size in CSS pixels. */
export interface SvModalSizePx {
  readonly width: number;
  readonly height: number;
}

/** The bounds a size is clamped into. */
export interface SvModalResizeBounds {
  readonly minWidth: number;
  readonly minHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Gap kept between the panel and each viewport edge. @default 16 */
  readonly margin?: number;
}

/** Non-finite input is dropped rather than propagated into a style attribute. */
function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Clamp a size into the bounds.
 *
 * ★★ THE FLOOR WINS OVER THE CEILING. On a viewport narrower than `minWidth` —
 * a phone, or a desktop window dragged very small — the two constraints
 * contradict each other, and honouring the ceiling would collapse the panel to
 * a sliver. Applying the minimum last means the dialog overflows a tiny
 * viewport instead of disappearing into it, which is the failure the user can
 * actually recover from by scrolling.
 */
export function svClampModalSize(
  size: SvModalSizePx,
  bounds: SvModalResizeBounds,
): SvModalSizePx {
  const margin = bounds.margin ?? 16;
  const maxWidth = Math.max(0, bounds.viewportWidth - margin * 2);
  const maxHeight = Math.max(0, bounds.viewportHeight - margin * 2);

  const width = finite(size.width, bounds.minWidth);
  const height = finite(size.height, bounds.minHeight);

  return {
    width: Math.max(bounds.minWidth, Math.min(width, maxWidth)),
    height: Math.max(bounds.minHeight, Math.min(height, maxHeight)),
  };
}

/** Apply a pointer delta to a size, then clamp it. */
export function svResizeModal(
  from: SvModalSizePx,
  deltaX: number,
  deltaY: number,
  bounds: SvModalResizeBounds,
): SvModalSizePx {
  return svClampModalSize(
    { width: from.width + finite(deltaX, 0), height: from.height + finite(deltaY, 0) },
    bounds,
  );
}

/** The size a maximized panel takes: the viewport, less the margin. */
export function svMaximizedSize(bounds: SvModalResizeBounds): SvModalSizePx {
  const margin = bounds.margin ?? 16;
  return svClampModalSize(
    {
      width: bounds.viewportWidth - margin * 2,
      height: bounds.viewportHeight - margin * 2,
    },
    bounds,
  );
}

/**
 * What restoring should go back to.
 *
 * ★★ RESTORE RETURNS TO THE SIZE THE USER LEFT IT AT, NOT TO THE DEFAULT.
 *
 * Someone drags a dialog to the shape they want, maximizes it to read
 * something, then restores — and a restore that snapped back to `size="md"`
 * has thrown away the adjustment they just made, for a round trip they did not
 * think of as destructive. `null` means it was never resized, so the panel goes
 * back to being sized by its CSS class, which is also what the default should
 * do rather than hard-coding a pixel guess at what `md` means.
 */
export function svRestoredSize(
  beforeMaximize: SvModalSizePx | null,
  bounds: SvModalResizeBounds,
): SvModalSizePx | null {
  return beforeMaximize ? svClampModalSize(beforeMaximize, bounds) : null;
}
