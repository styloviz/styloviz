import type { DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { TimelineLoadMoreEvent } from './timeline.component';
import { render, screen } from '@testing-library/angular';
import { SvTimelineComponent, type TimelineItem } from './timeline.component';

const ITEMS: TimelineItem[] = [
  { id: '1', title: 'Created', timestamp: '2026-01-01' },
  { id: '2', title: 'Shipped', timestamp: '2026-01-05', actionUrl: 'https://x.test' },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvTimelineComponent, {
    inputs: { items: ITEMS, ...extra },
  });
  return fixture.componentInstance;
}

describe('SvTimelineComponent — interactive selection', () => {
  it('selects a row and emits itemClick in interactive mode', async () => {
    const spy = vi.fn();
    const c = await setup({ displayMode: 'interactive' });
    c.itemClick.subscribe(spy);

    c.onItemActivate(ITEMS[1]);
    expect(c.selectedId()).toBe('2');
    expect(c.isSelected(ITEMS[1])).toBe(true);
    expect(spy).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('does nothing when not in interactive mode', async () => {
    const spy = vi.fn();
    const c = await setup({ displayMode: 'default' });
    c.itemClick.subscribe(spy);

    c.onItemActivate(ITEMS[0]);
    expect(c.selectedId()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('activates via Enter/Space keyboard in interactive mode', async () => {
    const spy = vi.fn();
    const c = await setup({ displayMode: 'interactive' });
    c.itemClick.subscribe(spy);

    c.onItemKeydown(new KeyboardEvent('keydown', { key: 'Enter' }), ITEMS[0]);
    expect(spy).toHaveBeenCalledWith(ITEMS[0]);
  });
});

describe('SvTimelineComponent — rich-card CTA', () => {
  it('emits actionClick and preventDefaults when the item has no actionUrl', async () => {
    const spy = vi.fn();
    const c = await setup();
    c.actionClick.subscribe(spy);

    const ev = { preventDefault: vi.fn() } as unknown as MouseEvent;
    c.onActionClick(ITEMS[0], ev); // no actionUrl
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('does not preventDefault when the item has an actionUrl', async () => {
    const c = await setup();
    const ev = { preventDefault: vi.fn() } as unknown as MouseEvent;
    c.onActionClick(ITEMS[1], ev); // has actionUrl
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });
});

// ─── Backend wiring (Phase 1) ────────────────────────────────────────────────

describe('SvTimelineComponent — async states', () => {
  const stateEl = (f: { nativeElement: HTMLElement }, n: string) =>
    f.nativeElement.querySelector(`[data-sv-state="${n}"]`);

  async function setup(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, {
      inputs: { items: [{ id: 1, title: 'Deployed v2' }] as TimelineItem[], ...inputs },
    });
    return fixture;
  }

  it('shows a placeholder instead of the timeline while the first page loads', async () => {
    const f = await setup({ loading: true });
    expect(stateEl(f, 'loading')).toBeTruthy();
    expect(f.nativeElement.textContent).not.toContain('Deployed v2');
  });

  it('announces a load failure and offers a retry', async () => {
    const f = await setup({ error: 'History service down' });
    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);
    expect(stateEl(f, 'error')?.textContent).toContain('History service down');
    (stateEl(f, 'error')?.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('shows an empty state when there are no events', async () => {
    const f = await setup({ items: [] as TimelineItem[] });
    expect(stateEl(f, 'empty')).toBeTruthy();
  });
});

describe('SvTimelineComponent — paging in both directions', () => {
  /**
   * A timeline is the one collection that genuinely pages backwards: history
   * runs off one end while the feed is still being written to at the other.
   */
  async function setup(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, {
      inputs: {
        items: [
          { id: 1, title: 'A' },
          { id: 2, title: 'B' },
        ] as TimelineItem[],
        ...inputs,
      },
    });
    return fixture;
  }

  it('asks for older events with the current offset', async () => {
    const f = await setup({ hasOlder: true });
    const seen: TimelineLoadMoreEvent[] = [];
    f.componentInstance.loadMore.subscribe((e) => seen.push(e));

    (screen.getByRole('button', { name: 'Load older' }) as HTMLButtonElement).click();
    expect(seen[0]).toEqual({ direction: 'older', loaded: 2 });
  });

  it('asks for newer events separately', async () => {
    const f = await setup({ hasNewer: true });
    const seen: TimelineLoadMoreEvent[] = [];
    f.componentInstance.loadMore.subscribe((e) => seen.push(e));

    (screen.getByRole('button', { name: 'Load newer' }) as HTMLButtonElement).click();
    expect(seen[0]).toEqual({ direction: 'newer', loaded: 2 });
  });

  it('offers each control only when that end has more', async () => {
    await setup({ hasOlder: true });
    expect(screen.queryByRole('button', { name: 'Load newer' })).toBeNull();

    await setup();
    expect(screen.queryByRole('button', { name: 'Load older' })).toBeNull();
  });

  it('keeps the loaded events visible while another page arrives', async () => {
    const f = await setup({ loadingOlder: true, hasOlder: true });
    expect(f.nativeElement.querySelector('[data-sv-state="loading-older"]')).toBeTruthy();
    expect(f.nativeElement.textContent).toContain('A');
  });
});

/**
 * A long history is not a list, it is a wall.
 *
 * ★★ Five hundred entries push everything else off the page, cost a
 *    screen-reader user five hundred stops to get past, and bury the recent
 *    items the reader almost always came for. `loadMore` covers fetching more
 *    from a server; this covers the opposite problem — too much already in hand.
 */
describe('SvTimelineComponent — collapsing a long history (ported from the Pro twin)', () => {
  const many = (n: number): TimelineItem[] =>
    Array.from({ length: n }, (_, i) => ({ id: i, title: `Event ${i}` }));

  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, { inputs });
    return {
      fixture,
      c: fixture.componentInstance as unknown as {
        visibleItems: () => readonly TimelineItem[];
        hiddenCount: () => number;
        expandLabel: () => string;
        expanded: { set: (v: boolean) => void };
        toggleExpanded: () => void;
        isLast: (i: number) => boolean;
      },
      host: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows everything when collapse is off', async () => {
    const { c } = await mount({ items: many(50) });
    expect(c.visibleItems()).toHaveLength(50);
    expect(c.hiddenCount()).toBe(0);
  });

  it('shows only the first N when collapse is on', async () => {
    const { c } = await mount({ items: many(50), collapseAfter: 5 });
    expect(c.visibleItems()).toHaveLength(5);
    expect(c.hiddenCount()).toBe(45);
  });

  it('does not collapse a list already shorter than the limit', async () => {
    const { c, host } = await mount({ items: many(3), collapseAfter: 5 });
    expect(c.visibleItems()).toHaveLength(3);
    expect(c.hiddenCount()).toBe(0);
    expect(host.textContent).not.toContain('Show');
  });

  it('keeps the host ORDER and truncates the tail', async () => {
    // ★ Which end is "recent" depends on whether the host sorted newest-first
    //   or oldest-first, and the component cannot know — guessing would collapse
    //   exactly the items the reader came for on half of all timelines.
    const { c } = await mount({ items: many(10), collapseAfter: 3 });
    expect(c.visibleItems().map(i => i.title)).toEqual(['Event 0', 'Event 1', 'Event 2']);
  });

  it('names the COUNT rather than saying "show more"', async () => {
    // A reader deciding whether to expand needs to know if it is three more
    // entries or three hundred.
    const { c } = await mount({ items: many(50), collapseAfter: 5 });
    expect(c.expandLabel()).toBe('Show 45 more entries');
  });

  it('gets the singular right', async () => {
    const { c } = await mount({ items: many(6), collapseAfter: 5 });
    expect(c.expandLabel()).toBe('Show 1 more entry');
  });

  it('reveals the rest when the control is pressed', async () => {
    const { c, fixture, host } = await mount({ items: many(50), collapseAfter: 5 });
    const button = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    fixture.detectChanges();
    expect(c.visibleItems()).toHaveLength(50);
    expect(c.hiddenCount()).toBe(0);
  });

  it('is a model, so a host can restore it', async () => {
    // ★ A reader who expanded a history and navigated away should not have to
    //   expand it again.
    const { c } = await mount({ items: many(50), collapseAfter: 5, expanded: true });
    expect(c.visibleItems()).toHaveLength(50);
  });

  it('renders only the visible rows, not the whole history', async () => {
    const { host } = await mount({ items: many(50), collapseAfter: 5 });
    expect(host.querySelectorAll('li').length).toBeLessThan(20);
  });

  it('ends the connector at the last VISIBLE row', async () => {
    // ★ `isLast` measured against the full list would leave the connector
    //   drawing past the last rendered row — a line running into nothing.
    const { c } = await mount({ items: many(50), collapseAfter: 5 });
    expect(c.isLast(4)).toBe(true);
    expect(c.isLast(49)).toBe(false);
  });

  it('ignores a limit that means nothing', async () => {
    for (const collapseAfter of [0, -1, Number.NaN]) {
      const { c } = await mount({ items: many(10), collapseAfter });
      expect(c.visibleItems()).toHaveLength(10);
    }
  });
});

// ─── Collapse reaches the grouped layout; grouped lists keep the list's name ──

describe('SvTimelineComponent — collapse applies to the date-grouped layout', () => {
  const dated = (n: number): TimelineItem[] =>
    Array.from({ length: n }, (_, i) => ({
      id: i,
      title: `Event ${i}`,
      groupDate: i < 3 ? 'Today' : 'Yesterday',
    }));

  async function mountGrouped(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, { inputs: { groupByDate: true, ...inputs } });
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('renders only the visible items across the groups while collapsed', async () => {
    const { host } = await mountGrouped({ items: dated(10), collapseAfter: 4 });
    const lists = [...host.querySelectorAll('ol')];
    expect(lists.map(l => l.querySelectorAll('li').length)).toEqual([3, 1]);
    expect(host.textContent).not.toContain('Event 4');
    expect(host.querySelector('button[aria-expanded="false"]')?.textContent).toContain('Show 6 more entries');
  });

  it('drops a group whose items are all hidden, then restores it on expand', async () => {
    const { fixture, host } = await mountGrouped({ items: dated(10), collapseAfter: 2 });
    expect(host.querySelectorAll('ol').length).toBe(1);
    host.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('ol').length).toBe(2);
    expect(host.querySelectorAll('li').length).toBe(10);
  });

  it('honours a bound expanded=true on the grouped layout', async () => {
    const { host } = await mountGrouped({ items: dated(10), collapseAfter: 2, expanded: true });
    expect(host.querySelectorAll('li').length).toBe(10);
  });

  it.each([
    [{}, 'Timeline, Today'],
    [{ ariaLabel: 'Deploy log' }, 'Deploy log, Today'],
    [{ intent: 'feed' }, 'Activity feed, Today'],
    [{ intent: 'process' }, 'Progress tracker, Today'],
  ] as const)('names each grouped list from ariaLabel / intent plus the date (%o)', async (extra, first) => {
    const { host } = await mountGrouped({ items: dated(5), ...extra });
    expect(host.querySelector('ol')?.getAttribute('aria-label')).toBe(first);
  });
});

// ─── Reduced motion on the pulsing ring (X-11) ───────────────────────────────

describe('SvTimelineComponent — the pulsing ring stops under prefers-reduced-motion', () => {
  const steps: TimelineItem[] = [
    { id: 1, title: 'Ordered', variant: 'success' },
    { id: 2, title: 'Packed', variant: 'info' },
    { id: 3, title: 'Shipped' },
  ];

  it.each<Record<string, string>>([
    { displayMode: 'status' },
    { dotStyle: 'number' },
    { dotStyle: 'check' },
  ])('every ping carries motion-reduce:animate-none (%o)', async (extra) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, {
      inputs: { items: steps, activeIndex: 1, ...extra },
    });
    const pings = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.animate-ping')];
    expect(pings.length).toBeGreaterThan(0);
    for (const ping of pings) {
      expect(ping.classList.contains('motion-reduce:animate-none')).toBe(true);
    }
  });
});

// ─── showVariantIcon (X-11) ──────────────────────────────────────────────────

describe('SvTimelineComponent — showVariantIcon draws a status glyph in meaningful dots', () => {
  const items: TimelineItem[] = [
    { id: 1, title: 'Passed', variant: 'success' },
    { id: 2, title: 'Failed', variant: 'error' },
    { id: 3, title: 'Slow', variant: 'warning' },
    { id: 4, title: 'Note', variant: 'info' },
    { id: 5, title: 'Plain', variant: 'neutral' },
    { id: 6, title: 'Custom', variant: 'error', icon: 'star' },
  ];

  const glyphs = (f: { debugElement: DebugElement }) =>
    f.debugElement
      .queryAll(By.css('[role="img"] sv-icon'))
      .map(d => (d.componentInstance as { name: () => string }).name());

  it.each([{}, { layout: 'right' }, { layout: 'alternate' }, { layout: 'horizontal' }, { displayMode: 'rich' }, { groupByDate: true }] as Record<string, unknown>[])('renders check / close / alert-triangle / info, keeps item.icon (%o)', async (extra) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, {
      inputs: { items, showVariantIcon: true, ...extra },
    });
    expect(glyphs(fixture)).toEqual(['check', 'close', 'alert-triangle', 'info', 'star']);
  });

  it.each([{}, { layout: 'right' }, { layout: 'alternate' }, { layout: 'horizontal' }, { displayMode: 'rich' }, { groupByDate: true }] as Record<string, unknown>[])('draws no status glyph by default (%o)', async (extra) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTimelineComponent, { inputs: { items, ...extra } });
    expect(glyphs(fixture)).toEqual(['star']);
  });
});
