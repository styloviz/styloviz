import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { describeAsyncContract } from '@testing/async-contract';
import {
  SvDescriptionsComponent,
  type DescriptionItem,
  type DescriptionsColumns,
  type DescriptionsSize,
} from './descriptions.component';

/**
 * `sv-descriptions` — a key–value list for a record detail panel.
 *
 * What is worth asserting here is not that a label and a value appear. It is
 * the four things a hand-rolled grid of `<span>`s gets wrong: the SEMANTIC
 * pairing, the difference between "no value" and "a blank value", a `span`
 * that cannot overflow its row, and two lists on one page not stealing each
 * other's accessible name.
 */

const ITEMS: DescriptionItem[] = [
  { id: 'status', label: 'Status', value: 'Shipped' },
  { id: 'carrier', label: 'Carrier', value: 'DHL Express' },
  { id: 'tracking', label: 'Tracking', value: 'JD0002090' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDescriptionsComponent, {
    inputs: { items: ITEMS, ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

const host = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const terms = (f: { nativeElement: unknown }) =>
  [...host(f).querySelectorAll('dt')].map((n) => n.textContent?.trim());
const values = (f: { nativeElement: unknown }) =>
  [...host(f).querySelectorAll('dd')].map((n) => n.textContent?.trim());

// ── Structure ────────────────────────────────────────────────────────────────

describe('SvDescriptionsComponent — structure', () => {
  /**
   * ★★ THE WHOLE POINT OF THE COMPONENT. A screen reader announces a `<dl>`
   * pair as "Status, definition, Shipped"; a grid of `<span>`s announces two
   * unrelated strings that happen to sit near each other. Rendering the right
   * ELEMENTS is the feature, so it is asserted before anything visual.
   */
  it('renders a real definition list, one dt/dd pair per item', async () => {
    const f = await setup();
    expect(host(f).querySelector('dl')).not.toBeNull();
    expect(terms(f)).toEqual(['Status', 'Carrier', 'Tracking']);
    expect(values(f)).toEqual(['Shipped', 'DHL Express', 'JD0002090']);
  });

  /**
   * ★ Each pair is wrapped so it can be ONE grid cell. That wrapper must be a
   * `<div>` and must be a child of the `<dl>` — HTML5 allows exactly that and
   * nothing else, and a `<section>` or a stray `<span>` there breaks the
   * list's semantics in real assistive technology while looking identical.
   */
  it('wraps each pair in a div that is a direct child of the dl', async () => {
    const f = await setup();
    const dl = host(f).querySelector('dl')!;
    const kids = [...dl.children];
    expect(kids).toHaveLength(ITEMS.length);
    expect(kids.every((n) => n.tagName === 'DIV')).toBe(true);
    expect(kids.every((n) => n.querySelector('dt') && n.querySelector('dd'))).toBe(true);
  });

  it('keeps the host order', async () => {
    const f = await setup({
      items: [...ITEMS].reverse(),
    });
    expect(terms(f)).toEqual(['Tracking', 'Carrier', 'Status']);
  });
});

// ── The missing-value distinction ────────────────────────────────────────────

describe('SvDescriptionsComponent — a value the host does not have', () => {
  /**
   * ★★★ `null` AND `''` ARE DIFFERENT FACTS.
   *
   * `null` means "we do not have this" and must show the placeholder. `''`
   * means "we have it and it is empty" — a genuinely blank note, a cleared
   * field — and must show nothing. Collapsing the two makes the component
   * assert something the host never said: an em-dash where a user deliberately
   * cleared a value reads as "unknown", and a blank where the record is
   * missing reads as "we checked, there is nothing".
   */
  it('shows the placeholder for null and undefined, and nothing for an empty string', async () => {
    const f = await setup({
      items: [
        { id: 'a', label: 'Null', value: null },
        { id: 'b', label: 'Undefined' },
        { id: 'c', label: 'Blank', value: '' },
      ] as DescriptionItem[],
    });
    expect(values(f)).toEqual(['—', '—', '']);
  });

  it('lets the host choose the placeholder', async () => {
    const f = await setup({
      items: [{ id: 'a', label: 'Null', value: null }] as DescriptionItem[],
      emptyValueText: 'Not provided',
    });
    expect(values(f)).toEqual(['Not provided']);
  });

  /**
   * ★ A placeholder is dimmed so it does not read as data. Asserted because
   * the class is the only thing separating "—" the value from "—" the absence,
   * and a real value must NOT pick it up.
   */
  it('dims a placeholder and never a real value', async () => {
    const f = await setup({
      items: [
        { id: 'a', label: 'Null', value: null },
        { id: 'b', label: 'Real', value: '—' },
      ] as DescriptionItem[],
    });
    const [missing, real] = [...host(f).querySelectorAll('dd')];
    expect(missing.className).toContain('text-gray-500 dark:text-gray-400');
    expect(real.className).not.toContain('text-gray-500 dark:text-gray-400');
  });
});

// ── Columns and span ─────────────────────────────────────────────────────────

describe('SvDescriptionsComponent — columns and span', () => {
  /**
   * ★★ TAILWIND ONLY GENERATES CLASSES IT CAN SEE IN THE SOURCE, so a computed
   * `` `sm:grid-cols-${n}` `` yields a class that never exists and a grid that
   * silently stays one column. Every count is spelled out in the component;
   * this proves each one actually reaches the DOM.
   */
  it.each([
    [1, 'grid-cols-1'],
    [2, 'sm:grid-cols-2'],
    [3, 'lg:grid-cols-3'],
    [4, 'lg:grid-cols-4'],
  ])('lays out %s column(s)', async (columns, cls) => {
    const f = await setup({ columns: columns as DescriptionsColumns });
    expect(host(f).querySelector('dl')!.className).toContain(cls);
  });

  /**
   * ★★★ A SPAN WIDER THAN THE ROW MUST BE CLAMPED, NOT HONOURED.
   *
   * `col-span-4` inside a 2-column grid is not a wrap — the browser overflows
   * the row, and the cell escapes the container. Clamping turns "as wide as
   * you asked" into "as wide as there is", which is what a host means.
   */
  it('clamps a span to the number of columns', async () => {
    const f = await setup({
      columns: 2,
      items: [{ id: 'a', label: 'Notes', value: 'x', span: 4 }] as DescriptionItem[],
    });
    const cell = host(f).querySelector('dl')!.children[0];
    expect(cell.className).toContain('sm:col-span-2');
    expect(cell.className).not.toContain('col-span-4');
  });

  /** A span of 0 or a negative would collapse the cell out of the layout. */
  it('floors a span at one', async () => {
    const f = await setup({
      columns: 3,
      items: [
        { id: 'a', label: 'Zero', value: 'x', span: 0 },
        { id: 'b', label: 'Negative', value: 'x', span: -2 },
      ] as DescriptionItem[],
    });
    for (const cell of [...host(f).querySelector('dl')!.children]) {
      expect(cell.className).not.toContain('col-span-0');
      expect(cell.className).not.toContain('col-span--2');
    }
  });

  it('spans a pair across two columns when asked', async () => {
    const f = await setup({
      columns: 3,
      items: [{ id: 'a', label: 'Address', value: 'x', span: 2 }] as DescriptionItem[],
    });
    expect(host(f).querySelector('dl')!.children[0].className).toContain('sm:col-span-2');
  });
});

// ── Presentation ─────────────────────────────────────────────────────────────

describe('SvDescriptionsComponent — presentation', () => {
  it('puts the label beside the value when horizontal and above it when vertical', async () => {
    const across = await setup({ layout: 'horizontal' });
    expect(host(across).querySelector('dl')!.children[0].className).toContain('sm:flex');

    const down = await setup({ layout: 'vertical' });
    const cell = host(down).querySelector('dl')!.children[0];
    expect(cell.className).toContain('flex-col');
    expect(cell.className).not.toContain('sm:flex ');
  });

  it('draws a border only for the bordered variant', async () => {
    const bordered = await setup({ variant: 'bordered' });
    expect(host(bordered).firstElementChild!.className).toContain('border');

    const plain = await setup({ variant: 'plain' });
    expect(host(plain).firstElementChild!.className).not.toContain('border');
  });

  it.each(['sm', 'md', 'lg'] as const)('scales the type at %s', async (size) => {
    const f = await setup({ size: size as DescriptionsSize });
    const scale = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size];
    expect(host(f).querySelector('dd')!.className).toContain(scale);
  });

  it('appends the host\'s own classes', async () => {
    const f = await setup({ customClass: 'mt-6' });
    expect(host(f).firstElementChild!.className).toContain('mt-6');
  });

  it('applies a per-item value class without losing the shared ones', async () => {
    const f = await setup({
      items: [{ id: 'a', label: 'ID', value: 'ord_1', valueClass: 'font-mono' }] as DescriptionItem[],
    });
    const dd = host(f).querySelector('dd')!;
    expect(dd.className).toContain('font-mono');
    expect(dd.className).toContain('text-gray-900');
  });
});

// ── Accessible name ──────────────────────────────────────────────────────────

describe('SvDescriptionsComponent — the accessible name', () => {
  it('names the list after its heading', async () => {
    const f = await setup({ title: 'Shipment' });
    const dl = host(f).querySelector('dl')!;
    const h = host(f).querySelector('h3')!;
    expect(h.textContent?.trim()).toBe('Shipment');
    expect(dl.getAttribute('aria-labelledby')).toBe(h.id);
    expect(h.id).not.toBe('');
  });

  /** No heading means no dangling reference — an `aria-labelledby` pointing at
   *  nothing is worse than none, because it suppresses the fallback name. */
  it('adds no aria-labelledby when there is no heading', async () => {
    const f = await setup();
    expect(host(f).querySelector('h3')).toBeNull();
    expect(host(f).querySelector('dl')!.hasAttribute('aria-labelledby')).toBe(false);
  });

  /**
   * ★★★ TWO ON ONE PAGE IS THE ORDINARY LAYOUT, NOT AN EDGE CASE — an order
   * page shows "Order" beside "Customer". With a fixed id both lists would
   * claim to be named by the first one's heading, and `getElementById` would
   * resolve into the wrong component. Instance-scoped ids are what prevent it.
   */
  it('gives two instances different heading ids', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    TestBed.resetTestingModule();
    const a = await render(SvDescriptionsComponent, { inputs: { items: ITEMS, title: 'Order' } });
    const b = TestBed.createComponent(SvDescriptionsComponent);
    b.componentRef.setInput('items', ITEMS);
    b.componentRef.setInput('title', 'Customer');
    b.detectChanges();
    await b.whenStable();

    const idA = (a.fixture.nativeElement as HTMLElement).querySelector('h3')!.id;
    const idB = (b.nativeElement as HTMLElement).querySelector('h3')!.id;
    expect(idA).not.toBe('');
    expect(idA).not.toBe(idB);
    expect((a.fixture.nativeElement as HTMLElement).querySelector('dl')!
      .getAttribute('aria-labelledby')).toBe(idA);
  });
});

// ── The async contract ───────────────────────────────────────────────────────

/**
 * Loading / error / empty / retry, plus the `data-sv-state` hooks a host and an
 * e2e test read. One row here is worth more than four hand-written tests: it is
 * the same seven assertions every migrated component in the kit answers.
 */
describeAsyncContract({
  component: SvDescriptionsComponent,
  collection: 'items',
  rows: ITEMS,
  loadedSelector: 'dl',
  skip: {
    twoEmpties:
      'a description list is the fixed field set of ONE record, not a queryable collection — ' +
      'there is no filter to come up empty, so every empty is `no-data`. Adding a `filtered` ' +
      'input to satisfy the contract would ship an input no host could meaningfully set.',
  },
});
