import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTimelineComponent } from './timeline.component';
import type { TimelineItem } from './timeline.component';

/**
 * ★ DEFECT — the free timeline announced no step state at all.
 *
 * In `displayMode="status"`, and in the default layout with
 * `dotStyle="check"` or `"number"`, every step's completed / current / pending
 * state was carried ONLY by the dot's colour and shape: emerald + tick,
 * indigo + pulsing ring, hollow grey. Nothing in the accessibility tree said
 * which step the user was on.
 *
 * User-visible consequence: a screen-reader user following an order tracker or
 * a checkout stepper heard "Ordered, Packed, Shipped" — three plain list items,
 * indistinguishable — with no way to tell what had happened and what had not.
 * That is WCAG 1.4.1 (Use of Color) and 1.3.1 (Info and Relationships).
 *
 * The Pro twin has emitted `aria-current="step"` and an sr-only status prefix
 * since it was written, which is what makes this a free-only regression rather
 * than a missing premium feature: the two are sold as the same control.
 *
 * Fixed by porting `stepStatusLabel()` and the two markup hooks across
 * verbatim. The assertions below are byte-identical in intent to the ones the
 * Pro spec makes, so the twins cannot drift apart again silently.
 */

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTimelineComponent, { inputs });
  return fixture;
}

const STEPS: TimelineItem[] = [
  { id: 'a', title: 'Ordered' },
  { id: 'b', title: 'Packed' },
  { id: 'c', title: 'Shipped' },
];

const announced = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll('.sr-only')].map((n) => n.textContent?.trim());

describe('SvTimelineComponent — step state is announced, not just coloured', () => {
  it('names each step\'s state in the status tracker', async () => {
    const f = await setup({ items: STEPS, displayMode: 'status', activeIndex: 1 });
    expect(announced(f)).toEqual(['Completed:', 'Current step:', 'Pending:']);
  });

  it('marks the current step with aria-current in the status tracker', async () => {
    const f = await setup({ items: STEPS, displayMode: 'status', activeIndex: 1 });
    expect([...el(f).querySelectorAll('li')].map((r) => r.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
    ]);
  });

  it('announces the data-driven state when activeIndex is unset', async () => {
    const f = await setup({
      items: [
        { id: 'a', title: 'Ordered', itemStatus: 'complete' },
        { id: 'b', title: 'Packed', itemStatus: 'active' },
        { id: 'c', title: 'Shipped' },
      ] as TimelineItem[],
      displayMode: 'status',
    });
    expect(announced(f)).toEqual(['Completed:', 'Current step:', 'Pending:']);
  });

  it.each(['check', 'number'])('names each step\'s state for dotStyle=%s', async (dotStyle) => {
    const f = await setup({ items: STEPS, dotStyle, activeIndex: 2 });
    expect(announced(f)).toEqual(['Completed:', 'Completed:', 'Current step:']);
    expect([...el(f).querySelectorAll('li')].map((r) => r.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'step',
    ]);
  });

  it('does not call a plain dot timeline a process', async () => {
    // ▲ The negative, and the assertion has moved with the model. It used to
    //   check for NO `aria-current` at all, reasoning from `dotStyle` — which is
    //   the conflation `intent` exists to remove. A plain-dot list with an
    //   explicit `activeIndex` is a CHRONOLOGY with a current item: the host
    //   deliberately marked one and the component highlights it, so leaving the
    //   highlight with no non-visual counterpart is the defect, not the fix.
    //   What must not appear is `"step"`, which claims a process.
    const f = await setup({ items: STEPS, dotStyle: 'dot', activeIndex: 1 });
    expect(announced(f)).toEqual([]);
    expect([...el(f).querySelectorAll('li')].map((r) => r.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ]);
  });

  it('says nothing at all in a feed, which has no position to be at', async () => {
    // ★ A log of events is not somewhere you are partway through. `intent`
    //   decides this now, so it is a claim the host makes rather than one
    //   inferred from the shape of a dot.
    const f = await setup({ items: STEPS, dotStyle: 'dot', activeIndex: 1, intent: 'feed' });
    expect([...el(f).querySelectorAll('li')].map((r) => r.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('says "step" when the host says it is a process, whatever the dot looks like', async () => {
    // ★★ THE BUG IN ONE ASSERTION. This used to be impossible: `aria-current`
    //    was gated on `isStepper`, i.e. on the dot being a tick or a number, so
    //    a genuine process drawn with plain dots announced nothing.
    const f = await setup({ items: STEPS, dotStyle: 'dot', activeIndex: 1, intent: 'process' });
    expect([...el(f).querySelectorAll('li')].map((r) => r.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
    ]);
  });

  it('names the list by what it means, not by the display mode', async () => {
    const f = await setup({ items: STEPS, intent: 'feed' });
    expect(el(f).querySelector('ol')?.getAttribute('aria-label')).toBe('Activity feed');

    const process = await setup({ items: STEPS, intent: 'process' });
    expect(process.nativeElement.querySelector('ol')?.getAttribute('aria-label'))
      .toBe('Progress tracker');
  });
});
