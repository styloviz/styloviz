import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDndListComponent } from './dnd-list.component';
import type { DndItem, DndRemoveEvent, DndReorderEvent } from './dnd-list.component';

const items = (): DndItem[] => [
  { id: '1', label: 'Alpha' },
  { id: '2', label: 'Beta' },
  { id: '3', label: 'Gamma' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDndListComponent, { inputs: { items: items(), ...inputs } });
  return fixture;
}

const order = (f: { componentInstance: SvDndListComponent }) =>
  f.componentInstance.items().map((i) => i.id);

describe('SvDndListComponent — honest defaults', () => {
  /** It used to default to a demo fixture, so an unbound list showed fake rows. */
  it('ships no sample rows of its own', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDndListComponent);
    expect(fixture.componentInstance.items()).toEqual([]);
    expect(fixture.componentInstance.isEmpty()).toBe(true);
  });
});

describe('SvDndListComponent — persisting the order', () => {
  it('applies the move immediately and hands the host a rollback', async () => {
    const f = await setup();
    const seen: DndReorderEvent[] = [];
    f.componentInstance.reordered.subscribe((e) => seen.push(e));

    f.componentInstance.moveDown(0);
    expect(order(f)).toEqual(['2', '1', '3']);
    expect(seen[0].items.map((i) => i.id)).toEqual(['2', '1', '3']);

    seen[0].rollback();
    expect(order(f)).toEqual(['1', '2', '3']);
  });

  it('rolls back a removal too, and reports it as a delete not a reorder', async () => {
    const f = await setup();
    const removed: DndRemoveEvent[] = [];
    const reordered: DndReorderEvent[] = [];
    f.componentInstance.itemRemoved.subscribe((e) => removed.push(e));
    f.componentInstance.reordered.subscribe((e) => reordered.push(e));

    f.componentInstance.remove('2');
    expect(order(f)).toEqual(['1', '3']);
    expect(reordered).toEqual([]);
    expect(removed[0].item.id).toBe('2');

    removed[0].rollback();
    expect(order(f)).toEqual(['1', '2', '3']);
  });

  /** Restoring an old order would undo the newer move along with it. */
  it('refuses a stale rollback after a later reorder', async () => {
    const f = await setup();
    const seen: DndReorderEvent[] = [];
    f.componentInstance.reordered.subscribe((e) => seen.push(e));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    f.componentInstance.moveDown(0);
    f.componentInstance.moveDown(1);
    const after = order(f);

    seen[0].rollback();
    expect(order(f)).toEqual(after);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('blocks a second reorder while the save is in flight', async () => {
    const f = await setup({ saving: true });
    let emitted = 0;
    f.componentInstance.reordered.subscribe(() => emitted++);
    f.componentInstance.itemRemoved.subscribe(() => emitted++);

    f.componentInstance.moveDown(0);
    f.componentInstance.moveUp(2);
    f.componentInstance.remove('1');

    expect(emitted).toBe(0);
    expect(order(f)).toEqual(['1', '2', '3']);
  });

  it('shows a save failure with a retry, keeping the rows visible', async () => {
    const f = await setup({ error: 'Could not save the order' });
    const el = f.nativeElement.querySelector('[data-sv-state="error"]');
    expect(el?.textContent).toContain('Could not save the order');
    expect(f.nativeElement.textContent).toContain('Alpha');

    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);
    (el?.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });
});
