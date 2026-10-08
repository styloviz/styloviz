/**
 * ============================================================================
 *  svFixedOrigin — where a `position: fixed` child of this element really sits
 * ============================================================================
 *
 * ★★★ THE HEURISTIC THIS REPLACES WAS WRONG IN THE COMMON CASE, AND THE BUG
 *     ONLY SHOWED UP AT A VIEWPORT EDGE.
 *
 *     `svPositionAnchored` takes a `container` rect so a panel whose containing
 *     block is NOT the viewport can be corrected for it — a real problem, since
 *     any ancestor with `transform`, `filter`, `perspective`, `backdrop-filter`
 *     or `will-change` steals containment from a `fixed` child.
 *
 *     Four components decided whether they were in that situation by asking
 *     whether the portal host's rect was at the origin:
 *
 *         container: host.left !== 0 || host.top !== 0 ? host : null
 *
 *     But a portal host is a plain `<div>` appended to `<body>`. Nothing
 *     positions it, so it lands in normal flow at the END of the document and
 *     its rect is at whatever y the page content happens to end — never zero on
 *     a page with content. The correction therefore fired on every page, with
 *     the wrong number, and the panel was translated by the length of the
 *     document above it.
 *
 *     Why it survived: the correction moves the panel UP by that offset, and a
 *     panel opened in the middle of a tall page is clamped back into view by
 *     the very next step. It is only when the trigger sits at the bottom edge —
 *     where the panel flips upward and has nowhere left to be clamped to — that
 *     the offset survives to the screen. `e2e/overlay-positioning.spec.ts`
 *     parks the trigger at the edge deliberately, and caught three components
 *     drawing their panel 253px above the top of the window: Dropdown Menu,
 *     Popout and Popover.
 *
 * ★★ SO MEASURE IT, DO NOT INFER IT. A zero-size `position: fixed` probe
 *    inside the host reports exactly one thing: the offset a fixed child of
 *    that host is re-based by. `{0, 0}` means the viewport is still the
 *    containing block — whatever the host's own rect says — and anything else
 *    IS the correction, whichever of the six CSS properties caused it and
 *    whichever ancestor carries it.
 *
 * ★ Cheap enough to call per position pass: one append, one
 *   `getBoundingClientRect` (the callers already force layout twice), one
 *   removal. It never paints — the probe has no size and is gone before the
 *   frame ends.
 */

/** The offset a `position: fixed` child of `host` is re-based by. */
export interface SvFixedOrigin {
  readonly top: number;
  readonly left: number;
}

const ZERO: SvFixedOrigin = { top: 0, left: 0 };

/**
 * Measure where a `position: fixed` child of `host` is anchored.
 *
 * Returns `{ top: 0, left: 0 }` when the viewport is the containing block —
 * the common case, and the one where no correction should be applied.
 *
 * @param host The element the panel is portalled into.
 */
export function svFixedOrigin(host: Element | null | undefined): SvFixedOrigin {
  if (!host || typeof document === 'undefined') return ZERO;

  const probe = document.createElement('div');
  // `visibility: hidden` rather than `display: none`: a display-none element
  // has no box, so it would report a zero rect on every page and the measure
  // would always agree with itself.
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;';
  probe.setAttribute('aria-hidden', 'true');

  host.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();

  // Sub-pixel noise is not a containing block.
  const top = Math.abs(rect.top) < 0.5 ? 0 : rect.top;
  const left = Math.abs(rect.left) < 0.5 ? 0 : rect.left;
  return top === 0 && left === 0 ? ZERO : { top, left };
}

/**
 * The `container` rect to hand `svPositionAnchored` for a panel portalled into
 * `host` — or `null` when the viewport is still the containing block.
 *
 * `svPositionAnchored` only reads `top`/`left` off it, so the size is carried
 * for completeness rather than used.
 */
export function svFixedContainer(
  host: HTMLElement | null | undefined,
): { top: number; left: number; width: number; height: number } | null {
  const origin = svFixedOrigin(host);
  if (origin.top === 0 && origin.left === 0) return null;
  const rect = host!.getBoundingClientRect();
  return { top: origin.top, left: origin.left, width: rect.width, height: rect.height };
}
