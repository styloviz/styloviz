import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvOverlayStackService } from '@styloviz/core';
import { SvTooltipComponent, type TooltipPosition } from './tooltip.component';
import { stubFixedOrigin } from '@testing/fixed-origin';

/**
 * ============================================================================
 *  `sv-tooltip` — the body portal and measured placement
 * ============================================================================
 *
 * ★★ TWO DEFECTS, ONE CAUSE (`OF-20-I1`, `OF-20-I2`). The bubble was an
 * `absolute` child of the trigger wrapper placed by CSS classes alone, so it
 * was clipped by any `overflow: hidden` ancestor — every table cell, card and
 * scroll area in a dashboard — and it had no idea where the viewport edge was.
 * `[portal]="true"` moves it into `<body>` and positions it with
 * `svPositionAnchored` (`OF-20-M1`).
 *
 * ★★ jsdom HAS NO LAYOUT, so nothing here is concluded from a real
 * measurement: every test installs an explicit trigger rect and explicit
 * bubble dimensions, and asserts the arithmetic against those literal numbers.
 * The viewport is jsdom's default 1024 × 768.
 *
 * ★ THE IN-PLACE PATH IS THE DEFAULT AND MUST NOT MOVE. The first describe
 * block is there to fail if it ever does — this is a published package and
 * consumers style the bubble through its position in the DOM.
 */

const VH = 768;

async function setup(attrs = '') {
  TestBed.resetTestingModule();
  return render(
    `<sv-tooltip text="Delete this row" ${attrs}><button type="button">Delete</button></sv-tooltip>`,
    { imports: [SvTooltipComponent] },
  );
}

type View = Awaited<ReturnType<typeof setup>>;

const instance = (v: View) =>
  v.fixture.debugElement.children[0].componentInstance as SvTooltipComponent;
const bubble = () => screen.getByRole('tooltip', { hidden: true }) as HTMLElement;
const portalHost = () => document.body.querySelector('[data-sv-portal="tooltip"]');

function stubGeometry(
  v: View,
  trigger: { top: number; left: number; width: number; height: number },
  size = { width: 120, height: 32 },
): void {
  const wrap = (v.fixture.nativeElement as HTMLElement)
    .querySelector('sv-tooltip > div') as HTMLElement;
  wrap.getBoundingClientRect = () =>
    ({ ...trigger, bottom: trigger.top + trigger.height, right: trigger.left + trigger.width,
       x: trigger.left, y: trigger.top, toJSON: () => ({}) }) as DOMRect;

  const node = bubble();
  Object.defineProperty(node, 'offsetWidth', { value: size.width, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: size.height, configurable: true });
}

/** A trigger in the middle of the viewport: room on every side. */
const CENTRED = { top: 300, left: 400, width: 100, height: 40 };

async function shown(attrs: string, trigger = CENTRED, size?: { width: number; height: number }) {
  const v = await setup(attrs);
  stubGeometry(v, trigger, size);
  instance(v).show();
  v.fixture.detectChanges();
  return v;
}

afterEach(() => {
  document.querySelectorAll('[data-sv-portal="tooltip"]').forEach((n) => n.remove());
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sv-tooltip — the in-place default is unchanged', () => {
  it('keeps the bubble inside the trigger wrapper', async () => {
    const v = await shown('position="top"');
    const wrap = (v.fixture.nativeElement as HTMLElement)
      .querySelector('sv-tooltip > div') as HTMLElement;

    expect(wrap.contains(bubble())).toBe(true);
    expect(portalHost()).toBeNull();
  });

  it('still places by CSS class, and writes no coordinates', async () => {
    const v = await shown('position="top"');
    const node = bubble();
    expect(node.className).toContain('absolute');
    expect(node.className).toContain('bottom-full');
    expect(node.className).toContain('z-50');
    expect(node.style.top).toBe('');
    expect(node.style.left).toBe('');
    expect(instance(v).effectivePosition()).toBe('top');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sv-tooltip — [portal]="true" escapes the clip (OF-20-I1)', () => {
  it('moves the bubble into a body portal on show', async () => {
    const v = await shown('[portal]="true"');

    const host = portalHost();
    expect(host).toBeTruthy();
    expect(host!.parentElement).toBe(document.body);
    expect(host!.contains(bubble())).toBe(true);
    // ★ And it is no longer a descendant of the trigger — which is the whole
    //   point: an ancestor's `overflow: hidden` can no longer clip it.
    expect((v.fixture.nativeElement as HTMLElement).contains(bubble())).toBe(false);
  });

  it('puts the bubble back in the wrapper on hide, and drops the host', async () => {
    const v = await shown('[portal]="true"');
    instance(v).hide();
    v.fixture.detectChanges();

    expect(portalHost()).toBeNull();
    const wrap = (v.fixture.nativeElement as HTMLElement)
      .querySelector('sv-tooltip > div') as HTMLElement;
    expect(wrap.contains(bubble())).toBe(true);
  });

  it('leaves nothing in <body> when destroyed while visible', async () => {
    const v = await shown('[portal]="true"');
    expect(portalHost()).toBeTruthy();
    v.fixture.destroy();
    expect(portalHost()).toBeNull();
  });

  it('swaps `absolute` for `fixed` and drops the CSS placement classes', async () => {
    const v = await shown('[portal]="true" position="top"');
    const node = bubble();
    expect(node.className).toContain('fixed');
    expect(node.className).not.toContain('absolute');
    // `bottom-full` positions against the wrapper, which is no longer the
    // parent: left in place it would put the bubble at the bottom of `<body>`.
    expect(node.className).not.toContain('bottom-full');
    expect(instance(v)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sv-tooltip — measured placement (OF-20-I2)', () => {
  // Trigger occupies x 400–500, y 300–340. Bubble is 120 × 32, offset 8.
  it.each<[TooltipPosition, number, number]>([
    ['top',    300 - 8 - 32, 450 - 60],
    ['bottom', 340 + 8,      450 - 60],
    ['left',   320 - 16,     400 - 8 - 120],
    ['right',  320 - 16,     500 + 8],
  ])('places a %s tooltip at top %i, left %i', async (position, top, left) => {
    const v = await shown(`[portal]="true" position="${position}"`);
    const node = bubble();
    expect(node.style.top).toBe(`${top}px`);
    expect(node.style.left).toBe(`${left}px`);
    expect(instance(v).effectivePosition()).toBe(position);
  });

  it('flips to the other side when the preferred one does not fit', async () => {
    // 20px from the top: no room for a 32px bubble plus the gap above it.
    const v = await shown('[portal]="true" position="top"', { ...CENTRED, top: 20 });
    expect(instance(v).effectivePosition()).toBe('bottom');
  });

  it('does not flip when flipping is turned off', async () => {
    const v = await shown('[portal]="true" position="top" [flip]="false"', { ...CENTRED, top: 20 });
    expect(instance(v).effectivePosition()).toBe('top');
  });

  it('clamps a tooltip at the viewport edge instead of rendering off-screen', async () => {
    // ★★ THIS IS THE LAST-COLUMN-OF-A-TABLE CASE. The trigger is 10px from the
    //    right edge, so a centred 120px bubble wants to start at x 954 and end
    //    at 1074 — 50px past the viewport. CSS classes cannot know that.
    const v = await shown('[portal]="true" position="top"', { top: 300, left: 1004, width: 20, height: 40 });
    const left = Number.parseFloat(bubble().style.left);
    expect(left).toBe(1024 - 120 - 8);
    // …and the arrow stays over the trigger rather than following the bubble.
    const arrow = bubble().querySelector('span') as HTMLElement;
    expect(Number.parseFloat(arrow.style.left)).toBeGreaterThan(60);
    expect(instance(v).effectivePosition()).toBe('top');
  });

  it('subtracts a transformed containing block from the coordinates', async () => {
    // A `position: fixed` child is positioned against the viewport only while
    // no ancestor has a `transform` — one on a route wrapper makes IT the
    // containing block, and every coordinate is off by its offset. This is the
    // "the tooltip is fine until the route animates" report.
    const v = await shown('[portal]="true" position="bottom"');
    expect(bubble().style.top).toBe('348px');

    // ★ Stubbed where the component MEASURES it — a fixed child re-based to
    //   (30, 50) — not on the portal host's own rect, which nothing reads any
    //   more and which was the wrong proxy to begin with. See
    //   `@testing/fixed-origin`.
    const restore = stubFixedOrigin({ top: 50, left: 30 });
    window.dispatchEvent(new Event('resize'));
    v.fixture.detectChanges();

    expect(bubble().style.top).toBe(`${348 - 50}px`);
    expect(bubble().style.left).toBe(`${450 - 60 - 30}px`);
    restore();
  });

  it('repositions on resize', async () => {
    const v = await shown('[portal]="true" position="bottom"');
    expect(bubble().style.top).toBe('348px');

    stubGeometry(v, { top: VH - 60, left: 400, width: 100, height: 40 });
    window.dispatchEvent(new Event('resize'));
    v.fixture.detectChanges();

    // No room below now: it flips above the trigger.
    expect(instance(v).effectivePosition()).toBe('top');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sv-tooltip — the ambient layer, and a lost anchor', () => {
  it('paints above a dialog it appears inside, and does not take Escape from it', async () => {
    // ★★★ `z-50` LOSES TO EVERYTHING. A tooltip describing a button inside a
    //     dialog has to clear the dialog whether it appeared before or after
    //     it — which is what the ambient band is for. And it must NOT become
    //     the thing Escape closes, which is what `dismissible: false` is for.
    // ★ THE ORDER HERE IS THE TEST. The dialog opens FIRST and the tooltip
    //   appears on top of it — hovering a button inside the dialog. A tooltip
    //   that joined the stack as dismissible would be the topmost dismissible
    //   surface, and the dialog's own Escape handler returns early when it is
    //   not topmost: Escape would do nothing at all while a tooltip was up.
    const v = await setup('[portal]="true"');
    const stack = TestBed.inject(SvOverlayStackService);
    const dialog = stack.push('modal', { element: () => document.body });
    expect(dialog.isTopmost()).toBe(true);

    stubGeometry(v, CENTRED);
    instance(v).show();
    v.fixture.detectChanges();

    const z = Number.parseInt(bubble().style.zIndex, 10);
    expect(z).toBeGreaterThanOrEqual(200_000);
    expect(dialog.zIndex).toBeLessThan(z);
    expect(dialog.isTopmost()).toBe(true);

    dialog.release();
    expect(instance(v).visible()).toBe(true);
  });

  it('hides when a measured anchor collapses to nothing', async () => {
    const v = await shown('[portal]="true"');
    expect(instance(v).visible()).toBe(true);

    stubGeometry(v, { top: 0, left: 0, width: 0, height: 0 });
    window.dispatchEvent(new Event('resize'));
    v.fixture.detectChanges();

    expect(instance(v).visible()).toBe(false);
    expect(portalHost()).toBeNull();
  });

  it('stays up through a reflow when the anchor has never been measured', async () => {
    // ★★★ "ZERO-SIZED" AND "NOT LAID OUT YET" ARE THE SAME READING, which is
    //     why anchor loss is a TRANSITION and not a state. The trigger's rect
    //     here is jsdom's default zero — exactly what a trigger inside a
    //     container that has not laid out yet reports — and a state check
    //     would make the tooltip vanish on the first scroll or resize after
    //     it appeared, in every such case.
    const v = await setup('[portal]="true"');
    instance(v).show();
    v.fixture.detectChanges();
    expect(instance(v).visible()).toBe(true);
    expect(portalHost()).toBeTruthy();

    window.dispatchEvent(new Event('resize'));
    v.fixture.detectChanges();

    expect(instance(v).visible()).toBe(true);
    expect(portalHost()).toBeTruthy();
  });
});
