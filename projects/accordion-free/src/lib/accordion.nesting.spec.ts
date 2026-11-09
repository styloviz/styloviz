import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

/**
 * ============================================================================
 *  An accordion inside an accordion — FL-J3-NV-02 (`X-18`, `NV-01-I3`)
 * ============================================================================
 *
 * `AccordionItem.content` is text, so a host nests one accordion inside
 * another's region by composing the DOM around it (a host-rendered section
 * body). The spec builds exactly that shape — the inner host element lives
 * inside the outer panel's region — and pins what the code already scopes: ids
 * (`svUniqueId`), and arrow keys bound per header button, so a key never
 * crosses levels. Both levels use the SAME item ids, the realistic worst case.
 */

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Ships in two days.', defaultOpen: true },
  { id: 'returns', title: 'Returns', content: 'Thirty days.' },
  { id: 'warranty', title: 'Warranty', content: 'One year.' },
];

@Component({
  imports: [SvAccordionComponent],
  template: `
    <sv-accordion data-level="outer" [items]="items" expandMode="multi" />
    <sv-accordion data-level="inner" [items]="items" [headingLevel]="4" />
  `,
})
class HostComponent {
  readonly items = ITEMS;
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const outer = root.querySelector<HTMLElement>('[data-level="outer"]')!;
  const inner = root.querySelector<HTMLElement>('[data-level="inner"]')!;
  // Nest: the inner accordion becomes part of the outer "Shipping" region.
  outer.querySelector<HTMLElement>('[role="region"] > div > div')!.appendChild(inner);
  return { fixture, root, outer, inner };
}

/** Header buttons an accordion owns — not the nested one's. */
const headers = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>('button[aria-controls]')].filter(
    (b) => b.closest('sv-accordion') === host,
  );

function press(el: HTMLElement, key: string): void {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('SvAccordionComponent — nested (FL-J3-NV-02)', () => {
  it('every id in the page is unique, though the item ids repeat', async () => {
    const { root, outer, inner } = await setup();
    expect(outer.contains(inner)).toBe(true);
    const ids = [...root.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('aria-controls of each level resolves to a region of that level', async () => {
    const { outer, inner } = await setup();
    for (const host of [outer, inner]) {
      for (const h of headers(host)) {
        const region = document.getElementById(h.getAttribute('aria-controls')!)!;
        expect(region.closest('sv-accordion')).toBe(host);
        expect(region.getAttribute('aria-labelledby')).toBe(h.id);
      }
    }
  });

  it('ArrowDown / End in the inner accordion stay in the inner accordion', async () => {
    const { inner } = await setup();
    const [a, b, c] = headers(inner);
    press(a, 'ArrowDown');
    expect(document.activeElement).toBe(b);
    press(b, 'End');
    expect(document.activeElement).toBe(c);
    press(c, 'ArrowDown');
    expect(document.activeElement).toBe(a);
  });

  it('ArrowDown in the outer accordion skips the nested headers', async () => {
    const { outer, inner } = await setup();
    const [shipping, returns] = headers(outer);
    press(shipping, 'ArrowDown');
    expect(document.activeElement).toBe(returns);
    expect(inner.contains(document.activeElement)).toBe(false);
  });

  it('toggling an inner panel leaves the outer open set alone', async () => {
    const { fixture, outer, inner } = await setup();
    const outerCmp = fixture.debugElement.children[0].componentInstance as SvAccordionComponent;
    const before = [...outerCmp.openIds()];
    headers(inner)[1].click();
    fixture.detectChanges();
    expect([...outerCmp.openIds()]).toEqual(before);
    expect(headers(outer)[0].getAttribute('aria-expanded')).toBe('true');
  });
});
