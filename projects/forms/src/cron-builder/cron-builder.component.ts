import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { svUniqueId } from '@styloviz/core/a11y';
import { SvFieldErrorComponent, createFieldError, svNumberOr, type SvServerError } from '@styloviz/core/forms';
import {
  SV_MACHINE_LOCALE,
  injectSvLabels,
  svFirstDayOfWeek,
  svFormatLabel,
  svLocale,
  svWeekdayLabels,
} from '@styloviz/core/i18n';
import { NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons/core';
import { SvSegmentedControlComponent, type SegmentOption } from '@styloviz/forms/segmented-control';
import { SV_FORMS_LABELS } from '@styloviz/forms/labels';
import {
  SV_CRON_HOUR_INTERVALS,
  SV_CRON_MINUTE_INTERVALS,
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
  type SvCronError,
  type SvCronLabels,
  type SvCronMode,
  type SvCronVisual,
  type SvCronVisualMode,
} from './cron';

import { registerCronBuilderIcons } from './cron-builder.component.icons';

/** The labels `sv-cron-builder` reads — the `cron*` keys of the `forms` namespace, plus `hour` and `minute`. */
export type SvCronBuilderLabels = SvCronLabels;

/** One `<option>` as the template draws it. */
interface PickOption {
  readonly value: number;
  readonly text: string;
}

/** One day toggle as the template draws it. */
interface DayOption {
  readonly value: number;
  readonly text: string;
  readonly checked: boolean;
}

/** One upcoming run as the template draws it. */
interface RunRow {
  readonly iso: string;
  readonly text: string;
}

const MODES: readonly SvCronMode[] = ['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'custom'];
const MODE_LABEL = {
  minutes: 'cronModeMinutes',
  hourly: 'cronModeHourly',
  daily: 'cronModeDaily',
  weekly: 'cronModeWeekly',
  monthly: 'cronModeMonthly',
  custom: 'cronModeCustom',
} as const satisfies Record<SvCronMode, keyof SvCronLabels>;

/** A native `<select>`: 40 px tall, primary focus ring, both themes. */
const SELECT_CLASS =
  'h-10 min-w-24 rounded-lg border border-gray-300 bg-white ps-3 pe-8 text-sm text-gray-900 shadow-xs ' +
  'focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'; // sv-i18n-ignore: Tailwind classes

/** The Custom field. */
const CUSTOM_INPUT_CLASS =
  'h-10 w-full max-w-sm rounded-lg border bg-white px-3 font-mono text-sm text-gray-900 shadow-xs ' +
  'focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:text-gray-100'; // sv-i18n-ignore: Tailwind classes
const CUSTOM_INPUT_VALID =
  'border-gray-300 focus-visible:border-primary-500 focus-visible:ring-primary-500/40 dark:border-gray-600'; // sv-i18n-ignore: Tailwind classes
const CUSTOM_INPUT_INVALID = 'border-danger-500 focus-visible:ring-danger-500/40 dark:border-danger-400'; // sv-i18n-ignore: Tailwind classes

/** A day toggle's face: the visually hidden checkbox before it is the `peer`. */
const DAY_CLASS =
  'inline-flex h-9 min-w-10 w-full cursor-pointer select-none items-center justify-center rounded-lg border px-2 text-sm font-medium ' +
  'border-gray-300 bg-white text-gray-700 transition-colors hover:border-primary-400 ' +
  'peer-checked:border-primary-600 peer-checked:bg-primary-600 peer-checked:text-white ' +
  'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-gray-900 ' +
  'peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ' +
  'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:peer-checked:border-primary-500 dark:peer-checked:bg-primary-500 dark:peer-checked:text-gray-950 ' +
  'forced-colors:peer-checked:bg-[Highlight] forced-colors:peer-checked:text-[HighlightText] forced-colors:peer-focus-visible:outline-2'; // sv-i18n-ignore: Tailwind classes

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * `sv-cron-builder` — a visual cron / schedule builder with a plain-language preview.
 *
 * Features:
 * - Six modes on a segmented control: every N minutes, hourly (at minute),
 *   daily (at time), weekly (days + time), monthly (days + time) and Custom
 *   (the raw five-field expression, validated as you type)
 * - Switching mode keeps the time and days already chosen; an expression the
 *   visual modes cannot show opens in Custom
 * - A sentence for the schedule ("Every weekday at 09:00") in the kit's locale,
 *   and the next runs in a time zone you choose
 * - The value is the normalised expression (`0 9 * * MON-FRI` → `0 9 * * 1-5`);
 *   an invalid one is never emitted
 * - `ControlValueAccessor` + `Validator` — `[formControl]` is invalid while the
 *   expression on screen is
 *
 * ```html
 * <sv-cron-builder [(value)]="schedule" timeZone="Europe/London" />
 * ```
 */
@Component({
  selector: 'sv-cron-builder',
  standalone: true,
  imports: [NgTemplateOutlet, SvSegmentedControlComponent, SvFieldErrorComponent, SvIconComponent],
  templateUrl: './cron-builder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SvCronBuilderComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => SvCronBuilderComponent), multi: true },
  ],
})
export class SvCronBuilderComponent implements ControlValueAccessor, Validator {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerCronBuilderIcons();

  private readonly registryText = injectSvLabels('forms', SV_FORMS_LABELS);
  /** @internal Prefix for every id the template points at. */
  protected readonly baseId = svUniqueId('sv-cron');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * The cron expression (five fields). Two-way: `[(value)]`. Only a valid
   * expression is ever written back, in its normalised numeric form; `''` means
   * no schedule yet. @default ''
   */
  readonly value = model<string>('');

  /** Visible group label. Null uses the `cronLegend` label ("Schedule"). @default null */
  readonly label = input<string | null>(null);

  /** IANA time zone the schedule runs in, for the next-runs preview. Null uses the browser's. @default null */
  readonly timeZone = input<string | null>(null);

  /** How many upcoming runs the preview lists, 0–10. 0 hides the list. @default 3 */
  readonly nextRunCount = input(3, { transform: svNumberOr(3) });

  /** Show the sentence and next runs under the editor. @default true */
  readonly showPreview = input<boolean>(true);

  /** BCP 47 locale for weekday and month names, times and the sentence. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /** Disable every control. @default false */
  readonly disabled = input<boolean>(false);

  /** Client-side validation message from the host, shown when the builder has none of its own. @default '' */
  readonly errorMessage = input<string>('');

  /** A rejection reported by the server about this value. Self-expires when the value changes. @default null */
  readonly serverError = input<SvServerError>(null);

  /** Per-instance text, merged over the registry's `forms` labels. @default {} */
  readonly labels = input<Partial<SvCronBuilderLabels>>({});

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * The builder's own validation result changed: the parse error (or "choose
   * at least one day") on screen, or `null` once it is valid again. While it is
   * non-null `value` is not updated.
   */
  readonly errorChange = output<SvCronError | null>();

  // ── State ─────────────────────────────────────────────────────────────────

  /** @internal The mode on screen; `null` until there is a value or the user picks one. */
  protected readonly mode = signal<SvCronMode | null>(null);
  /** @internal The visual editor's state — every field kept across mode switches. */
  protected readonly draft = signal<SvCronVisual>(SV_CRON_VISUAL_DEFAULTS);
  /** @internal The Custom field's text, as typed. */
  protected readonly customText = signal('');
  /** @internal The Custom field has been left once (an empty field only complains after that). */
  protected readonly customBlurred = signal(false);

  /** The last value adopted or emitted — so our own writes are not re-read as external ones. */
  private synced: string | null = null;

  private onChange: (value: string) => void = () => {
    /* replaced by registerOnChange */
  };
  private onTouched: () => void = () => {
    /* replaced by registerOnTouched */
  };
  private onValidatorChange: () => void = () => {
    /* replaced by registerOnValidatorChange */
  };
  private readonly formDisabled = signal(false);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvCronLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal The `[disabled]` input OR a disabled parent form control. */
  protected readonly resolvedDisabled = computed(() => this.disabled() || this.formDisabled());

  /** @internal The locale `Intl` is given — the machine locale when the input is empty. */
  private readonly intlLocale = computed(() => this.locale() || SV_MACHINE_LOCALE);

  /** @internal Segments for the mode switch. */
  protected readonly modeOptions = computed<readonly SegmentOption[]>(() => {
    const t = this.text();
    return MODES.map((m) => ({ value: m, label: t[MODE_LABEL[m]] }));
  });

  /** @internal The parse of the Custom field. */
  private readonly customParse = computed(() => svParseCron(this.customText()));

  /** @internal The schedule on screen, or null when there is none or it is invalid. */
  protected readonly currentCron = computed<SvCron | null>(() => {
    const mode = this.mode();
    if (mode === null) return null;
    if (mode === 'custom') {
      const r = this.customParse();
      return r.ok ? r.cron : null;
    }
    return svCronFromVisual({ ...this.draft(), mode });
  });

  /** @internal The builder's own validation error, if any. */
  protected readonly ownError = computed<SvCronError | null>(() => {
    const mode = this.mode();
    if (mode === 'custom') {
      const r = this.customParse();
      if (r.ok) return null;
      return r.error.code === 'empty' && !this.customBlurred() ? null : r.error;
    }
    if (mode === 'weekly' && this.draft().weekdays.length === 0) return { code: 'no-days' };
    if (mode === 'monthly' && this.draft().monthDays.length === 0) return { code: 'no-days' };
    return null;
  });

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);

  /** @internal The message under the editor: the builder's own first, then the host's. */
  protected readonly shownError = computed(() => {
    const own = this.ownError();
    return own ? svCronErrorMessage(own, { locale: this.locale(), labels: this.text() }) : this.fieldError.resolvedError();
  });

  /** @internal A weekly or monthly schedule with no day ticked. */
  protected readonly noDays = computed(() => this.ownError()?.code === 'no-days');

  /** @internal The Custom field's classes — red border and ring while it is invalid. */
  protected readonly customInputClass = computed(() =>
    CUSTOM_INPUT_CLASS + ' ' + (this.shownError() ? CUSTOM_INPUT_INVALID : CUSTOM_INPUT_VALID),
  );

  /** @internal Class strings. */
  protected readonly selectClass = SELECT_CLASS;
  protected readonly dayClass = DAY_CLASS;

  /** @internal Ids. */
  protected readonly errorId = `${this.baseId}-error`;
  protected readonly hintId = `${this.baseId}-hint`;
  protected readonly customId = `${this.baseId}-custom`;
  protected readonly legendId = `${this.baseId}-legend`;

  /** @internal `aria-describedby` for a day group: the "choose at least one day" message, while it shows. */
  protected readonly daysDescribedBy = computed(() => (this.noDays() ? this.errorId : null));

  /** @internal `aria-describedby` for the Custom field. */
  protected readonly customDescribedBy = computed(() =>
    [this.hintId, this.shownError() ? this.errorId : ''].filter(Boolean).join(' '),
  );

  /** @internal The interval options for `minutes` mode. */
  protected readonly minuteIntervalOptions = computed<readonly PickOption[]>(() => {
    const t = this.text();
    const loc = this.locale();
    return SV_CRON_MINUTE_INTERVALS.map((n) => ({ value: n, text: svFormatLabel(t.cronIntervalMinutes, { n }, loc) }));
  });

  /** @internal The interval options for `hourly` mode. */
  protected readonly hourIntervalOptions = computed<readonly PickOption[]>(() => {
    const t = this.text();
    const loc = this.locale();
    return SV_CRON_HOUR_INTERVALS.map((n) => ({ value: n, text: svFormatLabel(t.cronIntervalHours, { n }, loc) }));
  });

  /** @internal 0–23, written as the locale writes an hour ("09", "9 AM"). */
  protected readonly hourOptions = computed<readonly PickOption[]>(() => {
    const loc = this.intlLocale();
    let format: Intl.DateTimeFormat;
    try {
      format = new Intl.DateTimeFormat(loc, { hour: '2-digit', timeZone: 'UTC' });
    } catch {
      format = new Intl.DateTimeFormat(SV_MACHINE_LOCALE, { hour: '2-digit', timeZone: 'UTC' });
    }
    return range(0, 23).map((h) => ({ value: h, text: format.format(Date.UTC(2023, 0, 1, h)) }));
  });

  /** @internal 0–59, two digits in the locale's numerals. */
  protected readonly minuteOptions = computed<readonly PickOption[]>(() => {
    const loc = this.intlLocale();
    let format: Intl.NumberFormat;
    try {
      format = new Intl.NumberFormat(loc, { minimumIntegerDigits: 2 });
    } catch {
      format = new Intl.NumberFormat(SV_MACHINE_LOCALE, { minimumIntegerDigits: 2 });
    }
    return range(0, 59).map((m) => ({ value: m, text: format.format(m) }));
  });

  /** @internal The seven weekday toggles, in the locale's week order. */
  protected readonly weekdayOptions = computed<readonly DayOption[]>(() => {
    const loc = this.intlLocale();
    let first = 1;
    try {
      first = svFirstDayOfWeek(loc);
    } catch {
      first = 1;
    }
    const names = svWeekdayLabels(loc, first, 'short');
    const chosen = new Set(this.draft().weekdays);
    return names.map((name, i) => {
      const value = (first + i) % 7;
      return { value, text: name, checked: chosen.has(value) };
    });
  });

  /** @internal The 31 day-of-month toggles. */
  protected readonly monthDayOptions = computed<readonly DayOption[]>(() => {
    const loc = this.intlLocale();
    let format: Intl.NumberFormat;
    try {
      format = new Intl.NumberFormat(loc);
    } catch {
      format = new Intl.NumberFormat(SV_MACHINE_LOCALE);
    }
    const chosen = new Set(this.draft().monthDays);
    return range(1, 31).map((d) => ({ value: d, text: format.format(d), checked: chosen.has(d) }));
  });

  /** @internal The sentence for the schedule on screen. */
  protected readonly description = computed(() => {
    const cron = this.currentCron();
    return cron ? svDescribeCron(cron, { locale: this.locale(), labels: this.text() }) : '';
  });

  /** @internal The zone the next runs are shown in. */
  protected readonly zone = computed(() => {
    const given = this.timeZone();
    if (given) return given;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  /** @internal How many runs to list. */
  protected readonly runCount = computed(() => {
    const n = Math.floor(this.nextRunCount());
    return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 3;
  });

  /** @internal The next runs, formatted in the zone. Recomputed when the schedule changes. */
  protected readonly runs = computed<readonly RunRow[]>(() => {
    const cron = this.currentCron();
    const count = this.runCount();
    if (!cron || count === 0) return [];
    const zone = this.zone();
    let format: Intl.DateTimeFormat;
    try {
      format = new Intl.DateTimeFormat(this.intlLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: zone });
    } catch {
      return [];
    }
    return svNextCronRuns(cron, { count, timeZone: zone }).map((d) => ({ iso: d.toISOString(), text: format.format(d) }));
  });

  /** @internal The next-runs heading. */
  protected readonly runsHeading = computed(() =>
    svFormatLabel(this.text().cronNextRuns, { zone: this.zone() }, this.locale()),
  );

  constructor() {
    // Adopt a value written from outside — `[value]`, `writeValue` — without
    // re-reading the ones this component wrote itself.
    effect(() => {
      const value = this.value();
      untracked(() => this.adopt(value));
    });

    // Tell the host, and a parent form, when the builder's own verdict changes.
    let last: string | null = null;
    effect(() => {
      const error = this.ownError();
      const key = error ? JSON.stringify(error) : null;
      if (key === last) return;
      last = key;
      untracked(() => {
        this.errorChange.emit(error);
        this.onValidatorChange();
      });
    });
  }

  // ── ControlValueAccessor + Validator ──────────────────────────────────────

  writeValue(value: string | null): void {
    this.value.set(typeof value === 'string' ? value : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  /** `{ cron: SvCronError }` while the expression on screen is invalid; `null` otherwise. */
  validate(_control: AbstractControl): ValidationErrors | null {
    const own = this.ownError();
    return own ? { cron: own } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** @internal Switch mode, keeping what can be kept. */
  protected setMode(next: string): void {
    if (!MODES.includes(next as SvCronMode) || this.resolvedDisabled()) return;
    const mode = next as SvCronMode;
    const current = this.mode();
    if (mode === current) return;
    if (mode === 'custom') {
      const cron = this.currentCron();
      this.customText.set(cron ? svFormatCron(cron) : current === null ? '' : this.value());
      this.customBlurred.set(false);
      this.mode.set('custom');
      return;
    }
    if (current === 'custom') {
      const parsed = this.customParse();
      if (parsed.ok) this.draft.set(svCronVisualHint(parsed.cron, this.draft()));
    }
    this.draft.update((d) => ({ ...d, mode }));
    this.mode.set(mode);
    this.emitDraft();
  }

  /** @internal A `<select>` in the visual editor changed. */
  protected pick(key: 'minuteInterval' | 'hourInterval' | 'minute' | 'hour', event: Event): void {
    const n = Number((event.target as HTMLSelectElement).value);
    const allowed =
      key === 'minuteInterval' ? SV_CRON_MINUTE_INTERVALS
      : key === 'hourInterval' ? SV_CRON_HOUR_INTERVALS
      : key === 'hour' ? range(0, 23)
      : range(0, 59);
    if (!allowed.includes(n)) return;
    this.draft.update((d) => ({ ...d, [key]: n }));
    this.emitDraft();
  }

  /** @internal A weekday or day-of-month toggle changed. */
  protected toggleDay(key: 'weekdays' | 'monthDays', day: number, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.draft.update((d) => {
      const set = new Set(d[key]);
      if (on) set.add(day);
      else set.delete(day);
      return { ...d, [key]: [...set].sort((a, b) => a - b) };
    });
    this.emitDraft();
  }

  /** @internal The Custom field changed: emit as soon as it is valid. */
  protected onCustomInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.customText.set(text);
    const parsed = svParseCron(text);
    if (parsed.ok) this.emit(parsed.expression);
  }

  /** @internal The Custom field lost focus: show it normalised. */
  protected onCustomBlur(): void {
    this.customBlurred.set(true);
    const parsed = this.customParse();
    if (parsed.ok) this.customText.set(parsed.expression);
    this.onTouched();
  }

  /** @internal Any visual control lost focus. */
  protected markTouched(): void {
    this.onTouched();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private emitDraft(): void {
    const mode = this.mode();
    if (mode === null || mode === 'custom') return;
    const cron = svCronFromVisual({ ...this.draft(), mode: mode as SvCronVisualMode });
    if (cron) this.emit(svFormatCron(cron));
  }

  private emit(expression: string): void {
    if (expression === this.value()) return;
    this.synced = expression;
    this.value.set(expression);
    this.onChange(expression);
  }

  private adopt(value: string): void {
    if (value === this.synced) return;
    this.synced = value;
    if (value.trim() === '') {
      this.mode.set(null);
      this.customText.set('');
      this.customBlurred.set(false);
      return;
    }
    const parsed = svParseCron(value);
    if (parsed.ok) {
      const visual = svCronToVisual(parsed.cron, this.draft());
      if (visual) {
        this.draft.set(visual);
        this.mode.set(visual.mode);
        this.customText.set(parsed.expression);
        return;
      }
      this.draft.set(svCronVisualHint(parsed.cron, this.draft()));
    }
    // Not something the visual modes can show — or not valid at all: Custom, as written.
    this.customText.set(value);
    this.mode.set('custom');
  }
}
