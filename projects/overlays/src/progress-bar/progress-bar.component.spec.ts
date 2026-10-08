import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvProgressBarComponent } from './progress-bar.component';

/**
 * A progress bar is arithmetic wired straight to `aria-valuenow` and a CSS
 * width, so a bad divisor does not produce a wrong bar — it produces
 * `aria-valuenow="NaN"` and `width: NaN%`. A `max` of zero is the ordinary way
 * to get one: bind the bar to `items.length` and render it before the list
 * arrives.
 *
 * The other half is the indeterminate mode, which must drop `aria-valuenow`
 * entirely rather than report a number it does not know.
 */

async function setup(inputs: Partial<ComponentInput<SvProgressBarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvProgressBarComponent, {
    inputs: inputs as ComponentInput<SvProgressBarComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const bar = () => screen.getByRole('progressbar');
const fill = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLElement>('[style*="width"]')!;

describe('SvProgressBarComponent — the number', () => {
  it('turns a value into a percentage of its max', async () => {
    const { fixture } = await setup({ value: 25 });
    expect(fixture.componentInstance.percent()).toBe(25);

    const { fixture: outOf50 } = await setup({ value: 25, max: 50 });
    expect(outOf50.componentInstance.percent()).toBe(50);
  });

  it('clamps a value outside its own scale', async () => {
    const { fixture: over } = await setup({ value: 500 });
    expect(over.componentInstance.percent()).toBe(100);

    const { fixture: under } = await setup({ value: -20 });
    expect(under.componentInstance.percent()).toBe(0);
  });

  it('reports nothing rather than NaN when there is no scale yet', async () => {
    // `max` bound to a count that has not loaded. Divided through, this reached
    // the DOM as aria-valuenow="NaN" and width: NaN%.
    const { fixture } = await setup({ value: 5, max: 0 });
    expect(fixture.componentInstance.percent()).toBe(0);
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
    expect(el(fixture).innerHTML).not.toContain('NaN');
  });

  it('survives a negative max just as quietly', async () => {
    const { fixture } = await setup({ value: 5, max: -10 });
    expect(fixture.componentInstance.percent()).toBe(0);
    expect(el(fixture).innerHTML).not.toContain('NaN');
  });

  it('drives the fill width from the same number', async () => {
    const { fixture } = await setup({ value: 40 });
    expect(fill(fixture).style.width).toBe('40%');
  });
});

describe('SvProgressBarComponent — what it announces', () => {
  it('is a progressbar with a range', async () => {
    await setup({ value: 30 });
    expect(bar().getAttribute('aria-valuenow')).toBe('30');
    expect(bar().getAttribute('aria-valuemin')).toBe('0');
    expect(bar().getAttribute('aria-valuemax')).toBe('100');
  });

  it('takes a name from the host', async () => {
    await setup({ value: 30, ariaLabel: 'Upload progress' });
    expect(screen.getByRole('progressbar', { name: 'Upload progress' })).toBeTruthy();
  });

  it('reports no number at all while it is indeterminate', async () => {
    // A bar that does not know how far along it is must not claim a figure.
    await setup({ indeterminate: true });
    expect(bar().getAttribute('aria-valuenow')).toBeNull();
    expect(bar().getAttribute('aria-valuemin')).toBeNull();
    expect(bar().getAttribute('aria-valuemax')).toBeNull();
    expect(bar().getAttribute('aria-busy')).toBe('true');
  });

  it('reads out a labelled bar as its label and its figure', async () => {
    // ★ The comma is deliberate and arrived with the stage model
    //   (`OF-14-M3`): a screen reader pauses on it, and the three-part form
    //   "Processing, step 3 of 5, 60%" is unreadable run together. The
    //   two-part form takes the same separator rather than having two rules.
    await setup({ value: 60, label: 'Uploading' });
    expect(bar().getAttribute('aria-valuetext')).toBe('Uploading, 60%');
  });

  /**
   * `role="progressbar"` requires a name and `ariaLabel` is empty by default, so
   * a bar named only by `label` — the ordinary way to use it — shipped unnamed.
   */
  it('falls back to the visible label, then to a constant, so it is never unnamed', async () => {
    await setup({ value: 60, label: 'Uploading' });
    expect(screen.getByRole('progressbar', { name: 'Uploading' })).toBeTruthy();
  });

  it('names even a bare bar with no label of any kind', async () => {
    await setup({ value: 60 });
    expect(bar().getAttribute('aria-label')).toBe('Progress');
  });

  it('lets ariaLabel win over the visible label when the host sets both', async () => {
    await setup({ value: 60, label: 'Uploading', ariaLabel: 'Avatar upload progress' });
    expect(bar().getAttribute('aria-label')).toBe('Avatar upload progress');
  });
});

describe('SvProgressBarComponent — the label', () => {
  it('shows the percentage when there is no label', async () => {
    const { fixture } = await setup({ value: 60 });
    expect(fixture.componentInstance.displayText()).toBe('60%');
  });

  it('prefers the label the host wrote', async () => {
    const { fixture } = await setup({ value: 60, label: 'Almost there' });
    expect(fixture.componentInstance.displayText()).toBe('Almost there');
  });

  it('shows nothing when neither is wanted', async () => {
    const { fixture } = await setup({ value: 60, showPercent: false });
    expect(fixture.componentInstance.displayText()).toBe('');
  });

  it('only puts the label inside a bar tall enough to hold it', async () => {
    const { fixture: tall } = await setup({ value: 60, labelPos: 'inside', size: 'lg' });
    expect(tall.componentInstance.insideLabelVisible()).toBe(true);

    const { fixture: short } = await setup({ value: 60, labelPos: 'inside', size: 'sm' });
    expect(short.componentInstance.insideLabelVisible()).toBe(false);

    const { fixture: barely } = await setup({ value: 5, labelPos: 'inside', size: 'lg' });
    expect(barely.componentInstance.insideLabelVisible()).toBe(false);
  });
});

describe('SvProgressBarComponent — reaching the end', () => {
  it('says so, once', async () => {
    let completions = 0;
    const { fixture } = await setup({ value: 0 });
    fixture.componentInstance.completed.subscribe(() => { completions += 1; });

    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
    expect(completions).toBe(1);

    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
    expect(completions).toBe(1);
  });

  it('can say so again after going back', async () => {
    let completions = 0;
    const { fixture } = await setup({ value: 100 });
    fixture.componentInstance.completed.subscribe(() => { completions += 1; });

    fixture.componentRef.setInput('value', 50);
    fixture.detectChanges();
    fixture.componentRef.setInput('value', 100);
    fixture.detectChanges();
    expect(completions).toBe(1);
  });

  it('never claims to be finished while it is indeterminate', async () => {
    let completions = 0;
    const { fixture } = await setup({ value: 100, indeterminate: true });
    fixture.componentInstance.completed.subscribe(() => { completions += 1; });
    fixture.detectChanges();
    expect(completions).toBe(0);
  });
});

describe('SvProgressBarComponent — looks', () => {
  it.each(['xs', 'sm', 'md', 'lg'] as const)('gives %s its own height', async (size) => {
    const { fixture } = await setup({ size });
    expect(fixture.componentInstance.trackHeight()).toMatch(/^h-/);
  });

  it.each(['primary', 'success', 'warning', 'danger', 'info', 'neutral'] as const)('colours %s', async (variant) => {
    const { fixture } = await setup({ variant });
    expect(fixture.componentInstance.fillClasses()).toContain('bg-');
    expect(fixture.componentInstance.fillClasses()).not.toContain('undefined');
  });

  it('animates the stripes only when there are stripes', async () => {
    const { fixture: animatedOnly } = await setup({ animated: true });
    expect(animatedOnly.componentInstance.fillClasses()).not.toContain('progress-stripe');

    const { fixture: both } = await setup({ striped: true, animated: true });
    expect(both.componentInstance.fillClasses()).toContain('progress-stripe');
  });

  it('adds a glow that matches the variant', async () => {
    const { fixture } = await setup({ variant: 'danger', glow: true });
    expect(fixture.componentInstance.fillClasses()).toContain(
      'shadow-[0_0_8px_color-mix(in_oklab,var(--color-danger-500)_60%,transparent)]',
    );
  });

  // The glow used to be a hardcoded rgba per variant, and `primary` had drifted
  // to indigo — the bar filled blue and the halo sat one family over. Naming the
  // family in the assertion is what catches that, where a raw rgba never could.
  it('glows in the same family the bar fills with', async () => {
    const { fixture } = await setup({ variant: 'primary', glow: true });
    expect(fixture.componentInstance.fillClasses()).toContain(
      'shadow-[0_0_8px_color-mix(in_oklab,var(--color-primary-500)_60%,transparent)]',
    );
  });
});

// ── OF-14-I7 / OF-14-M6 · a hundred announcements for a hundred percent ──────

describe('SvProgressBarComponent — what it tells assistive technology, and how often', () => {
  /**
   * ★★★ A `role="progressbar"` IS A LIVE REGION IN EVERYTHING BUT NAME. Screen
   *     readers speak its value when `aria-valuenow` changes — NVDA does by
   *     default — so a bar driven by a real upload emitted one announcement
   *     per percent and the user could not hear anything else while it ran.
   *
   * ★★ The kit cannot throttle the screen reader; how often a progressbar is
   *    spoken is the AT's setting. The only lever is how often the attribute
   *    changes at all, which is what these assert.
   */
  it('★ quantizes the reported value, so a full run announces 20 times not 100', async () => {
    const seen = new Set<string>();
    for (let value = 0; value <= 100; value++) {
      // Rendered for effect: `bar()` reads the latest one out of `document`.
      await setup({ value, max: 100 });
      seen.add(bar().getAttribute('aria-valuenow')!);
    }
    // 0, 1, 2, 5, 10 … 95, 100 — twenty-three distinct values across a
    // hundred updates. 1 and 2 are exact rather than rounded up to 5, so a low
    // value is never overstated.
    expect(seen.size).toBe(23);
  });

  it('★ 0 and 100 pass through exactly — "started" and "finished" are the two that matter', async () => {
    await setup({ value: 0, max: 100 });
    expect(bar().getAttribute('aria-valuenow')).toBe('0');

    await setup({ value: 100, max: 100 });
    expect(bar().getAttribute('aria-valuenow')).toBe('100');

    // ★★ ONLY 100 IS 100, AND ONLY 0 IS 0 (OF-14-I1 / OF-14-M6). Rounding 98%
    //    to the nearest step used to report `aria-valuenow="100"` — a
    //    screen reader announced "finished" while work remained, `(completed)`
    //    had not fired, and an `estimated` bar drew "~100%". An in-flight value
    //    now reports the last step BELOW 100, and a value below half a step reports
    //    exactly — never 0 ("not started"), never rounded UP past itself.
    await setup({ value: 98, max: 100 });
    expect(bar().getAttribute('aria-valuenow')).toBe('95');
    await setup({ value: 99.4, max: 100 });
    expect(bar().getAttribute('aria-valuenow')).toBe('95');
    await setup({ value: 2, max: 100 });
    expect(bar().getAttribute('aria-valuenow')).toBe('2');
  });

  it('★★ never overstates a low in-flight value, whatever the step (OF-14-M6)', async () => {
    // Rounding up to the first step announced 12% as 25% and 1% as 50%.
    for (const [value, step] of [[12, 25], [1, 50], [2, 5], [24, 50]] as const) {
      await setup({ value, max: 100, announceStep: step });
      const now = Number(bar().getAttribute('aria-valuenow'));
      expect(now).toBeLessThanOrEqual(value);
      expect(now).toBeGreaterThan(0);
    }
    // Once past half a step it quantizes as before.
    await setup({ value: 13, max: 100, announceStep: 25 });
    expect(bar().getAttribute('aria-valuenow')).toBe('25');
  });

  it('★★ never draws or announces 100% for work that is not done', async () => {
    // 99.6 of 100 rounded to 100 in `percent` itself: a full fill, "100%" on
    // screen and a `(completed)` event for an unfinished job.
    const { fixture } = await setup({ value: 99.6, max: 100, estimated: true });
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.detectChanges();
    expect(fixture.componentInstance.percent()).toBe(99);
    expect(fixture.componentInstance.percentText()).toBe('~95%');
    expect(bar().getAttribute('aria-valuenow')).toBe('95');
    expect(completed).not.toHaveBeenCalled();

    await setup({ value: 99.6, max: 100 });
    expect(bar().getAttribute('aria-valuenow')).not.toBe('100');
    expect(bar().textContent).not.toContain('100%');
  });

  it('★ a step coarser than the range cannot fabricate 0 or 100 either', async () => {
    await setup({ value: 80, max: 100, announceStep: 150 });
    expect(bar().getAttribute('aria-valuenow')).toBe('80');
    await setup({ value: 97, max: 100, announceStep: 7 });
    expect(bar().getAttribute('aria-valuenow')).toBe('98');
  });

  it('★ a non-finite step reports exact values rather than NaN', async () => {
    await setup({ value: 42, max: 100, announceStep: Number.NaN });
    expect(bar().getAttribute('aria-valuenow')).toBe('42');
  });

  it('★ a NaN value renders as 0%, as its own dev warning says, not as NaN', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({ value: Number.NaN, max: 100, label: 'Upload' });
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('NaN');
    warn.mockRestore();
  });

  it('★ 100 survives a step that does not divide 100', async () => {
    // ★★ THE CASE THAT MAKES THE 0/100 GUARD LOAD-BEARING, and the first
    //    version of these tests could not see it: with the default step of 5
    //    the arithmetic lands on 100 by itself, so the guard looked
    //    decorative. With a step of 3 it does not — `round(100/3)*3` is 99 —
    //    and a bar that finished at 99% would be a worse bug than the churn
    //    this quantization fixes.
    await setup({ value: 100, max: 100, announceStep: 3 });
    expect(bar().getAttribute('aria-valuenow')).toBe('100');

    await setup({ value: 0, max: 100, announceStep: 7 });
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
  });

  it('[announceStep]="1" restores the old per-percent reporting', async () => {
    await setup({ value: 42, max: 100, announceStep: 1 });
    expect(bar().getAttribute('aria-valuenow')).toBe('42');
  });

  it('aria-valuetext reports the same quantized number as aria-valuenow', async () => {
    // Two numbers for one value is worse than a coarse one.
    await setup({ value: 42, max: 100, label: 'Uploading' });
    expect(bar().getAttribute('aria-valuenow')).toBe('40');
    expect(bar().getAttribute('aria-valuetext')).toBe('Uploading, 40%');
  });

  it('indeterminate still reports no value at all', async () => {
    await setup({ indeterminate: true, value: 42 });
    expect(bar().getAttribute('aria-valuenow')).toBeNull();
    expect(bar().getAttribute('aria-valuetext')).toBeNull();
  });
});
