import { svNormalizeDigits } from './digits';

/**
 * Reading a time somebody typed.
 *
 * ── The defect this exists for (`FI-28-I1` / `FI-28-M1`) ────────────────────
 *
 * ★★★ `sv-time-picker` HAD NO TEXT INPUT AT ALL. The trigger is a `<button>`
 *     and the panel is three scrolling columns of `<button>`s — measured, with
 *     `format="24h"` and `withSeconds`, **146 tab stops**, of which minute `37`
 *     is the **61st**. Setting 14:37:00 by keyboard meant holding Tab through
 *     sixty-one controls, because there is no arrow-key navigation either: the
 *     document order IS the navigation.
 *
 * ★★ THE BACKLOG CALLED THIS "cumbersome". It is not cumbersome, it is the
 *    difference between a control a keyboard user can operate and one they
 *    cannot — and the same 146 stops are 146 swipes for a screen-reader user
 *    moving by form control.
 *
 * ── ★★★ WHY THE PARSER RETURNS PARTS AND NOT A TIME ─────────────────────────
 *
 * `2:30` is not a time. In a 12-hour control it is two times, and only the
 * component knows which — it has the AM/PM the user last chose, and this
 * function does not. A parser that guessed would be right half the time and
 * silent about it, which is exactly the failure mode of the thing it replaces.
 *
 * So `svParseTime` reports what the TEXT SAID, including `period: null` for
 * "it said nothing", and `svResolveHour24` applies a fallback the caller
 * supplies. Two functions, and the ambiguity is visible in the type.
 */

export interface SvParsedTime {
  /** Hour exactly as written — `0`–`23`, or `1`–`12` when a period was named. */
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** The day period the text named, or `null` when it named none. */
  readonly period: 'AM' | 'PM' | null;
}

/**
 * Day-period markers, as a prefix test rather than a table of every locale.
 *
 * ★ The Latin ones cover `am`/`a.m.`/`AM`; `ص`/`م` are Arabic, `午前`/`午後`
 *   Japanese and `오전`/`오후` Korean — the four scripts where a day period is
 *   NOT a Latin abbreviation and where a user typing on their own keyboard
 *   produces something `/am|pm/i` cannot see. This is not exhaustive and does
 *   not pretend to be: `FI-28-M4` is the locale-complete version, and until it
 *   lands an unrecognised marker means `period: null`, which is the same answer
 *   as typing no marker — a fallback, never a wrong time.
 */
const AM_MARKERS = ['am', 'a.m.', 'a', 'ص', '午前', '오전'];
const PM_MARKERS = ['pm', 'p.m.', 'p', 'م', '午後', '오후'];

/**
 * ★★★ `م` IS A PREFIX OF NOTHING AND A SUFFIX OF EVERYTHING, so the Arabic
 *     markers are matched last and only against what is left after the digits.
 *     Checking `'a'` before `'am'` would read "am" as AM plus a stray `m`,
 *     which is harmless, but checking `'ص'` against a string still containing
 *     digits is not. Longest first, on the residue only.
 */
function readPeriod(rest: string): 'AM' | 'PM' | null {
  const t = rest.trim().toLowerCase();
  if (!t) return null;
  for (const m of [...PM_MARKERS].sort((a, b) => b.length - a.length)) {
    if (t === m) return 'PM';
  }
  for (const m of [...AM_MARKERS].sort((a, b) => b.length - a.length)) {
    if (t === m) return 'AM';
  }
  return null;
}

/**
 * Parse a typed time into its parts, or `null` when the text is not a time.
 *
 * Accepts, measured against the forms real users type:
 *
 *     14:30   14.30   14:30:15   1430   143015   2:30 PM   2:30pm   2 pm
 *     ٢:٣٠ م  (Arabic-Indic digits and marker)   １４：３０ (fullwidth)
 *
 * ⚠️ IT RETURNS `null` RATHER THAN A BEST GUESS. `25:00` and `12:61` are not
 *    clamped to `23:59` and `12:59`: a control that silently rewrites what
 *    somebody typed teaches them their typing was accepted. The caller shows
 *    the field as invalid and leaves the text alone to be corrected.
 *
 * ★★ DIGITS ARE NORMALISED, SEPARATORS ARE NOT. `svNormalizeDigits` handles the
 *    Arabic, Bengali, Devanagari and fullwidth digit sets (`FI-16-I3`), but a
 *    fullwidth colon `：` is a separator, and separators are matched explicitly
 *    below so that the set this field accepts is written down rather than
 *    inferred.
 */
export function svParseTime(text: string): SvParsedTime | null {
  const raw = svNormalizeDigits(String(text ?? '')).trim();
  if (!raw) return null;

  // Split the digits-and-separators head from whatever trails it, so the period
  // marker is read from the residue rather than pattern-matched inside the time.
  const m = /^([\d\s:.：：]+)(.*)$/u.exec(raw);
  if (!m) return null;

  const head = m[1].replace(/[：：]/gu, ':').replace(/\./g, ':').trim();
  const period = readPeriod(m[2]);
  if (m[2].trim() && period === null) return null; // trailing text that is not a period

  let parts: string[];
  if (head.includes(':')) {
    parts = head.split(':').map((p) => p.trim());
  } else {
    // ★ The bare-digits forms. `1430` and `143015` are what a fast typist and a
    //   barcode-style paste both produce; `14` alone is a whole hour.
    const d = head.replace(/\s+/g, '');
    if (!/^\d+$/.test(d)) return null;
    if (d.length <= 2) parts = [d];
    else if (d.length === 3) parts = [d.slice(0, 1), d.slice(1)];
    else if (d.length === 4) parts = [d.slice(0, 2), d.slice(2)];
    else if (d.length === 5) parts = [d.slice(0, 1), d.slice(1, 3), d.slice(3)];
    else if (d.length === 6) parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4)];
    else return null;
  }
  if (parts.length > 3) return null;
  /**
   * ★★ THIS ALSO REJECTS THE HALF-TYPED TIME, and that is worth saying because
   *    an explicit `parts.some(p => p === '')` guard used to sit above it. The
   *    guard was redundant — `''` fails `\d{1,2}` — and a fire-test proved it:
   *    deleting the guard changed no test, while deleting THIS line turns the
   *    "refuses a half-typed time" case red. A second check that no test can
   *    distinguish from the first is the kind of line somebody later removes as
   *    dead, correctly, and then nobody remembers what it was for.
   *
   *    What it means: `14:` splits to `['14', '']`, and reading that as 14:00
   *    would commit a value the user has not finished choosing — on every
   *    keystroke, since this runs as they type.
   */
  if (!parts.every((p) => /^\d{1,2}$/.test(p))) return null;

  const hour = Number(parts[0]);
  const minute = parts.length > 1 ? Number(parts[1]) : 0;
  const second = parts.length > 2 ? Number(parts[2]) : 0;

  if (minute > 59 || second > 59) return null;
  // With a period named, the hour is a 12-hour hour and 0 is not one of them.
  if (period !== null && (hour < 1 || hour > 12)) return null;
  if (period === null && hour > 23) return null;

  return { hour, minute, second, period };
}

/**
 * The 24-hour hour a parsed time means, given what the control already shows.
 *
 * @param fallback the period to assume when the text named none AND the hour
 *   could be either — `null` reads a bare `1`–`12` as a 24-hour hour.
 *
 * ★★★ THE `12` CASES ARE THE ONES THAT GO WRONG. 12 AM is `00` and 12 PM is
 *     `12`, which is the opposite of the `+12` rule that works for every other
 *     hour. Both have their own test.
 *
 * ⚠️ A bare hour ABOVE 12 is unambiguous and the fallback is ignored: somebody
 *    typing `14:30` into a 12-hour control while it shows AM means 14:30, not
 *    02:30. Honouring the fallback there would make the control disagree with
 *    the only unambiguous thing the user could have done.
 */
export function svResolveHour24(parsed: SvParsedTime, fallback: 'AM' | 'PM' | null): number {
  const period = parsed.period ?? (parsed.hour >= 1 && parsed.hour <= 12 ? fallback : null);
  if (period === null) return parsed.hour;
  if (period === 'AM') return parsed.hour === 12 ? 0 : parsed.hour;
  return parsed.hour === 12 ? 12 : parsed.hour + 12;
}

/** `'HH:mm'`, or `'HH:mm:ss'` when `withSeconds`. */
export function svFormatTime(hour: number, minute: number, second: number, withSeconds = false): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return withSeconds ? `${p(hour)}:${p(minute)}:${p(second)}` : `${p(hour)}:${p(minute)}`;
}
