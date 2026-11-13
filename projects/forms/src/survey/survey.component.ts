import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import { svNumberOr } from '@styloviz/core/forms';
import { injectSvLabels, svLocale } from '@styloviz/core/i18n';
import { svIsSafeUrl } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_FORMS_LABELS, type SvFormsLabels } from '@styloviz/forms/labels';

import { registerSurveyIcons } from './survey.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** Which survey to ask: Net Promoter Score (0–10), CSAT (1–5) or one custom question. */
export type SvSurveyKind = 'nps' | 'csat' | 'question';

/**
 * `card` (bordered panel), `inline` (no chrome — for a page or panel that
 * already frames it) or `floating` (a small panel fixed to a bottom corner of
 * the viewport that slides in, like a toast — not modal, no focus trap).
 */
export type SvSurveyLayout = 'card' | 'inline' | 'floating';

/** Which bottom corner a `floating` survey sits in. `end` is right in LTR, left in RTL. */
export type SvSurveyCorner = 'start' | 'end';

/** NPS band of a score: detractor 0–6, passive 7–8, promoter 9–10. */
export type SvNpsBand = 'detractor' | 'passive' | 'promoter';

/** Whether the survey is asking, or showing its thank-you. */
export type SvSurveyState = 'ask' | 'thanks';

/** One answer to a `question` survey. */
export interface SvSurveyOption {
  /** What `submitted` reports as `choice`. */
  readonly value: string;
  /** What the user sees and what names the radio. */
  readonly label: string;
}

/** What `submitted` emits. Fields that do not apply to the kind are left out. */
export interface SvSurveyResponse {
  readonly kind: SvSurveyKind;
  /** NPS 0–10 or CSAT 1–5. */
  readonly score?: number;
  /** NPS only — the band the score falls in. */
  readonly band?: SvNpsBand;
  /** A `question` survey with options — the chosen option's `value`. */
  readonly choice?: string;
  /** The follow-up comment, or a free-text answer. Trimmed; left out when empty. */
  readonly comment?: string;
}

/** The labels this component reads — a subset of the `forms` namespace. */
export type SvSurveyLabels = Pick<
  SvFormsLabels,
  | 'surveyNpsQuestion'
  | 'surveyCsatQuestion'
  | 'surveyQuestion'
  | 'surveyNpsLow'
  | 'surveyNpsHigh'
  | 'surveyCsat1'
  | 'surveyCsat2'
  | 'surveyCsat3'
  | 'surveyCsat4'
  | 'surveyCsat5'
  | 'surveyFollowUp'
  | 'surveyFollowUpChoice'
  | 'surveyOptional'
  | 'surveyAnswer'
  | 'surveySubmit'
  | 'surveyRequired'
  | 'surveyDismiss'
  | 'surveyThanksTitle'
  | 'surveyThanksMessage'
>;

/** One radio as the template draws it. */
interface ChoiceRow {
  /** The radio's value attribute. */
  readonly value: string;
  /** Visible text (a number for NPS). */
  readonly text: string;
  /** The radio's accessible name when it differs from `text` (CSAT stars). */
  readonly name: string;
  /** CSAT: the star is at or below the chosen level, so it draws filled. */
  readonly filled: boolean;
}

const CSAT_KEYS = ['surveyCsat1', 'surveyCsat2', 'surveyCsat3', 'surveyCsat4', 'surveyCsat5'] as const;

/** The NPS band of a 0–10 score. */
export function svNpsBand(score: number): SvNpsBand {
  return score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-survey` — an in-app NPS, CSAT or one-question survey with a thank-you.
 *
 * Features:
 * - NPS: 0–10 as a native radio group, "Not likely" / "Very likely" ends, and
 *   a follow-up whose prompt can follow the band (detractor, passive, promoter)
 * - CSAT: 1–5 stars, each a native radio named by its level ("Satisfied")
 * - One question: host-given options as radio pills, or a free-text answer
 * - Thank-you state with an optional follow-up link or button
 * - `card`, `inline` or `floating` (bottom corner, slides in — not modal)
 * - Host owns persistence: `submitted` emits a typed response; nothing is stored
 *
 * ```html
 * <sv-survey kind="nps" (submitted)="save($event)" />
 * ```
 */
@Component({
  selector: 'sv-survey',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './survey.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSurveyComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerSurveyIcons();

  private readonly registryText = injectSvLabels('forms', SV_FORMS_LABELS);
  private readonly injector = inject(Injector);
  private readonly numberFormat = new Intl.NumberFormat(svLocale() || undefined);
  /** @internal Prefix for every id the template points at. */
  protected readonly baseId = svUniqueId('sv-survey');

  private readonly thanksEl = viewChild<ElementRef<HTMLElement>>('thanks');
  private readonly answerEl = viewChild<ElementRef<HTMLElement>>('answer');

  // ── What to ask ───────────────────────────────────────────────────────────

  /** `nps` (0–10), `csat` (1–5 stars) or `question` (one custom question). @default 'nps' */
  readonly kind = input<SvSurveyKind>('nps');

  /** The question. Null uses the kind's label ("How likely are you to recommend us…"). @default null */
  readonly question = input<string | null>(null);

  /** A line under the question. @default null */
  readonly description = input<string | null>(null);

  /**
   * The answers to a `question` survey, shown as radio pills. Empty asks for a
   * free-text answer instead. Rows with an empty or duplicate `value` are skipped. @default []
   */
  readonly options = input<readonly SvSurveyOption[]>([]);

  /** Ask an optional follow-up comment once a score or option is chosen. @default true */
  readonly followUp = input<boolean>(true);

  /** The follow-up prompt. Null uses the `surveyFollowUp` label (or `surveyFollowUpChoice` for a question). @default null */
  readonly followUpPrompt = input<string | null>(null);

  /**
   * NPS only: a follow-up prompt per band, over `followUpPrompt` — e.g. ask a
   * detractor "What disappointed you?" and a promoter "What do you like most?". @default {}
   */
  readonly followUpPrompts = input<Partial<Record<SvNpsBand, string>>>({});

  /** Longest comment accepted, in characters. @default 1000 */
  readonly commentMaxLength = input(1000, { transform: svNumberOr(1000) });

  // ── Thank-you ─────────────────────────────────────────────────────────────

  /** The thank-you heading. Null uses the `surveyThanksTitle` label. @default null */
  readonly thanksTitle = input<string | null>(null);

  /** The thank-you message. Null uses the `surveyThanksMessage` label. @default null */
  readonly thanksMessage = input<string | null>(null);

  /** Text of an optional follow-up action on the thank-you ("Book a call"). Null shows none. @default null */
  readonly thanksActionLabel = input<string | null>(null);

  /**
   * Where the thank-you action goes. Relative paths, `http(s):` and `mailto:`
   * are kept; anything else drops the link. With no `href` the action is a
   * button that emits `thanksAction`. @default null
   */
  readonly thanksActionHref = input<string | null>(null);

  // ── Appearance & behaviour ────────────────────────────────────────────────

  /** `card`, `inline` or `floating` (fixed to a bottom corner, slides in). @default 'card' */
  readonly layout = input<SvSurveyLayout>('card');

  /** Which bottom corner a `floating` survey sits in. @default 'end' */
  readonly corner = input<SvSurveyCorner>('end');

  /** Show a close button that hides the survey and emits `dismissed`. @default false */
  readonly dismissible = input<boolean>(false);

  /** Per-instance text, merged over the registry's `forms` labels. @default {} */
  readonly labels = input<Partial<SvSurveyLabels>>({});

  // ── State (two-way) ───────────────────────────────────────────────────────

  /** The chosen score — NPS 0–10, CSAT 1–5. Two-way: `[(score)]`; picking one emits `scoreChange`. @default null */
  readonly score = model<number | null>(null);

  /** The chosen option's `value` for a `question` survey. Two-way: `[(choice)]`. @default null */
  readonly choice = model<string | null>(null);

  /** The follow-up comment, or the free-text answer. Two-way: `[(comment)]`. @default '' */
  readonly comment = model<string>('');

  /** `ask` or `thanks`. Submitting sets `thanks`; set `ask` to ask again. Two-way: `[(state)]`. @default 'ask' */
  readonly state = model<SvSurveyState>('ask');

  /** Whether the survey renders at all. Dismissing sets it `false`. Two-way: `[(open)]`. @default true */
  readonly open = model<boolean>(true);

  // ── Events ────────────────────────────────────────────────────────────────

  /** The user sent the survey: `{ kind, score?, band?, choice?, comment? }`. Save it; the survey shows its thank-you. */
  readonly submitted = output<SvSurveyResponse>();

  /** The user closed the survey with its close button. */
  readonly dismissed = output<void>();

  /** The user activated the thank-you action (its link, which also navigates, or its button). */
  readonly thanksAction = output<void>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvSurveyLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal Whether the user pressed submit with nothing answered. */
  protected readonly showRequired = signal(false);

  /** @internal The question in effect. */
  protected readonly questionText = computed(() => {
    const given = this.question();
    if (typeof given === 'string' && given.trim()) return given;
    const t = this.text();
    const kind = this.kind();
    return kind === 'csat' ? t.surveyCsatQuestion : kind === 'question' ? t.surveyQuestion : t.surveyNpsQuestion;
  });

  /** @internal Validated options for a `question` survey. */
  protected readonly optionRows = computed<readonly ChoiceRow[]>(() => {
    const given = this.options();
    const list = Array.isArray(given) ? given : [];
    const seen = new Set<string>();
    const out: ChoiceRow[] = [];
    for (const opt of list) {
      const value = typeof opt?.value === 'string' ? opt.value.trim() : '';
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const label = typeof opt.label === 'string' && opt.label.trim() ? opt.label : value;
      out.push({ value, text: label, name: label, filled: false });
    }
    return out;
  });

  /** @internal A `question` survey with no options asks for free text. */
  protected readonly freeText = computed(() => this.kind() === 'question' && this.optionRows().length === 0);

  /** @internal The radios to draw for the current kind. */
  protected readonly choices = computed<readonly ChoiceRow[]>(() => {
    const kind = this.kind();
    if (kind === 'question') return this.optionRows();
    if (kind === 'csat') {
      const t = this.text();
      const chosen = this.validScore() ?? 0;
      return CSAT_KEYS.map((key, i) => ({
        value: String(i + 1),
        text: this.numberFormat.format(i + 1),
        name: t[key],
        filled: i + 1 <= chosen,
      }));
    }
    return Array.from({ length: 11 }, (_, n) => ({
      value: String(n),
      text: this.numberFormat.format(n),
      name: this.numberFormat.format(n),
      filled: false,
    }));
  });

  /** @internal The score, if it is valid for the kind (an integer 0–10 or 1–5). */
  protected readonly validScore = computed<number | null>(() => {
    const kind = this.kind();
    const s = this.score();
    if (kind === 'question' || typeof s !== 'number' || !Number.isInteger(s)) return null;
    const [min, max] = kind === 'csat' ? [1, 5] : [0, 10];
    return s >= min && s <= max ? s : null;
  });

  /** @internal The chosen option, if it is one of the options. */
  protected readonly validChoice = computed<string | null>(() => {
    const c = this.choice();
    return typeof c === 'string' && this.optionRows().some((r) => r.value === c) ? c : null;
  });

  /** @internal The value attribute of the checked radio. */
  protected readonly checkedValue = computed<string | null>(() => {
    if (this.kind() === 'question') return this.validChoice();
    const s = this.validScore();
    return s === null ? null : String(s);
  });

  /** @internal NPS band of the chosen score. */
  protected readonly band = computed<SvNpsBand | null>(() => {
    const s = this.validScore();
    return this.kind() === 'nps' && s !== null ? svNpsBand(s) : null;
  });

  /** @internal The CSAT level name shown under the stars once one is chosen. */
  protected readonly csatLevel = computed(() => {
    const s = this.validScore();
    return this.kind() === 'csat' && s !== null ? this.text()[CSAT_KEYS[s - 1]] : '';
  });

  /** @internal Something has been answered. */
  protected readonly answered = computed(() =>
    this.freeText() ? this.comment().trim().length > 0 : this.checkedValue() !== null,
  );

  /** @internal Show the follow-up comment box. */
  protected readonly showFollowUp = computed(() => !this.freeText() && this.followUp() && this.checkedValue() !== null);

  /** @internal The follow-up prompt in effect — band-specific for NPS. */
  protected readonly followUpText = computed(() => {
    const band = this.band();
    const perBand = band ? this.followUpPrompts()?.[band] : undefined;
    if (typeof perBand === 'string' && perBand.trim()) return perBand;
    const given = this.followUpPrompt();
    if (typeof given === 'string' && given.trim()) return given;
    return this.kind() === 'question' ? this.text().surveyFollowUpChoice : this.text().surveyFollowUp;
  });

  /** @internal Comment length cap — a positive integer. */
  protected readonly maxLength = computed(() => {
    const n = Math.floor(this.commentMaxLength());
    return n > 0 ? n : 1000;
  });

  /** @internal What describes the answer: the description, and the "choose an answer" message while it shows. */
  protected readonly describedBy = computed(() => {
    const ids = [this.description() ? this.descriptionId : '', this.showRequired() ? this.requiredId : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  /** @internal The safe thank-you link, or null. */
  protected readonly safeThanksHref = computed(() => {
    const raw = this.thanksActionHref();
    const href = typeof raw === 'string' ? raw.trim() : '';
    return href && svIsSafeUrl(href, false) ? href : null;
  });

  /** @internal The thank-you action's text, or null when there is none. */
  protected readonly thanksActionText = computed(() => {
    const label = this.thanksActionLabel();
    return typeof label === 'string' && label.trim() ? label : null;
  });

  /** @internal */
  protected readonly isFloating = computed(() => this.layout() === 'floating');

  /** @internal */
  protected readonly questionId = `${this.baseId}-question`;
  /** @internal */
  protected readonly descriptionId = `${this.baseId}-description`;
  /** @internal */
  protected readonly lowId = `${this.baseId}-low`;
  /** @internal */
  protected readonly highId = `${this.baseId}-high`;
  /** @internal */
  protected readonly commentId = `${this.baseId}-comment`;
  /** @internal */
  protected readonly optionalId = `${this.baseId}-optional`;
  /** @internal */
  protected readonly requiredId = `${this.baseId}-required`;
  /** @internal */
  protected readonly thanksId = `${this.baseId}-thanks`;
  /** @internal The radios' shared name. */
  protected readonly radioName = `${this.baseId}-answer`;

  /** @internal Classes for the root element. */
  protected readonly rootClass = computed(() => {
    const layout = this.layout();
    if (layout === 'inline') return 'relative block'; // sv-i18n-ignore: CSS classes
    const card =
      'relative block rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900';
    if (layout !== 'floating') return `${card} shadow-sm`;
    const side = this.corner() === 'start' ? 'start-4' : 'end-4';
    return (
      `${card} fixed bottom-4 ${side} z-[60] w-[calc(100%-2rem)] max-w-md shadow-xl ` +
      'transition-[opacity,transform] duration-300 ease-out starting:translate-y-4 starting:opacity-0 ' +
      'motion-reduce:transition-none'
    );
  });

  /** @internal Classes for one NPS or option pill (the label around a visually hidden radio). */
  private readonly pillBase =
    'flex h-10 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white ' +
    'text-sm font-semibold text-gray-800 transition-colors hover:border-primary-400 hover:bg-primary-50 ' +
    'peer-checked:border-primary-600 peer-checked:bg-primary-600 peer-checked:text-white ' +
    'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 ' +
    'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-primary-400 dark:hover:bg-primary-900/30 ' +
    'dark:peer-checked:border-primary-400 dark:peer-checked:bg-primary-400 dark:peer-checked:text-gray-950 ' +
    'dark:peer-focus-visible:ring-offset-gray-900 forced-colors:peer-checked:border-[Highlight] ' +
    'forced-colors:peer-checked:outline-2 forced-colors:peer-checked:outline-solid'; // sv-i18n-ignore: CSS classes

  /** @internal An NPS number pill. */
  protected readonly npsPillClass = `${this.pillBase} min-w-10 px-2 tabular-nums`;

  /** @internal A one-question option pill. */
  protected readonly optionPillClass = `${this.pillBase} px-4`;

  /** @internal Classes for a CSAT star (the label around a visually hidden radio). */
  protected readonly starClass =
    'flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-gray-100 ' +
    'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 ' +
    'dark:hover:bg-gray-800 dark:peer-focus-visible:ring-offset-gray-900';

  /** @internal Classes for the small icon button in the corner. */
  protected readonly closeClass =
    'absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors ' +
    'hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
    'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white';

  // ── Public API ────────────────────────────────────────────────────────────

  /** Send the survey: emits `submitted` and shows the thank-you. Does nothing (and says so) while unanswered. */
  submit(): void {
    if (!this.answered()) {
      this.showRequired.set(true);
      this.focusAfterRender(this.answerEl);
      return;
    }
    this.showRequired.set(false);
    this.submitted.emit(this.response());
    this.state.set('thanks');
    this.focusAfterRender(this.thanksEl);
  }

  /** Clear the answer and the comment and ask again. */
  reset(): void {
    this.score.set(null);
    this.choice.set(null);
    this.comment.set('');
    this.showRequired.set(false);
    this.state.set('ask');
  }

  /** Hide the survey and emit `dismissed`. */
  dismiss(): void {
    this.open.set(false);
    this.dismissed.emit();
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  /** @internal A radio was chosen. */
  protected pick(value: string): void {
    this.showRequired.set(false);
    if (this.kind() === 'question') this.choice.set(value);
    else this.score.set(Number(value));
  }

  /** @internal The comment changed. */
  protected onComment(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    this.comment.set(target.value);
    if (target.value.trim()) this.showRequired.set(false);
  }

  /** @internal The form was submitted (button or Enter). */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submit();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private response(): SvSurveyResponse {
    const kind = this.kind();
    const comment = this.comment().trim().slice(0, this.maxLength());
    const withComment = comment ? { comment } : {};
    if (kind === 'question') {
      const choice = this.validChoice();
      return choice === null ? { kind, ...withComment } : { kind, choice, ...withComment };
    }
    const score = this.validScore() ?? 0;
    return kind === 'nps' ? { kind, score, band: svNpsBand(score), ...withComment } : { kind, score, ...withComment };
  }

  private focusAfterRender(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
