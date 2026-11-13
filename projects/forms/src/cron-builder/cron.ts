/**
 * Standard five-field cron — parse, format, describe and schedule (FL-F9).
 *
 *   minute  hour  day-of-month  month  day-of-week
 *   0-59    0-23  1-31          1-12   0-7 (0 and 7 are Sunday)
 *
 * Each field takes `*`, a value, a range `a-b`, a step `*\/n`, `a-b/n` or
 * `a/n`, and comma lists of those. Month and weekday names (`JAN`, `MON`, any
 * case) and the `@hourly` / `@daily` / `@midnight` / `@weekly` / `@monthly` /
 * `@yearly` / `@annually` shorthands are accepted on input; output is always
 * the normalised numeric form.
 *
 * ★★★ DAY-OF-MONTH AND DAY-OF-WEEK ARE OR-ED WHEN BOTH ARE RESTRICTED.
 *     `0 0 1 * 1` runs on the 1st of every month AND on every Monday — not on
 *     Mondays that fall on the 1st. That is how Vixie cron and cronie behave,
 *     and it is the most misread rule in cron. The exception is also theirs:
 *     when either field is written starting with `*` (`*` or `*\/2`) the two
 *     are AND-ed, so `0 0 *\/2 * 1` is "every second day of the month, but only
 *     on a Monday". That is why {@link SvCronField.star} is kept for those two
 *     fields: `1-31` and `*` match the same days but do not mean the same thing
 *     next to a restricted weekday, and normalising one into the other would
 *     change when a job runs.
 *
 * No dependency: the parser is ~100 lines, and `Intl` already carries the
 * weekday and month names and the IANA time zone rules.
 */
import {
  SV_MACHINE_LOCALE,
  svComposeDateTime,
  svFirstDayOfWeek,
  svFormatLabel,
  svMonthLabels,
  svZoneOffsetMinutes,
  type SvLabelParams,
} from '@styloviz/core/i18n';
import { SV_FORMS_LABELS, type SvFormsLabels } from '@styloviz/forms/labels';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The five fields, in order. */
export type SvCronFieldName = 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';

/** One parsed field. */
export interface SvCronField {
  /** The values the field matches, ascending, no duplicates. Day of week is 0–6, Sunday = 0. */
  readonly values: readonly number[];
  /**
   * The field matches from its first value in one even step to the end of its
   * range (`*` or `*\/n`). For day-of-month and day-of-week it is true only when
   * the field was WRITTEN that way — see the OR rule in this file's header.
   */
  readonly star: boolean;
}

/** A parsed cron expression. */
export interface SvCron {
  readonly minute: SvCronField;
  readonly hour: SvCronField;
  readonly dayOfMonth: SvCronField;
  readonly month: SvCronField;
  readonly dayOfWeek: SvCronField;
}

/**
 * Why an expression was rejected. `no-days` is the visual editor's own: a
 * weekly or monthly schedule with no day ticked.
 */
export type SvCronErrorCode = 'empty' | 'field-count' | 'invalid' | 'range' | 'step' | 'no-days';

/** A rejection, with what the message needs to say where. */
export interface SvCronError {
  readonly code: SvCronErrorCode;
  /** The field the problem is in (`invalid`, `range`, `step`). */
  readonly field?: SvCronFieldName;
  /** The text that was rejected, as written. */
  readonly token?: string;
  /** `range`: the field's lowest value. */
  readonly min?: number;
  /** `range`: the field's highest value; `step`: the largest step allowed. */
  readonly max?: number;
}

/** What {@link svParseCron} returns. */
export type SvCronParseResult =
  | { readonly ok: true; readonly cron: SvCron; readonly expression: string }
  | { readonly ok: false; readonly error: SvCronError };

/** The builder's frequency modes. `custom` is the raw expression. */
export type SvCronMode = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

/** The modes the visual editor draws. */
export type SvCronVisualMode = Exclude<SvCronMode, 'custom'>;

/**
 * The visual editor's state. Every field is kept whatever the mode, so that
 * switching mode keeps the time, days and interval already chosen.
 */
export interface SvCronVisual {
  readonly mode: SvCronVisualMode;
  /** `minutes`: every N minutes — one of {@link SV_CRON_MINUTE_INTERVALS}. */
  readonly minuteInterval: number;
  /** `hourly`: every N hours — one of {@link SV_CRON_HOUR_INTERVALS}. */
  readonly hourInterval: number;
  /** `hourly` / `daily` / `weekly` / `monthly`: the minute, 0–59. */
  readonly minute: number;
  /** `daily` / `weekly` / `monthly`: the hour, 0–23. */
  readonly hour: number;
  /** `weekly`: the days, 0–6 (Sunday = 0). */
  readonly weekdays: readonly number[];
  /** `monthly`: the days of the month, 1–31. */
  readonly monthDays: readonly number[];
}

/** The labels the cron helpers and `sv-cron-builder` read — a subset of the `forms` namespace. */
export type SvCronLabels = Pick<
  SvFormsLabels,
  | 'hour'
  | 'minute'
  | 'cronLegend'
  | 'cronFrequency'
  | 'cronModeMinutes'
  | 'cronModeHourly'
  | 'cronModeDaily'
  | 'cronModeWeekly'
  | 'cronModeMonthly'
  | 'cronModeCustom'
  | 'cronChooseFrequency'
  | 'cronEvery'
  | 'cronIntervalMinutes'
  | 'cronIntervalHours'
  | 'cronAtMinute'
  | 'cronWeekdays'
  | 'cronMonthDays'
  | 'cronExpression'
  | 'cronExpressionHint'
  | 'cronPreview'
  | 'cronNextRuns'
  | 'cronNoRuns'
  | 'cronErrEmpty'
  | 'cronErrFieldCount'
  | 'cronErrInvalid'
  | 'cronErrRange'
  | 'cronErrStep'
  | 'cronErrNoDays'
  | 'cronFieldMinute'
  | 'cronFieldHour'
  | 'cronFieldDayOfMonth'
  | 'cronFieldMonth'
  | 'cronFieldDayOfWeek'
  | 'cronDescEveryNMinutes'
  | 'cronDescAtMinutes'
  | 'cronDescPastEveryNHours'
  | 'cronDescDuringHours'
  | 'cronDescHourly'
  | 'cronDescDaily'
  | 'cronDescWeekdays'
  | 'cronDescWeekly'
  | 'cronDescMonthly'
  | 'cronDescAtTimes'
  | 'cronDescOnDays'
  | 'cronDescOnEveryNthDay'
  | 'cronDescOnWeekdays'
  | 'cronDescOrWeekdays'
  | 'cronDescIfWeekdays'
  | 'cronDescInMonths'
  | 'cronRange'
  | 'cronOrdinalOne'
  | 'cronOrdinalTwo'
  | 'cronOrdinalFew'
  | 'cronOrdinalOther'
>;

/** Options for {@link svDescribeCron} and {@link svCronErrorMessage}. */
export interface SvCronDescribeOptions {
  /** BCP 47 locale for weekday/month names, times, ordinals and lists. `''` uses `en-US`. */
  readonly locale?: string;
  /** Text over the English defaults — pass the `forms` labels in effect. */
  readonly labels?: Partial<SvCronLabels>;
}

/** Options for {@link svNextCronRuns}. */
export interface SvCronRunOptions {
  /** Runs strictly after this instant. @default now */
  readonly from?: Date | number;
  /** How many runs, 0–50. @default 3 */
  readonly count?: number;
  /** IANA zone the schedule's wall clock is in. @default the runtime's zone */
  readonly timeZone?: string | null;
}

/** The intervals the `minutes` mode offers — the divisors of 60, so "every N minutes" is really every N. */
export const SV_CRON_MINUTE_INTERVALS: readonly number[] = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30];

/** The intervals the `hourly` mode offers — the divisors of 24. */
export const SV_CRON_HOUR_INTERVALS: readonly number[] = [1, 2, 3, 4, 6, 8, 12];

/** Where the visual editor starts: daily at 09:00, and sensible values for every other mode. */
export const SV_CRON_VISUAL_DEFAULTS: SvCronVisual = {
  mode: 'daily',
  minuteInterval: 15,
  hourInterval: 1,
  minute: 0,
  hour: 9,
  weekdays: [1],
  monthDays: [1],
};

// ─── Field specs ──────────────────────────────────────────────────────────────

interface FieldSpec {
  readonly name: SvCronFieldName;
  readonly min: number;
  readonly max: number;
  /** The largest step that still yields two values. */
  readonly stepMax: number;
  /** The last value a `*` reaches (6 for weekdays — 7 is Sunday again). */
  readonly top: number;
  readonly names?: readonly string[];
  readonly nameBase: number;
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const SPECS: readonly FieldSpec[] = [
  { name: 'minute', min: 0, max: 59, stepMax: 59, top: 59, nameBase: 0 },
  { name: 'hour', min: 0, max: 23, stepMax: 23, top: 23, nameBase: 0 },
  { name: 'dayOfMonth', min: 1, max: 31, stepMax: 30, top: 31, nameBase: 0 },
  { name: 'month', min: 1, max: 12, stepMax: 11, top: 12, names: MONTH_NAMES, nameBase: 1 },
  { name: 'dayOfWeek', min: 0, max: 7, stepMax: 6, top: 6, names: DAY_NAMES, nameBase: 0 },
];

const SPEC: Readonly<Record<SvCronFieldName, FieldSpec>> = {
  minute: SPECS[0],
  hour: SPECS[1],
  dayOfMonth: SPECS[2],
  month: SPECS[3],
  dayOfWeek: SPECS[4],
};

/** The two fields whose `*` means something beyond its values. */
const DAY_FIELDS: ReadonlySet<SvCronFieldName> = new Set(['dayOfMonth', 'dayOfWeek']);

const MACROS: Readonly<Record<string, string>> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

/** Longest expression read — far beyond any real one, and a bound on the work. */
const MAX_LENGTH = 512;

// ─── Parse ────────────────────────────────────────────────────────────────────

type FieldResult = { readonly ok: true; readonly field: SvCronField } | { readonly ok: false; readonly error: SvCronError };

function readValue(token: string, spec: FieldSpec): number | SvCronError {
  if (/^\d{1,3}$/.test(token)) {
    const n = Number(token);
    return n < spec.min || n > spec.max
      ? { code: 'range', field: spec.name, token, min: spec.min, max: spec.max }
      : n;
  }
  const index = spec.names?.indexOf(token.toUpperCase()) ?? -1;
  if (index >= 0) return index + spec.nameBase;
  if (/^\d+$/.test(token)) return { code: 'range', field: spec.name, token, min: spec.min, max: spec.max };
  return { code: 'invalid', field: spec.name, token };
}

function parseField(text: string, spec: FieldSpec): FieldResult {
  const values = new Set<number>();
  for (const item of text.split(',')) {
    const m = /^(?:(\*)|([^\-/*]+)(?:-([^\-/*]+))?)(?:\/([^/]*))?$/.exec(item);
    if (!m) return { ok: false, error: { code: 'invalid', field: spec.name, token: item || text } };
    let lo: number;
    let hi: number;
    if (m[1]) {
      lo = spec.min;
      hi = spec.top;
    } else {
      const a = readValue(m[2], spec);
      if (typeof a !== 'number') return { ok: false, error: a };
      lo = a;
      if (m[3] !== undefined) {
        const b = readValue(m[3], spec);
        if (typeof b !== 'number') return { ok: false, error: b };
        hi = b;
      } else {
        // `a/n` runs from a to the end of the range, as in Vixie cron and cronie.
        hi = m[4] !== undefined ? spec.max : a;
      }
    }
    if (lo > hi) return { ok: false, error: { code: 'invalid', field: spec.name, token: item } };
    let step = 1;
    if (m[4] !== undefined) {
      step = /^\d{1,3}$/.test(m[4]) ? Number(m[4]) : 0;
      if (step < 1 || step > spec.stepMax) {
        return { ok: false, error: { code: 'step', field: spec.name, token: item, max: spec.stepMax } };
      }
    }
    for (let v = lo; v <= hi; v += step) values.add(spec.name === 'dayOfWeek' && v === 7 ? 0 : v);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const writtenStar = text.startsWith('*');
  const stepped = starStep(sorted, spec) !== null;
  return {
    ok: true,
    field: { values: sorted, star: DAY_FIELDS.has(spec.name) ? writtenStar && stepped : stepped },
  };
}

/**
 * Parse a five-field cron expression.
 *
 * Returns `{ ok: true, cron, expression }` — `expression` is the normalised
 * numeric form (`0 9 * * MON-FRI` → `0 9 * * 1-5`, `0 0 * * 7` → `0 0 * * 0`) —
 * or `{ ok: false, error }` naming the field and the text it rejected.
 */
export function svParseCron(expr: string): SvCronParseResult {
  const text = typeof expr === 'string' ? expr.trim() : '';
  if (!text) return { ok: false, error: { code: 'empty' } };
  if (text.length > MAX_LENGTH) return { ok: false, error: { code: 'invalid', token: text.slice(0, 24) } };
  const source = MACROS[text.toLowerCase()] ?? text;
  const parts = source.split(/\s+/);
  if (parts.length !== 5) return { ok: false, error: { code: 'field-count' } };
  const fields: SvCronField[] = [];
  for (let i = 0; i < 5; i++) {
    const r = parseField(parts[i], SPECS[i]);
    if (!r.ok) return { ok: false, error: r.error };
    fields.push(r.field);
  }
  const cron: SvCron = {
    minute: fields[0],
    hour: fields[1],
    dayOfMonth: fields[2],
    month: fields[3],
    dayOfWeek: fields[4],
  };
  return { ok: true, cron, expression: svFormatCron(cron) };
}

// ─── Format ───────────────────────────────────────────────────────────────────

/**
 * The step `n` when `values` is exactly what `*\/n` gives (n = 1 for `*`):
 * starting at the field's minimum, evenly spaced, and running to the end.
 */
function starStep(values: readonly number[], spec: FieldSpec): number | null {
  if (values.length < 2 || values[0] !== spec.min) return null;
  const d = values[1] - values[0];
  for (let i = 2; i < values.length; i++) if (values[i] - values[i - 1] !== d) return null;
  return values[values.length - 1] + d > spec.top ? d : null;
}

/** Maximal runs of consecutive values. */
function runs(values: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
}

/**
 * The shortest plain spelling: a range for three or more consecutive values, a
 * stepped range for four or more evenly spaced ones (`1-26/5`), a list for the
 * rest (`1,3,5` reads better than `1-5/2`).
 */
function compress(values: readonly number[]): string {
  if (values.length >= 3) {
    const d = values[1] - values[0];
    if (values.every((v, i) => i === 0 || v - values[i - 1] === d) && (d === 1 || values.length >= 4)) {
      const span = `${values[0]}-${values[values.length - 1]}`;
      return d === 1 ? span : `${span}/${d}`;
    }
  }
  return runs(values)
    .flatMap(([a, b]) => (b - a >= 2 ? [`${a}-${b}`] : a === b ? [String(a)] : [String(a), String(b)]))
    .join(',');
}

function formatField(field: SvCronField, spec: FieldSpec): string {
  const values = [
    ...new Set(
      (field.values ?? [])
        .filter((v) => Number.isInteger(v) && v >= spec.min && v <= spec.max)
        .map((v) => (spec.name === 'dayOfWeek' && v === 7 ? 0 : v)),
    ),
  ].sort((a, b) => a - b);
  if (values.length === 0) throw new RangeError(`svFormatCron: the ${spec.name} field has no values`);
  const step = starStep(values, spec);
  if (step !== null && (field.star || !DAY_FIELDS.has(spec.name))) return step === 1 ? '*' : `*/${step}`;
  return compress(values);
}

/**
 * Write a parsed cron back as its normalised numeric expression.
 *
 * Throws a `RangeError` when a field has no value in range — a struct from
 * {@link svParseCron} or {@link svCronFromVisual} never does.
 */
export function svFormatCron(cron: SvCron): string {
  return SPECS.map((spec) => formatField(cron[spec.name], spec)).join(' ');
}

// ─── Visual modes ─────────────────────────────────────────────────────────────

const fieldOf = (values: readonly number[], star: boolean): SvCronField => ({ values, star });
const all = (spec: FieldSpec): SvCronField =>
  fieldOf(Array.from({ length: spec.top - spec.min + 1 }, (_, i) => spec.min + i), true);
const every = (spec: FieldSpec, n: number): SvCronField =>
  fieldOf(Array.from({ length: Math.floor((spec.top - spec.min) / n) + 1 }, (_, i) => spec.min + i * n), true);
const isAll = (f: SvCronField, spec: FieldSpec): boolean => f.star && starStep(f.values, spec) === 1;
const single = (f: SvCronField): number | null => (f.values.length === 1 ? f.values[0] : null);
const intIn = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const uniqueIn = (list: readonly number[], lo: number, hi: number): number[] =>
  [...new Set((Array.isArray(list) ? list : []).filter((n) => intIn(n, lo, hi)))].sort((a, b) => a - b);

function asCron(input: string | SvCron): SvCron | null {
  if (typeof input !== 'string') return input ?? null;
  const r = svParseCron(input);
  return r.ok ? r.cron : null;
}

/**
 * The visual mode an expression is, or `null` when only Custom can show it
 * (`*\/7` minutes, a month restriction, both day fields, a list of hours…).
 * Fields the mode does not use are taken from `base`.
 */
export function svCronToVisual(input: string | SvCron, base: SvCronVisual = SV_CRON_VISUAL_DEFAULTS): SvCronVisual | null {
  const c = asCron(input);
  if (!c) return null;
  const S = SPEC;
  if (!isAll(c.month, S.month)) return null;
  const domAll = isAll(c.dayOfMonth, S.dayOfMonth);
  const dowAll = isAll(c.dayOfWeek, S.dayOfWeek);
  const minuteStep = c.minute.star ? starStep(c.minute.values, S.minute) : null;
  const hourStep = c.hour.star ? starStep(c.hour.values, S.hour) : null;
  const m = single(c.minute);
  const h = single(c.hour);

  if (domAll && dowAll) {
    if (minuteStep !== null && hourStep === 1 && SV_CRON_MINUTE_INTERVALS.includes(minuteStep)) {
      return { ...base, mode: 'minutes', minuteInterval: minuteStep };
    }
    if (m !== null && hourStep !== null && SV_CRON_HOUR_INTERVALS.includes(hourStep)) {
      return { ...base, mode: 'hourly', minute: m, hourInterval: hourStep };
    }
    if (m !== null && h !== null) return { ...base, mode: 'daily', minute: m, hour: h };
    return null;
  }
  if (m === null || h === null) return null;
  if (domAll && !c.dayOfWeek.star) return { ...base, mode: 'weekly', minute: m, hour: h, weekdays: [...c.dayOfWeek.values] };
  if (dowAll && !c.dayOfMonth.star) return { ...base, mode: 'monthly', minute: m, hour: h, monthDays: [...c.dayOfMonth.values] };
  return null;
}

/**
 * The cron a visual state stands for, or `null` when it has none — a weekly or
 * monthly schedule with no day, or a value out of range.
 */
export function svCronFromVisual(v: SvCronVisual): SvCron | null {
  const S = SPEC;
  const minute = intIn(v.minute, 0, 59) ? v.minute : null;
  const hour = intIn(v.hour, 0, 23) ? v.hour : null;
  const base = { month: all(S.month), dayOfMonth: all(S.dayOfMonth), dayOfWeek: all(S.dayOfWeek) };
  switch (v.mode) {
    case 'minutes':
      return SV_CRON_MINUTE_INTERVALS.includes(v.minuteInterval)
        ? { ...base, minute: every(S.minute, v.minuteInterval), hour: all(S.hour) }
        : null;
    case 'hourly':
      return minute !== null && SV_CRON_HOUR_INTERVALS.includes(v.hourInterval)
        ? { ...base, minute: fieldOf([minute], false), hour: every(S.hour, v.hourInterval) }
        : null;
    case 'daily':
    case 'weekly':
    case 'monthly': {
      if (minute === null || hour === null) return null;
      const time = { minute: fieldOf([minute], false), hour: fieldOf([hour], false) };
      if (v.mode === 'daily') return { ...base, ...time };
      if (v.mode === 'weekly') {
        const days = uniqueIn(v.weekdays.map((d) => (d === 7 ? 0 : d)), 0, 6);
        return days.length ? { ...base, ...time, dayOfWeek: fieldOf(days, false) } : null;
      }
      const days = uniqueIn(v.monthDays, 1, 31);
      return days.length ? { ...base, ...time, dayOfMonth: fieldOf(days, false) } : null;
    }
    default:
      return null;
  }
}

/**
 * The closest visual state to an expression the visual modes cannot show:
 * keeps whatever single minute, hour, interval, weekdays or month days it has,
 * over `base`. What the builder opens with when you leave Custom.
 */
export function svCronVisualHint(input: string | SvCron, base: SvCronVisual = SV_CRON_VISUAL_DEFAULTS): SvCronVisual {
  const exact = svCronToVisual(input, base);
  if (exact) return exact;
  const c = asCron(input);
  if (!c) return base;
  const minuteStep = c.minute.star ? starStep(c.minute.values, SPEC.minute) : null;
  const hourStep = c.hour.star ? starStep(c.hour.values, SPEC.hour) : null;
  const m = single(c.minute);
  const h = single(c.hour);
  return {
    ...base,
    minute: m ?? base.minute,
    hour: h ?? base.hour,
    minuteInterval: minuteStep !== null && SV_CRON_MINUTE_INTERVALS.includes(minuteStep) ? minuteStep : base.minuteInterval,
    hourInterval: hourStep !== null && SV_CRON_HOUR_INTERVALS.includes(hourStep) ? hourStep : base.hourInterval,
    weekdays: c.dayOfWeek.star ? base.weekdays : [...c.dayOfWeek.values],
    monthDays: c.dayOfMonth.star ? base.monthDays : [...c.dayOfMonth.values],
  };
}

// ─── Describe ─────────────────────────────────────────────────────────────────

function safe<T>(make: () => T, fallback: () => T): T {
  try {
    return make();
  } catch {
    return fallback();
  }
}

/** The locale-bound pieces a description is built from. */
function describer(options: SvCronDescribeOptions) {
  const locale = options.locale || SV_MACHINE_LOCALE;
  const t: SvCronLabels = { ...pickCronLabels(SV_FORMS_LABELS), ...(options.labels ?? {}) };
  const fmt = (template: string, params: SvLabelParams): string => svFormatLabel(template, params, locale);
  const list = (items: readonly string[], type: 'conjunction' | 'disjunction'): string =>
    safe(
      () => new Intl.ListFormat(locale, { style: 'long', type }).format(items),
      () => items.join(', '),
    );
  const number = (n: number): string => safe(() => new Intl.NumberFormat(locale).format(n), () => String(n));
  const timeFormat = safe(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    () => new Intl.DateTimeFormat(SV_MACHINE_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
  );
  const time = (h: number, m: number): string => timeFormat.format(Date.UTC(2023, 0, 1, h, m));
  const weekdayFormat = safe(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }),
    () => new Intl.DateTimeFormat(SV_MACHINE_LOCALE, { weekday: 'long', timeZone: 'UTC' }),
  );
  // 2023-01-01 was a Sunday, in UTC — the same zone the formatter reads it in.
  const weekday = (d: number): string => weekdayFormat.format(Date.UTC(2023, 0, 1 + d));
  const months = svMonthLabels(locale, 'long');
  const ordinalRules = safe(
    () => new Intl.PluralRules(locale, { type: 'ordinal' }),
    () => new Intl.PluralRules(SV_MACHINE_LOCALE, { type: 'ordinal' }),
  );
  const ordinal = (n: number): string => {
    const category = ordinalRules.select(n);
    const template =
      category === 'one' ? t.cronOrdinalOne : category === 'two' ? t.cronOrdinalTwo : category === 'few' ? t.cronOrdinalFew : t.cronOrdinalOther;
    return fmt(template, { n });
  };
  /** Values as list items, with each run of three or more written as a range. */
  const items = (values: readonly number[], name: (v: number) => string): string[] =>
    runs(values).flatMap(([a, b]) =>
      b - a >= 2 ? [fmt(t.cronRange, { from: name(a), to: name(b) })] : a === b ? [name(a)] : [name(a), name(b)],
    );
  const firstDay = safe(() => svFirstDayOfWeek(locale), () => 1);
  /** Weekdays in the locale's week order, ranges included ("Monday through Friday"). */
  const weekdayItems = (values: readonly number[]): string[] => {
    const pos = (d: number): number => (d - firstDay + 7) % 7;
    const ordered = [...values].map(pos).sort((a, b) => a - b);
    return items(ordered, (p) => weekday((p + firstDay) % 7));
  };
  return { t, fmt, list, number, time, weekdayItems, ordinal, items, months };
}

/** Just the cron keys out of the full `forms` labels. */
function pickCronLabels(labels: SvFormsLabels): SvCronLabels {
  const out: Record<string, string> = { hour: labels.hour, minute: labels.minute };
  for (const [key, value] of Object.entries(labels)) if (key.startsWith('cron')) out[key] = value;
  return out as unknown as SvCronLabels;
}

/**
 * A sentence for an expression, in the locale: "Every 15 minutes", "At minute
 * 15 past every hour", "Every weekday at 09:00", "On the 1st and 15th of every
 * month at 06:30". `''` for an invalid expression.
 *
 * When both day fields are restricted the sentence says "…, or on any Monday"
 * — the OR is how cron really behaves, so the description does not hide it.
 */
export function svDescribeCron(input: string | SvCron, options: SvCronDescribeOptions = {}): string {
  const c = asCron(input);
  if (!c) return '';
  const d = describer(options);
  const { t, fmt, list, number, time } = d;
  const S = SPEC;
  const M = c.minute.values;
  const H = c.hour.values;
  const minuteStep = c.minute.star ? starStep(M, S.minute) : null;
  const hourStep = c.hour.star ? starStep(H, S.hour) : null;
  const domAll = isAll(c.dayOfMonth, S.dayOfMonth);
  const dowAll = isAll(c.dayOfWeek, S.dayOfWeek);
  const monthAll = isAll(c.month, S.month);
  const m = single(c.minute);
  const h = single(c.hour);
  const dowText = (type: 'conjunction' | 'disjunction'): string => list(d.weekdayItems(c.dayOfWeek.values), type);
  const domDays = (): string => list(d.items(c.dayOfMonth.values, d.ordinal), 'conjunction');

  // ── The shapes the visual modes make get their own sentence ──
  if (monthAll && domAll && dowAll) {
    if (minuteStep !== null && hourStep === 1 && 60 % minuteStep === 0) return fmt(t.cronDescEveryNMinutes, { n: minuteStep });
    if (m !== null && hourStep !== null && 24 % hourStep === 0) return fmt(t.cronDescHourly, { n: hourStep, minute: m });
    if (m !== null && h !== null) return fmt(t.cronDescDaily, { time: time(h, m) });
  }
  if (monthAll && m !== null && h !== null) {
    if (domAll && !c.dayOfWeek.star) {
      const days = c.dayOfWeek.values;
      if (days.length === 7) return fmt(t.cronDescDaily, { time: time(h, m) });
      if (days.join() === '1,2,3,4,5') return fmt(t.cronDescWeekdays, { time: time(h, m) });
      return fmt(t.cronDescWeekly, { days: dowText('conjunction'), time: time(h, m) });
    }
    if (dowAll && !c.dayOfMonth.star) return fmt(t.cronDescMonthly, { days: domDays(), time: time(h, m) });
  }

  // ── Everything else, clause by clause ──
  const clauses: string[] = [];
  if (hourStep === null && M.length * H.length <= 6) {
    // A handful of times reads best written out: "At 09:00 and 17:00".
    const times = H.flatMap((hh) => M.map((mm) => time(hh, mm)));
    clauses.push(fmt(t.cronDescAtTimes, { times: list(times, 'conjunction') }));
  } else {
    // "Every 7 minutes" would be a lie for `*/7` — it restarts at :00 each hour —
    // so only an even divisor of 60 is called an interval; the rest are listed.
    const atMinutes = !(minuteStep !== null && 60 % minuteStep === 0);
    clauses.push(
      atMinutes
        ? fmt(t.cronDescAtMinutes, { count: M.length, list: list(d.items(M, number), 'conjunction') })
        : fmt(t.cronDescEveryNMinutes, { n: minuteStep ?? 1 }),
    );
    if (hourStep === 1) {
      if (atMinutes) clauses.push(fmt(t.cronDescPastEveryNHours, { n: 1 }));
    } else if (hourStep !== null && 24 % hourStep === 0 && atMinutes) {
      clauses.push(fmt(t.cronDescPastEveryNHours, { n: hourStep }));
    } else {
      clauses.push(fmt(t.cronDescDuringHours, { count: H.length, list: list(d.items(H, number), 'conjunction') }));
    }
  }

  if (!domAll || !dowAll) {
    const domStep = c.dayOfMonth.star ? starStep(c.dayOfMonth.values, S.dayOfMonth) : null;
    const dom =
      domStep !== null && domStep > 1
        ? fmt(t.cronDescOnEveryNthDay, { nth: d.ordinal(domStep) })
        : fmt(t.cronDescOnDays, { days: domDays() });
    if (!domAll && !dowAll) {
      const and = c.dayOfMonth.star || c.dayOfWeek.star;
      clauses.push(fmt(and ? t.cronDescIfWeekdays : t.cronDescOrWeekdays, { dom, days: dowText('disjunction') }));
    } else if (!domAll) {
      clauses.push(dom);
    } else {
      clauses.push(fmt(t.cronDescOnWeekdays, { days: dowText('conjunction') }));
    }
  }
  if (!monthAll) {
    clauses.push(fmt(t.cronDescInMonths, { months: list(d.items(c.month.values, (v) => d.months[v - 1]), 'conjunction') }));
  }
  return clauses.join(', ');
}

/** The message for a rejection, in the locale. */
export function svCronErrorMessage(error: SvCronError, options: SvCronDescribeOptions = {}): string {
  const { t, fmt } = describer(options);
  const fieldName: Record<SvCronFieldName, string> = {
    minute: t.cronFieldMinute,
    hour: t.cronFieldHour,
    dayOfMonth: t.cronFieldDayOfMonth,
    month: t.cronFieldMonth,
    dayOfWeek: t.cronFieldDayOfWeek,
  };
  const field = error.field ? fieldName[error.field] : '';
  const token = error.token ?? '';
  switch (error.code) {
    case 'empty':
      return t.cronErrEmpty;
    case 'field-count':
      return t.cronErrFieldCount;
    case 'range':
      return fmt(t.cronErrRange, { field, token, min: error.min ?? 0, max: error.max ?? 0 });
    case 'step':
      return fmt(t.cronErrStep, { field, token, max: error.max ?? 1 });
    case 'no-days':
      return t.cronErrNoDays;
    default:
      return fmt(t.cronErrInvalid, { field, token });
  }
}

// ─── Next runs ────────────────────────────────────────────────────────────────

/** How far ahead to look: eight years and change, which always contains a 29 February. */
const MAX_DAYS = 366 * 8 + 2;
const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

function validZone(zone: string): boolean {
  return safe(() => !!new Intl.DateTimeFormat(SV_MACHINE_LOCALE, { timeZone: zone }).resolvedOptions().timeZone, () => false);
}

/**
 * The next `count` runs of an expression after `from`, as instants, with the
 * schedule read in `timeZone`. Empty for an invalid expression or zone, or a
 * schedule that never comes round (`0 0 30 2 *`).
 *
 * ★★ DAYLIGHT SAVING, the way cron users expect:
 *    - a wall-clock time that does not exist (the spring-forward gap — 02:30 in
 *      New York on 8 March 2026) runs once, pushed past the jump (03:30 EDT);
 *    - a wall-clock time that happens twice (the fall-back overlap) runs once,
 *      at the first of the two.
 *    Both come from `svComposeDateTime` in `@styloviz/core`, which reads the
 *    platform's own IANA rules — no offset table to go stale.
 */
export function svNextCronRuns(input: string | SvCron, options: SvCronRunOptions = {}): Date[] {
  const c = asCron(input);
  const count = intIn(options.count, 0, 50) ? options.count : 3;
  if (!c || count === 0) return [];
  const zone = options.timeZone || safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, () => 'UTC');
  if (!validZone(zone)) return [];
  const from = options.from === undefined ? Date.now() : new Date(options.from).getTime();
  if (!Number.isFinite(from)) return [];

  const months = new Set(c.month.values);
  const doms = new Set(c.dayOfMonth.values);
  const dows = new Set(c.dayOfWeek.values);
  const and = c.dayOfMonth.star || c.dayOfWeek.star;
  const wall = new Date(from + svZoneOffsetMinutes(from, zone) * 60000);
  const wallMinute = wall.getUTCHours() * 60 + wall.getUTCMinutes();
  const out: Date[] = [];
  let last = -Infinity;

  for (let i = 0; i < MAX_DAYS && out.length < count; i++) {
    const day = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + i));
    const month = day.getUTCMonth() + 1;
    if (!months.has(month)) continue;
    const domOk = doms.has(day.getUTCDate());
    const dowOk = dows.has(day.getUTCDay());
    if (and ? !(domOk && dowOk) : !(domOk || dowOk)) continue;
    const date = `${pad(day.getUTCFullYear(), 4)}-${pad(month)}-${pad(day.getUTCDate())}`;
    for (const h of c.hour.values) {
      for (const m of c.minute.values) {
        // On the first day, skip what is certainly past; three hours covers any offset change.
        if (i === 0 && h * 60 + m < wallMinute - 180) continue;
        const composed = svComposeDateTime(date, `${pad(h)}:${pad(m)}`, zone);
        const at = (composed.instant ?? composed.gapResolution)?.getTime();
        if (at === undefined || at <= from || at <= last) continue;
        last = at;
        out.push(new Date(at));
        if (out.length === count) return out;
      }
    }
  }
  return out;
}
