import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvInputFieldComponent } from './input-field.component';

/**
 * `validate()` is the half of this component a user never sees and a form
 * depends on entirely. Every rule in it has a "does not fire" side that matters
 * as much as the "does": `minlength` must stay quiet on an empty field or a
 * pristine form shows two messages for one omission, and an uncompilable
 * `pattern` must be skipped rather than thrown out of a change-detection pass.
 *
 * The free twin had no spec for any of it.
 */

async function setup(inputs: Partial<ComponentInput<SvInputFieldComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvInputFieldComponent, {
    inputs: inputs as ComponentInput<SvInputFieldComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const field = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLInputElement>('input, textarea, select')!;

/** `validate` ignores its argument entirely; it reads the component's own signals. */
const validate = (c: SvInputFieldComponent) => c.validate({} as never);

describe('SvInputFieldComponent — validate()', () => {
  it('says nothing about a field with no constraints at all', async () => {
    const { fixture } = await setup({ value: 'anything' });
    expect(validate(fixture.componentInstance)).toBeNull();
  });

  it('fails an empty required field and passes a filled one', async () => {
    const empty = await setup({ required: true, value: '' });
    expect(validate(empty.fixture.componentInstance)).toEqual({ required: true });

    const filled = await setup({ required: true, value: 'x' });
    expect(validate(filled.fixture.componentInstance)).toBeNull();
  });

  it('leaves an empty NON-required field alone', async () => {
    const { fixture } = await setup({ required: false, value: '' });
    expect(validate(fixture.componentInstance)).toBeNull();
  });

  it('reports maxlength only past the limit, not at it', async () => {
    // `maxLength: 3` with exactly three characters is the boundary the native
    // attribute allows; only a value written in from a form can exceed it.
    const at = await setup({ maxLength: 3, value: 'abc' });
    expect(validate(at.fixture.componentInstance)).toBeNull();

    const over = await setup({ maxLength: 3, value: 'abcd' });
    expect(validate(over.fixture.componentInstance)).toEqual({
      maxlength: { requiredLength: 3, actualLength: 4 },
    });
  });

  it('treats maxLength 0 as "no limit" rather than "nothing allowed"', async () => {
    const { fixture } = await setup({ maxLength: 0, value: 'plenty of text' });
    expect(validate(fixture.componentInstance)).toBeNull();
    expect(fixture.componentInstance.showCounter()).toBe(false);
  });

  it('reports minlength below the floor, and stays silent AT it and when empty', async () => {
    const under = await setup({ minLength: 4, value: 'abc' });
    expect(validate(under.fixture.componentInstance)).toEqual({
      minlength: { requiredLength: 4, actualLength: 3 },
    });

    const at = await setup({ minLength: 4, value: 'abcd' });
    expect(validate(at.fixture.componentInstance)).toBeNull();

    // The empty case belongs to `required`, not to `minlength`.
    const empty = await setup({ minLength: 4, value: '' });
    expect(validate(empty.fixture.componentInstance)).toBeNull();
  });

  it('treats minLength 0 as "no floor"', async () => {
    const { fixture } = await setup({ minLength: 0, value: 'a' });
    expect(validate(fixture.componentInstance)).toBeNull();
  });

  it('anchors the pattern at both ends', async () => {
    const exact = await setup({ pattern: '[0-9]{3}', value: '123' });
    expect(validate(exact.fixture.componentInstance)).toBeNull();

    const partial = await setup({ pattern: '[0-9]{3}', value: 'abc123def' });
    expect(validate(partial.fixture.componentInstance)).toEqual({
      pattern: { requiredPattern: '[0-9]{3}', actualValue: 'abc123def' },
    });
  });

  it('does not test a pattern against an empty value', async () => {
    const { fixture } = await setup({ pattern: '[0-9]{3}', value: '' });
    expect(validate(fixture.componentInstance)).toBeNull();
  });

  it('skips an uncompilable pattern instead of throwing out of change detection', async () => {
    const { fixture } = await setup({ pattern: '[unclosed', value: 'anything' });
    expect(() => validate(fixture.componentInstance)).not.toThrow();
    expect(validate(fixture.componentInstance)).toBeNull();
  });

  it('reports every broken rule at once, not just the first', async () => {
    const { fixture } = await setup({
      required: true, minLength: 4, maxLength: 2, pattern: '[0-9]+', value: 'abc',
    });
    const errors = validate(fixture.componentInstance)!;
    // `required` is satisfied — the value is non-empty — so it must be absent,
    // while the other three all fail on the same three characters.
    expect(Object.keys(errors).sort()).toEqual(['maxlength', 'minlength', 'pattern']);
  });
});

describe('SvInputFieldComponent — validate() through a real form', () => {
  @Component({
    standalone: true,
    imports: [SvInputFieldComponent, ReactiveFormsModule],
    template: `<sv-input-field [formControl]="control" label="Code" [required]="required()" />`,
  })
  class Host {
    readonly control = new FormControl('');
    readonly required = signal(false);
  }

  it('is registered as NG_VALIDATORS, so the form sees the failure', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    fixture.componentInstance.required.set(true);
    fixture.detectChanges();
    fixture.componentInstance.control.updateValueAndValidity();

    expect(fixture.componentInstance.control.errors).toEqual({ required: true });
    expect(fixture.componentInstance.control.valid).toBe(false);
  });
});

describe('SvInputFieldComponent — which message is on screen', () => {
  it('shows the hint when nothing has gone wrong', async () => {
    const { fixture } = await setup({ hint: 'Work address please' });
    const c = fixture.componentInstance;
    expect([c.showHint(), c.showError(), c.showSuccess()]).toEqual([true, false, false]);
  });

  it('lets the error replace the hint rather than stack with it', async () => {
    const { fixture } = await setup({ hint: 'Work address', errorMessage: 'Required' });
    const c = fixture.componentInstance;
    expect([c.showHint(), c.showError(), c.showSuccess()]).toEqual([false, true, false]);
    expect(el(fixture).textContent).not.toContain('Work address');
  });

  it('hides the hint behind a success message too', async () => {
    const { fixture } = await setup({ hint: 'Work address', successMessage: 'Looks good' });
    const c = fixture.componentInstance;
    expect([c.showHint(), c.showError(), c.showSuccess()]).toEqual([false, false, true]);
  });

  it('drops success the moment an error arrives', async () => {
    const { fixture } = await setup({ successMessage: 'Looks good', errorMessage: 'Taken' });
    expect(fixture.componentInstance.showSuccess()).toBe(false);
    expect(el(fixture).textContent).not.toContain('Looks good');
  });

  it('renders no description row at all when there is nothing to say', async () => {
    const { fixture } = await setup({ label: 'Email' });
    expect(fixture.componentInstance.hasDescription()).toBe(false);
    expect(field(fixture).getAttribute('aria-describedby')).toBeNull();
  });

  it('switches to the error state without being told, overriding an explicit one', async () => {
    const { fixture } = await setup({ state: 'success', errorMessage: 'Taken' });
    expect(fixture.componentInstance.resolvedState()).toBe('error');
    expect(field(fixture).getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps an explicit non-error state when there is no message', async () => {
    const { fixture } = await setup({ state: 'warning' });
    expect(fixture.componentInstance.resolvedState()).toBe('warning');
    expect(field(fixture).getAttribute('aria-invalid')).toBeNull();
  });
});

describe('SvInputFieldComponent — aria-describedby is a LIST', () => {
  const describedBy = (f: { nativeElement: unknown }) =>
    (field(f).getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

  it('names nothing when there is neither description nor counter', async () => {
    const { fixture } = await setup({});
    expect(fixture.componentInstance.describedByIds()).toBeNull();
    expect(describedBy(fixture)).toEqual([]);
  });

  it('names the counter on its own', async () => {
    const { fixture } = await setup({ maxLength: 40, value: 'hi' });
    const ids = describedBy(fixture);
    expect(ids).toEqual([fixture.componentInstance.describedByCounterId()]);
    expect(el(fixture).querySelector(`#${ids[0]}`)?.textContent).toContain('40');
  });

  it('names the description on its own', async () => {
    const { fixture } = await setup({ hint: 'Keep it short' });
    expect(describedBy(fixture)).toEqual([fixture.componentInstance.describedById()]);
  });

  it('names both, in reading order', async () => {
    const { fixture } = await setup({ hint: 'Keep it short', maxLength: 40, value: 'hi' });
    const c = fixture.componentInstance;
    expect(describedBy(fixture)).toEqual([c.describedById(), c.describedByCounterId()]);
  });

  it('flags a value the host wrote past the limit', async () => {
    // The native `maxlength` stops typing, so the only way past it is a value
    // written in from a form — exactly when nobody is watching.
    const over = await setup({ maxLength: 3, value: 'far too long' });
    expect(over.fixture.componentInstance.counterOver()).toBe(true);

    const under = await setup({ maxLength: 3, value: 'abc' });
    expect(under.fixture.componentInstance.counterOver()).toBe(false);
  });
});

describe('SvInputFieldComponent — the server error expires', () => {
  it('outranks the client message while it still describes the value', async () => {
    const { fixture } = await setup({
      value: 'a@b.com', errorMessage: 'Required', serverError: 'Already taken',
    });
    expect(fixture.componentInstance.resolvedError()).toBe('Already taken');
  });

  it('takes an object with a message as readily as a string', async () => {
    const { fixture } = await setup({ value: 'a@b.com', serverError: { message: 'Already taken' } });
    expect(fixture.componentInstance.resolvedError()).toBe('Already taken');
  });

  it('expires when the value it was about changes, falling back to the client message', async () => {
    const { fixture } = await setup({
      value: 'a@b.com', errorMessage: 'Required', serverError: 'Already taken',
    });
    await userEvent.type(field(fixture), 'x');
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedError()).toBe('Required');
  });

  it('leaves nothing behind when there was no client message to fall back to', async () => {
    const { fixture } = await setup({ value: 'a@b.com', serverError: 'Already taken' });
    await userEvent.type(field(fixture), 'x');
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedError()).toBe('');
    expect(fixture.componentInstance.showError()).toBe(false);
  });
});
