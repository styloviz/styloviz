import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  type SvDataError,
} from '@styloviz/core/data';
import { injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { svIsSafeUrl } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_OVERLAYS_LABELS, type SvOverlaysLabels } from '@styloviz/overlays/labels';
import { SvProgressRingComponent } from '@styloviz/overlays/progress-ring';

import { registerOnboardingChecklistIcons } from './onboarding-checklist.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** One thing a new user has to do (or may do) to finish setting up. */
export interface SvOnboardingStep {
  /** Stable identity — what `stepToggle` and `stepAction` hand back. */
  readonly id: string;
  /** What the step is called. */
  readonly title: string;
  /** One sentence on why or how. */
  readonly description?: string;
  /** Whether the step is done. The host owns this — the checklist never flips it itself. */
  readonly done?: boolean;
  /** Nice to have: shown with an "Optional" badge and left out of the progress count. */
  readonly optional?: boolean;
  /**
   * Where the step's action goes. Relative paths, `http(s):` and `mailto:` are
   * kept; anything else (`javascript:`, `data:`) drops the link.
   */
  readonly href?: string;
  /** The action's text. With no `href` it renders a button that emits `stepAction`. */
  readonly actionLabel?: string;
}

/** `card` (bordered panel) or `inline` (no chrome, smaller ring — for a page or panel that already frames it). */
export type SvOnboardingChecklistVariant = 'card' | 'inline';

/** Heading level for the checklist title. */
export type SvOnboardingChecklistHeadingLevel = 2 | 3 | 4;

/** What `stepToggle` emits: the step, and the state the user asked for. */
export interface SvOnboardingStepToggle {
  readonly step: SvOnboardingStep;
  readonly done: boolean;
}

/** The labels this component reads — a subset of the `overlays` namespace. */
export type SvOnboardingChecklistLabels = Pick<
  SvOverlaysLabels,
  | 'onboardingTitle'
  | 'onboardingProgress'
  | 'onboardingProgressName'
  | 'onboardingOptional'
  | 'onboardingOptionalNote'
  | 'onboardingComplete'
  | 'onboardingAction'
  | 'onboardingStepDone'
  | 'onboardingStepTodo'
  | 'onboardingDismiss'
  | 'onboardingCollapse'
  | 'onboardingExpand'
  | 'onboardingLoading'
  | 'onboardingEmptyTitle'
  | 'onboardingEmptyMessage'
  | 'onboardingErrorTitle'
>;

/** A step as the template draws it. */
interface StepRow {
  readonly step: SvOnboardingStep;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly done: boolean;
  readonly optional: boolean;
  /** The safe link, or null. */
  readonly href: string | null;
  /** The action's text, or null when the step has no action. */
  readonly actionLabel: string | null;
  readonly inputId: string;
  readonly titleId: string;
  readonly descriptionId: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-onboarding-checklist` — a setup checklist with a progress ring.
 *
 * Features:
 * - "3 of 5 done" and a `sv-progress-ring`, counting required steps only
 * - Optional steps carry a badge and say they don't count toward completion
 * - Native checkboxes (or read-only state) plus a link or button per step
 * - Host-owned state: `done` lives on the steps; the checklist only emits
 * - `completed` fires on the change to every-required-step-done
 * - Dismissible (`[(open)]`) and collapsible (`[(collapsed)]`)
 * - Loading, error with retry, and empty states from `@styloviz/core`
 *
 * ```html
 * <sv-onboarding-checklist [steps]="steps()" (stepToggle)="mark($event)" (completed)="celebrate()" />
 * ```
 */
@Component({
  selector: 'sv-onboarding-checklist',
  standalone: true,
  imports: [SvIconComponent, SvProgressRingComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent],
  templateUrl: './onboarding-checklist.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvOnboardingChecklistComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerOnboardingChecklistIcons();

  private readonly registryText = injectSvLabels('overlays', SV_OVERLAYS_LABELS);
  private readonly locale = svLocale();
  /** @internal Prefix for the ids the labels and descriptions point at. */
  protected readonly baseId = svUniqueId('sv-onboarding-checklist');

  // ── Data ──────────────────────────────────────────────────────────────────

  /**
   * The steps, in order. Each one's `done` is yours: tick a box and the
   * checklist emits `stepToggle`; it shows the change once you hand back
   * steps with `done` updated. Rows with an empty or duplicate `id` are skipped. @default []
   */
  readonly steps = input<readonly SvOnboardingStep[]>([]);

  /** True while the host is fetching the steps — shows a skeleton in place of the list. @default false */
  readonly loading = input<boolean>(false);

  /** The fetch failed — shows the error with a Try again button that emits `retry`. @default null */
  readonly error = input<SvDataError | string | null>(null);

  // ── Text ──────────────────────────────────────────────────────────────────

  /** The heading. Null uses the `onboardingTitle` label ("Get set up"). @default null */
  readonly title = input<string | null>(null);

  /** A line under the heading. @default null */
  readonly description = input<string | null>(null);

  /** Heading level for the title — match the page outline. @default 3 */
  readonly headingLevel = input<SvOnboardingChecklistHeadingLevel>(3);

  /** Per-instance text, merged over the registry's `overlays` labels. @default {} */
  readonly labels = input<Partial<SvOnboardingChecklistLabels>>({});

  // ── Appearance & behaviour ────────────────────────────────────────────────

  /** `card` (bordered panel) or `inline` (no chrome, smaller ring). @default 'card' */
  readonly variant = input<SvOnboardingChecklistVariant>('card');

  /**
   * Render a native checkbox per step so the user can tick it. `false` shows
   * read-only state — for steps your app detects as done by itself. @default true
   */
  readonly checkable = input<boolean>(true);

  /** Show a dismiss button that closes the checklist and emits `dismissed`. @default false */
  readonly dismissible = input<boolean>(false);

  /** Show a toggle that hides the steps and keeps the heading and progress. @default false */
  readonly collapsible = input<boolean>(false);

  /** Whether the steps are hidden. Two-way: `[(collapsed)]`, so you can remember it. @default false */
  readonly collapsed = model<boolean>(false);

  /**
   * Whether the checklist renders at all. Dismissing sets it `false`. Two-way:
   * `[(open)]`, so a dismissal can be stored and restored. @default true
   */
  readonly open = model<boolean>(true);

  // ── Events ────────────────────────────────────────────────────────────────

  /** The user ticked or unticked a step: the step and the state they asked for. Update `done` to apply it. */
  readonly stepToggle = output<SvOnboardingStepToggle>();

  /** The user activated a step's action — its link (which also navigates) or its button. */
  readonly stepAction = output<SvOnboardingStep>();

  /** The user dismissed the checklist. */
  readonly dismissed = output<void>();

  /**
   * Every required step became done. Fires on the change, once — not on a
   * checklist that arrives already complete, and not again until it is
   * incomplete and completed again.
   */
  readonly completed = output<void>();

  /** The host should re-run the failed fetch of the steps. */
  readonly retry = output<void>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvOnboardingChecklistLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal The heading in effect. */
  protected readonly heading = computed(() => {
    const given = this.title();
    return typeof given === 'string' && given.trim() ? given : this.text().onboardingTitle;
  });

  /** @internal Validated steps. */
  protected readonly rows = computed<readonly StepRow[]>(() => {
    const given = this.steps();
    const list = Array.isArray(given) ? given : [];
    const fallbackAction = this.text().onboardingAction;
    const seen = new Set<string>();
    const out: StepRow[] = [];
    for (const step of list) {
      const id = typeof step?.id === 'string' ? step.id.trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const n = out.length;
      const rawHref = typeof step.href === 'string' ? step.href.trim() : '';
      const href = rawHref && svIsSafeUrl(rawHref, false) ? rawHref : null;
      const ownLabel = typeof step.actionLabel === 'string' && step.actionLabel.trim() ? step.actionLabel : null;
      out.push({
        step,
        id,
        title: typeof step.title === 'string' && step.title.trim() ? step.title : id,
        description: typeof step.description === 'string' ? step.description : '',
        done: step.done === true,
        optional: step.optional === true,
        href,
        actionLabel: href ? (ownLabel ?? fallbackAction) : ownLabel,
        inputId: `${this.baseId}-step-${n}`,
        titleId: `${this.baseId}-title-${n}`,
        descriptionId: `${this.baseId}-desc-${n}`,
      });
    }
    return out;
  });

  /**
   * @internal Required steps done, of required steps. Optional steps never
   * count; a list of nothing but optional steps counts all of them.
   */
  protected readonly progress = computed(() => {
    const rows = this.rows();
    const required = rows.filter((r) => !r.optional);
    const counted = required.length ? required : rows;
    const done = counted.filter((r) => r.done).length;
    const total = counted.length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  });

  /** @internal Every counted step is done. */
  protected readonly complete = computed(() => {
    const { done, total } = this.progress();
    return total > 0 && done === total;
  });

  /** @internal "3 of 5 done". */
  protected readonly progressText = computed(() => {
    const { done, total } = this.progress();
    return svFormatLabel(this.text().onboardingProgress, { done: String(done), total: String(total) }, this.locale);
  });

  /** @internal Some step is optional, so the note saying they don't count is shown. */
  protected readonly hasOptional = computed(() => this.rows().some((r) => r.optional) && this.rows().some((r) => !r.optional));

  /** @internal The list is what's on screen — not loading, failed or empty. */
  protected readonly loaded = computed(() => !this.loading() && !this.error() && this.rows().length > 0);

  /** @internal */
  protected readonly isCard = computed(() => this.variant() !== 'inline');

  /** @internal */
  protected readonly titleId = `${this.baseId}-heading`;
  /** @internal */
  protected readonly bodyId = `${this.baseId}-body`;

  /** @internal Classes for the root element. */
  protected readonly rootClass = computed(() =>
    this.isCard()
      ? 'block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900'
      : 'block',
  );

  /** @internal Classes for the small icon buttons in the header. */
  protected readonly iconButtonClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors ' +
    'hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ' +
    'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white';

  /** Completion seen at the last settled render; null until steps first arrive. */
  private lastComplete: boolean | null = null;

  constructor() {
    // `completed` fires on the CHANGE to complete. A checklist that loads
    // already complete is a returning user, not an achievement.
    effect(() => {
      const ready = this.loaded();
      const complete = this.complete();
      if (!ready) return;
      const before = this.lastComplete;
      this.lastComplete = complete;
      if (before === false && complete) untracked(() => this.completed.emit());
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Close the checklist and emit `dismissed`. */
  dismiss(): void {
    this.open.set(false);
    this.dismissed.emit();
  }

  /** Hide or show the steps. */
  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  /**
   * @internal A box was ticked. The DOM goes back to the state the host gave;
   * the host's updated `done` is what moves it — so a host that refuses the
   * change never shows a tick it did not record.
   */
  protected toggle(row: StepRow, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const done = target.checked;
    target.checked = row.done;
    this.stepToggle.emit({ step: row.step, done });
  }

  /** @internal A step's action was activated. */
  protected act(row: StepRow): void {
    this.stepAction.emit(row.step);
  }
}
