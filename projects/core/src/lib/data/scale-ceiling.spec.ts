import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { Component, input } from '@angular/core';
import { svScaleLabel, svScaleWindow, type SvScaleWindow } from './scale-ceiling';
import { SvScaleNoticeComponent } from './shells/scale-notice.component';

/**
 * ============================================================================
 *  `X-4` — the scale contract
 * ============================================================================
 *
 * ★★★ A DEGRADED VIEW MUST NEVER BE SILENTLY DEGRADED. The failure this
 *     prevents is not a slow page — it is a surface rendering a hundred of five
 *     thousand rows and saying it is showing everything, which is worse than
 *     freezing, because a page that freezes is at least honest about being in
 *     trouble.
 */

const rows = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe('svScaleWindow', () => {
  it('passes a list under the ceiling through untouched', () => {
    const w = svScaleWindow(rows(10), 100);

    expect(w.items).toHaveLength(10);
    expect(w.truncated).toBe(false);
    expect(w.hidden).toBe(0);
    expect(w.total).toBe(10);
  });

  it('passes a list exactly at the ceiling through untouched', () => {
    // The ceiling is how many the view HOLDS, so sitting on it is not over it.
    const w = svScaleWindow(rows(100), 100);
    expect(w.truncated).toBe(false);
    expect(w.shown).toBe(100);
  });

  it('keeps the host’s order from the top by default', () => {
    const w = svScaleWindow(rows(10), 3);

    expect(w.items).toEqual([1, 2, 3]);
    expect(w.truncated).toBe(true);
    expect(w.hidden).toBe(7);
  });

  /**
   * ★★★ TRUNCATING A TRANSCRIPT FROM THE TOP IS THE ONLY CORRECT DIRECTION,
   *     and `slice(0, n)` does the opposite: the conversation the user is
   *     having right now is the part that vanishes, and the reply they are
   *     reading is the one that was dropped.
   */
  it('keeps the newest rows for a transcript or a feed', () => {
    const w = svScaleWindow(rows(10), 3, 'last');

    expect(w.items).toEqual([8, 9, 10]);
    expect(w.hidden).toBe(7);
    expect(w.keep).toBe('last');
  });

  it('reports the total the HOST supplied, never the size of the window', () => {
    // ★★ Every count a surface shows beside a truncated list comes from here.
    //    Reading it off the window reports the truncation as the size of the
    //    queue — the one number an operator acts on.
    const w = svScaleWindow(rows(5_000), 100, 'last');
    expect(w.total).toBe(5_000);
    expect(w.shown).toBe(100);
    expect(w.hidden).toBe(4_900);
  });

  it('treats a ceiling of zero or less as no ceiling', () => {
    // The kit's convention for "never" on every other threshold, and the
    // opt-out a host with its own virtual scroller needs.
    for (const ceiling of [0, -1, Number.NaN]) {
      const w = svScaleWindow(rows(1_000), ceiling);
      expect(w.truncated).toBe(false);
      expect(w.shown).toBe(1_000);
      expect(w.ceiling).toBe(0);
    }
  });

  it('floors a fractional ceiling rather than refusing it', () => {
    // A host computing a ceiling from a viewport height will produce fractions,
    // and 100.5 rows is not a thing.
    const w = svScaleWindow(rows(10), 3.9);
    expect(w.ceiling).toBe(3);
    expect(w.items).toEqual([1, 2, 3]);
  });

  it('survives a null or undefined list', () => {
    expect(svScaleWindow(null, 10).total).toBe(0);
    expect(svScaleWindow(undefined, 10).items).toEqual([]);
  });

  it('never drops everything when the ceiling is one', () => {
    expect(svScaleWindow(rows(10), 1, 'last').items).toEqual([10]);
    expect(svScaleWindow(rows(10), 1).items).toEqual([1]);
  });
});

describe('svScaleLabel', () => {
  it('says nothing about a complete list', () => {
    expect(svScaleLabel(svScaleWindow(rows(10), 100))).toBeNull();
  });

  /**
   * ★★ IT NAMES THE MISSING ROWS AND WHICH END THEY WERE AT. "Showing 100 of
   *    5,000" leaves the reader to work out whether they are looking at the
   *    beginning or the end of their own data, and in a transcript that is the
   *    only question that matters.
   */
  it('calls the dropped rows older when the newest were kept', () => {
    const text = svScaleLabel(svScaleWindow(rows(1_340), 100, 'last'), 'message')!;

    expect(text).toContain('1,240 older messages of 1,340 are not shown');
    expect(text).toContain('holds 100 at a time');
  });

  it('calls them further on when the list is in the host’s own order', () => {
    const text = svScaleLabel(svScaleWindow(rows(500), 200), 'tool')!;
    expect(text).toContain('300 further tools of 500');
  });

  it('uses the singular for exactly one hidden row', () => {
    expect(svScaleLabel(svScaleWindow(rows(101), 100), 'task')!).toContain('1 further task of 101');
  });

  it('groups thousands, because five thousand rows is the case this exists for', () => {
    expect(svScaleLabel(svScaleWindow(rows(12_000), 1_000), 'event')!).toContain('11,000');
  });
});

// ── The shared notice ────────────────────────────────────────────────────────

@Component({
  selector: 'sv-notice-host',
  imports: [SvScaleNoticeComponent],
  template: `<sv-scale-notice [window]="window()" [noun]="noun()" [label]="label()" />`,
})
class NoticeHost {
  readonly window = input.required<SvScaleWindow<unknown>>();
  readonly noun = input<string>('row');
  readonly label = input<string | null>(null);
}

async function notice(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const view = await render(NoticeHost, { inputs });
  view.fixture.detectChanges();
  return view.fixture;
}

const el = () => document.querySelector('[data-sv-state="truncated"]') as HTMLElement | null;

describe('sv-scale-notice', () => {
  it('renders nothing at all for a complete window', async () => {
    // ★★ A surface binds it unconditionally — a notice the host has to remember
    //    to show is a notice that will be missing on the screen that needs it.
    await notice({ window: svScaleWindow(rows(10), 100), noun: 'message' });
    expect(el()).toBeNull();
  });

  it('states the sentence, and carries the hidden count as data', async () => {
    await notice({ window: svScaleWindow(rows(1_340), 100, 'last'), noun: 'message' });

    expect(el()?.textContent).toContain('1,240 older messages');
    expect(el()?.getAttribute('data-sv-hidden-count')).toBe('1240');
  });

  it('takes the host’s wording over the generated sentence', async () => {
    await notice({
      window: svScaleWindow(rows(1_340), 100, 'last'),
      label: 'Nur die letzten 100 Nachrichten',
    });
    expect(el()?.textContent?.trim()).toBe('Nur die letzten 100 Nachrichten');
  });

  it('renders nothing when the host blanks the wording, truncated or not', async () => {
    // For a surface whose own layout already says it — a paginator, say.
    await notice({ window: svScaleWindow(rows(1_340), 100, 'last'), label: '' });
    expect(el()).toBeNull();
  });

  it('is in the reading order rather than hidden from it', async () => {
    await notice({ window: svScaleWindow(rows(200), 100), noun: 'task' });
    const node = el()!;
    expect(node.getAttribute('aria-hidden')).toBeNull();
    expect(node.className).not.toContain('sr-only');
  });
});
