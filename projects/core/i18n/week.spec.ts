import { svFirstDayOfWeek, svWeekdayLabels } from './week';

/**
 * ============================================================================
 *  Which day the week starts on  ·  `FI-09-M2`
 * ============================================================================
 *
 * ★★★ A WEEK-START BUG IS NOT COSMETIC. A calendar is read by COLUMN POSITION
 *     before it is read by number — that is what a grid is for — so a
 *     Sunday-first reader looking at a Monday-first grid picks the wrong date,
 *     confidently, and the component reports exactly what they clicked. Nothing
 *     is inconsistent; the user is simply wrong about which day they chose.
 *
 * ★★ THREE DIFFERENT ANSWERS IN SIX LOCALES, so there is no majority to default
 *    to: `en-US` Sunday, `en-GB` Monday, `ar-EG` Saturday. The calendars in
 *    this kit had `['Mo', …, 'Su']` and a `mondayOffset`, both constants.
 */

describe('svFirstDayOfWeek', () => {
  it('is Monday for a locale that starts on Monday', () => {
    expect(svFirstDayOfWeek('de-DE')).toBe(1);
    expect(svFirstDayOfWeek('en-GB')).toBe(1);
    expect(svFirstDayOfWeek('fr-FR')).toBe(1);
  });

  it('is Sunday for a locale that starts on Sunday', () => {
    /**
     * ★★★ THE CONVERSION THAT IS MOST LIKELY TO BE QUIETLY WRONG. CLDR reports
     *     Sunday as `7` (ISO numbering, Monday `1`); JS `Date#getDay()` calls
     *     it `0`. An implementation that forgets the `% 7` is correct for six
     *     days a week and puts an eighth column on a calendar for the seventh.
     */
    expect(svFirstDayOfWeek('en-US')).toBe(0);
    expect(svFirstDayOfWeek('ja-JP')).toBe(0);
  });

  it('is Saturday where the week starts on Saturday', () => {
    // The case that kills "Sunday or Monday, pick one". A quarter of the
    // world's calendars start on neither.
    expect(svFirstDayOfWeek('ar-EG')).toBe(6);
  });

  it('always returns a valid JS day index', () => {
    for (const locale of ['en-US', 'de-DE', 'ar-EG', 'he-IL', 'bn-BD', 'ja-JP', 'fa-IR', '']) {
      const day = svFirstDayOfWeek(locale);
      expect(Number.isInteger(day), locale).toBe(true);
      expect(day, locale).toBeGreaterThanOrEqual(0);
      expect(day, locale).toBeLessThanOrEqual(6);
    }
  });

  it('keeps Monday when no locale is given', () => {
    /**
     * ⚠️ `''` MEANS "KEEP MONDAY", NOT "ASK THE BROWSER". These calendars
     *    shipped Monday-first; defaulting to the runtime's locale would move
     *    every existing caller's columns on upgrade — a change a host should
     *    make on purpose rather than discover from a support ticket.
     */
    expect(svFirstDayOfWeek('')).toBe(1);
  });

  it('degrades to Monday rather than throwing on a bad tag', () => {
    expect(() => svFirstDayOfWeek('not a locale')).not.toThrow();
    expect(svFirstDayOfWeek('not a locale')).toBe(1);
  });
});

describe('svWeekdayLabels', () => {
  it('starts where it is told to', () => {
    expect(svWeekdayLabels('', 1)[0]).toBe('Mo');
    expect(svWeekdayLabels('', 0)[0]).toBe('Su');
    expect(svWeekdayLabels('', 6)[0]).toBe('Sa');
  });

  it('returns seven labels with no repeats, whatever the start', () => {
    for (let start = 0; start < 7; start++) {
      const labels = svWeekdayLabels('', start);
      expect(labels, String(start)).toHaveLength(7);
      expect(new Set(labels).size, String(start)).toBe(7);
    }
  });

  it('keeps the kit’s original English headings when no locale is given', () => {
    // The compatibility default, asserted exactly: this is what the calendars
    // rendered before, and an upgrade must not change it.
    expect(svWeekdayLabels('', 1)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  });

  it('uses the locale’s own names when one is given', () => {
    const de = svWeekdayLabels('de-DE', 1);
    expect(de[0]).toBe('Mo');
    expect(de[6]).toBe('So'); // not 'Su'
    expect(svWeekdayLabels('en-US', 0)[0]).toBe('Sun');
  });

  it('names the right days, checked against Intl rather than a table', () => {
    /**
     * ★★★ THE CLAIM THAT ACTUALLY MATTERS: label `i` names the day that will be
     *     in column `i`. Asserting the STRINGS would be asserting CLDR data and
     *     would go red on an ICU upgrade; asserting the CORRESPONDENCE is the
     *     property the calendar depends on.
     */
    const start = 0; // Sunday
    const format = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
    const labels = svWeekdayLabels('en-US', start);

    for (let i = 0; i < 7; i++) {
      // 2023-01-01 was a Sunday in UTC.
      const day = new Date(Date.UTC(2023, 0, 1 + ((start + i) % 7)));
      expect(labels[i], String(i)).toBe(format.format(day));
      expect(day.getUTCDay()).toBe((start + i) % 7);
    }
  });

  it('is not rotated by the runner’s timezone', () => {
    /**
     * ★★★ THE MISTAKE THIS SUITE EXISTS TO CATCH. Naming a weekday means
     *     picking a real date and asking what day it was, so the reference week
     *     has to be BUILT and FORMATTED in the same zone. Mix them and the
     *     headings come out rotated by one — plausible-looking, and wrong.
     *
     * ★★★ THERE ARE TWO WAYS TO MIX THEM AND THEY BREAK IN OPPOSITE
     *     HEMISPHERES. That is the part worth writing down, because the
     *     comment this file replaced got it backwards:
     *
     *       build LOCAL, format UTC → wrong EAST of Greenwich. Local midnight
     *         2023-01-01 in Tokyo is 2022-12-31T15:00Z — the previous day.
     *       build UTC, format LOCAL → wrong WEST of Greenwich. UTC midnight
     *         2023-01-01 in Marquesas is 2022-12-31 14:30 local.
     *
     * ⚠️ WHICH MEANS THE SUITE'S PINNED Pacific/Marquesas CATCHES ONLY ONE OF
     *    THEM. `vitest.config.ts` chose −09:30 to catch "UTC day vs local day",
     *    and it does — for the SECOND mix only. Fire-tested rather than argued:
     *    injecting mix A leaves this file **green at Marquesas** and red only
     *    under `TZ=Asia/Tokyo`; injecting mix B does the reverse. So an
     *    implementation making the first mistake would pass the default suite
     *    and be broken for every user east of Greenwich.
     *
     *    `check:date-math` does cover both directions — Australia/Lord_Howe is
     *    east — but that gate runs ten named spec files and this is not one of
     *    them. Which is the argument for the branch below rather than for
     *    trusting a pin that was chosen for a different property.
     *
     * ★★ SO THE ASSERTION IS BRANCHED ON THE SIGN OF THE OFFSET RATHER THAN
     *    GUARDED ON IT. An earlier draft opened with
     *    `expect(getTimezoneOffset()).not.toBe(0)` to stop the check being a
     *    tautology at UTC — right worry, wrong mechanism: `check:date-math`
     *    runs this suite in five zones and **one of them is UTC**, so the guard
     *    turned a correct implementation red in a legitimate configuration. A
     *    test that fails because of where it runs is not evidence about the
     *    code. Branching keeps teeth in every zone and reports the degenerate
     *    case honestly instead of failing on it.
     */
    const SUNDAY = 'Sun';
    const utcFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
    const localFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

    // What we produce, which must be right in every zone.
    expect(svWeekdayLabels('en-US', 0)[0]).toBe(SUNDAY);
    expect(svWeekdayLabels('en-US', 1)[0]).toBe('Mon');

    // The two ways to get it wrong, both evaluated, so neither is assumed.
    const builtLocalFormattedUtc = utcFmt.format(new Date(2023, 0, 1));
    const builtUtcFormattedLocal = localFmt.format(new Date(Date.UTC(2023, 0, 1)));

    // `getTimezoneOffset()` is minutes BEHIND UTC: negative east, positive west.
    const offset = new Date(Date.UTC(2023, 0, 1)).getTimezoneOffset();

    if (offset < 0) {
      expect(builtLocalFormattedUtc, 'east: local midnight is the previous UTC day')
        .not.toBe(SUNDAY);
      expect(builtUtcFormattedLocal, 'east: UTC midnight is still the same local day')
        .toBe(SUNDAY);
    } else if (offset > 0) {
      expect(builtUtcFormattedLocal, 'west: UTC midnight is the previous local day')
        .not.toBe(SUNDAY);
      expect(builtLocalFormattedUtc, 'west: local midnight is still the same UTC day')
        .toBe(SUNDAY);
    } else {
      // At UTC the two constructions genuinely agree. Saying so is the honest
      // report; failing here would be a claim about the runner, not the code.
      expect(builtLocalFormattedUtc).toBe(SUNDAY);
      expect(builtUtcFormattedLocal).toBe(SUNDAY);
    }
  });

  it('takes a narrow width when asked', () => {
    const narrow = svWeekdayLabels('en-US', 1, 'narrow');
    const short = svWeekdayLabels('en-US', 1, 'short');
    expect(narrow.join('').length).toBeLessThan(short.join('').length);
  });

  it('degrades to the English headings on a bad tag', () => {
    expect(() => svWeekdayLabels('not a locale', 1)).not.toThrow();
    expect(svWeekdayLabels('not a locale', 1)[0]).toBe('Mo');
  });

  it('tolerates an out-of-range start rather than producing holes', () => {
    // A host binding a signal that is briefly `-1` or `7` gets a rotated week,
    // not six labels and an `undefined` in the header row.
    expect(svWeekdayLabels('', 7)).toEqual(svWeekdayLabels('', 0));
    expect(svWeekdayLabels('', -1)).toEqual(svWeekdayLabels('', 6));
  });
});
