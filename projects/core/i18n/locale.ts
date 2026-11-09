/**
 * The one locale the kit formats with (FL-B1a).
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 *
 * ★★★ FIFTY-EIGHT COMPONENTS DECIDED THE LANGUAGE FOR THE APP. `'en-US'` was
 *     typed into the gantt's month headers, the scheduler's day names, the
 *     date pickers, every count in the AI widgets and the default of every
 *     commerce `locale` input — and twelve more calls passed no locale at all,
 *     which is not neutral either: it is the *browser's* locale, so the same
 *     page rendered "1,234" for one user and "1.234" for the next while the
 *     app around them said something else. A German app had no single place to
 *     say "German"; it had to find each input, and could not reach the rest.
 *
 * ★★ ONE ANSWER, AND IT IS ANGULAR'S UNLESS YOU SAY OTHERWISE. `SV_LOCALE`
 *    defaults to the application's `LOCALE_ID` — the value `DatePipe` and
 *    `DecimalPipe` already use — so an app that set it gets the kit in the same
 *    language for free. `provideSvLocale('de-DE')` sets the kit's alone. A
 *    component's own `locale` input still wins for that one instance.
 *
 * ★ `SV_MACHINE_LOCALE` IS NOT A LOCALE ANYONE CHOSE. It has two jobs, and
 *   "the app's language" is neither: (1) the fixed format three time-zone
 *   readers PARSE `Intl.DateTimeFormat#formatToParts` output in — they need a
 *   format that never changes, and `en-US` is the one the parsing was written
 *   against; (2) the last resort when a tag is empty or invalid, where `Intl`
 *   would otherwise throw and leave a calendar with no month names at all.
 *   It is the only `'en-US'` literal `check:ui` → `locale-literal` allows.
 */
import { InjectionToken, LOCALE_ID, inject, type Provider } from '@angular/core';

/** The fixed locale `Intl` output is PARSED in, and the fallback for an empty or invalid tag. */
export const SV_MACHINE_LOCALE = 'en-US';

/** The locale every kit component formats with. Defaults to Angular's `LOCALE_ID`. */
export const SV_LOCALE = new InjectionToken<string>('SV_LOCALE', {
  providedIn: 'root',
  factory: () => inject(LOCALE_ID),
});

/**
 * Set the locale the kit formats with, independently of `LOCALE_ID`.
 *
 * The tag is canonicalised (`'de-de'` → `'de-DE'`); an invalid one throws at
 * bootstrap rather than rendering every date in a fallback later.
 */
export function provideSvLocale(locale: string): Provider {
  let canonical: string;
  try {
    [canonical] = Intl.getCanonicalLocales(locale.trim());
  } catch {
    throw new RangeError(`provideSvLocale: "${locale}" is not a BCP 47 language tag (e.g. "de-DE").`);
  }
  if (!canonical) throw new RangeError('provideSvLocale: the locale is empty.');
  return { provide: SV_LOCALE, useValue: canonical };
}

/** The kit's locale. Call in an injection context — typically an `input()` default. */
export function svLocale(): string {
  return inject(SV_LOCALE);
}

/**
 * An integer count with the locale's grouping — `1,234` / `1.234` / `1 234`.
 * `''` means "do not localise" (core's convention): the plain digits.
 */
export function svFormatCount(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '';
  const n = Math.round(value);
  if (!locale) return String(n);
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

/**
 * A KPI-sized number: abbreviated from 1,000 up ("12.5K", "-2.5M", "1.2万",
 * "2,5 Mio."), grouped below it ("999", "-1,234.5" stays "-1.2K"), in the
 * locale's own compact notation with one decimal. The sign survives on both
 * sides of the threshold, so a loss and a gain of the same size read alike.
 * Non-finite values give `''`; `''` as the locale means the runtime default.
 */
export function svFormatCompact(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '';
  const tag = locale || undefined;
  try {
    if (Math.abs(value) < 1000) return new Intl.NumberFormat(tag, { maximumFractionDigits: 3 }).format(value);
    return new Intl.NumberFormat(tag, { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * The twelve month names in the locale, January first — `'long'` ("März"),
 * `'short'` ("Mär"). Read from `Intl`, never a table; an invalid tag falls back
 * to the machine locale's names rather than to nothing.
 */
export function svMonthLabels(locale: string, width: 'long' | 'short' = 'long'): string[] {
  const names = (tag: string): string[] => {
    const format = new Intl.DateTimeFormat(tag, { month: width, timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, m) => format.format(new Date(Date.UTC(2023, m, 1))));
  };
  try {
    return names(locale || SV_MACHINE_LOCALE);
  } catch {
    return names(SV_MACHINE_LOCALE);
  }
}
