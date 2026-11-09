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
 *   produces something `/am|pm/i` cannot see. This list is the locale-free
 *   floor; pass `{ locale }` and the locale's own markers (`svDayPeriods`,
 *   `FI-28-M4`) are read too. Anything still unrecognised means
 *   `period: null` — the same answer as typing no marker, never a wrong time.
 */
const AM_MARKERS = ['am', 'a.m.', 'a', 'ص', '午前', '오전', '上午'];
const PM_MARKERS = ['pm', 'p.m.', 'p', 'م', '午後', '오후', '下午'];

/**
 * Markers that may come BEFORE the digits — the CJK forms, which a Japanese,
 * Korean or Chinese clock writes first (`午後2:30`, `오후 2:30`, `下午2:30`).
 * Only multi-letter, non-Latin markers: a leading Latin `a` is far more likely
 * a typo than "AM".
 */
const PREFIX_MARKERS = ['午前', '午後', '오전', '오후', '上午', '下午'];

/** A locale's own day periods, and whether its clock writes them first. */
export interface SvDayPeriods {
  /** The morning marker, as `Intl` formats 09:00 in this locale. @example 'AM', '午前', 'a.m.' */
  readonly am: string;
  /** The afternoon marker, as `Intl` formats 15:00. */
  readonly pm: string;
  /** `true` when the locale writes the period before the time (ja, ko, zh). */
  readonly before: boolean;
}

const DAY_PERIODS = new Map<string, SvDayPeriods>();

/**
 * The day periods `locale` actually uses on a 12-hour clock (`FI-28-M4`).
 *
 * ★★★ `AM`/`PM` IS ONE LOCALE'S ANSWER. A Japanese clock says 午前/午後 and
 *     writes it first, Spanish says `a. m.`/`p. m.`, Arabic `ص`/`م` — and a
 *     12-hour picker that renders the literals `AM` and `PM` for everyone is
 *     an English control with translated chrome. `Intl.DateTimeFormat` knows
 *     every locale's markers; this asks it, once per locale.
 *
 * Falls back to `AM`/`PM` (period after the time) where `Intl` cannot answer.
 */
export function svDayPeriods(locale = ''): SvDayPeriods {
  const key = locale || '';
  const cached = DAY_PERIODS.get(key);
  if (cached) return cached;
  let out: SvDayPeriods = { am: 'AM', pm: 'PM', before: false };
  try {
    const fmt = new Intl.DateTimeFormat(locale || undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
    const at = (h: number) => fmt.formatToParts(new Date(Date.UTC(2000, 0, 1, h, 0)));
    const morning = at(9);
    const am = morning.find((p) => p.type === 'dayPeriod')?.value.trim();
    const pm = at(15).find((p) => p.type === 'dayPeriod')?.value.trim();
    if (am && pm && am !== pm) {
      const period = morning.findIndex((p) => p.type === 'dayPeriod');
      const hour = morning.findIndex((p) => p.type === 'hour');
      out = { am, pm, before: period >= 0 && hour >= 0 && period < hour };
    }
  } catch {
    // An unknown locale tag: the English markers, which the parser reads anyway.
  }
  DAY_PERIODS.set(key, out);
  return out;
}

/** Options for {@link svParseTime}. */
export interface SvParseTimeOptions {
  /**
   * Also read this locale's own day periods (`svDayPeriods`), before or after
   * the digits — so a time the picker displayed in that locale parses back.
   */
  readonly locale?: string;
}

/** Lower-case and drop spaces, so `p. m.` and `p.m.` compare equal. */
const squash = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

/**
 * ★★★ `م` IS A PREFIX OF NOTHING AND A SUFFIX OF EVERYTHING, so the Arabic
 *     markers are matched last and only against what is left after the digits.
 *     Checking `'a'` before `'am'` would read "am" as AM plus a stray `m`,
 *     which is harmless, but checking `'ص'` against a string still containing
 *     digits is not. Longest first, on the residue only.
 */
function readPeriod(rest: string, local?: SvDayPeriods): 'AM' | 'PM' | null {
  const t = rest.trim().toLowerCase();
  if (!t) return null;
  if (local) {
    if (squash(t) === squash(local.pm)) return 'PM';
    if (squash(t) === squash(local.am)) return 'AM';
  }
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
export function svParseTime(text: string, options: SvParseTimeOptions = {}): SvParsedTime | null {
  let raw = svNormalizeDigits(String(text ?? '')).trim();
  if (!raw) return null;
  const local = options.locale !== undefined ? svDayPeriods(options.locale) : undefined;

  // A period written FIRST — `午後2:30`, `오후 2:30`, or the locale's own
  // marker when its clock leads with it (`FI-28-M4`).
  let leading: 'AM' | 'PM' | null = null;
  const prefixes = [...PREFIX_MARKERS, ...(local?.before ? [local.am, local.pm] : [])]
    .sort((a, b) => b.length - a.length);
  for (const marker of prefixes) {
    if (raw.toLowerCase().startsWith(marker.toLowerCase())) {
      leading = readPeriod(marker, local);
      raw = raw.slice(marker.length).trim();
      break;
    }
  }

  // Split the digits-and-separators head from whatever trails it, so the period
  // marker is read from the residue rather than pattern-matched inside the time.
  const m = /^([\d\s:.：：]+)(.*)$/u.exec(raw);
  if (!m) return null;

  const head = m[1].replace(/[：：]/gu, ':').replace(/\./g, ':').trim();
  const trailing = readPeriod(m[2], local);
  if (m[2].trim() && trailing === null) return null; // trailing text that is not a period
  if (leading !== null && trailing !== null) return null; // two periods is not a time
  const period = leading ?? trailing;

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
