import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvNumberInputComponent } from './number-input.component';

/**
 * A number input is a spinner over a text field, so the interesting behaviour
 * is all boundary arithmetic: what a step does at the limit, what rounding does
 * to a fractional step, and what happens when the field is handed something
 * that is not a number. None of it is visible in a rendered demo.
 */

async function setup(inputs: ComponentInput<SvNumberInputComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvNumberInputComponent, { inputs });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const field = (host: HTMLElement) => host.querySelector('input') as HTMLInputElement;
const type = (input: HTMLInputElement, raw: string) => {
  input.value = raw;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const blur = (input: HTMLInputElement) => input.dispatchEvent(new Event('blur', { bubbles: true }));

describe('SvNumberInputComponent — stepping', () => {
  it('steps up and down by the step amount', async () => {
    const { fixture } = await setup({ value: 5, step: 3 });
    const c = fixture.componentInstance;
    c.increment();
    expect(c.value()).toBe(8);
    c.decrement();
    expect(c.value()).toBe(5);
  });

  it('stops at the bounds instead of stepping past them', async () => {
    const { fixture } = await setup({ value: 9, min: 0, max: 10, step: 5 });
    const c = fixture.componentInstance;
    c.increment();
    expect(c.value()).toBe(10); // clamped, not 14
    c.decrement();
    expect(c.value()).toBe(5);
    c.decrement();
    expect(c.value()).toBe(0); // clamped, not -5
  });

  it('rounds a fractional step to the configured precision', async () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point; a price field
    // that shows that has lost the user's trust in one keystroke.
    const { fixture } = await setup({ value: 0.1, step: 0.2, decimals: 2 });
    fixture.componentInstance.increment();
    expect(fixture.componentInstance.value()).toBe(0.3);
  });

  it('refuses to step when there is nowhere to go', async () => {
    const atMax = await setup({ value: 10, min: 0, max: 10 });
    expect(atMax.fixture.componentInstance.canIncrement()).toBe(false);
    expect(atMax.fixture.componentInstance.canDecrement()).toBe(true);

    const atMin = await setup({ value: 0, min: 0, max: 10 });
    expect(atMin.fixture.componentInstance.canDecrement()).toBe(false);
  });

  it('refuses to step when disabled or read-only', async () => {
    for (const mode of ['disabled', 'readonly'] as const) {
      const { fixture } = await setup({ value: 5, min: 0, max: 10, [mode]: true });
      const c = fixture.componentInstance;
      expect(c.canIncrement()).toBe(false);
      expect(c.canDecrement()).toBe(false);
      c.increment();
      c.decrement();
      expect(c.value()).toBe(5);
    }
  });

  it('merges a disabled form control with the disabled input', async () => {
    const { fixture } = await setup({ value: 5, min: 0, max: 10 });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.canIncrement()).toBe(false);
  });

  it('is unbounded by default, so a plain counter steps freely', async () => {
    const { fixture } = await setup({ value: -1000 });
    expect(fixture.componentInstance.canDecrement()).toBe(true);
    expect(fixture.componentInstance.canIncrement()).toBe(true);
  });
});

describe('SvNumberInputComponent — typing', () => {
  it('holds what the user typed while they are typing it, then settles on blur', async () => {
    // ★★★ THE OLD ASSERTION HERE WAS THE BUG (`FI-15-I1`). It demanded that `99`
    //     become `10` the instant it was typed — which is what made `50` into a
    //     min-10 field come out as `100`, and what put `3.1` on screen before
    //     the user had finished typing `3.14159`.
    const { fixture } = await setup({ value: 0, min: 0, max: 10, decimals: 1 });
    const input = field(el(fixture));
    const c = fixture.componentInstance;

    type(input, '99');
    expect(c.value()).toBe(99);        // exactly what was typed
    expect(c.outOfRange()).toBe(true); // and the control says so
    blur(input);
    expect(c.value()).toBe(10);
    expect(c.outOfRange()).toBe(false);

    type(input, '-5');
    expect(c.value()).toBe(-5);
    blur(input);
    expect(c.value()).toBe(0);

    type(input, '3.14159');
    expect(c.value()).toBe(3.14159);   // the rounding waits too
    blur(input);
    expect(c.value()).toBe(3.1);
  });

  it('does not rewrite the box between keystrokes — the defect, reproduced', async () => {
    // Select-all and type `50` into a field that starts at 10. Clamping on input
    // turned the `5` into `10`, left "10" in the box, and the `0` made it `100`.
    const { fixture } = await setup({ value: 10, min: 10, max: 100 });
    const input = field(el(fixture));
    const c = fixture.componentInstance;

    type(input, '5');
    fixture.detectChanges();
    expect(input.value).toBe('5');     // ← was "10"
    type(input, '50');
    fixture.detectChanges();
    expect(c.value()).toBe(50);        // ← was 100
    blur(input);
    expect(c.value()).toBe(50);
  });

  it('still clamps every keystroke when the host asks for it', async () => {
    const { fixture } = await setup({ value: 0, min: 0, max: 10, decimals: 1, clampOn: 'input' });
    const input = field(el(fixture));

    type(input, '99');
    expect(fixture.componentInstance.value()).toBe(10);
    expect(fixture.componentInstance.outOfRange()).toBe(false);
  });

  it('discards a draft that is not a number instead of committing it', async () => {
    // Leaving the field on `-` or an empty box means characters were removed,
    // not that a new number was stated.
    const { fixture } = await setup({ value: 7, min: 0, max: 100 });
    const input = field(el(fixture));

    type(input, '-');
    blur(input);
    expect(fixture.componentInstance.value()).toBe(7);

    type(input, '');
    blur(input);
    expect(fixture.componentInstance.value()).toBe(7);
  });

  it('shows the settled number again after blur, not the raw draft', async () => {
    const { fixture } = await setup({ value: 0, max: 10, decimals: 2 });
    const input = field(el(fixture));

    type(input, '3.14159');
    fixture.detectChanges();
    expect(input.value).toBe('3.14159');
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('3.14');
  });

  it('lets the stepper override an unsettled draft', async () => {
    const { fixture } = await setup({ value: 5, step: 1, max: 100 });
    const input = field(el(fixture));
    type(input, '42');
    fixture.componentInstance.increment();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(43);
    expect(input.value).toBe('43');   // the draft did not survive the button
  });

  it('marks the control touched on blur, not on the first character', async () => {
    // `touched` decides when a form may start showing errors at somebody. A
    // control touched from keystroke one cannot answer that question.
    const { fixture } = await setup({ value: 0 });
    const c = fixture.componentInstance;
    let touched = false;
    c.registerOnTouched(() => { touched = true; });

    type(field(el(fixture)), '4');
    expect(touched).toBe(false);
    blur(field(el(fixture)));
    expect(touched).toBe(true);
  });

  it('keeps the last good value when the field is cleared', async () => {
    // Emitting 0 (or NaN) for an empty box would rewrite the model while the
    // user is mid-edit — backspacing to retype should not commit anything.
    const { fixture } = await setup({ value: 7 });
    type(field(el(fixture)), '');
    expect(fixture.componentInstance.value()).toBe(7);
  });

  it('ignores text that is not a number at all', async () => {
    const { fixture } = await setup({ value: 7 });
    type(field(el(fixture)), 'abc');
    expect(fixture.componentInstance.value()).toBe(7);
  });

  it('steps with the up and down arrows', async () => {
    const { fixture } = await setup({ value: 5, step: 1, min: 0, max: 10 });
    const input = field(el(fixture));
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(fixture.componentInstance.value()).toBe(6);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(fixture.componentInstance.value()).toBe(4);
  });

  it('reports every accepted change once, to the output and the form', async () => {
    const seen: number[] = [];
    const viaForm: number[] = [];
    const { fixture } = await setup({ value: 5 });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));
    fixture.componentInstance.registerOnChange((v: number) => viaForm.push(v));

    fixture.componentInstance.increment();
    type(field(el(fixture)), '2');
    expect(seen).toEqual([6, 2]);
    expect(viaForm).toEqual([6, 2]);
  });
});

describe('SvNumberInputComponent — display', () => {
  it('shows the value at the configured precision', async () => {
    const { fixture } = await setup({ value: 3, decimals: 2 });
    expect(fixture.componentInstance.displayValue()).toBe('3.00');
  });

  it('announces prefix and suffix, which the raw number does not carry', async () => {
    const { fixture } = await setup({ value: 12, prefix: '$', suffix: ' each' });
    expect(fixture.componentInstance.valueText()).toBe('$12 each');
  });

  it('adds no value text when there is nothing to add', async () => {
    // An aria-valuetext identical to the number is noise, not help.
    const { fixture } = await setup({ value: 12 });
    expect(fixture.componentInstance.valueText()).toBe('');
  });
});

describe('SvNumberInputComponent — the error slot', () => {
  it('shows a client-side message and marks the field invalid', async () => {
    const { fixture } = await setup({ value: 1, errorMessage: 'Too few.' });
    const input = field(el(fixture));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Too few.');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).not.toBe('');
    expect(screen.getByRole('alert').getAttribute('id')).toBe(describedBy);
  });

  it('lets a server rejection outrank the client message', async () => {
    await setup({
      value: 4,
      errorMessage: 'Too few.',
      serverError: 'Only 3 left in stock.',
    });
    expect(screen.getByRole('alert').textContent).toContain('Only 3 left in stock.');
  });

  it('expires the server rejection on the next change, then falls back', async () => {
    const { fixture } = await setup({
      value: 4,
      errorMessage: 'Too few.',
      serverError: 'Only 3 left in stock.',
    });
    expect(fixture.componentInstance.resolvedError()).toBe('Only 3 left in stock.');

    fixture.componentInstance.increment();
    fixture.detectChanges();

    // The rejection was about 4, which is not what is in the field now.
    expect(fixture.componentInstance.resolvedError()).toBe('Too few.');
  });

  it('leaves aria-invalid off when there is nothing wrong', async () => {
    const { fixture } = await setup({ value: 1 });
    expect(field(el(fixture)).hasAttribute('aria-invalid')).toBe(false);
  });
});

/**
 * A composed control — a cart row that prints "Only 3 left" beside the product
 * title rather than under the stepper — renders the explanation itself. Without
 * a way to point at it, the field is a number with no stated reason it will not
 * go higher.
 */
describe('SvNumberInputComponent — a description the parent owns', () => {
  it('describes the field with the id the parent supplies', async () => {
    const { fixture } = await setup({ value: 5, ariaDescribedby: 'stock-note' });
    expect(field(el(fixture)).getAttribute('aria-describedby')).toBe('stock-note');
  });

  it('keeps its own hint alongside the parent id rather than replacing it', async () => {
    const { fixture } = await setup({ value: 5, hint: 'Whole units', ariaDescribedby: 'stock-note' });
    const described = field(el(fixture)).getAttribute('aria-describedby') ?? '';
    expect(described.split(' ')).toHaveLength(2);
    expect(described).toContain('stock-note');
  });

  it('marks the value invalid when the parent says so and shows no message of its own', async () => {
    const { fixture } = await setup({ value: 5, invalid: true, ariaDescribedby: 'stock-note' });
    expect(field(el(fixture)).getAttribute('aria-invalid')).toBe('true');
    expect(fixture.componentInstance.resolvedError()).toBe('');
  });

  it('makes the border agree with aria-invalid, so the two do not contradict', async () => {
    const { fixture } = await setup({ value: 5, invalid: true });
    expect(fixture.componentInstance.groupClass()).toContain('border-danger-400');
  });

  it('ignores a blank parent id instead of emitting an empty attribute', async () => {
    const { fixture } = await setup({ value: 5, ariaDescribedby: '  ' });
    expect(field(el(fixture)).hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('SvNumberInputComponent — what the +/- buttons say they change', () => {
  it('names them after the visible label', async () => {
    const { fixture } = await setup({ value: 1, label: 'Servings' });
    const buttons = el(fixture).querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-label')).toBe('Decrease Servings');
    expect(buttons[1].getAttribute('aria-label')).toBe('Increase Servings');
  });

  it('falls back to the aria-label when the field has no visible one', async () => {
    // A composed control names the field that way, and two rows of "Increase
    // value" are indistinguishable from each other.
    const { fixture } = await setup({ value: 1, ariaLabel: 'Quantity, Aurora Runner' });
    const buttons = el(fixture).querySelectorAll('button');
    expect(buttons[1].getAttribute('aria-label')).toBe('Increase Quantity, Aurora Runner');
  });

  it('still says "value" when the field is unnamed', async () => {
    const { fixture } = await setup({ value: 1 });
    expect(el(fixture).querySelectorAll('button')[1].getAttribute('aria-label'))
      .toBe('Increase value');
  });
});
