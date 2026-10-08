import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvAccordionComponent,
  type AccordionItem,
  type AccordionToggleEvent,
} from './accordion.component';

/**
 * The keyboard and the ARIA wiring of the FREE accordion.
 *
 * Adapted from `projects/accordion/src/lib/accordion.component.spec.ts`, whose
 * Pro twin already covers this ground; the implementations are identical here,
 * so the assertions are too — that is the point. A header is both a `<button>`
 * and a keyboard-navigable list item, and those two roles fight: the browser
 * synthesises a click for Enter and Space, so a component that ALSO handles
 * those keys itself opens a panel and closes it again in one keystroke.
 */

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Ships in 2 days.' },
  { id: 'returns', title: 'Returns', content: 'Thirty days.' },
  { id: 'legal', title: 'Legal', content: 'The small print.', disabled: true },
  { id: 'support', title: 'Support', content: 'We answer.' },
];

async function setup(inputs: Partial<ComponentInput<SvAccordionComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAccordionComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvAccordionComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const headers = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('button[aria-expanded]')];
const header = (f: { nativeElement: unknown }, title: string) =>
  headers(f).find((b) => b.textContent?.includes(title))!;
const openTitles = (f: { nativeElement: unknown }) =>
  headers(f)
    .filter((b) => b.getAttribute('aria-expanded') === 'true')
    .map((b) => b.textContent?.trim().split('\n')[0].trim());

describe('SvAccordionComponent — the rendered list', () => {
  it('renders one header per item', async () => {
    const { fixture } = await setup();
    expect(headers(fixture).length).toBe(4);
  });

  it('starts with everything shut unless told otherwise', async () => {
    const { fixture } = await setup();
    expect(openTitles(fixture)).toEqual([]);
  });

  it('points every header at the panel it controls, and back again', async () => {
    const { fixture } = await setup();
    for (const h of headers(fixture)) {
      const panel = el(fixture).querySelector(`#${h.getAttribute('aria-controls')}`);
      expect(panel).not.toBeNull();
      expect(panel!.getAttribute('aria-labelledby')).toBe(h.id);
      expect(panel!.getAttribute('role')).toBe('region');
    }
  });

  it('marks a disabled item and takes it out of the tab order', async () => {
    const { fixture } = await setup();
    expect(header(fixture, 'Legal').getAttribute('aria-disabled')).toBe('true');
    expect(header(fixture, 'Legal').getAttribute('tabindex')).toBe('-1');
    expect(header(fixture, 'Shipping').getAttribute('tabindex')).toBe('0');
  });
});

describe('SvAccordionComponent — the keyboard', () => {
  it('toggles exactly once on Enter', async () => {
    const { fixture } = await setup();
    const seen: AccordionToggleEvent[] = [];
    fixture.componentInstance.itemToggled.subscribe((e) => seen.push(e));

    header(fixture, 'Shipping').focus();
    await userEvent.keyboard('{Enter}');
    fixture.detectChanges();

    expect(seen.length).toBe(1);
    expect(fixture.componentInstance.isOpen('shipping')).toBe(true);
  });

  it('toggles exactly once on Space', async () => {
    const { fixture } = await setup();
    const seen: AccordionToggleEvent[] = [];
    fixture.componentInstance.itemToggled.subscribe((e) => seen.push(e));

    header(fixture, 'Shipping').focus();
    await userEvent.keyboard('{ }');
    fixture.detectChanges();

    expect(seen.length).toBe(1);
    expect(fixture.componentInstance.isOpen('shipping')).toBe(true);
  });

  it('moves focus down and up, skipping the disabled one', async () => {
    const { fixture } = await setup();
    header(fixture, 'Shipping').focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(header(fixture, 'Returns'));

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(header(fixture, 'Support'));

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(header(fixture, 'Returns'));
  });

  it('jumps to the ends with Home and End', async () => {
    const { fixture } = await setup();
    header(fixture, 'Returns').focus();

    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(header(fixture, 'Support'));

    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(header(fixture, 'Shipping'));
  });

  it('wraps at both ends', async () => {
    // Same contract as sv-tabs, sv-radio-group and sv-speed-dial.
    const { fixture } = await setup();
    header(fixture, 'Support').focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(header(fixture, 'Shipping'));

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(header(fixture, 'Support'));
  });

  it('ignores a key it has no meaning for', async () => {
    const { fixture } = await setup();
    header(fixture, 'Shipping').focus();
    await userEvent.keyboard('q');
    fixture.detectChanges();
    expect(openTitles(fixture)).toEqual([]);
    expect(document.activeElement).toBe(header(fixture, 'Shipping'));
  });
});

describe('SvAccordionComponent — defaultOpen', () => {
  it('opens only the first defaultOpen in single mode', async () => {
    const { fixture } = await setup({ items: ITEMS.map((i) => ({ ...i, defaultOpen: true })) });
    expect(openTitles(fixture).length).toBe(1);
  });

  it('opens every defaultOpen in multi mode', async () => {
    const { fixture } = await setup({
      expandMode: 'multi',
      items: [
        { ...ITEMS[0], defaultOpen: true },
        { ...ITEMS[1] },
        { ...ITEMS[3], defaultOpen: true },
      ],
    });
    expect(openTitles(fixture)).toEqual(['Shipping', 'Support']);
  });

  it('never opens a disabled item, whatever defaultOpen says', async () => {
    const { fixture } = await setup({
      items: [{ ...ITEMS[2], defaultOpen: true }, { ...ITEMS[0] }],
    });
    expect(openTitles(fixture)).toEqual([]);
  });
});

describe('SvAccordionComponent — two accordions on one page', () => {
  @Component({
    standalone: true,
    imports: [SvAccordionComponent],
    template: `
      <sv-accordion [items]="items" />
      <sv-accordion [items]="items" />
    `,
  })
  class TwoLists {
    readonly items = ITEMS;
  }

  async function two() {
    TestBed.resetTestingModule();
    return render(TwoLists);
  }

  it('gives every element in both lists a unique id', async () => {
    // ★ A global id literal built from the item's own id duplicated every
    // header and panel id across two accordions, so `aria-controls` and
    // `aria-labelledby` resolved into the wrong list.
    const { fixture } = await two();
    const ids = [...el(fixture).querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not move focus into the other list', async () => {
    const { fixture } = await two();
    const second = [...el(fixture).querySelectorAll('sv-accordion')][1];
    const secondHeaders = [...second.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')];

    secondHeaders[0].focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(second.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(secondHeaders[1]);
  });

  it('opens a section in one list without opening it in the other', async () => {
    const { fixture } = await two();
    const lists = [...el(fixture).querySelectorAll('sv-accordion')];
    const firstHeader = lists[0].querySelector<HTMLButtonElement>('button[aria-expanded]')!;

    await userEvent.click(firstHeader);
    fixture.detectChanges();

    expect(firstHeader.getAttribute('aria-expanded')).toBe('true');
    expect(lists[1].querySelector('button[aria-expanded]')!.getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
