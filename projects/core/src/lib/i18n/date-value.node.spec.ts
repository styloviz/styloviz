import {
  svAddCalendarDays,
  svCalendarDate,
  svCalendarDateOf,
  svCalendarDateOfInstant,
  svCompareCalendarDates,
  svIsCalendarDate,
  svIsoDateAdapter,
  svToday,
  type SvCalendarDate,
  type SvDateValueAdapter,
} from './date-value';

/**
 * `FI-09-M1` — the date-value policy.
 *
 * The three things worth proving, in the order they bite:
 *
 *  1. A date that does not exist is rejected. `2026-02-30` matches the pattern
 *     and `new Date()` rolls it quietly to 2 March, which is how an invalid
 *     date becomes a valid-looking one three layers downstream.
 *  2. Instant → calendar date asks for a zone and honours it. The two usual
 *     shortcuts (`toISOString().slice(0,10)` and `getFullYear()`) answer in UTC
 *     and in the browser's zone respectively, and both are wrong about half the
 *     time for somebody.
 *  3. Day arithmetic does not go through a local-zone `Date`, because a DST
 *     boundary makes it land on the wrong day.
 */

describe('svIsCalendarDate / svCalendarDate', () => {
  it('accepts a real date', () => {
    expect(svIsCalendarDate('2026-06-15')).toBe(true);
    expect(svCalendarDate('2026-06-15')).toBe('2026-06-15');
  });

  it('rejects a date that matches the pattern and does not exist', () => {
    // ★★★ THE ONE THE REGEX ALONE MISSES. `new Date('2026-02-30')` is 2 March
    //     and says nothing about it.
    for (const bad of ['2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00']) {
      expect(svIsCalendarDate(bad)).toBe(false);
      expect(svCalendarDate(bad)).toBeNull();
    }
  });

  it('accepts 29 February in a leap year and refuses it otherwise', () => {
    expect(svIsCalendarDate('2024-02-29')).toBe(true);
    expect(svIsCalendarDate('2026-02-29')).toBe(false);
    // The centurial rule, which a naive `% 4` gets wrong in both directions.
    expect(svIsCalendarDate('2000-02-29')).toBe(true);
    expect(svIsCalendarDate('1900-02-29')).toBe(false);
  });

  it('rejects anything that is not a YYYY-MM-DD string', () => {
    for (const bad of ['', '2026-6-15', '15/06/2026', '2026-06-15T00:00:00Z', 20260615, null, undefined, new Date()]) {
      expect(svIsCalendarDate(bad)).toBe(false);
    }
  });

  it('builds from parts and pads', () => {
    expect(svCalendarDateOf(2026, 6, 5)).toBe('2026-06-05');
    expect(svCalendarDateOf(2026, 2, 30)).toBeNull();
  });
});

describe('svCalendarDateOfInstant', () => {
  // 2026-06-15T23:30:00Z — already the 16th in Sydney, still the 15th in UTC,
  // and still the 15th in New York.
  const instant = new Date('2026-06-15T23:30:00Z');

  it('answers in the zone it was asked about', () => {
    expect(svCalendarDateOfInstant(instant, 'UTC')).toBe('2026-06-15');
    expect(svCalendarDateOfInstant(instant, 'Australia/Sydney')).toBe('2026-06-16');
    expect(svCalendarDateOfInstant(instant, 'America/New_York')).toBe('2026-06-15');
  });

  it('disagrees with the UTC shortcut exactly where it should', () => {
    // ★★ `toISOString().slice(0, 10)` is the shortcut everybody writes, and
    //    this is the assertion that says when it is wrong rather than just
    //    asserting the right answer.
    const shortcut = instant.toISOString().slice(0, 10);
    expect(shortcut).toBe('2026-06-15');
    expect(svCalendarDateOfInstant(instant, 'Australia/Sydney')).not.toBe(shortcut);
  });

  it('crosses back over the date line the other way', () => {
    // 2026-06-15T02:00:00Z is still the 14th in Los Angeles.
    const early = new Date('2026-06-15T02:00:00Z');
    expect(svCalendarDateOfInstant(early, 'UTC')).toBe('2026-06-15');
    expect(svCalendarDateOfInstant(early, 'America/Los_Angeles')).toBe('2026-06-14');
  });

  it('falls back to the browser zone for an unknown zone rather than failing', () => {
    // A typo in a config string should not blank the calendar. This is the same
    // answer the caller had before they asked.
    const local = svCalendarDateOfInstant(instant);
    expect(svCalendarDateOfInstant(instant, 'Not/AZone')).toBe(local);
  });

  it('returns null for an invalid instant', () => {
    expect(svCalendarDateOfInstant(new Date('nonsense'))).toBeNull();
  });

  it('takes a millisecond number as well as a Date', () => {
    expect(svCalendarDateOfInstant(instant.getTime(), 'UTC')).toBe('2026-06-15');
  });
});

describe('svToday', () => {
  it('is the date in the zone asked for, at the instant given', () => {
    const now = new Date('2026-06-15T23:30:00Z');
    expect(svToday('UTC', now)).toBe('2026-06-15');
    expect(svToday('Australia/Sydney', now)).toBe('2026-06-16');
    expect(svToday('Pacific/Marquesas', now)).toBe('2026-06-15');
  });

  it('defaults to the browser zone, which is what callers were doing already', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(svToday(undefined, now)).toBe(svCalendarDateOfInstant(now));
  });
});

describe('svCompareCalendarDates', () => {
  it('orders lexicographically, which for this format is chronologically', () => {
    expect(svCompareCalendarDates('2026-01-02', '2026-01-10')).toBe(-1);
    expect(svCompareCalendarDates('2026-02-01', '2026-01-31')).toBe(1);
    expect(svCompareCalendarDates('2026-06-15', '2026-06-15')).toBe(0);
    // The case that would break a naive numeric parse of the day alone.
    expect(svCompareCalendarDates('2026-01-09', '2026-01-10')).toBe(-1);
  });
});

describe('svAddCalendarDays', () => {
  it('crosses a month and a year boundary', () => {
    expect(svAddCalendarDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(svAddCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(svAddCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(svAddCalendarDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('adds a whole day across a DST boundary in every gate zone', () => {
    // ★★★ THE REASON THE ARITHMETIC IS IN UTC. A local-zone `Date` stepped by
    //     one day across a spring-forward can land back on the same date, or
    //     skip one — quietly, and only twice a year, in the zones where the
    //     tests do not run.
    //
    //     These are the transition days themselves, in the zones that have one:
    //     New York 2026-03-08, London 2026-03-29, Sydney 2026-04-05.
    expect(svAddCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(svAddCalendarDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(svAddCalendarDays('2026-04-05', 1)).toBe('2026-04-06');
    expect(svAddCalendarDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('is exactly reversible', () => {
    for (const d of ['2026-01-01', '2026-02-28', '2026-06-15', '2026-12-31'] as SvCalendarDate[]) {
      expect(svAddCalendarDays(svAddCalendarDays(d, 37)!, -37)).toBe(d);
    }
  });

  it('refuses a date that is not one rather than inventing an answer', () => {
    expect(svAddCalendarDays('2026-02-30', 1)).toBeNull();
    expect(svAddCalendarDays('nonsense', 1)).toBeNull();
  });
});

describe('SvDateValueAdapter', () => {
  it('round-trips through the identity adapter', () => {
    expect(svIsoDateAdapter.toCalendarDate('2026-06-15')).toBe('2026-06-15');
    expect(svIsoDateAdapter.fromCalendarDate('2026-06-15')).toBe('2026-06-15');
    expect(svIsoDateAdapter.toCalendarDate('2026-02-30')).toBeNull();
  });

  it('is the seam a foreign date type plugs into', () => {
    // The shape `FI-09-M4`'s Temporal adapter will take, proved against a stand
    // -in so the seam is exercised rather than merely declared.
    interface Fake { readonly y: number; readonly m: number; readonly d: number }
    const adapter: SvDateValueAdapter<Fake> = {
      toCalendarDate: (v) => svCalendarDateOf(v.y, v.m, v.d),
      fromCalendarDate: (date) => ({
        y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)),
      }),
    };

    const iso = adapter.toCalendarDate({ y: 2026, m: 6, d: 15 });
    expect(iso).toBe('2026-06-15');
    expect(adapter.fromCalendarDate(iso!)).toEqual({ y: 2026, m: 6, d: 15 });
    expect(adapter.toCalendarDate({ y: 2026, m: 2, d: 30 })).toBeNull();
  });
});
