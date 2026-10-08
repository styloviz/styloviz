import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvProgressBarComponent } from './progress-bar.component';

/**
 * ============================================================================
 *  Going backwards, guessing, and five phases in one bar
 *  `OF-14-I2` · `OF-14-I8` · `OF-14-M3`
 * ============================================================================
 *
 * ★★★ THE THREE WAYS A BAR LIES. It animates a DECREASE exactly like an
 *     increase, so a recalculated total plays as work being undone. It renders
 *     a GUESS as "43%", which is a claim about the remaining work that nobody
 *     made. And it shows one figure for a five-phase job, so a user watching
 *     "Processing" crawl cannot tell whether that is the last step or the
 *     second — the difference between waiting and giving up.
 *
 * ★★ The first two are told to the DEVELOPER as well, because neither is
 *    something the component can fix: it can refuse to animate backwards and
 *    it can hedge the number, but the arithmetic behind both belongs to the
 *    host.
 */

async function setup(inputs: Partial<ComponentInput<SvProgressBarComponent>> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  return render(SvProgressBarComponent, {
    inputs: inputs as ComponentInput<SvProgressBarComponent>,
  });
}

const bar = () => screen.getByRole('progressbar');

describe('SvProgressBarComponent — a value that falls', () => {
  it('★ snaps instead of gliding backwards', async () => {
    const { fixture } = await setup({ value: 80 });
    const c = fixture.componentInstance;
    expect(c.decreasing()).toBe(false);
    expect(c.fillClasses()).toContain('transition-[width]');

    fixture.componentRef.setInput('value', 20);
    fixture.detectChanges();
    expect(c.decreasing()).toBe(true);
    expect(c.fillClasses()).not.toContain('transition-[width]');
  });

  it('animates again as soon as it is rising', async () => {
    const { fixture } = await setup({ value: 80 });
    fixture.componentRef.setInput('value', 20);
    fixture.detectChanges();
    fixture.componentRef.setInput('value', 30);
    fixture.detectChanges();
    expect(fixture.componentInstance.decreasing()).toBe(false);
    expect(fixture.componentInstance.fillClasses()).toContain('transition-[width]');
  });

  it('treats an unchanged value as not falling', async () => {
    const { fixture } = await setup({ value: 40 });
    fixture.componentRef.setInput('value', 40);
    fixture.detectChanges();
    expect(fixture.componentInstance.decreasing()).toBe(false);
  });

  describe('and what the developer is told', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined); });
    afterEach(() => warn.mockRestore());
    const messages = () =>
      warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.startsWith('[styloviz]'));

    it('★ says nothing about a reset to zero, which is a restart', async () => {
      const { fixture } = await setup({ value: 100 });
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();
      expect(messages()).toEqual([]);
    });

    it('★ reports a PARTIAL decrease, which is the one nobody means', async () => {
      const { fixture } = await setup({ value: 80 });
      fixture.componentRef.setInput('value', 60);
      fixture.detectChanges();
      expect(messages().join('\n')).toContain('went backwards from 80% to 60%');
    });

    it('★ reports a value outside its own range rather than clamping in silence', async () => {
      await setup({ value: 140, max: 100 });
      const text = messages().join('\n');
      expect(text).toContain('value=140');
      expect(text).toContain('clamped it to 100');
    });

    it('reports a negative value too', async () => {
      await setup({ value: -5 });
      expect(messages().join('\n')).toContain('clamped it to 0');
    });

    it('★ says nothing about a zero max, which is what a loading list looks like', async () => {
      /**
       * ★★ AND THE VALUE IS NOT ZERO HERE, WHICH IS THE POINT. `value: 0,
       *    max: 0` is refused by the range check anyway (0 is not greater than
       *    0), so it proves nothing about the guard. A bar bound to
       *    `loaded.length` against a total that has not arrived yet reports
       *    "3 of 0" for one frame on first paint — warning there would fire
       *    for every list in the app, every time.
       */
      await setup({ value: 3, max: 0 });
      expect(messages()).toEqual([]);
    });

    it('reports a non-finite figure', async () => {
      await setup({ value: Number.NaN });
      expect(messages().join('\n')).toContain('non-finite');
    });

    it('says nothing about an ordinary bar', async () => {
      await setup({ value: 42, max: 100 });
      expect(messages()).toEqual([]);
    });
  });
});

describe('SvProgressBarComponent — a percentage that is a guess', () => {
  it('★ shows the hedge on screen and speaks it in the announcement', async () => {
    // A tilde is not read out, so a sighted user would see the hedge and a
    // listening one would hear the same false precision as before.
    const { fixture } = await setup({ value: 43, estimated: true, label: 'Uploading' });
    expect(fixture.componentInstance.percentText()).toBe('~45%');
    expect(bar().getAttribute('aria-valuetext')).toBe('Uploading, about 45%');
  });

  it('★ stops showing precision it does not have', async () => {
    // 43% is a claim; at the default step the estimate reads 45%.
    const { fixture } = await setup({ value: 43, estimated: true });
    expect(fixture.componentInstance.percentText()).toBe('~45%');

    const exact = await setup({ value: 43 });
    expect(exact.fixture.componentInstance.percentText()).toBe('43%');
  });

  it('hedges nothing when the figure is measured', async () => {
    const { fixture } = await setup({ value: 43, label: 'Uploading' });
    expect(fixture.componentInstance.percentText()).toBe('43%');
    // The ANNOUNCED figure is still quantized (43 → 45 at the default step of
    // 5): what `estimated` changes is the hedge, not the arithmetic.
    expect(bar().getAttribute('aria-valuetext')).toBe('Uploading, 45%');
  });

  it('announces an estimate even with no label at all', async () => {
    await setup({ value: 60, estimated: true });
    expect(bar().getAttribute('aria-valuetext')).toBe('about 60%');
  });

  it('adds nothing to aria-valuetext for a plain unlabelled bar', async () => {
    // `aria-valuenow` is doing the talking, and two numbers for one value is
    // worse than one.
    await setup({ value: 60 });
    expect(bar().getAttribute('aria-valuetext')).toBeNull();
  });
});

describe('SvProgressBarComponent — five phases in one bar', () => {
  const STAGES = ['Uploading', 'Scanning', 'Processing', 'Indexing', 'Done'];

  it('★ names the phase and says which of how many', async () => {
    const { fixture } = await setup({ value: 60, stages: STAGES, stageIndex: 2 });
    expect(fixture.componentInstance.stageLabel()).toBe('Processing');
    expect(fixture.componentInstance.stagePosition()).toBe('3 of 5');
    expect(fixture.componentInstance.displayText()).toBe('Processing (3 of 5)');
  });

  it('★★ announces the phase, the position and the figure', async () => {
    await setup({ value: 60, stages: STAGES, stageIndex: 2 });
    expect(bar().getAttribute('aria-valuetext')).toBe('Processing, step 3 of 5, 60%');
  });

  it('★ does not infer the position from the percentage', async () => {
    // The phases of real work are not equal in length, so "step 3 of 5" read
    // off 60% would be a second guess stacked on the first.
    await setup({ value: 60, stages: STAGES, stageIndex: 0 });
    expect(bar().getAttribute('aria-valuetext')).toBe('Uploading, step 1 of 5, 60%');
  });

  it('clamps an index past the end rather than announcing undefined', async () => {
    const { fixture } = await setup({ value: 10, stages: STAGES, stageIndex: 99 });
    expect(fixture.componentInstance.stageLabel()).toBe('Done');
    expect(fixture.componentInstance.stagePosition()).toBe('5 of 5');
  });

  it('clamps a negative index, and truncates a fractional one', async () => {
    const a = await setup({ value: 10, stages: STAGES, stageIndex: -3 });
    expect(a.fixture.componentInstance.stagePosition()).toBe('1 of 5');

    const b = await setup({ value: 10, stages: STAGES, stageIndex: 2.7 });
    expect(b.fixture.componentInstance.stagePosition()).toBe('3 of 5');
  });

  it('names the bar after its phase when nothing else names it', async () => {
    await setup({ value: 10, stages: STAGES, stageIndex: 1 });
    expect(bar().getAttribute('aria-label')).toBe('Scanning');
  });

  it('lets an explicit label win the accessible name, and the stage win the row', async () => {
    const { fixture } = await setup({
      value: 10, stages: STAGES, stageIndex: 1, label: 'Import',
    });
    expect(bar().getAttribute('aria-label')).toBe('Import');
    expect(fixture.componentInstance.displayText()).toBe('Scanning (2 of 5)');
  });

  it('changes nothing for a bar with no stages', async () => {
    const { fixture } = await setup({ value: 60, label: 'Uploading' });
    expect(fixture.componentInstance.stageLabel()).toBe('');
    expect(fixture.componentInstance.stagePosition()).toBe('');
    expect(fixture.componentInstance.displayText()).toBe('Uploading');
  });
});
