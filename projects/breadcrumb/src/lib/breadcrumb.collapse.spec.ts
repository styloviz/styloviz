import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  `sv-breadcrumb` — collapsing the middle of a long trail
 * ============================================================================
 *
 * The ellipsis is a real open↔close toggle, not a one-way reveal, and the
 * arithmetic around it is all fenceposts: how many crumbs are hidden, how many
 * the toggle would move, and whether collapsing is worth doing at all.
 */

const LONG: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  { label: 'Catalogue', routerLink: '/c' },
  { label: 'Widgets', routerLink: '/c/w' },
  { label: 'Blue', routerLink: '/c/w/b' },
  { label: 'Widget 42' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBreadcrumbComponent, {
    inputs: { items: LONG, ...inputs },
    providers: [provideRouter([])],
  });
  fixture.detectChanges();
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

/** The visible crumb labels, ellipsis excluded. */
function labels(c: SvBreadcrumbComponent): string[] {
  return c.visibleItems().filter(c.isBreadcrumbItem).map((i) => i.label);
}

const toggleBtn = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('ol button[aria-expanded]');

// ─────────────────────────────────────────────────────────────────────────────

describe('SvBreadcrumbComponent — when collapsing applies at all', () => {
  it('shows the whole trail when maxVisible is 0 (the default)', async () => {
    const { c, el } = await setup();
    expect(c.isCollapsible()).toBe(false);
    expect(c.hiddenCount()).toBe(0);
    expect(c.toggleCount()).toBe(0);
    expect(c.hasEllipsis()).toBe(false);
    expect(labels(c)).toHaveLength(5);
    expect(toggleBtn(el)).toBeNull();
  });

  it('shows the whole trail when it is exactly at the limit', async () => {
    // 5 items, maxVisible 5 — the boundary. `>` not `>=`, or a trail that fits
    // is collapsed for no reason.
    const { c } = await setup({ maxVisible: 5 });
    expect(c.isCollapsible()).toBe(false);
    expect(labels(c)).toHaveLength(5);
  });

  /**
   * ★ UPDATED 2026-09-21 for `NV-03-M3`. This used to expect `['Home', 'Widget
   * 42']` and `hiddenCount() === 3` — the same answer for every value of
   * `maxVisible`, because collapsing kept the first and last and nothing else.
   * `maxVisible` was a THRESHOLD, not a maximum, and the assertion recorded that.
   *
   * It now means what its name says: four crumbs survive, chosen by
   * **root, current, then backwards from the parent**.
   */
  it('keeps as many crumbs as maxVisible allows, from the parent backwards', async () => {
    const { c } = await setup({ maxVisible: 4 });
    expect(c.isCollapsible()).toBe(true);
    expect(labels(c)).toEqual(['Home', 'Widgets', 'Blue', 'Widget 42']);
    expect(c.hiddenCount()).toBe(1);
  });

  /**
   * ★ REGRESSION. `isCollapsible` asked only "is the trail longer than the
   * limit?", so `maxVisible=1` on a two-crumb trail counted as collapsible —
   * and `visibleItems` then rendered `[first, '…', last]`, which is BOTH
   * crumbs plus an ellipsis standing for nothing. The toggle rendered with
   * `aria-label="Show 0 hidden pages"` and clicking it changed nothing on
   * screen while still emitting `expand`. Collapsing now also requires there
   * to be a middle to collapse.
   */
  it('★ does not offer an ellipsis when there is no middle crumb to hide', async () => {
    const items: BreadcrumbItem[] = [{ label: 'Home', routerLink: '/' }, { label: 'Here' }];
    const { c, el } = await setup({ items, maxVisible: 1 });
    expect(c.isCollapsible()).toBe(false);
    expect(c.hasEllipsis()).toBe(false);
    expect(c.toggleCount()).toBe(0);
    expect(labels(c)).toEqual(['Home', 'Here']);
    expect(toggleBtn(el)).toBeNull();
  });

  it('collapses a three-crumb trail, where exactly one crumb is hidden', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Middle', routerLink: '/m' },
      { label: 'Here' },
    ];
    const { c, el } = await setup({ items, maxVisible: 2 });
    expect(c.isCollapsible()).toBe(true);
    expect(c.hiddenCount()).toBe(1);
    // Singular, not "1 hidden pages".
    expect(toggleBtn(el)!.getAttribute('aria-label')).toBe('Show 1 hidden page');
  });
});

describe('SvBreadcrumbComponent — the ellipsis toggle', () => {
  it('sits directly after the first crumb, collapsed', async () => {
    const { c } = await setup({ maxVisible: 3 });
    expect(c.visibleItems()[0]).toBe(LONG[0]);
    expect(c.visibleItems()[1]).toBe('__ellipsis__');
    // ★ `LONG[3]`, the PARENT, and no longer straight to the current page —
    //   `NV-03-M3`. "Go back to the order" is the overwhelmingly common move,
    //   and it used to be behind the ellipsis every time while the site root,
    //   which the logo already links to, was always on screen.
    expect(c.visibleItems()[2]).toBe(LONG[3]);
    expect(c.visibleItems()[3]).toBe(LONG[4]);
  });

  it('reveals the hidden crumbs and keeps the toggle in place, expanded', async () => {
    const { c, el, fixture } = await setup({ maxVisible: 3 });
    const seenExpand: number[] = [];
    const seenCollapse: number[] = [];
    c.expand.subscribe(() => seenExpand.push(1));
    c.collapse.subscribe(() => seenCollapse.push(1));

    const button = toggleBtn(el)!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // Two now, not three: `maxVisible: 3` keeps root + parent + current.
    expect(button.getAttribute('aria-label')).toBe('Show 2 hidden pages');

    button.click();
    fixture.detectChanges();

    expect(c.isExpanded()).toBe(true);
    expect(labels(c)).toEqual(['Home', 'Catalogue', 'Widgets', 'Blue', 'Widget 42']);
    expect(c.hiddenCount()).toBe(0);      // nothing is hidden any more…
    expect(c.toggleCount()).toBe(2);      // …but the toggle still moves two.
    expect(seenExpand).toEqual([1]);
    expect(seenCollapse).toEqual([]);

    const expanded = toggleBtn(el)!;
    expect(expanded.getAttribute('aria-expanded')).toBe('true');
    expect(expanded.getAttribute('aria-label')).toBe('Hide 2 pages');
  });

  it('collapses again on a second activation, and says so', async () => {
    const { c, el, fixture } = await setup({ maxVisible: 3 });
    const seenCollapse: number[] = [];
    c.collapse.subscribe(() => seenCollapse.push(1));

    toggleBtn(el)!.click();
    fixture.detectChanges();
    toggleBtn(el)!.click();
    fixture.detectChanges();

    expect(c.isExpanded()).toBe(false);
    expect(labels(c)).toEqual(['Home', 'Blue', 'Widget 42']);
    expect(seenCollapse).toEqual([1]);
  });

  it('renders the ellipsis as decoration, not a control, when expandable is off', async () => {
    const { c, el } = await setup({ maxVisible: 3, expandable: false });
    expect(toggleBtn(el)).toBeNull();
    const decoration = el.querySelector('[role="img"][aria-label="More pages"]')!;
    expect(decoration).toBeTruthy();
    expect(c.hasEllipsis()).toBe(true);
  });

  it('refuses to expand when expandable is off, and emits nothing', async () => {
    const { c } = await setup({ maxVisible: 3, expandable: false });
    const seen: string[] = [];
    c.expand.subscribe(() => seen.push('expand'));
    c.collapse.subscribe(() => seen.push('collapse'));
    c.toggleCollapse();
    expect(c.isExpanded()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('refuses to expand a trail that is not collapsible in the first place', async () => {
    const { c } = await setup();
    const seen: string[] = [];
    c.expand.subscribe(() => seen.push('expand'));
    c.toggleCollapse();
    expect(c.isExpanded()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('keeps aria-current on the true last crumb in both states', async () => {
    const { el, fixture } = await setup({ maxVisible: 3 });
    expect(el.querySelector('[aria-current="page"]')!.textContent?.trim()).toBe('Widget 42');
    toggleBtn(el)!.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(el.querySelector('[aria-current="page"]')!.textContent?.trim()).toBe('Widget 42');
  });

  it('answers isFirstItem/isLastItem against what is on screen, not the source array', async () => {
    const { c } = await setup({ maxVisible: 3 });
    expect(c.isFirstItem(LONG[0])).toBe(true);
    expect(c.isLastItem(LONG[4])).toBe(true);
    // Hidden crumbs are neither.
    expect(c.isFirstItem(LONG[2])).toBe(false);
    expect(c.isLastItem(LONG[2])).toBe(false);
  });
});

const ICON_VIEWBOXES = new Set(['0 0 24 24', '0 0 20 20', '0 0 16 16']);
const SURFACES: readonly (readonly [string, Record<string, unknown>])[] = [
  ['chevron separator + home icon', { items: [{ label: 'Home', routerLink: '/' }, { label: 'Docs' }], showHomeIcon: true }],
  ['arrow separator', { items: [{ label: 'A' }, { label: 'B' }], separator: 'arrow' }],
  ['crumb icon', { items: [{ label: 'A', icon: 'star' }, { label: 'B' }] }],
];


// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * Every `<svg>` this component renders must come from the icon library.
 *
 * ★ Queries `document`, not the host: several of these components portal part
 *   of their UI (panels, menus) to `<body>`, and a host-scoped query would
 *   assert over an empty list and pass.
 * ★ Asserts something WAS drawn first — "every svg is an icon" is vacuously
 *   true over nothing.
 */
describe('SvBreadcrumbComponent — icons come from the library', () => {
  it.each(SURFACES)('draws no glyph by hand: %s', async (_label, inputs) => {
    TestBed.resetTestingModule();
    await render(SvBreadcrumbComponent, { inputs: inputs as Record<string, unknown> });
    const svgs = [...document.querySelectorAll('svg')].filter((n) =>
      ICON_VIEWBOXES.has(n.getAttribute('viewBox') ?? ''),
    );
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });
});
