import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * jsdom does not implement `IntersectionObserver`. This fake captures the
 * callback/options and lets a test fire entries by hand — the same harness
 * used in `scroll-spy.spec.ts`, duplicated here because a component spec
 * should not depend on another spec file's internals.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observed: HTMLElement[] = [];
  disconnected = false;

  constructor(
    public readonly callback: IntersectionObserverCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: HTMLElement): void {
    this.observed.push(el);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  unobserve(): void { /* intentionally empty — the double records observe() calls; nothing is torn down */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  fire(el: HTMLElement, isIntersecting: boolean): void {
    this.callback(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
];

/** The component resolves items via `document.getElementById` — give it real targets. */
function mountSections(ids: readonly string[]): void {
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
}

describe('SvAnchorComponent', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    // Spec files share a process, and Angular's automatic between-test teardown
    // is not guaranteed to run in every file that does — so each test starts
    // from a fresh TestBed explicitly, as the sibling specs do.
    TestBed.resetTestingModule();
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
  });

  it('renders a vertical nav link per item by default', async () => {
    mountSections(['intro', 'usage']);
    await render(SvAnchorComponent, { inputs: { items: ITEMS } });

    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(nav.tagName).toBe('NAV');
    expect(screen.getByText('Introduction').getAttribute('href')).toBe(`${location.pathname}#intro`);
    expect(screen.getByText('Usage').getAttribute('href')).toBe(`${location.pathname}#usage`);
  });

  it('renders the horizontal pill layout when orientation is horizontal', async () => {
    mountSections(['intro', 'usage']);
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: ITEMS, orientation: 'horizontal' },
    });

    const link = screen.getByText('Introduction');
    expect(link.className).toContain('rounded-full');
    expect(fixture.nativeElement.querySelector('nav')?.className).toContain('flex-wrap');
  });

  it('marks the section reported as intersecting as active, via aria-current', async () => {
    mountSections(['intro', 'usage']);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS } });

    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > 0);
    const io = FakeIntersectionObserver.instances[0];
    const usageEl = document.getElementById('usage')!;
    io.fire(usageEl, true);

    await untilRendered(fixture, () => screen.getByText('Usage').getAttribute('aria-current') === 'true');
    expect(screen.getByText('Introduction').getAttribute('aria-current')).toBeNull();
  });

  it('emits activeIdChange exactly once per distinct active id', async () => {
    mountSections(['intro', 'usage']);
    const emitted: (string | null)[] = [];
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: ITEMS },
      on: { activeIdChange: (id: string | null) => emitted.push(id) },
    });

    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > 0);
    const io = FakeIntersectionObserver.instances[0];
    const introEl = document.getElementById('intro')!;
    io.fire(introEl, true);
    await untilRendered(fixture, () => emitted.length === 1);

    // Firing the same element intersecting again should not re-emit the same id.
    io.fire(introEl, true);
    fixture.detectChanges();

    expect(emitted).toEqual(['intro']);
  });

  it('jumpTo() scrolls the window when there is no root container', async () => {
    mountSections(['intro', 'usage']);
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => { /* intentionally empty — the spy records the call; jsdom cannot scroll */ });
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS } });

    await fireEvent.click(screen.getByText('Usage'));
    fixture.detectChanges();

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const call = scrollSpy.mock.calls[0][0] as ScrollToOptions;
    expect(call.behavior).toBe('smooth');
    scrollSpy.mockRestore();
  });

  it('jumpTo() scrolls the given root container, offset by the `offset` input, when one is provided', async () => {
    mountSections(['intro', 'usage']);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const containerScrollTo = vi.fn();
    (container as unknown as { scrollTo: typeof containerScrollTo }).scrollTo = containerScrollTo;
    container.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
    container.scrollTop = 40;
    const target = document.getElementById('usage')!;
    target.getBoundingClientRect = () => ({ top: 120 } as DOMRect);

    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: ITEMS, root: container, offset: 20 },
    });

    await fireEvent.click(screen.getByText('Usage'));
    fixture.detectChanges();

    // top(120) - containerTop(0) + containerScrollTop(40) - offset(20) = 140
    expect(containerScrollTo).toHaveBeenCalledWith({ top: 140, behavior: 'smooth' });
  });

  it('does nothing when the target id has no matching element in the document', async () => {
    mountSections(['intro', 'usage']);
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => { /* intentionally empty — the spy records the call; jsdom cannot scroll */ });
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: [{ id: 'missing', label: 'Missing' }] },
    });

    await fireEvent.click(screen.getByText('Missing'));
    fixture.detectChanges();

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it('uses instant scrolling when the user prefers reduced motion', async () => {
    mountSections(['intro', 'usage']);
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => { /* intentionally empty — the spy records the call; jsdom cannot scroll */ });
    // jsdom does not implement `matchMedia` at all — there is nothing to spy on,
    // so the global has to be installed outright and torn down by hand.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true } as MediaQueryList);

    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    await fireEvent.click(screen.getByText('Usage'));
    fixture.detectChanges();

    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    window.matchMedia = originalMatchMedia;
    scrollSpy.mockRestore();
  });
});

describe('SvAnchorComponent — host, name and modified clicks (SR-11)', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    TestBed.resetTestingModule();
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
    mountSections(['intro', 'usage']);
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
  });

  it('renders the host as a block', async () => {
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    expect((fixture.nativeElement as HTMLElement).classList).toContain('block');
  });

  it('names the landmark from ariaLabel, defaulting to "On this page"', async () => {
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeTruthy();

    fixture.componentRef.setInput('ariaLabel', 'API sections');
    fixture.detectChanges();
    expect(screen.getByRole('navigation', { name: 'API sections' })).toBeTruthy();
  });

  it('uses logical borders so the rail line follows the reading direction', async () => {
    await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('border-s');
    expect(nav.className).not.toMatch(/\bborder-l\b/);
    const link = screen.getByText('Usage');
    expect(link.className).toContain('border-s-2');
    expect(link.className).toContain('-ms-px');
  });

  it('takes over a plain click, so the jump can honour the offset', async () => {
    await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    const notCancelled = fireEvent.click(screen.getByText('Usage'));
    expect(notCancelled).toBe(false);
  });

  it('leaves a ⌘/Ctrl/Shift/Alt or middle click to the browser (open in a new tab)', async () => {
    await render(SvAnchorComponent, { inputs: { items: ITEMS } });
    const link = screen.getByText('Usage');
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(fireEvent.click(link, init), JSON.stringify(init)).toBe(true);
    }
  });
});

/**
 * ★★ FL-L5-01: a smooth scroll can stop short, and nothing says so. WebKit
 *    ended the jump early about one time in five while a sticky header grew,
 *    and landed a fractional target a pixel and more under the line; either
 *    way the rail named the section before the one clicked.
 */
describe('SvAnchorComponent — a jump lands, or is finished (FL-L5-01)', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    TestBed.resetTestingModule();
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
  });

  /** A scroller whose `scrollTo` (the `n`th call) moves only as far as `stopAt` lets it. */
  async function jump(stopAt: (top: number, n: number) => number) {
    mountSections(['intro', 'usage']);
    const container = document.createElement('div');
    document.body.appendChild(container);
    Object.defineProperty(container, 'scrollHeight', { value: 2000 });
    Object.defineProperty(container, 'clientHeight', { value: 200 });
    const calls: ScrollToOptions[] = [];
    container.scrollTo = ((options: ScrollToOptions) => {
      container.scrollTop = stopAt(options.top ?? 0, calls.length);
      calls.push(options);
    }) as typeof container.scrollTo;
    container.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
    const target = document.getElementById('usage')!;
    // The section moves with the scroller, as it does on a page.
    target.getBoundingClientRect = () => ({ top: 300.4 - container.scrollTop } as DOMRect);

    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS, root: container, offset: 20 } });
    vi.useFakeTimers();
    await fireEvent.click(screen.getByText('Usage'));
    fixture.detectChanges();
    return { calls, container, fixture };
  }

  it('rounds the landing up, so the heading is never left under the line', async () => {
    const { calls } = await jump((top) => top);
    // 300.4 - 20 = 280.4: rounded UP to 281, not to the 280 that leaves it 0.4px below.
    expect(calls[0]).toEqual({ top: 281, behavior: 'smooth' });
  });

  it('finishes a jump that stopped short, when scrolling has settled', async () => {
    const { calls, container } = await jump((top, n) => (n === 0 ? Math.min(top, 149) : top));
    expect(container.scrollTop).toBe(149);
    vi.advanceTimersByTime(250);
    expect(calls.at(-1)).toEqual({ top: 281, behavior: 'auto' });
    expect(container.scrollTop).toBe(281);
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(2);
  });

  it('gives up after a few corrections on a page that will not hold still', async () => {
    const { calls } = await jump((top) => top - 50);
    vi.advanceTimersByTime(5000);
    expect(calls).toHaveLength(4); // the jump and three corrections
  });

  it('leaves a landing that arrived alone', async () => {
    const { calls } = await jump((top) => top);
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(1);
  });

  it('never fights the reader: a wheel during the jump cancels the correction', async () => {
    const { calls } = await jump((top, n) => (n === 0 ? Math.min(top, 149) : top));
    window.dispatchEvent(new WheelEvent('wheel'));
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(1);
  });
});

/**
 * ★ FL-A8-06: a header that is still growing when the scroll stops. WebKit on a
 *   loaded CI runner checked the landing inside the frame or more that
 *   `resolvedOffset` trails the header by, found it right against the old
 *   height, and stopped; the header then grew 25 px over the section.
 */
describe('SvAnchorComponent — a jump follows a header that grows after it (FL-A8-06)', () => {
  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    readonly observed: Element[] = [];
    constructor(readonly callback: ResizeObserverCallback) {
      FakeResizeObserver.instances.push(this);
    }
    observe(el: Element): void {
      this.observed.push(el);
    }
    disconnect(): void {
      this.observed.length = 0;
    }
    unobserve(): void { /* not used by the component */ }
    /** A resize with no entries: the header moved, the size signal has not caught up. */
    nudge(): void {
      this.callback([], this as unknown as ResizeObserver);
    }
  }

  let originalIO: typeof IntersectionObserver | undefined;
  let originalRO: typeof ResizeObserver | undefined;

  beforeEach(() => {
    TestBed.resetTestingModule();
    originalIO = globalThis.IntersectionObserver;
    originalRO = globalThis.ResizeObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    FakeIntersectionObserver.instances = [];
    FakeResizeObserver.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    globalThis.ResizeObserver = originalRO as typeof ResizeObserver;
    document.body.innerHTML = '';
  });

  async function jumpUnder(header: { height: number }) {
    mountSections(['intro', 'usage']);
    const container = document.createElement('div');
    const bar = document.createElement('div');
    container.appendChild(bar);
    document.body.appendChild(container);
    Object.defineProperty(container, 'scrollHeight', { value: 2000 });
    Object.defineProperty(container, 'clientHeight', { value: 200 });
    bar.getBoundingClientRect = () => ({ top: 0, width: 400, height: header.height }) as DOMRect;
    const calls: ScrollToOptions[] = [];
    container.scrollTo = ((options: ScrollToOptions) => {
      container.scrollTop = options.top ?? 0;
      calls.push(options);
    }) as typeof container.scrollTo;
    container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    const target = document.getElementById('usage')!;
    target.getBoundingClientRect = () => ({ top: 300.4 - container.scrollTop }) as DOMRect;

    await render(SvAnchorComponent, { inputs: { items: ITEMS, root: container, offsetFrom: bar } });
    vi.useFakeTimers();
    await fireEvent.click(screen.getByText('Usage'));
    // The settle watch is the observer created by the click, watching the header.
    const watch = FakeResizeObserver.instances.at(-1)!;
    expect(watch.observed).toEqual([bar]);
    return { calls, watch, first: calls[0].top! };
  }

  it('measures the header itself when it checks the landing, not the size signal', async () => {
    const header = { height: 20 };
    const { calls, watch, first } = await jumpUnder(header);
    header.height = 45;
    watch.nudge();
    vi.advanceTimersByTime(250);
    // 300.4 − 45 = 255.4, rounded up — whatever the signal said at the click.
    expect(calls.at(-1)).toEqual({ top: 256, behavior: 'auto' });
    expect(first).not.toBe(256);
  });

  it('waits for the header to stop growing, and corrects once', async () => {
    const header = { height: 20 };
    const { calls, watch } = await jumpUnder(header);
    vi.advanceTimersByTime(150);
    header.height = 30;
    watch.nudge();
    vi.advanceTimersByTime(150);
    header.height = 45;
    watch.nudge();
    // Still inside the idle window the last resize opened: nothing checked yet.
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(250);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ top: 256, behavior: 'auto' });
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(2);
    // Settled: the watch is let go.
    expect(watch.observed).toEqual([]);
  });
});
