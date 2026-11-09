import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SV_LOCALE } from '@styloviz/core/i18n';
import { SvFileDisplayComponent, svFormatBytes } from './file-display.component';

/**
 * FL-J3-DD-19 — a long name discloses itself in full and keeps its extension on
 * screen. FL-J3-DD-37 — sizes are written in the reader's locale.
 */
async function setup(inputs: Record<string, unknown>, locale?: string) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvFileDisplayComponent, {
    inputs,
    providers: locale ? [{ provide: SV_LOCALE, useValue: locale }] : [],
  });
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}
const nameLine = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-sv-file-name]')!;

describe('SvFileDisplayComponent — long names (DD-12-I5 / M5)', () => {
  const LONG = 'quarterly-board-report-final-final-v3-approved.pdf';

  it.each(['card', 'row', 'compact'])('%s: discloses the full name in a tooltip', async (variant) => {
    const { el } = await setup({ fileName: LONG, variant });
    expect(nameLine(el).getAttribute('title')).toBe(LONG);
    expect(nameLine(el).textContent).toBe(LONG); // whole in the accessibility tree
  });

  it.each(['card', 'row', 'compact'])('%s: truncates only the stem, never the extension', async (variant) => {
    const { el } = await setup({ fileName: LONG, variant });
    const [stem, ext] = [...nameLine(el).querySelectorAll('span')];
    expect(stem.textContent).toBe('quarterly-board-report-final-final-v3-approved');
    expect(stem.className).toContain('truncate');
    expect(ext.textContent).toBe('.pdf');
    expect(ext.className).toContain('shrink-0');
    expect(ext.className).not.toContain('truncate');
  });

  it.each([
    ['archive.tar.gz', 'archive.tar', '.gz'],
    ['Makefile', 'Makefile', ''],
    ['.env', '.env', ''],
    ['trailing.', 'trailing.', ''],
  ])('splits %s into %s + %s', async (name, stem, ext) => {
    const { fixture } = await setup({ fileName: name });
    expect(fixture.componentInstance.nameParts()).toEqual({ stem, ext });
  });
});

describe('svFormatBytes — locale-aware sizes (FL-J3-DD-37)', () => {
  it.each([
    ['en-US', 1536, '1.5 kB'],
    ['de-DE', 1536, '1,5 kB'],
    ['fr-FR', 12_845_056, '12,3 Mo'],
    ['en-US', 2_147_483_648, '2.0 GB'],
    ['de-DE', 512, '512 Byte'],
  ])('%s: %i → %s', (locale, bytes, expected) => {
    expect(svFormatBytes(bytes, locale).replace(/\u202f|\u00a0/g, ' ')).toBe(expected);
  });

  it('the component writes its size line in the kit locale', async () => {
    const { fixture } = await setup({ fileName: 'a.zip', fileSize: 1536 }, 'de-DE');
    expect(fixture.componentInstance.formattedSize().replace(/\u00a0/g, ' ')).toBe('1,5 kB');
  });
});
