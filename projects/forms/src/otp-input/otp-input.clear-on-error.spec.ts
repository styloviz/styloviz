import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SvOtpInputComponent } from './otp-input.component';
import type { OtpInputStatus } from './otp-input.types';
import type { SvServerError } from '@styloviz/core';

/**
 * `FI-16-M3` — clear-on-error.
 *
 * A rejected one-time code cannot be repaired, only replaced: either the user
 * mistyped and will re-read the whole thing from the message, or it expired and
 * every digit is wrong. Leaving it in place makes retrying harder than starting
 * over, because each cell takes one character and typing into a full one does
 * nothing until it is emptied.
 */

@Component({
  standalone: true,
  imports: [SvOtpInputComponent],
  template: `
    <sv-otp-input
      [length]="4"
      [(value)]="value"
      [status]="status()"
      [errorMessage]="errorMessage()"
      [serverError]="serverError()"
      [clearOnError]="clearOnError()"
      (codeCleared)="onCleared()"
      (changed)="seen.push($event)"
    />
    <button type="button" id="elsewhere">Resend</button>
  `,
})
class HostComponent {
  readonly value = signal('1234');
  readonly status = signal<OtpInputStatus>('idle');
  readonly errorMessage = signal('');
  readonly serverError = signal<SvServerError>(null);
  readonly clearOnError = signal(true);
  cleared = 0;
  onCleared(): void { this.cleared++; }
  readonly seen: string[] = [];
}

function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const debug = fixture.debugElement.query(By.directive(SvOtpInputComponent));
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    otp: debug.componentInstance as SvOtpInputComponent,
    el,
    cells: () => Array.from(el.querySelectorAll<HTMLInputElement>('input')),
    notice: () => el.querySelector('[role="status"] .sr-only')?.textContent?.trim() ?? null,
    tick: () => fixture.detectChanges(),
  };
}

describe('SvOtpInputComponent — clear-on-error (FI-16-M3)', () => {
  it('wipes the code when the status turns to error', () => {
    const { host, otp, tick } = setup();
    expect(otp.digits().join('')).toBe('1234');

    host.status.set('error');
    tick();

    expect(otp.digits().join('')).toBe('');
    expect(host.value()).toBe('');
  });

  it('wipes it for a server rejection too, not only for `status`', () => {
    // Two error channels reach this control; a code rejected through one of
    // them is not more editable than one rejected through the other.
    const { host, otp, tick } = setup();

    host.serverError.set('That code has expired');
    tick();

    expect(otp.digits().join('')).toBe('');
  });

  it('wipes it for a client-side message as well', () => {
    const { host, otp, tick } = setup();

    host.errorMessage.set('Incorrect code');
    tick();

    expect(otp.digits().join('')).toBe('');
  });

  /**
   * The trap a naive implementation falls into. `status` is a plain input the
   * host holds at `'error'` until it decides otherwise, so an effect keyed on
   * the *presence* of an error rather than its *arrival* deletes each digit as
   * the user types it — leaving a field that cannot be filled at all.
   */
  it('does not keep wiping while the host holds the error state', () => {
    const { host, otp, tick } = setup();
    host.status.set('error');
    tick();
    expect(otp.digits().join('')).toBe('');

    // The user starts over, with `status` still 'error' because the host has
    // not been told anything new yet.
    otp.onInput({ target: { value: '9' } } as unknown as Event, 0);
    tick();

    expect(otp.digits()[0]).toBe('9');
  });

  it('fires again on a second, separate rejection', () => {
    const { host, otp, tick } = setup();
    host.status.set('error');
    tick();
    otp.onInput({ target: { value: '5' } } as unknown as Event, 0);
    otp.onInput({ target: { value: '6' } } as unknown as Event, 1);
    tick();
    expect(otp.digits().join('')).toBe('56');

    host.status.set('idle');
    tick();
    host.status.set('error');
    tick();

    expect(otp.digits().join('')).toBe('');
    expect(host.cleared).toBe(2);
  });

  it('leaves an already-empty field alone rather than reporting a clear', () => {
    const { host, otp, tick } = setup();
    host.value.set('');
    tick();

    host.status.set('error');
    tick();

    expect(host.cleared).toBe(0);
    expect(otp.digits().join('')).toBe('');
  });

  it('tells the form the value is gone', () => {
    // `changed` and the CVA's `onChange` both: a validator that still sees the
    // old code passes on a value nobody can see.
    const { host, tick } = setup();
    host.status.set('error');
    tick();

    expect(host.seen.at(-1)).toBe('');
  });

  // ── The announcement ──────────────────────────────────────────────────────

  it('announces the wipe, which is otherwise completely silent', () => {
    // Sighted users watch the code vanish. A screen-reader user hears the
    // rejection and carries on believing they are still editing their code.
    const { host, notice, tick } = setup();
    host.status.set('error');
    tick();

    expect(notice()).toBe('Code cleared. Enter the code again.');
  });

  it('drops the announcement once the user starts typing again', () => {
    const { host, otp, notice, tick } = setup();
    host.status.set('error');
    tick();
    otp.onInput({ target: { value: '7' } } as unknown as Event, 0);
    tick();

    expect(notice()).toBeNull();
  });

  // ── Focus ─────────────────────────────────────────────────────────────────

  it('puts the caret back in the first cell when the user was already here', () => {
    const { host, cells, tick } = setup();
    cells()[3].focus();

    host.status.set('error');
    tick();

    expect(document.activeElement).toBe(cells()[0]);
  });

  /**
   * A rejection can land while the user has tabbed away to "Resend" or "Try
   * another method". Pulling focus back into a field they deliberately left is
   * worse than leaving it where it is.
   */
  it('does not yank focus back from somewhere else on the page', () => {
    const { host, el, tick } = setup();
    const elsewhere = el.querySelector<HTMLButtonElement>('#elsewhere')!;
    elsewhere.focus();

    host.status.set('error');
    tick();

    expect(document.activeElement).toBe(elsewhere);
  });

  // ── The opt-out ───────────────────────────────────────────────────────────

  it('keeps the code when the host opts out', () => {
    // For a rejection that is not about the code — "too many attempts, wait 30
    // seconds" — throwing away a very likely correct code is the wrong move.
    const { host, otp, tick } = setup();
    host.clearOnError.set(false);

    host.status.set('error');
    tick();

    expect(otp.digits().join('')).toBe('1234');
    expect(host.cleared).toBe(0);
  });
});

describe('SvOtpInputComponent — clear()', () => {
  it('reports the empty value to the form, which it used to swallow', () => {
    const { host, otp, tick } = setup();

    otp.clear();
    tick();

    expect(host.value()).toBe('');
    expect(host.seen.at(-1)).toBe('');
  });
});
