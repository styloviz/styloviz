import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSliderComponent } from './slider.component';

/**
 * Two things this file is about, both of which shipped wrong.
 *
 * 1. `showValue` was documented as controlling the value display and was
 *    honoured only by the single slider. The range slider drew its bubbles
 *    unconditionally, so a host that had already rendered its own formatted
 *    range above the track got the raw numbers printed over it with no way out.
 *
 * 2. There was no way to format the numbers at all. `prefix`/`suffix`
 *    concatenate; they cannot group digits or abbreviate, so a price slider's
 *    scale read `200000 … 4000000`.
 */
async function setup(inputs: ComponentInput<SvSliderComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvSliderComponent, { inputs });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const text = (f: { nativeElement: unknown }) =>
  (el(f).textContent ?? '').replace(/\s+/g, ' ').trim();

const money = (value: number) =>
  value >= 1_000_000 ? `$${value / 1_000_000}M` : `$${Math.round(value / 1000)}k`;

describe('SvSliderComponent — showValue in range mode', () => {
  it('draws the handle bubbles by default', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 20, rangeEnd: 80 });
    expect(text(fixture)).toContain('20');
    expect(text(fixture)).toContain('80');
  });

  it('hides the handle bubbles when showValue is off', async () => {
    const { fixture } = await setup({
      range: true,
      min: 0,
      max: 100,
      rangeStart: 37,
      rangeEnd: 61,
      showValue: false,
    });
    // The scale still shows the bounds; only the current values go.
    expect(text(fixture)).not.toContain('37');
    expect(text(fixture)).not.toContain('61');
  });

  it('still hides the single slider readout when showValue is off', async () => {
    const { fixture } = await setup({ value: 42, showValue: false });
    expect(text(fixture)).not.toContain('42');
  });
});

describe('SvSliderComponent — valueFormat', () => {
  it('formats the handle bubbles', async () => {
    const { fixture } = await setup({
      range: true,
      min: 200_000,
      max: 4_000_000,
      rangeStart: 1_000_000,
      rangeEnd: 3_000_000,
      valueFormat: money,
    });
    expect(text(fixture)).toContain('$1M');
    expect(text(fixture)).toContain('$3M');
    expect(text(fixture)).not.toContain('1000000');
  });

  it('formats the min/max scale under the track', async () => {
    const { fixture } = await setup({
      range: true,
      min: 200_000,
      max: 4_000_000,
      showValue: false,
      valueFormat: money,
    });
    expect(text(fixture)).toContain('$200k');
    expect(text(fixture)).toContain('$4M');
  });

  it('formats the tick labels, so every number on the slider agrees', async () => {
    const { fixture } = await setup({
      value: 50,
      min: 0,
      max: 1_000_000,
      showTicks: true,
      tickCount: 3,
      valueFormat: money,
    });
    expect(text(fixture)).toContain('$1M');
    expect(text(fixture)).not.toContain('1000000');
  });

  it('composes with prefix and suffix rather than replacing them', async () => {
    const { fixture } = await setup({
      value: 1234,
      min: 0,
      max: 2000,
      prefix: '~',
      suffix: ' units',
      valueFormat: (v: number) => v.toLocaleString('en-US'),
    });
    expect(text(fixture)).toContain('~1,234 units');
  });

  it('falls back to the raw number when no formatter is given', async () => {
    const { fixture } = await setup({ value: 1234, min: 0, max: 2000 });
    expect(text(fixture)).toContain('1234');
  });

  it('formats the accessible value text as well as the visible one', async () => {
    // ★ A bubble reading "$1M" beside an `aria-valuetext` of "1000000" is two
    //   different sliders — one for people who can see it and one for people
    //   who cannot.
    const { fixture } = await setup({ value: 1_000_000, min: 0, max: 4_000_000, valueFormat: money });
    const input = el(fixture).querySelector<HTMLInputElement>('input[type="range"]');
    expect(input?.getAttribute('aria-valuetext')).toBe('$1M');
  });
});
