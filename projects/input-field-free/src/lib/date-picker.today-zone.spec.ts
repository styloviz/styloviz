import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDatePickerComponent } from './date-picker.component';

/**
 * `FI-09-M1` — WHOSE today.
 *
 * The sibling `date-picker.timezone.spec.ts` proves the local round trip: the
 * cell labelled 15 emits `…-15` and back again, at an offset where every wrong
 * way of doing it shows. This file is the other half of the same policy.
 *
 * ★★★ THE VALUE IS ZONE-FREE AND "TODAY" CANNOT BE. `YYYY-MM-DD` is the same
 *     date everywhere on Earth, which is the point of the policy — but for
 *     several hours of every day two places are on different dates, so "which
 *     one is today" has no zone-free answer.
 *
 *     Every "today" here used `new Date()` in the BROWSER'S zone: the
 *     highlighted cell, the Today button, the month the panel opens on, and the
 *     keyboard's starting point. Right for a personal calendar, wrong for an
 *     app pinned to a business zone — a Sydney user booking against a New York
 *     ledger sees tomorrow ringed as today, and the Today button writes a date
 *     the server rejects.
 *
 * ⚠️ The suite runs at `TZ=Pacific/Marquesas` (−09:30, no DST), so "the
 *    browser's zone" below is Marquesas. Every assertion names the zones it
 *    compares rather than assuming the machine's.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDatePickerComponent, { inputs });
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance };
}

afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll('.sv-dp-portal').forEach((n) => n.remove());
  TestBed.resetTestingModule();
});

/**
 * Freeze the clock where the world disagrees about the date.
 *
 * 2026-06-15T23:30:00Z — Sydney is already on the 16th; UTC, New York and
 * Marquesas are all still on the 15th.
 */
function freezeAtDisagreement(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T23:30:00Z'));
}

describe('sv-date-picker — whose today', () => {
  it('reads the browser zone when no zone is named, exactly as before', async () => {
    // ⚠️ THIS TEST ORIGINALLY ASSERTED THE LITERAL '2026-06-15', AND THAT WAS
    //    THE SAME MISTAKE THE FEATURE EXISTS TO FIX. 23:30Z is the 15th in
    //    Marquesas — where this suite pins the clock — and already the 16th in
    //    London and Lord Howe, two of `check:date-math`'s five zones. Running
    //    it there is what caught it.
    //
    //    So the claim is checked against an INDEPENDENT local-zone path (the
    //    plain `Date` getters) rather than a constant, which is the assertion
    //    the test actually wanted: unset means the browser's own date. An
    //    implementation that answered in UTC, or froze the answer, still fails.
    freezeAtDisagreement();
    const { c } = await setup();

    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(c.todayKey()).toBe(local);
  });

  it('reads the zone it was given', async () => {
    freezeAtDisagreement();
    const { c } = await setup({ timeZone: 'Australia/Sydney' });
    expect(c.todayKey()).toBe('2026-06-16');
  });

  it('agrees with the browser when the two are on the same date', async () => {
    freezeAtDisagreement();
    const { c } = await setup({ timeZone: 'America/New_York' });
    expect(c.todayKey()).toBe('2026-06-15');
  });

  it('follows the zone when the input changes', async () => {
    freezeAtDisagreement();
    const { fixture, c } = await setup({ timeZone: 'UTC' });
    expect(c.todayKey()).toBe('2026-06-15');

    fixture.componentRef.setInput('timeZone', 'Australia/Sydney');
    fixture.detectChanges();
    expect(c.todayKey()).toBe('2026-06-16');
  });
});

describe('sv-date-picker — what today drives', () => {
  it('writes the zone’s today from the Today button, not the machine’s', async () => {
    // ★★★ THE ONE A USER LOSES A DAY TO. The button writes a value; if it
    //     writes the browser's date while the ledger is in another zone, the
    //     submission is for the wrong day and nothing on screen said so.
    freezeAtDisagreement();
    const { c } = await setup({ timeZone: 'Australia/Sydney' });
    // The two-way `value` model is the host-visible write; there is no separate
    // output to listen on, so the model IS the assertion.
    expect(c.value()).toBe('');

    c.goToToday();
    expect(c.value()).toBe('2026-06-16');
  });

  it('rings the zone’s today in the grid', async () => {
    freezeAtDisagreement();
    const { c } = await setup({ timeZone: 'Australia/Sydney' });
    c.viewYear.set(2026);
    c.viewMonth.set(5);                      // June
    expect(c.calendarDays().filter((d) => d.isToday).map((d) => d.key))
      .toEqual(['2026-06-16']);
  });

  it('opens on the zone’s today when nothing is selected', async () => {
    freezeAtDisagreement();
    const { c } = await setup({ timeZone: 'Australia/Sydney' });
    c.toggle();
    expect(c.activeKey()).toBe('2026-06-16');
  });

  it('starts keyboard navigation from the zone’s today', async () => {
    freezeAtDisagreement();
    const { c } = await setup({ timeZone: 'Australia/Sydney' });
    c.viewMode.set('days');
    c.onDayKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(c.activeKey()).toBe('2026-06-17');
  });

  it('judges the Today button’s own window against the zone’s today', async () => {
    // A max of the 15th forbids Today in Sydney (the 16th) and allows it in
    // New York (the 15th) — at the very same instant.
    freezeAtDisagreement();
    const sydney = await setup({ timeZone: 'Australia/Sydney', maxDate: '2026-06-15' });
    expect(sydney.c.isTodayDisabled()).toBe(true);

    const newYork = await setup({ timeZone: 'America/New_York', maxDate: '2026-06-15' });
    expect(newYork.c.isTodayDisabled()).toBe(false);
  });
});

describe('sv-date-picker — what the zone does NOT do', () => {
  it('never converts the value', async () => {
    // ⚠️ A calendar date has no zone to convert between. If a zone change
    //    rewrote the value, a user switching a display preference would find
    //    their birthday had moved.
    freezeAtDisagreement();
    const { fixture, c } = await setup({ value: '2026-06-15', timeZone: 'UTC' });
    expect(c.value()).toBe('2026-06-15');

    fixture.componentRef.setInput('timeZone', 'Australia/Sydney');
    fixture.detectChanges();
    expect(c.value()).toBe('2026-06-15');
  });

  it('falls back to the browser zone for a zone that does not exist', async () => {
    // A typo in a config string must not blank the calendar.
    freezeAtDisagreement();
    const typo = await setup({ timeZone: 'Australia/Sydny' });
    const none = await setup();
    expect(typo.c.todayKey()).toBe(none.c.todayKey());
  });
});
