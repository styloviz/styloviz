import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvDatePickerComponent } from './date-picker.component';
import { SvInputFieldComponent } from './input-field.component';
import { SV_INPUT_FIELD_LABELS } from './input-field-free.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvInputFieldComponent, {
    inputs: { type: 'password', value: 'hunter2' },
    providers: providers as never[],
  });
}

describe('SvInputFieldComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_INPUT_FIELD_LABELS.showPassword }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ inputField: { showPassword: 'Passwort anzeigen' } })]);
    expect(screen.getAllByRole('button', { name: 'Passwort anzeigen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull();
  });
});

describe('SvDatePickerComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDatePickerComponent, {
      // `''` keeps the English month names, so the slot's value is predictable.
      inputs: { locale: '', value: '2024-03-15' } as ComponentInput<SvDatePickerComponent>,
      providers: [provideSvLabels({ inputField: { switchViewFrom: '{view} — Ansicht wechseln' } })],
    });
    await userEvent.click((fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sv-dp-trigger')!);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'March 2024 — Ansicht wechseln' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Switch view, currently March 2024' })).toBeNull();
  });
});

describe('SvDatePickerComponent — visible labels (FL-B1d)', () => {
  it('renders the calendar footer buttons an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDatePickerComponent, {
      inputs: { locale: '', value: '2024-03-15' } as ComponentInput<SvDatePickerComponent>,
      providers: [provideSvLabels({ inputField: { todayButton: 'Heute', clearButton: 'Leeren' } })],
    });
    await userEvent.click((fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sv-dp-trigger')!);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Heute' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leeren' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
  });
});
