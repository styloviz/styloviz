import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvTagInputComponent } from './tag-input.component';
import { SV_TAG_INPUT_LABELS } from './tag-input-free.labels';

const OPTIONS = [
  { value: 'ng', label: 'Angular' },
  { value: 'react', label: 'React' },
];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvTagInputComponent, {
    inputs: { options: OPTIONS, values: ['ng', 'react'] },
    providers: providers as never[],
  });
}

describe('SvTagInputComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_TAG_INPUT_LABELS.clearAll }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ tagInput: { clearAll: 'Alle entfernen' } })]);
    expect(screen.getAllByRole('button', { name: 'Alle entfernen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });
});

describe('SvTagInputComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    await setup([provideSvLabels({ tagInput: { removeTag: '{name} entfernen' } })]);
    expect(screen.getAllByRole('button', { name: 'Angular entfernen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Remove Angular' })).toBeNull();
  });
});

describe('SvTagInputComponent — visible text (FL-B1d)', () => {
  it('uses the placeholder an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvTagInputComponent, {
      inputs: { options: OPTIONS, values: [] },
      providers: [provideSvLabels({ tagInput: { placeholder: 'Tags hinzufügen…' } })],
    });
    expect(screen.getByPlaceholderText('Tags hinzufügen…')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Add tags…')).toBeNull();
  });
});
