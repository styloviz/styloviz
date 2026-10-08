import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { until } from '../../../../src/testing/async';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * Keyboard navigation of the day grid.
 *
 * The grid's keydown handler lives on the CONTAINER and the roving tabindex
 * lives on the day buttons, so every one of these keys has to do three things
 * at once: move the caret, pull the calendar to the month the caret landed in,
 * and move real DOM focus. A key that moves the model but not the focus strands
 * the user — the container stops receiving keys and there is no way out of the
 * panel without a mouse.
 */

async function setup(inputs: Partial<ComponentInput<SvDatePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvDatePickerComponent, {
    inputs: inputs as ComponentInput<SvDatePickerComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const trigger = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLButtonElement>('.sv-dp-trigger')!;
const panel = () => document.querySelector<HTMLElement>('.sv-dp-portal');
const day = (key: string) => panel()!.querySelector<HTMLButtonElement>(`[data-day="${key}"]`);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Fixture = { nativeElement: unknown; detectChanges(): void };

async function open(f: Fixture) {
  await userEvent.click(trigger(f));
  f.detectChanges();
  await tick();
}

/** Press a key on the focused day cell and let the deferred focus land. */
async function press(f: Fixture, keys: string) {
  await userEvent.keyboard(keys);
  f.detectChanges();
  await tick();
}

/** Friday. Home is Monday the 11th, End is Sunday the 17th. */
const MID = '2024-03-15';

describe('SvDatePickerComponent — arrows walk the grid', () => {
  const cases: { keys: string; from: string; to: string; why: string }[] = [
    { keys: '{ArrowLeft}',  from: MID, to: '2024-03-14', why: 'one day back' },
    { keys: '{ArrowRight}', from: MID, to: '2024-03-16', why: 'one day on' },
    { keys: '{ArrowUp}',    from: MID, to: '2024-03-08', why: 'one week back' },
    { keys: '{ArrowDown}',  from: MID, to: '2024-03-22', why: 'one week on' },
    { keys: '{Home}',       from: MID, to: '2024-03-11', why: 'to the Monday of this row' },
    { keys: '{End}',        from: MID, to: '2024-03-17', why: 'to the Sunday of this row' },
    { keys: '{PageUp}',     from: MID, to: '2024-02-15', why: 'back a month' },
    { keys: '{PageDown}',   from: MID, to: '2024-04-15', why: 'on a month' },
    { keys: '{Shift>}{PageUp}{/Shift}',   from: MID, to: '2023-03-15', why: 'back a year' },
    { keys: '{Shift>}{PageDown}{/Shift}', from: MID, to: '2025-03-15', why: 'on a year' },
  ];

  for (const { keys, from, to, why } of cases) {
    it(`${keys} moves ${why}`, async () => {
      const { fixture } = await setup({ value: from });
      await open(fixture);
      await press(fixture, keys);

      expect(fixture.componentInstance.activeKey()).toBe(to);
      // The month on show follows the caret, or the cell it names is not rendered.
      expect(day(to)).not.toBeNull();
      expect(document.activeElement).toBe(day(to));
    });
  }

  /**
   * ★ DEFECT (fixed): a month step off the end of a short month never left the
   * month it started in.
   *
   * `d.setMonth(d.getMonth() - 1)` on 31 March asks the platform for "31
   * February", which it normalises forward to 2 March. So PageUp on the 31st of
   * a long month moved the caret backwards by 29 days, left the calendar showing
   * the same month, and pressing it again did exactly the same thing — the user
   * could not page out of March from the 31st at all. The year step had the same
   * hole on 29 February. Both twins.
   */
  const monthEnds: { keys: string; from: string; to: string; why: string }[] = [
    { keys: '{PageUp}',   from: '2024-03-31', to: '2024-02-29', why: 'the 31st back into a leap February' },
    { keys: '{PageUp}',   from: '2024-05-31', to: '2024-04-30', why: 'the 31st back into a 30-day April' },
    { keys: '{PageDown}', from: '2024-01-31', to: '2024-02-29', why: 'the 31st on into a leap February' },
    { keys: '{PageDown}', from: '2024-05-31', to: '2024-06-30', why: 'the 31st on into a 30-day June' },
    { keys: '{Shift>}{PageUp}{/Shift}',   from: '2024-02-29', to: '2023-02-28', why: 'a leap day back into a common year' },
    { keys: '{Shift>}{PageDown}{/Shift}', from: '2024-02-29', to: '2025-02-28', why: 'a leap day on into a common year' },
  ];

  for (const { keys, from, to, why } of monthEnds) {
    it(`clamps ${why} rather than overflowing past it`, async () => {
      const { fixture } = await setup({ value: from });
      await open(fixture);
      await press(fixture, keys);

      expect(fixture.componentInstance.activeKey()).toBe(to);
      expect(day(to)).not.toBeNull();
      expect(document.activeElement).toBe(day(to));
    });
  }

  it('pages repeatedly off a month end instead of getting stuck', async () => {
    const { fixture } = await setup({ value: '2024-03-31' });
    await open(fixture);

    await press(fixture, '{PageUp}');
    expect(fixture.componentInstance.headerLabel()).toBe('February 2024');
    await press(fixture, '{PageUp}');
    expect(fixture.componentInstance.activeKey()).toBe('2024-01-29');
    expect(fixture.componentInstance.headerLabel()).toBe('January 2024');
  });

  it('leaves Home and End alone on a Monday and a Sunday respectively', async () => {
    const monday = await setup({ value: '2024-03-11' });
    await open(monday.fixture);
    await press(monday.fixture, '{Home}');
    expect(monday.fixture.componentInstance.activeKey()).toBe('2024-03-11');

    const sunday = await setup({ value: '2024-03-17' });
    await open(sunday.fixture);
    await press(sunday.fixture, '{End}');
    expect(sunday.fixture.componentInstance.activeKey()).toBe('2024-03-17');
  });

  it('pulls the calendar to the month the caret walked into', async () => {
    const { fixture } = await setup({ value: '2024-03-01' });
    await open(fixture);
    expect(fixture.componentInstance.headerLabel()).toBe('March 2024');

    await press(fixture, '{ArrowLeft}');
    expect(fixture.componentInstance.activeKey()).toBe('2024-02-29'); // 2024 is a leap year
    expect(fixture.componentInstance.headerLabel()).toBe('February 2024');
  });

  it('ignores a key it has no business with', async () => {
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    await press(fixture, 'a');
    expect(fixture.componentInstance.activeKey()).toBe(MID);
  });

  it('does nothing at all outside the day view', async () => {
    // The handler is bound to a container the month/year grids do not render,
    // but it is public and the guard is what keeps the two view modes from
    // fighting over the same keys.
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    fixture.componentInstance.viewMode.set('months');

    fixture.componentInstance.onDayKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(fixture.componentInstance.activeKey()).toBe(MID);
  });

  it('starts from today when neither a caret nor a value exists', async () => {
    const { fixture } = await setup({});
    await open(fixture);
    const c = fixture.componentInstance;
    c.activeKey.set('');

    c.onDayKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    const expected = new Date();
    expected.setDate(expected.getDate() + 1);
    expect(c.activeKey()).toBe(c.toDateStr(expected));
  });
});

describe('SvDatePickerComponent — committing from the keyboard', () => {
  for (const key of ['{Enter}', ' '] as const) {
    it(`picks the caret's day on ${key === ' ' ? 'Space' : 'Enter'}`, async () => {
      const { fixture } = await setup({ value: MID });
      await open(fixture);
      await press(fixture, '{ArrowRight}');
      await press(fixture, key);

      expect(fixture.componentInstance.value()).toBe('2024-03-16');
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(trigger(fixture));
    });
  }

  it('commits nothing when the caret points at no rendered cell', async () => {
    // `activeKey` is looked up in the 42 cells on show; a caret the grid does
    // not contain must be a no-op rather than an exception.
    const { fixture } = await setup({ value: MID });
    await open(fixture);
    fixture.componentInstance.activeKey.set('2099-01-01');

    fixture.componentInstance.onDayKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.value()).toBe(MID);
    expect(panel()).not.toBeNull();
  });

  it('refuses to commit a disabled day the caret is sitting on', async () => {
    const { fixture } = await setup({ value: MID, minDate: MID });
    await open(fixture);
    // Cells before min are rendered but disabled; point the caret at one.
    fixture.componentInstance.activeKey.set('2024-03-14');

    fixture.componentInstance.onDayKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.value()).toBe(MID);
    expect(panel()).not.toBeNull();
  });
});

describe('SvDatePickerComponent — the caret never walks out of the window', () => {
  it('clamps at min instead of stepping onto an unfocusable cell', async () => {
    // A disabled <button> cannot take focus, and the grid's keydown handler is
    // on the container — so a caret parked on a disabled cell leaves focus on
    // <body> and swallows every subsequent arrow key. The user is stranded in
    // the panel with no keyboard way out.
    const { fixture } = await setup({ value: MID, minDate: MID });
    await open(fixture);

    await press(fixture, '{ArrowLeft}');
    expect(fixture.componentInstance.activeKey()).toBe(MID);
    expect(document.activeElement).toBe(day(MID));

    await press(fixture, '{PageUp}');
    expect(fixture.componentInstance.activeKey()).toBe(MID);
  });

  it('clamps at max the same way', async () => {
    const { fixture } = await setup({ value: MID, maxDate: MID });
    await open(fixture);

    await press(fixture, '{ArrowRight}');
    expect(fixture.componentInstance.activeKey()).toBe(MID);

    await press(fixture, '{PageDown}');
    expect(fixture.componentInstance.activeKey()).toBe(MID);
    expect(document.activeElement).toBe(day(MID));
  });

  it('opens the caret on a reachable day when the whole window is in the future', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 40);
    const min = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;

    const { fixture } = await setup({ minDate: min });
    await open(fixture);
    await until(() => document.activeElement === day(min), {
      label: 'focus to land on the first reachable day',
    });
    expect(fixture.componentInstance.activeKey()).toBe(min);
    expect(day(min)!.disabled).toBe(false);
  });
});
