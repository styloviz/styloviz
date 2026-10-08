import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvItemsWithMoreComponent } from './items-with-more.component';

/**
 * The `inline` more-variant, which decides between "…and 3 more" and the full
 * list by measuring a hidden span against its container, plus the frame
 * bookkeeping around scroll and destroy.
 *
 * ★ EVERY MEASUREMENT HERE IS AN EXPLICIT STUB. jsdom has no layout:
 * `clientWidth` and `offsetWidth` are 0 for everything and `ResizeObserver`
 * does not exist. Left alone, the component would take exactly one path — the
 * "both zero, so this subtree is not laid out" guard — and none of the real
 * decisions would run. Each stub below says which layout it stands in for.
 */

const ITEMS = ['Design', 'Engineering', 'Marketing', 'Sales', 'Support'];

type ROEntry = { contentRect: { width: number } };
class FakeResizeObserver {
  static live: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly cb: (entries: ROEntry[]) => void) {
    FakeResizeObserver.live.push(this);
  }
  observe(target: Element): void {
    this.observed.push(target);
  }
  unobserve(): void {
    /* not exercised */
  }
  disconnect(): void {
    this.observed.length = 0;
  }
  /** Fire with a contentRect, or with nothing at all (the `entries[0]?` path). */
  fire(width?: number): void {
    this.cb(width === undefined ? [] : [{ contentRect: { width } }]);
  }
}

const g = globalThis as unknown as { ResizeObserver?: unknown };
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function setup(inputs: Partial<ComponentInput<SvItemsWithMoreComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvItemsWithMoreComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvItemsWithMoreComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

/** Pretend the host is `containerW` wide and the hidden span `textW` wide. */
function stubWidths(host: HTMLElement, containerW: number, textW: number): void {
  Object.defineProperty(host, 'clientWidth', { value: containerW, configurable: true });
  const measure = host.querySelector('[data-inline-measure]') as HTMLElement | null;
  if (measure) {
    Object.defineProperty(measure, 'offsetWidth', { value: textW, configurable: true });
  }
}

describe('SvItemsWithMoreComponent — the inline variant', () => {
  let original: unknown;
  beforeEach(() => {
    original = g.ResizeObserver;
    FakeResizeObserver.live = [];
    g.ResizeObserver = FakeResizeObserver;
  });
  afterEach(() => {
    g.ResizeObserver = original;
  });

  it('watches the host for width changes', async () => {
    const f = await setup({ moreVariant: 'inline' });
    const ro = FakeResizeObserver.live.at(-1)!;
    expect(ro.observed).toContain(el(f));
  });

  it('reports that everything fits when the span is narrower than the container', async () => {
    const f = await setup({ moreVariant: 'inline' });
    stubWidths(el(f), 800, 400); // a wide row: all five names on one line
    FakeResizeObserver.live.at(-1)!.fire(800);
    await nextFrame();
    f.detectChanges();
    expect(f.componentInstance._inlineFits()).toBe(true);
  });

  it('reports that it does not fit when the span is wider than the container', async () => {
    const f = await setup({ moreVariant: 'inline' });
    stubWidths(el(f), 200, 640); // a narrow column
    FakeResizeObserver.live.at(-1)!.fire(200);
    await nextFrame();
    f.detectChanges();
    expect(f.componentInstance._inlineFits()).toBe(false);
  });

  it('drops the reader’s expansion once the container is wide enough again', async () => {
    const f = await setup({ moreVariant: 'inline' });
    stubWidths(el(f), 200, 640);
    FakeResizeObserver.live.at(-1)!.fire(200);
    await nextFrame();
    f.detectChanges();

    f.componentInstance.inlineExpanded.set(true);
    stubWidths(el(f), 900, 640); // the sidebar was widened
    FakeResizeObserver.live.at(-1)!.fire(900);
    await nextFrame();
    f.detectChanges();

    expect(f.componentInstance._inlineFits()).toBe(true);
    expect(f.componentInstance.inlineExpanded()).toBe(false);
  });

  it('keeps the expansion while the list still does not fit', async () => {
    const f = await setup({ moreVariant: 'inline' });
    f.componentInstance.inlineExpanded.set(true);
    stubWidths(el(f), 200, 640);
    FakeResizeObserver.live.at(-1)!.fire(200);
    await nextFrame();
    f.detectChanges();
    // Assert the negative: a "Show less" the user opened must survive a resize
    // that did not actually make room.
    expect(f.componentInstance.inlineExpanded()).toBe(true);
  });

  it('keeps the expansion when the subtree is not being laid out at all', async () => {
    // ★ The both-zero case, which is what a hidden tab panel reports in a real
    // browser (verified in Chromium). `0 <= 0` would read as "it all fits" and
    // silently collapse a sentence the reader had opened.
    const f = await setup({ moreVariant: 'inline' });
    f.componentInstance.inlineExpanded.set(true);
    stubWidths(el(f), 0, 0);
    FakeResizeObserver.live.at(-1)!.fire(0);
    await nextFrame();
    f.detectChanges();
    expect(f.componentInstance.inlineExpanded()).toBe(true);
  });

  it('coalesces a burst of resizes into one measurement', async () => {
    const f = await setup({ moreVariant: 'inline' });
    const host = el(f);
    let reads = 0;
    Object.defineProperty(host, 'clientWidth', {
      get: () => {
        reads++;
        return 800;
      },
      configurable: true,
    });
    const measure = host.querySelector('[data-inline-measure]') as HTMLElement;
    Object.defineProperty(measure, 'offsetWidth', { value: 400, configurable: true });

    const ro = FakeResizeObserver.live.at(-1)!;
    ro.fire(800);
    ro.fire(801);
    ro.fire(802);
    await nextFrame();
    f.detectChanges();
    expect(reads).toBe(1);
  });

  it('measures again on the next frame once the pending one has run', async () => {
    const f = await setup({ moreVariant: 'inline' });
    const host = el(f);
    let reads = 0;
    Object.defineProperty(host, 'clientWidth', {
      get: () => {
        reads++;
        return 800;
      },
      configurable: true,
    });
    const ro = FakeResizeObserver.live.at(-1)!;
    ro.fire(800);
    await nextFrame();
    const afterFirst = reads;
    expect(afterFirst).toBeGreaterThan(0);

    ro.fire(900);
    await nextFrame();
    // The gate must re-open: a component that measured only once would be
    // frozen at whatever width it first saw.
    expect(reads).toBeGreaterThan(afterFirst);
  });

  it('does nothing when the hidden measuring span is not in the DOM', async () => {
    // The span lives inside the same subtree; a host that has been emptied
    // (a structural directive tearing down around it) must not throw here.
    const f = await setup({ moreVariant: 'inline' });
    const host = el(f);
    host.querySelector('[data-inline-measure]')?.remove();
    Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true });
    const before = f.componentInstance._inlineFits();

    expect(() => FakeResizeObserver.live.at(-1)!.fire(800)).not.toThrow();
    await nextFrame();
    expect(f.componentInstance._inlineFits()).toBe(before);
  });

  it('falls back to the host width when the observer reports no entries', async () => {
    // A ResizeObserver callback with an empty entry list is legal; reading
    // `entries[0].contentRect` would throw inside the observer, where nothing
    // can catch it.
    const f = await setup({ autoOverflow: true });
    const host = el(f);
    Object.defineProperty(host, 'offsetWidth', { value: 640, configurable: true });
    expect(() => FakeResizeObserver.live.at(-1)!.fire()).not.toThrow();
    await nextFrame();
  });
});

describe('SvItemsWithMoreComponent — frame bookkeeping', () => {
  let original: unknown;
  beforeEach(() => {
    original = g.ResizeObserver;
    FakeResizeObserver.live = [];
    g.ResizeObserver = FakeResizeObserver;
  });
  afterEach(() => {
    g.ResizeObserver = original;
    document.querySelectorAll('.sv-dropdown-portal').forEach((n) => n.remove());
  });

  it('coalesces a burst of scrolls while the panel is open', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    f.componentInstance.onMoreClick();
    f.detectChanges();

    const host = el(f);
    const t = host.querySelector('[data-trigger]') as HTMLElement;
    let measurements = 0;
    // ★ An explicit rect: the COUNT is under test, not the geometry.
    const r = { top: 10, bottom: 40, left: 5, right: 105, width: 100, height: 30, x: 5, y: 10 };
    t.getBoundingClientRect = () => {
      measurements++;
      return { ...r, toJSON: () => r } as DOMRect;
    };

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(measurements).toBe(1);
  });

  it('does not reposition for a frame that lands after the panel closed', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true });
    f.componentInstance.onMoreClick();
    f.detectChanges();

    const host = el(f);
    const t = host.querySelector('[data-trigger]') as HTMLElement;
    let measurements = 0;
    const r = { top: 10, bottom: 40, left: 5, right: 105, width: 100, height: 30, x: 5, y: 10 };
    t.getBoundingClientRect = () => {
      measurements++;
      return { ...r, toJSON: () => r } as DOMRect;
    };

    window.dispatchEvent(new Event('scroll'));
    f.componentInstance.close();
    f.detectChanges();
    await nextFrame();
    expect(measurements).toBe(0);
  });

  it('coalesces resize-driven recalculations too', async () => {
    const f = await setup({ autoOverflow: true });
    const host = el(f);
    let reads = 0;
    Object.defineProperty(host, 'clientWidth', {
      get: () => {
        reads++;
        return 400;
      },
      configurable: true,
    });
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    await nextFrame();
    // One recalculation for two resizes; the exact read count is not the
    // point, only that the second resize did not queue a second frame.
    const afterFirst = reads;
    await nextFrame();
    expect(reads).toBe(afterFirst);
  });

  it('cancels every queued frame when it is destroyed', async () => {
    const f = await setup({ maxVisible: 3, moreDropdown: true, autoOverflow: true });
    f.componentInstance.onMoreClick();
    f.detectChanges();
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    FakeResizeObserver.live.at(-1)?.fire(300);

    expect(() => f.destroy()).not.toThrow();
    await nextFrame();
    expect(document.querySelector('.sv-dropdown-portal')).toBeNull();
  });
});

describe('SvItemsWithMoreComponent — every variant names what is hidden (DD-18-M2)', () => {
  let original: unknown;
  beforeEach(() => {
    original = g.ResizeObserver;
    FakeResizeObserver.live = [];
    g.ResizeObserver = FakeResizeObserver;
  });
  afterEach(() => {
    g.ResizeObserver = original;
  });

  it.each(['badge', 'chip', 'text'] as const)(
    '%s: the trigger’s accessible name lists the hidden items',
    async (moreVariant) => {
      const f = await setup({ moreVariant, maxVisible: 3 });
      const button = el(f).querySelector<HTMLButtonElement>('button[aria-label]')!;
      expect(button).toBeTruthy();
      expect(button.textContent?.trim()).toBe('+2 more');
      expect(button.getAttribute('aria-label')).toBe('Show 2 more items: Sales, Support');
    },
  );

  it('inline: the "+N more" toggle names the hidden items, and drops the label once expanded', async () => {
    const f = await setup({ moreVariant: 'inline', maxVisible: 3 });
    stubWidths(el(f), 200, 640); // a narrow column: the sentence does not fit
    FakeResizeObserver.live.at(-1)!.fire(200);
    await nextFrame();
    f.detectChanges();

    const button = el(f).querySelector<HTMLButtonElement>('p button')!;
    expect(button.textContent?.trim()).toBe('+2 more');
    expect(button.getAttribute('aria-label')).toBe('Show 2 more items: Sales, Support');

    button.click();
    f.detectChanges();
    // "Less" is already an honest name; a stale list of names would not be.
    expect(button.textContent?.trim()).toBe('Less');
    expect(button.hasAttribute('aria-label')).toBe(false);
  });
});

describe('SvItemsWithMoreComponent — inline widening focus rescue (DD-18-I1)', () => {
  let original: unknown;
  beforeEach(() => {
    original = g.ResizeObserver;
    FakeResizeObserver.live = [];
    g.ResizeObserver = FakeResizeObserver;
  });
  afterEach(() => {
    g.ResizeObserver = original;
  });

  it('lands focus on the component, not <body>, when widening removes the focused toggle', async () => {
    const f = await setup({ moreVariant: 'inline', maxVisible: 3 });
    stubWidths(el(f), 200, 640);
    FakeResizeObserver.live.at(-1)!.fire(200);
    await nextFrame();
    f.detectChanges();

    const button = el(f).querySelector<HTMLButtonElement>('p button')!;
    button.focus();
    expect(document.activeElement).toBe(button);

    // The sidebar closed: the whole sentence now fits and the toggle is destroyed.
    stubWidths(el(f), 900, 640);
    FakeResizeObserver.live.at(-1)!.fire(900);
    await nextFrame();
    f.detectChanges();
    await Promise.resolve();
    f.detectChanges();
    await Promise.resolve();
    f.detectChanges();

    expect(el(f).querySelector('p button')).toBeNull();
    expect(document.activeElement).toBe(el(f));
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('All 5 items now fit');
  });
});
