import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SV_AUTOFILL_END, SV_AUTOFILL_START } from '@styloviz/core';
import { SvInputFieldComponent } from './input-field.component';

/**
 * `FI-27-I2` — the floating label and the fill it could not see.
 *
 * `isFocused() || !!value()` covers typing and a bound value. It does not cover
 * Chrome filling the field on page load, which sets the element's `value`
 * directly and fires no `input` event — so `value()` stays `''`, the label
 * stays in its resting position, and it sits on top of the text the browser
 * just put there.
 */

@Component({
  standalone: true,
  imports: [SvInputFieldComponent],
  template: `
    <sv-input-field variant="floating" label="Email" [(value)]="value" />
  `,
})
class HostComponent {
  readonly value = signal('');
}

function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const debug = fixture.debugElement.query(By.directive(SvInputFieldComponent));
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    field: debug.componentInstance as SvInputFieldComponent,
    input: el.querySelector('input')!,
    label: () => el.querySelector('label')!,
    tick: () => fixture.detectChanges(),
  };
}

function animation(el: HTMLElement, name: string): void {
  const ev = new Event('animationstart', { bubbles: true });
  Object.defineProperty(ev, 'animationName', { value: name });
  el.dispatchEvent(ev);
}

describe('SvInputFieldComponent — floating label over an autofilled value', () => {
  it('rests over the field until something puts a value in it', () => {
    const { field } = setup();
    expect(field.labelIsFloated()).toBe(false);
  });

  it('floats when the browser fills the field, with no input event anywhere', () => {
    const { field, input, tick } = setup();

    animation(input, SV_AUTOFILL_START);
    tick();

    expect(field.labelIsFloated()).toBe(true);
  });

  it('leaves the bound value alone — a fill is not a value it can read', () => {
    // A password filled on page load is masked to script until the user
    // interacts, so `input.value` comes back empty. The label only ever needed
    // to know that the browser put something there.
    const { host, input, tick } = setup();

    animation(input, SV_AUTOFILL_START);
    tick();

    expect(host.value()).toBe('');
  });

  it('drops the placeholder while the label is floated over a fill', () => {
    // The floating variant swaps the placeholder for a single space while the
    // label is resting, so the two never render on top of each other. A fill
    // that floated the label without releasing the placeholder would put the
    // placeholder text back under the filled value.
    const { input, tick } = setup();
    animation(input, SV_AUTOFILL_START);
    tick();

    expect(input.getAttribute('placeholder')).not.toBe(' ');
  });

  it('settles back when the browser clears the fill', () => {
    const { field, input, tick } = setup();
    animation(input, SV_AUTOFILL_START);
    tick();

    animation(input, SV_AUTOFILL_END);
    tick();

    expect(field.labelIsFloated()).toBe(false);
  });

  it('stays floated on a real value after the fill is replaced by typing', () => {
    const { host, field, input, tick } = setup();
    animation(input, SV_AUTOFILL_START);
    tick();

    host.value.set('a@b.com');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    // The fill claim is over, but the field is not empty — the original two
    // conditions take it from here.
    expect(field.labelIsFloated()).toBe(true);
  });

  it('does not float for an animation that belongs to something else', () => {
    const { field, input, tick } = setup();

    animation(input, 'sv-popout-in-below');
    tick();

    expect(field.labelIsFloated()).toBe(false);
  });
});
