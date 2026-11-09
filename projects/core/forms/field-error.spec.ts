import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { createFieldError, type SvServerError } from './field-error';
import { SvFieldErrorComponent } from './field-error.component';

/**
 * `createFieldError` is the validation-error contract behind 17 form controls,
 * and the reason it exists is a rule that is easy to state and easy to get
 * wrong: a server rejection is a statement about ONE value, so the moment the
 * user edits the field it stops being true and must stop being shown.
 *
 * These pin that expiry, and the precedence around it, because a stale
 * rejection does not look like a bug — it looks like the form is broken.
 */

function harness(initial = '') {
  const value = signal<unknown>(initial);
  const serverError = signal<SvServerError>(null);
  const errorMessage = signal('');
  return { value, serverError, errorMessage, ...createFieldError(value, serverError, errorMessage) };
}

describe('createFieldError', () => {
  it('shows nothing when neither side has anything to say', () => {
    const f = harness('ada@example.com');
    expect(f.resolvedError()).toBe('');
    expect(f.showError()).toBe(false);
  });

  it('shows the host\'s own client-side message', () => {
    const f = harness();
    f.errorMessage.set('Email is required.');
    expect(f.resolvedError()).toBe('Email is required.');
    expect(f.showError()).toBe(true);
  });

  it('accepts a server error as a bare string or as an object', () => {
    const a = harness('taken@example.com');
    a.serverError.set('That email is already taken.');
    expect(a.resolvedError()).toBe('That email is already taken.');

    const b = harness('taken@example.com');
    b.serverError.set({ message: 'That email is already taken.' });
    expect(b.resolvedError()).toBe('That email is already taken.');
  });

  it('lets the server outrank the client — it is the more specific fact', () => {
    const f = harness('taken@example.com');
    f.errorMessage.set('Enter a valid email.');
    f.serverError.set('That email is already taken.');
    expect(f.resolvedError()).toBe('That email is already taken.');
  });

  // ── The rule the helper exists for ─────────────────────────────────────────

  it('drops the server error the moment the value changes', () => {
    const f = harness('taken@example.com');
    f.serverError.set('That email is already taken.');
    expect(f.resolvedError()).toBe('That email is already taken.');

    f.value.set('taken@example.co');
    expect(f.resolvedError()).toBe('');
    expect(f.showError()).toBe(false);
  });

  it('falls back to the client message once the server error expires', () => {
    const f = harness('taken@example.com');
    f.errorMessage.set('Enter a valid email.');
    f.serverError.set('That email is already taken.');
    expect(f.resolvedError()).toBe('That email is already taken.');

    f.value.set('taken@example.co');
    expect(f.resolvedError()).toBe('Enter a valid email.');
  });

  it('re-anchors to the current value when a NEW rejection arrives', () => {
    const f = harness('one@example.com');
    f.serverError.set('Already taken.');
    expect(f.resolvedError()).toBe('Already taken.'); // a render happens here
    f.value.set('two@example.com');
    expect(f.resolvedError()).toBe('');

    // Second submission, second rejection — about the value on screen now.
    f.serverError.set('Also already taken.');
    expect(f.resolvedError()).toBe('Also already taken.');

    f.value.set('three@example.com');
    expect(f.resolvedError()).toBe('');
  });

  it('does not re-anchor when the same rejection is re-reported', () => {
    // A host that re-emits an identical string on every request must not
    // resurrect a message the user has already edited away.
    const f = harness('one@example.com');
    f.serverError.set('Already taken.');
    expect(f.resolvedError()).toBe('Already taken.');
    f.value.set('two@example.com');
    expect(f.resolvedError()).toBe('');

    f.serverError.set('Already taken.');
    expect(f.resolvedError()).toBe('');
  });

  it('comes back if the user types the rejected value again — deliberate', () => {
    // The statement was about that exact value, and that value is on screen
    // again, so it is true again. Suppressing it here would let the user submit
    // a value the server has already refused with nothing on screen saying so.
    const f = harness('taken@example.com');
    f.serverError.set('That email is already taken.');
    expect(f.resolvedError()).toBe('That email is already taken.');
    f.value.set('taken@example.co');
    expect(f.resolvedError()).toBe('');

    f.value.set('taken@example.com');
    expect(f.resolvedError()).toBe('That email is already taken.');
  });

  it('anchors when the error is first READ, not when it is set', () => {
    // Signals are pull-based, so the anchor cannot be captured at the moment
    // `serverError` is written — only when something reads it. In a rendered
    // control that is the same change-detection pass the input landed in, so
    // the distinction never surfaces. It surfaces here, and it is pinned rather
    // than hidden: a host that writes BOTH inputs before anything reads them
    // anchors to the value it wrote second.
    const f = harness('one@example.com');
    f.serverError.set('Already taken.');
    f.value.set('two@example.com'); // no read in between — not what a render does
    expect(f.resolvedError()).toBe('Already taken.');
  });

  it('clears when the host clears the rejection itself', () => {
    const f = harness('taken@example.com');
    f.serverError.set('Already taken.');
    f.serverError.set(null);
    expect(f.resolvedError()).toBe('');
  });

  it('anchors on identity, so a re-created object value counts as an edit', () => {
    // Controls whose value is an object (a date range, a multi-select) must
    // expire on a new object even when it is deep-equal: the user did act.
    const f = harness();
    f.value.set({ from: '2026-01-01' });
    f.serverError.set('That range is closed.');
    expect(f.resolvedError()).toBe('That range is closed.');

    f.value.set({ from: '2026-01-01' });
    expect(f.resolvedError()).toBe('');
  });
});

describe('SvFieldErrorComponent', () => {
  async function setup(inputs: { message?: string; id?: string } = {}) {
    TestBed.resetTestingModule();
    return render(SvFieldErrorComponent, { inputs });
  }

  it('renders nothing at all when there is no message', async () => {
    const { fixture } = await setup();
    // Not "renders an empty <p>": an empty alert region lingering in the
    // accessibility tree is what this component is written to avoid.
    expect((fixture.nativeElement as HTMLElement).querySelector('p')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces the message, so a rejection after the fact is heard', async () => {
    await setup({ message: 'That email is already taken.' });
    expect(screen.getByRole('alert').textContent).toContain('That email is already taken.');
  });

  it('takes the id the control points its aria-describedby at', async () => {
    await setup({ message: 'Required.', id: 'email-error' });
    expect(screen.getByRole('alert').getAttribute('id')).toBe('email-error');
  });

  it('omits the id attribute rather than emitting an empty one', async () => {
    await setup({ message: 'Required.' });
    expect(screen.getByRole('alert').hasAttribute('id')).toBe(false);
  });

  it('hides its icon from the announcement', async () => {
    await setup({ message: 'Required.' });
    const icon = screen.getByRole('alert').querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * The alert circle beside the message was an inline `<svg>` — a `<circle>` and
 * two `<line>`s, drawn by hand.
 *
 * ★ It was invisible to `check:ui` because this component keeps its markup in
 * an INLINE `template:` backtick string and the rule scanned `.html` files
 * only. It is also the highest-leverage one in the kit: 17 form controls render
 * `sv-field-error`, so a single hand-drawn glyph here is a hand-drawn glyph
 * under every rejected field in the product.
 *
 * Converting it is why `@styloviz/core` now declares `@styloviz/icons` as a
 * peer dependency — the first time the base package has depended on another
 * workspace library.
 */
describe('SvFieldErrorComponent — the icon comes from the library', () => {
  it('draws no glyph by hand', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFieldErrorComponent, {
      inputs: { message: 'That username is taken.' },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect([...host.querySelectorAll('svg')].filter((n) => !n.closest('sv-icon'))).toEqual([]);
  });

  it('renders neither message nor glyph when there is nothing to say', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFieldErrorComponent, { inputs: { message: '' } });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelectorAll('svg').length).toBe(0);
  });
});
