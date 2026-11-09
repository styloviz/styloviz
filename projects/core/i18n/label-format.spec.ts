import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLocale } from './locale';
import { SvLabelPipe, svFormatLabel } from './label-format';

const MORE = '{count, plural, one {# more item} other {# more items}}';

describe('svFormatLabel', () => {
  it('fills named slots, so a translation can move them', () => {
    expect(svFormatLabel('Remove {name}', { name: 'Ada' })).toBe('Remove Ada');
    expect(svFormatLabel('{name} entfernen', { name: 'Ada' })).toBe('Ada entfernen');
    expect(svFormatLabel('{a} → {b}', { a: 'x', b: 'y' })).toBe('x → y');
  });

  it('pluralises a count that arrives already formatted, and prints it as given (FL-B2)', () => {
    const tpl = '{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}';
    expect(svFormatLabel(tpl, { n: '2' }, 'pl')).toBe('2 pliki');
    expect(svFormatLabel(tpl, { n: '1 234' }, 'pl')).toBe('1 234 pliki');
    expect(svFormatLabel('{n, plural, one {# row} other {# rows}}', { n: '1,000' }, 'en-US')).toBe('1,000 rows');
    expect(svFormatLabel('{n, plural, one {# row} other {# rows}}', { n: '1' }, 'en-US')).toBe('1 row');
  });

  it('formats a number in the locale', () => {
    expect(svFormatLabel('{n} rows', { n: 1234 }, 'en-US')).toBe('1,234 rows');
    expect(svFormatLabel('{n} Zeilen', { n: 1234 }, 'de-DE')).toBe('1.234 Zeilen');
  });

  it("chooses the plural form by the locale's own rule", () => {
    expect(svFormatLabel(MORE, { count: 1 }, 'en-US')).toBe('1 more item');
    expect(svFormatLabel(MORE, { count: 3 }, 'en-US')).toBe('3 more items');
    const PL = '{count, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}';
    expect(svFormatLabel(PL, { count: 1 }, 'pl-PL')).toBe('1 plik');
    expect(svFormatLabel(PL, { count: 3 }, 'pl-PL')).toBe('3 pliki');
    expect(svFormatLabel(PL, { count: 5 }, 'pl-PL')).toBe('5 plików');
    const AR = '{count, plural, zero {لا عناصر} one {عنصر} two {عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}';
    expect(svFormatLabel(AR, { count: 0 }, 'ar-EG')).toBe('لا عناصر');
    expect(svFormatLabel(AR, { count: 2 }, 'ar-EG')).toBe('عنصران');
  });

  it('prefers an exact =N match, and fills slots inside a branch', () => {
    const T = '{count, plural, =0 {No files for {who}} one {# file for {who}} other {# files for {who}}}';
    expect(svFormatLabel(T, { count: 0, who: 'Ada' }, 'en-US')).toBe('No files for Ada');
    expect(svFormatLabel(T, { count: 2, who: 'Ada' }, 'en-US')).toBe('2 files for Ada');
  });

  it('leaves a slot visible when its parameter is missing, and renders null as empty', () => {
    expect(svFormatLabel('Remove {name}', {})).toBe('Remove {name}');
    expect(svFormatLabel('Remove {name}', { name: null })).toBe('Remove ');
  });

  it('is plain text: a slot value is never parsed as markup or as another template', () => {
    expect(svFormatLabel('Remove {name}', { name: '<b>{other}</b>' })).toBe('Remove <b>{other}</b>');
  });
});

@Component({
  standalone: true,
  imports: [SvLabelPipe],
  template: `<span>{{ '{count, plural, one {# Datei} other {# Dateien}}' | svLabel: { count: 1234 } }}</span>`,
})
class HostComponent {}

describe('SvLabelPipe', () => {
  it("formats in the kit's locale", async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(HostComponent, { providers: [provideSvLocale('de-DE')] });
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('1.234 Dateien');
  });
});
