import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * ============================================================================
 *  Measured offsets and a page that settles late — `X-12`, `NV-02-I4`, `NV-02-M4`
 * ============================================================================
 *
 * ★ `NV-02-I4`: a NUMBER cannot describe a header that changes height. `offset`
 * was supported and never observed, so a sticky header that shrinks on scroll —
 * the standard pattern — invalidated it the moment the user scrolled. Every jump
 * after the first landed a little wrong, and the error changed as they scrolled.
 *
 * ★★ And it feeds the ACTIVE BAND, not just the jump. The scrollspy measures from
 * the top of the viewport, so a 64px header means the top 64px of the "active"
 * band is underneath it — a section is marked current while it is still hidden
 * behind the header. Fixing the jump and leaving the band is fixing the half you
 * can see.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed: Element[] = [];
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  disconnect(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  disconnect(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  emit(width: number, height: number): void {
    this.callback(
      [
        {
          borderBoxSize: [{ inlineSize: width, blockSize: height }],
          contentRect: { width, height },
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

const ITEMS: readonly AnchorItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
];

function sized(tag: string, height: number): HTMLElement {
  const el = document.createElement(tag);
  el.getBoundingClientRect = () => ({ width: 1000, height, top: 0 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function mountSections(): void {
  for (const item of ITEMS) {
    const el = document.createElement('div');
    el.id = item.id;
    el.getBoundingClientRect = () => ({ top: 500, width: 1000, height: 200 }) as DOMRect;
    document.body.appendChild(el);
  }
}

describe('SvAnchorComponent — a measured offset', () => {
  let ioOriginal: typeof IntersectionObserver | undefined;
  let roOriginal: typeof ResizeObserver | undefined;

  beforeEach(() => {
    ioOriginal = globalThis.IntersectionObserver;
    roOriginal = globalThis.ResizeObserver;
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    FakeIntersectionObserver.instances = [];
    FakeResizeObserver.instances = [];
    vi.spyOn(window, 'scrollTo').mockImplementation(() => { /* jsdom cannot scroll */ });
  });

  afterEach(() => {
    globalThis.IntersectionObserver = ioOriginal as typeof IntersectionObserver;
    globalThis.ResizeObserver = roOriginal as typeof ResizeObserver;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function setup(inputs: Record<string, unknown> = {}) {
    mountSections();
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: ITEMS, ...inputs } });
    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > 0);
    return fixture;
  }

  it('uses the number when no header is named', async () => {
    const f = await setup({ offset: 40 });
    expect(f.componentInstance.resolvedOffset()).toBe(40);
  });

  /** ★ The measured header wins over the static number, because it is current. */
  it('measures the header instead of trusting the number', async () => {
    const header = sized('header', 64);
    const f = await setup({ offset: 40, offsetFrom: header });

    expect(f.componentInstance.resolvedOffset()).toBe(64);
  });

  /** ★ …and follows it. This is the half a static number cannot do at all. */
  it('follows the header as it shrinks on scroll', async () => {
    const header = sized('header', 64);
    const f = await setup({ offsetFrom: header });
    expect(f.componentInstance.resolvedOffset()).toBe(64);

    FakeResizeObserver.instances[0].emit(1000, 32);
    await untilRendered(f, () => f.componentInstance.resolvedOffset() === 32);

    expect(f.componentInstance.resolvedOffset()).toBe(32);
  });

  /**
   * ★★ The band, not just the jump. The top edge moves by exactly the header's
   * height; the bottom stays at -68%, the classic trick that biases "current"
   * toward the top of the viewport.
   */
  it('pushes the scrollspy`s active band below the header', async () => {
    const header = sized('header', 64);
    await setup({ offsetFrom: header });

    const observer = FakeIntersectionObserver.instances.at(-1)!;
    expect(observer.options?.rootMargin).toBe('-64px 0px -68% 0px');
  });

  it('starts the band at the top when there is no header', async () => {
    await setup();
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    expect(observer.options?.rootMargin).toBe('-0px 0px -68% 0px');
  });

  /** The jump keeps using it too — one offset, both consumers. */
  it('applies the measured offset to a jump', async () => {
    const header = sized('header', 64);
    const f = await setup({ offsetFrom: header });

    f.componentInstance.jumpTo('usage');

    const [arg] = (window.scrollTo as unknown as { mock: { calls: [ScrollToOptions][] } })
      .mock.calls[0];
    expect(arg.top).toBe(500 - 64);
  });

  /**
   * ★ `NV-02-I8`. The container's own box does not grow with its content — an
   * `<html>` pinned by `h-full`, a fixed-height `root` — so watching it alone
   * missed a section that rendered late. The content is watched too.
   */
  it('tracks a section that renders after the page settled, once the content grows', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const items = [...ITEMS, { id: 'late', label: 'Late' }];
    const f = await setup({ items });
    await TestBed.inject(ApplicationRef).whenStable();
    await untilRendered(f, () => true);

    const late = document.createElement('div');
    late.id = 'late';
    document.body.appendChild(late);
    f.detectChanges();
    const tracked = () => FakeIntersectionObserver.instances.some(io => io.observed.includes(late));
    expect(tracked()).toBe(false);

    const content = FakeResizeObserver.instances.find(ro => ro.observed.includes(document.body));
    expect(content).toBeDefined();
    content!.emit(1000, 4000);
    await untilRendered(f, tracked, { label: 'the late section to be tracked' });

    expect(tracked()).toBe(true);
  });
});
