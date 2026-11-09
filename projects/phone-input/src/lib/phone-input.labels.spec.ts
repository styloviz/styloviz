import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { untilRendered } from '@testing/async';
import { SvPhoneInputComponent } from './phone-input.component';
import { SV_PHONE_INPUT_LABELS } from './phone-input.labels';

async function openList(fixture: { detectChanges(): void }): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /^\s*Phone number:/ }));
  await untilRendered(fixture, () => screen.queryByRole('listbox') !== null);
}

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvPhoneInputComponent, {
    inputs: {},
    providers: providers as never[],
  });
}

describe('SvPhoneInputComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    const { fixture } = await setup();
    await openList(fixture);
    expect(screen.getAllByRole('listbox', { name: SV_PHONE_INPUT_LABELS.country }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    const { fixture } = await setup([provideSvLabels({ phoneInput: { country: 'Land' } })]);
    await openList(fixture);
    expect(screen.getAllByRole('listbox', { name: 'Land' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('listbox', { name: 'Country' })).toBeNull();
  });
});

describe('SvPhoneInputComponent — visible text (FL-B1d)', () => {
  it('renders the extension label an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvPhoneInputComponent, {
      inputs: { showExtension: true },
      providers: [provideSvLabels({ phoneInput: { extension: 'Durchwahl' } })],
    });
    expect(screen.getByText('Durchwahl')).toBeTruthy();
    expect(screen.queryByText('Extension')).toBeNull();
  });
});

describe('SvPhoneInputComponent — text built in TypeScript (FL-B1e)', () => {
  it('names the country picker with the template an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvPhoneInputComponent, {
      inputs: {},
      providers: [provideSvLabels({ phoneInput: { phoneNumber: 'Telefonnummer', pickerName: '{label} – {country} ({dialCode})' } })],
    });
    expect(screen.getByRole('button', { name: /^\s*Telefonnummer – .+ \(\+\d+\)/ })).toBeTruthy();
  });
});
