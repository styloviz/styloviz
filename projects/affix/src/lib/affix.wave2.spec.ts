import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SV_FLOATING_Z, SvFloatingLayerService } from '@styloviz/core';
import { SvAffixComponent } from './affix.component';

/**
 * `sv-affix` — review follow-ups to the Layout & Utilities pass (`LU-01`).
 *
 *  - The pinned z-index and `SV_FLOATING_Z.affix` agree.
 *  - The floating-layer region puts NO second `ResizeObserver` on the slot
 *    unless the block is actually registered (pinned + `floatingAnchor`).
 *  - A host driving the public signals directly must call `measure()` once.
 */

/** Counts which elements each observer watches — jsdom has no `ResizeObserver`. */
class CountingResizeObserver {
  static all: CountingResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) {
    CountingResizeObserver.all.push(this);
  }
  observe(el: Element): void { this.observed.push(el); }
  unobserve(): void { /* not used */ }
  disconnect(): void { this.disconnected = true; }
  /** Live observers watching `el`. */
  static watching(el: Element): number {
    return CountingResizeObserver.all.filter((ro) => !ro.disconnected && ro.observed.includes(el)).length;
  }
  /** Deliver a border-box height to every live observer of `el`. */
  static resize(el: Element, height: number): void {
    for (const ro of CountingResizeObserver.all) {
      if (ro.disconnected || !ro.observed.includes(el)) continue;
      ro.callback(
        [{ borderBoxSize: [{ inlineSize: 200, blockSize: height }] } as unknown as ResizeObserverEntry],
        ro as unknown as ResizeObserver,
      );
    }
  }
}

/** Let svElementSize's one-per-frame coalescing flush. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

const rect = (top: number, height: number): DOMRect => ({
  top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}),
});

async function affix(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAffixComponent, { inputs });
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const slot = host.querySelector('[data-sv-slot]') as HTMLElement;
  const holder = host.querySelector('[data-sv-placeholder]') as HTMLElement;
  let y = 0;
  holder.getBoundingClientRect = () => rect(500 - y, 60);
  slot.getBoundingClientRect = () => rect(500 - y, 60);
  const scrollTo = (to: number) => {
    y = to;
    fixture.componentInstance.measure(to);
    fixture.detectChanges();
  };
  return { fixture, c: fixture.componentInstance, slot, scrollTo };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('SvAffixComponent — pinned stacking (LU-01, X-5)', () => {
  it('paints the pinned block at the z-index SV_FLOATING_Z.affix names', async () => {
    const { slot, scrollTo } = await affix();
    scrollTo(600);
    expect(slot.classList).toContain('fixed');
    expect(slot.classList).toContain(`z-${SV_FLOATING_Z.affix}`);
    // Still under the floating controls it must never cover.
    expect(SV_FLOATING_Z.affix).toBeLessThan(SV_FLOATING_Z.control);
  });
});

describe('SvAffixComponent — one observer unless registered (LU-01-M3)', () => {
  beforeEach(() => {
    CountingResizeObserver.all = [];
    vi.stubGlobal('ResizeObserver', CountingResizeObserver);
  });

  it('by default (floatingAnchor null) the slot has exactly one observer, pinned or not', async () => {
    const { fixture, c, slot, scrollTo } = await affix();
    CountingResizeObserver.resize(slot, 60);
    await nextFrame();
    fixture.detectChanges();
    expect(CountingResizeObserver.watching(slot)).toBe(1);
    scrollTo(600);
    expect(c.state().mode).toBe('fixed');
    expect(CountingResizeObserver.watching(slot)).toBe(1);
  });

  it('opted in, the region observes the slot only while pinned, and registers its real height', async () => {
    const { fixture, c, slot, scrollTo } = await affix({ floatingAnchor: 'top' });
    const layer = TestBed.inject(SvFloatingLayerService);
    // The content's observer reports its box (jsdom laid out nothing at render).
    CountingResizeObserver.resize(slot, 60);
    await nextFrame();
    fixture.detectChanges();

    scrollTo(0);
    expect(CountingResizeObserver.watching(slot)).toBe(1);

    scrollTo(600);
    expect(c.state().mode).toBe('fixed');
    expect(CountingResizeObserver.watching(slot)).toBe(2);
    expect(layer.regions().find((r) => r.label === 'affix')?.height).toBe(60);

    scrollTo(0);
    expect(CountingResizeObserver.watching(slot)).toBe(1);
    expect(layer.regions()).toEqual([]);
  });
});

describe('SvAffixComponent — host-driven signals need one measure()', () => {
  it('stays static until measured, then follows the signals', async () => {
    const { fixture, c } = await affix();
    c.anchorTop.set(500);
    c.height.set(60);
    c.scrollY.set(600);
    fixture.detectChanges();
    expect(c.state().mode).toBe('static');

    // One measure() — then signal writes drive it as documented.
    c.measure(0);
    c.anchorTop.set(500);
    c.height.set(60);
    c.scrollY.set(600);
    fixture.detectChanges();
    expect(c.state().mode).toBe('fixed');
  });
});

describe('SvAffixComponent — disabling while pinned reports at once', () => {
  it("emits affixChange('static') when disabled turns on, without waiting for a scroll", async () => {
    const { fixture, c, scrollTo } = await affix();
    const modes: string[] = [];
    c.affixChange.subscribe((m) => modes.push(m));
    scrollTo(600);
    expect(modes).toEqual(['fixed']);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(modes).toEqual(['fixed', 'static']);
  });
});
