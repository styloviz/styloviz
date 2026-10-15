import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDateTimeCategoryChartComponent } from './datetime-category-chart.component';

/**
 * ============================================================================
 *  `sv-datetime-category-chart` — the axis names the day the host meant
 * ============================================================================
 *
 * ★★★ THE DEFECT
 *
 * `formatDateLabel` did `new Date(iso).toLocaleDateString(...)`. ECMA-262
 * requires a bare `YYYY-MM-DD` to be parsed as **UTC midnight**, and
 * `toLocaleDateString` renders in the reader's own zone — so a chart given
 * `['2026-03-15', …]` labelled its first column **"Mar 14"** for every user
 * west of UTC. Permanently, not in a window: every category, every render.
 *
 * The host passed a calendar day and the axis showed a different calendar day.
 * Nothing else in the component disagreed, so there was no visible symptom
 * beyond a label that was simply wrong — the kind of thing a customer reports
 * as "the chart is off by one" months later.
 *
 * ★ These tests skip EAST of UTC (and at UTC) rather than pass vacuously or fail
 * for the wrong reason. A date-only string is UTC midnight, which read locally
 * is still the same day anywhere east of Greenwich — so there the broken and the
 * fixed implementation return the identical label and no assertion can separate
 * them. Only a zone WEST of UTC exposes the bug. The suite runs at
 * Pacific/Marquesas (−09:30, `vitest.config.ts`), so they run in every normal
 * run; a deliberate `SV_TEST_TZ=Asia/Dhaka` run skips them instead of reporting
 * a regression that is not there (DA-15: the old guard was "offset ≠ 0", which
 * is also true at +06:00). `describe.skipIf` does not exist in Vitest 4.1.10,
 * hence the ternary.
 */

/** `getTimezoneOffset()` is minutes BEHIND UTC: positive west, negative east. */
const WEST_OF_UTC = new Date('2026-03-15').getTimezoneOffset() > 0;
const describeLocal = WEST_OF_UTC ? describe : describe.skip;

async function mount(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDateTimeCategoryChartComponent, { inputs });
  fixture.detectChanges();
  return fixture.componentInstance as unknown as { xLabels: () => string[] };
}

const SERIES = [{ name: 'Revenue', data: [1, 2, 3], color: '#3b82f6' }];

describe('date-only categories', () => {
  it('labels a day category with its own day', async () => {
    const c = await mount({
      categories: ['2026-03-15', '2026-03-16', '2026-03-17'],
      series: SERIES,
      options: { zoom: 'day' },
    });
    expect(c.xLabels()).toEqual(['Mar 15', 'Mar 16', 'Mar 17']);
  });

  it('labels a month category with its own month', async () => {
    const c = await mount({
      categories: ['2026-01-01', '2026-02-01', '2026-03-01'],
      series: SERIES,
      options: { zoom: 'month' },
    });
    expect(c.xLabels()).toEqual(['Jan 26', 'Feb 26', 'Mar 26']);
  });

  it('keeps the year on 1 January', async () => {
    // ★ The worst case for this bug: west of UTC, 2026-01-01 read as UTC
    // midnight is 31 December **2025**, so a yearly chart's first column was
    // labelled with the wrong YEAR, not merely the wrong day.
    const c = await mount({
      categories: ['2026-01-01', '2027-01-01', '2028-01-01'],
      series: SERIES,
      options: { zoom: 'year' },
    });
    expect(c.xLabels()).toEqual(['2026', '2027', '2028']);
  });

  it('gets the last day of a month right', async () => {
    const c = await mount({
      categories: ['2026-01-31', '2026-02-28', '2028-02-29'],
      series: SERIES,
      options: { zoom: 'day' },
    });
    expect(c.xLabels()).toEqual(['Jan 31', 'Feb 28', 'Feb 29']);
  });
});

describeLocal('★★★ the frame, proved rather than assumed', () => {
  it('does NOT agree with the UTC reading — which is what used to ship', async () => {
    // The precondition and the assertion in one: if these two ever match, the
    // component has gone back to the UTC frame.
    const utcLabel = new Date('2026-03-15').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const c = await mount({ categories: ['2026-03-15'], series: SERIES, options: { zoom: 'day' } });

    expect(utcLabel).not.toBe('Mar 15');       // the runner really is west of UTC
    expect(c.xLabels()[0]).toBe('Mar 15');     // and the component ignores that
  });
});

describe('categories that carry a time', () => {
  it('is left alone — an instant is not a calendar day', async () => {
    // A full timestamp means "when did this happen", so it is rendered in the
    // reader's local time on purpose. Asserted against the same conversion the
    // component performs, so this stays true in any zone.
    const iso = '2026-03-15T14:30:00Z';
    const expected = new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const c = await mount({ categories: [iso], series: SERIES, options: { zoom: 'day' } });
    expect(c.xLabels()[0]).toBe(expected);
  });
});

/**
 * A date axis is the one axis whose labels are WORDS.
 *
 * ★ Every one of them used to come out in American English and American order —
 *   "Mar 15" on a German dashboard, "Mar 15" on a Japanese one — with no input
 *   to change it and nothing on the page saying so. The locale now defaults to
 *   the application's own `LOCALE_ID`, the same value `DatePipe` resolves.
 *
 * These do not need a non-UTC runner: a locale difference shows up in any zone.
 */
describe('SvDateTimeCategoryChartComponent — locale', () => {
  async function chart(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDateTimeCategoryChartComponent, { inputs });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('formats the axis in the requested locale', async () => {
    const en = await chart({ categories: ['2026-03-15'], locale: 'en-US', options: { zoom: 'day' } });
    const de = await chart({ categories: ['2026-03-15'], locale: 'de-DE', options: { zoom: 'day' } });
    expect(en.xLabels()[0]).not.toBe(de.xLabels()[0]);
    expect(de.xLabels()[0]).toContain('Mär');
  });

  it('puts the day and month in the order the locale uses', async () => {
    const us = await chart({ categories: ['2026-03-15'], locale: 'en-US', options: { zoom: 'day' } });
    const gb = await chart({ categories: ['2026-03-15'], locale: 'en-GB', options: { zoom: 'day' } });
    expect(us.xLabels()[0]).toBe('Mar 15');
    expect(gb.xLabels()[0]).toBe('15 Mar');
  });

  it('localises the month zoom too', async () => {
    const c = await chart({ categories: ['2026-03-15'], locale: 'fr-FR', options: { zoom: 'month' } });
    expect(c.xLabels()[0].toLowerCase()).toContain('mars');
  });

  it('leaves a year as digits, which every locale shares', async () => {
    const c = await chart({ categories: ['2026-03-15'], locale: 'ja-JP', options: { zoom: 'year' } });
    expect(c.xLabels()[0]).toBe('2026');
  });

  it('uses the same locale in the accessible name as on the axis', async () => {
    // One string in three places, or the axis and the screen reader disagree.
    const c = await chart({
      categories: ['2026-03-15'],
      series: [{ name: 'Visits', data: [10], color: '#3b82f6' }],
      locale: 'de-DE',
      options: { zoom: 'day' },
    });
    expect(c.categoryAriaLabel(0)).toContain('Mär');
  });

  it('keeps the categories themselves as ISO, since they are also the join key', async () => {
    const c = await chart({ categories: ['2026-03-15'], locale: 'de-DE' });
    expect(c.categories()[0]).toBe('2026-03-15');
  });

  it('falls back to the raw string rather than printing "Invalid Date"', async () => {
    const c = await chart({ categories: ['not-a-date'], locale: 'en-US' });
    expect(c.xLabels()[0]).toBe('not-a-date');
  });
});
