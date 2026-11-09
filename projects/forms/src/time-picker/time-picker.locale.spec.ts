import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svDayPeriods } from '@styloviz/core/i18n';
import { SvTimePickerComponent } from './time-picker.component';

/**
 * `FL-J3-FI-06` — the time picker speaks the locale's day periods (`FI-28-I3`,
 * `FI-28-M4`) and offers minutes on a step (`FI-28-M3`).
 */
afterEach(() => {
  TestBed.resetTestingModule();
  document.querySelectorAll('.sv-tp-portal').forEach((n) => n.remove());
});

async function open(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTimePickerComponent, { inputs });
  fixture.componentInstance.toggle();
  fixture.detectChanges();
  const portal = document.querySelector<HTMLElement>('.sv-tp-portal')!;
  return { fixture, c: fixture.componentInstance, portal };
}

describe('sv-time-picker — locale day periods', () => {
  it('renders the locale’s own markers on the period buttons, not literal AM/PM', async () => {
    const { portal } = await open({ value: '14:30', locale: 'ja' });
    const buttons = [...portal.querySelectorAll<HTMLButtonElement>('[data-col="period"] button')];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['午前', '午後']);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('writes the period where the locale writes it — first in Japanese, last in English', async () => {
    const ja = await open({ value: '14:30', locale: 'ja' });
    expect(ja.c.displayValue()).toBe('午後 02:30');
    const en = await open({ value: '14:30', locale: 'en-US' });
    expect(en.c.displayValue()).toBe('02:30 PM');
  });

  it('defaults to the kit locale and follows a changed locale', async () => {
    const { fixture, c } = await open({ value: '09:15' });
    expect(c.locale()).toBeTruthy();
    fixture.componentRef.setInput('locale', 'es');
    fixture.detectChanges();
    expect(c.displayValue()).toBe(`09:15 ${svDayPeriods('es').am}`);
  });

  it('parses back what it displays — a typed 午後 3:05 commits 15:05', async () => {
    const { c } = await open({ value: '09:00', locale: 'ja' });
    c.draft.set('午後 3:05');
    expect(c.commitTyped()).toBe(true);
    expect(c.value()).toBe('15:05');
  });

  it('localises the typed-entry example', async () => {
    const ja = await open({ value: '09:00', locale: 'ja' });
    expect(ja.c.typedHint()).toBe('e.g. 午後 2:30');
    const h24 = await open({ value: '09:00', format: '24h' });
    expect(h24.c.typedHint()).toBe('e.g. 14:30');
  });
});

describe('sv-time-picker — minuteStep', () => {
  it('offers only the minutes on the step', async () => {
    const { portal } = await open({ value: '09:00', minuteStep: 15 });
    const cells = [...portal.querySelectorAll<HTMLElement>('[data-col="minutes"] [data-cell]')].map((b) => b.dataset['cell']);
    expect(cells).toEqual(['00', '15', '30', '45']);
  });

  it('treats a step that is not a whole number 1–59 as 1', async () => {
    for (const minuteStep of [0, -5, 7.5, 60]) {
      const { c } = await open({ value: '09:00', minuteStep });
      expect(c.visibleMinutes().length).toBe(60);
    }
  });

  it('snaps a typed minute down to the step', async () => {
    const { c } = await open({ value: '09:00', minuteStep: 15, format: '24h' });
    c.draft.set('10:52');
    c.commitTyped();
    expect(c.value()).toBe('10:45');
  });

  it('keeps a tab stop in the column when the value is off the step', async () => {
    const { portal } = await open({ value: '09:07', minuteStep: 15 });
    const stops = [...portal.querySelectorAll<HTMLElement>('[data-col="minutes"] [tabindex="0"]')];
    expect(stops.map((s) => s.dataset['cell'])).toEqual(['00']);
  });

  it('moves by the step with the arrow keys', async () => {
    const { c, portal } = await open({ value: '09:15', minuteStep: 15, format: '24h' });
    const cell = portal.querySelector<HTMLElement>('[data-col="minutes"] [data-cell="15"]')!;
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(c.value()).toBe('09:30');
  });
});
