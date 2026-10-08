import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvSpinnerComponent } from './spinner.component';

/**
 * ============================================================================
 *  `sv-spinner` — stating an expectation (`OF-18-I8`)
 * ============================================================================
 *
 * ★★★ AN ESCALATION IS AN APOLOGY, NOT AN EXPECTATION. `slowAfterMs` speaks
 *     only once the wait has already gone wrong; it says "longer than usual"
 *     without the component ever having said what usual IS. The user's
 *     decision — keep waiting, or reload and lose the form — is made in the
 *     first second or two, and it was made on nothing.
 *
 * ★★ ONE NUMBER, NOT THREE. `expectedMs` is shown to the user AND derives both
 *    escalation thresholds, so the figure on screen and the moment the
 *    component admits lateness cannot disagree.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvSpinnerComponent, { inputs });
  return { ...view, c: view.fixture.componentInstance };
}

const expectationEl = () =>
  document.querySelector('[data-sv-state="expectation"]') as HTMLElement | null;
const expectation = () => expectationEl()?.textContent?.trim() ?? null;
const escalation = () =>
  (document.querySelector('[data-sv-state="escalation"]') as HTMLElement | null)
    ?.textContent?.trim() ?? null;
const statusRegion = () => document.querySelector('[role="status"]') as HTMLElement;

function tick(view: Awaited<ReturnType<typeof setup>>, ms: number) {
  vi.advanceTimersByTime(ms);
  view.fixture.detectChanges();
}

/** Only the kit's own warnings; Angular emits its own for unrelated reasons. */
function svWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map(args => String(args[0]))
    .filter(text => text.startsWith('[styloviz]'));
}

beforeEach(() => {
  vi.useFakeTimers();
  svResetWarnOnce();
});
afterEach(() => vi.useRealTimers());

describe('sv-spinner — an expectation nobody stated', () => {
  it('says nothing about time by default', async () => {
    await setup();
    expect(expectation()).toBeNull();
  });

  it('leaves the accessible name exactly as it was', async () => {
    // ★ Every existing spinner in every existing layout goes through this
    //   path. The name it had is the name it keeps.
    const view = await setup({ label: 'Loading…' });
    expect(statusRegion().getAttribute('aria-label')).toBe('Loading…');
    expect(view.c.resolvedLabel()).toBe('Loading…');
  });

  it('ignores a figure that is not a duration', async () => {
    for (const expectedMs of [0, -5_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const view = await setup({ expectedMs });
      expect(expectation()).toBeNull();
      expect(view.c.resolvedSlowAfterMs()).toBe(0);
      expect(view.c.resolvedStalledAfterMs()).toBe(0);
    }
  });
});

describe('sv-spinner — the expectation on screen', () => {
  it('states it from the first frame, before anything has gone wrong', async () => {
    await setup({ expectedMs: 25_000 });
    expect(expectation()).toBe('about 25 seconds');
    expect(escalation()).toBeNull();
  });

  it('is hidden from the reader, because the name already carries it', async () => {
    // ★★ A live region announces what CHANGES in it, not the content it was
    //    born with. So the expectation has to be in the name to be heard at
    //    all — and then the visible copy must not be a second voice.
    const view = await setup({ expectedMs: 25_000, label: 'Importing…' });

    expect(expectationEl()?.getAttribute('aria-hidden')).toBe('true');
    expect(statusRegion().getAttribute('aria-label')).toBe('Importing… about 25 seconds');
    expect(view.c.resolvedLabel()).toBe('Importing… about 25 seconds');
  });

  it('punctuates the name: a comma after a label, nothing after "…"', async () => {
    const withMark = await setup({ expectedMs: 8_000, label: 'Importing…' });
    expect(withMark.c.resolvedLabel()).toBe('Importing… about 8 seconds');

    const plain = await setup({ expectedMs: 8_000, label: 'Importing' });
    expect(plain.c.resolvedLabel()).toBe('Importing, about 8 seconds');
  });

  it('is the whole name when there is no label to join', async () => {
    const view = await setup({ expectedMs: 8_000, label: '   ' });
    expect(view.c.resolvedLabel()).toBe('about 8 seconds');
  });

  it('takes the host\'s wording over the generated sentence', async () => {
    const view = await setup({
      expectedMs: 25_000,
      expectationMessage: 'Normalerweise etwa 25 Sekunden',
    });
    expect(expectation()).toBe('Normalerweise etwa 25 Sekunden');
    expect(view.c.resolvedLabel()).toBe('Loading… Normalerweise etwa 25 Sekunden');
  });

  it('states no expectation at all when the host blanks the wording', async () => {
    // ★ The thresholds still derive: a host can want the timers without the
    //   sentence, and `''` says so in a way `null` cannot.
    const view = await setup({ expectedMs: 25_000, expectationMessage: '' });
    expect(expectation()).toBeNull();
    expect(view.c.resolvedLabel()).toBe('Loading…');
    expect(view.c.resolvedStalledAfterMs()).toBe(100_000);
  });

  it('shows wording alone, with no thresholds, when only the words were given', async () => {
    // Text has no number in it. `expectationMessage` cannot derive a timer.
    const view = await setup({ expectationMessage: 'Usually quick' });
    expect(expectation()).toBe('Usually quick');
    expect(view.c.resolvedSlowAfterMs()).toBe(0);
    expect(view.c.resolvedStalledAfterMs()).toBe(0);
    tick(view, 10 * 60_000);
    expect(escalation()).toBeNull();
  });
});

describe('sv-spinner — the expectation stops being shown when it stops being true', () => {
  it('replaces it with the escalation rather than stacking the two', async () => {
    // ★★★ "about 10 seconds" under "this is taking longer than usual" is the
    //     component contradicting itself in one glance, and the figure is the
    //     half the user believes.
    const view = await setup({ expectedMs: 10_000 });
    expect(expectation()).toBe('about 10 seconds');

    tick(view, 15_000);
    expect(view.c.waitStage()).toBe('slow');
    expect(expectation()).toBeNull();
    expect(escalation()).toBe('This is taking longer than usual…');

    tick(view, 25_000);
    expect(view.c.waitStage()).toBe('stalled');
    expect(expectation()).toBeNull();
  });

  it('keeps the accessible name stable across the escalation', async () => {
    // ★ Renaming a live region mid-wait is a second voice for one wait
    //   (`X-9`), and the escalation already speaks from inside it.
    const view = await setup({ expectedMs: 10_000, label: 'Importing…' });
    const before = statusRegion().getAttribute('aria-label');

    tick(view, 15_000);
    expect(statusRegion().getAttribute('aria-label')).toBe(before);
    expect(before).toBe('Importing… about 10 seconds');
  });
});

describe('sv-spinner — one number drives the timers', () => {
  it('derives slow at 1.5× and stalled at 4× the expectation', async () => {
    const view = await setup({ expectedMs: 10_000 });
    expect(view.c.resolvedSlowAfterMs()).toBe(15_000);
    expect(view.c.resolvedStalledAfterMs()).toBe(40_000);

    tick(view, 14_999);
    expect(view.c.waitStage()).toBe('waiting');
    tick(view, 1);
    expect(view.c.waitStage()).toBe('slow');

    tick(view, 24_999);
    expect(view.c.waitStage()).toBe('slow');
    tick(view, 1);
    expect(view.c.waitStage()).toBe('stalled');
  });

  it('does not apologise at exactly the figure it stated', async () => {
    // ★ "about 25 seconds" is a claim about the middle of a distribution. A
    //   component that escalated the instant it elapsed would apologise for
    //   half of all successful requests.
    const view = await setup({ expectedMs: 25_000 });
    tick(view, 25_000);
    expect(view.c.waitStage()).toBe('waiting');
    expect(escalation()).toBeNull();
  });

  it('lets an explicit threshold win over the derived one', async () => {
    const view = await setup({
      expectedMs: 10_000,
      slowAfterMs: 30_000,
      stalledAfterMs: 90_000,
    });
    expect(view.c.resolvedSlowAfterMs()).toBe(30_000);
    expect(view.c.resolvedStalledAfterMs()).toBe(90_000);
  });

  it('drops a derived slow stage that would land after an explicit stalled', async () => {
    // Expectation 30s → derived slow 45s, which is past the host's 20s
    // stalled. The escalation never demotes, so that timer could only ever
    // fire into a stage it cannot change — a configured feature that does
    // nothing.
    const view = await setup({ expectedMs: 30_000, stalledAfterMs: 20_000 });
    expect(view.c.resolvedSlowAfterMs()).toBe(0);
    expect(view.c.resolvedStalledAfterMs()).toBe(20_000);

    tick(view, 20_000);
    expect(view.c.waitStage()).toBe('stalled');
  });

  it('offers the cancel at the derived stalled stage, when one was given', async () => {
    const view = await setup({ expectedMs: 10_000, cancelLabel: 'Stop the import' });
    tick(view, 40_000);
    expect(view.c.cancelOffered()).toBe(true);
    expect(
      (document.querySelector('[data-sv-cancel]') as HTMLElement | null)?.textContent?.trim(),
    ).toBe('Stop the import');
  });
});

describe('sv-spinner — a stated expectation the timers contradict', () => {
  it('warns when slowAfterMs fires while the wait is still within the expectation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup({ expectedMs: 25_000, slowAfterMs: 5_000 });

    const warnings = svWarnings(warn);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('slowAfterMs');
    warn.mockRestore();
  });

  it('says nothing when the two agree', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup({ expectedMs: 25_000, slowAfterMs: 40_000 });
    expect(svWarnings(warn)).toHaveLength(0);
    warn.mockRestore();
  });

  it('says nothing when there is no expectation to contradict', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup({ slowAfterMs: 1_000 });
    expect(svWarnings(warn)).toHaveLength(0);
    warn.mockRestore();
  });
});
