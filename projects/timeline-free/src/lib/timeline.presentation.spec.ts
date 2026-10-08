import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTimelineComponent } from './timeline.component';
import type { TimelineItem } from './timeline.component';

/**
 * The presentation half of the FREE `sv-timeline`.
 *
 * Adapted from `projects/timeline/src/lib/timeline.presentation.spec.ts`, and
 * the divergences from the Pro twin were checked file-by-file rather than
 * assumed. Each one has its own test below, marked ▲:
 *
 *   ▲ interactive rows are a `div[role="button"]` with `aria-pressed` and a
 *     hand-rolled Enter/Space handler, not Pro's real `<button>` with
 *     `aria-current` — so free needs the keyboard test Pro does not, and free's
 *     `onItemActivate` carries a `displayMode` guard Pro's `onItemClick` lacks
 *     (Pro's button only exists inside the interactive branch, so it cannot be
 *     reached in another mode).
 *   ▲ the rich CTA is always an `<a href>`, falling back to '#', and
 *     `onActionClick` takes the event so it can suppress that '#' jump. Pro
 *     renders a `<button>` when there is no url and takes no event.
 *   ▲ free's status mode has no `aria-current="step"` and no sr-only status
 *     label — Pro has both. Step state is therefore read off the dot markup
 *     here. See `timeline-free.a11y.spec.ts` for that gap.
 *
 * ★ No date arithmetic: `timestamp` and `groupDate` are rendered as opaque
 * strings and the component contains no `Date`, no `| date` pipe and no
 * `toLocale*` call, so `TZ=Pacific/Marquesas` cannot move any assertion here.
 */

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTimelineComponent, { inputs });
  return fixture;
}

// ─── Date grouping ────────────────────────────────────────────────────────────

describe('SvTimelineComponent — grouping by date', () => {
  const GROUPED: TimelineItem[] = [
    { id: 1, title: 'Signed up', groupDate: 'Today' },
    { id: 2, title: 'Verified email', groupDate: 'Today' },
    { id: 3, title: 'Invited a teammate', groupDate: 'Yesterday' },
  ];

  it('opens a new header only when the date changes, not on every item', async () => {
    const f = await setup({ items: GROUPED, groupByDate: true });
    const lists = el(f).querySelectorAll('ol[aria-label^="Timeline"]');
    expect([...lists].map((l) => l.getAttribute('aria-label'))).toEqual([
      'Timeline, Today',
      'Timeline, Yesterday',
    ]);
    expect(lists[0].querySelectorAll('li').length).toBe(2);
    expect(lists[1].querySelectorAll('li').length).toBe(1);
  });

  it('puts items with no groupDate into one unnamed group', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ] as TimelineItem[],
      groupByDate: true,
    });
    const lists = el(f).querySelectorAll('ol[aria-label^="Timeline"]');
    expect(lists.length).toBe(1);
    expect(lists[0].querySelectorAll('li').length).toBe(2);
  });

  it('re-opens a group when the same date returns after another', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'A', groupDate: 'Mon' },
        { id: 2, title: 'B', groupDate: 'Tue' },
        { id: 3, title: 'C', groupDate: 'Mon' },
      ] as TimelineItem[],
      groupByDate: true,
    });
    const labels = [...el(f).querySelectorAll('ol[aria-label^="Timeline"]')].map((l) =>
      l.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Timeline, Mon', 'Timeline, Tue', 'Timeline, Mon']);
  });

  it('stops the connector after the last item of a group', async () => {
    const f = await setup({ items: GROUPED, groupByDate: true });
    const lists = el(f).querySelectorAll('ol[aria-label^="Timeline"]');
    const firstGroupRows = [...lists[0].querySelectorAll('li')];
    expect(firstGroupRows[0].querySelector('.w-0\\.5')).not.toBeNull();
    expect(firstGroupRows[1].querySelector('.w-0\\.5')).toBeNull();
    expect(lists[1].querySelector('li')!.querySelector('.w-0\\.5')).toBeNull();
  });

  it('draws no connectors at all when showConnector is off', async () => {
    const f = await setup({ items: GROUPED, groupByDate: true, showConnector: false });
    expect(el(f).querySelector('.w-0\\.5')).toBeNull();
  });
});

// ─── Step status ──────────────────────────────────────────────────────────────

describe('SvTimelineComponent — step status', () => {
  const STEPS: TimelineItem[] = [
    { id: 'a', title: 'Ordered' },
    { id: 'b', title: 'Packed' },
    { id: 'c', title: 'Shipped' },
  ];

  /**
   * ▲ Free has no sr-only status text to read, so the step state is derived
   * from the dot each row draws: a filled `accent` ring for complete, a filled
   * `brandaccent` ring for active, a hollow thin ring for pending.
   */
  const dotKinds = (f: { nativeElement: unknown }) =>
    [...el(f).querySelectorAll('li')].map((li) => {
      const dot = li.querySelector('.rounded-full.ring-4, .rounded-full.ring-2')!;
      if (dot.className.includes('bg-accent-500')) return 'complete';
      if (dot.className.includes('bg-brandaccent-600')) return 'active';
      return 'pending';
    });

  it('splits the list at activeIndex into completed / current / pending', async () => {
    const f = await setup({ items: STEPS, displayMode: 'status', activeIndex: 1 });
    expect(dotKinds(f)).toEqual(['complete', 'active', 'pending']);
  });

  it('falls back to each item\'s own itemStatus when activeIndex is unset', async () => {
    const f = await setup({
      items: [
        { id: 'a', title: 'Ordered', itemStatus: 'complete' },
        { id: 'b', title: 'Packed', itemStatus: 'active' },
        { id: 'c', title: 'Shipped' }, // no itemStatus at all
      ] as TimelineItem[],
      displayMode: 'status',
    });
    expect(dotKinds(f)).toEqual(['complete', 'active', 'pending']);
  });

  it('colours each connector for the step it leaves', async () => {
    const f = await setup({ items: STEPS, displayMode: 'status', activeIndex: 1 });
    const connectors = [...el(f).querySelectorAll('.w-0\\.5')].map((n) => n.className);
    expect(connectors.length).toBe(2);
    expect(connectors[0]).toContain('bg-accent-400');
    expect(connectors[1]).toContain('bg-brandaccent-300');
  });

  it('dims the connector below a pending step', async () => {
    const f = await setup({ items: STEPS, displayMode: 'status', activeIndex: 0 });
    const connectors = [...el(f).querySelectorAll('.w-0\\.5')].map((n) => n.className);
    expect(connectors[0]).toContain('bg-brandaccent-300');
    expect(connectors[1]).toContain('opacity-50');
  });

  it('pulses the active step only', async () => {
    const f = await setup({ items: STEPS, displayMode: 'status', activeIndex: 1 });
    const pulses = el(f).querySelectorAll('.animate-ping');
    expect(pulses.length).toBe(1);
    expect(pulses[0].className).toContain('bg-brandaccent-400');
  });

  it('takes the pulse colour from the item variant when it has one', async () => {
    const f = await setup({
      items: [{ id: 'a', title: 'Ordered', variant: 'warning' }] as TimelineItem[],
      displayMode: 'status',
      activeIndex: 0,
    });
    expect(el(f).querySelector('.animate-ping')!.className).toContain('bg-warning-300');
  });
});

// ─── Dot colour ───────────────────────────────────────────────────────────────

describe('SvTimelineComponent — dot colour', () => {
  it('uses the item variant when set and neutral when it is not', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'Deployed', variant: 'success' },
        { id: 2, title: 'Noted' },
      ] as TimelineItem[],
    });
    const dots = [...el(f).querySelectorAll('.ring-4')].map((n) => n.className);
    expect(dots[0]).toContain('bg-accent-500');
    expect(dots[1]).toContain('bg-gray-400');
  });
});

// ─── Horizontal layout ────────────────────────────────────────────────────────

describe('SvTimelineComponent — horizontal content placement', () => {
  const ITEMS: TimelineItem[] = [
    { id: 1, title: 'One' },
    { id: 2, title: 'Two' },
    { id: 3, title: 'Three' },
  ];

  const slots = (f: { nativeElement: unknown }) =>
    [...el(f).querySelectorAll('li')].map((li) => {
      const [top, bottom] = li.querySelectorAll(':scope > div.h-28');
      return top.textContent?.trim() ? 'top' : bottom.textContent?.trim() ? 'bottom' : 'none';
    });

  it('alternates by default', async () => {
    const f = await setup({ items: ITEMS, layout: 'horizontal' });
    expect(slots(f)).toEqual(['top', 'bottom', 'top']);
  });

  it('pins every item to the top when told to', async () => {
    const f = await setup({ items: ITEMS, layout: 'horizontal', horizontalAlign: 'top' });
    expect(slots(f)).toEqual(['top', 'top', 'top']);
  });

  it('pins every item to the bottom when told to', async () => {
    const f = await setup({ items: ITEMS, layout: 'horizontal', horizontalAlign: 'bottom' });
    expect(slots(f)).toEqual(['bottom', 'bottom', 'bottom']);
  });

  it('hides the half-line before the first item and after the last', async () => {
    const f = await setup({ items: ITEMS, layout: 'horizontal' });
    const rows = [...el(f).querySelectorAll('li')];
    const halves = (li: Element) =>
      [...li.querySelectorAll('.h-0\\.5')].map((n) => n.className.includes('invisible'));
    expect(halves(rows[0])).toEqual([true, false]);
    expect(halves(rows[1])).toEqual([false, false]);
    expect(halves(rows[2])).toEqual([false, true]);
  });

  it('leaves both half-lines hidden for a single item', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'Only' }] as TimelineItem[],
      layout: 'horizontal',
    });
    const halves = [...el(f).querySelectorAll('.h-0\\.5')].map((n) =>
      n.className.includes('invisible'),
    );
    expect(halves).toEqual([true, true]);
  });
});

// ─── Feed avatars ─────────────────────────────────────────────────────────────

describe('SvTimelineComponent — feed avatars', () => {
  it('derives initials from the first and last word of a name', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'pushed a commit', actorName: 'ada lovelace king' }] as TimelineItem[],
      displayMode: 'feed',
    });
    expect(el(f).querySelector('.rounded-full .text-xs')!.textContent?.trim()).toBe('AK');
  });

  it('uses the first two letters when there is only one word', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'pushed a commit', actorName: 'ada' }] as TimelineItem[],
      displayMode: 'feed',
    });
    expect(el(f).querySelector('.rounded-full .text-xs')!.textContent?.trim()).toBe('AD');
  });

  it('collapses runs of spaces rather than reading them as words', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'pushed', actorName: '  ada   lovelace  ' }] as TimelineItem[],
      displayMode: 'feed',
    });
    expect(el(f).querySelector('.rounded-full .text-xs')!.textContent?.trim()).toBe('AL');
  });

  it('falls back to a placeholder glyph and the first colour with no actor', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'a system event' }] as TimelineItem[],
      displayMode: 'feed',
    });
    const badge = el(f).querySelector('.rounded-full .text-xs')!;
    expect(badge.textContent?.trim()).toBe('?');
    expect(badge.className).toContain('bg-blue-700');
  });

  it('gives two different actors two different avatar colours', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'pushed', actorName: 'Ada Lovelace' },
        { id: 2, title: 'pushed', actorName: 'Grace Hopper' },
      ] as TimelineItem[],
      displayMode: 'feed',
    });
    const colours = [...el(f).querySelectorAll('.rounded-full .text-xs')].map(
      (n) => /bg-\w+-700/.exec(n.className)?.[0],
    );
    expect(colours[0]).not.toBe(colours[1]);
  });
});

// ─── Rich cards ───────────────────────────────────────────────────────────────

describe('SvTimelineComponent — rich cards', () => {
  it('gives two different tags two different chip colours', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'Released', tags: ['alpha', 'beta'] }] as TimelineItem[],
      displayMode: 'rich',
    });
    const chips = [...el(f).querySelectorAll('.rounded-full.px-2\\.5')].map((n) => n.className);
    expect(chips.length).toBe(2);
    expect(chips[0]).not.toBe(chips[1]);
  });

  it('renders no CTA when the item has no actionLabel', async () => {
    const f = await setup({
      items: [{ id: 1, title: 'Released' }] as TimelineItem[],
      displayMode: 'rich',
    });
    expect(el(f).querySelector('a')).toBeNull();
  });

  it('▲ links a CTA that has a url and lets the click through', async () => {
    // Free renders an <a> for every CTA (Pro renders a <button> when there is
    // no url), so the href must be the real destination here.
    const f = await setup({
      items: [
        { id: 1, title: 'Released', actionLabel: 'Read notes', actionUrl: 'https://x.test/notes' },
      ] as TimelineItem[],
      displayMode: 'rich',
    });
    const seen: TimelineItem[] = [];
    f.componentInstance.actionClick.subscribe((i) => seen.push(i));

    const cta = el(f).querySelector<HTMLAnchorElement>('a')!;
    expect(cta.getAttribute('href')).toBe('https://x.test/notes');

    // The component's handler runs on the anchor; this document-level guard
    // records what it decided and then stops jsdom trying to navigate (which it
    // cannot do, and which otherwise prints a "Not implemented" stack).
    let preventedByComponent: boolean | null = null;
    const guard = (e: Event): void => {
      preventedByComponent = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', guard);
    cta.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.removeEventListener('click', guard);

    expect(seen.map((i) => i.id)).toEqual([1]);
    expect(preventedByComponent).toBe(false);
  });

  it('▲ suppresses the "#" jump for a CTA with no url', async () => {
    // The href falls back to '#', which would scroll the page to the top. The
    // handler must cancel it — and must still tell the host about the click.
    const f = await setup({
      items: [{ id: 1, title: 'Released', actionLabel: 'Run it' }] as TimelineItem[],
      displayMode: 'rich',
    });
    const seen: TimelineItem[] = [];
    f.componentInstance.actionClick.subscribe((i) => seen.push(i));

    const cta = el(f).querySelector<HTMLAnchorElement>('a')!;
    expect(cta.getAttribute('href')).toBe('#');

    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    cta.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(seen.map((i) => i.id)).toEqual([1]);
  });
});

// ─── Interactive selection ────────────────────────────────────────────────────

describe('SvTimelineComponent — interactive selection', () => {
  const ITEMS: TimelineItem[] = [
    { id: 'a', title: 'First' },
    { id: 'b', title: 'Second' },
  ];

  /** ▲ free's rows are divs given a button role, not real buttons. */
  const rows = (f: { nativeElement: unknown }) =>
    [...el(f).querySelectorAll<HTMLElement>('[role="button"]')];

  it('exposes every row as an unpressed button before anything is chosen', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'interactive' });
    expect(rows(f).map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    expect(rows(f).map((r) => r.getAttribute('tabindex'))).toEqual(['0', '0']);
  });

  it('presses exactly the clicked row and emits it', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'interactive' });
    const seen: TimelineItem[] = [];
    f.componentInstance.itemClick.subscribe((i) => seen.push(i));

    rows(f)[1].click();
    f.detectChanges();

    expect(f.componentInstance.selectedId()).toBe('b');
    expect(rows(f).map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(seen.map((i) => i.id)).toEqual(['b']);
  });

  it('moves the press rather than adding a second one', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'interactive' });
    rows(f)[1].click();
    f.detectChanges();
    rows(f)[0].click();
    f.detectChanges();
    expect(rows(f).map((r) => r.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('▲ carries no button role or tabindex outside interactive mode', async () => {
    // The row is still clickable markup, so the guard in `onItemActivate` is the
    // only thing stopping a stray click from selecting in, say, feed mode.
    const f = await setup({ items: ITEMS, displayMode: 'default' });
    expect(rows(f).length).toBe(0);
  });

  it('▲ ignores a click on a row outside interactive mode', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'default' });
    const seen: TimelineItem[] = [];
    f.componentInstance.itemClick.subscribe((i) => seen.push(i));

    // `div.flex-1.min-w-0` is the content column. Plain `.flex-1` also matches
    // the connector line, which carries no handler — a selector that hits it
    // makes this test pass without ever reaching the guard.
    el(f).querySelectorAll('li')[0].querySelector<HTMLElement>('div.flex-1.min-w-0')!.click();
    f.detectChanges();

    expect(f.componentInstance.selectedId()).toBeNull();
    expect(seen).toEqual([]);
  });

  it('▲ activates on Enter and on Space, cancelling the key default', async () => {
    // A div has no native activation, so free must supply it. Space in
    // particular would otherwise scroll the page.
    const f = await setup({ items: ITEMS, displayMode: 'interactive' });
    const seen: TimelineItem[] = [];
    f.componentInstance.itemClick.subscribe((i) => seen.push(i));

    for (const key of ['Enter', ' ']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      rows(f)[0].dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    f.detectChanges();
    expect(seen.map((i) => i.id)).toEqual(['a', 'a']);
  });

  it('▲ leaves other keys alone', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'interactive' });
    const seen: TimelineItem[] = [];
    f.componentInstance.itemClick.subscribe((i) => seen.push(i));

    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    rows(f)[0].dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(seen).toEqual([]);
  });

  it('▲ ignores Enter outside interactive mode', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'default' });
    const seen: TimelineItem[] = [];
    f.componentInstance.itemClick.subscribe((i) => seen.push(i));

    const target = el(f).querySelectorAll('li')[0].querySelector<HTMLElement>('div.flex-1.min-w-0')!;
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    target.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
    expect(seen).toEqual([]);
  });

  it('honours a selectedId supplied by the host', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'interactive', selectedId: 'b' });
    expect(rows(f).map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });
});

// ─── Size presets ─────────────────────────────────────────────────────────────

describe('SvTimelineComponent — size presets', () => {
  it.each([
    ['sm', 'h-7 w-7', 'text-sm'],
    ['md', 'h-9 w-9', 'text-base'],
    ['lg', 'h-11 w-11', 'text-lg'],
  ])('scales the dot and the title together at %s', async (size, dot, title) => {
    const f = await setup({ items: [{ id: 1, title: 'Deployed' }] as TimelineItem[], size });
    expect(el(f).querySelector('.ring-4')!.className).toContain(dot);
    expect(el(f).querySelector('h3, p')!.className).toContain(title);
  });
});

// ─── Dot icon ─────────────────────────────────────────────────────────────────

/**
 * `TimelineItem.icon` was `iconPath`, a raw SVG `d` attribute piped through
 * `<path [attr.d]>` at **seven separate call sites** — and nothing in either
 * twin's suite touched it, so a typo drew an empty dot in silence. These are
 * the first tests the dot glyph has ever had.
 *
 * ★★ It sweeps every branch on purpose. The first version of this test rendered
 * only the default layout and **passed with a hand-drawn `<svg>` restored to
 * the horizontal branch** — one assertion guarding one of seven copies. The
 * seven sites are not decoration: each layout/displayMode/dotStyle branch draws
 * its own dot, which is exactly why the same glyph got pasted seven times.
 */
const ICON_BRANCHES: readonly (readonly [string, Record<string, unknown>])[] = [
  ['default',              {}],
  ['horizontal layout',    { layout: 'horizontal' }],
  ['alternate layout',     { layout: 'alternate' }],
  // ★ status mode draws the glyph only for the ACTIVE step — a pending or
  //   complete step gets a tick or a hollow dot instead. Without
  //   `activeIndex` this branch renders no <svg> at all and the sweep
  //   would pass by rendering nothing.
  ['status mode',          { displayMode: 'status', activeIndex: 0 }],
  ['rich mode',            { displayMode: 'rich' }],
  ['grouped by date',      { groupByDate: true }],
  ["dotStyle='check'",     { dotStyle: 'check', activeIndex: 0 }],
];

describe('SvTimelineComponent — dot icon', () => {
  it.each(ICON_BRANCHES)('draws no glyph by hand in the %s branch', async (_label, inputs) => {
    const f = await setup({
      items: [{ id: 1, title: 'Deployed', icon: 'check-circle', groupDate: 'Today' }] as TimelineItem[],
      ...inputs,
    });
    const host = el(f);
    const svgs = [...host.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  it('resolves the name against the FREE registry rather than rendering an empty shell', async () => {
    const f = await setup({ items: [{ id: 1, title: 'Deployed', icon: 'check-circle' }] as TimelineItem[] });
    const icon = el(f).querySelector('sv-icon');
    expect(icon).toBeTruthy();
    expect(icon!.querySelector('path, polyline, line, circle')).toBeTruthy();
  });

  it('falls back to a solid dot when no icon is named', async () => {
    const f = await setup({ items: [{ id: 1, title: 'Deployed' }] as TimelineItem[] });
    expect(el(f).querySelector('sv-icon')).toBeNull();
  });

  it('carries the size preset onto the glyph, so dot and icon scale together', async () => {
    const f = await setup({ items: [{ id: 1, title: 'Deployed', icon: 'check-circle' }] as TimelineItem[], size: 'lg' });
    expect(el(f).querySelector('sv-icon svg')!.getAttribute('class')).toContain('h-5');
  });
});
