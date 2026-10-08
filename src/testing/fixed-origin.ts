/**
 * ============================================================================
 *  @testing/fixed-origin — simulate a containing block that is not the viewport
 * ============================================================================
 *
 * ★★★ STUB THE MECHANISM, NOT THE PROXY. These specs used to fake a
 *     transformed ancestor by overriding the PORTAL HOST's
 *     `getBoundingClientRect`, because that is what the components read:
 *
 *         container: host.left !== 0 || host.top !== 0 ? host : null
 *
 *     That proxy was wrong — a portal host is a plain `<div>` at the end of
 *     `<body>` and its rect is off the origin on every page with content, so
 *     the correction fired everywhere and pushed panels off the top of the
 *     window at a viewport edge (`e2e/overlay-positioning.spec.ts`). The
 *     components now MEASURE the re-basing with a fixed probe
 *     (`svFixedOrigin`), so a spec that stubs the host rect is stubbing
 *     something nothing reads any more, and would pass or fail for reasons
 *     unconnected to the behaviour.
 *
 * ★★ What this stubs instead is the physical claim itself: *a
 *    `position: fixed` child inside this document is anchored at (left, top)
 *    rather than at the viewport origin.* That is exactly what a `transform`
 *    on an ancestor does, and exactly what the probe measures.
 *
 * ⚠️ jsdom has no layout, so nothing here proves the browser's behaviour — it
 *    only drives the branch. The behaviour is proved in a real engine by
 *    `e2e/overlay-positioning.spec.ts`, which parks a trigger at the bottom
 *    edge, the one place the offset survives clamping and reaches the screen.
 */

/** Restores the original `getBoundingClientRect`. */
export type RestoreFixedOrigin = () => void;

/**
 * Make every `position: fixed` probe report `origin`, as it would inside a
 * transformed ancestor. Other elements are unaffected.
 *
 * ```ts
 * const restore = stubFixedOrigin({ top: 50, left: 30 });
 * window.dispatchEvent(new Event('resize'));   // force a reposition
 * expect(panel.style.top).toBe('298px');       // 348 − 50
 * restore();
 * ```
 */
export function stubFixedOrigin(origin: { top: number; left: number }): RestoreFixedOrigin {
  const original = Element.prototype.getBoundingClientRect;

  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    // The probe `svFixedOrigin` appends: fixed, zero-size and hidden. Nothing a
    // component renders looks like this, so the stub cannot catch a real panel.
    const style = (this as HTMLElement).style;
    if (style?.position === 'fixed' && style.visibility === 'hidden' && style.width === '0px') {
      return {
        top: origin.top, left: origin.left, width: 0, height: 0,
        right: origin.left, bottom: origin.top, x: origin.left, y: origin.top,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return original.call(this);
  };

  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}
