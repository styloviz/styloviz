import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { afterEach, beforeEach, vi } from 'vitest';
import { svResetWarnOnce } from '@styloviz/core';
import { SvAffixComponent } from './affix.component';
import type { AffixMode } from './affix.position';
import {
  svEstablishesFixedContainingBlock,
  svFixedContainingBlock,
  type SvAffixContainingBlock,
} from './affix.containing-block';

/**
 * `sv-affix` — what it observes on its own, and what it tells the host.
 *
 * `LU-01-I2`/`M2` content resizing while pinned, `LU-01-I3` hidden at init,
 * `LU-01-I4` shrink-on-scroll headers, `LU-01-I1`/`M1` a transformed ancestor
 * stealing `position: fixed`. Each `it` below is a regression guard for one of
 * those — do not delete one as redundant with `affix.component.spec.ts`, which
 * runs with no `ResizeObserver` at all and so never reaches these paths.
 */

/** A `ResizeObserver` the test drives by hand — jsdom has none. */
class FakeResizeObserver {
  static all: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.all.push(this);
  }

  /**
   * ★ The content resizes for EVERY observer watching it. The slot is also
   *   observed by the floating-layer region (`LU-01-M3`), so "the last observer
   *   created" is not necessarily the affix's own.
   */
  static resize(el: Element, height: number): void {
    for (const ro of FakeResizeObserver.all) if (ro.observed.includes(el)) ro.emit(height);
  }
  observe(el: Element): void { this.observed.push(el); }
  unobserve(): void { /* not used */ }
  disconnect(): void { /* not used */ }
  /** Deliver a border-box height, as the platform would. */
  emit(height: number): void {
    this.callback(
      [{ borderBoxSize: [{ inlineSize: 200, blockSize: height }] } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

/**
 * Let svElementSize's one-per-frame coalescing flush. ⚠️ Not a synchronous rAF
 * stub: Angular's own scheduler races rAF, and a synchronous one ticks change
 * detection in the middle of a signal notification.
 */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

const rect = (top: number, height: number): DOMRect => ({
  top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}),
});

beforeEach(() => {
  FakeResizeObserver.all = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  svResetWarnOnce();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

async function affix(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const modes: AffixMode[] = [];
  const { fixture } = await render(SvAffixComponent, {
    inputs,
    on: { affixChange: (m: AffixMode) => modes.push(m) },
  });
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const slot = host.querySelector('[data-sv-slot]') as HTMLElement;
  const holder = host.querySelector('[data-sv-placeholder]') as HTMLElement;

  // The placeholder's rect tracks the scroll; see affix.component.spec.ts.
  let y = 0;
  let anchorTop = 200;
  holder.getBoundingClientRect = () => rect(anchorTop - y, 0);
  const slotReads = vi.fn(() => rect(anchorTop - y, 0));
  slot.getBoundingClientRect = slotReads;

  return {
    fixture,
    modes,
    holder,
    slotReads,
    /** Every observer watching the slot. */
    observersOfSlot: () => FakeResizeObserver.all.filter((ro) => ro.observed.includes(slot)),
    /** The content changes size; the observer reports it a frame later. */
    async resize(height: number) {
      FakeResizeObserver.resize(slot, height);
      await nextFrame();
      fixture.detectChanges();
    },
    /** Move the stubbed layout and tell the component. */
    scrollTo(to: number) {
      y = to;
      fixture.componentInstance.measure(to);
      fixture.detectChanges();
    },
    /** Move the stubbed layout WITHOUT telling the component (a reveal). */
    moveAnchor(to: number) { anchorTop = to; },
    mode: () => holder.getAttribute('data-sv-affix'),
  };
}

describe('SvAffixComponent — observed content size (LU-01-I2 / M2)', () => {
  it('observes the pinned content, not the placeholder', async () => {
    const a = await affix();
    expect(a.observersOfSlot().length).toBeGreaterThan(0);
  });

  it('follows content that grows while pinned, with no scroll event', async () => {
    const a = await affix();
    await a.resize(100);
    a.scrollTo(500);
    expect(a.mode()).toBe('fixed');
    expect(a.holder.style.height).toBe('100px');

    // An accordion inside the pinned block opens. Nobody scrolls.
    await a.resize(180);
    expect(a.holder.style.height).toBe('180px');
  });

  it('does not re-read the content on every scroll once an observer is watching it', async () => {
    const a = await affix();
    await a.resize(100);
    a.slotReads.mockClear();
    a.scrollTo(300);
    a.scrollTo(400);
    a.scrollTo(500);
    expect(a.slotReads).not.toHaveBeenCalled();
  });
});

describe('SvAffixComponent — hidden at init (LU-01-I3)', () => {
  /** ★ Regression guard: it used to render `fixed` before the first measure whenever offsetTop > 0. */
  it('stays in flow until it has been measured', async () => {
    const a = await affix({ offsetTop: 16 });
    await a.resize(100);
    expect(a.mode()).toBe('static');
    expect(a.modes).toEqual([]);
  });

  it('does not pin a zero-size element, however far the page scrolls', async () => {
    const a = await affix({ offsetTop: 16 });
    // Hidden: no box, and the placeholder has none either.
    a.moveAnchor(0);
    a.scrollTo(900);
    expect(a.mode()).toBe('static');
    expect(a.holder.style.height).toBe('');
  });

  it('re-reads the anchor when revealed, and pins against the real threshold', async () => {
    const a = await affix();
    a.moveAnchor(0);
    a.scrollTo(100);
    expect(a.mode()).toBe('static');

    // Revealed: the placeholder now sits at 600 in document space, below the
    // current scroll — so the right answer is STILL in flow, not pinned.
    a.moveAnchor(600);
    await a.resize(120);
    expect(a.fixture.componentInstance.anchorTop()).toBe(600);
    expect(a.mode()).toBe('static');

    a.scrollTo(700);
    expect(a.mode()).toBe('fixed');
    expect(a.holder.style.height).toBe('120px');
  });
});

describe('SvAffixComponent — shrink-on-scroll headers (LU-01-I4)', () => {
  it('by default, the placeholder follows the header once per observed change', async () => {
    const a = await affix();
    await a.resize(80);
    a.scrollTo(500);
    await a.resize(48);
    expect(a.holder.style.height).toBe('48px');
    expect(a.mode()).toBe('fixed');
  });

  it('with holdRestingHeight, the page below never moves while the header shrinks', async () => {
    const a = await affix({ holdRestingHeight: true });
    await a.resize(80);
    a.scrollTo(0);
    a.scrollTo(500);
    expect(a.holder.style.height).toBe('80px');

    await a.resize(64);
    await a.resize(48);
    expect(a.holder.style.height).toBe('80px');
    expect(a.mode()).toBe('fixed');
  });

  it('never moves the threshold when the header changes height, so it cannot re-pin', async () => {
    const a = await affix();
    await a.resize(80);
    a.scrollTo(500);
    for (const h of [76, 70, 62, 55, 48]) {
      await a.resize(h);
    }
    expect(a.fixture.componentInstance.anchorTop()).toBe(200);
    expect(a.modes).toEqual(['fixed']);
  });
});

describe('SvAffixComponent — containing block (LU-01-I1 / M1)', () => {
  @Component({
    standalone: true,
    imports: [SvAffixComponent],
    template: `
      <div id="route-wrapper" [style.transform]="transform()">
        <sv-affix (containingBlockChange)="reports.push($event)"><p>Pinned</p></sv-affix>
      </div>`,
  })
  class TransformedHost {
    readonly transform = signal<string | null>('translateY(0px)');
    readonly reports: (SvAffixContainingBlock | null)[] = [];
  }

  async function hosted(transform: string | null) {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(TransformedHost);
    fixture.componentInstance.transform.set(transform);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const slot = root.querySelector('[data-sv-slot]') as HTMLElement;
    const holder = root.querySelector('[data-sv-placeholder]') as HTMLElement;
    let y = 0;
    holder.getBoundingClientRect = () => rect(200 - y, 0);
    slot.getBoundingClientRect = () => rect(200 - y, 0);
    FakeResizeObserver.resize(slot, 60);
    await nextFrame();
    const affixCmp = fixture.debugElement.children[0].children[0].componentInstance as SvAffixComponent;
    return {
      fixture,
      holder,
      affix: affixCmp,
      scrollTo(to: number) { y = to; affixCmp.measure(to); fixture.detectChanges(); },
    };
  }

  it('reports the transformed ancestor when the element pins, and marks the hook', async () => {
    const h = await hosted('translateY(0px)');
    expect(h.holder.getAttribute('data-sv-containing-block')).toBe('viewport');

    h.scrollTo(500);
    const report = h.fixture.componentInstance.reports[0];
    expect(report?.element?.id).toBe('route-wrapper');
    expect(h.affix.containingBlock()?.element?.id).toBe('route-wrapper');
    expect(h.holder.getAttribute('data-sv-containing-block')).toBe('ancestor');
  });

  it('warns once in dev mode, naming the ancestor — not on every pin', async () => {
    const h = await hosted('translateY(0px)');
    h.scrollTo(500);
    h.scrollTo(0);
    h.scrollTo(500);
    const warns = vi.mocked(console.warn).mock.calls.filter(([m]) => String(m).includes('sv-affix'));
    expect(warns).toHaveLength(1);
    expect(String(warns[0][0])).toContain('<div#route-wrapper>');
    expect(h.fixture.componentInstance.reports).toHaveLength(1);
  });

  it('says nothing when the viewport is the containing block', async () => {
    const h = await hosted(null);
    h.scrollTo(500);
    expect(h.fixture.componentInstance.reports).toEqual([]);
    expect(h.affix.containingBlock()).toBeNull();
    expect(h.holder.getAttribute('data-sv-containing-block')).toBe('viewport');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('catches an offset the style walk cannot explain, by measuring a fixed probe', async () => {
    const h = await hosted(null);
    // Any `position: fixed` element inside the placeholder lands 40px down.
    const real = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.style.position === 'fixed' ? rect(40, 0) : real.call(this);
    });
    h.scrollTo(500);
    expect(h.affix.containingBlock()).toEqual({ element: null, top: 40, left: 0 });
  });

  it('does not probe on every scroll — only on the transition into fixed', async () => {
    const h = await hosted('translateY(0px)');
    const spy = vi.spyOn(window, 'getComputedStyle');
    h.scrollTo(500);
    const afterPin = spy.mock.calls.length;
    h.scrollTo(600);
    h.scrollTo(700);
    expect(afterPin).toBeGreaterThan(0);
    expect(spy.mock.calls.length).toBe(afterPin);
  });
});

describe('affix/containing-block — svEstablishesFixedContainingBlock', () => {
  const style = (props: Record<string, string>): CSSStyleDeclaration =>
    ({ getPropertyValue: (p: string) => props[p] ?? '' }) as unknown as CSSStyleDeclaration;

  it.each([
    ['transform', { transform: 'matrix(1, 0, 0, 1, 0, 0)' }],
    ['an individual translate', { translate: '0px 4px' }],
    ['perspective', { perspective: '800px' }],
    ['filter', { filter: 'blur(2px)' }],
    ['backdrop-filter', { 'backdrop-filter': 'blur(8px)' }],
    ['the prefixed backdrop-filter', { '-webkit-backdrop-filter': 'blur(8px)' }],
    ['will-change: transform', { 'will-change': 'opacity, transform' }],
    ['contain: paint', { contain: 'paint' }],
    ['contain: strict', { contain: 'strict' }],
    ['a size container', { 'container-type': 'inline-size' }],
    ['content-visibility: auto (paint containment)', { 'content-visibility': 'auto' }],
    ['content-visibility: hidden', { 'content-visibility': 'hidden' }],
    ['transform-style: preserve-3d', { 'transform-style': 'preserve-3d' }],
  ])('recognises %s', (_label, props) => {
    expect(svEstablishesFixedContainingBlock(style(props))).toBe(true);
  });

  it.each([
    ['nothing set', {}],
    ['explicit none everywhere', { transform: 'none', filter: 'none', perspective: 'none', contain: 'none' }],
    ['will-change on an unrelated property', { 'will-change': 'opacity' }],
    ['contain: size alone', { contain: 'size' }],
    ['a normal container', { 'container-type': 'normal' }],
  ])('ignores %s', (_label, props) => {
    expect(svEstablishesFixedContainingBlock(style(props))).toBe(false);
  });

  it('ignores filter and backdrop-filter on the root element (Filter Effects), but not a transform', () => {
    expect(svEstablishesFixedContainingBlock(style({ filter: 'invert(1)' }), true)).toBe(false);
    expect(svEstablishesFixedContainingBlock(style({ 'backdrop-filter': 'blur(4px)' }), true)).toBe(false);
    expect(svEstablishesFixedContainingBlock(style({ transform: 'matrix(1, 0, 0, 1, 0, 0)' }), true)).toBe(true);
  });

  it('does not report <html> as the culprit for a root dark-mode filter', () => {
    const root = document.documentElement;
    const child = document.createElement('div');
    document.body.appendChild(child);
    root.style.filter = 'invert(1)';
    try {
      expect(svFixedContainingBlock(child)).toBeNull();
    } finally {
      root.style.filter = '';
      child.remove();
    }
  });

  it('ignores content-visibility: visible and transform-style: flat', () => {
    expect(svEstablishesFixedContainingBlock(style({ 'content-visibility': 'visible', 'transform-style': 'flat' }))).toBe(false);
  });

  it('is null with no element, as on the server', () => {
    expect(svFixedContainingBlock(null)).toBeNull();
  });
});
