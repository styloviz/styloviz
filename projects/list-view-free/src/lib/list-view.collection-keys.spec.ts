import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SV_UNVIRTUALIZED_ROW_CEILING, svResetWarnOnce } from '@styloviz/core';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem } from './list-view.component';
import { untilRendered } from '../../../../src/testing/async';

/**
 * `X-10` — keyboard at scale. A list of thousands of rows is ONE tab stop;
 * PageUp/PageDown jump a viewport and clamp; typeahead reaches a row by title.
 */

const many = (n: number): ListViewItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Row ${i + 1}`, group: i % 2 ? 'Odd' : 'Even' }));

const NAMED: ListViewItem[] = [
  { id: 1, title: 'Alpha' },
  { id: 2, title: 'Beta' },
  { id: 3, title: 'Marketing' },
  { id: 4, title: 'Mail' },
  { id: 5, title: 'Zulu', disabled: true },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, { inputs: { items: many(3), ...inputs } });
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const root = (f: Fixture) => f.nativeElement.querySelector('[role="region"]') as HTMLElement;
const tabStops = (f: Fixture) =>
  [...f.nativeElement.querySelectorAll('[tabindex]')].filter(
    (el) => (el as HTMLElement).getAttribute('tabindex') !== '-1',
  ) as HTMLElement[];
const focusedId = () => (document.activeElement as HTMLElement | null)?.dataset?.['lvId'] ?? null;

function press(f: Fixture, key: string, from?: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: from ?? root(f) });
  f.componentInstance.onRootKeydown(event);
  f.detectChanges();
  return event;
}

describe('SvListViewComponent — X-10 keyboard at scale', () => {
  afterEach(() => svResetWarnOnce());

  it.each([
    ['flat', { items: many(300) }],
    ['virtualized', { items: many(5000), virtualized: true, itemHeight: 50, viewportHeight: 200, overscan: 0 }],
    ['grouped', { items: many(300), grouped: true }],
  ])('%s: exactly one tab stop across a large dataset, and the region is not a second one', async (_, inputs) => {
    const f = await setup(inputs);
    const stops = tabStops(f);
    expect(stops).toHaveLength(1);
    expect(stops[0].dataset['lvRowBtn']).toBe('1');
    expect(root(f).getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the region as the tab stop when roving focus is off', async () => {
    const f = await setup({ enableRovingFocus: false });
    expect(root(f).getAttribute('tabindex')).toBe('0');
  });

  it('PageDown jumps one viewport of rows and clamps at the last row', async () => {
    const f = await setup({ items: many(5000), virtualized: true, itemHeight: 50, viewportHeight: 200, overscan: 0 });
    press(f, 'Home');
    press(f, 'PageDown');
    expect(f.componentInstance.activeItemId()).toBe(5);
    press(f, 'End');
    await untilRendered(f, () => focusedId() === '5000', { label: 'the last row to take focus' });
    const ev = press(f, 'PageDown', document.activeElement as HTMLElement);
    expect(ev.defaultPrevented).toBe(true);
    expect(f.componentInstance.activeItemId()).toBe(5000);
  });

  it('PageUp clamps at the first row', async () => {
    const f = await setup({ items: many(40) });
    press(f, 'Home');
    press(f, 'ArrowDown', document.activeElement as HTMLElement);
    press(f, 'PageUp', document.activeElement as HTMLElement);
    expect(focusedId()).toBe('1');
  });

  it('typeahead moves to the next row whose title starts with the typed letters', async () => {
    const f = await setup({ items: NAMED });
    press(f, 'Home');
    press(f, 'm', document.activeElement as HTMLElement);
    expect(focusedId()).toBe('3');
    press(f, 'a', document.activeElement as HTMLElement);
    expect(focusedId()).toBe('3');
    press(f, 'i', document.activeElement as HTMLElement);
    expect(focusedId()).toBe('4');
  });

  it('typeahead skips disabled rows', async () => {
    const f = await setup({ items: NAMED });
    press(f, 'Home');
    press(f, 'z', document.activeElement as HTMLElement);
    expect(focusedId()).toBe('1');
  });

  it('warns once in dev mode past the unvirtualized ceiling, and not when virtualized', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ items: many(SV_UNVIRTUALIZED_ROW_CEILING + 1), virtualized: true, viewportHeight: 200 });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('ceiling'))).toBe(false);
    await setup({ items: many(SV_UNVIRTUALIZED_ROW_CEILING + 1), grouped: true, virtualized: true });
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('ceiling'))).toHaveLength(1);
    warn.mockRestore();
  });
});
