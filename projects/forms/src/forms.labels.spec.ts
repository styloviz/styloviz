import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import userEvent from '@testing-library/user-event';
import { SvColorPickerComponent } from './color-picker/color-picker.component';
import { SV_FORMS_LABELS } from './forms.labels';
import { SvNumberInputComponent } from './number-input/number-input.component';
import { SvSliderComponent } from './slider/slider.component';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvColorPickerComponent, {
    inputs: {},
    providers: providers as never[],
  });
}

describe('SvColorPickerComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    const { fixture } = await setup();
    await userEvent.click(fixture.nativeElement.querySelector('[data-trigger]') as HTMLElement);
    fixture.detectChanges();
    expect(screen.getAllByRole('slider', { name: SV_FORMS_LABELS.hue }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    const { fixture } = await setup([provideSvLabels({ forms: { hue: 'Farbton' } })]);
    await userEvent.click(fixture.nativeElement.querySelector('[data-trigger]') as HTMLElement);
    fixture.detectChanges();
    expect(screen.getAllByRole('slider', { name: 'Farbton' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();
  });
});

describe('SvNumberInputComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvNumberInputComponent, {
      inputs: { value: 1, label: 'Menge' },
      providers: [provideSvLabels({ forms: { decreaseNamed: '{name} verringern' } })],
    });
    expect(screen.getByRole('button', { name: 'Menge verringern' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Decrease Menge' })).toBeNull();
  });
});

describe('SvColorPickerComponent — visible labels (FL-B1d)', () => {
  it('renders the panel headings an app provides', async () => {
    const { fixture } = await setup([provideSvLabels({ forms: { hexHeading: 'Hexwert' } })]);
    await userEvent.click(fixture.nativeElement.querySelector('[data-trigger]') as HTMLElement);
    fixture.detectChanges();
    expect(screen.getByText('Hexwert')).toBeTruthy();
    expect(screen.queryByText(SV_FORMS_LABELS.hexHeading)).toBeNull();
  });
});

describe('SvSliderComponent — names built in TypeScript (FL-B1e)', () => {
  it('names the range handles from the templates an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSliderComponent, {
      inputs: { range: true, label: 'Preis', rangeStart: 20, rangeEnd: 80 },
      providers: [provideSvLabels({ forms: { rangeMinimumNamed: '{name} (Untergrenze)', rangeMaximumNamed: '{name} (Obergrenze)' } })],
    });
    const [start, end] = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="range"]')];
    expect(start.getAttribute('aria-label')).toBe('Preis (Untergrenze)');
    expect(end.getAttribute('aria-label')).toBe('Preis (Obergrenze)');
  });
});

describe('SvColorPickerComponent — one-word UI text (FL-B1e wave 3)', () => {
  it('names the default swatches from the labels an app provides', async () => {
    const { fixture } = await setup([provideSvLabels({ forms: { swatchRed: 'Rot' } })]);
    await userEvent.click(fixture.nativeElement.querySelector('[data-trigger]') as HTMLElement);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Rot' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Red' })).toBeNull();
  });
});

describe('SvColorPickerComponent — glued sentences become labels (FL-B1e wave 4)', () => {
  it('names the trigger from the template an app provides', async () => {
    const { fixture } = await setup([provideSvLabels({ forms: { colorPickerTriggerNameDefault: 'Farbe wählen: {color}, {value}' } })]);
    const name = (fixture.componentInstance as SvColorPickerComponent).triggerAriaLabel();
    expect(name.startsWith('Farbe wählen: ')).toBe(true);
    expect(name).not.toContain('Pick colour');
  });
});
