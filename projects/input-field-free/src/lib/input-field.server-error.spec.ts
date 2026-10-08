import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvInputFieldComponent } from './input-field.component';

/**
 * `serverError` exists for one reason: it expires.
 *
 * A 422 is a statement about the value that was submitted. Left on screen
 * after the user edits the field it becomes a lie — "that email is already
 * taken" pointing at an email nobody has tried yet — and the user's only
 * recourse is to submit again to find out whether they fixed it. Everything
 * below is that lifetime, plus the precedence it implies while it is alive.
 */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvInputFieldComponent, {
    inputs: { value: 'taken@example.com', ...inputs },
  });
  return fixture;
}

describe('SvInputFieldComponent — serverError', () => {
  it('renders the server message, and outranks a client one', async () => {
    const fixture = await setup({
      errorMessage: 'Enter a valid email',
      serverError: 'That email is already registered',
    });
    expect(fixture.componentInstance.resolvedError()).toBe('That email is already registered');
    expect(fixture.nativeElement.textContent).toContain('That email is already registered');
  });

  it('accepts an SvDataError-shaped object, not just a string', async () => {
    const fixture = await setup({
      serverError: { message: 'That email is already registered', status: 422, retryable: false },
    });
    expect(fixture.componentInstance.resolvedError()).toBe('That email is already registered');
  });

  it('expires the moment the value changes, falling back to the client error', async () => {
    const fixture = await setup({
      errorMessage: 'Enter a valid email',
      serverError: 'That email is already registered',
    });
    expect(fixture.componentInstance.resolvedError()).toBe('That email is already registered');

    // The user starts fixing it. The server has not been asked again, so the
    // server's verdict no longer describes what is in the field.
    fixture.componentInstance.value.set('new@example.com');
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedError()).toBe('Enter a valid email');
    expect(fixture.nativeElement.textContent).not.toContain('already registered');
  });

  it('comes back when the server rejects the new value too', async () => {
    const fixture = await setup({ serverError: 'That email is already registered' });
    fixture.componentInstance.value.set('also-taken@example.com');
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedError()).toBe('');

    // A fresh submit, a fresh 422 — a *different* message, because an
    // identical one would re-anchor silently and this test would pass without
    // proving the anchor moved.
    fixture.componentRef.setInput('serverError', 'That one is taken as well');
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedError()).toBe('That one is taken as well');
  });

  it('leaves the field clean when neither error is set', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance.resolvedError()).toBe('');
    expect(fixture.componentInstance.showError()).toBe(false);
  });

  it('drives the error styling, not just the text — an unstyled 422 reads as a hint', async () => {
    const fixture = await setup({ hint: 'We never share this', serverError: 'Already registered' });
    expect(fixture.componentInstance.resolvedState()).toBe('error');
    expect(fixture.componentInstance.showHint()).toBe(false);
  });
});
