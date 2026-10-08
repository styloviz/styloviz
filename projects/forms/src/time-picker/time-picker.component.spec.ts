import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { SvTimePickerComponent } from './time-picker.component';

/**
 * The panel is portalled into `<body>`, which is the source of most of what is
 * worth testing here: nothing inside it is reachable from the component's own
 * element, so anything bound to the host — a key listener, a query — silently
 * covers only the closed state.
 *
 * The rest is the two facts the columns have to agree on: which half of the
 * clock the value is in, and which cells the `[min, max]` window leaves
 * reachable. Both used to be nobody's job.
 */

async function setup(inputs: Partial<ComponentInput<SvTimePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvTimePickerComponent, {
    inputs: inputs as ComponentInput<SvTimePickerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('[data-trigger]')!;
const panel = () => document.querySelector<HTMLElement>('.sv-tp-portal');
const col = (name: string) => panel()!.querySelector<HTMLElement>(`[data-col="${name}"]`)!;
const cells = (name: string) => [...col(name).querySelectorAll('button')];
const cell = (name: string, text: string) =>
  cells(name).find((b) => b.textContent?.trim() === text)!;

async function open(f: { nativeElement: unknown; detectChanges(): void }) {
  await userEvent.click(trigger(f));
  f.detectChanges();
}

afterEach(() => vi.useRealTimers());

describe('SvTimePickerComponent — the trigger', () => {
  it('shows the value on a 12-hour clock', async () => {
    const { fixture } = await setup({ value: '14:05' });
    expect(fixture.componentInstance.displayValue()).toBe('02:05 PM');
    expect(trigger(fixture).textContent).toContain('02:05 PM');
  });

  it('shows the value on a 24-hour clock', async () => {
    const { fixture } = await setup({ value: '14:05', format: '24h' });
    expect(fixture.componentInstance.displayValue()).toBe('14:05');
  });

  it('shows seconds when it carries them', async () => {
    const { fixture } = await setup({ value: '14:05:09', format: '24h', withSeconds: true });
    expect(fixture.componentInstance.displayValue()).toBe('14:05:09');
  });

  it('is named by its label, and by its value', async () => {
    const { fixture } = await setup({ value: '09:30', label: 'Start' });
    expect(trigger(fixture).getAttribute('aria-label')).toBe('Start: 09:30');
  });

  it('does not point at a label it never rendered', async () => {
    // An `aria-labelledby` naming a missing element leaves the control's name up
    // to the AT's error handling.
    const { fixture } = await setup({ value: '09:30' });
    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
  });

  it('is named by the computed label, not by the visible label span', async () => {
    // ★ `aria-labelledby` OUTRANKS `aria-label`, so pointing at the span
    // discarded the computed name — and the computed one is strictly better: it
    // carries the field name AND the current value where the span carries only
    // the field name. This used to assert the opposite; the assertion was
    // pinning the bug. Gated by `aria-label-outranked`.
    const { fixture } = await setup({ value: '09:30', label: 'Start' });
    expect(trigger(fixture).getAttribute('aria-labelledby')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-label')).toContain('Start');
  });
});

describe('SvTimePickerComponent — opening and closing', () => {
  it('mounts the panel outside its own element', async () => {
    const { fixture } = await setup({ value: '09:00' });
    expect(panel()).toBeNull();

    await open(fixture);
    expect(panel()).not.toBeNull();
    expect(el(fixture).contains(panel())).toBe(false);
    expect(trigger(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape pressed inside the panel', async () => {
    // The listener has to be on the document: a key pressed in the portal never
    // bubbles through this component's element, so a host-bound handler could
    // only ever fire while the panel was already shut.
    const { fixture } = await setup({ value: '09:00' });
    await open(fixture);

    cell('minutes', '30').focus();
    await userEvent.keyboard('{Escape}');
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('closes on a click outside it', async () => {
    const { fixture } = await setup({ value: '09:00' });
    await open(fixture);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('stays open for a click inside it', async () => {
    const { fixture } = await setup({ value: '09:00' });
    await open(fixture);

    cell('minutes', '30').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).not.toBeNull();
  });

  it('refuses to open while disabled', async () => {
    const { fixture } = await setup({ value: '09:00', disabled: true });
    await open(fixture);
    expect(panel()).toBeNull();
  });

  it('takes the panel down with it', async () => {
    const { fixture } = await setup({ value: '09:00' });
    await open(fixture);
    fixture.destroy();
    expect(panel()).toBeNull();
  });
});

describe('SvTimePickerComponent — AM and PM follow the value', () => {
  it('shows PM for an afternoon value it was handed', async () => {
    // As a separate signal this read AM until someone pressed a period button —
    // the hour column highlighted 02 while the period column highlighted AM.
    const { fixture } = await setup({ value: '14:00' });
    expect(fixture.componentInstance.period()).toBe('PM');

    await open(fixture);
    expect(cell('period', 'PM').className).toContain('bg-primary-600');
    expect(cell('period', 'AM').className).not.toContain('bg-primary-600');
  });

  it('keeps an afternoon value afternoon when an hour is picked', async () => {
    const { fixture } = await setup({ value: '14:00' });
    await open(fixture);

    await userEvent.click(cell('hours', '03'));
    expect(fixture.componentInstance.value()).toBe('15:00');
  });

  it('moves the value across the clock when the period changes', async () => {
    const { fixture } = await setup({ value: '09:15' });
    await open(fixture);

    await userEvent.click(cell('period', 'PM'));
    expect(fixture.componentInstance.value()).toBe('21:15');
    expect(fixture.componentInstance.period()).toBe('PM');

    await userEvent.click(cell('period', 'AM'));
    expect(fixture.componentInstance.value()).toBe('09:15');
  });

  it('maps 12 AM to midnight and 12 PM to noon', async () => {
    const { fixture } = await setup({ value: '09:00' });
    await open(fixture);
    await userEvent.click(cell('hours', '12'));
    expect(fixture.componentInstance.value()).toBe('00:00');

    await userEvent.click(cell('period', 'PM'));
    expect(fixture.componentInstance.value()).toBe('12:00');
  });

  it('marks the hour that matches the value, on either clock', async () => {
    const { fixture } = await setup({ value: '14:00' });
    expect(fixture.componentInstance.isActiveHour('02')).toBe(true);
    expect(fixture.componentInstance.isActiveHour('14')).toBe(false);

    const { fixture: h24 } = await setup({ value: '14:00', format: '24h' });
    expect(h24.componentInstance.isActiveHour('14')).toBe(true);
  });
});

describe('SvTimePickerComponent — selecting', () => {
  it('reports a minute change once', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));
    await open(fixture);

    await userEvent.click(cell('minutes', '45'));
    expect(fixture.componentInstance.value()).toBe('09:45');
    expect(seen).toEqual(['09:45']);
  });

  it('carries seconds through every change once it has them', async () => {
    const { fixture } = await setup({ value: '09:00:00', format: '24h', withSeconds: true });
    await open(fixture);

    await userEvent.click(cell('seconds', '30'));
    expect(fixture.componentInstance.value()).toBe('09:00:30');

    await userEvent.click(cell('minutes', '05'));
    expect(fixture.componentInstance.value()).toBe('09:05:30');
  });

  it('drops the AM/PM column when there is a seconds column', async () => {
    const { fixture } = await setup({ value: '09:00:00', withSeconds: true });
    await open(fixture);
    expect(panel()!.querySelector('[data-col="period"]')).toBeNull();
    expect(panel()!.querySelector('[data-col="seconds"]')).not.toBeNull();
  });

  it('builds a real time from an empty starting value', async () => {
    // An empty value splits to [''] — present, so a `??` fallback never fired,
    // and the first selection produced ':30'.
    const { fixture } = await setup({ value: '', format: '24h' });
    expect(fixture.componentInstance.displayValue()).toBe('');

    fixture.componentInstance.selectMinute('30');
    expect(fixture.componentInstance.value()).toBe('09:30');
  });

  it('sets the clock to now', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 3, 14, 37, 12));

    const { fixture } = await setup({ value: '09:00', format: '24h' });
    fixture.componentInstance.now();
    expect(fixture.componentInstance.value()).toBe('14:37');
    expect(fixture.componentInstance.period()).toBe('PM');
  });
});

describe('SvTimePickerComponent — the [min, max] window', () => {
  it('leaves everything reachable when no bounds are set', async () => {
    const { fixture } = await setup({ value: '09:00', format: '24h' });
    await open(fixture);
    expect(cells('hours').some((b) => b.disabled)).toBe(false);
    expect(cells('minutes').some((b) => b.disabled)).toBe(false);
  });

  it('disables the hours below min and above max', async () => {
    // These inputs were published in the API docs and read by nothing at all:
    // setting them changed no cell and refused no selection.
    const { fixture } = await setup({ value: '10:00', format: '24h', min: '09:30', max: '17:00' });
    await open(fixture);

    expect(cell('hours', '08').disabled).toBe(true);
    expect(cell('hours', '09').disabled).toBe(false); // 09:30–09:59 is reachable
    expect(cell('hours', '17').disabled).toBe(false); // 17:00 exactly
    expect(cell('hours', '18').disabled).toBe(true);
  });

  it('disables the minutes that fall outside the window within the chosen hour', async () => {
    const { fixture } = await setup({ value: '09:00', format: '24h', min: '09:30' });
    await open(fixture);

    expect(cell('minutes', '29').disabled).toBe(true);
    expect(cell('minutes', '30').disabled).toBe(false);
  });

  it('refuses a selection outside the window even if it is asked for directly', async () => {
    const { fixture } = await setup({ value: '09:45', format: '24h', min: '09:30', max: '17:00' });

    // 08:45 is below the floor and 18:45 is above the ceiling.
    fixture.componentInstance.selectHour('08');
    expect(fixture.componentInstance.value()).toBe('09:45');
    fixture.componentInstance.selectHour('18');
    expect(fixture.componentInstance.value()).toBe('09:45');

    // 09:15 is inside the 09 hour but below the floor within it.
    fixture.componentInstance.selectMinute('15');
    expect(fixture.componentInstance.value()).toBe('09:45');
  });

  it('pulls a change into the window rather than emitting outside it', async () => {
    // 09:00 is below the 09:30 floor, so picking the 09 hour lands on the floor.
    const seen: string[] = [];
    const { fixture } = await setup({ value: '11:00', format: '24h', min: '09:30' });
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));

    fixture.componentInstance.selectHour('09');
    expect(seen).toEqual(['09:30']);
  });

  it('pulls Now into the window when the real time is outside it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 3, 22, 10, 0));

    const { fixture } = await setup({ value: '10:00', format: '24h', min: '09:00', max: '17:00' });
    fixture.componentInstance.now();
    expect(fixture.componentInstance.value()).toBe('17:00');
  });

  it('disables a whole half of the clock when nothing in it is reachable', async () => {
    const { fixture } = await setup({ value: '14:00', min: '13:00' });
    await open(fixture);
    expect(cell('period', 'AM').disabled).toBe(true);
    expect(cell('period', 'PM').disabled).toBe(false);
  });

  it('refuses a period change that would leave the window', async () => {
    const { fixture } = await setup({ value: '14:00', min: '13:00' });
    fixture.componentInstance.togglePeriod('AM');
    expect(fixture.componentInstance.value()).toBe('14:00');
    expect(fixture.componentInstance.period()).toBe('PM');
  });

  it('treats a malformed bound as no bound rather than as midnight', async () => {
    const { fixture } = await setup({ value: '09:00', format: '24h', min: 'half past nine' });
    await open(fixture);
    expect(cells('hours').some((b) => b.disabled)).toBe(false);
  });
});

describe('SvTimePickerComponent — as a form control', () => {
  it('takes a value from a form and reports changes back', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ value: '09:00', format: '24h' });
    fixture.componentInstance.registerOnChange((v) => seen.push(v));
    fixture.componentInstance.writeValue('16:20');
    expect(fixture.componentInstance.value()).toBe('16:20');

    fixture.componentInstance.selectMinute('45');
    expect(seen).toEqual(['16:45']);
  });

  it('marks itself touched when the panel closes', async () => {
    let touched = false;
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.registerOnTouched(() => { touched = true; });
    await open(fixture);
    fixture.componentInstance.close();
    expect(touched).toBe(true);
  });

  it('takes disabled from the form as well as its own input', async () => {
    const { fixture } = await setup({ value: '09:00' });
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(trigger(fixture).disabled).toBe(true);
  });
});

describe('SvTimePickerComponent — the error slot', () => {
  it('renders a client-side message and points the trigger at it', async () => {
    const { fixture } = await setup({ value: '09:00', errorMessage: 'Pick a start time.' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Pick a start time.');
    expect(trigger(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(trigger(fixture).getAttribute('aria-describedby')).toBe(alert.getAttribute('id'));
  });

  it('expires a server rejection once the time changes', async () => {
    const { fixture } = await setup({ value: '09:00', serverError: 'That slot is taken.' });
    expect(screen.getByRole('alert').textContent).toContain('That slot is taken.');

    fixture.componentInstance.selectMinute('30');
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says nothing when there is nothing wrong', async () => {
    const { fixture } = await setup({ value: '09:00' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(trigger(fixture).getAttribute('aria-invalid')).toBeNull();
  });
});
