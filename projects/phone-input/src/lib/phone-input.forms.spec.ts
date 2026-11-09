import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { render, fireEvent } from '@testing-library/angular';
import { SvPhoneInputComponent } from './phone-input.component';

/**
 * `SR-23` — `[formControl]` and `[(ngModel)]` could not be used on
 * `sv-phone-input` at all (no value accessor), and `hint`, `placeholder`,
 * `required`, `name` and `variant` never reached the number field.
 */

const numberField = (root: HTMLElement) => root.querySelector('input[type="text"]') as HTMLInputElement;

/** Let the post-render write land, and change detection catch up. */
async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

@Component({
  standalone: true,
  imports: [SvPhoneInputComponent, FormsModule],
  template: `<sv-phone-input [(ngModel)]="phone" name="phone" />`,
})
class NgModelHost {
  phone = '(555) 123-4567';
}

@Component({
  standalone: true,
  imports: [SvPhoneInputComponent, ReactiveFormsModule],
  template: `<sv-phone-input [formControl]="control" />`,
})
class ReactiveHost {
  readonly control = new FormControl<string>('');
}

describe('sv-phone-input — forms (SR-23)', () => {
  it('★ [(ngModel)] writes into the field and reads the user\'s edits back', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(NgModelHost);
    await settle(fixture);
    const input = numberField(fixture.nativeElement);
    expect(input.value).toBe('(555) 123-4567');

    fireEvent.input(input, { target: { value: '5559876543' } });
    await settle(fixture);
    expect(fixture.componentInstance.phone).toBe('(555) 987-6543');
  });

  it('★ a written E.164 value is shaped by the mask, as a typed one would be', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ReactiveHost);
    await settle(fixture);
    fixture.componentInstance.control.setValue('+15550109999');
    await settle(fixture);
    expect(numberField(fixture.nativeElement).value).toBe('(555) 010-9999');
    // A write is not an edit: the control is not dirtied by its own value.
    expect(fixture.componentInstance.control.dirty).toBe(false);
  });

  it('a value written before the first render is shaped once the mask exists', async () => {
    TestBed.resetTestingModule();
    @Component({
      standalone: true,
      imports: [SvPhoneInputComponent, ReactiveFormsModule],
      template: `<sv-phone-input [formControl]="control" />`,
    })
    class EarlyHost {
      readonly control = new FormControl<string>('+15550109999');
    }
    const { fixture } = await render(EarlyHost);
    await settle(fixture);
    expect(numberField(fixture.nativeElement).value).toBe('(555) 010-9999');
  });

  it('control.disable() disables the picker, the field and the extension', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ReactiveHost);
    fixture.componentInstance.control.disable();
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(numberField(root).disabled).toBe(true);
    expect((root.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('is touched when focus leaves the whole control, not on moving within it', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ReactiveHost);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const picker = root.querySelector('button[aria-haspopup="listbox"]') as HTMLElement;
    const input = numberField(root);

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: picker }));
    expect(fixture.componentInstance.control.touched).toBe(false);
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(fixture.componentInstance.control.touched).toBe(true);
  });
});

describe('sv-phone-input — forwarded inputs (SR-23)', () => {
  it('★ hint, placeholder, required and name reach the number field', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, {
      inputs: { hint: 'We text you a code.', placeholder: 'Your mobile', required: true, name: 'mobile' },
    });
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const input = numberField(root);
    expect(input.placeholder).toBe('Your mobile');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('name')).toBe('mobile');

    const hint = root.querySelector('[data-sv-phone-hint]')!;
    expect(hint.textContent?.trim()).toBe('We text you a code.');
    expect(root.querySelector('[role="group"]')!.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('forwards variant to the mask', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { variant: 'filled' } });
    await settle(fixture);
    const mask = fixture.debugElement.query((d) => d.name === 'sv-input-mask');
    expect(mask.componentInstance.variant()).toBe('filled');
  });

  it('changes nothing for a host that passes none of them', async () => {
    TestBed.resetTestingModule();
    const value = signal('');
    const { fixture } = await render(SvPhoneInputComponent, { inputs: { value: value() } });
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(numberField(root).required).toBe(false);
    expect(numberField(root).hasAttribute('name')).toBe(false);
    expect(root.querySelector('[data-sv-phone-hint]')).toBeNull();
  });
});
