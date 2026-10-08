import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SvScrollAreaComponent, type ScrollAreaTabStop } from './scroll-area.component';
import { svLogicalScrollStart, svPhysicalScrollLeft, type SvRtlScrollType } from './scroll-area.geometry';

/**
 * `sv-scroll-area` — the Layout & Utilities P1 pass (`LU-06`).
 *
 *  - I1/M1: dynamic content re-measures with no scroll event (`svElementSize`
 *    on the viewport and on the content, `X-4`), and `measure()` stays the
 *    manual contract when observation is off.
 *  - I2/M2: the region is a tab stop only while it can scroll, with an
 *    explicit `tabStop` override.
 *  - I3/M3: horizontal `scrollLeft` is normalised for RTL, so the thumb, the
 *    fades and track paging all work from the INLINE start.
 *
 * ★★★ And the one thing none of this may cost: the element still scrolls
 *     natively — no transform, no `overflow: hidden`.
 */

@Component({
  standalone: true,
  imports: [SvScrollAreaComponent],
  template: `
    <div [attr.dir]="dir()">
      <sv-scroll-area
        [orientation]="orientation()"
        [observeContent]="observe()"
        [tabStop]="tabStop()"
        variant="always"
        (scrolled)="seen.push($event)"
      ><p>Body</p></sv-scroll-area>
    </div>
  `,
})
class HostComponent {
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
  readonly observe = signal(true);
  readonly tabStop = signal<ScrollAreaTabStop>('auto');
  readonly seen: number[] = [];
}

interface Setup {
  dir?: 'ltr' | 'rtl';
  orientation?: 'vertical' | 'horizontal';
  observe?: boolean;
  tabStop?: ScrollAreaTabStop;
}

function setup(o: Setup = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  const host = fixture.componentInstance;
  if (o.dir) host.dir.set(o.dir);
  if (o.orientation) host.orientation.set(o.orientation);
  if (o.observe !== undefined) host.observe.set(o.observe);
  if (o.tabStop) host.tabStop.set(o.tabStop);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const area = fixture.debugElement.query((d) => d.name === 'sv-scroll-area').componentInstance as SvScrollAreaComponent;
  return { fixture, host, q, area, port: q('[data-sv-port]') as HTMLElement };
}

/** jsdom lays nothing out, so the dimensions a browser would report are stubbed on the element. */
function box(port: HTMLElement, dims: Partial<Record<'clientHeight' | 'scrollHeight' | 'clientWidth' | 'scrollWidth' | 'scrollTop' | 'scrollLeft', number>>) {
  for (const [key, value] of Object.entries(dims)) {
    Object.defineProperty(port, key, { value, writable: true, configurable: true });
  }
}

/** A controllable ResizeObserver, installed as the global `svElementSize` reaches for. */
function fakeResizeObserver() {
  const created: { callback: ResizeObserverCallback; targets: Element[]; disconnected: boolean }[] = [];
  class FakeRO {
    private readonly rec: (typeof created)[number];
    constructor(callback: ResizeObserverCallback) {
      this.rec = { callback, targets: [], disconnected: false };
      created.push(this.rec);
    }
    observe(el: Element): void { this.rec.targets.push(el); }
    unobserve(): void { /* not used */ }
    disconnect(): void { this.rec.disconnected = true; }
  }
  vi.stubGlobal('ResizeObserver', FakeRO);
  /** Report a new border box for whichever observed element matches `target`. */
  const fire = (target: Element, width: number, height: number) => {
    for (const rec of created) {
      if (rec.disconnected || !rec.targets.includes(target)) continue;
      rec.callback(
        [{ target, borderBoxSize: [{ inlineSize: width, blockSize: height }], contentRect: { width, height } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    }
  };
  return { created, fire };
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const trackRect = (el: HTMLElement, width: number, height: number) => {
  el.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: height, right: width, width, height, x: 0, y: 0, toJSON: () => ({}) });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

// ── I1 / M1 — dynamic content, no scroll event ─────────────────────────────

describe('SvScrollAreaComponent — content observation (LU-06-I1/M1, X-4)', () => {
  it('measures after the first render — the thumb is there before anyone scrolls', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sv-port') ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sv-port') ? 800 : 0;
    });
    const v = setup();
    v.fixture.detectChanges();
    expect(v.q('[data-sv-thumb]')?.style.height).toBe('200px');
  });

  it('observes both the viewport and the content box', () => {
    const ro = fakeResizeObserver();
    const v = setup();
    const targets = ro.created.flatMap((r) => r.targets);
    expect(targets).toContain(v.port);
    expect(targets).toContain(v.q('[data-sv-content]'));
  });

  it('re-measures when the content grows with no scroll event', async () => {
    const ro = fakeResizeObserver();
    const v = setup();
    box(v.port, { clientHeight: 400, scrollHeight: 300 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.q('[data-sv-thumb]')).toBeNull();

    // Rows arrive. Nobody scrolls; nobody calls measure().
    box(v.port, { scrollHeight: 1600 });
    ro.fire(v.q('[data-sv-content]')!, 300, 1600);
    await frame();
    v.fixture.detectChanges();

    expect(v.q('[data-sv-thumb]')?.style.height).toBe('100px');
    expect(v.port.getAttribute('tabindex')).toBe('0');
  });

  it('with observeContent off, observes nothing and waits for measure()', async () => {
    const ro = fakeResizeObserver();
    const v = setup({ observe: false });
    expect(ro.created.filter((r) => !r.disconnected && r.targets.length)).toHaveLength(0);

    box(v.port, { clientHeight: 400, scrollHeight: 1600 });
    v.fixture.detectChanges();
    expect(v.q('[data-sv-thumb]')).toBeNull();

    v.area.measure();
    v.fixture.detectChanges();
    expect(v.q('[data-sv-thumb]')).toBeTruthy();
  });

  it('disconnects its observers with the component', () => {
    const ro = fakeResizeObserver();
    const v = setup();
    v.fixture.destroy();
    expect(ro.created.every((r) => r.disconnected)).toBe(true);
  });
});

// ── I2 / M2 — a tab stop only when scrollable ──────────────────────────────

describe('SvScrollAreaComponent — conditional tab stop (LU-06-I2/M2)', () => {
  it('is not a tab stop while everything fits', () => {
    const v = setup();
    box(v.port, { clientHeight: 400, scrollHeight: 300 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.hasAttribute('tabindex')).toBe(false);
    // Still a named-able region for AT; only the empty tab stop is gone.
    expect(v.port.getAttribute('role')).toBe('region');
  });

  it('becomes a tab stop once the content overflows', () => {
    const v = setup();
    box(v.port, { clientHeight: 400, scrollHeight: 900 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.getAttribute('tabindex')).toBe('0');
  });

  it('stays a tab stop while it holds focus, even if the content shrinks under it', () => {
    const v = setup();
    box(v.port, { clientHeight: 400, scrollHeight: 900 });
    v.area.measure();
    v.fixture.detectChanges();
    v.port.focus();
    v.fixture.detectChanges();
    expect(document.activeElement).toBe(v.port);

    box(v.port, { scrollHeight: 300 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(v.port);

    v.port.blur();
    v.fixture.detectChanges();
    expect(v.port.hasAttribute('tabindex')).toBe(false);
  });

  it("tabStop 'always' keeps the old unconditional stop", () => {
    const v = setup({ tabStop: 'always' });
    expect(v.port.getAttribute('tabindex')).toBe('0');
  });

  it('stays a tab stop for a wide table in a short vertical area — x overflow counts too', () => {
    const v = setup();
    // Fits vertically, overflows horizontally: native x scrolling still works,
    // so the keyboard must still be able to reach it.
    box(v.port, { clientHeight: 400, scrollHeight: 300, clientWidth: 400, scrollWidth: 1200 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.getAttribute('tabindex')).toBe('0');

    box(v.port, { scrollWidth: 400 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.hasAttribute('tabindex')).toBe(false);
  });

  it('a horizontal area that fits sideways but overflows vertically is still a tab stop', () => {
    const v = setup({ orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 400, clientHeight: 200, scrollHeight: 900 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.getAttribute('tabindex')).toBe('0');
  });

  it("tabStop 'never' drops it even when scrollable", () => {
    const v = setup({ tabStop: 'never' });
    box(v.port, { clientHeight: 400, scrollHeight: 900 });
    v.area.measure();
    v.fixture.detectChanges();
    expect(v.port.hasAttribute('tabindex')).toBe(false);
  });
});

// ── I3 / M3 — RTL ───────────────────────────────────────────────────────────

describe('svLogicalScrollStart / svPhysicalScrollLeft — every engine convention (LU-06-M3)', () => {
  const cases: [SvRtlScrollType, number][] = [
    ['negative', -150], // spec: 0 at the start, negative towards the left
    ['reverse', 150], //   legacy Edge: positive from the start
    ['default', 450], //   legacy Chrome: 0 at the physical LEFT (the end)
  ];

  for (const [type, raw] of cases) {
    it(`reads 150px from the inline start under '${type}', and writes it back`, () => {
      expect(svLogicalScrollStart(raw, 600, true, type)).toBe(150);
      expect(svPhysicalScrollLeft(150, 600, true, type)).toBe(raw);
    });
  }

  it('is the identity in LTR, clamped to the scrollable range', () => {
    expect(svLogicalScrollStart(150, 600, false)).toBe(150);
    expect(svLogicalScrollStart(-20, 600, false)).toBe(0);
    expect(svPhysicalScrollLeft(900, 600, false)).toBe(600);
  });

  it('never writes -0 at the start', () => {
    expect(Object.is(svPhysicalScrollLeft(0, 600, true, 'negative'), 0)).toBe(true);
  });
});

describe('SvScrollAreaComponent — horizontal and RTL (LU-06-I3/M3)', () => {
  it('scrolls natively on the x axis — no transform, no overflow-hidden', () => {
    const v = setup({ orientation: 'horizontal' });
    expect(v.port.className).toContain('overflow-x-auto');
    expect(v.port.className).not.toContain('overflow-hidden');
    expect(v.port.style.transform).toBe('');
  });

  it('draws the vertical track on the inline END, so RTL puts it on the left like a native bar', () => {
    const v = setup();
    box(v.port, { clientHeight: 400, scrollHeight: 900 });
    v.area.measure();
    v.fixture.detectChanges();
    const track = v.q('[data-sv-track]')!;
    expect(track.className).toContain('end-0.5');
    expect(track.className).not.toMatch(/\bright-/);
  });

  it('reads a negative RTL scrollLeft as a positive distance from the inline start', () => {
    const v = setup({ dir: 'rtl', orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: -300 });
    v.port.dispatchEvent(new Event('scroll'));
    v.fixture.detectChanges();

    expect(v.area.scrollStart()).toBe(300);
    expect(v.host.seen).toEqual([300]);
    // Half-way: progress 0.5 of a 240px travel (400 − 160 thumb), from the INLINE start.
    const thumb = v.q('[data-sv-thumb]')!;
    expect(thumb.style.width).toBe('160px');
    expect(thumb.getAttribute('style')).toContain('inset-inline-start: 120px');
    expect(v.q('[data-sv-fade-start]')).toBeTruthy();
    expect(v.q('[data-sv-fade-end]')).toBeTruthy();
  });

  it('at the RTL start (scrollLeft 0) fades only the far (inline-end) edge', () => {
    const v = setup({ dir: 'rtl', orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: 0 });
    v.port.dispatchEvent(new Event('scroll'));
    v.fixture.detectChanges();
    expect(v.q('[data-sv-fade-start]')).toBeNull();
    expect(v.q('[data-sv-fade-end]')?.className).toContain('end-0');
  });

  it('pages FORWARD when the track is pressed on the physical left in RTL (the logical end)', () => {
    const v = setup({ dir: 'rtl', orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: -100 });
    v.port.dispatchEvent(new Event('scroll'));
    v.fixture.detectChanges();

    const track = v.q('[data-sv-track]')!;
    trackRect(track, 400, 8);
    track.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10 }));
    expect(v.port.scrollLeft).toBe(-500);
  });

  it('pages BACK when pressed on the physical right in RTL (the logical start), and stops at 0', () => {
    const v = setup({ dir: 'rtl', orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: -600 });
    v.port.dispatchEvent(new Event('scroll'));
    v.fixture.detectChanges();

    const track = v.q('[data-sv-track]')!;
    trackRect(track, 400, 8);
    track.dispatchEvent(new MouseEvent('pointerdown', { clientX: 395 }));
    expect(v.port.scrollLeft).toBe(-200);

    track.dispatchEvent(new MouseEvent('pointerdown', { clientX: 395 }));
    expect(Object.is(v.port.scrollLeft, 0)).toBe(true);
  });

  it('pages the same geometry the ordinary way round in LTR (the control)', () => {
    const v = setup({ orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: 100 });
    v.port.dispatchEvent(new Event('scroll'));
    v.fixture.detectChanges();

    const track = v.q('[data-sv-track]')!;
    trackRect(track, 400, 8);
    track.dispatchEvent(new MouseEvent('pointerdown', { clientX: 390 }));
    expect(v.port.scrollLeft).toBe(500);
  });

  it('drags to a logical offset and writes the RTL scrollLeft for it', () => {
    const v = setup({ dir: 'rtl', orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: 0 });
    v.area.measure();
    // Thumb 160px travels 240px; the end of the travel is the end of the content.
    v.area.dragTo(240);
    expect(v.port.scrollLeft).toBe(-600);
    expect(v.area.scrollStart()).toBe(600);
  });
});

describe('svRtlScrollType — the engine probe', () => {
  it('reports the spec convention where nothing lays out, and leaves no probe behind', async () => {
    const { svRtlScrollType } = await import('./scroll-area.rtl');
    const before = document.body.children.length;
    expect(svRtlScrollType(document)).toBe('negative');
    expect(svRtlScrollType(null)).toBe('negative');
    expect(document.body.children.length).toBe(before);
  });
});

describe('svRtlScrollType — probes once per document (LU-06, wave 2)', () => {
  it('caches the no-layout fallback, so repeated reads insert no further probes', async () => {
    const { svRtlScrollType } = await import('./scroll-area.rtl');
    const doc = document.implementation.createHTMLDocument('probe');
    const create = vi.spyOn(doc, 'createElement');
    for (let i = 0; i < 5; i++) expect(svRtlScrollType(doc)).toBe('negative');
    // One probe + its inner child, once — not two per call.
    expect(create).toHaveBeenCalledTimes(2);
    expect(doc.body.children.length).toBe(0);
  });

  it('an RTL horizontal area scrolled many times probes the document at most once', () => {
    const create = vi.spyOn(document, 'createElement');
    const v = setup({ dir: 'rtl', orientation: 'horizontal' });
    box(v.port, { clientWidth: 400, scrollWidth: 1000, scrollLeft: -100 });
    v.area.measure();
    create.mockClear();
    for (let i = 0; i < 10; i++) {
      v.port.dispatchEvent(new Event('scroll'));
    }
    // Earlier tests may already have cached this document; either way, never per scroll.
    expect(create.mock.calls.filter(([tag]) => tag === 'div').length).toBe(0);
  });
});
