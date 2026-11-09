import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SV_FLOATING_ORDER,
  SV_FLOATING_Z,
  SV_SAFE_AREA,
  SvFloatingLayerService,
  svFloatingInset,
  svFloatingRegion,
  type SvFloatingAnchor,
} from './floating-layer';

/**
 * `X-5` / `N-7` — who owns which corner.
 *
 * ⚠️ jsdom has no layout and no `ResizeObserver`, so the helper's measurement is
 * driven through the `observe` seam and a stubbed `getBoundingClientRect`, the
 * same way `element-size.spec.ts` does it.
 */

function service(): SvFloatingLayerService {
  TestBed.resetTestingModule();
  return TestBed.inject(SvFloatingLayerService);
}

describe('SvFloatingLayerService — stacking', () => {
  it('a lone region sits at the edge', () => {
    const layer = service();
    const fab = layer.register({ anchor: 'bottom-right', height: 56 });
    expect(fab.offset()).toBe(0);
  });

  it('stacks two regions in one corner by order, lower nearest the edge', () => {
    const layer = service();
    const top = layer.register({ anchor: 'bottom-right', height: 48, order: SV_FLOATING_ORDER.scrollToTop });
    const fab = layer.register({ anchor: 'bottom-right', height: 56, order: SV_FLOATING_ORDER.fab });
    expect(fab.offset()).toBe(0);
    expect(top.offset()).toBe(56 + layer.gap);
  });

  it('breaks an order tie by registration order', () => {
    const layer = service();
    const a = layer.register({ anchor: 'bottom-left', height: 40 });
    const b = layer.register({ anchor: 'bottom-left', height: 40 });
    expect(a.offset()).toBe(0);
    expect(b.offset()).toBe(40 + layer.gap);
  });

  it('does not stack different corners on each other', () => {
    const layer = service();
    layer.register({ anchor: 'bottom-left', height: 80 });
    layer.register({ anchor: 'top-right', height: 80 });
    const fab = layer.register({ anchor: 'bottom-right', height: 56 });
    expect(fab.offset()).toBe(0);
  });

  it("lets a host's full-width bottom bar push every bottom corner, whatever its order", () => {
    const layer = service();
    const fab = layer.register({ anchor: 'bottom-right', height: 56, order: -5 });
    const left = layer.register({ anchor: 'bottom-left', height: 48 });
    const cookie = layer.register({ anchor: 'bottom', height: 90, label: 'cookie banner', order: 99 });
    expect(fab.offset()).toBe(90 + layer.gap);
    expect(left.offset()).toBe(90 + layer.gap);
    expect(cookie.offset()).toBe(0);
  });

  it('stacks two edge bars on each other by order, and never under a corner', () => {
    const layer = service();
    layer.register({ anchor: 'bottom-right', height: 56 });
    const nav = layer.register({ anchor: 'bottom', height: 64, order: 0 });
    const cookie = layer.register({ anchor: 'bottom', height: 90, order: 1 });
    expect(nav.offset()).toBe(0);
    expect(cookie.offset()).toBe(64 + layer.gap);
  });

  it('a zero-height region takes no space and no gap — the SSR case', () => {
    const layer = service();
    layer.register({ anchor: 'bottom-right', height: 0 });
    const next = layer.register({ anchor: 'bottom-right', height: 40 });
    expect(next.offset()).toBe(0);
  });

  it('updates offsets when a region resizes, and releases cleanly', () => {
    const layer = service();
    const chat = layer.register({ anchor: 'bottom-right', height: 64, order: 15, label: 'chat' });
    const top = layer.register({ anchor: 'bottom-right', height: 48, order: 20 });
    expect(top.offset()).toBe(64 + layer.gap);

    chat.update({ height: 400 });
    expect(top.offset()).toBe(400 + layer.gap);

    chat.release();
    chat.release();
    expect(top.offset()).toBe(0);
    expect(layer.regions().map((r) => r.id)).toEqual([top.id]);
  });

  it('rejects nonsense sizes rather than stacking on them', () => {
    const layer = service();
    layer.register({ anchor: 'bottom-right', height: Number.NaN });
    layer.register({ anchor: 'bottom-right', height: -20 });
    expect(layer.offsetAt('bottom-right')).toBe(0);
  });

  it('answers for an unregistered reader', () => {
    const layer = service();
    layer.register({ anchor: 'bottom', height: 50 });
    layer.register({ anchor: 'bottom-right', height: 30 });
    expect(layer.offsetAt('bottom-right')).toBe(50 + 30 + 2 * layer.gap);
    expect(layer.offsetAt('top-right')).toBe(0);
  });

  it('reset() is a test seam that forgets every region', () => {
    const layer = service();
    layer.register({ anchor: 'bottom', height: 50 });
    layer.reset();
    expect(layer.regions()).toEqual([]);
  });
});

describe('safe-area tokens and stacking bands', () => {
  it('builds one calc() from base, offset and the device inset', () => {
    expect(svFloatingInset('bottom', 24, 68)).toBe('calc(92px + env(safe-area-inset-bottom, 0px))');
    expect(svFloatingInset('right', 24)).toBe(`calc(24px + ${SV_SAFE_AREA.right})`);
    expect(svFloatingInset('top', Number.NaN, 10)).toBe('calc(10px + env(safe-area-inset-top, 0px))');
  });

  it('keeps every floating band below the overlay stack (1000)', () => {
    for (const z of Object.values(SV_FLOATING_Z)) expect(z).toBeLessThan(1000);
  });
});

describe('svFloatingRegion — the component helper', () => {
  let callbacks: ResizeObserverCallback[] = [];
  const observe = (cb: ResizeObserverCallback): ResizeObserver => {
    callbacks.push(cb);
    return { observe: () => undefined, unobserve: () => undefined, disconnect: () => undefined } as ResizeObserver;
  };

  function boxed(height: number): HTMLElement {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ width: 56, height }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  function mount(anchor: () => SvFloatingAnchor | null, el: HTMLElement, order = 0) {
    @Component({ standalone: true, template: '' })
    class Host {
      readonly region = svFloatingRegion({ anchor, element: () => el, order, observe });
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => { callbacks = []; });

  it('registers the measured element, stacks it, and releases on destroy', () => {
    const layer = service();
    const fab = layer.register({ anchor: 'bottom-right', height: 56, order: 10 });
    const fixture = mount(() => 'bottom-right', boxed(48), 20);

    expect(fixture.componentInstance.region.registered()).toBe(true);
    expect(fixture.componentInstance.region.offset()).toBe(56 + layer.gap);
    expect(layer.regions().find((r) => r.id !== fab.id)?.height).toBe(48);

    fixture.destroy();
    expect(layer.regions().map((r) => r.id)).toEqual([fab.id]);
  });

  it('does not register while the anchor is null, and moves when it changes', () => {
    const layer = service();
    const anchor = signal<SvFloatingAnchor | null>(null);
    const fixture = mount(anchor, boxed(40));
    expect(layer.regions()).toEqual([]);
    expect(fixture.componentInstance.region.offset()).toBe(0);

    anchor.set('bottom-left');
    fixture.detectChanges();
    expect(layer.regions().map((r) => r.anchor)).toEqual(['bottom-left']);

    anchor.set('top-right');
    fixture.detectChanges();
    expect(layer.regions().map((r) => r.anchor)).toEqual(['top-right']);

    anchor.set(null);
    fixture.detectChanges();
    expect(layer.regions()).toEqual([]);
  });
});
