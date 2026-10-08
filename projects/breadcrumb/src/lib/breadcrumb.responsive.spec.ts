import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  Collapsing to the width that is actually there — `NV-03-M4`, `X-12`
 * ============================================================================
 *
 * `maxVisible` is a guess about a width nobody measured: a trail that fits on a
 * laptop overflows on a phone and looks sparse on a wide monitor, and the
 * consumer picks one number for all three.
 *
 * ★★ The interesting part is how this avoids the `ResizeObserver` feedback loop.
 * The naive version observes the TRAIL — and collapsing the trail changes the
 * trail's width, which re-fires the observer, which re-decides. Throttling does
 * not fix that; a feedback loop measured once per frame is still a feedback loop.
 *
 * So the observed element is the **host** (block-level, therefore as wide as its
 * parent allows regardless of what is inside it), and the per-crumb widths are
 * measured **once from a full render** and cached. Collapsing cannot change
 * either input.
 *
 * ⚠️ jsdom has no layout, so every rect is zero. `getBoundingClientRect` is
 * stubbed on the prototype and answers by element role — which is also how the
 * test controls the available width.
 */

const TRAIL: BreadcrumbItem[] = [
  { label: 'Root', routerLink: '/' },
  { label: 'A', routerLink: '/a' },
  { label: 'B', routerLink: '/a/b' },
  { label: 'C', routerLink: '/a/b/c' },
  { label: 'Current' },
];

const CRUMB_W = 100;
const ELLIPSIS_W = 20;

let available = 1000;
let originalRect: typeof Element.prototype.getBoundingClientRect;

beforeEach(() => {
  available = 1000;
  originalRect = Element.prototype.getBoundingClientRect;

  Element.prototype.getBoundingClientRect = function (this: Element) {
    // The ellipsis `<li>` is narrow, as it is in a browser — so a measurement
    // taken from a collapsed render is visibly wrong rather than coincidentally
    // right (see "re-measures a same-length trail replaced while collapsed").
    if (this.tagName === 'LI') {
      const w = this.querySelector('[data-sv-crumb-ellipsis]') ? ELLIPSIS_W : CRUMB_W;
      return { width: w, height: 20 } as DOMRect;
    }
    if (this.hasAttribute('data-sv-crumb-ellipsis')) {
      return { width: ELLIPSIS_W, height: 20 } as DOMRect;
    }
    // ⚠️ The component's host is NOT a `<sv-breadcrumb>` element here.
    //    Testing-library renders the component as the ROOT component, so Angular
    //    uses the plain `<div id="root0">` it was given and the selector never
    //    appears in the DOM at all. Identified structurally instead: the host is
    //    whatever element has the component's `<nav>` as its first child.
    if (this.firstElementChild?.tagName === 'NAV') {
      return { width: available, height: 20 } as DOMRect;
    }
    return { width: 0, height: 0 } as DOMRect;
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
});

async function setup(width: number, inputs: Partial<ComponentInput<SvBreadcrumbComponent>> = {}) {
  available = width;
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBreadcrumbComponent, {
    inputs: { items: TRAIL, responsive: true, ...inputs } as ComponentInput<SvBreadcrumbComponent>,
  });
  // ★ The first pass renders the full trail and measures it — that is the one
  //   frame the design deliberately spends. The decision lands on the next.
  await untilRendered(fixture, () => true);
  fixture.detectChanges();
  await untilRendered(fixture, () => true);
  return fixture;
}

const labels = (f: { componentInstance: SvBreadcrumbComponent }) =>
  f.componentInstance
    .visibleItems()
    .filter((i): i is BreadcrumbItem => i !== '__ellipsis__')
    .map((i) => i.label);

describe('SvBreadcrumbComponent — responsive collapse', () => {
  /** 5 × 100 = 500, comfortably inside 1000. */
  it('shows the whole trail when it fits', async () => {
    const f = await setup(1000);
    expect(labels(f)).toEqual(['Root', 'A', 'B', 'C', 'Current']);
    expect(f.componentInstance.isCollapsible()).toBe(false);
  });

  /**
   * 500 needed, 350 available. Root + ellipsis + current is 220; each extra
   * crumb is 100, so one more fits at 320 and two would need 420.
   */
  it('keeps as many as fit, by the same root/current/parent priority', async () => {
    const f = await setup(350);
    expect(labels(f)).toEqual(['Root', 'C', 'Current']);
  });

  it('keeps more when there is more room', async () => {
    const f = await setup(450);
    expect(labels(f)).toEqual(['Root', 'B', 'C', 'Current']);
  });

  /** ★ Never below root + current, however narrow — see `keptIndices`. */
  it('stops at two however narrow it gets', async () => {
    const f = await setup(60);
    expect(labels(f)).toEqual(['Root', 'Current']);
  });

  /**
   * ★ Unmeasured means SHOW EVERYTHING, not "collapse to the minimum". Zero is
   * what the server reports and what the first frame reports, and reading it as
   * "nothing fits" would ship every prerendered page in its most collapsed form.
   */
  it('shows everything when the width is unknown', async () => {
    available = 0;
    TestBed.resetTestingModule();
    const { fixture } = await render(SvBreadcrumbComponent, {
      inputs: { items: TRAIL, responsive: true } as ComponentInput<SvBreadcrumbComponent>,
    });
    await untilRendered(fixture, () => true);

    expect(labels(fixture)).toEqual(['Root', 'A', 'B', 'C', 'Current']);
  });

  /** `maxVisible` is inert while `responsive` is on — one of them decides. */
  it('overrides maxVisible', async () => {
    const f = await setup(1000, { maxVisible: 2 });
    expect(labels(f)).toEqual(['Root', 'A', 'B', 'C', 'Current']);
  });

  it('leaves maxVisible in charge when responsive is off', async () => {
    const f = await setup(60, { responsive: false, maxVisible: 4 });
    expect(labels(f)).toEqual(['Root', 'B', 'C', 'Current']);
  });
});

describe('SvBreadcrumbComponent — what responsive does NOT observe', () => {
  /**
   * ★★ The loop guard, asserted directly. Collapsing changes the trail's width;
   * if that were an input, the decision would re-run and oscillate. The host is
   * the only observed element, and its width does not depend on its contents.
   */
  /**
   * The OUTCOME the loop guard exists for: a collapsed trail stays collapsed. The
   * stub reports a narrower crumb once the trail has collapsed, which is what
   * really happens — fewer crumbs, less text, less width. A component that
   * re-measured from that render would conclude more crumbs now fit, expand,
   * re-measure wider, collapse again.
   *
   * ⚠️ This asserts the outcome and does NOT pin the mechanism. Three checks
   * enforce it and **none is individually observable** — each masks the others,
   * so removing any one, or even two, leaves every test green. They are named in
   * the component; this is here so the behaviour is covered even though the
   * implementation cannot be mutation-tested piece by piece.
   */
  it('never re-measures from a collapsed render', async () => {
    const f = await setup(350);
    expect(labels(f)).toEqual(['Root', 'C', 'Current']);

    // From here on a crumb measures at a fifth of its natural width.
    const prior = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.tagName === 'LI') return { width: 20, height: 20 } as DOMRect;
      return prior.call(this);
    };

    for (let i = 0; i < 3; i += 1) {
      f.detectChanges();
      await untilRendered(f, () => true);
    }

    // Unmoved. Had it re-measured, 5 × 20 would fit in 350 and the trail would
    // have sprung back open.
    expect(labels(f)).toEqual(['Root', 'C', 'Current']);
  });

  it('re-measures the crumbs only when the trail itself changes', async () => {
    const f = await setup(350);
    expect(labels(f)).toEqual(['Root', 'C', 'Current']);

    // Several more render passes at the collapsed width. A trail-observing
    // implementation would now measure the COLLAPSED width as natural and
    // settle somewhere else.
    for (let i = 0; i < 3; i += 1) {
      f.detectChanges();
      await untilRendered(f, () => true);
    }

    expect(labels(f)).toEqual(['Root', 'C', 'Current']);
  });

  /**
   * ⚠️ Deliberately a LONGER trail, not a shorter one. A shorter trail would fit
   * anyway, and a stale cache of the wrong length is discarded rather than
   * misused — so both a working and a broken implementation would show
   * everything, and the test would assert nothing. Growing the trail makes the
   * two answers differ: measured afresh it must collapse, and a stale
   * five-element cache against seven crumbs falls back to showing all of them.
   */
  it('re-measures when the items change, because the labels did', async () => {
    const f = await setup(350);
    expect(labels(f)).toEqual(['Root', 'C', 'Current']);

    f.componentRef.setInput('items', [
      ...TRAIL.slice(0, 4),
      { label: 'D', routerLink: '/a/b/c/d' },
      { label: 'E', routerLink: '/a/b/c/d/e' },
      { label: 'Current' },
    ]);
    f.detectChanges();
    await untilRendered(f, () => true);
    f.detectChanges();
    await untilRendered(f, () => true);

    // 7 crumbs of 100 against 350: ellipsis 20 + three crumbs 300 = 320 fits,
    // four would need 420. A stale five-element cache would have shown all seven.
    expect(labels(f)).toEqual(['Root', 'E', 'Current']);
  });

  /**
   * ★ `NV-03-M4`: the case the `<li>` count cannot see. At 450 the five-crumb
   * trail collapses to FOUR crumbs plus the ellipsis — five `<li>`s, the same
   * as `items.length`. A same-length replacement used to be measured from that
   * collapsed render: the ellipsis recorded as a 20px crumb, crumb A missing,
   * a total of 420 that "fits" in 450 — so the trail expanded, overflowed, and
   * `measuredFor` stopped it ever looking again.
   */
  it('re-measures a same-length trail replaced while collapsed', async () => {
    const f = await setup(450);
    expect(labels(f)).toEqual(['Root', 'B', 'C', 'Current']);
    expect(f.nativeElement.querySelectorAll('ol > li')).toHaveLength(TRAIL.length);

    const renamed: BreadcrumbItem[] = TRAIL.map((item) => ({ ...item, label: `${item.label}′` }));
    f.componentRef.setInput('items', renamed);
    for (let i = 0; i < 3; i += 1) {
      f.detectChanges();
      await untilRendered(f, () => true);
    }

    // Measured afresh from the full trail: 500 needed, 450 available, four fit.
    expect(labels(f)).toEqual(['Root′', 'B′', 'C′', 'Current′']);
  });
});
