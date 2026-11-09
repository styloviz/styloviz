import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvBarcode1dComponent } from './barcode-1d.component';
import { SV_BARCODE_1D_LABELS } from './barcode-1d.labels';

/** FL-B1d: the inspect report is the package's English until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvBarcode1dComponent, {
    inputs: { value: 'HELLO', variant: 'inspect' },
    providers: providers as never[],
  });
  view.fixture.detectChanges();
  return view;
}

const text = (sel: string) => document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SvBarcode1dComponent — visible text (FL-B1d)', () => {
  it('names the report rows in English by default', async () => {
    await setup();
    expect(screen.getByText(SV_BARCODE_1D_LABELS.onPaper)).toBeTruthy();
    expect(text('[data-sv-inspect-modules]')).toMatch(/^\d+ \+ \d+\/\d+ quiet$/);
  });

  it('renders the labels an app provides, slots filled', async () => {
    await setup([provideSvLabels({ barcode1d: { onPaper: 'auf Papier', modulesValue: '{count} + {left}/{right} Ruhezone' } })]);
    expect(screen.getByText('auf Papier')).toBeTruthy();
    expect(screen.queryByText('on paper')).toBeNull();
    expect(text('[data-sv-inspect-modules]')).toMatch(/^\d+ \+ \d+\/\d+ Ruhezone$/);
  });

  it('builds the refusal reason from the labels an app provides (FL-B1e)', async () => {
    TestBed.resetTestingModule();
    const view = await render(SvBarcode1dComponent, {
      inputs: { value: '123', symbology: 'ean13' },
      providers: [
        provideSvLabels({ barcode1d: { wrongLength: '{name} braucht {want} Ziffern (oder {withCheck} mit Prüfziffer); hier sind es {actual}.' } }),
      ],
    });
    view.fixture.detectChanges();
    expect(text('[data-sv-refused]')).toContain('EAN-13 braucht 12 Ziffern (oder 13 mit Prüfziffer); hier sind es 3.');
  });

  it('names the symbol with the template an app provides (FL-B1e wave 4)', async () => {
    TestBed.resetTestingModule();
    const view = await render(SvBarcode1dComponent, {
      inputs: { value: 'SKU-4821', symbology: 'code128' },
      providers: [provideSvLabels({ barcode1d: { barcodeName: 'Strichcode ({name}): {text}' } })],
    });
    view.fixture.detectChanges();
    const svg = (view.fixture.nativeElement as HTMLElement).querySelector('[data-sv-svg]');
    expect(svg?.getAttribute('aria-label')).toBe('Strichcode (Code 128): SKU-4821');
  });
});
