import {
  SV_CRON_VISUAL_DEFAULTS,
  svCronErrorMessage,
  svCronFromVisual,
  svCronToVisual,
  svCronVisualHint,
  svDescribeCron,
  svFormatCron,
  svNextCronRuns,
  svParseCron,
  type SvCron,
  type SvCronErrorCode,
  type SvCronFieldName,
  type SvCronVisual,
  type SvCronVisualMode,
} from './cron';

/** Parse, and fail the test loudly if it does not. */
function cronOf(expr: string): SvCron {
  const r = svParseCron(expr);
  if (!r.ok) throw new Error(`expected "${expr}" to parse, got ${JSON.stringify(r.error)}`);
  return r.cron;
}

const iso = (runs: readonly Date[]): string[] => runs.map((d) => d.toISOString());

/**
 * FL-F9's done-when: the round trip, for every expression here.
 *
 *   [as written, normalised, the visual mode that shows it — or null for Custom]
 */
const ROUND_TRIP: readonly (readonly [string, string, SvCronVisualMode | null])[] = [
  ['* * * * *', '* * * * *', 'minutes'],
  ['*/1 * * * *', '* * * * *', 'minutes'],
  ['0-59 0-23 * * *', '* * * * *', 'minutes'],
  ['*/15 * * * *', '*/15 * * * *', 'minutes'],
  ['0,30 * * * *', '*/30 * * * *', 'minutes'],
  // `*/7` restarts at :00 every hour — not "every 7 minutes", so only Custom shows it.
  ['*/7 * * * *', '*/7 * * * *', null],
  ['5-10/2 * * * *', '5,7,9 * * * *', null],
  ['1-30/5 * * * *', '1-26/5 * * * *', null],
  ['0 * * * *', '0 * * * *', 'hourly'],
  ['@hourly', '0 * * * *', 'hourly'],
  ['15 */2 * * *', '15 */2 * * *', 'hourly'],
  ['0 0,12 * * *', '0 */12 * * *', 'hourly'],
  ['0 */5 * * *', '0 */5 * * *', null],
  ['30 6 * * *', '30 6 * * *', 'daily'],
  ['@daily', '0 0 * * *', 'daily'],
  ['@midnight', '0 0 * * *', 'daily'],
  ['0 9 * * 1-5', '0 9 * * 1-5', 'weekly'],
  ['0 9 * * MON-FRI', '0 9 * * 1-5', 'weekly'],
  ['0 9 * * mon,Wed,FRI', '0 9 * * 1,3,5', 'weekly'],
  // Sunday is 0 and 7; both normalise to 0.
  ['0 0 * * 0', '0 0 * * 0', 'weekly'],
  ['0 0 * * 7', '0 0 * * 0', 'weekly'],
  ['0 0 * * SUN', '0 0 * * 0', 'weekly'],
  ['@weekly', '0 0 * * 0', 'weekly'],
  ['0 22 * * 5-7', '0 22 * * 0,5,6', 'weekly'],
  ['0 0 * * 0-6', '0 0 * * 0-6', 'weekly'],
  ['30 6 1,15 * *', '30 6 1,15 * *', 'monthly'],
  ['@monthly', '0 0 1 * *', 'monthly'],
  // Not `*`: next to a restricted weekday it would mean something else.
  ['0 0 1-31 * *', '0 0 1-31 * *', 'monthly'],
  // 29 February: valid, and runs every leap year.
  ['0 0 29 2 *', '0 0 29 2 *', null],
  ['0 0 1 JAN *', '0 0 1 1 *', null],
  ['@yearly', '0 0 1 1 *', null],
  ['0 12 * JAN-MAR,DEC *', '0 12 * 1-3,12 *', null],
  ['0 0 1 */3 *', '0 0 1 */3 *', null],
  // Both day fields restricted: cron ORs them.
  ['0 0 1 * 1', '0 0 1 * 1', null],
  // Day-of-month written with `*`: cron ANDs them.
  ['0 0 */2 * 1', '0 0 */2 * 1', null],
  ['0 9,17 * * 1-5', '0 9,17 * * 1-5', null],
  ['*/15 9-17 * * 1-5', '*/15 9-17 * * 1-5', null],
  ['  0   9 *  * 1 ', '0 9 * * 1', 'weekly'],
];

describe('cron — round trip (FL-F9: at least 20 expressions)', () => {
  it('covers at least twenty expressions, and at least twenty the visual modes can show', () => {
    expect(ROUND_TRIP.length).toBeGreaterThanOrEqual(20);
    expect(ROUND_TRIP.filter(([, , mode]) => mode !== null).length).toBeGreaterThanOrEqual(20);
  });

  for (const [written, normalised, mode] of ROUND_TRIP) {
    it(`"${written}" → parse → format is "${normalised}", and that is a fixed point`, () => {
      const first = svParseCron(written);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.expression).toBe(normalised);
      expect(svFormatCron(first.cron)).toBe(normalised);
      const again = svParseCron(normalised);
      expect(again.ok && again.expression).toBe(normalised);
    });

    it(`"${written}" opens in ${mode ?? 'Custom'}${mode ? ', and visual → expression → visual is stable' : ''}`, () => {
      const visual = svCronToVisual(written);
      if (mode === null) {
        expect(visual).toBeNull();
        return;
      }
      expect(visual?.mode).toBe(mode);
      const cron = svCronFromVisual(visual as SvCronVisual);
      expect(cron).not.toBeNull();
      expect(svFormatCron(cron as SvCron)).toBe(normalised);
      expect(svCronToVisual(cron as SvCron, visual as SvCronVisual)).toEqual(visual);
    });
  }

  const VISUALS: readonly SvCronVisual[] = [
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'minutes', minuteInterval: 1 },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'minutes', minuteInterval: 20 },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'hourly', minute: 45, hourInterval: 1 },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'hourly', minute: 5, hourInterval: 8 },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'daily', hour: 0, minute: 0 },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'daily', hour: 23, minute: 59 },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'weekly', hour: 18, minute: 30, weekdays: [0, 6] },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'monthly', hour: 6, minute: 30, monthDays: [1, 15] },
    { ...SV_CRON_VISUAL_DEFAULTS, mode: 'monthly', monthDays: [28, 29, 30, 31] },
  ];

  for (const visual of VISUALS) {
    it(`visual ${visual.mode} → expression → visual is the same state (${JSON.stringify(visual)})`, () => {
      const cron = svCronFromVisual(visual);
      expect(cron).not.toBeNull();
      const expression = svFormatCron(cron as SvCron);
      expect(svCronToVisual(expression, visual)).toEqual(visual);
    });
  }

  it('maps weekday 7 to Sunday in the visual model too', () => {
    const cron = svCronFromVisual({ ...SV_CRON_VISUAL_DEFAULTS, mode: 'weekly', weekdays: [7, 1] });
    expect(svFormatCron(cron as SvCron)).toBe('0 9 * * 0,1');
  });

  it('has no cron for a weekly or monthly state with no day, or an interval it does not offer', () => {
    expect(svCronFromVisual({ ...SV_CRON_VISUAL_DEFAULTS, mode: 'weekly', weekdays: [] })).toBeNull();
    expect(svCronFromVisual({ ...SV_CRON_VISUAL_DEFAULTS, mode: 'monthly', monthDays: [] })).toBeNull();
    expect(svCronFromVisual({ ...SV_CRON_VISUAL_DEFAULTS, mode: 'minutes', minuteInterval: 7 })).toBeNull();
    expect(svCronFromVisual({ ...SV_CRON_VISUAL_DEFAULTS, mode: 'daily', hour: 24 })).toBeNull();
  });

  it('keeps what an unrepresentable expression has when leaving Custom', () => {
    const hint = svCronVisualHint('0 9,17 * * 1-5');
    expect(hint.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(hint.minute).toBe(0);
    // Two hours: the visual modes hold one, so the hour stays where it was.
    expect(hint.hour).toBe(SV_CRON_VISUAL_DEFAULTS.hour);
    expect(svCronVisualHint('*/7 * * * *').minuteInterval).toBe(SV_CRON_VISUAL_DEFAULTS.minuteInterval);
    expect(svCronVisualHint('not cron')).toEqual(SV_CRON_VISUAL_DEFAULTS);
  });
});

describe('cron — the day-of-month / day-of-week rule', () => {
  it('ORs the two day fields when both are restricted', () => {
    // 1 Nov 2026 is a Sunday; the Mondays are 2, 9, 16, 23.
    const runs = svNextCronRuns('0 0 1 * 1', { from: Date.UTC(2026, 9, 26, 12), timeZone: 'UTC', count: 5 });
    expect(iso(runs)).toEqual([
      '2026-11-01T00:00:00.000Z',
      '2026-11-02T00:00:00.000Z',
      '2026-11-09T00:00:00.000Z',
      '2026-11-16T00:00:00.000Z',
      '2026-11-23T00:00:00.000Z',
    ]);
  });

  it('ANDs them when day-of-month is written with *', () => {
    // Odd days that are Mondays: 9 and 23 Nov, 7 Dec.
    const runs = svNextCronRuns('0 0 */2 * 1', { from: Date.UTC(2026, 9, 26, 12), timeZone: 'UTC' });
    expect(iso(runs)).toEqual(['2026-11-09T00:00:00.000Z', '2026-11-23T00:00:00.000Z', '2026-12-07T00:00:00.000Z']);
  });

  it('keeps `1-31` and `*` apart, because next to a weekday they run on different days', () => {
    const star = svNextCronRuns('0 0 * * 1', { from: Date.UTC(2026, 9, 26, 12), timeZone: 'UTC' });
    const range = svNextCronRuns('0 0 1-31 * 1', { from: Date.UTC(2026, 9, 26, 12), timeZone: 'UTC' });
    expect(iso(star)).toEqual(['2026-11-02T00:00:00.000Z', '2026-11-09T00:00:00.000Z', '2026-11-16T00:00:00.000Z']);
    expect(iso(range)).toEqual(['2026-10-27T00:00:00.000Z', '2026-10-28T00:00:00.000Z', '2026-10-29T00:00:00.000Z']);
    expect(svParseCron('0 0 1-31 * 1')).toMatchObject({ ok: true, expression: '0 0 1-31 * 1' });
  });

  it('treats 0 and 7 as the same Sunday', () => {
    expect(cronOf('0 0 * * 0')).toEqual(cronOf('0 0 * * 7'));
    expect(cronOf('0 0 * * 0-7').dayOfWeek.values).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('cron — validation', () => {
  const REJECTED: readonly (readonly [string, SvCronErrorCode, SvCronFieldName | undefined])[] = [
    ['', 'empty', undefined],
    ['   ', 'empty', undefined],
    ['* * *', 'field-count', undefined],
    ['1 2 3 4 5 6', 'field-count', undefined],
    ['@reboot', 'field-count', undefined],
    ['60 * * * *', 'range', 'minute'],
    ['* 24 * * *', 'range', 'hour'],
    ['* * 0 * *', 'range', 'dayOfMonth'],
    ['* * 32 * *', 'range', 'dayOfMonth'],
    ['* * * 0 *', 'range', 'month'],
    ['* * * 13 *', 'range', 'month'],
    ['* * * * 8', 'range', 'dayOfWeek'],
    ['99999 * * * *', 'range', 'minute'],
    ['*/0 * * * *', 'step', 'minute'],
    ['*/60 * * * *', 'step', 'minute'],
    ['*/ * * * *', 'step', 'minute'],
    ['5-1 * * * *', 'invalid', 'minute'],
    ['a * * * *', 'invalid', 'minute'],
    ['1,,2 * * * *', 'invalid', 'minute'],
    ['0 0 * * FOO', 'invalid', 'dayOfWeek'],
    ['0 0 * JANUARY *', 'invalid', 'month'],
    ['0 0 ? * *', 'invalid', 'dayOfMonth'],
    ['0 0 L * *', 'invalid', 'dayOfMonth'],
    ['-1 * * * *', 'invalid', 'minute'],
  ];

  for (const [expr, code, field] of REJECTED) {
    it(`rejects "${expr}" (${code}${field ? ` in ${field}` : ''})`, () => {
      const r = svParseCron(expr);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe(code);
      expect(r.error.field).toBe(field);
    });
  }

  it('accepts every step up to one short of the range', () => {
    expect(svParseCron('*/59 */23 */30 */11 */6').ok).toBe(true);
    expect(svParseCron('* * * * */7').ok).toBe(false);
  });

  it('names the field, the text and the range in the message', () => {
    const r = svParseCron('0 25 * * *');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toEqual({ code: 'range', field: 'hour', token: '25', min: 0, max: 23 });
    expect(svCronErrorMessage(r.error)).toBe('In the hour field, “25” is outside 0–23.');
  });

  it('says what a step must be', () => {
    const r = svParseCron('*/0 * * * *');
    expect(!r.ok && svCronErrorMessage(r.error)).toBe('In the minute field, the step in “*/0” must be from 1 to 59.');
  });

  it('takes the message text from the labels it is given', () => {
    expect(svCronErrorMessage({ code: 'empty' }, { labels: { cronErrEmpty: 'Bitte einen Ausdruck eingeben.' } })).toBe(
      'Bitte einen Ausdruck eingeben.',
    );
    expect(svCronErrorMessage({ code: 'no-days' })).toBe('Choose at least one day.');
    expect(svCronErrorMessage({ code: 'field-count' })).toContain('five fields');
  });

  it('does not throw on a non-string', () => {
    expect(svParseCron(undefined as unknown as string)).toEqual({ ok: false, error: { code: 'empty' } });
    expect(svDescribeCron('nope')).toBe('');
    expect(svNextCronRuns('nope')).toEqual([]);
  });

  it('refuses to format a field with no value in range', () => {
    const cron = cronOf('0 9 * * *');
    expect(() => svFormatCron({ ...cron, hour: { values: [24], star: false } })).toThrow(RangeError);
  });
});

describe('cron — description', () => {
  const GB = { locale: 'en-GB' } as const;
  const DESCRIBED: readonly (readonly [string, string])[] = [
    ['* * * * *', 'Every minute'],
    ['*/15 * * * *', 'Every 15 minutes'],
    ['15 * * * *', 'At minute 15 past every hour'],
    ['15 */2 * * *', 'At minute 15 past every 2 hours'],
    ['30 6 * * *', 'Every day at 06:30'],
    ['0 9 * * 1-5', 'Every weekday at 09:00'],
    ['0 9 * * 1,3,5', 'Every Monday, Wednesday and Friday at 09:00'],
    ['0 0 * * 7', 'Every Sunday at 00:00'],
    ['0 9 * * 0-6', 'Every day at 09:00'],
    ['30 6 1,15 * *', 'On the 1st and 15th of every month at 06:30'],
    ['0 8 1,2,3,22 * *', 'On the 1st through 3rd and 22nd of every month at 08:00'],
    ['0 9,17 * * 1-5', 'At 09:00 and 17:00, on Monday through Friday'],
    ['*/15 9-17 * * 1-5', 'Every 15 minutes, during hours 9 through 17, on Monday through Friday'],
    ['*/7 * * * *', 'At minutes 0, 7, 14, 21, 28, 35, 42, 49 and 56, past every hour'],
    ['0 0 29 2 *', 'At 00:00, on the 29th of the month, in February'],
    ['0 0 1 * 1', 'At 00:00, on the 1st of the month, or on any Monday'],
    ['0 0 */2 * 1', 'At 00:00, on every 2nd day of the month, but only on a Monday'],
    ['0 12 * JAN-MAR,DEC *', 'At 12:00, in January through March and December'],
  ];

  for (const [expr, sentence] of DESCRIBED) {
    it(`"${expr}" reads "${sentence}"`, () => {
      expect(svDescribeCron(expr, GB)).toBe(sentence);
    });
  }

  it('takes a parsed cron as well as a string', () => {
    expect(svDescribeCron(cronOf('0 9 * * 1-5'), GB)).toBe('Every weekday at 09:00');
  });

  it('writes times, weekdays and months in the locale', () => {
    expect(svDescribeCron('0 9 * * 1', { locale: 'en-US' })).toMatch(/^Every Monday at 09:00\sAM$/);
    expect(svDescribeCron('0 9 * * 1', { locale: 'de-DE' })).toContain('Montag');
    expect(svDescribeCron('0 0 1 3 *', { locale: 'fr-FR' })).toContain('mars');
  });

  it('uses the labels it is given, with the locale\'s ordinal rule', () => {
    const labels = {
      cronDescMonthly: 'Am {days} jedes Monats um {time}',
      cronOrdinalOne: '{n}.',
      cronOrdinalTwo: '{n}.',
      cronOrdinalFew: '{n}.',
      cronOrdinalOther: '{n}.',
    };
    expect(svDescribeCron('30 6 1,15 * *', { locale: 'de-DE', labels })).toBe('Am 1. und 15. jedes Monats um 06:30');
  });

  it('falls back to the machine locale for an empty or invalid tag', () => {
    expect(svDescribeCron('*/15 * * * *', { locale: '' })).toBe('Every 15 minutes');
    expect(svDescribeCron('*/15 * * * *', { locale: 'not a locale!!' })).toBe('Every 15 minutes');
  });
});

describe('cron — next runs', () => {
  it('lists the next runs strictly after `from`, in UTC', () => {
    const runs = svNextCronRuns('*/15 * * * *', { from: Date.UTC(2026, 9, 26, 10, 7), timeZone: 'UTC', count: 4 });
    expect(iso(runs)).toEqual([
      '2026-10-26T10:15:00.000Z',
      '2026-10-26T10:30:00.000Z',
      '2026-10-26T10:45:00.000Z',
      '2026-10-26T11:00:00.000Z',
    ]);
    // Exactly on a run: that run is not "next".
    expect(iso(svNextCronRuns('0 9 * * *', { from: Date.UTC(2026, 9, 26, 9), timeZone: 'UTC', count: 1 }))).toEqual([
      '2026-10-27T09:00:00.000Z',
    ]);
  });

  it('reads the wall clock in the given zone', () => {
    // 09:00 in Dhaka (UTC+6, no DST) on weekdays; 23 Oct 2026 is a Friday.
    const runs = svNextCronRuns('0 9 * * 1-5', { from: Date.UTC(2026, 9, 23, 12), timeZone: 'Asia/Dhaka' });
    expect(iso(runs)).toEqual(['2026-10-26T03:00:00.000Z', '2026-10-27T03:00:00.000Z', '2026-10-28T03:00:00.000Z']);
  });

  it('finds 29 February in the next leap years', () => {
    const runs = svNextCronRuns('0 0 29 2 *', { from: Date.UTC(2026, 9, 26), timeZone: 'UTC', count: 2 });
    expect(iso(runs)).toEqual(['2028-02-29T00:00:00.000Z', '2032-02-29T00:00:00.000Z']);
  });

  it('returns nothing for a date that never comes, an invalid zone, or count 0', () => {
    expect(svNextCronRuns('0 0 30 2 *', { from: Date.UTC(2026, 9, 26), timeZone: 'UTC' })).toEqual([]);
    expect(svNextCronRuns('0 9 * * *', { timeZone: 'Mars/Olympus_Mons' })).toEqual([]);
    expect(svNextCronRuns('0 9 * * *', { count: 0 })).toEqual([]);
  });

  it('runs a time inside the spring-forward gap once, pushed past the jump', () => {
    // New York, 8 Mar 2026: 02:00 EST → 03:00 EDT, so 02:30 does not exist that day.
    const runs = svNextCronRuns('30 2 * * *', { from: Date.UTC(2026, 2, 7, 12), timeZone: 'America/New_York' });
    expect(iso(runs)).toEqual(['2026-03-08T07:30:00.000Z', '2026-03-09T06:30:00.000Z', '2026-03-10T06:30:00.000Z']);
  });

  it('never repeats or reorders instants across the gap', () => {
    const runs = svNextCronRuns('*/30 * * * *', { from: Date.UTC(2026, 2, 8, 6, 10), timeZone: 'America/New_York', count: 4 });
    expect(iso(runs)).toEqual([
      '2026-03-08T06:30:00.000Z', // 01:30 EST
      '2026-03-08T07:00:00.000Z', // 03:00 EDT (02:00 pushed past the jump)
      '2026-03-08T07:30:00.000Z', // 03:30 EDT
      '2026-03-08T08:00:00.000Z', // 04:00 EDT
    ]);
  });

  it('runs a time that happens twice (fall back) once, at the first', () => {
    // New York, 1 Nov 2026: 02:00 EDT → 01:00 EST, so 01:30 happens twice.
    const runs = svNextCronRuns('30 1 * * *', { from: Date.UTC(2026, 9, 31, 12), timeZone: 'America/New_York' });
    expect(iso(runs)).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-02T06:30:00.000Z', '2026-11-03T06:30:00.000Z']);
  });
});
