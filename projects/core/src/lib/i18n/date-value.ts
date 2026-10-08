/**
 * ============================================================================
 *  The kit's date-value policy (`FI-09-M1`)
 * ============================================================================
 *
 *  -- THE QUESTION, AND WHY IT IS THE MOST CONSEQUENTIAL ONE IN THE FAMILY --
 *
 *  A `Date` object is an INSTANT: a count of milliseconds, rendered through
 *  whatever zone happens to be reading it. A birthday is not an instant. It is
 *  the same date everywhere on Earth, and storing it as a `Date` means the
 *  value shifts across midnight for half the planet. Until the value type is
 *  stated, every consumer picks a different interpretation and they disagree
 *  silently.
 *
 *  -- THE ANSWER, WHICH THE CODE ALREADY GAVE -------------------------------
 *
 *  **A CALENDAR DATE, AS `YYYY-MM-DD`.** `sv-date-picker` has always been
 *  `model<string>`, never a `Date`, and every comparison in it is on the key
 *  string rather than on a timestamp. `sv-time-picker` is the same shape for
 *  wall-clock time (`HH:mm`). This module does not change that decision; it
 *  names it, makes it checkable at runtime, and puts the one conversion that
 *  genuinely needs a time zone behind a function that asks for one.
 *
 *  Not "both". A second, zoned value type would mean every consumer asking
 *  which one it has, and the failure mode of getting that wrong is silent. A
 *  host that needs an instant composes one deliberately with
 *  {@link svComposeDateTime}, which reports the gaps and the ambiguities
 *  instead of guessing.
 *
 *  -- ★★★ THE ONE PLACE A CALENDAR DATE CANNOT AVOID A TIME ZONE ------------
 *
 *  "What is today's date?" There is no zone-free answer: for several hours of
 *  every day, two places on Earth are on different dates. `new Date()` answers
 *  in the BROWSER'S zone, which is the right answer for a personal calendar and
 *  the wrong one for an app pinned to a business zone — a Sydney user booking
 *  against a New York ledger sees tomorrow highlighted as today, and the Today
 *  button writes a date the server will reject.
 *
 *  So {@link svToday} takes a zone, and defaults to the browser's only because
 *  that is what every caller was silently doing before.
 *
 *  -- The seam `FI-09-M4` needs --------------------------------------------
 *
 *  {@link SvDateValueAdapter} is the whole point of naming this now: when
 *  `Temporal.PlainDate` lands, a host swaps the adapter rather than rewriting
 *  its bindings, and the components keep speaking strings.
 * ============================================================================
 */

/**
 * A calendar date as `YYYY-MM-DD` — a date with no time and no zone.
 *
 * ⚠️ THE BRAND IS OPTIONAL, WHICH MEANS IT DOCUMENTS RATHER THAN ENFORCES.
 *    A required brand would make `SvCalendarDate` unassignable from a plain
 *    `string`, and every host binding `[value]="'2026-06-15'"` or a value read
 *    from JSON would need a cast — turning a naming exercise into a breaking
 *    change across the whole kit. With the property optional, the type is
 *    accepted anywhere a string is, and what it buys is that tooling says
 *    `SvCalendarDate` instead of `string` and leads the reader here.
 *
 *    Use {@link svCalendarDate} when you want the shape actually checked.
 */
export type SvCalendarDate = string & { readonly __svCalendarDate?: never };

/**
 * A wall-clock time as `HH:mm` or `HH:mm:ss` — no date, no zone.
 *
 * Same optional brand, for the same reason.
 */
export type SvWallClockTime = string & { readonly __svWallClockTime?: never };

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether `raw` is a well-formed calendar date that actually exists.
 *
 * ★★ THE SECOND HALF IS THE POINT. `2026-02-30` and `2026-13-01` both match the
 *    pattern, and `new Date('2026-02-30')` rolls quietly over to 2 March —
 *    which is how an invalid date becomes a valid-looking one somewhere
 *    downstream. The round-trip check below rejects them.
 */
export function svIsCalendarDate(raw: unknown): raw is SvCalendarDate {
  if (typeof raw !== 'string') return false;
  const m = CALENDAR_DATE.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // Built and read in UTC: a local-zone Date for a midnight that does not exist
  // (Chile, Cuba, Paraguay, Lebanon) normalizes to 01:00 and can land on the
  // next day, which would fail a date that is perfectly real.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y
    && probe.getUTCMonth() === mo - 1
    && probe.getUTCDate() === d;
}

/** `raw` as a calendar date, or `null` when it is not one. */
export function svCalendarDate(raw: unknown): SvCalendarDate | null {
  return svIsCalendarDate(raw) ? raw : null;
}

/** Build one from parts, with the same existence check. `month` is 1-based. */
export function svCalendarDateOf(year: number, month: number, day: number): SvCalendarDate | null {
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return svCalendarDate(`${pad(year, 4)}-${pad(month)}-${pad(day)}`);
}

/**
 * The calendar date an INSTANT falls on, in `timeZone`.
 *
 * ★★★ THE CONVERSION EVERY CODEBASE GETS WRONG ONCE. `d.toISOString().slice(0, 10)`
 *     is the usual shortcut and it answers in UTC, so for anyone east of
 *     Greenwich in the evening it names yesterday. `d.getFullYear()` and
 *     friends answer in the browser's zone, which is right for a personal
 *     calendar and wrong for an app pinned to a business zone.
 *
 *     This asks, and formats the parts rather than the string, because a
 *     locale's own date format is not `YYYY-MM-DD` and parsing it back would
 *     be guessing at the separator and the order.
 *
 * @param timeZone An IANA zone. Omitted or empty means the browser's own.
 */
export function svCalendarDateOfInstant(
  instant: Date | number,
  timeZone?: string,
): SvCalendarDate | null {
  const d = typeof instant === 'number' ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return null;

  if (!timeZone) {
    return svCalendarDateOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    return svCalendarDateOf(get('year'), get('month'), get('day'));
  } catch {
    // An unknown zone throws. Falling back to the browser's is the same answer
    // the caller had before asking, and is better than returning null for what
    // is almost always a typo in a config string.
    return svCalendarDateOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
}

/**
 * Today's calendar date in `timeZone`.
 *
 * ⚠️ There is no zone-free answer, and the default is the browser's zone only
 *    because that is what every caller was silently doing before this function
 *    existed. Pass the zone whose "today" your data means.
 */
export function svToday(timeZone?: string, now: Date = new Date()): SvCalendarDate {
  // The fallback cannot fail: `now` is a real date and the parts of a real date
  // always compose. The `??` is for the type, not for a case that happens.
  return svCalendarDateOfInstant(now, timeZone) ?? '1970-01-01';
}

/**
 * Compare two calendar dates.
 *
 * Lexicographic on purpose: `YYYY-MM-DD` sorts correctly as text, which is why
 * the format was chosen, and comparing as `Date` would reintroduce the zone
 * this whole module exists to keep out.
 */
export function svCompareCalendarDates(a: SvCalendarDate, b: SvCalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `date` shifted by whole days, staying a calendar date throughout. */
export function svAddCalendarDays(date: SvCalendarDate, days: number): SvCalendarDate | null {
  const m = CALENDAR_DATE.exec(date);
  if (!m || !svIsCalendarDate(date)) return null;
  // UTC arithmetic: a local-zone Date crossing a DST boundary can land on the
  // wrong day, which is the entire class of bug this module prevents.
  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  probe.setUTCDate(probe.getUTCDate() + days);
  return svCalendarDateOf(
    probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate(),
  );
}

/**
 * How a host's own date representation maps onto the kit's.
 *
 * ★★★ THIS IS WHY THE POLICY IS WORTH NAMING RATHER THAN JUST DOCUMENTING.
 *     `FI-09-M4` wants a `Temporal.PlainDate` adapter; a host with a Luxon or
 *     Day.js codebase wants one too. With the seam in place that is an adapter,
 *     and without it it is a rewrite of every binding in the application.
 *
 * ```ts
 * const temporal: SvDateValueAdapter<Temporal.PlainDate> = {
 *   toCalendarDate: (v) => svCalendarDate(v.toString()),
 *   fromCalendarDate: (d) => Temporal.PlainDate.from(d),
 * };
 * ```
 *
 * The components never see `T`. They bind strings, and the host converts at its
 * own edge — which is the only place that knows what `T` is.
 */
export interface SvDateValueAdapter<T> {
  /** `null` for a value that is not a date the kit can render. */
  toCalendarDate(value: T): SvCalendarDate | null;
  fromCalendarDate(date: SvCalendarDate): T;
}

/**
 * The identity adapter, for a host already storing `YYYY-MM-DD` strings.
 *
 * Exported so that code written against the seam has something to pass on day
 * one, rather than the seam being a thing you only reach for during a
 * migration.
 */
export const svIsoDateAdapter: SvDateValueAdapter<string> = {
  toCalendarDate: (value) => svCalendarDate(value),
  fromCalendarDate: (date) => date,
};
