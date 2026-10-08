import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvOtpInputComponent } from './otp-input.component';

/**
 * The paths a code field only meets in the wild: a code pasted from an SMS that
 * is longer than the field, a masked field where the browser must not echo the
 * digit back, arrow keys at the two ends, and the status colouring that tells
 * the user their code was rejected.
 *
 * Paste arrives two ways and they are different code paths — a real `paste`
 * event (with a clipboard payload) and an `input` event carrying more than one
 * character, which is what a mobile keyboard's autofill produces. Both are here.
 */

async function setup(inputs: ComponentInput<SvOtpInputComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvOtpInputComponent, { inputs });
}

const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const code = () => cells().map((c) => c.value).join('');

/** Fire a real `paste` with a clipboard payload — jsdom builds no DataTransfer. */
function paste(target: HTMLElement, text: string) {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent & {
    clipboardData: unknown;
  };
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } });
  target.dispatchEvent(e);
}

/** Fire a `paste` that carries no clipboard at all (some Linux/Firefox paths). */
function pasteWithoutClipboard(target: HTMLElement) {
  target.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }));
}

/** Type straight into a cell the way a mobile autofill does — one input event. */
function typeInto(cell: HTMLInputElement, raw: string) {
  cell.value = raw;
  cell.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SvOtpInputComponent — pasting', () => {
  it('takes only as many digits as there are cells', async () => {
    // ★ The cells alone cannot catch this: an implementation that keeps all ten
    // digits still *renders* four, because there are only four inputs. The
    // model is where the overflow shows, and the model is what `complete` and
    // the form control read.
    const { fixture } = await setup({ length: 4 });
    paste(cells()[0], '1234567890');
    fixture.detectChanges();
    expect(code()).toBe('1234');
    expect(fixture.componentInstance.value()).toBe('1234');
  });

  it('strips the separators an SMS code arrives with', async () => {
    const { fixture } = await setup({ length: 6 });
    paste(cells()[0], '12-34 56');
    fixture.detectChanges();
    expect(code()).toBe('123456');
  });

  it('replaces the whole field rather than appending to it', async () => {
    // A paste always starts from cell 0, so a stale trailing digit from an
    // earlier attempt must not survive underneath the new code.
    const { fixture } = await setup({ length: 6, value: '999999' });
    paste(cells()[0], '123');
    fixture.detectChanges();
    expect(code()).toBe('123');
  });

  it('survives a paste event that carries no clipboard data', async () => {
    const { fixture } = await setup({ length: 4, value: '1234' });
    expect(() => pasteWithoutClipboard(cells()[0])).not.toThrow();
    fixture.detectChanges();
    // Nothing to paste means the field is cleared, not left half-written.
    expect(code()).toBe('');
  });

  it('fires complete once for a paste that fills the field', async () => {
    const { fixture } = await setup({ length: 4 });
    const completions: string[] = [];
    fixture.componentInstance.complete.subscribe((v) => completions.push(v));
    paste(cells()[0], '1234');
    fixture.detectChanges();
    expect(completions).toEqual(['1234']);
  });

  it('does not fire complete for a paste that leaves a gap', async () => {
    const { fixture } = await setup({ length: 6 });
    const completions: string[] = [];
    fixture.componentInstance.complete.subscribe((v) => completions.push(v));
    paste(cells()[0], '123');
    fixture.detectChanges();
    expect(completions).toEqual([]);
  });

  it('moves focus to the last filled cell, not past the end', async () => {
    const { fixture } = await setup({ length: 4 });
    paste(cells()[0], '123456');
    fixture.detectChanges();
    expect(document.activeElement).toBe(cells()[3]);
  });
});

describe('SvOtpInputComponent — multi-character input (autofill)', () => {
  it('spreads a multi-digit input event across the following cells', async () => {
    const { fixture } = await setup({ length: 6 });
    typeInto(cells()[2], '456');
    fixture.detectChanges();
    // Position matters, so assert cell by cell rather than on the joined code.
    expect(cells().map((c) => c.value)).toEqual(['', '', '4', '5', '6', '']);
    expect(fixture.componentInstance.value()).toBe('456');
  });

  it('drops the overflow when the autofill starts part-way along', async () => {
    // Starting at cell 4 of 6 there is room for two digits; the rest must be
    // discarded rather than wrapping round to cell 0.
    const { fixture } = await setup({ length: 6 });
    typeInto(cells()[4], '123456');
    fixture.detectChanges();
    expect(cells().map((c) => c.value)).toEqual(['', '', '', '', '1', '2']);
  });

  it('clears the cell and does nothing else when the input is not a digit', async () => {
    const { fixture } = await setup({ length: 4, value: '1234' });
    typeInto(cells()[1], 'x');
    fixture.detectChanges();
    // Assert the negative: the model must be untouched.
    expect(fixture.componentInstance.value()).toBe('1234');
    expect(cells()[1].value).toBe('');
  });
});

describe('SvOtpInputComponent — masked', () => {
  it('renders password cells rather than text ones', async () => {
    const { fixture } = await setup({ length: 4, mask: true });
    const host = fixture.nativeElement as HTMLElement;
    const inputs = [...host.querySelectorAll<HTMLInputElement>('input')];
    expect(inputs.map((i) => i.type)).toEqual(['password', 'password', 'password', 'password']);
    expect(fixture.componentInstance.inputType()).toBe('password');
  });

  it('keeps the digit in the model while never putting it in the DOM', async () => {
    // The component re-writes `el.value` after each input. Masked, it must not
    // write the digit back — the template renders a bullet instead, so the code
    // is never readable in the DOM even though the field is typed `password`.
    const { fixture } = await setup({ length: 4, mask: true });
    const host = fixture.nativeElement as HTMLElement;
    const first = host.querySelector('input') as HTMLInputElement;
    typeInto(first, '7');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('7');
    expect(first.value).not.toContain('7');
    expect(first.value).toBe('•');
  });

  it('uses text inputs when not masked', async () => {
    const { fixture } = await setup({ length: 4 });
    expect(fixture.componentInstance.inputType()).toBe('text');
  });
});

describe('SvOtpInputComponent — arrow keys at the ends', () => {
  it('moves left and right between cells', async () => {
    const { fixture } = await setup({ length: 4, value: '1234' });
    cells()[2].focus();
    await userEvent.keyboard('{ArrowLeft}');
    fixture.detectChanges();
    expect(document.activeElement).toBe(cells()[1]);

    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();
    expect(document.activeElement).toBe(cells()[2]);
  });

  it('stays put at the first cell on ArrowLeft', async () => {
    const { fixture } = await setup({ length: 4, value: '1234' });
    cells()[0].focus();
    await userEvent.keyboard('{ArrowLeft}');
    fixture.detectChanges();
    expect(document.activeElement).toBe(cells()[0]);
  });

  it('stays put at the last cell on ArrowRight', async () => {
    const { fixture } = await setup({ length: 4, value: '1234' });
    cells()[3].focus();
    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();
    expect(document.activeElement).toBe(cells()[3]);
  });
});

describe('SvOtpInputComponent — status', () => {
  it('announces that it is verifying, in place of the hint', async () => {
    const loading = await setup({ length: 4, status: 'loading', hint: 'Check your texts' });
    expect(loading.fixture.componentInstance.statusMessage()).toBe('Verifying…');

    const idle = await setup({ length: 4, hint: 'Check your texts' });
    expect(idle.fixture.componentInstance.statusMessage()).toBe('Check your texts');
  });

  it('colours an error cell three ways: focused, filled and empty', async () => {
    const { fixture } = await setup({ length: 4, value: '12', status: 'error' });
    const c = fixture.componentInstance;
    c.onFocus(0);
    expect(c.cellColorClass(0)).toContain('ring-danger-300/40'); // focused
    c.onBlur();
    expect(c.cellColorClass(0)).toBe('border-danger-400'); // filled, not focused
    expect(c.cellColorClass(3)).toContain('border-danger-300'); // empty
  });

  it('colours every cell as success regardless of focus or content', async () => {
    const { fixture } = await setup({ length: 4, value: '12', status: 'success' });
    const c = fixture.componentInstance;
    expect(c.cellColorClass(0)).toContain('border-accent-500');
    expect(c.cellColorClass(3)).toContain('border-accent-500');
  });

  it('falls back to neutral colouring with no status', async () => {
    const { fixture } = await setup({ length: 4, value: '12' });
    const c = fixture.componentInstance;
    c.onFocus(2);
    expect(c.cellColorClass(2)).toContain('border-primary-500');
    c.onBlur();
    expect(c.cellColorClass(0)).toContain('border-gray-400'); // has a digit
    expect(c.cellColorClass(3)).toContain('border-gray-200'); // empty
  });
});

describe('SvOtpInputComponent — sizes and variants', () => {
  it('gives each size its own cell box', async () => {
    const seen = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ length: 4, size });
      seen.add(fixture.componentInstance.cellBase());
    }
    expect(seen.size).toBe(3);
  });

  it('gives each variant its own frame', async () => {
    const seen = new Set<string>();
    for (const variant of ['default', 'filled', 'underline', 'ghost'] as const) {
      const { fixture } = await setup({ length: 4, variant });
      seen.add(fixture.componentInstance.cellVariant());
    }
    expect(seen.size).toBe(4);
  });
});

describe('SvOtpInputComponent — form integration', () => {
  it('treats a null write as an empty code rather than throwing', async () => {
    const { fixture } = await setup({ length: 4, value: '1234' });
    fixture.componentInstance.writeValue(null as unknown as string);
    fixture.detectChanges();
    expect(code()).toBe('');
  });

  it('takes focus on render when asked to', async () => {
    const { fixture } = await setup({ length: 4, autoFocus: true });
    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('input'),
    );
  });

  it('does not take focus by default', async () => {
    const { fixture } = await setup({ length: 4 });
    expect(document.activeElement).not.toBe(
      (fixture.nativeElement as HTMLElement).querySelector('input'),
    );
  });
});
