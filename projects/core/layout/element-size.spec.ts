import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { svElementSize, SV_SIZE_ZERO, type SvSize } from './element-size';

/**
 * ============================================================================
 *  One measurement primitive for overflow decisions — `X-12`
 * ============================================================================
 *
 * ⚠️ jsdom implements neither `ResizeObserver` nor layout, so every rect is zero.
 * The `observe` option exists for exactly this: a test drives the callback by
 * hand, and `getBoundingClientRect` is stubbed where a real number matters.
 */

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  readonly observedOptions: (ResizeObserverOptions | undefined)[] = [];
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(el: Element, options?: ResizeObserverOptions): void {
    this.observed.push(el);
    this.observedOptions.push(options);
  }
  unobserve(): void { /* intentionally empty */ }
  disconnect(): void {
    this.disconnected = true;
  }

  /** Deliver a border-box entry, as the platform would. */
  emit(width: number, height: number): void {
    this.callback(
      [
        {
          borderBoxSize: [{ inlineSize: width, blockSize: height }],
          contentRect: { width: -1, height: -1 },
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  /** Deliver an entry with no `borderBoxSize`, as an older engine would. */
  emitLegacy(width: number, height: number): void {
    this.callback(
      [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function host(el: () => Element | null, throttleMs?: number) {
  TestBed.resetTestingModule();

  @Component({ standalone: true, template: '' })
  class Host {
    readonly size = svElementSize(el, {
      throttleMs,
      observe: (cb) => new FakeResizeObserver(cb) as unknown as ResizeObserver,
    });
  }

  const fixture = TestBed.createComponent(Host);
  // ⚠️ Effects do not run until change detection, so the "first value" claim is
  // about not waiting for the OBSERVER CALLBACK — the measurement lands in the
  // same pass that starts observing, which is before the first paint.
  fixture.detectChanges();
  return fixture.componentInstance;
}

function boxed(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ width, height }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('svElementSize — the first value', () => {
  /**
   * ★ `ResizeObserver` delivers its first entry asynchronously, so a component
   * that waited would render one frame at zero — and for an overflow decision
   * zero means "nothing fits". Every responsive strip would paint its fully
   * collapsed form and expand a frame later.
   */
  it('is measured directly, not waited for', () => {
    const el = boxed(640, 40);
    expect(host(() => el).size()).toEqual({ width: 640, height: 40 });
  });

  it('is zero with no element to measure', () => {
    expect(host(() => null).size()).toEqual(SV_SIZE_ZERO);
  });
});

describe('svElementSize — what "size" means', () => {
  /**
   * ★★ The decision this file exists to protect. `contentRect` excludes padding
   * and border, so a strip measured that way under-reports by exactly its own
   * padding: a tab list with `px-4` decides six tabs fit in the space five
   * occupy. The error scales with the design, so it reads as a spacing bug
   * rather than a measurement one.
   */
  it('prefers the border box over contentRect', () => {
    const el = boxed(100, 20);
    const h = host(() => el);

    // The fake emits `contentRect: { width: -1 }` alongside a real border box —
    // so a reader of the wrong one is unmistakable.
    FakeResizeObserver.instances[0].emit(640, 40);
    vi.advanceTimersByTime(20);

    expect(h.size()).toEqual({ width: 640, height: 40 });
  });

  /** Only reached on an engine with no `borderBoxSize`, where it is all there is. */
  it('falls back to contentRect when there is no border box', () => {
    const el = boxed(100, 20);
    const h = host(() => el);

    FakeResizeObserver.instances[0].emitLegacy(320, 24);
    vi.advanceTimersByTime(20);

    expect(h.size()).toEqual({ width: 320, height: 24 });
  });
});

describe('svElementSize — throttling', () => {
  /** A drag or an animated panel produces many callbacks per frame. */
  it('coalesces a burst into one emission', () => {
    const el = boxed(100, 20);
    const h = host(() => el, 10);
    const observer = FakeResizeObserver.instances[0];

    observer.emit(200, 20);
    observer.emit(300, 20);
    observer.emit(400, 20);
    expect(h.size().width).toBe(100);

    vi.advanceTimersByTime(10);
    expect(h.size().width).toBe(400);
  });

  /**
   * An unchanged size wakes nobody. A strip re-measured because an unrelated
   * container scrolled should cost exactly nothing downstream, and identity is
   * how a `computed` decides whether to propagate.
   */
  it('does not publish an identical size', () => {
    const el = boxed(100, 20);
    const h = host(() => el, 10);
    const before: SvSize = h.size();

    FakeResizeObserver.instances[0].emit(100, 20);
    vi.advanceTimersByTime(10);

    expect(h.size()).toBe(before);
  });

  /** …and a different one does. */
  it('publishes a size that actually changed', () => {
    const el = boxed(100, 20);
    const h = host(() => el, 10);
    const before: SvSize = h.size();

    FakeResizeObserver.instances[0].emit(101, 20);
    vi.advanceTimersByTime(10);

    expect(h.size()).not.toBe(before);
    expect(h.size().width).toBe(101);
  });
});

describe('svElementSize — lifecycle', () => {
  it('observes the element it was given', () => {
    const el = boxed(100, 20);
    host(() => el);
    expect(FakeResizeObserver.instances[0].observed).toEqual([el]);
  });

  it('re-observes when the target changes', () => {
    const first = boxed(100, 20);
    const second = boxed(300, 20);
    const target = signal<Element | null>(first);

    TestBed.resetTestingModule();
    @Component({ standalone: true, template: '' })
    class Host {
      readonly size = svElementSize(() => target(), {
        observe: (cb) => new FakeResizeObserver(cb) as unknown as ResizeObserver,
      });
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.componentInstance.size().width).toBe(100);

    target.set(second);
    fixture.detectChanges();

    expect(fixture.componentInstance.size().width).toBe(300);
    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });

  it('disconnects on destroy, so nothing outlives the component', () => {
    const el = boxed(100, 20);
    TestBed.resetTestingModule();
    @Component({ standalone: true, template: '' })
    class Host {
      readonly size = svElementSize(() => el, {
        observe: (cb) => new FakeResizeObserver(cb) as unknown as ResizeObserver,
      });
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.destroy();

    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });
});

describe('svElementSize — where there is no ResizeObserver', () => {
  /**
   * ★ The server, and any engine without one. Zero means "nothing fits", so a
   * consumer must treat it as "decide later" rather than "collapse everything" —
   * otherwise every prerendered page ships its collapsed form.
   */
  it('reports the direct measurement and observes nothing', () => {
    const el = boxed(640, 40);
    TestBed.resetTestingModule();

    @Component({ standalone: true, template: '' })
    class Host {
      readonly size = svElementSize(() => el, { observe: () => null });
    }

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.componentInstance.size()).toEqual({ width: 640, height: 40 });
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });
});

describe('svElementSize — box option (N-8)', () => {
  function boxedHost(el: Element, box?: 'border-box' | 'content-box') {
    TestBed.resetTestingModule();
    @Component({ standalone: true, template: '' })
    class Host {
      readonly size = svElementSize(() => el, {
        box,
        observe: (cb) => new FakeResizeObserver(cb) as unknown as ResizeObserver,
      });
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function padded(): HTMLElement {
    const el = boxed(200, 100);
    el.style.padding = '10px 20px';
    el.style.borderWidth = '1px';
    el.style.borderStyle = 'solid';
    return el;
  }

  it('defaults to the border box, and asks the observer for it', () => {
    const el = padded();
    const h = boxedHost(el);
    expect(h.size()).toEqual({ width: 200, height: 100 });
    expect(FakeResizeObserver.instances[0].observedOptions[0]).toEqual({ box: 'border-box' });
  });

  it('★ content-box subtracts padding and border from the first measurement', () => {
    const el = padded();
    const h = boxedHost(el, 'content-box');
    // 200 − 2×20 − 2×1, 100 − 2×10 − 2×1
    expect(h.size()).toEqual({ width: 158, height: 78 });
    expect(FakeResizeObserver.instances[0].observedOptions[0]).toEqual({ box: 'content-box' });
  });

  it('content-box reads contentBoxSize from the observer, not the border box', () => {
    const el = padded();
    const h = boxedHost(el, 'content-box');
    const observer = FakeResizeObserver.instances[0];
    observer.callback(
      [
        {
          borderBoxSize: [{ inlineSize: -1, blockSize: -1 }],
          contentBoxSize: [{ inlineSize: 300, blockSize: 50 }],
          contentRect: { width: -1, height: -1 },
        } as unknown as ResizeObserverEntry,
      ],
      observer as unknown as ResizeObserver,
    );
    vi.advanceTimersByTime(20);
    expect(h.size()).toEqual({ width: 300, height: 50 });
  });

  it('content-box falls back to contentRect on an engine with no contentBoxSize', () => {
    const el = padded();
    const h = boxedHost(el, 'content-box');
    FakeResizeObserver.instances[0].emitLegacy(120, 30);
    vi.advanceTimersByTime(20);
    expect(h.size()).toEqual({ width: 120, height: 30 });
  });
});

describe('svElementSize — server DOM robustness', () => {
  /**
   * ★ Effects run during prerender, against the server DOM. An element there
   * may have no working `getBoundingClientRect`; measuring it must report zero
   * rather than throw out of change detection.
   */
  it('reports zero when getBoundingClientRect is not a function', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', { value: undefined, configurable: true });
    let h: { size: () => SvSize } | undefined;
    expect(() => { h = host(() => el); }).not.toThrow();
    expect(h?.size()).toEqual(SV_SIZE_ZERO);
  });

  it('reports zero for content-box too, and never reaches getComputedStyle', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', { value: 'nope', configurable: true });
    const spy = vi.spyOn(window, 'getComputedStyle');
    TestBed.resetTestingModule();
    @Component({ standalone: true, template: '' })
    class Host {
      readonly size = svElementSize(() => el, { box: 'content-box', observe: () => null });
    }
    const fixture = TestBed.createComponent(Host);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.size()).toEqual(SV_SIZE_ZERO);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

