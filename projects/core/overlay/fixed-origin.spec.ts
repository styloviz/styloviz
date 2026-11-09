/**
 * ============================================================================
 *  svFixedOrigin — the measure, and what jsdom can and cannot say about it
 * ============================================================================
 *
 * ⚠️ JSDOM HAS NO LAYOUT. Every `getBoundingClientRect` is zero, so the one
 *    thing this helper exists to detect — a `transform` on an ancestor stealing
 *    containment from a `fixed` child — cannot be reproduced here at all. A
 *    spec that "proved" it in jsdom would be proving its own stub.
 *
 *    What IS testable here is the contract around the measure: the shape of the
 *    answer, that the probe is temporary, and that a measured offset is passed
 *    through rather than re-derived from the host's own rect (which is the
 *    mistake this replaced). The behaviour itself is proved in a real engine by
 *    `e2e/overlay-positioning.spec.ts`, which parks a trigger at the bottom
 *    edge — the only place the offset survives clamping and reaches the screen.
 */
import { describe, expect, it, afterEach, vi } from 'vitest';

import { svFixedContainer, svFixedOrigin } from './fixed-origin';

afterEach(() => vi.restoreAllMocks());

/** Make every element report `rect`, as a real engine would after layout. */
function layout(rect: Partial<DOMRect>): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

describe('svFixedOrigin', () => {
  it('is the origin when nothing re-bases a fixed child', () => {
    layout({ top: 0, left: 0 });
    expect(svFixedOrigin(document.createElement('div'))).toEqual({ top: 0, left: 0 });
  });

  it('reports what the probe measured when something does', () => {
    layout({ top: 253, left: 12 });
    expect(svFixedOrigin(document.createElement('div'))).toEqual({ top: 253, left: 12 });
  });

  /** ★ Sub-pixel noise is not a containing block. */
  it('treats a fraction of a pixel as the origin', () => {
    layout({ top: 0.25, left: -0.25 });
    expect(svFixedOrigin(document.createElement('div'))).toEqual({ top: 0, left: 0 });
  });

  it('survives a missing host rather than throwing into a position pass', () => {
    expect(svFixedOrigin(null)).toEqual({ top: 0, left: 0 });
    expect(svFixedOrigin(undefined)).toEqual({ top: 0, left: 0 });
  });

  /**
   * ★★ The probe must not outlive the measure. It is appended to a host that
   *    holds a live panel, and one left behind per position pass would be a
   *    leak in the element every overlay portals into.
   */
  it('leaves nothing behind in the host', () => {
    layout({ top: 40, left: 0 });
    const host = document.createElement('div');
    svFixedOrigin(host);
    svFixedOrigin(host);
    expect(host.childElementCount).toBe(0);
  });
});

describe('svFixedContainer', () => {
  /**
   * ★★★ THE REGRESSION. The old code passed a container whenever the host's
   *     OWN rect was off the origin — which it always is, because a portal host
   *     is a plain `<div>` at the end of `<body>`. Here the host sits 253px
   *     down the page and nothing re-bases a fixed child: the answer must be
   *     `null`, not the host's rect.
   */
  it('is null when the host is down the page but the viewport still owns the panel', () => {
    const host = document.createElement('div');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      // The probe is `position: fixed` — the viewport owns it, so it is at 0.
      const isProbe = this !== host;
      const top = isProbe ? 0 : 253;
      return { top, left: 0, width: 0, height: 0, right: 0, bottom: top,
               x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });

    expect(svFixedContainer(host)).toBeNull();
  });

  it('is the measured offset when a fixed child really is re-based', () => {
    layout({ top: 96, left: 24, width: 300, height: 200 });
    expect(svFixedContainer(document.createElement('div'))).toEqual({
      top: 96, left: 24, width: 300, height: 200,
    });
  });
});
