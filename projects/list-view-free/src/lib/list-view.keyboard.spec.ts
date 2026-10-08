import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewBulkAction, ListViewItem } from './list-view.component';

const items = (): ListViewItem[] => [
  { id: 1, title: 'Alpha' },
  { id: 2, title: 'Beta' },
  { id: 3, title: 'Gamma' },
];

const bulkActions: ListViewBulkAction[] = [
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete', tone: 'danger' },
  { id: 'mark-read', label: 'Mark read' },
];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: items(), ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

/** The rows roving focus can actually land on — disabled ones are not stops. */
const rows = (f: Fixture) =>
  [
    ...f.nativeElement.querySelectorAll('button[data-lv-row-btn="1"]:not([disabled])'),
  ] as HTMLButtonElement[];

const root = (f: Fixture) => f.nativeElement.querySelector('[role="region"]') as HTMLElement;

/**
 * Drive `onRootKeydown` with a keydown that appears to come from `from`.
 *
 * ★ Called directly rather than dispatched. An exception thrown inside a DOM
 * listener is reported to `window.onerror` and never reaches the spec, so a
 * dispatch-based helper reports "passed" for a handler that just crashed —
 * measured: an unclamped `rowButtons[currentIndex + 1].focus()` survived every
 * assertion here until this changed. The wiring from the template to the
 * handler has its own test below.
 */
function press(f: Fixture, key: string, init: KeyboardEventInit = {}, from?: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: from ?? root(f) });
  f.componentInstance.onRootKeydown(event);
  f.detectChanges();
  return event;
}

/** Which row currently owns DOM focus, by title — or null. */
const focused = (f: Fixture) => {
  const index = rows(f).indexOf(document.activeElement as HTMLButtonElement);
  return index === -1 ? null : rows(f)[index].textContent?.trim().split('\n')[0] ?? null;
};

describe('SvListViewComponent — roving focus', () => {
  /** The handler is useless unless the template actually reaches it. */
  it('is reached by a keydown anywhere inside the region', async () => {
    const f = await setup();
    rows(f)[0].focus();
    rows(f)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    f.detectChanges();
    expect(focused(f)).toBe('Beta');
  });

  it('lands on the first row when nothing is focused yet', async () => {
    const f = await setup();
    press(f, 'ArrowDown');
    expect(focused(f)).toBe('Alpha');
  });

  it('lands on the last row when arrowing up from nothing', async () => {
    const f = await setup();
    press(f, 'ArrowUp');
    expect(focused(f)).toBe('Gamma');
  });

  it('steps down and back up one row at a time', async () => {
    const f = await setup();
    rows(f)[0].focus();

    press(f, 'ArrowDown', {}, rows(f)[0]);
    expect(focused(f)).toBe('Beta');

    press(f, 'ArrowUp', {}, rows(f)[1]);
    expect(focused(f)).toBe('Alpha');
  });

  /** At the edge the focus must stay put, not wrap — wrapping loses the user. */
  it('stops at the last row instead of wrapping', async () => {
    const f = await setup();
    rows(f)[2].focus();
    press(f, 'ArrowDown', {}, rows(f)[2]);
    expect(focused(f)).toBe('Gamma');
  });

  it('stops at the first row instead of wrapping', async () => {
    const f = await setup();
    rows(f)[0].focus();
    press(f, 'ArrowUp', {}, rows(f)[0]);
    expect(focused(f)).toBe('Alpha');
  });

  it('jumps to the ends with Home and End', async () => {
    const f = await setup();
    rows(f)[1].focus();
    press(f, 'End', {}, rows(f)[1]);
    expect(focused(f)).toBe('Gamma');

    press(f, 'Home', {}, rows(f)[2]);
    expect(focused(f)).toBe('Alpha');
  });

  /** The keypress is claimed, so the page does not scroll underneath the list. */
  it('claims the arrow key it acted on', async () => {
    const f = await setup();
    expect(press(f, 'ArrowDown').defaultPrevented).toBe(true);
  });

  /** A disabled row is not a stop on the roving tour. */
  it('skips over a disabled row', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'Alpha' },
        { id: 2, title: 'Beta', disabled: true },
        { id: 3, title: 'Gamma' },
      ] as ListViewItem[],
    });
    expect(rows(f)).toHaveLength(2);
    press(f, 'ArrowDown');
    press(f, 'ArrowDown', {}, document.activeElement as HTMLElement);
    expect(focused(f)).toBe('Gamma');
  });

  /** Focus must stay where the user put it when the feature is switched off. */
  it('does not move focus when roving focus is disabled', async () => {
    const f = await setup({ enableRovingFocus: false });
    rows(f)[1].focus();
    const event = press(f, 'ArrowDown', {}, rows(f)[1]);
    expect(focused(f)).toBe('Beta');
    expect(event.defaultPrevented).toBe(false);
  });

  /** Nothing to rove over — the handler must decline, not index into an empty array. */
  it('does nothing on an empty list', async () => {
    const f = await setup({ items: [] as ListViewItem[] });
    expect(press(f, 'ArrowDown').defaultPrevented).toBe(false);
    expect(document.activeElement?.tagName.toLowerCase()).not.toBe('button');
  });

  /** Keys the roving handler does not own must fall through untouched. */
  it('leaves other keys alone', async () => {
    const f = await setup();
    expect(press(f, 'ArrowRight').defaultPrevented).toBe(false);
    expect(focused(f)).toBeNull();
  });

  /** Arrow keys inside the search box move the caret; they must not move focus. */
  it('yields to the search box', async () => {
    const f = await setup({ searchable: true });
    const input = f.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    press(f, 'ArrowDown', {}, input);
    expect(focused(f)).toBeNull();
  });
});

describe('SvListViewComponent — bulk hotkeys', () => {
  /** Rendered, checked, hotkeys on — the state every test below starts from. */
  async function armed(extra: Record<string, unknown> = {}) {
    const f = await setup({ checkable: true, bulkActions, enableBulkHotkeys: true, ...extra });
    f.componentInstance.toggleCheck(items()[0], true);
    f.detectChanges();
    const fired: string[] = [];
    f.componentInstance.bulkActionClick.subscribe((e) => fired.push(e.action.id));
    return { f, fired };
  }

  it.each([
    ['Delete', 'delete'],
    ['Backspace', 'delete'],
    ['a', 'archive'],
    ['r', 'mark-read'],
  ])('runs %s through the built-in fallback map', async (key, actionId) => {
    const { f, fired } = await armed();
    expect(press(f, key).defaultPrevented).toBe(true);
    expect(fired).toEqual([actionId]);
  });

  /** The map is keyed on the lower-cased key, so Shift+A still archives. */
  it('is case-insensitive', async () => {
    const { f, fired } = await armed();
    press(f, 'A', { shiftKey: true });
    expect(fired).toEqual(['archive']);
  });

  it('prefers an explicitly mapped hotkey over the fallback', async () => {
    const { f, fired } = await armed({ bulkHotkeys: { a: 'delete', x: 'archive' } });
    press(f, 'a');
    press(f, 'x');
    expect(fired).toEqual(['delete', 'archive']);
  });

  /** A key nobody mapped must not silently run the nearest action. */
  it('ignores an unmapped key', async () => {
    const { f, fired } = await armed();
    expect(press(f, 'z').defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
  });

  /** A stale hotkey map pointing at an action the host removed must be inert. */
  it('ignores a hotkey mapped to an action that is not on the board', async () => {
    const { f, fired } = await armed({ bulkHotkeys: { q: 'no-such-action' } });
    expect(press(f, 'q').defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
  });

  it('does nothing when hotkeys are switched off', async () => {
    const { f, fired } = await armed({ enableBulkHotkeys: false });
    expect(press(f, 'Delete').defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
  });

  /** A destructive hotkey with nothing selected would be a very bad surprise. */
  it('does nothing while the selection is empty', async () => {
    const f = await setup({ checkable: true, bulkActions, enableBulkHotkeys: true });
    const fired: string[] = [];
    f.componentInstance.bulkActionClick.subscribe((e) => fired.push(e.action.id));
    expect(press(f, 'Delete').defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
  });

  it('does nothing when the host supplied no bulk actions', async () => {
    const f = await setup({ checkable: true, bulkActions: [], enableBulkHotkeys: true });
    f.componentInstance.toggleCheck(items()[0], true);
    const fired: string[] = [];
    f.componentInstance.bulkActionClick.subscribe((e) => fired.push(e.action.id));
    expect(press(f, 'Delete').defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
  });

  /**
   * Ctrl/Cmd/Alt combinations belong to the browser and the OS — Cmd+A is
   * "select all", not "archive".
   */
  it.each([['metaKey'], ['ctrlKey'], ['altKey']])('yields %s combinations to the browser', async (
    modifier,
  ) => {
    const { f, fired } = await armed();
    expect(press(f, 'a', { [modifier]: true }).defaultPrevented).toBe(false);
    expect(fired).toEqual([]);
  });

  /** Typing "a" into the search box must not archive the mail you were looking for. */
  it.each([['input'], ['textarea'], ['select']])('yields to a <%s> in the list', async (tag) => {
    const { f, fired } = await armed();
    const field = document.createElement(tag);
    root(f).appendChild(field);
    press(f, 'a', {}, field as HTMLElement);
    expect(fired).toEqual([]);
    field.remove();
  });

  it('yields to a contenteditable region', async () => {
    const { f, fired } = await armed();
    const editable = document.createElement('div');
    // jsdom does not implement `isContentEditable`, so setting `contentEditable`
    // alone leaves it undefined and the guard under test would never be reached.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    root(f).appendChild(editable);
    press(f, 'a', {}, editable);
    expect(fired).toEqual([]);
    editable.remove();
  });

  /** Roving focus is checked first, so it must not swallow a bulk hotkey. */
  it('still reaches the hotkey when roving focus declines the key', async () => {
    const { f, fired } = await armed({ enableRovingFocus: true });
    press(f, 'a');
    expect(fired).toEqual(['archive']);
  });

  /** Without checkboxes the hotkeys act on the selection instead. */
  it('acts on the selection when the list is not checkable', async () => {
    const f = await setup({
      selectionMode: 'multiple',
      bulkActions,
      enableBulkHotkeys: true,
    });
    f.componentInstance.toggleSelected(items()[1], true);
    f.detectChanges();
    const payloads: (string | number)[][] = [];
    f.componentInstance.bulkActionClick.subscribe((e) => payloads.push([...e.selectedIds]));
    press(f, 'a');
    expect(payloads).toEqual([[2]]);
  });
});
