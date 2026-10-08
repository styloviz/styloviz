import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvOtpInputComponent } from './otp-input.component';

/**
 * `FI-16-I2` / `FI-16-M1` / `FI-16-M2` — six boxes is six form fields.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 *
 * ★★★ EVERYTHING THAT READS FORMS BELIEVES THE SIX. A screen reader announces
 *     six controls where the user has one thing to enter. A password manager
 *     sees six fields and offers to fill none of them. iOS's "From Messages"
 *     autofill and Android's SMS suggestion both look for ONE input carrying
 *     `autocomplete="one-time-code"` and quietly skip a row of them.
 *
 * ★★ The per-cell `aria-label`s ("Digit 3 of 6") make the announcement
 *    survivable. They cannot make the control singular — and it is the
 *    singularity that the platform features key off, which is why this is a
 *    structural fix and not a labelling one.
 *
 * `mode="single"` is one real `<input>` with one real `<label>`, drawn over
 * boxes that are `aria-hidden` decoration. Every keystroke, selection, paste and
 * Backspace is then the browser's own.
 */

async function setup(inputs: Partial<ComponentInput<SvOtpInputComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvOtpInputComponent, { inputs: inputs as ComponentInput<SvOtpInputComponent> });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const fields = (h: HTMLElement) => [...h.querySelectorAll<HTMLInputElement>('input')];
const type = (input: HTMLInputElement, v: string) => {
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('SvOtpInputComponent — cells mode is untouched', () => {
  it('still renders one input per digit', async () => {
    const { fixture } = await setup({ length: 6 });
    expect(fields(el(fixture)).length).toBe(6);
    expect(el(fixture).querySelector('[role="group"]')).not.toBeNull();
  });

  it('is still the default, so no existing caller changes shape', async () => {
    const { fixture } = await setup({});
    expect(fixture.componentInstance.isSingle()).toBe(false);
  });
});

describe('SvOtpInputComponent — single mode is one field', () => {
  it('renders exactly one input for a six-digit code', async () => {
    const { fixture } = await setup({ length: 6, mode: 'single' });
    expect(fields(el(fixture)).length).toBe(1);
  });

  it('carries the one-time-code hint the OS autofill looks for', async () => {
    const { fixture } = await setup({ mode: 'single' });
    expect(fields(el(fixture))[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(fields(el(fixture))[0].getAttribute('inputmode')).toBe('numeric');
  });

  it('accepts the whole code, not one character', async () => {
    const { fixture } = await setup({ length: 6, mode: 'single' });
    type(fields(el(fixture))[0], '123456');
    expect(fixture.componentInstance.value()).toBe('123456');
  });

  it('uses a real label element, which cells mode cannot', async () => {
    // ★ A `<label for>` needs a single control to point at. That is the whole
    //   difference the mode exists to make, so it is asserted rather than
    //   assumed.
    const { fixture } = await setup({ mode: 'single', label: 'Verification code' });
    const host = el(fixture);
    const label = host.querySelector('label');
    expect(label?.getAttribute('for')).toBe(fields(host)[0].getAttribute('id'));
  });

  it('names the field when there is no visible label', async () => {
    const { fixture } = await setup({ mode: 'single' });
    expect(fields(el(fixture))[0].getAttribute('aria-label')).toBe('One-time code');
  });

  it('hides the decorative boxes from assistive tech', async () => {
    // They are the visual answer, not a control. A reader meeting six
    // `role="presentation"`-less boxes beside one field would announce the code
    // twice.
    const { fixture } = await setup({ length: 6, mode: 'single' });
    const boxes = [...el(fixture).querySelectorAll('span[aria-hidden="true"]')];
    expect(boxes.length).toBeGreaterThanOrEqual(6);
  });

  it('strips anything that is not a digit, because SMS text arrives with the code', async () => {
    // "Your code is 123456" pasted whole is the common case, not the edge one.
    const { fixture } = await setup({ length: 6, mode: 'single' });
    type(fields(el(fixture))[0], 'Your code is 123456');
    expect(fixture.componentInstance.value()).toBe('123456');
  });

  it('never holds characters the model dropped', async () => {
    const { fixture } = await setup({ length: 4, mode: 'single' });
    const f = fields(el(fixture))[0];
    type(f, '9876543210');
    expect(fixture.componentInstance.value()).toBe('9876');
    expect(f.value).toBe('9876');
  });

  it('reports completion once the last digit lands', async () => {
    const done: string[] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvOtpInputComponent, {
      inputs: { length: 4, mode: 'single' } as ComponentInput<SvOtpInputComponent>,
      on: { complete: (v: string) => done.push(v) },
    });
    const f = fields(el(fixture))[0];
    type(f, '123');
    expect(done).toEqual([]);
    type(f, '1234');
    expect(done).toEqual(['1234']);
  });

  it('shows the caret box only while focused', async () => {
    const { fixture } = await setup({ length: 6, mode: 'single' });
    expect(fixture.componentInstance.caretBox()).toBe(-1);
    fields(el(fixture))[0].dispatchEvent(new Event('focus', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.caretBox()).toBe(0);
  });

  it('moves the caret box as digits arrive, and stops at the last one', async () => {
    const { fixture } = await setup({ length: 4, mode: 'single' });
    const f = fields(el(fixture))[0];
    f.dispatchEvent(new Event('focus', { bubbles: true }));
    type(f, '12');
    fixture.detectChanges();
    expect(fixture.componentInstance.caretBox()).toBe(2);
    type(f, '1234');
    fixture.detectChanges();
    expect(fixture.componentInstance.caretBox()).toBe(3);   // not 4
  });

  it('still clears on a rejection, the same as cells mode', async () => {
    const { fixture } = await setup({ length: 4, mode: 'single' });
    type(fields(el(fixture))[0], '1234');
    fixture.componentRef.setInput('status', 'error');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('');
  });
});

describe('SvOtpInputComponent — the WebOTP adapter', () => {
  it('asks for nothing when the browser has no OTPCredential', async () => {
    // ★★ Feature-detected and SILENT. A control that warned here would be
    //    reporting the user's browser to the developer, on every iPhone.
    const spy = vi.fn();
    const original = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: spy },
    });
    try {
      await setup({ mode: 'single', webOtp: true });
      expect(spy).not.toHaveBeenCalled();   // jsdom has no OTPCredential
    } finally {
      if (original) Object.defineProperty(navigator, 'credentials', original);
      else delete (navigator as unknown as Record<string, unknown>)['credentials'];
    }
  });

  it('does not ask in cells mode, which has not set up what the API keys off', async () => {
    const spy = vi.fn();
    const original = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get: spy } });
    (window as unknown as Record<string, unknown>)['OTPCredential'] = class {};
    try {
      await setup({ mode: 'cells', webOtp: true });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as Record<string, unknown>)['OTPCredential'];
      if (original) Object.defineProperty(navigator, 'credentials', original);
      else delete (navigator as unknown as Record<string, unknown>)['credentials'];
    }
  });

  it('fills the code when an SMS arrives, digits only', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: () => Promise.resolve({ code: '654321' }) },
    });
    (window as unknown as Record<string, unknown>)['OTPCredential'] = class {};
    try {
      const { fixture } = await setup({ length: 6, mode: 'single', webOtp: true });
      await Promise.resolve();
      await Promise.resolve();
      expect(fixture.componentInstance.value()).toBe('654321');
    } finally {
      delete (window as unknown as Record<string, unknown>)['OTPCredential'];
      if (original) Object.defineProperty(navigator, 'credentials', original);
      else delete (navigator as unknown as Record<string, unknown>)['credentials'];
    }
  });

  it('treats an abort as an ordinary ending, not an error', async () => {
    // The user typing the code themselves aborts the request. A rejection
    // handler that logged would put a console entry under every sign-in.
    const original = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: () => Promise.reject(new DOMException('aborted', 'AbortError')) },
    });
    (window as unknown as Record<string, unknown>)['OTPCredential'] = class {};
    try {
      const { fixture } = await setup({ mode: 'single', webOtp: true });
      await Promise.resolve();
      expect(fixture.componentInstance.value()).toBe('');
    } finally {
      delete (window as unknown as Record<string, unknown>)['OTPCredential'];
      if (original) Object.defineProperty(navigator, 'credentials', original);
      else delete (navigator as unknown as Record<string, unknown>)['credentials'];
    }
  });
});
