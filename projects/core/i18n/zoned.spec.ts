import { svComposeDateTime, svZoneOffsetMinutes } from './zoned';

/**
 * ============================================================================
 *  A date plus a time is not always an instant  ·  `FI-28-I2` / `FI-28-M2`
 * ============================================================================
 *
 * ★★★ `sv-date-picker` HOLDS A CALENDAR DATE AND `sv-time-picker` HOLDS A
 *     WALL-CLOCK TIME. Neither is an instant, and the kit said so about
 *     neither — so a host composing the two reaches for
 *     `new Date(`${date}T${time}`)`, gets an instant in the BROWSER'S zone, and
 *     a booking made in London reads an hour out in Dublin.
 *
 * ★★★ AND TWICE A YEAR THE COMPOSITION IS NOT A FUNCTION.
 *     The GAP: 01:30 does not exist in London on 2026-03-29.
 *     The OVERLAP: 01:30 happens twice in London on 2026-10-25.
 *     `new Date()` does not throw for either. It picks, silently.
 *
 * ⚠️ EVERY TRANSITION BELOW WAS MEASURED, not looked up: the offsets were
 *    binary-searched out of `Intl` on this runtime for 2026. A test written
 *    from memory of "the last Sunday in March" is a test about the author.
 */

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

describe('svZoneOffsetMinutes', () => {
  it('reports minutes EAST of UTC, the sign the zone name means', () => {
    // ⚠️ The opposite convention from `Date#getTimezoneOffset()`, on purpose:
    //    "UTC+05:30" should be `+330`, not `-330`.
    expect(svZoneOffsetMinutes(Date.UTC(2026, 0, 15), 'Asia/Kolkata')).toBe(330);
    expect(svZoneOffsetMinutes(Date.UTC(2026, 0, 15), 'America/New_York')).toBe(-300);
    expect(svZoneOffsetMinutes(Date.UTC(2026, 0, 15), 'UTC')).toBe(0);
  });

  it('tracks the transition rather than a fixed number per zone', () => {
    // Measured: London goes 0 → +60 at 2026-03-29T01:00Z.
    expect(svZoneOffsetMinutes(Date.UTC(2026, 2, 29, 0, 59), 'Europe/London')).toBe(0);
    expect(svZoneOffsetMinutes(Date.UTC(2026, 2, 29, 1, 0), 'Europe/London')).toBe(60);
  });

  it('handles a half-hour zone and a 45-minute one', () => {
    expect(svZoneOffsetMinutes(Date.UTC(2026, 0, 15), 'Asia/Kathmandu')).toBe(345);
    expect(svZoneOffsetMinutes(Date.UTC(2026, 0, 15), 'Australia/Lord_Howe')).toBe(660);
  });

  it('is right at local midnight, which is where hour formatting goes wrong', () => {
    /**
     * ⚠️ THIS TEST IS WEAKER THAN ITS FIRST DRAFT CLAIMED, AND SAYING SO IS THE
     *    POINT. The module uses `hourCycle: 'h23'` rather than `hour12: false`
     *    because the latter is documented to yield `"24"` for midnight on some
     *    ICU builds, which reassembles as the NEXT day and puts the offset out
     *    by 24 hours for one minute a day.
     *
     *    Measured on this runtime (Node 22, ICU 78.2): the two options agree on
     *    all 144 hour/zone combinations checked, and swapping `hourCycle` for
     *    `hour12` in the implementation leaves this whole file green. So this
     *    is NOT a regression guard for that bug — nothing here can be — and
     *    labelling it as one would be a lie in a comment that outlives the
     *    reader who could check.
     *
     *    What it does assert is the property that would break IF the `"24"`
     *    reading ever appeared: the offset at local midnight is a real offset,
     *    in every zone, on both sides of a transition.
     */
    for (const tz of ['Asia/Kolkata', 'America/New_York', 'Pacific/Marquesas', 'UTC',
                      'Europe/London', 'Australia/Lord_Howe']) {
      for (const day of [Date.UTC(2026, 5, 15), Date.UTC(2026, 2, 29), Date.UTC(2026, 9, 25)]) {
        const localMidnight = day - svZoneOffsetMinutes(day, tz) * 60000;
        const o = svZoneOffsetMinutes(localMidnight, tz);
        const where = `${tz} ${new Date(day).toISOString().slice(0, 10)}`;
        expect(Math.abs(o), where).toBeLessThanOrEqual(14 * 60);
        // A 24-hour error would show up here: the offset must be a whole
        // number of quarter-hours, which every real zone offset is.
        //
        // ⚠️ `Math.abs`, because `-240 % 15` is `-0` and `toBe` compares with
        //    `Object.is`, for which `-0 !== +0`. The first draft of this line
        //    went red on New York in summer and nowhere else.
        expect(Math.abs(o % 15), where).toBe(0);
      }
    }
  });
});

describe('an ordinary day composes to one instant', () => {
  it('reads the wall clock in the zone it was written in', () => {
    const r = svComposeDateTime('2026-06-15', '14:30', 'Europe/London');
    expect(r.status).toBe('ok');
    expect(iso(r.instant)).toBe('2026-06-15T13:30:00.000Z'); // BST, +60
    expect(r.offsetMinutes).toBe(60);
  });

  it('is a different instant in a different zone, which is the whole point', () => {
    const london = svComposeDateTime('2026-06-15', '14:30', 'Europe/London');
    const kolkata = svComposeDateTime('2026-06-15', '14:30', 'Asia/Kolkata');
    expect(iso(london.instant)).not.toBe(iso(kolkata.instant));
    expect(iso(kolkata.instant)).toBe('2026-06-15T09:00:00.000Z');
  });

  it('carries seconds when they are given', () => {
    const r = svComposeDateTime('2026-06-15', '14:30:45', 'UTC');
    expect(iso(r.instant)).toBe('2026-06-15T14:30:45.000Z');
  });
});

describe('the gap — a wall clock that does not exist', () => {
  it('London, 2026-03-29: 01:30 is not a time that day', () => {
    /**
     * ★★★ THE FAILURE THIS EXISTS FOR. The clocks go 01:00 → 02:00, so nobody
     *     in Britain lived through 01:30 on that date. `new Date()` returns
     *     02:30 without a word, and an appointment silently moves.
     */
    const r = svComposeDateTime('2026-03-29', '01:30', 'Europe/London');
    expect(r.status).toBe('gap');
    expect(r.instant).toBeNull();
    expect(r.instants).toEqual([]);
  });

  it('offers where the clock lands without applying it', () => {
    // ⚠️ Advancing silently is what `new Date()` already does and is the
    //    behaviour this function exists to make visible.
    const r = svComposeDateTime('2026-03-29', '01:30', 'Europe/London');
    expect(iso(r.gapResolution)).toBe('2026-03-29T01:30:00.000Z'); // = 02:30 BST
  });

  it('New York, 2026-03-08: the gap is 02:00–02:59', () => {
    expect(svComposeDateTime('2026-03-08', '02:30', 'America/New_York').status).toBe('gap');
    expect(svComposeDateTime('2026-03-08', '01:59', 'America/New_York').status).toBe('ok');
    expect(svComposeDateTime('2026-03-08', '03:00', 'America/New_York').status).toBe('ok');
  });

  it('Lord Howe, 2026-10-03: the gap is THIRTY minutes, not sixty', () => {
    /**
     * ★★★ THE CASE THAT KILLS "add an hour". Lord Howe shifts by 30 minutes
     *     (+10:30 → +11:00), so 02:00–02:29 does not exist and 02:30 does. An
     *     implementation that assumes a one-hour transition is wrong here and
     *     nowhere else — which is exactly the kind of wrong that ships.
     */
    expect(svComposeDateTime('2026-10-04', '02:00', 'Australia/Lord_Howe').status).toBe('gap');
    expect(svComposeDateTime('2026-10-04', '02:29', 'Australia/Lord_Howe').status).toBe('gap');
    expect(svComposeDateTime('2026-10-04', '02:30', 'Australia/Lord_Howe').status).toBe('ok');
    expect(svComposeDateTime('2026-10-04', '01:59', 'Australia/Lord_Howe').status).toBe('ok');
  });

  it('Santiago, southern hemisphere, transitions in the opposite months', () => {
    // Code that hard-codes March and October as "the transition weeks" passes
    // everywhere north of the equator and fails here.
    expect(svComposeDateTime('2026-09-06', '00:30', 'America/Santiago').status).toBe('gap');
  });
});

describe('the overlap — a wall clock that happens twice', () => {
  it('London, 2026-10-25: 01:30 comes round again an hour later', () => {
    const r = svComposeDateTime('2026-10-25', '01:30', 'Europe/London');
    expect(r.status).toBe('ambiguous');
    expect(r.instants).toHaveLength(2);
    expect(iso(r.instants[0])).toBe('2026-10-25T00:30:00.000Z'); // BST, +60
    expect(iso(r.instants[1])).toBe('2026-10-25T01:30:00.000Z'); // GMT, +0
  });

  it('returns the earlier reading as the answer, and says both', () => {
    // ★★ The first one is what a user writing "01:30" on that date almost
    //    always means — they wrote it while living through the first one.
    //    Returning it silently WITHOUT `instants` would be the same guess the
    //    `Date` constructor makes; the point is that both are reported.
    const r = svComposeDateTime('2026-10-25', '01:30', 'Europe/London');
    expect(iso(r.instant)).toBe(iso(r.instants[0]));
    expect(r.instants[1]!.getTime() - r.instants[0]!.getTime()).toBe(3600_000);
  });

  it('Lord Howe’s overlap is thirty minutes wide', () => {
    const r = svComposeDateTime('2026-04-05', '01:45', 'Australia/Lord_Howe');
    expect(r.status).toBe('ambiguous');
    expect(r.instants[1]!.getTime() - r.instants[0]!.getTime()).toBe(1800_000);
  });
});

describe('a zone without DST never reports either', () => {
  it('Kolkata composes every minute of both transition days', () => {
    // ★★ The control. If `gap`/`ambiguous` ever appear in a zone with no
    //    transitions, the detection is reading something other than the zone.
    for (const date of ['2026-03-29', '2026-10-25']) {
      for (let m = 0; m < 1440; m += 7) {
        const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        expect(svComposeDateTime(date, time, 'Asia/Kolkata').status, `${date} ${time}`).toBe('ok');
      }
    }
  });
});

describe('the property, swept rather than sampled', () => {
  it('every ok instant formats back to the wall clock it was asked for', () => {
    /**
     * ★★★ THE ONLY CLAIM THAT MATTERS, checked across four zones and four
     *     transition days at one-minute resolution — 23,040 compositions. A
     *     sampled test would miss the minute either side of a jump, which is
     *     the only place this can be wrong.
     *
     * ⚠️ THE FORMATTER IS BUILT ONCE PER ZONE, NOT ONCE PER MINUTE, and that is
     *    the whole reason this test is affordable. `new Intl.DateTimeFormat` is
     *    expensive — it resolves a locale and loads zone data — and it used to
     *    sit in the innermost loop, so the sweep constructed ~23,000 of them.
     *    Alone that cost 7.5s; sharing a CPU with the rest of the suite it
     *    passed 30s and failed on the timeout, which reads as a flaky test
     *    rather than as a hot loop. Four formatters, same assertions, same
     *    coverage.
     */
    const ZONES = ['Europe/London', 'America/New_York', 'Australia/Lord_Howe', 'America/Santiago'];
    const DATES = ['2026-03-29', '2026-04-05', '2026-10-04', '2026-10-25'];

    for (const tz of ZONES) {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });

      for (const date of DATES) {
        for (let m = 0; m < 1440; m++) {
          const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          const r = svComposeDateTime(date, time, tz);
          if (r.status === 'gap') { expect(r.instant, `${tz} ${date} ${time}`).toBeNull(); continue; }

          for (const inst of r.instants) {
            const back = fmt
              .formatToParts(inst)
              .reduce<Record<string, string>>((a, p) => (a[p.type] = p.value, a), {});
            expect(
              `${back['year']}-${back['month']}-${back['day']} ${back['hour']}:${back['minute']}`,
              `${tz} ${date} ${time}`,
            ).toBe(`${date} ${time}`);
          }
        }
      }
    }
  });

  it('classifies exactly as many missing minutes as the offset moved', () => {
    // ★★ The gap's WIDTH is the offset change, so counting the gap minutes is
    //    an independent check on the classification — 60 for London, 30 for
    //    Lord Howe, from two different mechanisms.
    const countGaps = (date: string, tz: string): number => {
      let n = 0;
      for (let m = 0; m < 1440; m++) {
        const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        if (svComposeDateTime(date, time, tz).status === 'gap') n++;
      }
      return n;
    };
    expect(countGaps('2026-03-29', 'Europe/London')).toBe(60);
    expect(countGaps('2026-03-08', 'America/New_York')).toBe(60);
    expect(countGaps('2026-10-04', 'Australia/Lord_Howe')).toBe(30);
    expect(countGaps('2026-06-15', 'Europe/London')).toBe(0);
  });
});

describe('what it refuses', () => {
  it('refuses a malformed date or time rather than guessing', () => {
    for (const [d, t] of [['', '10:00'], ['2026-13-01', '10:00'], ['2026-06-15', ''],
                          ['2026-06-15', '25:00'], ['not a date', 'not a time']] as const) {
      const r = svComposeDateTime(d, t, 'UTC');
      expect(r.instant, `${d} ${t}`).toBeNull();
    }
  });

  it('falls back to the runtime zone when none is given', () => {
    // Not "UTC" — the runtime's, which is what a host gets from `new Date()`
    // anyway. The gap and overlap reporting is the part that was missing.
    const r = svComposeDateTime('2026-06-15', '14:30');
    expect(r.status).toBe('ok');
    expect(r.offsetMinutes).toBe(-new Date('2026-06-15T14:30').getTimezoneOffset());
  });
});
