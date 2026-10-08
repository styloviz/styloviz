import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SV_FLOATING_ORDER, SvFloatingLayerService } from '@styloviz/core';
import { SvAffixComponent } from './affix.component';

/**
 * `LU-01-M3` — an affixed block exposes its collision offset and registers
 * with the shared floating layer (`X-5`) while it is pinned.
 *
 * jsdom has no layout, so the holder and slot rects are stubbed the way
 * `affix.component.spec.ts` does it: viewport-relative, moving with the scroll.
 */

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
  return { fixture, c: fixture.componentInstance, scrollTo };
}

afterEach(() => TestBed.resetTestingModule());

describe('SvAffixComponent — floating layer (LU-01-M3)', () => {
  it('registers nothing and adds no offset by default', async () => {
    const { c, scrollTo } = await affix({ offsetTop: 10 });
    const layer = TestBed.inject(SvFloatingLayerService);
    layer.register({ anchor: 'top', height: 40, label: 'host banner' });
    scrollTo(600);
    expect(c.state().mode).toBe('fixed');
    expect(c.collisionOffset()).toBe(0);
    expect(c.state().top).toBe(10);
    expect(layer.regions().some((r) => r.label === 'affix')).toBe(false);
  });

  it("pins below a host's top banner and registers itself while pinned", async () => {
    const { c, scrollTo } = await affix({ offsetTop: 10, floatingAnchor: 'top' });
    const layer = TestBed.inject(SvFloatingLayerService);
    layer.register({ anchor: 'top', height: 40, label: 'host banner' });

    // In flow: not registered, but already reading where it WILL sit.
    scrollTo(0);
    expect(c.state().mode).toBe('static');
    expect(layer.regions().some((r) => r.label === 'affix')).toBe(false);
    expect(c.collisionOffset()).toBe(40 + layer.gap);

    scrollTo(600);
    expect(c.state().mode).toBe('fixed');
    expect(c.state().top).toBe(10 + 40 + layer.gap);
    const own = layer.regions().find((r) => r.label === 'affix');
    expect(own?.anchor).toBe('top');
    expect(own?.order).toBe(SV_FLOATING_ORDER.affix);
    // Registered: the offset comes from the live registration, and is unchanged.
    expect(c.collisionOffset()).toBe(40 + layer.gap);
  });

  it('leaves the layer when it unpins, and when destroyed', async () => {
    const { fixture, c, scrollTo } = await affix({ floatingAnchor: 'top' });
    const layer = TestBed.inject(SvFloatingLayerService);
    scrollTo(600);
    expect(c.state().mode).toBe('fixed');
    expect(layer.regions().length).toBe(1);

    scrollTo(0);
    expect(c.state().mode).toBe('static');
    expect(layer.regions()).toEqual([]);

    scrollTo(600);
    expect(layer.regions().length).toBe(1);
    fixture.destroy();
    expect(layer.regions()).toEqual([]);
  });
});

describe('SvAffixComponent — reduced motion (X-7)', () => {
  it('pins and unpins without any transition — nothing to still', async () => {
    const { fixture, scrollTo } = await affix();
    for (const y of [0, 600]) {
      scrollTo(y);
      const nodes = [fixture.nativeElement as HTMLElement, ...Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('*'))];
      for (const node of nodes) expect(node.getAttribute('class') ?? '').not.toMatch(/\b(?:transition|animate)-(?!none)/);
    }
  });
});
