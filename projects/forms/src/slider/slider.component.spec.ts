import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvSliderComponent } from './slider.component';

/**
 * A slider is a native `<input type="range">` wearing a painted track, so most
 * of what can go wrong is arithmetic the browser never sees: the fill width,
 * the tick positions, and — for a range — the rule that the two handles must
 * not pass through each other. None of that is visible in a screenshot, and
 * two of the sums divide by a span the host is free to make zero.
 */

async function setup(inputs: ComponentInput<SvSliderComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvSliderComponent, { inputs });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const ranges = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLInputElement>('input[type="range"]')];
/** Drive a native range input the way the browser would. */
function slide(input: HTMLInputElement, to: number) {
  input.value = String(to);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SvSliderComponent — single', () => {
  it('renders one range input seeded from the value', async () => {
    const { fixture } = await setup({ value: 30, min: 0, max: 100 });
    const [input] = ranges(el(fixture));
    expect(input.value).toBe('30');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
  });

  it('updates the model and announces the formatted value', async () => {
    const { fixture } = await setup({ value: 30, prefix: '$', suffix: '/mo' });
    const [input] = ranges(el(fixture));
    slide(input, 45);
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe(45);
    // aria-valuetext, not just the number: "$45/mo" is what the control means.
    expect(input.getAttribute('aria-valuetext')).toBe('$45/mo');
  });

  it('fills the track in proportion to the value', async () => {
    const { fixture } = await setup({ value: 25, min: 0, max: 100 });
    const fill = el(fixture).querySelector<HTMLElement>('[style*="width"]');
    expect(fill?.style.width).toBe('25%');
  });

  it('clamps the fill rather than overflowing when the value is out of range', async () => {
    const { fixture } = await setup({ value: 500, min: 0, max: 100 });
    const fill = el(fixture).querySelector<HTMLElement>('[style*="width"]');
    expect(fill?.style.width).toBe('100%');
  });

  // ── Degenerate spans: the host controls min/max, so it can make them equal ──

  it('survives a zero-width range instead of writing "NaN%" into the style', async () => {
    // (v - min) / (max - min) divides by zero here. A CSS width of "NaN%" is
    // not a width: the browser drops the declaration and the fill disappears.
    const { fixture } = await setup({ value: 5, min: 5, max: 5 });
    expect(fixture.componentInstance.fillPercent()).toBe('0%');
    expect(el(fixture).innerHTML).not.toContain('NaN');
  });

  it('produces a real tick when asked for exactly one', async () => {
    // `min + (i / (count - 1)) * span` is 0/0 when count is 1.
    const { fixture } = await setup({ showTicks: true, tickCount: 1, min: 0, max: 10 });
    expect(fixture.componentInstance.ticks()).toEqual([0]);
    expect((el(fixture).textContent ?? '')).not.toContain('NaN');
  });

  it('spreads ticks evenly across the span', async () => {
    const { fixture } = await setup({ showTicks: true, tickCount: 5, min: 0, max: 100 });
    expect(fixture.componentInstance.ticks()).toEqual([0, 25, 50, 75, 100]);
  });

  it('asks for no ticks and gets none', async () => {
    const { fixture } = await setup({ showTicks: true, tickCount: 0, min: 0, max: 10 });
    expect(fixture.componentInstance.ticks()).toEqual([]);
  });

  // ── Disabled ───────────────────────────────────────────────────────────────

  it('disables the native input', async () => {
    const { fixture } = await setup({ disabled: true });
    expect(ranges(el(fixture))[0].disabled).toBe(true);
  });

  it('merges a disabled form control with the disabled input', async () => {
    const { fixture } = await setup({ disabled: false });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(ranges(el(fixture))[0].disabled).toBe(true);
  });

  // ── ControlValueAccessor ───────────────────────────────────────────────────

  it('writes a value in from a form control, ignoring nonsense', async () => {
    const { fixture } = await setup({ value: 10 });
    const c = fixture.componentInstance;
    c.writeValue(42);
    expect(c.value()).toBe(42);
    c.writeValue(null as unknown as number);
    expect(c.value()).toBe(42); // unchanged, not NaN
    c.writeValue(Number.NaN);
    expect(c.value()).toBe(42);
  });

  it('reports changes and the first touch to the form', async () => {
    const { fixture } = await setup({ value: 10 });
    const seen: number[] = [];
    let touched = false;
    fixture.componentInstance.registerOnChange((v: number) => seen.push(v));
    fixture.componentInstance.registerOnTouched(() => { touched = true; });

    slide(ranges(el(fixture))[0], 60);
    expect(seen).toEqual([60]);
    expect(touched).toBe(true);
  });
});

describe('SvSliderComponent — range', () => {
  it('renders two handles, named apart', async () => {
    const { fixture } = await setup({ range: true, label: 'Price', rangeStart: 20, rangeEnd: 80 });
    const [start, end] = ranges(el(fixture));
    expect(start.getAttribute('aria-label')).toBe('Price minimum');
    expect(end.getAttribute('aria-label')).toBe('Price maximum');
  });

  it('falls back to generic handle names when there is no label', async () => {
    const { fixture } = await setup({ range: true });
    const [start, end] = ranges(el(fixture));
    expect(start.getAttribute('aria-label')).toBe('Range minimum');
    expect(end.getAttribute('aria-label')).toBe('Range maximum');
  });

  it('bounds each handle by the other, so the two can never cross', async () => {
    const { fixture } = await setup({ range: true, rangeStart: 20, rangeEnd: 80, step: 1 });
    const [start, end] = ranges(el(fixture));

    slide(start, 95); // past the end handle
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeStart()).toBe(79); // end - step

    slide(end, 10); // past the start handle
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeEnd()).toBe(80); // start + step
  });

  it('reports the whole range on every handle move', async () => {
    const seen: [number, number][] = [];
    const { fixture } = await setup({ range: true, rangeStart: 20, rangeEnd: 80 });
    fixture.componentInstance.rangeChange.subscribe((r) => seen.push(r));
    const [start, end] = ranges(el(fixture));

    slide(start, 30);
    slide(end, 70);
    expect(seen).toEqual([[30, 80], [30, 70]]);
  });

  it('narrows each handle\'s announced bounds to the other handle', async () => {
    // A screen reader should say the start handle tops out at the end handle,
    // not at the slider's max — that is the constraint the user actually has.
    const { fixture } = await setup({ range: true, rangeStart: 20, rangeEnd: 80, min: 0, max: 100 });
    const [start, end] = ranges(el(fixture));
    expect(start.getAttribute('aria-valuemax')).toBe('80');
    expect(end.getAttribute('aria-valuemin')).toBe('20');
  });
});

describe('SvSliderComponent — the error slot', () => {
  it('renders a client-side message', async () => {
    await setup({ errorMessage: 'Pick a budget.' });
    expect(screen.getByRole('alert').textContent).toContain('Pick a budget.');
  });

  it('marks the control invalid and points at the message', async () => {
    // Regression guard: four sibling controls shipped an error slot that
    // rendered its message and was referenced by nothing, so the field
    // announced as valid while showing a rejection.
    const { fixture } = await setup({ errorMessage: 'Pick a budget.' });
    const input = ranges(el(fixture))[0];
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const errorId = screen.getByRole('alert').getAttribute('id') ?? '';
    expect(errorId).not.toBe('');
    expect((input.getAttribute('aria-describedby') ?? '').split(' ')).toContain(errorId);
  });

  it('leaves aria-invalid off when there is nothing wrong', async () => {
    const { fixture } = await setup({ value: 10 });
    expect(ranges(el(fixture))[0].hasAttribute('aria-invalid')).toBe(false);
  });

  it('expires a server rejection once the value changes', async () => {
    const { fixture } = await setup({ value: 10, serverError: 'That budget is unavailable.' });
    expect(screen.getByRole('alert').textContent).toContain('That budget is unavailable.');

    slide(ranges(el(fixture))[0], 20);
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
