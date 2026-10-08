import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SvInputFieldComponent } from './input-field.component';

/**
 * The free twin of `input-field`'s `input-field.pattern.spec.ts`.
 *
 * ★★★ IT IS HERE BECAUSE THE TWIN IS THE POINT. The `new RegExp(pattern)` this
 *     replaces was in BOTH packages, character for character, and a fix applied
 *     to one of a pair of twins is how a kit ends up with a Pro component that
 *     is hardened and a free one that is not. The full reasoning, the measured
 *     figures and the fail-open trade-off are in the Pro spec; this file is the
 *     proof that the free control behaves the same.
 */
@Component({
  standalone: true,
  imports: [SvInputFieldComponent],
  template: `<sv-input-field [value]="value" [pattern]="pattern" />`,
})
class Host {
  value = '';
  pattern = '';
}

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [Host] });
});

function mount(pattern: string, value: string): SvInputFieldComponent {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.pattern = pattern;
  fixture.componentInstance.value = value;
  fixture.detectChanges();
  return fixture.debugElement.children[0].componentInstance as SvInputFieldComponent;
}

it('still validates an ordinary anchored pattern', () => {
  expect(mount('\\d{4}', '1999').validate({} as never)).toBeNull();
  expect(mount('\\d{4}', 'not-a-year-1999').validate({} as never)).not.toBeNull();
});

it('refuses a pattern that would freeze the browser, rather than running it', () => {
  const field = mount('(a|a?)+b', 'a'.repeat(30) + 'X');
  const started = Date.now();
  const errors = field.validate({} as never);
  expect(Date.now() - started).toBeLessThan(1_000);
  expect(errors).toBeNull();
  expect(field.patternProblem()).toContain('freeze');
});

it('does not throw on a pattern that is not a regular expression, and says why', () => {
  const field = mount('(', 'anything');
  expect(() => field.validate({} as never)).not.toThrow();
  field.validate({} as never);
  expect(field.patternProblem()).toContain('not a valid regular expression');
});

describe('the native pattern attribute (FI-04-I1 re-check)', () => {
  /**
   * ★★ The browser evaluates `<input pattern>` itself, on the main thread, so
   *    refusing the pattern in `validate()` alone left the same regex running
   *    one layer down. A refused pattern is now withheld from the attribute.
   */
  function nativeInput(pattern: string): HTMLInputElement {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pattern = pattern;
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('input')!;
  }

  it('carries an ordinary pattern', () => {
    expect(nativeInput('\\d{4}').getAttribute('pattern')).toBe('\\d{4}');
  });

  it('withholds a catastrophic one', () => {
    expect(nativeInput('(a|a?)+b').hasAttribute('pattern')).toBe(false);
  });
});
