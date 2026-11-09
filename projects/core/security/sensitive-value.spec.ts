import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SV_SENSITIVE_PRIVACY,
  injectSvSensitivePrivacy,
  provideSvSensitivePrivacy,
  svLast4,
  svMaskTail,
  svStripHostAttributes,
} from './sensitive-value';

describe('svLast4', () => {
  it('counts significant characters, not separators', () => {
    expect(svLast4('4111-1111-1111-1234')).toBe('1234');
    expect(svLast4('FRESH-GIFT-2K')).toBe('FT2K');
  });

  it('is empty for an empty or missing value', () => {
    expect(svLast4('')).toBe('');
    expect(svLast4(null)).toBe('');
    expect(svLast4(undefined)).toBe('');
  });

  it('honours a custom count', () => {
    expect(svLast4('ABCDEFG', 2)).toBe('FG');
  });
});

describe('svMaskTail', () => {
  it('masks all but the last four and keeps the separators in place', () => {
    expect(svMaskTail('4111 1111 1111 1234')).toBe('•••• •••• •••• 1234');
    expect(svMaskTail('FRESH-GIFT-2K')).toBe('•••••-••FT-2K');
  });

  it('never reveals more than the value has', () => {
    expect(svMaskTail('12', 4)).toBe('12');
    expect(svMaskTail('')).toBe('');
  });

  it('masks everything when visible is 0', () => {
    expect(svMaskTail('SW1A 2AA', 0, '*')).toBe('**** ***');
  });
});

describe('svStripHostAttributes', () => {
  it('removes only the named attributes', () => {
    const el = document.createElement('div');
    el.setAttribute('code', 'SECRET');
    el.setAttribute('class', 'x');
    svStripHostAttributes(el, ['code', 'number']);
    expect(el.hasAttribute('code')).toBe(false);
    expect(el.getAttribute('class')).toBe('x');
  });
});

@Component({ selector: 'sv-privacy-probe', standalone: true, template: '{{ privacy() }}' })
class PrivacyProbeComponent {
  readonly privacy = injectSvSensitivePrivacy();
}

describe('SV_SENSITIVE_PRIVACY', () => {
  it('reads false when nothing is provided', () => {
    const fixture = TestBed.createComponent(PrivacyProbeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('false');
  });

  it('follows a provided signal at runtime', () => {
    const sharing = signal(false);
    TestBed.configureTestingModule({ providers: [provideSvSensitivePrivacy(sharing)] });
    const fixture = TestBed.createComponent(PrivacyProbeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('false');
    sharing.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('true');
  });

  it('accepts a fixed boolean, defaulting to true', () => {
    TestBed.configureTestingModule({ providers: [provideSvSensitivePrivacy()] });
    expect(TestBed.inject(SV_SENSITIVE_PRIVACY)()).toBe(true);
  });
});
