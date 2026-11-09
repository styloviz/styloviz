import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDndListComponent, type DndItem, type DndListVariant } from './dnd-list.component';

/**
 * DD-11-I1 / M1 / I2 — every SORTABLE list variant (default, checklist,
 * compact) offers the same keyboard paths: a real handle button for grab/drop
 * and Move up / Move down buttons. The rows are the same list, so a variant
 * that drew an `aria-hidden` grip instead was mouse-only.
 */
const ITEMS: DndItem[] = [
  { id: 'a', label: 'Alpha', column: 'todo' },
  { id: 'b', label: 'Beta', column: 'in-progress' },
  { id: 'c', label: 'Gamma', column: 'done' },
];

async function setup(variant: DndListVariant, inputs: Record<string, unknown> = {}, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDndListComponent, {
    inputs: { items: ITEMS, variant, ...inputs },
    on,
  });
  return fixture;
}

type F = Awaited<ReturnType<typeof setup>>;
const qa = (f: F, sel: string) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel)];
const labels = (f: F) => (f.componentInstance as unknown as { items: () => DndItem[] }).items().map(i => i.label);
const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

const LIST_VARIANTS: DndListVariant[] = ['default', 'checklist', 'compact'];

describe('SvDndListComponent — handle and move buttons in every list variant', () => {
  it.each(LIST_VARIANTS)('%s: the handle is a real, named button', async (variant) => {
    const f = await setup(variant);
    const h = qa(f, '[data-dnd-handle]');
    expect(h).toHaveLength(3);
    expect(h.every(b => b.tagName === 'BUTTON' && b.getAttribute('aria-hidden') === null)).toBe(true);
    expect(h[0].getAttribute('aria-label')).toBe('Reorder Alpha');
  });

  it.each(LIST_VARIANTS)('%s: grab, arrow and drop commits ONE reorder', async (variant) => {
    const seen: unknown[] = [];
    const f = await setup(variant, {}, { reordered: (e: unknown) => seen.push(e) });
    key(qa(f, '[data-dnd-handle]')[0], ' ');
    f.detectChanges();
    expect(qa(f, '[data-dnd-handle]')[0].getAttribute('aria-pressed')).toBe('true');
    key(qa(f, '[data-dnd-handle]')[0], 'ArrowDown');
    f.detectChanges();
    expect(labels(f)).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(seen).toHaveLength(0);
    key(qa(f, '[data-dnd-handle]')[1], ' ');
    f.detectChanges();
    expect(seen).toHaveLength(1);
  });

  it.each(LIST_VARIANTS)('%s: escape restores the original order', async (variant) => {
    const f = await setup(variant);
    key(qa(f, '[data-dnd-handle]')[0], 'Enter');
    f.detectChanges();
    key(qa(f, '[data-dnd-handle]')[0], 'ArrowDown');
    f.detectChanges();
    key(qa(f, '[data-dnd-handle]')[1], 'Escape');
    f.detectChanges();
    expect(labels(f)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it.each(LIST_VARIANTS)('%s: Move up / Move down buttons reorder, boundaries disabled', async (variant) => {
    const f = await setup(variant);
    const ups = qa(f, '[aria-label="Move up"]') as HTMLButtonElement[];
    const downs = qa(f, '[aria-label="Move down"]') as HTMLButtonElement[];
    expect(ups).toHaveLength(3);
    expect(ups[0].disabled).toBe(true);
    expect(downs[2].disabled).toBe(true);
    downs[0].click();
    f.detectChanges();
    expect(labels(f)).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it.each(LIST_VARIANTS)('%s: handle-only mode is armed by the grip', async (variant) => {
    const f = await setup(variant, { useHandle: true });
    const c = f.componentInstance as unknown as { canDrag: (i: DndItem) => boolean };
    expect(c.canDrag(ITEMS[0])).toBe(false);
    qa(f, '[data-dnd-handle]')[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(c.canDrag(ITEMS[0])).toBe(true);
  });

  it.each(LIST_VARIANTS)('%s: no handles or move buttons when sortable is off', async (variant) => {
    const f = await setup(variant, { sortable: false });
    expect(qa(f, '[data-dnd-handle]')).toHaveLength(0);
    if (variant !== 'default') expect(qa(f, '[aria-label="Move up"]')).toHaveLength(0);
  });
});

describe('SvDndListComponent — focus after a removal, per variant', () => {
  const remove = (f: F, id: string) =>
    (f.componentInstance as unknown as { remove: (id: string) => void }).remove(id);

  it.each(['default', 'compact'] as DndListVariant[])('%s: focus moves to the row that took its place', async (variant) => {
    const f = await setup(variant);
    qa(f, '[data-dnd-remove]')[0].focus();
    remove(f, 'a');
    f.detectChanges();
    await Promise.resolve();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Beta');
  });

  it.each(['default', 'compact'] as DndListVariant[])('%s: the last row falls back to the previous one', async (variant) => {
    const f = await setup(variant);
    qa(f, '[data-dnd-remove]')[2].focus();
    remove(f, 'c');
    f.detectChanges();
    await Promise.resolve();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Beta');
  });

  it('compact: the list is a programmatic focus target, not a tab stop', async () => {
    const f = await setup('compact');
    const list = qa(f, '[data-dnd-list]');
    expect(list).toHaveLength(1);
    expect(list[0].getAttribute('tabindex')).toBe('-1');
  });

  it('compact: removing the only row never leaves focus on <body>', async () => {
    const f = await setup('compact', { items: [{ id: 'only', label: 'Only' }] });
    qa(f, '[data-dnd-remove]')[0].focus();
    remove(f, 'only');
    f.detectChanges();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(document.body);
  });
});

/**
 * WCAG 2.5.7 (Dragging Movements) — every move a kanban card can make has a
 * single-pointer path that is ALWAYS visible: hover never happens on touch,
 * so a hover/focus reveal left a tap user with nothing to tap.
 */
const COLUMN_ITEMS: DndItem[] = [
  { id: 'a', label: 'Alpha', column: 'todo' },
  { id: 'x', label: 'Xeno', column: 'done' },
  { id: 'b', label: 'Beta', column: 'todo' },
  { id: 'c', label: 'Gamma', column: 'todo' },
];
const ids = (f: F) => (f.componentInstance as unknown as { items: () => DndItem[] }).items().map(i => i.id);
const btn = (f: F, sel: string, name: string) =>
  qa(f, sel).find(b => b.getAttribute('aria-label') === name) as HTMLButtonElement;

describe('SvDndListComponent — kanban single-pointer moves (WCAG 2.5.7)', () => {
  it('shows the move buttons without hover or focus', async () => {
    const f = await setup('kanban');
    const right = qa(f, '[title="Move right"]')[0];
    const wrap = right.parentElement!;
    expect(wrap.hasAttribute('data-dnd-card-moves')).toBe(true);
    expect(wrap.className).not.toContain('opacity-0');
    expect(right.getAttribute('aria-label')).toBe('Move Alpha right');
    expect(qa(f, '[data-dnd-move-up]')).toHaveLength(3);
    expect(qa(f, '[data-dnd-move-down]')).toHaveLength(3);
  });

  it('clicking Move down reorders within the column and emits reordered', async () => {
    const seen: { items: DndItem[] }[] = [];
    const f = await setup('kanban', { items: COLUMN_ITEMS }, { reordered: (e: { items: DndItem[] }) => seen.push(e) });
    btn(f, '[data-dnd-move-down]', 'Move Alpha down').click();
    f.detectChanges();
    // Alpha swaps with Beta, its column neighbour; the Done card keeps its slot.
    expect(ids(f)).toEqual(['b', 'x', 'a', 'c']);
    expect(seen).toHaveLength(1);
    expect(seen[0].items.map(i => i.id)).toEqual(['b', 'x', 'a', 'c']);
  });

  it('clicking Move up reorders within the column, and the reorder can be rolled back', async () => {
    const seen: { items: DndItem[]; rollback: () => void }[] = [];
    const f = await setup('kanban', { items: COLUMN_ITEMS }, { reordered: (e: { items: DndItem[]; rollback: () => void }) => seen.push(e) });
    btn(f, '[data-dnd-move-up]', 'Move Gamma up').click();
    f.detectChanges();
    expect(ids(f)).toEqual(['a', 'x', 'c', 'b']);
    seen[0].rollback();
    expect(ids(f)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('disables Move up on the first card and Move down on the last card of each column', async () => {
    const f = await setup('kanban', { items: COLUMN_ITEMS });
    expect(btn(f, '[data-dnd-move-up]', 'Move Alpha up').disabled).toBe(true);
    expect(btn(f, '[data-dnd-move-down]', 'Move Alpha down').disabled).toBe(false);
    expect(btn(f, '[data-dnd-move-down]', 'Move Gamma down').disabled).toBe(true);
    expect(btn(f, '[data-dnd-move-up]', 'Move Gamma up').disabled).toBe(false);
    // A card alone in its column can move neither way.
    expect(btn(f, '[data-dnd-move-up]', 'Move Xeno up').disabled).toBe(true);
    expect(btn(f, '[data-dnd-move-down]', 'Move Xeno down').disabled).toBe(true);
  });

  it('disables in-column moves while a save is in flight', async () => {
    const seen: unknown[] = [];
    const f = await setup('kanban', { items: COLUMN_ITEMS, saving: true }, { reordered: (e: unknown) => seen.push(e) });
    const down = btn(f, '[data-dnd-move-down]', 'Move Alpha down');
    expect(down.disabled).toBe(true);
    down.click();
    expect(seen).toHaveLength(0);
  });
});

/**
 * ★ DA-04 — `itemClick` was declared and documented ("Sortable with item
 *   click" in /docs) and nothing emitted it. It is opt-in through `clickable`:
 *   a label button nobody listens to would be a focusable control that does
 *   nothing, so without `clickable` the label stays text.
 */
const ALL_VARIANTS: DndListVariant[] = ['default', 'checklist', 'kanban', 'compact'];

describe('SvDndListComponent — item activation (clickable / itemClick)', () => {
  it.each(ALL_VARIANTS)('%s: a label is text, not a control, unless the list is clickable', async (variant) => {
    const f = await setup(variant);
    expect(qa(f, 'button[data-dnd-item-label]')).toHaveLength(0);
    expect(qa(f, 'p[data-dnd-item-label]').map(p => p.textContent?.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it.each(ALL_VARIANTS)('%s: a clickable label is a native button that emits its item', async (variant) => {
    const clicked: DndItem[] = [];
    const f = await setup(variant, { clickable: true }, { itemClick: (item: DndItem) => clicked.push(item) });
    const buttons = qa(f, 'button[data-dnd-item-label]');
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(buttons.every(b => b.getAttribute('type') === 'button')).toBe(true);

    buttons[1].click();
    expect(clicked.map(i => i.id)).toEqual(['b']);
  });
});

