import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SV_LOCALE, SV_MACHINE_LOCALE, provideSvLocale, svFormatCount, svLocale, svMonthLabels } from './locale';

describe('SV_LOCALE', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it("is Angular's LOCALE_ID unless told otherwise", () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr-FR' }] });
    expect(TestBed.inject(SV_LOCALE)).toBe('fr-FR');
    expect(TestBed.runInInjectionContext(() => svLocale())).toBe('fr-FR');
  });

  it('is set for the kit alone by provideSvLocale, canonicalised', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }, provideSvLocale(' de-de ')] });
    expect(TestBed.inject(SV_LOCALE)).toBe('de-DE');
    expect(TestBed.inject(LOCALE_ID)).toBe('en-US');
  });

  it('refuses a tag that is not one, at bootstrap', () => {
    expect(() => provideSvLocale('not a locale')).toThrow(/BCP 47/);
    expect(() => provideSvLocale('')).toThrow();
  });

  it('keeps the machine locale fixed — it is parsed, not shown', () => {
    expect(SV_MACHINE_LOCALE).toBe('en-US');
  });
});

describe('svFormatCount', () => {
  it("groups by the locale's rule", () => {
    expect(svFormatCount(1234567, 'en-US')).toBe('1,234,567');
    expect(svFormatCount(1234567, 'de-DE')).toBe('1.234.567');
  });

  it('rounds, and "" means plain digits', () => {
    expect(svFormatCount(1234.6, '')).toBe('1235');
    expect(svFormatCount(Number.NaN, 'en-US')).toBe('');
  });
});

describe('svMonthLabels', () => {
  it('reads the names from Intl, January first', () => {
    expect(svMonthLabels('de-DE')[2]).toBe('März');
    expect(svMonthLabels('en-US', 'short')[0]).toBe('Jan');
    expect(svMonthLabels('fr-FR')).toHaveLength(12);
  });

  it('falls back to the machine locale for an invalid tag, never to nothing', () => {
    expect(svMonthLabels('!!')[0]).toBe('January');
  });
});
