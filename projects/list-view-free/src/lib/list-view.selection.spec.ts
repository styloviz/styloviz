import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem } from './list-view.component';
import { flush } from '../../../../src/testing/async';

const items = (): ListViewItem[] => [
  { id: 1, title: 'Alpha invoice' },
  { id: 2, title: 'Beta invoice' },
  { id: 3, title: 'Gamma receipt', disabled: true },
];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: items(), ...inputs },
  });
  return fixture;
}

const ids = (set: Set<string | number>) => [...set].sort();

describe('SvListViewComponent — activating a row', () => {
  /**
   * A disabled row must be inert end-to-end: no click event, no selection, no
   * announcement. The template disables its button, but `onItemActivate` is
   * also reachable from the nested branch and from a host calling it directly.
   */
  it('ignores a disabled row entirely', async () => {
    const f = await setup({ selectionMode: 'single' });
    const c = f.componentInstance;
    let clicks = 0;
    let selections = 0;
    c.itemClick.subscribe(() => clicks++);
    c.selectionChange.subscribe(() => selections++);

    c.onItemActivate({ id: 3, title: 'Gamma receipt', disabled: true });

    expect(clicks).toBe(0);
    expect(selections).toBe(0);
    expect(c.selectedIds().size).toBe(0);
  });

  /** selectionMode 'none' still reports the click — it just selects nothing. */
  it('reports the click but selects nothing when selection is off', async () => {
    const f = await setup();
    const c = f.componentInstance;
    const clicked: ListViewItem[] = [];
    let selections = 0;
    c.itemClick.subscribe((e) => clicked.push(e.item));
    c.selectionChange.subscribe(() => selections++);

    c.onItemActivate(items()[0]);

    expect(clicked.map((i) => i.id)).toEqual([1]);
    expect(selections).toBe(0);
    expect(c.selectedIds().size).toBe(0);
  });

  it('replaces the whole selection in single mode', async () => {
    const f = await setup({ selectionMode: 'single' });
    const c = f.componentInstance;
    const emitted: (string | number)[][] = [];
    c.selectionChange.subscribe((s) => emitted.push(ids(s)));

    c.onItemActivate(items()[0]);
    c.onItemActivate(items()[1]);

    expect(ids(c.selectedIds())).toEqual([2]);
    expect(emitted).toEqual([[1], [2]]);
  });

  /** Single mode never deselects by re-clicking — it re-selects the same row. */
  it('keeps the row selected when it is activated twice in single mode', async () => {
    const f = await setup({ selectionMode: 'single' });
    const c = f.componentInstance;
    c.onItemActivate(items()[0]);
    c.onItemActivate(items()[0]);
    expect(ids(c.selectedIds())).toEqual([1]);
  });

  it('adds then removes in multiple mode', async () => {
    const f = await setup({ selectionMode: 'multiple' });
    const c = f.componentInstance;
    const emitted: (string | number)[][] = [];
    c.selectionChange.subscribe((s) => emitted.push(ids(s)));

    c.onItemActivate(items()[0]);
    c.onItemActivate(items()[1]);
    expect(ids(c.selectedIds())).toEqual([1, 2]);

    c.onItemActivate(items()[0]);
    expect(ids(c.selectedIds())).toEqual([2]);
    expect(emitted.at(-1)).toEqual([2]);
  });

  /** The live region is the only feedback a screen-reader user gets. */
  it('announces both directions of a multiple-mode toggle', async () => {
    const f = await setup({ selectionMode: 'multiple' });
    const c = f.componentInstance;

    c.onItemActivate(items()[0]);
    await flush();
    expect(c.liveAnnouncement()).toBe('Selected Alpha invoice.');

    c.onItemActivate(items()[0]);
    await flush();
    expect(c.liveAnnouncement()).toBe('Deselected Alpha invoice.');
  });

  /** `announceActions: false` must leave the live region silent, not stale. */
  it('stays silent when announcements are switched off', async () => {
    const f = await setup({ selectionMode: 'single', announceActions: false });
    const c = f.componentInstance;
    c.onItemActivate(items()[0]);
    await flush();
    expect(c.liveAnnouncement()).toBe('');
  });
});

describe('SvListViewComponent — the selection control', () => {
  it('refuses to select through a disabled row', async () => {
    const f = await setup({ selectionMode: 'multiple' });
    const c = f.componentInstance;
    let selections = 0;
    c.selectionChange.subscribe(() => selections++);

    c.toggleSelected({ id: 3, title: 'Gamma receipt', disabled: true }, true);

    expect(c.selectedIds().size).toBe(0);
    expect(selections).toBe(0);
  });

  /** With selection off the control should not exist, and must not act if it does. */
  it('does nothing when selectionMode is none', async () => {
    const f = await setup();
    const c = f.componentInstance;
    let selections = 0;
    c.selectionChange.subscribe(() => selections++);

    c.toggleSelected(items()[0], true);

    expect(c.selectedIds().size).toBe(0);
    expect(selections).toBe(0);
  });

  it('clears the selection when a single-mode control is unchecked', async () => {
    const f = await setup({ selectionMode: 'single' });
    const c = f.componentInstance;
    c.toggleSelected(items()[0], true);
    expect(ids(c.selectedIds())).toEqual([1]);

    c.toggleSelected(items()[0], false);
    expect(c.selectedIds().size).toBe(0);
  });

  it('adds and removes individually in multiple mode', async () => {
    const f = await setup({ selectionMode: 'multiple' });
    const c = f.componentInstance;
    c.toggleSelected(items()[0], true);
    c.toggleSelected(items()[1], true);
    expect(ids(c.selectedIds())).toEqual([1, 2]);

    c.toggleSelected(items()[0], false);
    expect(ids(c.selectedIds())).toEqual([2]);
  });

  it('renders a radio in single mode and a checkbox in multiple mode', async () => {
    const single = await setup({ selectionMode: 'single' });
    expect(
      single.nativeElement.querySelector('input[name="list-view-select"]')?.getAttribute('type'),
    ).toBe('radio');

    const multi = await setup({ selectionMode: 'multiple' });
    expect(
      multi.nativeElement.querySelector('input[name="list-view-select"]')?.getAttribute('type'),
    ).toBe('checkbox');
  });

  /** Checkboxes win: a row cannot carry both a check control and a select control. */
  it('hides the selection control when the list is checkable', async () => {
    const f = await setup({ selectionMode: 'multiple', checkable: true });
    expect(f.nativeElement.querySelector('input[name="list-view-select"]')).toBeNull();
    expect(f.componentInstance.isCheckable()).toBe(true);
  });

  /**
   * ★ Defect regression. The free row controls shipped with no accessible name
   * at all — a screen reader announced a bare "checkbox" with no clue which row
   * it belonged to, in the tree, the flat list and the virtualized list alike.
   * The Pro twin already carried these labels.
   */
  it('names every row control after the row it belongs to', async () => {
    const selectable = await setup({ selectionMode: 'multiple' });
    expect(
      [...selectable.nativeElement.querySelectorAll('input[name="list-view-select"]')].map((i) =>
        i.getAttribute('aria-label'),
      ),
    ).toEqual(['Select Alpha invoice', 'Select Beta invoice', 'Select Gamma receipt']);

    const checkable = await setup({ checkable: true });
    expect(
      [...checkable.nativeElement.querySelectorAll('[data-lv-row-btn="1"]')].map(
        (b) => b.parentElement?.querySelector('input[type="checkbox"]')?.getAttribute('aria-label'),
      ),
    ).toEqual(['Check Alpha invoice', 'Check Beta invoice', 'Check Gamma receipt']);
  });

  it('names the tree row controls too', async () => {
    const f = await setup({
      nested: true,
      checkable: true,
      items: [{ id: 1, title: 'Alpha invoice', children: [{ id: 11, title: 'Child' }] }],
    });
    // Scoped to the row: the header "Select all" box is first in the document
    // and takes its name from the <label> around it.
    const row = f.nativeElement.querySelector('[data-lv-row-btn="1"]')?.parentElement as HTMLElement;
    expect(row.querySelector('input[type="checkbox"]')?.getAttribute('aria-label')).toBe(
      'Check Alpha invoice',
    );
  });

  it('reflects the selection back through isSelected', async () => {
    const f = await setup({ selectionMode: 'multiple' });
    const c = f.componentInstance;
    expect(c.isSelected(items()[0])).toBe(false);
    c.toggleSelected(items()[0], true);
    expect(c.isSelected(items()[0])).toBe(true);
    expect(c.isSelected(items()[1])).toBe(false);
  });
});

describe('SvListViewComponent — checkboxes', () => {
  it('refuses to check a disabled row', async () => {
    const f = await setup({ checkable: true });
    const c = f.componentInstance;
    let changes = 0;
    c.checkChange.subscribe(() => changes++);

    c.toggleCheck({ id: 3, title: 'Gamma receipt', disabled: true }, true);

    expect(c.checkedIds().size).toBe(0);
    expect(changes).toBe(0);
  });

  it('checks and unchecks a row and reports both', async () => {
    const f = await setup({ checkable: true });
    const c = f.componentInstance;
    const seen: boolean[] = [];
    c.checkChange.subscribe((e) => seen.push(e.checked));

    c.toggleCheck(items()[0], true);
    expect(ids(c.checkedIds())).toEqual([1]);
    c.toggleCheck(items()[0], false);
    expect(c.checkedIds().size).toBe(0);
    expect(seen).toEqual([true, false]);
    expect(c.checkedCount()).toBe(0);
  });

  /**
   * ★ Defect regression. "Select all" used to sweep in disabled rows, which the
   * per-row control refuses to check — and because that control is `[disabled]`,
   * the user could then never uncheck them, so a bulk action silently applied to
   * a row the UI had greyed out.
   */
  it('leaves disabled rows out of select-all', async () => {
    const f = await setup({ checkable: true });
    const c = f.componentInstance;
    c.toggleAllChecks(true);
    expect(ids(c.checkedIds())).toEqual([1, 2]);
    // The disabled row is still *visible* — it is only excluded from checking.
    expect(c.allVisibleIds()).toEqual([1, 2, 3]);
    expect(c.checkableVisibleIds()).toEqual([1, 2]);
  });

  /** …and the header checkbox must still read as fully checked, or it is unusable. */
  it('still reports all-checked when only the enabled rows are checked', async () => {
    const f = await setup({ checkable: true });
    const c = f.componentInstance;
    c.toggleAllChecks(true);
    expect(c.allChecked()).toBe(true);
    f.detectChanges();
    const selectAll = f.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(selectAll.checked).toBe(true);
  });

  it('clears every check when select-all is unticked', async () => {
    const f = await setup({ checkable: true });
    const c = f.componentInstance;
    c.toggleAllChecks(true);
    c.toggleAllChecks(false);
    expect(c.checkedIds().size).toBe(0);
    expect(c.allChecked()).toBe(false);
  });

  /** An empty list is not "all checked" — `[].every()` is true, hence the guard. */
  it('is not all-checked when there is nothing to check', async () => {
    const f = await setup({ checkable: true, items: [] as ListViewItem[] });
    expect(f.componentInstance.allChecked()).toBe(false);
  });

  /** A list of only disabled rows has nothing selectable, so select-all is a no-op. */
  it('is not all-checked when every row is disabled', async () => {
    const f = await setup({
      checkable: true,
      items: [{ id: 9, title: 'Locked', disabled: true }] as ListViewItem[],
    });
    const c = f.componentInstance;
    c.toggleAllChecks(true);
    expect(c.checkedIds().size).toBe(0);
    expect(c.allChecked()).toBe(false);
  });

  it('announces the count it checked and the clearing of it', async () => {
    const f = await setup({ checkable: true });
    const c = f.componentInstance;

    c.toggleAllChecks(true);
    await flush();
    expect(c.liveAnnouncement()).toBe('Selected all 2 visible items.');

    c.toggleAllChecks(false);
    await flush();
    expect(c.liveAnnouncement()).toBe('Cleared all selected items.');
  });

  it('shows the checked tally in the footer', async () => {
    const f = await setup({ checkable: true });
    f.componentInstance.toggleCheck(items()[0], true);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('1 checked');
  });
});

describe('SvListViewComponent — what bulk actions act on', () => {
  const bulkActions = [{ id: 'archive', label: 'Archive' }];

  /** Checkboxes are the bulk selection when the list is checkable… */
  it('acts on the checked rows when the list is checkable', async () => {
    const f = await setup({ checkable: true, bulkActions, selectionMode: 'multiple' });
    const c = f.componentInstance;
    c.toggleCheck(items()[0], true);
    c.toggleSelected(items()[1], true);

    expect(ids(c.bulkSelectedIds())).toEqual([1]);
    expect(c.bulkSelectedCount()).toBe(1);
  });

  /** …and the selection is the bulk selection when it is not. */
  it('falls back to the selected rows when there are no checkboxes', async () => {
    const f = await setup({ bulkActions, selectionMode: 'multiple' });
    const c = f.componentInstance;
    c.toggleSelected(items()[1], true);
    expect(ids(c.bulkSelectedIds())).toEqual([2]);
  });

  it('hands the action a snapshot of the selection, not a live reference', async () => {
    const f = await setup({ checkable: true, bulkActions });
    const c = f.componentInstance;
    c.toggleCheck(items()[0], true);

    let payload: Set<string | number> | null = null;
    c.bulkActionClick.subscribe((e) => (payload = e.selectedIds));
    c.onBulkAction(bulkActions[0]);

    c.toggleCheck(items()[1], true);
    expect(ids(payload as unknown as Set<string | number>)).toEqual([1]);
  });

  /** Singular vs plural in the announcement — an easy thing to get wrong. */
  it('pluralises the announcement on the count', async () => {
    const f = await setup({ checkable: true, bulkActions });
    const c = f.componentInstance;

    c.toggleCheck(items()[0], true);
    c.onBulkAction(bulkActions[0]);
    await flush();
    expect(c.liveAnnouncement()).toBe('Archive applied to 1 selected item.');

    c.toggleCheck(items()[1], true);
    c.onBulkAction(bulkActions[0]);
    await flush();
    expect(c.liveAnnouncement()).toBe('Archive applied to 2 selected items.');
  });

  /** The bulk bar is worth nothing with an empty selection, so it must not show. */
  it('hides the bulk bar until something is selected', async () => {
    const f = await setup({ checkable: true, bulkActions });
    const c = f.componentInstance;
    const bar = () =>
      [...f.nativeElement.querySelectorAll('button')].find((b) => b.textContent?.includes('Archive'));

    expect(bar()).toBeUndefined();
    c.toggleCheck(items()[0], true);
    f.detectChanges();
    expect(bar()).toBeTruthy();
  });
});

describe('SvListViewComponent — quick actions', () => {
  const quickActions = [{ id: 'reply', label: 'Reply', tone: 'primary' as const }];

  it('does not fire a quick action on a disabled row', async () => {
    const f = await setup({ showQuickActions: true, quickActions });
    const c = f.componentInstance;
    let fired = 0;
    c.quickActionClick.subscribe(() => fired++);

    c.onQuickAction({ id: 3, title: 'Gamma receipt', disabled: true }, quickActions[0]);
    expect(fired).toBe(0);
  });

  it('reports the row and the action together', async () => {
    const f = await setup({ showQuickActions: true, quickActions });
    const c = f.componentInstance;
    const seen: string[] = [];
    c.quickActionClick.subscribe((e) => seen.push(`${e.item.id}:${e.action.id}`));

    c.onQuickAction(items()[0], quickActions[0]);
    await flush();

    expect(seen).toEqual(['1:reply']);
    expect(c.liveAnnouncement()).toBe('Reply action triggered for Alpha invoice.');
  });

  /** Both halves of the flag matter: an empty action list renders no strip. */
  it('needs both the flag and at least one action to render the strip', async () => {
    expect((await setup({ showQuickActions: true, quickActions: [] })).componentInstance.hasQuickActions()).toBe(false);
    expect((await setup({ showQuickActions: false, quickActions })).componentInstance.hasQuickActions()).toBe(false);
    expect((await setup({ showQuickActions: true, quickActions })).componentInstance.hasQuickActions()).toBe(true);
  });
});
