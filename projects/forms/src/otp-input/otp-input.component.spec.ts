import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvOtpInputComponent } from './otp-input.component';

/**
 * A one-time-code field is almost entirely keyboard and paste behaviour, and
 * almost none of it is visible in a rendered demo: what backspace does in an
 * empty cell, what a 6-digit paste into cell 3 does, whether `complete` fires
 * once or on every keystroke. That is what these cover — plus the error slot,
 * which was rendering a message that no cell was marked invalid against.
 */

async function setup(inputs: ComponentInput<SvOtpInputComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvOtpInputComponent, { inputs });
}

const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];
const code = () => cells().map((c) => c.value).join('');

describe('SvOtpInputComponent', () => {
  it('renders one cell per digit', async () => {
    await setup({ length: 4 });
    expect(cells().length).toBe(4);
  });

  it('names every cell by position, so "digit 4 of 6" is what gets announced', async () => {
    await setup({ length: 6 });
    expect(screen.getByLabelText('Digit 4 of 6')).toBeTruthy();
  });

  it('seeds the cells from a bound value', async () => {
    await setup({ length: 6, value: '123456' });
    expect(code()).toBe('123456');
  });

  it('ignores non-digits and overflow in a bound value', async () => {
    await setup({ length: 4, value: '1a2b3c4d5e' });
    expect(code()).toBe('1234');
  });

  // ── Typing ─────────────────────────────────────────────────────────────────

  it('advances to the next cell as digits are typed', async () => {
    await setup({ length: 4 });
    const [first] = cells();
    first.focus();
    await userEvent.keyboard('12');
    expect(document.activeElement).toBe(cells()[2]);
    expect(code()).toBe('12');
  });

  it('emits the partial code on every change, and the full code once', async () => {
    const changed: string[] = [];
    const complete: string[] = [];
    const { fixture } = await setup({ length: 4 });
    fixture.componentInstance.changed.subscribe((v) => changed.push(v));
    fixture.componentInstance.complete.subscribe((v) => complete.push(v));

    cells()[0].focus();
    await userEvent.keyboard('1234');

    expect(changed).toEqual(['1', '12', '123', '1234']);
    // `complete` is the one a host wires to "submit" — firing it early, or
    // twice, is a double submission.
    expect(complete).toEqual(['1234']);
  });

  // ── Backspace: the behaviour nobody sees until they use it ─────────────────

  it('backspace clears the current cell without moving', async () => {
    await setup({ length: 4, value: '12' });
    const c = cells();
    c[1].focus();
    await userEvent.keyboard('{Backspace}');
    expect(code()).toBe('1');
    expect(document.activeElement).toBe(c[1]);
  });

  it('backspace in an EMPTY cell clears the one before it and steps back', async () => {
    await setup({ length: 4, value: '12' });
    const c = cells();
    c[2].focus(); // empty
    await userEvent.keyboard('{Backspace}');
    expect(code()).toBe('1');
    expect(document.activeElement).toBe(c[1]);
  });

  it('backspace at the start of an empty field does nothing', async () => {
    await setup({ length: 4 });
    cells()[0].focus();
    await userEvent.keyboard('{Backspace}');
    expect(code()).toBe('');
  });

  it('delete clears in place', async () => {
    await setup({ length: 4, value: '1234' });
    cells()[1].focus();
    await userEvent.keyboard('{Delete}');
    expect(code()).toBe('1' + '' + '34');
  });

  // ── Arrows ─────────────────────────────────────────────────────────────────

  it('arrows move between cells and stop at both ends', async () => {
    await setup({ length: 4 });
    const c = cells();
    c[0].focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(c[0]);

    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(c[2]);

    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(c[3]);
  });

  // ── Paste: the way most people actually enter a code ───────────────────────

  it('spreads a pasted code across the cells and lands on the last one', async () => {
    await setup({ length: 6 });
    cells()[0].focus();
    await userEvent.paste('123456');
    expect(code()).toBe('123456');
    expect(document.activeElement).toBe(cells()[5]);
  });

  it('strips separators out of a pasted code', async () => {
    await setup({ length: 6 });
    cells()[0].focus();
    await userEvent.paste('123-456');
    expect(code()).toBe('123456');
  });

  it('drops overflow rather than wrapping around', async () => {
    await setup({ length: 4 });
    cells()[0].focus();
    await userEvent.paste('123456789');
    expect(code()).toBe('1234');
  });

  it('fires complete exactly once for a pasted code', async () => {
    const complete: string[] = [];
    const { fixture } = await setup({ length: 4 });
    fixture.componentInstance.complete.subscribe((v) => complete.push(v));
    cells()[0].focus();
    await userEvent.paste('1234');
    expect(complete).toEqual(['1234']);
  });

  // ── Disabled ───────────────────────────────────────────────────────────────

  it('disables every cell, not just the first', async () => {
    await setup({ length: 4, disabled: true });
    expect(cells().every((c) => c.disabled)).toBe(true);
  });

  // ── The error slot ─────────────────────────────────────────────────────────

  it('renders a client-side message', async () => {
    await setup({ length: 4, errorMessage: 'Enter all four digits.' });
    expect(screen.getByRole('alert').textContent).toContain('Enter all four digits.');
  });

  it('marks the group invalid and points at the message', async () => {
    // Regression: the bindings that do this were once inserted into an HTML
    // comment, so the message rendered and nothing referenced it — the field
    // announced as valid while showing a rejection.
    const { fixture } = await setup({ length: 4, errorMessage: 'That code is wrong.' });
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-invalid')).toBe('true');

    const describedBy = group?.getAttribute('aria-describedby') ?? '';
    const errorId = screen.getByRole('alert').getAttribute('id') ?? '';
    expect(errorId).not.toBe('');
    expect(describedBy.split(' ')).toContain(errorId);
  });

  it('describes the group by BOTH the hint and the error when both are present', async () => {
    const { fixture } = await setup({ length: 4, hint: 'Check your texts.', errorMessage: 'Wrong.' });
    const ids = (
      (fixture.nativeElement as HTMLElement)
        .querySelector('[role="group"]')
        ?.getAttribute('aria-describedby') ?? ''
    ).split(' ');
    expect(ids.length).toBe(2);
  });

  it('drops aria-describedby entirely when there is nothing to describe', async () => {
    const { fixture } = await setup({ length: 4 });
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('lets a server rejection outrank the client message, and expires it on the next digit', async () => {
    const { fixture } = await setup({
      length: 4,
      value: '1234',
      errorMessage: 'Enter all four digits.',
      serverError: 'That code has expired.',
    });
    expect(screen.getByRole('alert').textContent).toContain('That code has expired.');

    cells()[3].focus();
    await userEvent.keyboard('{Backspace}');
    fixture.detectChanges();

    // The rejection was about 1234, which is no longer what is in the field.
    expect(screen.getByRole('alert').textContent).not.toContain('That code has expired.');
    expect(screen.getByRole('alert').textContent).toContain('Enter all four digits.');
  });
});
