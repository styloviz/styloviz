import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * `FI-09-M3` — every way INTO a date has to consult `dateDisabled`.
 *
 * The rule reached the grid's cells and nothing else. Three paths still read
 * only `[minDate, maxDate]`:
 *
 * - the Today button wrote a date the grid above it rendered as disabled;
 * - an arrow key onto a disabled day moved the roving tabindex to a disabled
 *   <button>, which cannot take focus — so focus fell to <body> and the grid's
 *   container stopped receiving keys (the defect clamping fixed for the window);
 * - opening the panel on a disabled today did the same before a key was pressed.
 */

const noWeekends = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

async function setup(inputs: Partial<ComponentInput<SvDatePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvDatePickerComponent, {
    inputs: { dateDisabled: noWeekends, ...inputs } as ComponentInput<SvDatePickerComponent>,
  });
}

type Fixture = { nativeElement: unknown; detectChanges(): void; componentInstance: SvDatePickerComponent };

const trigger = (f: Fixture) => (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sv-dp-trigger')!;
const panel = () => document.querySelector<HTMLElement>('.sv-dp-portal')!;
const day = (key: string) => panel().querySelector<HTMLButtonElement>(`[data-day="${key}"]`)!;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

async function open(f: Fixture) {
  await userEvent.click(trigger(f));
  f.detectChanges();
  await tick();
}

async function press(f: Fixture, keys: string) {
  await userEvent.keyboard(keys);
  f.detectChanges();
  await tick();
}

afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll('.sv-dp-portal').forEach((n) => n.remove());
  TestBed.resetTestingModule();
});

describe('SvDatePickerComponent — the disabled-date rule reaches every path', () => {
  it('skips a disabled weekend with ArrowRight and keeps real focus', async () => {
    const { fixture } = await setup({ value: '2024-03-15' }); // Friday
    const f = fixture as unknown as Fixture;
    await open(f);
    await press(f, '{ArrowRight}');

    expect(f.componentInstance.activeKey()).toBe('2024-03-18'); // Monday
    expect(document.activeElement).toBe(day('2024-03-18'));
  });

  it('skips backwards with ArrowLeft', async () => {
    const { fixture } = await setup({ value: '2024-03-18' }); // Monday
    const f = fixture as unknown as Fixture;
    await open(f);
    await press(f, '{ArrowLeft}');

    expect(f.componentInstance.activeKey()).toBe('2024-03-15');
    expect(document.activeElement).toBe(day('2024-03-15'));
  });

  it('stays put when nothing in that direction can be picked', async () => {
    const { fixture } = await setup({ value: '2024-03-15', maxDate: '2024-03-17' });
    const f = fixture as unknown as Fixture;
    await open(f);
    await press(f, '{ArrowRight}');

    expect(f.componentInstance.activeKey()).toBe('2024-03-15');
    expect(document.activeElement).toBe(day('2024-03-15'));
  });

  it('opens onto the nearest selectable day when today is disabled', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2024, 2, 16, 12)); // Saturday, local noon
    const { fixture } = await setup();
    const f = fixture as unknown as Fixture;
    await open(f);

    expect(f.componentInstance.activeKey()).toBe('2024-03-18');
    expect(day('2024-03-18').getAttribute('tabindex')).toBe('0');
  });

  it('disables the Today button when the rule forbids today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2024, 2, 16, 12)); // Saturday
    const { fixture } = await setup();
    const f = fixture as unknown as Fixture;
    expect(f.componentInstance.isTodayDisabled()).toBe(true);

    f.componentInstance.goToToday();
    expect(f.componentInstance.value()).toBe('');
  });

  it('leaves the Today button alone on an allowed day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2024, 2, 15, 12)); // Friday
    const { fixture } = await setup();
    expect((fixture as unknown as Fixture).componentInstance.isTodayDisabled()).toBe(false);
  });
});
