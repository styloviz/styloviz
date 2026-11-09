import { Component, signal, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvFloatingLayerService } from '@styloviz/core/layout';
import { SvAffixComponent } from './affix.component';

/**
 * FL-J3-LU-06 — two affixes on one page, and one added after init (`X-13`).
 *
 * Each family's own specs mount ONE affix. A real page pins a section header
 * and, further down, a table toolbar — and the questions only exist with two:
 * do they pin independently, does the second stack under the first instead of
 * on top of it, and does a block rendered later join the stack it finds?
 *
 * jsdom has no layout, so each block's rect is stubbed to move with the scroll
 * position the spec drives (`measure(y)`), the same way the family specs do.
 */

const rect = (top: number, height: number): DOMRect => ({
  top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}),
});

@Component({
  imports: [SvAffixComponent],
  template: `
    <sv-affix [floatingAnchor]="anchor()" [offsetTop]="8"><h2>Section</h2></sv-affix>
    <sv-affix [floatingAnchor]="anchor()" [offsetTop]="8"><div>Table toolbar</div></sv-affix>
    @if (third()) {
      <sv-affix [floatingAnchor]="anchor()" [offsetTop]="8"><div>Late</div></sv-affix>
    }`,
})
class TwoAffixes {
  readonly anchor = signal<'top' | null>('top');
  readonly third = signal(false);
  readonly affixes = viewChildren(SvAffixComponent);
}

/** Document positions: the first block at y=300, the second at 900, a third at 1500. Each 50px tall. */
const DOC_TOP = [300, 900, 1500];
const HEIGHT = 50;

async function setup(anchor: 'top' | null = 'top') {
  TestBed.resetTestingModule();
  const r = await render(TwoAffixes);
  r.fixture.componentInstance.anchor.set(anchor);
  r.fixture.detectChanges();
  let y = 0;
  const wire = () => {
    const hosts = Array.from((r.fixture.nativeElement as HTMLElement).querySelectorAll('sv-affix'));
    hosts.forEach((host, i) => {
      for (const sel of ['[data-sv-slot]', '[data-sv-placeholder]']) {
        (host.querySelector(sel) as HTMLElement).getBoundingClientRect = () => rect(DOC_TOP[i] - y, HEIGHT);
      }
    });
  };
  wire();
  const affixes = () => r.fixture.componentInstance.affixes();
  const scrollTo = (to: number) => {
    y = to;
    // Twice: a block's offset depends on the regions the others registered in
    // the same scroll, as it does on a real page across consecutive frames.
    for (let pass = 0; pass < 2; pass++) for (const a of affixes()) a.measure(to);
    r.fixture.detectChanges();
  };
  return { ...r, affixes, scrollTo, wire };
}

afterEach(() => TestBed.resetTestingModule());

describe('SvAffixComponent — two on one page (X-13)', () => {
  it('★ pin independently: the first pins at its own threshold, the second only at its own', async () => {
    const { affixes, scrollTo } = await setup(null);
    scrollTo(400);
    expect(affixes().map((a) => a.state().mode)).toEqual(['fixed', 'static']);
    scrollTo(1000);
    expect(affixes().map((a) => a.state().mode)).toEqual(['fixed', 'fixed']);
    scrollTo(0);
    expect(affixes().map((a) => a.state().mode)).toEqual(['static', 'static']);
  });

  it('★ with the floating layer, the second stacks UNDER the first instead of covering it', async () => {
    const { affixes, scrollTo } = await setup('top');
    const layer = TestBed.inject(SvFloatingLayerService);
    scrollTo(1000);
    const [first, second] = affixes();
    expect(first.state().mode).toBe('fixed');
    expect(second.state().mode).toBe('fixed');
    const firstBottom = first.state().top + HEIGHT;
    expect(second.state().top).toBeGreaterThanOrEqual(firstBottom);
    expect(layer.regions().filter((r) => r.label === 'affix')).toHaveLength(2);
  });

  it('turning the floating layer off unregisters both, and both still pin', async () => {
    const { fixture, affixes, scrollTo } = await setup('top');
    scrollTo(1000);
    const layer = TestBed.inject(SvFloatingLayerService);
    fixture.componentInstance.anchor.set(null);
    fixture.detectChanges();
    scrollTo(1000);
    expect(layer.regions().filter((r) => r.label === 'affix')).toHaveLength(0);
    expect(affixes().every((a) => a.state().mode === 'fixed')).toBe(true);
  });
});

describe('SvAffixComponent — added after init (X-13)', () => {
  it('★ a block rendered later pins at its own threshold and stacks under the ones already pinned', async () => {
    const { fixture, affixes, scrollTo, wire } = await setup('top');
    scrollTo(1600);
    expect(affixes()).toHaveLength(2);

    fixture.componentInstance.third.set(true);
    fixture.detectChanges();
    wire();
    scrollTo(1600);

    const all = affixes();
    expect(all).toHaveLength(3);
    expect(all.map((a) => a.state().mode)).toEqual(['fixed', 'fixed', 'fixed']);
    expect(all[2].state().top).toBeGreaterThanOrEqual(all[1].state().top + HEIGHT);
  });

  it('removing the late block leaves the others where they were', async () => {
    const { fixture, affixes, scrollTo, wire } = await setup('top');
    fixture.componentInstance.third.set(true);
    fixture.detectChanges();
    wire();
    scrollTo(1600);
    const before = affixes().slice(0, 2).map((a) => a.state().top);
    fixture.componentInstance.third.set(false);
    fixture.detectChanges();
    scrollTo(1600);
    expect(affixes().map((a) => a.state().top)).toEqual(before);
    expect(TestBed.inject(SvFloatingLayerService).regions().filter((r) => r.label === 'affix')).toHaveLength(2);
  });
});
