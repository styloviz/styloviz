import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  SvDndListComponent,
  type DndItem,
  type DndItemChangeEvent,
  type DndRemoveEvent,
  type DndReorderEvent,
} from './dnd-list.component';
import { until } from '../../../../src/testing/async';

const ITEMS: DndItem[] = [
  { id: 'a', label: 'Alpha', priority: 'high', column: 'todo' },
  { id: 'b', label: 'Beta', column: 'in-progress' },
  { id: 'c', label: 'Gamma', completed: true, column: 'done' },
];

async function setup(inputs: Record<string, unknown> = {}, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDndListComponent, {
    inputs: { items: ITEMS, ...inputs },
    on,
  });
  return fixture;
}

const q = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector<HTMLElement>(sel);
const qa = (f: { nativeElement: HTMLElement }, sel: string) => [
  ...f.nativeElement.querySelectorAll<HTMLElement>(sel),
];

const dragEvent = (type: string) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  return e as unknown as DragEvent;
};

describe('SvDndListComponent — states', () => {
  it('shows the skeleton while loading, and no rows', async () => {
    const f = await setup({ loading: true });
    expect(q(f, '[data-sv-state="loading"]')).not.toBeNull();
    expect(qa(f, 'li').length).toBe(0);
  });

  it('shows the empty shell for an empty list', async () => {
    const f = await setup({ items: [] });
    expect(q(f, '[data-sv-state="empty"]')).not.toBeNull();
  });

  /**
   * A save failure must NOT hide the rows: the user has to be able to see the
   * order that failed to persist.
   */
  it('renders the error above the rows, not instead of them', async () => {
    let retries = 0;
    const f = await setup({ error: 'save failed' }, { retry: () => retries++ });
    expect(q(f, '[data-sv-state="error"]')).not.toBeNull();
    expect(qa(f, 'li').length).toBe(3);
    q(f, '[data-sv-state="error"]')!.querySelector<HTMLButtonElement>('button')?.click();
    expect(retries).toBe(1);
  });

  it('renders a heading only when given a label', async () => {
    expect(q(await setup(), 'h3')).toBeNull();
    expect(q(await setup({ label: 'Tasks' }), 'h3')!.textContent).toContain('Tasks');
  });
});

describe('SvDndListComponent — reorder', () => {
  it('moves a row down and reports the new order', async () => {
    const events: DndReorderEvent[] = [];
    const f = await setup({}, { reordered: (e: DndReorderEvent) => events.push(e) });
    f.componentInstance.moveDown(0);
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(events[0].items.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves a row up', async () => {
    const f = await setup();
    f.componentInstance.moveUp(2);
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('refuses to move the first row up or the last row down', async () => {
    const events: DndReorderEvent[] = [];
    const f = await setup({}, { reordered: (e: DndReorderEvent) => events.push(e) });
    f.componentInstance.moveUp(0);
    f.componentInstance.moveDown(2);
    expect(events).toEqual([]);
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  /** `saving` blocks reordering so two saves cannot race over one rollback. */
  it('accepts no reorder at all while a save is in flight', async () => {
    const events: DndReorderEvent[] = [];
    const f = await setup({ saving: true }, { reordered: (e: DndReorderEvent) => events.push(e) });
    f.componentInstance.moveUp(1);
    f.componentInstance.moveDown(0);
    f.componentInstance.remove('a');
    f.componentInstance.onDragStart(0);
    expect(f.componentInstance.isDragging()).toBe(false);
    expect(events).toEqual([]);
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('disables the boundary move buttons in the DOM', async () => {
    const f = await setup();
    const ups = qa(f, '[aria-label="Move up"]') as HTMLButtonElement[];
    const downs = qa(f, '[aria-label="Move down"]') as HTMLButtonElement[];
    expect(ups[0].disabled).toBe(true);
    expect(ups[1].disabled).toBe(false);
    expect(downs[2].disabled).toBe(true);
  });

  it('restores the previous order through rollback', async () => {
    const events: DndReorderEvent[] = [];
    const f = await setup({}, { reordered: (e: DndReorderEvent) => events.push(e) });
    f.componentInstance.moveDown(0);
    events[0].rollback();
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  /**
   * A stale rollback would undo the LATER move as well, silently. It refuses
   * instead — the whole point of the sequence guard.
   */
  it('refuses a rollback that a later reorder has overtaken', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const events: DndReorderEvent[] = [];
      const f = await setup({}, { reordered: (e: DndReorderEvent) => events.push(e) });
      f.componentInstance.moveDown(0); // a,b,c -> b,a,c
      f.componentInstance.moveDown(0); // b,a,c -> a,b,c … via a second move
      events[0].rollback();
      expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
      expect(warn).toHaveBeenCalled();
      // The newest handle still works.
      events[1].rollback();
      expect(f.componentInstance.items().map((i) => i.id)).toEqual(['b', 'a', 'c']);
    } finally {
      warn.mockRestore();
    }
  });

  it('announces the move for screen readers', async () => {
    const f = await setup();
    f.componentInstance.moveDown(0);
    await until(() => f.componentInstance.liveMessage() !== '', { label: 'the announcement' });
    expect(f.componentInstance.liveMessage()).toBe('Alpha moved down to position 2 of 3.');

    f.componentInstance.moveUp(1);
    await until(() => f.componentInstance.liveMessage().includes('up'));
    expect(f.componentInstance.liveMessage()).toBe('Alpha moved up to position 1 of 3.');
  });
});

describe('SvDndListComponent — drag and drop', () => {
  it('reorders on drop and clears the drag state', async () => {
    const f = await setup();
    f.componentInstance.onDragStart(2);
    f.componentInstance.onDragOver(dragEvent('dragover'), 0);
    expect(f.componentInstance.overIndex()).toBe(0);
    f.componentInstance.onDrop(dragEvent('drop'), 0);

    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(f.componentInstance.dragIndex()).toBe(-1);
    expect(f.componentInstance.overIndex()).toBe(-1);
    expect(f.componentInstance.isDragging()).toBe(false);
  });

  it('claims the dragover event so the drop can happen at all', async () => {
    const f = await setup();
    const e = dragEvent('dragover');
    f.componentInstance.onDragOver(e, 1);
    expect((e as unknown as Event).defaultPrevented).toBe(true);
  });

  it('does nothing when a row is dropped onto itself', async () => {
    const events: DndReorderEvent[] = [];
    const f = await setup({}, { reordered: (e: DndReorderEvent) => events.push(e) });
    f.componentInstance.onDragStart(1);
    f.componentInstance.onDrop(dragEvent('drop'), 1);
    expect(events).toEqual([]);
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores a drop that never had a drag start', async () => {
    const events: DndReorderEvent[] = [];
    const f = await setup({}, { reordered: (e: DndReorderEvent) => events.push(e) });
    f.componentInstance.onDrop(dragEvent('drop'), 2);
    expect(events).toEqual([]);
  });

  it('resets on dragend', async () => {
    const f = await setup();
    f.componentInstance.onDragStart(0);
    f.componentInstance.onDragEnd();
    expect(f.componentInstance.isDragging()).toBe(false);
    expect(f.componentInstance.dragIndex()).toBe(-1);
  });
});

describe('SvDndListComponent — what may be dragged', () => {
  it('lets any enabled row be dragged by default', async () => {
    const f = await setup();
    expect(f.componentInstance.canDrag(ITEMS[0])).toBe(true);
    expect(qa(f, 'li')[0].getAttribute('draggable')).toBe('true');
  });

  it('never lets a disabled row be dragged', async () => {
    const f = await setup({ items: [{ id: 'x', label: 'X', disabled: true }] });
    expect(f.componentInstance.canDrag({ id: 'x', label: 'X', disabled: true })).toBe(false);
  });

  it('never lets anything be dragged when sortable is off', async () => {
    const f = await setup({ sortable: false });
    expect(f.componentInstance.canDrag(ITEMS[0])).toBe(false);
    // …and the grip disappears with it.
    expect(qa(f, '.cursor-grab').length).toBe(0);
  });

  it('requires the grip to arm the row in handle-only mode', async () => {
    const f = await setup({ useHandle: true });
    expect(f.componentInstance.canDrag(ITEMS[0])).toBe(false);

    f.componentInstance.armHandle();
    expect(f.componentInstance.canDrag(ITEMS[0])).toBe(true);
  });

  it('does not arm anything when handle-only mode is off', async () => {
    const f = await setup();
    f.componentInstance.armHandle();
    expect(f.componentInstance.handleArmed()).toBe(false);
  });

  /** A click on the grip that never became a drag must not leave it armed. */
  it('disarms on mouseup when no drag started', async () => {
    const f = await setup({ useHandle: true });
    f.componentInstance.armHandle();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(f.componentInstance.handleArmed()).toBe(false);
  });

  it('stays armed on a mouseup that happens mid-drag', async () => {
    const f = await setup({ useHandle: true });
    f.componentInstance.armHandle();
    f.componentInstance.onDragStart(0);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(f.componentInstance.handleArmed()).toBe(true);
  });
});

describe('SvDndListComponent — item actions', () => {
  it('removes an item and announces what is left', async () => {
    const f = await setup();
    qa(f, '[aria-label="Remove Beta"]')[0].click();
    f.detectChanges();
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'c']);
    await until(() => f.componentInstance.liveMessage() !== '');
    expect(f.componentInstance.liveMessage()).toBe('Beta removed. 2 items remaining.');
  });

  it('uses the singular when one item is left', async () => {
    const f = await setup({ items: ITEMS.slice(0, 2) });
    f.componentInstance.remove('a');
    await until(() => f.componentInstance.liveMessage() !== '');
    expect(f.componentInstance.liveMessage()).toContain('1 item remaining');
  });

  it('reports nothing for an id that matches nothing', async () => {
    // It used to emit anyway, which handed the host a rollback handle for a
    // change that had not happened and an announcement with no subject.
    const removed: DndRemoveEvent[] = [];
    const reordered: DndReorderEvent[] = [];
    const f = await setup({}, {
      itemRemoved: (e: DndRemoveEvent) => removed.push(e),
      reordered: (e: DndReorderEvent) => reordered.push(e),
    });
    f.componentInstance.remove('nope');
    expect(f.componentInstance.items().length).toBe(3);
    expect(removed).toEqual([]);
    expect(reordered).toEqual([]);
    expect(f.componentInstance.liveMessage()).toBe('');
  });

  it('toggles completion both ways and announces each', async () => {
    const f = await setup({ variant: 'checklist' });
    f.componentInstance.toggleComplete('a');
    await until(() => f.componentInstance.liveMessage() !== '');
    expect(f.componentInstance.liveMessage()).toBe('Alpha marked complete.');

    f.componentInstance.toggleComplete('a');
    await until(() => f.componentInstance.liveMessage().includes('incomplete'));
    expect(f.componentInstance.liveMessage()).toBe('Alpha marked incomplete.');
  });

  it('says nothing when the id to complete is not in the list', async () => {
    const f = await setup({ variant: 'checklist' });
    f.componentInstance.toggleComplete('nope');
    expect(f.componentInstance.liveMessage()).toBe('');
  });

  /**
   * ============================================================================
   *  Every change is reported, and every change can be undone (audit item X-7)
   * ============================================================================
   *
   * Three of these actions were silent or mislabelled. Removal was emitted as a
   * `reordered`, so a host that persisted the payload as an ordering never
   * called its delete endpoint and the row returned on the next load. Ticking a
   * checklist box and dragging a card between kanban columns emitted nothing at
   * all — the change looked saved, and a reload put it back.
   */
  it('reports a removal as a removal, with the row it took out', async () => {
    const removed: DndRemoveEvent[] = [];
    const reordered: DndReorderEvent[] = [];
    const f = await setup({}, {
      itemRemoved: (e: DndRemoveEvent) => removed.push(e),
      reordered: (e: DndReorderEvent) => reordered.push(e),
    });

    f.componentInstance.remove('b');
    expect(removed).toHaveLength(1);
    expect(removed[0].item.id).toBe('b');
    expect(removed[0].items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(reordered).toEqual([]);
  });

  it('puts a removed row back where it was', async () => {
    const removed: DndRemoveEvent[] = [];
    const f = await setup({}, { itemRemoved: (e: DndRemoveEvent) => removed.push(e) });

    f.componentInstance.remove('b');
    removed[0].rollback();
    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('refuses to undo a removal once a later change has landed', async () => {
    // The snapshot the first handle holds predates both changes, so restoring it
    // would put 'b' back AND silently undo the completion of 'a'.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const removed: DndRemoveEvent[] = [];
    const f = await setup({}, { itemRemoved: (e: DndRemoveEvent) => removed.push(e) });

    f.componentInstance.remove('b');
    f.componentInstance.toggleComplete('a');
    removed[0].rollback();

    expect(f.componentInstance.items().map((i) => i.id)).toEqual(['a', 'c']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[saving]'));
    warn.mockRestore();
  });

  it('reports a completion toggle, and undoes it', async () => {
    const changes: DndItemChangeEvent[] = [];
    const f = await setup({ variant: 'checklist' }, {
      itemChanged: (e: DndItemChangeEvent) => changes.push(e),
    });

    f.componentInstance.toggleComplete('a');
    expect(changes).toHaveLength(1);
    expect(changes[0].item).toEqual(expect.objectContaining({ id: 'a', completed: true }));
    expect(changes[0].items[0].completed).toBe(true);

    changes[0].rollback();
    expect(f.componentInstance.items()[0].completed).toBeFalsy();
  });

  it('reports a kanban column move, and undoes it', async () => {
    const changes: DndItemChangeEvent[] = [];
    const f = await setup({ variant: 'kanban' }, {
      itemChanged: (e: DndItemChangeEvent) => changes.push(e),
    });

    f.componentInstance.moveToCol('a', 'done');
    expect(changes).toHaveLength(1);
    expect(changes[0].item.column).toBe('done');

    changes[0].rollback();
    expect(f.componentInstance.items()[0].column).toBe('todo');
    expect(f.componentInstance.items()[0].completed).toBeFalsy();
  });

  it('accepts no completion or column move while a save is in flight', async () => {
    // Same lockout the reorder path has: a second change while the first is in
    // flight is what makes a rollback handle ambiguous.
    const changes: DndItemChangeEvent[] = [];
    const f = await setup({ saving: true, variant: 'kanban' }, {
      itemChanged: (e: DndItemChangeEvent) => changes.push(e),
    });

    f.componentInstance.toggleComplete('a');
    f.componentInstance.moveToCol('a', 'done');
    expect(changes).toEqual([]);
    expect(f.componentInstance.items()[0].column).toBe('todo');
  });

  it('reports progress, and does not divide by zero when empty', async () => {
    const f = await setup();
    expect(f.componentInstance.completedCount()).toBe(1);
    expect(f.componentInstance.progressPct()).toBe(33);

    const empty = await setup({ items: [] });
    expect(empty.componentInstance.progressPct()).toBe(0);
  });
});

describe('SvDndListComponent — kanban', () => {
  it('buckets items into their columns and shows a placeholder for an empty one', async () => {
    const f = await setup({ variant: 'kanban', items: [ITEMS[0]] });
    expect(f.componentInstance.kanbanItems('todo').map((i) => i.id)).toEqual(['a']);
    expect(f.componentInstance.kanbanItems('done')).toEqual([]);
    expect(f.nativeElement.textContent).toContain('No items');
  });

  it('marks an item complete exactly when it lands in Done', async () => {
    const f = await setup({ variant: 'kanban' });
    f.componentInstance.moveToCol('a', 'done');
    expect(f.componentInstance.items()[0].completed).toBe(true);

    f.componentInstance.moveToCol('a', 'todo');
    expect(f.componentInstance.items()[0].completed).toBe(false);
  });

  it('offers no left control in the first column and no right control in the last', async () => {
    const f = await setup({ variant: 'kanban' });
    const rows = qa(f, '[title="Move left"]');
    const rights = qa(f, '[title="Move right"]');
    // todo has only right; in-progress has both; done has only left.
    expect(rows.length).toBe(2);
    expect(rights.length).toBe(2);
  });

  it('steps through the columns one at a time from the DOM', async () => {
    const f = await setup({ variant: 'kanban', items: [ITEMS[0]] });
    q(f, '[title="Move right"]')!.click();
    f.detectChanges();
    expect(f.componentInstance.items()[0].column).toBe('in-progress');
    q(f, '[title="Move right"]')!.click();
    f.detectChanges();
    expect(f.componentInstance.items()[0].column).toBe('done');
    q(f, '[title="Move left"]')!.click();
    f.detectChanges();
    expect(f.componentInstance.items()[0].column).toBe('in-progress');
    q(f, '[title="Move left"]')!.click();
    f.detectChanges();
    expect(f.componentInstance.items()[0].column).toBe('todo');
  });
});

/**
 * ★★ THE SUITE RUNS AT Pacific/Marquesas (−09:30) — see vitest.config.ts.
 *
 * `dueDate` is a date-only ISO string. Angular's `DatePipe` parses that as a
 * LOCAL calendar date (it splits the parts), so the row renders "Jun 25".
 * `isDue()` used bare `new Date(dueDate)`, which is UTC midnight — 14:30 on the
 * 24th here. So west of UTC the row went red while still showing tomorrow's
 * date, for the last ~9.5 hours of the day before AND all of the due day.
 */
describe('SvDndListComponent — due dates across the date line', () => {
  const withDue = (dueDate: string): DndItem[] => [{ id: 'd', label: 'Task', dueDate }];

  afterEach(() => vi.useRealTimers());

  it('is not overdue on the evening before the due date', async () => {
    vi.setSystemTime(new Date(2026, 5, 24, 20, 0, 0)); // 24 June 20:00 LOCAL
    const f = await setup({ items: withDue('2026-06-25') });
    expect(f.componentInstance.isDue('2026-06-25')).toBe(false);
    expect(qa(f, '.text-danger-500').length).toBe(0);
  });

  it('is not overdue during the due day itself', async () => {
    vi.setSystemTime(new Date(2026, 5, 25, 11, 0, 0)); // 25 June 11:00 LOCAL
    const f = await setup({ items: withDue('2026-06-25') });
    expect(f.componentInstance.isDue('2026-06-25')).toBe(false);
  });

  it('is overdue once the due day has passed locally', async () => {
    vi.setSystemTime(new Date(2026, 5, 26, 0, 30, 0)); // 26 June 00:30 LOCAL
    const f = await setup({ items: withDue('2026-06-25') });
    expect(f.componentInstance.isDue('2026-06-25')).toBe(true);
    expect(qa(f, '.text-danger-600').length).toBe(1);
  });

  it('shows the same day it was given', async () => {
    vi.setSystemTime(new Date(2026, 5, 24, 20, 0, 0));
    const f = await setup({ items: withDue('2026-06-25') });
    // If the flag and the label disagreed, one of them was lying.
    expect(f.nativeElement.textContent).toContain('Jun 25');
  });

  it('still honours a full timestamp to the minute', async () => {
    vi.setSystemTime(new Date(2026, 5, 25, 12, 0, 0));
    const f = await setup();
    expect(f.componentInstance.isDue('2026-06-25T11:00:00-09:30')).toBe(true);
    expect(f.componentInstance.isDue('2026-06-25T13:00:00-09:30')).toBe(false);
  });

  it('treats a missing due date as never due', async () => {
    const f = await setup();
    expect(f.componentInstance.isDue(undefined)).toBe(false);
    expect(f.componentInstance.isDue('')).toBe(false);
  });

  it('greys out a completed row even when it is overdue', async () => {
    vi.setSystemTime(new Date(2026, 5, 26, 12, 0, 0));
    const f = await setup({ items: [{ id: 'd', label: 'Task', dueDate: '2026-06-25', completed: true }] });
    expect(qa(f, '.text-danger-500').length).toBe(0);
  });
});

describe('SvDndListComponent — duplicate ids (audit item X-6)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  /**
   * A reorder list is the worst place for a colliding id: `track item.id` meets
   * the repeat with NG0955 and empties the list, and the drop handlers address
   * rows by id, so a duplicate would move the wrong one. `DndItem.id` is required
   * by the type, which cannot require it to be unique — hence the dev-mode check.
   *
   * ⚠ One warning per context, ever (module-level memo in `@styloviz/core`), so
   * this is asserted once. The diagnostic's own edge cases live in
   * `projects/core/src/lib/data/item-key.spec.ts`.
   */
  it('names the input and the colliding id', async () => {
    await setup({
      items: [
        { id: 'dup', label: 'Alpha' },
        { id: 'dup', label: 'Beta' },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sv-dnd-list [items]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"dup"'));
  });

  it('says nothing about a well-formed list', async () => {
    await setup();
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * The keyboard path is the primary path, not the fallback.
 *
 * ★★★ NATIVE HTML DRAG LARGELY DOES NOT WORK ON TOUCH, so on a phone the
 *     keyboard and assistive models are the only ones there are — which means an
 *     `aria-hidden` div for a handle is not a handle at all.
 *
 * ★★ Grab/drop exists ALONGSIDE the Move up / Move down buttons because they are
 *    a different model: those commit each step immediately, so a five-place move
 *    is five writes a host must save and possibly roll back. Grab/drop lifts
 *    once, previews, and commits on drop.
 */
describe('SvDndListComponent — keyboard grab and drop', () => {
  const handles = (f: { nativeElement: HTMLElement }) => qa(f, '[data-dnd-handle]');
  const labels = (f: { componentInstance: unknown }) =>
    (f.componentInstance as { items: () => DndItem[] }).items().map(i => i.label);
  const key = (el: HTMLElement, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  it('makes the handle a real, reachable control', async () => {
    // ★ It was an aria-hidden <div>, which no keyboard or screen reader can use.
    const f = await setup({ sortable: true });
    const h = handles(f);
    expect(h.length).toBeGreaterThan(0);
    expect(h[0].tagName).toBe('BUTTON');
    expect(h[0].getAttribute('aria-label')).toContain('Reorder');
  });

  it('lifts on space and says how to move it', async () => {
    const f = await setup({ sortable: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    const c = f.componentInstance as unknown as { grabbedIndex: () => number; liveMessage: () => string };
    expect(c.grabbedIndex()).toBe(0);
    expect(c.liveMessage()).toContain('lifted');
    expect(c.liveMessage()).toContain('arrow keys');
  });

  it('moves the lifted row with the arrows', async () => {
    const f = await setup({ sortable: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    key(handles(f)[0], 'ArrowDown');
    f.detectChanges();
    expect(labels(f)).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('announces the new position on every move', async () => {
    const f = await setup({ sortable: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    key(handles(f)[0], 'ArrowDown');
    f.detectChanges();
    const c = f.componentInstance as unknown as { liveMessage: () => string };
    expect(c.liveMessage()).toContain('position 2 of 3');
  });

  it('will not move past either end', async () => {
    const f = await setup({ sortable: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    key(handles(f)[0], 'ArrowUp');
    f.detectChanges();
    expect(labels(f)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('commits ONE reorder for the whole move, not one per keystroke', async () => {
    // ★ This is the reason the mode exists beside the move buttons.
    const seen: unknown[] = [];
    const f = await setup({ sortable: true }, { reordered: (e: unknown) => seen.push(e) });
    const h = handles(f);
    key(h[0], ' ');
    f.detectChanges();
    key(handles(f)[0], 'ArrowDown');
    f.detectChanges();
    key(handles(f)[1], 'ArrowDown');
    f.detectChanges();
    expect(seen).toHaveLength(0);
    key(handles(f)[2], ' ');
    f.detectChanges();
    expect(seen).toHaveLength(1);
  });

  it('restores the ORDER on escape, not just the flag', async () => {
    // ★ A cancel that left the item where the arrows pushed it is the opposite
    //   of a cancel — and the mistake most grab/drop implementations make.
    const f = await setup({ sortable: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    key(handles(f)[0], 'ArrowDown');
    f.detectChanges();
    expect(labels(f)).toEqual(['Beta', 'Alpha', 'Gamma']);
    key(handles(f)[1], 'Escape');
    f.detectChanges();
    expect(labels(f)).toEqual(['Alpha', 'Beta', 'Gamma']);
    const c = f.componentInstance as unknown as { grabbedIndex: () => number; liveMessage: () => string };
    expect(c.grabbedIndex()).toBe(-1);
    expect(c.liveMessage()).toContain('cancelled');
  });

  it('emits nothing at all when a move is cancelled', async () => {
    const seen: unknown[] = [];
    const f = await setup({ sortable: true }, { reordered: (e: unknown) => seen.push(e) });
    key(handles(f)[0], ' ');
    f.detectChanges();
    key(handles(f)[0], 'ArrowDown');
    f.detectChanges();
    key(handles(f)[1], 'Escape');
    f.detectChanges();
    expect(seen).toHaveLength(0);
  });

  it('ignores the arrows when nothing is lifted', async () => {
    const f = await setup({ sortable: true });
    key(handles(f)[0], 'ArrowDown');
    f.detectChanges();
    expect(labels(f)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('does nothing while a save is in flight', async () => {
    const f = await setup({ sortable: true, saving: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    expect((f.componentInstance as unknown as { grabbedIndex: () => number }).grabbedIndex()).toBe(-1);
  });

  it('marks the lifted row for a screen reader', async () => {
    const f = await setup({ sortable: true });
    key(handles(f)[0], ' ');
    f.detectChanges();
    expect(handles(f)[0].getAttribute('aria-pressed')).toBe('true');
    expect(handles(f)[0].getAttribute('aria-label')).toContain('Drop');
  });
});

/**
 * Where focus goes when the row holding it is deleted.
 *
 * ★★★ THE BUTTON THAT HAD FOCUS IS ABOUT TO LEAVE THE DOM, and the browser's
 *     answer is to drop focus on `<body>` — so the next Tab restarts at the top
 *     of the page and a keyboard user deleting three items travels back down the
 *     list three times.
 */
describe('SvDndListComponent — focus after a removal', () => {
  it('moves to the row that took its place', async () => {
    const f = await setup({});
    const removes = qa(f, '[data-dnd-remove]');
    removes[0].focus();
    (f.componentInstance as unknown as { remove: (id: string) => void }).remove('a');
    f.detectChanges();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('falls back to the previous row when the last one went', async () => {
    // There is no successor, so the neighbour above is the only sensible target.
    const f = await setup({});
    qa(f, '[data-dnd-remove]')[2].focus();
    (f.componentInstance as unknown as { remove: (id: string) => void }).remove('c');
    f.detectChanges();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('falls back to the component itself when nothing is left', async () => {
    // ★ With the last row gone there is no successor AND no list — the empty
    //   state replaces it — so the host is the only element still there. It
    //   carries tabindex="-1" to be a target without becoming a tab stop.
    const f = await setup({ items: [{ id: 'only', label: 'Only' }] });
    qa(f, '[data-dnd-remove]')[0].focus();
    (f.componentInstance as unknown as { remove: (id: string) => void }).remove('only');
    f.detectChanges();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('still announces the removal', async () => {
    const f = await setup({});
    (f.componentInstance as unknown as { remove: (id: string) => void }).remove('a');
    f.detectChanges();
    // ★ `_announce` clears the region and sets it in a microtask, so identical
    //   consecutive messages are re-read. Yield once to see the value.
    await Promise.resolve();
    const c = f.componentInstance as unknown as { liveMessage: () => string };
    expect(c.liveMessage()).toContain('removed');
    expect(c.liveMessage()).toContain('2 items remaining');
  });
});
