import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAddressCardComponent } from './address-card/address-card.component';
import type { Address } from './address-card/address-card.component';
import { SV_COMMERCE_LABELS } from './labels/commerce.labels';
import { SvFileDisplayComponent } from './file-display/file-display.component';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
const ADDRESS: Address = {
  id: 'a1',
  label: 'Home',
  firstName: 'Sazzad',
  lastName: 'Hossain',
  line1: '12 Bishop Street',
  city: 'Dhaka',
  state: 'Dhaka',
  postalCode: '1207',
  country: 'Bangladesh',
};

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvAddressCardComponent, {
    inputs: { address: ADDRESS },
    providers: providers as never[],
  });
}

describe('SvAddressCardComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_COMMERCE_LABELS.editAddress }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ commerce: { editAddress: 'Adresse bearbeiten' } })]);
    expect(screen.getAllByRole('button', { name: 'Adresse bearbeiten' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Edit address' })).toBeNull();
  });
});

describe('SvFileDisplayComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvFileDisplayComponent, {
      inputs: { fileName: 'report.pdf', mimeType: 'application/pdf' },
      providers: [provideSvLabels({ commerce: { removeFile: '{name} entfernen' } })],
    });
    expect(screen.getByRole('button', { name: 'report.pdf entfernen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove report.pdf' })).toBeNull();
  });
});

describe('SvAddressCardComponent — visible text (FL-B1d)', () => {
  it('renders the default badge in the word an app provides', async () => {
    TestBed.resetTestingModule();
    const { container } = await render(SvAddressCardComponent, {
      inputs: { address: { ...ADDRESS, isDefault: true } },
      providers: [provideSvLabels({ commerce: { defaultBadge: 'Standard' } })],
    });
    expect(container.textContent).toContain('Standard');
    expect(container.textContent).not.toContain(SV_COMMERCE_LABELS.defaultBadge);
  });
});

describe('SvFileDisplayComponent — text built in TypeScript (FL-B1e)', () => {
  it('renders the scan state an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvFileDisplayComponent, {
      inputs: { fileName: 'quarterly-report.pdf', fileSize: 2_400_000, mimeType: 'application/pdf' },
      providers: [provideSvLabels({ commerce: { scanUnscanned: 'Nicht auf Bedrohungen geprüft' } })],
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Nicht auf Bedrohungen geprüft');
    expect(text).not.toContain(SV_COMMERCE_LABELS.scanUnscanned);
  });
});
