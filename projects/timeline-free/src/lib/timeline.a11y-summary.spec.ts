import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTimelineComponent } from './timeline.component';
import type { TimelineItem } from './timeline.component';

/**
 * ============================================================================
 *  The dots and the lists, for someone who cannot see them (audit item X-9)
 * ============================================================================
 *
 * ★★★ A TIMELINE NEEDS NO COMPANION SUMMARY TABLE. It is an `<ol>` of `<li>`s
 *     rendered along a line: the order IS the DOM order and every title,
 *     timestamp and description is already text. What was NOT text is the dot —
 *     `item.variant` reached the page as `bg-danger-500` and nothing else, so the
 *     failed deploy in a release log was invisible to a listener while being the
 *     single most conspicuous thing on screen. That is WCAG 1.4.1.
 *
 * The second hole was identity: every list was hardcoded `aria-label="Timeline"`,
 * so a deploy log and an audit trail on one page were indistinguishable.
 *
 * These assertions are mirrored byte-for-byte in the pro twin's spec, so the two
 * cannot drift apart again silently — the same guard `timeline.a11y.spec.ts` set up.
 * ============================================================================
 */

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTimelineComponent, { inputs });
  return fixture;
}

const ITEMS: TimelineItem[] = [
  { id: 'a', title: 'Build passed', variant: 'success' },
  { id: 'b', title: 'Deploy failed', variant: 'error' },
  { id: 'c', title: 'Rollback queued', variant: 'warning' },
  { id: 'd', title: 'Note added', variant: 'info' },
  { id: 'e', title: 'Ticket opened' },
];

const dotNames = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll('[role="img"]')].map((n) => n.getAttribute('aria-label'));

describe('SvTimelineComponent — the dot colour is not the only carrier', () => {
  /** ★★★ The whole reason this changed: a red dot said "failed" to nobody. */
  it('names every meaningful dot colour in words', async () => {
    const f = await setup({ items: ITEMS });
    expect(dotNames(f)).toEqual(['Success', 'Error', 'Warning', 'Information']);
  });

  /**
   * ★★ The negative, and it matters more than the positive. `neutral`, `primary`
   *    and `brand` are theming, not state — "Primary" before every title is noise
   *    a listener has to wade through on every single row.
   */
  it.each(['neutral', 'primary', 'brand'] as const)('stays silent for the %s dot', async (variant) => {
    const f = await setup({ items: [{ id: 'a', title: 'Ticket opened', variant }] });
    expect(dotNames(f)).toEqual([]);
  });

  it('leaves an unset variant silent too', async () => {
    const f = await setup({ items: [{ id: 'a', title: 'Ticket opened' }] });
    expect(dotNames(f)).toEqual([]);
  });

  /** ★ Adds no role where there is nothing to announce — an empty `role="img"` is a trap. */
  it('adds no img role to a dot with no meaning to carry', async () => {
    const f = await setup({ items: ITEMS });
    expect(dotNames(f).every((n) => !!n)).toBe(true);
  });

  it.each(['horizontal', 'left', 'alternate'] as const)('labels the dots in the %s layout', async (layout) => {
    const f = await setup({ items: ITEMS, layout });
    expect(dotNames(f)).toContain('Error');
  });

  it.each(['rich', 'interactive'] as const)('labels the dots in %s mode', async (displayMode) => {
    const f = await setup({ items: ITEMS, displayMode });
    expect(dotNames(f)).toContain('Error');
  });

  /**
   * ★ Feed mode is the one display that draws no dot — an avatar takes its place
   *   and `item.variant` is never rendered. Nothing to label, and nothing hidden
   *   either: asserted so the omission stays deliberate rather than looking like
   *   a variant this pass forgot.
   */
  it('has no dot to label in feed mode, and renders no variant colour either', async () => {
    const f = await setup({ items: ITEMS, displayMode: 'feed' });
    expect(dotNames(f)).toEqual([]);
    expect(el(f).innerHTML).not.toContain('bg-danger-500');
  });
});

describe('SvTimelineComponent — each list can be told from the next', () => {
  it('names the list after the timeline when it is given a label', async () => {
    const f = await setup({ items: ITEMS, ariaLabel: 'Deploy history' });
    expect(el(f).querySelector('ol')?.getAttribute('aria-label')).toBe('Deploy history');
  });

  /** ★ The generic name is kept when unset, so nothing regresses to unnamed. */
  it('keeps the layout\'s own generic name when unset', async () => {
    const f = await setup({ items: ITEMS });
    expect(el(f).querySelector('ol')?.getAttribute('aria-label')).toBe('Timeline');
  });

  it('overrides the feed and tracker names too, which were equally fixed', async () => {
    const feed = await setup({ items: ITEMS, displayMode: 'feed', ariaLabel: 'Audit trail' });
    expect(el(feed).querySelector('ol')?.getAttribute('aria-label')).toBe('Audit trail');

    const tracker = await setup({ items: ITEMS, displayMode: 'status', ariaLabel: 'Order progress' });
    expect(el(tracker).querySelector('ol')?.getAttribute('aria-label')).toBe('Order progress');
  });

  it('treats a whitespace label as no label', async () => {
    const f = await setup({ items: ITEMS, ariaLabel: '   ' });
    expect(el(f).querySelector('ol')?.getAttribute('aria-label')).toBe('Timeline');
  });

  /**
   * ★★ A horizontal timeline scrolls and is a tab stop. An unnamed one is a place
   *    a keyboard user lands and is told nothing about.
   */
  it('names the scrollable region of a horizontal timeline', async () => {
    const f = await setup({ items: ITEMS, layout: 'horizontal', ariaLabel: 'Deploy history' });
    const region = el(f).querySelector('[role="region"]');
    expect(region?.getAttribute('aria-label')).toBe('Deploy history, scrollable');
    expect(region?.getAttribute('tabindex')).toBe('0');
  });
});
