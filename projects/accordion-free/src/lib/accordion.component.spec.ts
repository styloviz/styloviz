import { render } from '@testing-library/angular';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

const ITEMS: AccordionItem[] = [
  { id: 'a', title: 'First', content: 'One' },
  { id: 'b', title: 'Second', content: 'Two' },
  { id: 'c', title: 'Third', content: 'Three', disabled: true },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, ...extra },
  });
  return fixture.componentInstance;
}

describe('SvAccordionComponent — single mode', () => {
  it('opens a panel and emits itemToggled', async () => {
    const spy = vi.fn();
    const c = await setup({ expandMode: 'single' });
    c.itemToggled.subscribe(spy);

    c.toggle(ITEMS[0]);
    expect(c.isOpen('a')).toBe(true);
    expect(spy).toHaveBeenCalledWith({ id: 'a', open: true, source: 'user' });
  });

  it('closes the previous panel when another opens', async () => {
    const c = await setup({ expandMode: 'single' });
    c.toggle(ITEMS[0]);
    c.toggle(ITEMS[1]);
    expect(c.isOpen('a')).toBe(false);
    expect(c.isOpen('b')).toBe(true);
  });

  it('toggling an open panel closes it', async () => {
    const c = await setup({ expandMode: 'single' });
    c.toggle(ITEMS[0]);
    c.toggle(ITEMS[0]);
    expect(c.isOpen('a')).toBe(false);
  });
});

describe('SvAccordionComponent — multi mode', () => {
  it('keeps multiple panels open simultaneously', async () => {
    const c = await setup({ expandMode: 'multi' });
    c.toggle(ITEMS[0]);
    c.toggle(ITEMS[1]);
    expect(c.isOpen('a')).toBe(true);
    expect(c.isOpen('b')).toBe(true);
  });
});

describe('SvAccordionComponent — guards & init', () => {
  it('does not toggle a disabled item', async () => {
    const spy = vi.fn();
    const c = await setup();
    c.itemToggled.subscribe(spy);
    c.toggle(ITEMS[2]); // disabled
    expect(c.isOpen('c')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('honors defaultOpen on init', async () => {
    const c = await setup({
      items: [{ id: 'x', title: 'X', content: 'x', defaultOpen: true }],
    });
    expect(c.isOpen('x')).toBe(true);
  });
});

/**
 * Who owns the open set (audit item X-6). The Pro twin shares no code with this
 * one, so it asserts the same promises in its own spec.
 */
describe('SvAccordionComponent — who owns the open set', () => {
  it('opens what the host binds, before any gesture', async () => {
    const c = await setup({ expandMode: 'multi', openIds: new Set(['a', 'b']) });
    expect(c.isOpen('a')).toBe(true);
    expect(c.isOpen('b')).toBe(true);
  });

  it('lets a bound set beat defaultOpen', async () => {
    const c = await setup({
      expandMode: 'multi',
      items: ITEMS.map((i) => ({ ...i, defaultOpen: i.id === 'a' })),
      openIds: new Set(['b']),
    });
    expect(c.isOpen('a')).toBe(false);
    expect(c.isOpen('b')).toBe(true);
  });

  it('reports the set as the user works, so a host can persist it', async () => {
    const c = await setup({ expandMode: 'multi' });
    const seen: string[][] = [];
    c.openIds.subscribe((s) => seen.push([...s]));

    c.toggle(ITEMS[0]);
    c.toggle(ITEMS[1]);
    c.toggle(ITEMS[0]);

    expect(seen).toEqual([['a'], ['a', 'b'], ['b']]);
  });
});
