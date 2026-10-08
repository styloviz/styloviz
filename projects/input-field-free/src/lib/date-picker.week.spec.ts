import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * ============================================================================
 *  Week start and the disabled-date rule  ·  `FI-09-M2` / `FI-09-M3`
 * ============================================================================
 *
 * ⚠️ THE TWIN OF `projects/input-field/src/lib/date-picker.week.spec.ts`, KEPT
 *    AS A COPY RATHER THAN A SHARED HELPER. The two calendars are separate
 *    implementations by design (free / Pro), and the whole point of this pair is
 *    that a fix applied to one and not the other is caught — which a shared
 *    suite parameterised over both components would still catch, but a shared
 *    HELPER that reaches into one of them would not. `check:parity` is the gate
 *    that keeps the two files in step.
 *
 * ★★★ THE CALENDAR STARTED ON MONDAY, FOR EVERYONE, AND A WEEK-START BUG IS
 *     NOT COSMETIC. A calendar is read by COLUMN POSITION before it is read by
 *     number — that is what the grid is for — so a Sunday-first reader looking
 *     at a Monday-first grid picks the wrong date, confidently, and the
 *     component reports exactly what they clicked. Nothing is inconsistent; the
 *     user is simply wrong about which day they chose.
 *
 *     Measured: `en-US` Sunday, `en-GB` Monday, `ar-EG` Saturday. Three answers
 *     in six locales, so there was no majority to default to either.
 *
 * ★★★ AND THE DISABLED-DATE INPUT WAS PRIVATE, so the only rule a host could
 *     express was `[minDate, maxDate]`. "No weekends", "not within 48 hours",
 *     "not while the warehouse is shut" are INFINITE SETS — a list means
 *     enumerating a window, re-enumerating it as the view scrolls, and getting
 *     the edges wrong silently, because a date merely absent from a list looks
 *     exactly like a date that is allowed.
 * ============================================================================
 */

async function setup(inputs: Partial<ComponentInput<SvDatePickerComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvDatePickerComponent, {
    inputs: inputs as ComponentInput<SvDatePickerComponent>,
  });
  return { ...r, c: r.fixture.componentInstance };
}

/** The JS day index of the first cell in the grid. */
const firstCellDay = (c: SvDatePickerComponent): number => c.calendarDays()[0].date.getDay();

/**
 * ★★★ THE VIEW IS NOT SET BY `value`. IT IS SET BY `toggle()`.
 *
 *     The first draft of this file asserted 31 days against a hardcoded March
 *     and went red with `expected 30 to be 31` — because an unopened picker
 *     shows TODAY'S month, so the test was measuring the date the suite ran on.
 *     It would have passed in March and in any 31-day month, and failed in
 *     April, June, September and November: a test that is a calendar lookup.
 *
 *     Setting the view signals directly is the honest fix. `toggle()` would
 *     also work but mounts a body portal and measures a rect, none of which
 *     this file is about.
 */
const setView = (c: SvDatePickerComponent, year: number, month: number): void => {
  c.viewYear.set(year);
  c.viewMonth.set(month);
};

describe('which day the week starts on', () => {
  it('is Monday by default, exactly as before', async () => {
    /**
     * ⚠️ THE COMPATIBILITY CLAIM. These calendars shipped Monday-first;
     *    defaulting to the runtime's locale would move every existing caller's
     *    columns on upgrade — a change a host should make on purpose rather
     *    than discover from a support ticket.
     */
    const { c } = await setup();
    expect(c.firstDay()).toBe(1);
    expect(c.weekDays()).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(firstCellDay(c)).toBe(1);
  });

  it('starts on Sunday for en-US, headings and grid together', async () => {
    // ★★ BOTH, ASSERTED TOGETHER. The headings and the grid offset were two
    //    separate constants, so fixing one and not the other produces a
    //    calendar that is labelled correctly and wrong — the worst of the
    //    three possible states, because it looks right.
    const { c } = await setup({ locale: 'en-US' });
    expect(c.firstDay()).toBe(0);
    expect(c.weekDays()[0]).toBe('Sun');
    expect(firstCellDay(c)).toBe(0);
  });

  it('starts on Saturday for ar-EG', async () => {
    // The case that kills "Sunday or Monday, pick one".
    const { c } = await setup({ locale: 'ar-EG' });
    expect(c.firstDay()).toBe(6);
    expect(firstCellDay(c)).toBe(6);
  });

  it('lets a host override the locale', async () => {
    // For the internal tool whose users are all in one office, or a scheduling
    // view pinned to a business week.
    const { c } = await setup({ locale: 'en-US', weekStart: 1 });
    expect(c.firstDay()).toBe(1);
    expect(firstCellDay(c)).toBe(1);
  });

  it('tolerates an out-of-range override rather than producing holes', async () => {
    const { c } = await setup({ weekStart: 7 });
    expect(c.firstDay()).toBe(0);
    expect(c.weekDays()).toHaveLength(7);
  });

  it('still renders 42 cells covering the whole month, whatever the start', async () => {
    /**
     * ★★★ THE INVARIANT THAT MATTERS MORE THAN THE OFFSET. A wrong offset that
     *     still starts the grid on the right weekday would pass the assertions
     *     above and drop the 1st of the month off the top — so this checks the
     *     property the grid exists for: every day of the shown month is in it.
     */
    // ★★ EVERY MONTH OF A YEAR, not one convenient one. The offset arithmetic
    //    is `(1st.getDay() - firstDay + 7) % 7`, so the cases that break it are
    //    the months whose 1st falls before the start column — which is a
    //    different set of months for each locale. Twelve months in four locales
    //    is 48 grids and still under a second.
    for (const locale of ['', 'en-US', 'ar-EG', 'de-DE']) {
      for (let month = 0; month < 12; month++) {
        const { c } = await setup({ locale });
        setView(c, 2026, month);
        const where = `${locale || '(default)'} m${month}`;
        const length = new Date(2026, month + 1, 0).getDate();

        const days = c.calendarDays();
        expect(days, where).toHaveLength(42);

        const inMonth = days.filter((d) => d.isCurrentMonth).map((d) => d.label);
        expect(inMonth[0], where).toBe(1);
        expect(inMonth[inMonth.length - 1], where).toBe(length);
        expect(inMonth, where).toHaveLength(length);

        // And the columns are seven consecutive weekdays from the first.
        for (let i = 0; i < 7; i++) {
          expect(days[i].date.getDay(), `${where} col ${i}`).toBe((c.firstDay() + i) % 7);
        }
      }
    }
  });

  it('moves Home to the start of the week AS DISPLAYED', async () => {
    // Was hardcoded to Monday, which sent the caret to a different column than
    // the one Home visually means.
    const { c } = await setup({ locale: 'en-US' });
    setView(c, 2026, 2);
    c.activeKey.set('2026-03-18'); // a Wednesday
    c.onDayKeydown(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
    expect(c.activeKey()).toBe('2026-03-15'); // the Sunday before it
  });

  it('moves End to the end of the week AS DISPLAYED', async () => {
    /**
     * ★★★ FOUND WHILE FIXING Home, AND WORSE THAN IT. `End` had the SAME Monday
     *     constant from the other side — `(getDay() + 6) % 7` — so it always
     *     landed on Sunday. On a Sunday-first grid Sunday is the FIRST column,
     *     which means Home and End moved the caret to the same cell in opposite
     *     directions. The backlog item named only Home.
     */
    const { c } = await setup({ locale: 'en-US' });
    setView(c, 2026, 2);
    c.activeKey.set('2026-03-18');
    c.onDayKeydown(new KeyboardEvent('keydown', { key: 'End', cancelable: true }));
    expect(c.activeKey()).toBe('2026-03-21'); // the Saturday after it
  });

  it('keeps Home and End on the Monday week when the grid is Monday-first', async () => {
    // The compatibility half of the same claim: the default must not move.
    const { c } = await setup();
    setView(c, 2026, 2);

    c.activeKey.set('2026-03-18');
    c.onDayKeydown(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
    expect(c.activeKey()).toBe('2026-03-16'); // Monday

    c.activeKey.set('2026-03-18');
    c.onDayKeydown(new KeyboardEvent('keydown', { key: 'End', cancelable: true }));
    expect(c.activeKey()).toBe('2026-03-22'); // Sunday
  });
});

describe('the disabled-date rule', () => {
  const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;

  it('takes a predicate, so an infinite set does not have to be enumerated', async () => {
    const { c } = await setup({ value: '2026-03-15', dateDisabled: isWeekend });
    setView(c, 2026, 2);
    const days = c.calendarDays().filter((d) => d.isCurrentMonth);

    expect(days.filter((d) => isWeekend(d.date)).every((d) => d.isDisabled)).toBe(true);
    expect(days.filter((d) => !isWeekend(d.date)).every((d) => !d.isDisabled)).toBe(true);
  });

  it('is OR-ed with the window, not instead of it', async () => {
    // ★★ They are different kinds of statement: the window bounds what the
    //    control is FOR, the rule says which of those days are available. A
    //    host that sets both means both.
    const { c } = await setup({
      value: '2026-03-15',
      minDate: '2026-03-10',
      dateDisabled: isWeekend,
    });
    setView(c, 2026, 2);
    const days = c.calendarDays();
    const on = (key: string) => days.find((d) => d.key === key)!;

    expect(on('2026-03-09').isDisabled).toBe(true); // before the window
    expect(on('2026-03-14').isDisabled).toBe(true); // a Saturday
    expect(on('2026-03-12').isDisabled).toBe(false); // a Thursday, inside
  });

  it('does not gate the month or year pickers', async () => {
    /**
     * ★★ A MONTH IS NOT UNAVAILABLE BECAUSE SOME OF ITS DAYS ARE. Greying out
     *    June because the 14th is a holiday would make the control unusable for
     *    getting to the 15th — and the month picker is navigation, not
     *    selection.
     */
    const { c } = await setup({ value: '2026-03-15', dateDisabled: () => true });
    expect(c.isMonthDisabled(5)).toBe(false);
    expect(c.isYearDisabled(2026)).toBe(false);
  });

  it('changes the grid when the predicate changes', async () => {
    // A rule is usually derived from other state — a selected warehouse, a
    // chosen service. If it does not re-evaluate, the calendar is stale in the
    // one situation a predicate was wanted for.
    const { fixture, c } = await setup({ value: '2026-03-15' });
    setView(c, 2026, 2);
    expect(c.calendarDays().some((d) => d.isDisabled)).toBe(false);

    fixture.componentRef.setInput('dateDisabled', isWeekend);
    fixture.detectChanges();
    expect(c.calendarDays().some((d) => d.isDisabled)).toBe(true);
  });

  it('changes nothing when no predicate is given', async () => {
    const { c } = await setup({ value: '2026-03-15' });
    setView(c, 2026, 2);
    expect(c.calendarDays().every((d) => !d.isDisabled)).toBe(true);
  });
});
