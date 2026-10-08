import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { flush } from '../../../../src/testing/async';
import { SvInputFieldComponent } from './input-field.component';

/**
 * The event surface: what the component does when the user touches it, and —
 * more often the interesting half — what it declines to do. Enter must not
 * submit a textarea, `autofocus` must not steal focus from a disabled or
 * read-only field, and blur must report `touched` exactly once.
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

describe('SvInputFieldComponent — typing', () => {
  it('emits valueChange for what was typed', async () => {
    const { fixture } = await setup({});
    const seen: string[] = [];
    // `value` is a `model()`; the ModelSignal itself is the `valueChange` ref.
    fixture.componentInstance.value.subscribe((v) => seen.push(v));

    await userEvent.type(field(fixture), 'ab');
    expect(seen).toEqual(['a', 'ab']);
    expect(fixture.componentInstance.value()).toBe('ab');
  });

  it('reads a <select> change off the same handler', async () => {
    const { fixture } = await setup({
      options: [{ label: 'Draft', value: 'draft' }, { label: 'Live', value: 'live' }],
    });
    await userEvent.selectOptions(field(fixture), 'live');
    expect(fixture.componentInstance.value()).toBe('live');
  });

  it('emits submitted on Enter — but never from a textarea', async () => {
    const single = await setup({});
    const seen: string[] = [];
    single.fixture.componentInstance.submitted.subscribe((v) => seen.push(v));
    await userEvent.type(field(single.fixture), 'query{Enter}');
    expect(seen).toEqual(['query']);

    const multi = await setup({ multiline: true });
    const seenMulti: string[] = [];
    multi.fixture.componentInstance.submitted.subscribe((v) => seenMulti.push(v));
    await userEvent.type(field(multi.fixture), 'line{Enter}');
    expect(seenMulti).toEqual([]);
  });

  it('stays quiet on a key that is not Enter', async () => {
    const { fixture } = await setup({});
    const seen: string[] = [];
    fixture.componentInstance.submitted.subscribe((v) => seen.push(v));
    await userEvent.type(field(fixture), 'a{Escape}{Tab}');
    expect(seen).toEqual([]);
  });

  it('reports focus and blur, and tracks the flag between them', async () => {
    const { fixture } = await setup({});
    const seen: string[] = [];
    fixture.componentInstance.focused.subscribe(() => seen.push('focus'));
    fixture.componentInstance.blurred.subscribe(() => seen.push('blur'));

    await userEvent.click(field(fixture));
    expect(fixture.componentInstance.isFocused()).toBe(true);
    await userEvent.tab();
    expect(fixture.componentInstance.isFocused()).toBe(false);
    expect(seen).toEqual(['focus', 'blur']);
  });
});

describe('SvInputFieldComponent — the password reveal', () => {
  it('flips the type and the button\'s own state, both ways', async () => {
    const { fixture } = await setup({ type: 'password', value: 'hunter2' });
    const toggle = el(fixture).querySelector<HTMLButtonElement>('[aria-controls]')!;

    expect(field(fixture).type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Show password');
    // The button must name the control it acts on, or the association is a lie.
    expect(toggle.getAttribute('aria-controls')).toBe(field(fixture).id);

    await userEvent.click(toggle);
    fixture.detectChanges();
    expect(field(fixture).type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');

    await userEvent.click(toggle);
    fixture.detectChanges();
    expect(field(fixture).type).toBe('password');
  });

  it('leaves a non-password type alone whatever showPassword says', async () => {
    const { fixture } = await setup({ type: 'email' });
    fixture.componentInstance.showPassword.set(true);
    expect(fixture.componentInstance.resolvedType()).toBe('email');
    expect(el(fixture).querySelector('[aria-label="Show password"]')).toBeNull();
  });
});

describe('SvInputFieldComponent — autofocus', () => {
  // `[attr.autofocus]` is only honoured by the browser while it parses the
  // document, so an element Angular creates afterwards is never focused by it.
  // `ngAfterViewInit` is what makes the input true — and its three guards are
  // the whole test.

  it('focuses the field when asked', async () => {
    const { fixture } = await setup({ autofocus: true });
    await flush();
    expect(document.activeElement).toBe(field(fixture));
  });

  it('leaves focus alone when not asked', async () => {
    const { fixture } = await setup({});
    await flush();
    expect(document.activeElement).not.toBe(field(fixture));
  });

  it('does not steal focus for a disabled field', async () => {
    const { fixture } = await setup({ autofocus: true, disabled: true });
    await flush();
    expect(document.activeElement).not.toBe(field(fixture));
  });

  it('does not steal focus for a read-only field', async () => {
    // A read-only field can technically take focus, which makes this the guard
    // most likely to be dropped — and dropping it puts the caret in a field the
    // user cannot type into.
    const { fixture } = await setup({ autofocus: true, readonly: true });
    await flush();
    expect(document.activeElement).not.toBe(field(fixture));
  });

  it('focuses on demand through the public focus() method', async () => {
    const { fixture } = await setup({});
    fixture.componentInstance.focus();
    expect(document.activeElement).toBe(field(fixture));
  });
});

describe('SvInputFieldComponent — as a ControlValueAccessor', () => {
  @Component({
    standalone: true,
    imports: [SvInputFieldComponent, ReactiveFormsModule],
    template: `<sv-input-field [formControl]="control" label="Email" />`,
  })
  class Host {
    readonly control = new FormControl('');
  }

  async function hosted() {
    TestBed.resetTestingModule();
    return render(Host);
  }

  it('renders what the form holds', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.setValue('a@b.com');
    fixture.detectChanges();
    expect(field(fixture).value).toBe('a@b.com');
  });

  it('coerces the null a reset() sends rather than rendering it', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.setValue('a@b.com');
    fixture.componentInstance.control.reset();
    fixture.detectChanges();
    expect(field(fixture).value).toBe('');
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('reports typing back to the form', async () => {
    const { fixture } = await hosted();
    await userEvent.type(field(fixture), 'hello');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('hello');
  });

  it('marks the control touched on blur, not on focus', async () => {
    const { fixture } = await hosted();
    await userEvent.click(field(fixture));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.touched).toBe(false);

    await userEvent.tab();
    fixture.detectChanges();
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('obeys a disabled FormControl as well as the disabled input', async () => {
    const { fixture } = await hosted();
    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    expect(field(fixture).disabled).toBe(true);

    fixture.componentInstance.control.enable();
    fixture.detectChanges();
    expect(field(fixture).disabled).toBe(false);
  });
});
