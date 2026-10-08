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
    expect(screen.getByText('Introduction').getAttribute('href')).toBe('#intro');
    expect(screen.getByText('Usage').getAttribute('href')).toBe('#usage');
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
