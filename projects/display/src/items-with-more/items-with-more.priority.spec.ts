import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvItemsWithMoreComponent,
  svSplitOverflow,
  type ItemsWithMoreItem,
} from './items-with-more.component';

/**
 * Which items survive the collapse, and where focus goes when the control that
 * did the collapsing stops existing.
 *
 * ★ Overflow collapses by POSITION, which quietly assumes the list is ordered
 * by importance. It usually is not: an "Overdue" chip appended to eight labels
 * is the one the reader needed and the first thing a narrow container hides.
 */

const ITEMS = ['Design', 'Engineering', 'Marketing', 'Sales', 'Support'];

const WITH_PIN: (string | ItemsWithMoreItem)[] = [
  'Design',
  'Engineering',
  'Marketing',
  { label: 'Overdue', pinned: true },
  'Support',
];

async function setup(inputs: Partial<ComponentInput<SvItemsWithMoreComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvItemsWithMoreComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvItemsWithMoreComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('[data-trigger]');
const labels = (items: readonly (string | ItemsWithMoreItem)[]) =>
  items.map((i) => (typeof i === 'string' ? i : i.label));

describe('svSplitOverflow', () => {
  it('keeps a pinned item out of the positional race', () => {
    const { visible, overflow } = svSplitOverflow(WITH_PIN, 2);
    // Two slots, and the pinned one takes one of them regardless of where it sits.
    expect(labels(visible)).toEqual(['Design', 'Overdue']);
    expect(labels(overflow)).toEqual(['Engineering', 'Marketing', 'Support']);
  });

  it('preserves the host’s order on both sides', () => {
    const items: ItemsWithMoreItem[] = [
      { label: 'a' }, { label: 'b', pinned: true }, { label: 'c' }, { label: 'd', pinned: true },
    ];
    const { visible, overflow } = svSplitOverflow(items, 3);
    // Not pinned-first: reordering the row would move a chip out from under the
    // reader's eye to solve a problem they did not have.
    expect(labels(visible)).toEqual(['a', 'b', 'd']);
    expect(labels(overflow)).toEqual(['c']);
  });

  it('shows every pinned item even when more are pinned than fit', () => {
    const items: ItemsWithMoreItem[] = [
      { label: 'a', pinned: true }, { label: 'b', pinned: true },
      { label: 'c', pinned: true }, { label: 'd' },
    ];
    const { visible, overflow } = svSplitOverflow(items, 1);
    // ★ The row wraps rather than a pinned item being dropped. A flag that means
    // "unless it is inconvenient" is worse than no flag, because the host stops
    // checking it.
    expect(labels(visible)).toEqual(['a', 'b', 'c']);
    expect(labels(overflow)).toEqual(['d']);
  });

  it('treats a plain string as unpinned', () => {
    const { visible } = svSplitOverflow(['a', 'b', 'c'], 2);
    expect(labels(visible)).toEqual(['a', 'b']);
  });
});

describe('SvItemsWithMoreComponent — pinned items', () => {
  it('never collapses one, in the chip variants', async () => {
    const { fixture } = await setup({ items: WITH_PIN, maxVisible: 2 });
    expect(el(fixture).textContent).toContain('Overdue');
    expect(labels(fixture.componentInstance.overflowItems())).not.toContain('Overdue');
  });

  it('never collapses one out of the inline sentence either', async () => {
    const { fixture } = await setup({ items: WITH_PIN, maxVisible: 2, moreVariant: 'inline' });
    fixture.componentInstance._inlineFits.set(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.inlineText()).toContain('Overdue');
  });
});

describe('SvItemsWithMoreComponent — the label names what is hidden', () => {
  it('stops naming and goes back to counting past the cap', async () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const { fixture } = await setup({ items: many, maxVisible: 1 });
    // Seven hidden. A label that reads out all seven is one nobody listens to
    // the end of, so five are named and the rest are counted.
    expect(trigger(fixture)!.getAttribute('aria-label')).toBe(
      'Show 7 more items: b, c, d, e, f, and 2 others',
    );
  });

  it('says nothing when nothing is hidden', async () => {
    const { fixture } = await setup({ maxVisible: 99 });
    expect(fixture.componentInstance.moreAriaLabel()).toBe('');
    expect(trigger(fixture)).toBeNull();
  });
});

describe('SvItemsWithMoreComponent — focus when the control disappears', () => {
  it('lands on the component rather than on <body>', async () => {
    const { fixture } = await setup({ maxVisible: 3 });
    const button = trigger(fixture)!;
    button.focus();
    expect(document.activeElement).toBe(button);

    // The container widened and everything fits — an event the user did not
    // cause, destroying the element they were standing on.
    fixture.componentRef.setInput('maxVisible', 99);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(trigger(fixture)).toBeNull();
    expect(document.activeElement).toBe(el(fixture));
    expect(el(fixture).querySelector('[role="status"]')?.textContent).toContain(
      'All 5 items now fit',
    );
  });

  it('leaves focus alone when it was never inside', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { fixture } = await setup({ maxVisible: 3 });
    outside.focus();

    fixture.componentRef.setInput('maxVisible', 99);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    // Moving focus the user did not ask for is worse than the bug when it fires
    // wrongly, so the rescue is guarded on focus having been in here.
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('closes an open dropdown that has lost its trigger', async () => {
    const { fixture } = await setup({ maxVisible: 3, moreDropdown: true });
    trigger(fixture)!.focus();
    trigger(fixture)!.click();
    fixture.detectChanges();
    expect(document.querySelector('.sv-dropdown-portal')).not.toBeNull();

    fixture.componentRef.setInput('maxVisible', 99);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    // A panel listing items that are all now on screen, anchored to a trigger
    // that no longer exists.
    expect(document.querySelector('.sv-dropdown-portal')).toBeNull();
  });
});
