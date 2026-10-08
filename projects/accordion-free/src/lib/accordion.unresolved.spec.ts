import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvUnresolvedValue } from '@styloviz/core';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

/**
 * ============================================================================
 *  Controlled-value reconciliation — `X-10`, `NV-01-I5`
 * ============================================================================
 *
 * ★ **Nominal state may be PRUNED, never SUBSTITUTED.** An open set is a set of
 * names, so `sv-pagination`'s correction — replace the value with the nearest
 * valid one — has no meaning here. But dropping an id that is provably not in
 * `items` is not a guess, it is a deletion of something known to be absent.
 * **Removing what is certainly gone is knowledge; choosing a replacement is
 * invention.** That is why this family can reconcile while `sv-tabs` cannot.
 *
 * `NV-01-I5`'s pruning already existed. What this adds is the half that was
 * missing: the host is told which ids went, rather than watching its bound set
 * change under it for no stated reason.
 */

const ITEMS: AccordionItem[] = [
  { id: 'a', title: 'A', content: 'a' },
  { id: 'b', title: 'B', content: 'b' },
];

@Component({
  standalone: true,
  imports: [SvAccordionComponent],
  template: `<sv-accordion
    [items]="items()"
    expandMode="multi"
    [(openIds)]="open"
    (unresolved)="seen.push($event)" />`,
})
class Host {
  readonly items = signal<AccordionItem[]>(ITEMS);
  readonly open = signal<Set<string>>(new Set());
  readonly seen: SvUnresolvedValue<readonly string[]>[] = [];
}

async function setup(open: string[] = [], items: AccordionItem[] = ITEMS) {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host);
  fixture.componentInstance.items.set(items);
  fixture.componentInstance.open.set(new Set(open));
  fixture.detectChanges();
  return fixture;
}

describe('SvAccordionComponent — a set that all resolves', () => {
  it('says nothing', async () => {
    const f = await setup(['a']);
    expect(f.componentInstance.seen).toEqual([]);
  });
});

describe('SvAccordionComponent — an item that goes away', () => {
  /** Pruned, as before — and now reported. */
  it('drops the id and tells the host which one', async () => {
    const f = await setup(['a', 'b']);
    expect(f.componentInstance.seen).toEqual([]);

    f.componentInstance.items.set([ITEMS[0]]);
    f.detectChanges();

    expect([...f.componentInstance.open()]).toEqual(['a']);
    const last = f.componentInstance.seen.at(-1)!;
    expect(last.requested).toEqual(expect.arrayContaining(['a', 'b']));
    expect(last.rendered).toEqual(['a']);
    expect(last.reason).toBe('unknown');
    expect(last.corrected).toBe(true);
  });
});

describe('SvAccordionComponent — before the items have arrived', () => {
  /**
   * ★ An empty `items` is not evidence that an id is gone, it is evidence that
   * nothing has arrived. Pruning then empties a restored or deep-linked set
   * before the sections that justify it exist.
   */
  it('holds the set and reports not-loaded', async () => {
    const f = await setup(['a'], []);

    expect([...f.componentInstance.open()]).toEqual(['a']);
    expect(f.componentInstance.seen.at(-1)).toMatchObject({
      reason: 'not-loaded',
      corrected: false,
    });
  });

  it('goes quiet once the items arrive and the id turns out to be real', async () => {
    const f = await setup(['a'], []);
    const before = f.componentInstance.seen.length;

    f.componentInstance.items.set(ITEMS);
    f.detectChanges();

    expect([...f.componentInstance.open()]).toEqual(['a']);
    expect(f.componentInstance.seen).toHaveLength(before);
  });
});
