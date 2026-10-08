import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvSegmentedControlComponent } from './segmented-control.component';
import type { SegmentOption } from './segmented-control.component';

/**
 * A segmented control is a radiogroup wearing buttons, so what it owes is the
 * WAI-ARIA radiogroup contract: exactly one segment in the tab order, arrows
 * that move *and* select, wrapping at both ends, and disabled segments skipped
 * rather than merely unclickable. A mouse user never exercises any of it.
 */

const OPTIONS: SegmentOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

async function setup(inputs: Partial<ComponentInput<SvSegmentedControlComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSegmentedControlComponent, {
    inputs: { options: OPTIONS, ...inputs } as ComponentInput<SvSegmentedControlComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const segs = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('[data-seg]')];
const seg = (host: HTMLElement, v: string) =>
  host.querySelector<HTMLElement>(`[data-seg="${v}"]`)!;

describe('SvSegmentedControlComponent — structure', () => {
  it('is a radiogroup of radios', async () => {
    const { fixture } = await setup({ value: 'week', ariaLabel: 'Range' });
    const group = el(fixture).querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Range');
    expect(segs(el(fixture)).every((s) => s.getAttribute('role') === 'radio')).toBe(true);
  });

  it('marks exactly one segment checked', async () => {
    const { fixture } = await setup({ value: 'week' });
    const checked = segs(el(fixture)).filter((s) => s.getAttribute('aria-checked') === 'true');
    expect(checked.map((s) => s.getAttribute('data-seg'))).toEqual(['week']);
  });

  // ── Roving tabindex ────────────────────────────────────────────────────────

  it('puts exactly one segment in the tab order', async () => {
    const { fixture } = await setup({ value: 'month' });
    const tabbable = segs(el(fixture)).filter((s) => s.getAttribute('tabindex') === '0');
    expect(tabbable.map((s) => s.getAttribute('data-seg'))).toEqual(['month']);
  });

  it('falls back to the first enabled segment when nothing is selected', async () => {
    const { fixture } = await setup({
      value: '',
      options: [{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }],
    });
    expect(fixture.componentInstance.focusableValue()).toBe('b');
  });

  it('keeps a disabled segment out of the tab order entirely', async () => {
    const { fixture } = await setup({
      value: 'a',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }],
    });
    expect(seg(el(fixture), 'b').getAttribute('tabindex')).toBe('-1');
  });
});

describe('SvSegmentedControlComponent — selection', () => {
  it('selects on click and reports once', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ value: 'day' });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));

    await userEvent.click(seg(el(fixture), 'week'));
    expect(fixture.componentInstance.value()).toBe('week');
    expect(seen).toEqual(['week']);
  });

  // One mount per test. Mounting twice inside one `it` resets the TestBed,
  // which destroys the first ApplicationRef while its DOM is still attached —
  // and `userEvent` dispatches through the document, so the click lands on the
  // dead one and every run prints "NG0406: ApplicationRef has already been
  // destroyed" from a test that passed.
  for (const flag of ['disabled', 'soldOut'] as const) {
    it(`will not select a ${flag} segment`, async () => {
      const { fixture } = await setup({
        value: 'a',
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', [flag]: true }],
      });
      await userEvent.click(seg(el(fixture), 'b'));
      expect(fixture.componentInstance.value()).toBe('a');
    });
  }

  it('ignores the whole control when disabled', async () => {
    const { fixture } = await setup({ value: 'day', disabled: true });
    await userEvent.click(seg(el(fixture), 'week'));
    expect(fixture.componentInstance.value()).toBe('day');
  });

  it('merges a disabled form control with the disabled input', async () => {
    const { fixture } = await setup({ value: 'day' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    fixture.componentInstance.select(OPTIONS[1]);
    expect(fixture.componentInstance.value()).toBe('day');
  });
});

describe('SvSegmentedControlComponent — keyboard', () => {
  const press = (host: HTMLElement, from: string, key: string) =>
    seg(host, from).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  it('moves and selects with the arrows, in both orientations', async () => {
    const { fixture } = await setup({ value: 'day' });
    const host = el(fixture);

    press(host, 'day', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('week');

    press(host, 'week', 'ArrowDown');
    expect(fixture.componentInstance.value()).toBe('month');

    press(host, 'month', 'ArrowLeft');
    expect(fixture.componentInstance.value()).toBe('week');
  });

  it('wraps at both ends rather than stopping', async () => {
    const { fixture } = await setup({ value: 'month' });
    const host = el(fixture);

    press(host, 'month', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('day');

    press(host, 'day', 'ArrowLeft');
    expect(fixture.componentInstance.value()).toBe('month');
  });

  it('jumps to the ends with Home and End', async () => {
    const { fixture } = await setup({ value: 'week' });
    const host = el(fixture);

    press(host, 'week', 'End');
    expect(fixture.componentInstance.value()).toBe('month');

    press(host, 'month', 'Home');
    expect(fixture.componentInstance.value()).toBe('day');
  });

  it('skips disabled segments when navigating, rather than landing on them', async () => {
    const { fixture } = await setup({
      value: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
      ],
    });
    press(el(fixture), 'a', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('c');
  });

  it('selects with Space and Enter', async () => {
    for (const key of [' ', 'Enter']) {
      const { fixture } = await setup({ value: 'day' });
      press(el(fixture), 'week', key);
      expect(fixture.componentInstance.value()).toBe('week');
    }
  });

  it('leaves unrelated keys alone', async () => {
    const { fixture } = await setup({ value: 'day' });
    press(el(fixture), 'day', 'a');
    expect(fixture.componentInstance.value()).toBe('day');
  });

  it('does nothing when every segment is disabled', async () => {
    const { fixture } = await setup({
      value: '',
      options: [{ value: 'a', label: 'A', disabled: true }],
    });
    press(el(fixture), 'a', 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('');
  });
});

describe('SvSegmentedControlComponent — the error slot', () => {
  it('renders a client-side message', async () => {
    await setup({ value: 'day', errorMessage: 'Pick a range.' });
    expect(screen.getByRole('alert').textContent).toContain('Pick a range.');
  });

  it('marks the group invalid and points at the message', async () => {
    // Regression guard: this control once carried the bindings on the swatch
    // variant only, so the default variant announced as valid while showing a
    // rejection.
    const { fixture } = await setup({ value: 'day', errorMessage: 'Pick a range.' });
    const group = el(fixture).querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-invalid')).toBe('true');

    const errorId = screen.getByRole('alert').getAttribute('id') ?? '';
    expect(errorId).not.toBe('');
    expect(group.getAttribute('aria-describedby')).toBe(errorId);
  });

  it('expires a server rejection once the selection changes', async () => {
    const { fixture } = await setup({ value: 'day', serverError: 'Day is unavailable.' });
    expect(screen.getByRole('alert').textContent).toContain('Day is unavailable.');

    await userEvent.click(seg(el(fixture), 'week'));
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
