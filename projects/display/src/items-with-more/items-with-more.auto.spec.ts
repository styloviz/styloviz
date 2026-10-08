import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvItemsWithMoreComponent } from './items-with-more.component';
import { until } from '../../../../src/testing/async';

/**
 * `autoOverflow`, the panel's placement arithmetic, and the resize path — the
 * three parts of this component that only exist because a browser lays things
 * out, and which the sibling spec therefore leaves alone.
 *
 * ★ EVERY MEASUREMENT HERE IS AN EXPLICIT STUB. jsdom reports 0 for every width
 * and an all-zero `getBoundingClientRect()`, and it has no `ResizeObserver` at
 * all — so nothing below could be concluded from what jsdom actually reports.
 * Each stub says what layout it is standing in for.
 */

const ITEMS = ['Design', 'Engineering', 'Marketing', 'Sales', 'Support'];

// ── A ResizeObserver that fires only when a test says so ────────────────────
type ROEntry = { contentRect: { width: number } };
class FakeResizeObserver {
  static live: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly cb: (entries: ROEntry[]) => void) {
    FakeResizeObserver.live.push(this);
  }
  observe(target: Element): void { this.observed.push(target); }
  unobserve(): void { /* not exercised */ }
  disconnect(): void { this.observed.length = 0; }
  fire(width: number): void { this.cb([{ contentRect: { width } }]); }
}

const g = globalThis as unknown as { ResizeObserver?: unknown };

async function setup(inputs: Partial<ComponentInput<SvItemsWithMoreComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvItemsWithMoreComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvItemsWithMoreComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('[data-trigger]');
const panel = () => document.querySelector<HTMLElement>('.sv-dropdown-portal');

/** Frames are FIFO, so N of ours always run after N the component queued. */
const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });

/**
 * Pretend the row wraps after `n` chips.
 *
 * The component compares each `[data-iwm-item]`'s `top` against the first's; a
 * row that wrapped sits lower. Patched on the prototype rather than on the
 * elements because `_triggerRecalc` re-renders the list (it resets the max to
 * "show all" first), which replaces the nodes.
 */
function stubWrapAfter(host: HTMLElement, n: number): void {
  const orig = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const items = [...host.querySelectorAll('[data-iwm-item]')];
    const idx = items.indexOf(this);
    if (idx >= 0) {
      const top = idx < n ? 0 : 30;
      return { top, bottom: top + 20, left: 0, right: 80, width: 80, height: 20 } as DOMRect;
    }
    return orig.call(this);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('.sv-dropdown-portal').forEach((n) => n.remove());
  delete g.ResizeObserver;
});

describe('SvItemsWithMoreComponent — autoOverflow', () => {
  beforeEach(() => {
    FakeResizeObserver.live = [];
    g.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });

  it('observes the host and shows everything while it all fits on one line', async () => {
    const f = await setup({ autoOverflow: true });
    expect(FakeResizeObserver.live).toHaveLength(1);
    expect(FakeResizeObserver.live[0].observed).toEqual([el(f)]);

    // No wrap: every chip reports the same top (jsdom's all-zero rect).
    await frames(3);
    f.detectChanges();
    expect(f.componentInstance.hasOverflow()).toBe(false);
    expect(f.componentInstance.visibleItems()).toEqual(ITEMS);
  });

  /**
   * When the row wraps, the LAST chip on the first line is given up too — it
   * makes room for the "+N more" control, which has to go somewhere.
   */
  it('keeps one fewer than fits, to leave room for the +N control', async () => {
    const f = await setup({ autoOverflow: true });
    stubWrapAfter(el(f), 4); // four chips fit; the fifth wraps
    FakeResizeObserver.live[0].fire(400);
    await until(() => f.componentInstance.hasOverflow(), { label: 'the overflow to be measured' });
    f.detectChanges();

    expect(f.componentInstance.visibleItems()).toEqual(ITEMS.slice(0, 3));
    expect(f.componentInstance.overflowCount()).toBe(2);
  });

  it('never collapses below one visible item, however narrow it gets', async () => {
    const f = await setup({ autoOverflow: true });
    stubWrapAfter(el(f), 1); // only the first chip fits
    FakeResizeObserver.live[0].fire(60);
    await until(() => f.componentInstance.hasOverflow());
    f.detectChanges();
    expect(f.componentInstance.visibleItems()).toEqual(['Design']);
  });

  it('overrides maxVisible entirely — it is the measurement that decides', async () => {
    const f = await setup({ autoOverflow: true, maxVisible: 2 });
    // Nothing wraps, so all five show despite maxVisible=2.
    await frames(3);
    f.detectChanges();
    expect(f.componentInstance.visibleItems()).toHaveLength(5);
  });

  it('ignores a resize that did not actually change the width', async () => {
    const f = await setup({ autoOverflow: true });
    await frames(3);
    stubWrapAfter(el(f), 1);
    // `_lastContainerW` was seeded from the (zero) rect, so a 0.5px "change"
    // is inside the 1px dead-band and must not trigger a re-measure.
    FakeResizeObserver.live[0].fire(0.5);
    await frames(4);
    f.detectChanges();
    expect(f.componentInstance.hasOverflow()).toBe(false);
  });

  it('concludes nothing when there are no chips to measure', async () => {
    const f = await setup({ autoOverflow: true, items: [] });
    FakeResizeObserver.live[0].fire(400);
    await frames(4);
    expect(f.componentInstance.visibleItems()).toEqual([]);
    expect(f.componentInstance.hasOverflow()).toBe(false);
  });

  it('re-measures on a window resize', async () => {
    const f = await setup({ autoOverflow: true });
    stubWrapAfter(el(f), 2);
    window.dispatchEvent(new Event('resize'));
    await until(() => f.componentInstance.hasOverflow(), { label: 'the resize re-measure' });
    f.detectChanges();
    expect(f.componentInstance.visibleItems()).toEqual(['Design']);
  });

  it('stops observing when it goes away', async () => {
    const f = await setup({ autoOverflow: true });
    const ro = FakeResizeObserver.live[0];
    expect(ro.observed).toHaveLength(1);
    f.destroy();
    expect(ro.observed).toHaveLength(0);
  });

  it('does not observe anything when autoOverflow is off', async () => {
    await setup({ maxVisible: 3 });
    expect(FakeResizeObserver.live).toHaveLength(0);
  });
});

describe('SvItemsWithMoreComponent — without a ResizeObserver', () => {
  /**
   * The SSR path: no observer, so `maxVisible` alone decides.
   *
   * ★★ THIS TEST USED TO ASSERT THE OPPOSITE — that an unmeasured component
   *    shows everything — and that was the SSR defect written down as a
   *    guarantee. A server has no layout, so a prerendered page shipped all
   *    five chips and the first frame after hydration collapsed them to two:
   *    a layout jump on the first paint of every auto-overflow row. Falling
   *    back to `maxVisible` is the fix precisely because the SERVER has that
   *    number too, so both renders agree and hydration changes nothing.
   */
  it('falls back to maxVisible rather than showing everything', async () => {
    expect(typeof g.ResizeObserver).toBe('undefined');
    const f = await setup({ autoOverflow: true, maxVisible: 2 });
    expect(f.componentInstance.visibleItems()).toHaveLength(2);
    expect(f.componentInstance.hasMeasured()).toBe(false);
    expect(trigger(f)).not.toBeNull();
  });
});

/**
 * Placement. jsdom's rect is all zeros and its viewport is 1024×768, so every
 * decision below comes from an EXPLICIT trigger rect — the arithmetic is the
 * subject, not the layout.
 */
describe('SvItemsWithMoreComponent — where the panel goes', () => {
  const stubTriggerRect = (
    f: { nativeElement: unknown },
    rect: Partial<DOMRect>,
  ): void => {
    const t = trigger(f)!;
    t.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect }) as DOMRect;
  };

  const open = (f: { detectChanges(): void; nativeElement: unknown }) => {
    trigger(f)!.click();
    f.detectChanges();
  };

  it('drops below a trigger near the top of the viewport', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    stubTriggerRect(f, { top: 40, bottom: 60, left: 20, right: 100 });
    open(f);

    expect(f.componentInstance.openAbove()).toBe(false);
    expect(f.componentInstance.alignRight()).toBe(false);
    expect(f.componentInstance.panelStyle()['top']).toBe('66px');
    expect(f.componentInstance.panelStyle()['left']).toBe('20px');
    expect(panel()!.querySelector<HTMLElement>('[role="list"]')!.style.position).toBe('fixed');
  });

  it('flips above a trigger with more room over it than under it', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    // 700px above, 48px below → below cannot hold a 280px panel.
    stubTriggerRect(f, { top: 700, bottom: 720, left: 20, right: 100 });
    open(f);

    const style = f.componentInstance.panelStyle();
    expect(f.componentInstance.openAbove()).toBe(true);
    expect(style['bottom']).toBe(`${768 - 700 + 6}px`);
    expect(style['top']).toBeUndefined();
    // Height is capped to the room above, never left to overflow the screen.
    expect(style['maxHeight']).toBe(`${700 - 6 - 8}px`);
  });

  it('right-anchors a trigger too close to the right edge', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    stubTriggerRect(f, { top: 40, bottom: 60, left: 900, right: 990 });
    open(f);

    const style = f.componentInstance.panelStyle();
    expect(f.componentInstance.alignRight()).toBe(true);
    expect(style['right']).toBe(`${1024 - 990}px`);
    expect(style['left']).toBeUndefined();
    // …and the width is capped to the space between anchor and far edge.
    expect(style['maxWidth']).toBe(`${1024 - 34 - 8}px`);
  });

  it('keeps a minimum usable height even with almost no room', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    stubTriggerRect(f, { top: 750, bottom: 760, left: 20, right: 100 });
    open(f);
    // 750 - 6 - 8 = 736 above… so force the other side: a trigger at the very
    // top has 8px above and the panel opens below with the floor applied.
    const g2 = await setup({ maxVisible: 3, moreDropdown: true });
    (trigger(g2) as HTMLElement).getBoundingClientRect = () =>
      ({ top: 0, bottom: 766, left: 20, right: 100, width: 80, height: 766 }) as DOMRect;
    open(g2);
    expect(g2.componentInstance.panelStyle()['maxHeight']).toBe('160px');
  });

  it('tracks the trigger when an ancestor scrolls', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    stubTriggerRect(f, { top: 40, bottom: 60, left: 20, right: 100 });
    open(f);
    expect(f.componentInstance.panelStyle()['top']).toBe('66px');

    stubTriggerRect(f, { top: 140, bottom: 160, left: 20, right: 100 });
    window.dispatchEvent(new Event('scroll'));
    await until(() => f.componentInstance.panelStyle()['top'] === '166px', {
      label: 'the panel to follow the trigger',
    });
  });

  it('ignores scroll while it is shut', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    window.dispatchEvent(new Event('scroll'));
    await frames(2);
    expect(f.componentInstance.panelStyle()).toEqual({});
  });

  it('closes on a window resize', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    open(f);
    expect(panel()).not.toBeNull();
    window.dispatchEvent(new Event('resize'));
    f.detectChanges();
    expect(panel()).toBeNull();
  });

  it('gives focus back to the trigger on Escape, but not on a plain close', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    document.body.appendChild(el(f));
    open(f);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(document.activeElement).toBe(trigger(f));

    open(f);
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    f.componentInstance.close();
    f.detectChanges();
    // A close that was not an Escape leaves focus where the user put it.
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('ignores Escape when nothing is open', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(f.componentInstance.open()).toBe(false);
  });

  it('ignores a mousedown inside its own panel', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    open(f);
    panel()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    f.detectChanges();
    expect(panel()).not.toBeNull();
  });

  it('ignores a mousedown on its own trigger', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    open(f);
    trigger(f)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    f.detectChanges();
    expect(panel()).not.toBeNull();
  });
});
