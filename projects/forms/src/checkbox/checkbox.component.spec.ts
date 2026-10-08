import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvCheckboxComponent } from './checkbox.component';

/**
 * The visible box in this control is a `<span>`. The thing a screen reader and
 * a form both actually deal with is a `sr-only` native `<input>` sitting next
 * to it, and everything that makes the two agree — checked, mixed, disabled,
 * required, the name it is announced by, the message it is described by — is
 * wiring that no screenshot can show is wrong.
 */

async function setup(inputs: Partial<ComponentInput<SvCheckboxComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvCheckboxComponent, {
    inputs: inputs as ComponentInput<SvCheckboxComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const box = () => screen.getByRole('checkbox') as HTMLInputElement;

describe('SvCheckboxComponent — name and description', () => {
  it('names itself by the visible label', async () => {
    const { fixture } = await setup({ label: 'Email me' });
    const labelled = box().getAttribute('aria-labelledby');
    expect(labelled).toBe(fixture.componentInstance.labelId());
    expect(el(fixture).querySelector(`#${labelled}`)?.textContent?.trim()).toBe('Email me');
  });

  it('falls back to aria-label when nothing is visible', async () => {
    await setup({ ariaLabel: 'Select row 3' });
    expect(box().getAttribute('aria-labelledby')).toBeNull();
    expect(box().getAttribute('aria-label')).toBe('Select row 3');
  });

  it('does not carry both names at once', async () => {
    // Two names is the same bug as no name: which one wins is up to the AT.
    await setup({ label: 'Email me', ariaLabel: 'Ignore me' });
    expect(box().getAttribute('aria-label')).toBeNull();
    expect(box().getAttribute('aria-labelledby')).not.toBeNull();
  });

  it('points at the description when there is one', async () => {
    const { fixture } = await setup({ label: 'Email me', description: 'No more than one a week.' });
    expect(box().getAttribute('aria-describedby')).toBe(fixture.componentInstance.descId());
    expect(screen.getByText('No more than one a week.')).toBeTruthy();
  });

  it('describes itself by nothing when there is nothing to say', async () => {
    await setup({ label: 'Email me' });
    expect(box().getAttribute('aria-describedby')).toBeNull();
  });

  it('gives every instance a distinct id', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const { fixture: a } = await setup({ label: 'A' });
    const first = a.componentInstance.resolvedId();
    const b = TestBed.createComponent(SvCheckboxComponent);
    b.componentRef.setInput('label', 'B');
    b.detectChanges();
    await b.whenStable();
    expect(first).not.toBe('');
    expect(b.componentInstance.resolvedId()).not.toBe(first);
  });

  it('uses the id the host supplies', async () => {
    await setup({ label: 'A', inputId: 'terms' });
    expect(box().id).toBe('terms');
  });
});

describe('SvCheckboxComponent — toggling', () => {
  it('flips and reports once per click', async () => {
    const seen: boolean[] = [];
    const model: boolean[] = [];
    const { fixture } = await setup({ label: 'Email me' });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));
    fixture.componentInstance.checked.subscribe((v) => model.push(v));

    await userEvent.click(box());
    expect(fixture.componentInstance.checked()).toBe(true);

    await userEvent.click(box());
    expect(fixture.componentInstance.checked()).toBe(false);

    expect(seen).toEqual([true, false]);
    expect(model).toEqual([true, false]);
  });

  it('refuses to toggle when disabled', async () => {
    const seen: boolean[] = [];
    const { fixture } = await setup({ label: 'Email me', disabled: true });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));

    expect(box().disabled).toBe(true);
    fixture.componentInstance.toggle();
    expect(fixture.componentInstance.checked()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('refuses to toggle when a parent FormControl disabled it', async () => {
    // `[disabled]` is false here — only the form says no. A control that reads
    // just its own input stays clickable inside a disabled form.
    const { fixture } = await setup({ label: 'Email me' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedDisabled()).toBe(true);
    expect(box().disabled).toBe(true);
    fixture.componentInstance.toggle();
    expect(fixture.componentInstance.checked()).toBe(false);
  });

  it('announces the indeterminate state as mixed', async () => {
    await setup({ label: 'Select all', indeterminate: true });
    expect(box().getAttribute('aria-checked')).toBe('mixed');
    expect(box().indeterminate).toBe(true);
  });

  it('leaves the underlying value alone while mixed', async () => {
    // `indeterminate` is the host's word about a set of other boxes; it must not
    // masquerade as this box being checked.
    const { fixture } = await setup({ label: 'Select all', indeterminate: true });
    expect(fixture.componentInstance.checked()).toBe(false);

    await userEvent.click(box());
    expect(fixture.componentInstance.checked()).toBe(true);
    expect(box().getAttribute('aria-checked')).toBe('mixed');
  });
});

describe('SvCheckboxComponent — native form participation', () => {
  it('takes a value from a FormControl', async () => {
    const { fixture } = await setup({ label: 'Email me' });
    fixture.componentInstance.writeValue(true);
    fixture.detectChanges();
    expect(box().checked).toBe(true);
  });

  it('coerces whatever the form hands it to a boolean', async () => {
    const { fixture } = await setup({ label: 'Email me' });
    fixture.componentInstance.writeValue(null as unknown as boolean);
    expect(fixture.componentInstance.checked()).toBe(false);
  });

  it('reports changes and touches back to the form', async () => {
    const seen: boolean[] = [];
    let touched = false;
    const { fixture } = await setup({ label: 'Email me' });
    fixture.componentInstance.registerOnChange((v) => seen.push(v));
    fixture.componentInstance.registerOnTouched(() => { touched = true; });

    await userEvent.click(box());
    expect(seen).toEqual([true]);
    expect(touched).toBe(true);
  });

  it('marks itself required in both places', async () => {
    await setup({ label: 'Accept the terms', required: true });
    expect(box().required).toBe(true);
    expect(box().getAttribute('aria-required')).toBe('true');
  });

  it('carries name and value for native submission', async () => {
    await setup({ label: 'Blue', name: 'colours', value: 'blue' });
    expect(box().getAttribute('name')).toBe('colours');
    expect(box().getAttribute('value')).toBe('blue');
  });

  it('omits name and value rather than submitting empty ones', async () => {
    await setup({ label: 'Blue' });
    expect(box().getAttribute('name')).toBeNull();
    expect(box().getAttribute('value')).toBeNull();
  });
});

describe('SvCheckboxComponent — the error slot', () => {
  it('renders a client-side message', async () => {
    await setup({ label: 'Accept the terms', errorMessage: 'You must accept the terms.' });
    expect(screen.getByRole('alert').textContent).toContain('You must accept the terms.');
  });

  it('marks the control invalid and points at the message', async () => {
    const { fixture } = await setup({ label: 'Accept', errorMessage: 'Required.' });
    expect(box().getAttribute('aria-invalid')).toBe('true');
    const errorId = screen.getByRole('alert').getAttribute('id') ?? '';
    expect(errorId).toBe(fixture.componentInstance['errorId']());
    expect(box().getAttribute('aria-describedby')).toContain(errorId);
  });

  it('describes itself by the description AND the error, not one or the other', async () => {
    const { fixture } = await setup({
      label: 'Accept',
      description: 'Version 4 of the terms.',
      errorMessage: 'Required.',
    });
    const ids = (box().getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toContain(fixture.componentInstance.descId());
    expect(ids).toContain(fixture.componentInstance['errorId']());
  });

  it('lets a server rejection outrank the client message', async () => {
    await setup({ label: 'Accept', errorMessage: 'Required.', serverError: 'Terms have changed.' });
    expect(screen.getByRole('alert').textContent).toContain('Terms have changed.');
  });

  it('expires a server rejection once the box is toggled', async () => {
    const { fixture } = await setup({ label: 'Accept', serverError: 'Terms have changed.' });
    expect(screen.getByRole('alert').textContent).toContain('Terms have changed.');

    await userEvent.click(box());
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the message outside the label element', async () => {
    // Inside the <label>, `role="alert"` text becomes part of the checkbox's own
    // accessible name — the box would announce as "Accept Required."
    const { fixture } = await setup({ label: 'Accept', errorMessage: 'Required.' });
    const label = el(fixture).querySelector('label')!;
    expect(label.contains(screen.getByRole('alert'))).toBe(false);
  });

  it('says nothing when there is nothing wrong', async () => {
    await setup({ label: 'Accept' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(box().getAttribute('aria-invalid')).toBeNull();
  });
});

describe('SvCheckboxComponent — appearance', () => {
  it('scales the box, icon and label together', async () => {
    const { fixture } = await setup({ label: 'A', size: 'lg' });
    const c = fixture.componentInstance;
    expect(c.boxSize()).toContain('h-5');
    expect(c.iconSize()).toContain('h-3');
    expect(c.labelSize()).toBe('text-base');
  });

  it('colours the box only once it has something to show', async () => {
    const { fixture } = await setup({ label: 'A', variant: 'danger' });
    expect(fixture.componentInstance.boxClasses()).not.toContain('bg-danger-600');

    fixture.componentInstance.checked.set(true);
    expect(fixture.componentInstance.boxClasses()).toContain('bg-danger-600');
  });

  it('colours the box while mixed, without being checked', async () => {
    const { fixture } = await setup({ label: 'A', indeterminate: true });
    expect(fixture.componentInstance.boxClasses()).toContain('bg-primary-600');
  });
});
