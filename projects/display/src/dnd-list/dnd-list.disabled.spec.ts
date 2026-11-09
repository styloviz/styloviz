import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvDndListComponent, type DndItem, type DndListVariant } from './dnd-list.component';
import { until } from '../../../../src/testing/async';

/**
 * FL-J3-DD-12 — `disabled` holds on every move path (drag, Move up/down, the
 * kanban column buttons, the keyboard grab), and a keyboard-lifted row is
 * scrolled into view as it moves instead of walking off its scroller.
 */
const ITEMS: DndItem[] = [
  { id: 'a', label: 'Alpha', column: 'todo' },
  { id: 'b', label: 'Beta', column: 'todo', disabled: true },
  { id: 'c', label: 'Gamma', column: 'todo' },
];

async function setup(variant: DndListVariant, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDndListComponent, { inputs: { items: ITEMS, variant }, on });
  return fixture;
}
type F = Awaited<ReturnType<typeof setup>>;
const qa = (f: F, sel: string) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel)];
const order = (f: F) => f.componentInstance.items().map((i) => i.id);
const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const byLabel = (f: F, label: string) => qa(f, `button[aria-label="${label}"]`);

const LIST_VARIANTS: DndListVariant[] = ['default', 'checklist', 'compact'];

describe('SvDndListComponent — disabled items do not move (DD-11-I5)', () => {
  it.each(LIST_VARIANTS)('%s: the disabled row\'s Move up / Move down buttons are disabled', async (variant) => {
    const f = await setup(variant);
    const ups = byLabel(f, 'Move up') as HTMLButtonElement[];
    const downs = byLabel(f, 'Move down') as HTMLButtonElement[];
    expect(ups[1].disabled).toBe(true);
    expect(downs[1].disabled).toBe(true);
    expect(downs[0].disabled).toBe(false); // Alpha may still move past Beta
  });

  it.each(LIST_VARIANTS)('%s: the disabled row\'s handle says it is disabled and does not lift', async (variant) => {
    const seen: unknown[] = [];
    const f = await setup(variant, { reordered: (e: unknown) => seen.push(e) });
    const handle = qa(f, '[data-dnd-handle]')[1];
    expect(handle.getAttribute('aria-disabled')).toBe('true');
    key(handle, ' ');
    f.detectChanges();
    expect(f.componentInstance.grabbedIndex()).toBe(-1);
    key(handle, 'ArrowDown');
    f.detectChanges();
    expect(order(f)).toEqual(['a', 'b', 'c']);
    expect(seen).toEqual([]);
    await until(() => f.componentInstance.liveMessage() === 'Beta cannot be moved.', { label: 'the refusal announcement' });
  });

  it('refuses every programmatic path too: moveUp, moveDown, drag start', async () => {
    const seen: unknown[] = [];
    const f = await setup('default', { reordered: (e: unknown) => seen.push(e) });
    const c = f.componentInstance;
    c.moveUp(1);
    c.moveDown(1);
    c.onDragStart(1);
    expect(c.dragIndex()).toBe(-1);
    expect(order(f)).toEqual(['a', 'b', 'c']);
    expect(seen).toEqual([]);
    expect(qa(f, 'li')[1].getAttribute('draggable')).toBe('false');
  });

  it('kanban: the disabled card\'s in-column and cross-column buttons are disabled and inert', async () => {
    const changed: unknown[] = [];
    const f = await setup('kanban', { itemChanged: (e: unknown) => changed.push(e) });
    const c = f.componentInstance;
    const beta = qa(f, '[data-dnd-card-moves]')[1];
    const buttons = [...beta.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    c.moveToCol('b', 'done');
    c.moveInColumn('b', 1);
    expect(order(f)).toEqual(['a', 'b', 'c']);
    expect(c.items()[1].column).toBe('todo');
    expect(changed).toEqual([]);
  });

  it('other items can still move past a disabled one (it is displaced, not pinned)', async () => {
    const f = await setup('default');
    f.componentInstance.moveDown(0);
    expect(order(f)).toEqual(['b', 'a', 'c']);
  });
});

describe('SvDndListComponent — the lifted row stays in view (DD-11-I4)', () => {
  it('scrolls the moved row into view with block: nearest after each arrow', async () => {
    const spy = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = spy;
    try {
      const f = await setup('default');
      const handle = qa(f, '[data-dnd-handle]')[0];
      key(handle, ' ');
      f.detectChanges();
      key(qa(f, '[data-dnd-handle]')[0], 'ArrowDown');
      f.detectChanges();
      await until(() => spy.mock.calls.length > 0, { label: 'scrollIntoView' });
      expect(spy).toHaveBeenCalledWith({ block: 'nearest' });
      expect((spy.mock.contexts[0] as HTMLElement).tagName).toBe('LI');
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('auto-scrolls a scrollable container while a drag hovers near its edge', async () => {
    TestBed.resetTestingModule();
    const host = document.createElement('div');
    host.style.overflowY = 'auto';
    document.body.appendChild(host);
    try {
      const { fixture } = await render(SvDndListComponent, {
        inputs: { items: ITEMS.map((i) => ({ ...i, disabled: false })), variant: 'default' },
      });
      // Put the list inside a scrolling panel, as a dashboard would.
      host.appendChild(fixture.nativeElement as HTMLElement);
      Object.defineProperty(host, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(host, 'clientHeight', { configurable: true, value: 200 });
      host.getBoundingClientRect = () => ({ top: 100, bottom: 300, left: 0, right: 0, width: 0, height: 200, x: 0, y: 100, toJSON: () => ({}) });
      let top = 50;
      Object.defineProperty(host, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => (top = v) });
      const c = fixture.componentInstance;
      c.onDragStart(0);
      c.onDragOver({ preventDefault: () => undefined, clientY: 295 } as DragEvent, 1);
      expect(host.scrollTop).toBeGreaterThan(50);
      const after = host.scrollTop;
      c.onDragOver({ preventDefault: () => undefined, clientY: 105 } as DragEvent, 1);
      expect(host.scrollTop).toBeLessThan(after);
      const still = host.scrollTop;
      c.onDragOver({ preventDefault: () => undefined, clientY: 200 } as DragEvent, 1);
      expect(host.scrollTop).toBe(still);
    } finally {
      host.remove();
    }
  });
});
