import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  The calendar day the user sees must be the calendar day the host receives.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A date picker has exactly one job at the boundary: the cell labelled 15 must
 * emit `…-15`, and the string `…-15` must light the cell labelled 15. Every way
 * of getting that wrong looks identical at UTC, which is why the suite runs at
 * Pacific/Marquesas (−09:30) — negative, so `new Date('2026-03-15')` (UTC
 * midnight per ECMA-262) reads back as **14 March** through local getters;
 * fractional, so integral-hour assumptions break too; and DST-free, so the
 * offset is the same every day of the year.
 *
 * These tests are written so that swapping any `new Date(str + 'T00:00:00')` in
 * the component for a bare `new Date(str)`, or any `toDateStr()` for
 * `toISOString().slice(0, 10)`, fails them. Two are pinned as explicit
 * round-trips through the DOM rather than through the component API, because a
 * component can be self-consistently wrong.
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

/** Local YYYY-MM-DD — the same rule the component's own `toDateStr` uses. */
const local = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Positive west of UTC. `describe.skipIf` does not exist in Vitest 4, so the
 * gate is a ternary on `describe` itself.
 */
const WEST_OF_UTC = new Date().getTimezoneOffset() > 0;
const describeWest = WEST_OF_UTC ? describe : describe.skip;

describe('SvDatePickerComponent — the day on screen is the day emitted', () => {
  it('round-trips a value through the grid and back out unchanged', async () => {
    const { fixture } = await setup({ value: '2026-03-15' });
    await open(fixture);

    // In: the string lights the cell it names, and only that one.
    const selected = [...panel()!.querySelectorAll('[role="gridcell"][aria-selected="true"]')];
    expect(selected.length).toBe(1);
    const cell = selected[0].querySelector<HTMLButtonElement>('[data-day]')!;
    expect(cell.dataset['day']).toBe('2026-03-15');
    expect(cell.textContent?.trim()).toBe('15');
    expect(cell.getAttribute('aria-label')).toBe('March 15, 2026');
    expect(el(fixture).textContent).toContain('Mar 15, 2026');

    // Out: clicking the neighbouring cell emits the day that cell is labelled.
    const seen: string[] = [];
    fixture.componentInstance.value.subscribe((v) => seen.push(v));
    await userEvent.click(day('2026-03-16')!);
    fixture.detectChanges();
    expect(seen).toEqual(['2026-03-16']);
  });

  it('emits the first of the month from the cell labelled 1', async () => {
    // The 1st is where an off-by-one lands you in the previous month entirely.
    const { fixture } = await setup({ value: '2026-03-15' });
    await open(fixture);

    const first = [...panel()!.querySelectorAll<HTMLButtonElement>('[data-day^="2026-03-"]')]
      .find((b) => b.textContent?.trim() === '1')!;
    expect(first.dataset['day']).toBe('2026-03-01');

    await userEvent.click(first);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('2026-03-01');
    expect(el(fixture).textContent).toContain('Mar 1, 2026');
  });

  it('rings today, once, on the local calendar day', async () => {
    const { fixture } = await setup({});
    await open(fixture);

    const marked = [...panel()!.querySelectorAll<HTMLButtonElement>('[aria-current="date"]')];
    expect(marked.length).toBe(1);

    const now = new Date();
    expect(marked[0].dataset['day']).toBe(local(now));
    expect(marked[0].textContent?.trim()).toBe(String(now.getDate()));
  });

  it('produces a local YYYY-MM-DD, not a UTC one', async () => {
    const { fixture } = await setup({});
    const c = fixture.componentInstance;
    // Local midnight on 1 January is the previous YEAR at UTC west of it.
    expect(c.toDateStr(new Date(2026, 0, 1))).toBe('2026-01-01');
    // 23:30 local on 31 December is already 1 January somewhere; still local here.
    expect(c.toDateStr(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  });
});

describeWest('SvDatePickerComponent — west of UTC, where the bug would show', () => {
  it('is running somewhere a UTC-parsed date would be a day early', () => {
    // The premise of everything below. If this ever reads UTC the file is only
    // proving that the component agrees with itself.
    const naive = new Date('2026-03-15');       // UTC midnight per spec
    expect(naive.getDate()).toBe(14);           // …which is 14 March here
    expect(new Date('2026-03-15T00:00:00').getDate()).toBe(15);
  });

  it('does not read the bound value as UTC midnight', async () => {
    // `new Date('2026-03-15')` here is 14 March 14:30 local. A component that
    // parsed it that way would show "Mar 14" in the trigger and ring the 14th.
    const { fixture } = await setup({ value: '2026-03-15' });
    expect(fixture.componentInstance.displayValue()).toBe('Mar 15, 2026');

    await open(fixture);
    expect(day('2026-03-14')!.getAttribute('aria-selected')).toBeNull();
    expect(fixture.componentInstance.calendarDays().filter((d) => d.isSelected).map((d) => d.key))
      .toEqual(['2026-03-15']);
  });

  it('opens on the month the bound value is in, not the one before it', async () => {
    // 1 March parsed as UTC is 28 February here — which opens the wrong month.
    const { fixture } = await setup({ value: '2026-03-01' });
    await open(fixture);
    expect(fixture.componentInstance.headerLabel()).toBe('March 2026');
    expect(fixture.componentInstance.activeKey()).toBe('2026-03-01');
  });

  it('treats a min of today as reachable today, not as tomorrow', async () => {
    // `toISOString().slice(0,10)` west of UTC names TOMORROW's calendar day, so
    // "today" would fall below its own minimum and the Today button would go
    // dead on a picker whose window starts today.
    const today = local(new Date());
    const { fixture } = await setup({ minDate: today, maxDate: today });
    expect(fixture.componentInstance.isTodayDisabled()).toBe(false);

    await open(fixture);
    const todayBtn = [...panel()!.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Today') as HTMLButtonElement;
    expect(todayBtn.disabled).toBe(false);

    await userEvent.click(todayBtn);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(today);
  });
});

describe('SvDatePickerComponent — the window edges', () => {
  it('allows the day exactly at min and refuses the one before it', async () => {
    const { fixture } = await setup({ value: '2026-03-20', minDate: '2026-03-15' });
    await open(fixture);

    expect(day('2026-03-15')!.disabled).toBe(false);
    expect(day('2026-03-14')!.disabled).toBe(true);

    await userEvent.click(day('2026-03-15')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('2026-03-15');
  });

  it('allows the day exactly at max and refuses the one after it', async () => {
    const { fixture } = await setup({ value: '2026-03-10', maxDate: '2026-03-15' });
    await open(fixture);

    expect(day('2026-03-15')!.disabled).toBe(false);
    expect(day('2026-03-16')!.disabled).toBe(true);

    // The negative: a click on a disabled cell must leave the value alone.
    await userEvent.click(day('2026-03-16')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('2026-03-10');
  });

  it('opens a value that sits outside its own window on the nearest edge', async () => {
    // A host can perfectly well pass a stale value with a fresh min. Focus has
    // to land somewhere reachable or every arrow key thereafter goes nowhere.
    const { fixture } = await setup({ value: '2026-01-01', minDate: '2026-03-15' });
    await open(fixture);
    expect(fixture.componentInstance.activeKey()).toBe('2026-03-15');

    const above = await setup({ value: '2026-12-31', maxDate: '2026-03-15' });
    await open(above.fixture);
    expect(above.fixture.componentInstance.activeKey()).toBe('2026-03-15');
  });

  it('will not let the Today shortcut write a date the window forbids', async () => {
    // This was the one control in the panel that did not consult the window it
    // was standing in: it wrote a date the grid directly above it was rendering
    // as disabled, then closed, so nothing was left on screen to contradict it.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { fixture } = await setup({ minDate: local(tomorrow) });
    expect(fixture.componentInstance.isTodayDisabled()).toBe(true);

    await open(fixture);
    const todayBtn = [...panel()!.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Today') as HTMLButtonElement;
    expect(todayBtn.disabled).toBe(true);

    // The negative, asserted through the API as well as the disabled attribute:
    // calling it directly must still write nothing and leave the panel open.
    fixture.componentInstance.goToToday();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('');
    expect(panel()).not.toBeNull();
  });

  it('will not let Today write a date past a max either', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { fixture } = await setup({ maxDate: local(yesterday) });
    expect(fixture.componentInstance.isTodayDisabled()).toBe(true);
    fixture.componentInstance.goToToday();
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('leaves everything reachable when neither edge is set', async () => {
    const { fixture } = await setup({ value: '2026-03-15' });
    await open(fixture);
    expect(fixture.componentInstance.calendarDays().some((d) => d.isDisabled)).toBe(false);
  });
});

describe('SvDatePickerComponent — awkward months', () => {
  it('renders 29 February in a leap year and not in a common one', async () => {
    const leap = await setup({ value: '2024-02-15' });
    await open(leap.fixture);
    expect(day('2024-02-29')).not.toBeNull();
    expect(day('2024-02-29')!.textContent?.trim()).toBe('29');
    expect(day('2024-02-30')).toBeNull();

    const common = await setup({ value: '2023-02-15' });
    await open(common.fixture);
    expect(day('2023-02-29')).toBeNull();
    expect(day('2023-02-28')).not.toBeNull();
  });

  it('picks 29 February and hands it back intact', async () => {
    const { fixture } = await setup({ value: '2024-02-15' });
    await open(fixture);
    await userEvent.click(day('2024-02-29')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('2024-02-29');
    expect(fixture.componentInstance.displayValue()).toBe('Feb 29, 2024');
  });

  it('ends each month on its own last day', async () => {
    for (const [value, last] of [
      ['2024-01-10', '2024-01-31'],
      ['2024-02-10', '2024-02-29'],
      ['2024-04-10', '2024-04-30'],
      ['2024-12-10', '2024-12-31'],
    ] as const) {
      const { fixture } = await setup({ value });
      await open(fixture);
      const inMonth = fixture.componentInstance.calendarDays().filter((d) => d.isCurrentMonth);
      expect(inMonth.at(-1)!.key).toBe(last);
    }
  });

  it('always lays out six weeks of seven, starting on a Monday', async () => {
    // February 2021 began on a Monday and is exactly 28 days — the month most
    // likely to render five rows and shift every subsequent cell.
    for (const value of ['2021-02-10', '2024-03-10', '2024-09-10']) {
      const { fixture } = await setup({ value });
      await open(fixture);
      const weeks = fixture.componentInstance.calendarWeeks();
      expect(weeks.length).toBe(6);
      expect(weeks.every((w) => w.length === 7)).toBe(true);
      // Monday-first: every row starts on a Monday (getDay() === 1).
      expect(weeks.map((w) => w[0].date.getDay())).toEqual([1, 1, 1, 1, 1, 1]);
    }
  });

  it('marks the leading and trailing cells as not belonging to this month', async () => {
    const { fixture } = await setup({ value: '2024-03-15' });
    await open(fixture);
    const days = fixture.componentInstance.calendarDays();
    expect(days[0].isCurrentMonth).toBe(false);
    expect(days[0].key).toBe('2024-02-26');
    expect(days.filter((d) => d.isCurrentMonth).length).toBe(31);
  });
});
