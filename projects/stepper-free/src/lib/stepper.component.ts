import {
  inject,
  ElementRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  createCloseGuard,
  svAttrSelector,
  svNavParam,
  svNavRecorder,
  svRecoverFocus,
  svWarnOnce,
  svWarnRestoreRefused,
  svUniqueId,
  type SvCloseReason,
  type SvDataError,
  type SvNavIntent,
  type SvUnresolvedValue,
  svLocalStorage,
} from '@styloviz/core';
import {
  svRestoreStepperResume,
  svSerializeStepperResume,
  type SvStepperResume,
} from './stepper.resume';
import {
  svStepperIsSettled,
  svStepperLifecycleOf,
  svStepperPresentation,
  svStepperTransitionFor,
  type StepperStepLifecycle,
  type StepperTransition,
} from './stepper.machine';

/** This component's selector, for the one dev warning it can emit. */
const SELECTOR = 'sv-stepper';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepperVariant = 'default' | 'pill' | 'minimal' | 'icon' | 'dot' | 'line' | 'tracker';
export type StepperSize = 'sm' | 'md' | 'lg';
export type StepperMode = 'standard' | 'branch';

/**
 * What a step LOOKS LIKE — a presentation vocabulary, not a lifecycle.
 *
 * ★★ `warning` and `disabled` are appearances; `current` is a position. The
 *    lifecycle axis lives in `stepper.machine.ts` as {@link StepperStepLifecycle}
 *    and the two are related by one function, `svStepperPresentation`
 *    (`NV-05-M1`). Nothing here was renamed or removed — `status` on a
 *    {@link StepperItem} still pins the appearance verbatim.
 *
 * ★ `skipped` is the one addition, and it is additive: no consumer can have
 *   been producing it, every existing member styles identically, and it is the
 *   presentation of the lifecycle state the old union could not express.
 */
export type StepperStepStatus =
  | 'pending'
  | 'current'
  | 'complete'
  | 'skipped'
  | 'error'
  | 'warning'
  | 'disabled';

export interface StepperItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  optional?: boolean;
  /**
   * Pin the step's APPEARANCE. Outranks everything, including `lifecycle` —
   * a host that was setting this before keeps exactly the render it had.
   */
  status?: StepperStepStatus;
  /**
   * Where the step is in its lifecycle: `pending | active | complete | skipped
   * | error` (`NV-05-M1`). Drives the linear gate and, unless `status` pins it,
   * the appearance.
   *
   * Omitted = derived from position, which is what every stepper did before
   * this existed: behind the active index is `complete`, on it is `active`,
   * ahead of it is `pending`.
   */
  lifecycle?: StepperStepLifecycle;
  /**
   * Does this step's data currently pass validation? **Independent of
   * `lifecycle`** — `NV-05-I11`.
   *
   * ★★ COMPLETE AND VALID ARE NOT THE SAME THING. A step the user finished
   *    whose data the server later rejected is `{ lifecycle: 'complete', valid:
   *    false }`, and there was previously no way to say it: the host had to
   *    choose between showing the step as done (and hiding the problem) or as
   *    errored (and claiming the user never finished it).
   *
   * Omitted = the stepper has no opinion, and asserts none.
   */
  valid?: boolean;
  /** Branch key to which this step belongs (advanced branch mode). */
  branch?: string;
  /** Selecting this step sets the active branch to the provided value. */
  selectsBranch?: string;
  /** Optional short badge next to the step label. */
  badge?: string;
}

export interface StepperChangeEvent {
  previousIndex: number;
  currentIndex: number;
  step: StepperItem;
}

/**
 * Why a move was refused, as `stepBlocked` reports it.
 *
 * ★ Widened additively (`NV-05`): the gate's own `'disabled'`, plus
 *   `'validation'` for an `asyncValidation` `deny()` given no reason, plus
 *   whatever string the host passed to `deny(reason)` — carried through
 *   verbatim, which is what it always did at runtime while the type claimed it
 *   could not happen. `(string & {})` keeps the named members autocompleting.
 *   The Pro twin's union is a superset (it adds `linear` and `guard`), so the
 *   upgrade stays a drop-in.
 */
export type StepperBlockReason = 'disabled' | 'validation' | (string & {});

export interface StepperBlockedEvent {
  index: number;
  step: StepperItem;
  reason: StepperBlockReason;
}

export interface StepperBranchChangeEvent {
  branch: string | null;
  step: StepperItem;
}

// ─── The state machine's public surface (NV-05-M1, I2, I8, I11) ───────────────

/**
 * Why the stepper is trying to leave the step the user is on — `NV-05-I8`.
 *
 * ★★ DELIBERATELY NOT `SvCloseReason`. The shared guard's vocabulary is the
 *    overlay one (`backdrop`, `escape`, …) and none of those words describes
 *    activating a step; leaking them would make a host write
 *    `reason === 'close-button'` to mean "the user clicked step 3". The two are
 *    MAPPED, in one place, rather than conflated — the policy is adopted, only
 *    the naming is local.
 */
export type StepperLeaveReason = 'step-select' | 'programmatic';

/** `StepperLeaveReason` → the shared guard's vocabulary. */
const LEAVE_TO_CLOSE: Readonly<Record<StepperLeaveReason, SvCloseReason>> = {
  'step-select': 'close-button',
  programmatic: 'programmatic',
};

/** …and back, for what the component reports to its host. */
const CLOSE_TO_LEAVE: Readonly<Partial<Record<SvCloseReason, StepperLeaveReason>>> = {
  'close-button': 'step-select',
  programmatic: 'programmatic',
};

/**
 * What returning to an earlier step does to the steps after it — `NV-05-I2`.
 *
 * ★★★ ONLY THE CONSUMER KNOWS. Editing the billing step invalidates the
 *     confirmation step in one wizard and nothing at all in another, and a
 *     component that picked either answer would be wrong half the time. So the
 *     stepper does not decide; it computes the set the chosen policy names and
 *     **emits it**, and the host applies it to its own step list.
 *
 * - `preserve` — nothing is invalidated. Today's behaviour, and the default.
 * - `invalidate-later` — every step after the one returned to, that is not
 *   already `pending`.
 * - `custom` — whatever `invalidatesOnRevisit` returns.
 */
export type StepperRevisitPolicy = 'preserve' | 'invalidate-later' | 'custom';

/** What `invalidatesOnRevisit` is told before it names step ids. */
export interface StepperRevisitContext {
  /** The step being returned to. */
  readonly step: StepperItem;
  /** Its index among the visible steps. */
  readonly index: number;
  /** Where the user was. Always greater than `index`. */
  readonly previousIndex: number;
  /** The visible steps, in order. */
  readonly steps: readonly StepperItem[];
  /** Each visible step's current lifecycle, index-aligned with `steps`. */
  readonly lifecycles: readonly StepperStepLifecycle[];
}

/**
 * "You went back, so these steps are no longer done." Emitted on a backwards
 * move when the policy names at least one step.
 *
 * The stepper does NOT mutate the steps: `lifecycle` lives on the host's own
 * `items`, so the host is the only thing that can write it. This event is the
 * instruction.
 */
export interface StepperInvalidationEvent {
  /** The step returned to. */
  readonly step: StepperItem;
  readonly index: number;
  readonly previousIndex: number;
  /** The named transition the host should apply to each of `steps`. */
  readonly transition: Extract<StepperTransition, 'reset'>;
  readonly steps: readonly StepperItem[];
  readonly stepIds: readonly string[];
}

/**
 * The flow's two independent answers — `NV-05-I11`.
 *
 * ★★ THERE IS NO `ready` OR `submittable` FIELD, ON PURPOSE. `complete &&
 *    valid` is one `&&` at the call site, and a single "can I submit?" boolean
 *    is exactly the conflation this item exists to undo — it would let a host
 *    stop distinguishing "the user has not finished" from "what they entered is
 *    wrong", which are different screens.
 */
export interface StepperFlowStatus {
  /** Every non-`optional` visible step has lifecycle `complete`. */
  readonly complete: boolean;
  /** No visible step reports `valid: false`. */
  readonly valid: boolean;
  /** At least one visible step has lifecycle `error`. */
  readonly errored: boolean;
  /** Index of the first non-`optional` step that is not `complete`, or `-1`. */
  readonly firstIncompleteIndex: number;
  /** Visible steps whose lifecycle is neither `complete` nor `skipped`. */
  readonly unsettledCount: number;
}

/** One step, as the state machine sees it. Both axes, side by side. */
export interface StepperStepState {
  readonly id: string;
  readonly index: number;
  /** Where it is in the machine. */
  readonly lifecycle: StepperStepLifecycle;
  /** What it looks like. */
  readonly presentation: StepperStepStatus;
  /** What the host said about its data, or `undefined` if it said nothing. */
  readonly valid: boolean | undefined;
}

interface NormalizedStep {
  index: number;
  item: StepperItem;
  state: StepperStepStatus;
  /** ★ The lifecycle axis, carried alongside the presentation one. */
  lifecycle: StepperStepLifecycle;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Stepper — multi-step progress and workflow navigation component.
 *
 * Features:
 * - 7 variants: six wizard styles (default, pill, minimal, icon, dot, line)
 *   plus `tracker`, a non-interactive progress display — see {@link variant}
 * - Horizontal and vertical orientation
 * - Branch mode for conditional workflows (`mode="branch"`, `activeBranch`)
 * - Validation states: complete, current, warning, error, disabled
 * - Two-way active index via `[(activeIndex)]`
 * - Full keyboard and screen-reader friendly semantics
 *
 * For linear (wizard-gated) sequencing, per-step guard rules, and telemetry
 * events, see the Pro Stepper (`@styloviz-pro/stepper`).
 */
/**
 * A step transition the host may still veto.
 *
 * The stepper does NOT move on its own when `asyncValidation` is on — it asks
 * first. Call `allow()` once the server has validated the step the user is
 * leaving, or `deny(reason)` to keep them where they are. Exactly one of the
 * two takes effect; later calls are ignored, so a handler that resolves and
 * then errors cannot move the user twice.
 */
export interface StepperChangeRequest {
  readonly previousIndex: number;
  readonly currentIndex: number;
  readonly step: StepperItem;
  /** Commit the move. */
  readonly allow: () => void;
  /** Refuse the move; the reason is emitted through `stepBlocked`. */
  readonly deny: (reason?: string) => void;
}

@Component({
  selector: 'sv-stepper',
  standalone: true,
  imports: [
    NgClass,
    SvIconComponent,
    SvErrorShellComponent,
    SvSkeletonShellComponent,
  ],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvStepperComponent {
  /** Per-instance suffix for every id this component puts in the document. */
  /*
   * ★ `svUniqueId`, not a module-level counter — `X-10` / `T0-2`.
   *
   * The counter this replaced belonged to the MODULE, so a long-lived server
   * process shared it across requests: the second page it rendered emitted
   * `-2-` while the browser, loading the module for the first time, emitted
   * `-1-`. Server HTML and first client render disagreed, which is a hydration
   * mismatch. Reproduced in `core`'s `unique-id.spec.ts` before it was fixed.
   */
  readonly _uid = svUniqueId('sv-stepper');

  /** Scoped focus target — `document.getElementById` finds whichever
   *  instance came first in the document. */
  private readonly _host = inject(ElementRef);

  /**
   * Focus tasks still waiting on a render. Cleared on destroy so none outlives
   * the component — a prompt-focus or recovery task that fires into a detached
   * tree is a no-op at best, and at worst steals focus from whatever replaced it.
   */
  private readonly focusTasks = new Set<ReturnType<typeof setTimeout>>();

  protected readonly cancelFocusTasks = inject(DestroyRef).onDestroy(() => {
    for (const id of this.focusTasks) clearTimeout(id);
    this.focusTasks.clear();
  });

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** The steps to render (label, optional description, state). */
  items = input<StepperItem[]>([]);

  /** 0-based active step index. Supports two-way binding via `[(activeIndex)]`. */
  activeIndex = model<number>(0);

  /** Layout: horizontal or vertical. @default 'horizontal' */
  orientation = input<StepperOrientation>('horizontal');
  /**
   * Visual variant — and with it, whether this is a wizard or a tracker.
   * `default`, `pill`, `minimal`, `icon`, `dot` and `line` are WIZARD styles:
   * every step is a `<button>`, and the linear gate, keyboard, `stepClick` and
   * the unsaved prompt are all live. `'tracker'` is a PROGRESS DISPLAY (an
   * order-status strip): it renders a non-interactive `<ol>` with no buttons, so
   * nothing in it can be clicked, focused or arrowed through and `stepClick` /
   * `stepChangeRequest` never fire from it.
   *
   * ★ Two axes share this one input — look and interactivity. Choose `tracker`
   *   to show where something IS, not to let the user move it; for a wizard's
   *   look without its navigation, keep a wizard style and set
   *   `interactive=false` instead.
   *
   * @default 'default'
   */
  variant = input<StepperVariant>('default');
  /** Step size: sm, md or lg. @default 'md' */
  size = input<StepperSize>('md');
  /** Navigation mode: standard sequence, or branch (conditional paths via `activeBranch`). @default 'standard' */
  mode = input<StepperMode>('standard');


  /** Whether users can click steps to navigate. */
  interactive = input<boolean>(true);

  /** Show step descriptions under labels. */
  showDescriptions = input<boolean>(true);

  /** Render connectors between steps. */
  showConnectors = input<boolean>(true);

  /** Enables advanced keyboard shortcuts for rapid step navigation. */
  enableHotkeys = input<boolean>(false);


  /** Active branch key used in `mode='branch'`. Supports two-way binding. */
  activeBranch = model<string | null>(null);

  /** Extra CSS classes for the root element. */
  customClass = input<string>('');

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   * `scripts/generate-component-docs.mjs` lifts an input's JSDoc verbatim into
   * one table cell, so the reasoning lives here. (Plain opener on purpose — a
   * closing-delimiter sequence inside a doc comment ends it early.)
   *
   * ── Two mechanisms, and `X-9`'s line between them ───────────────────────────
   * **The step survives a refresh and the data does not.** `urlKey` makes the
   * position addressable; `persistKey` makes it recoverable. They are different
   * mechanisms with different failure modes, and putting `step=3` in a URL is not
   * resumability — the wizard still comes back empty.
   *
   * ── ★ The URL carries a step ID, never an index ─────────────────────────────
   * `?step=payment`, not `?step=2`. A saved index is wrong the moment the
   * workflow's steps change: insert one and every link written before today
   * points somewhere else, confidently. An id survives an edit, and an id that
   * has disappeared is *detectable*, which is what lets a stale link do nothing
   * instead of landing on whatever now sits at position 2. Same reasoning as
   * `sv-product-tour`'s stored progress, and the same reasoning behind
   * `SvStepperResume.stepId`.
   *
   * ── ★ A link cannot jump a gate the workflow has not opened ─────────────────
   * Two rules enforce that, and they are separate because they fail separately:
   *
   *   1. **A URL-driven move goes through the same gate a click does.** Not
   *      `interactive` — that is about the pointer — but the workflow's own
   *      rules: a disabled step, and in the Pro twin `linear` sequencing and
   *      `guardRules`. Without this, `?step=confirm` walks straight past the
   *      validation the wizard exists to enforce.
   *   2. **A restored position outranks the URL, on arrival only.** A persisted
   *      payload saying step 1 and a link saying step 3 disagree, and the
   *      persisted one is the one that knows what the user actually did. After
   *      that first reconciliation the URL is live again, so back and forward
   *      work normally.
   *
   * ── ★ And a URL-driven move does NOT go through `asyncValidation` ───────────
   * `stepChangeRequest` asks the host for permission before moving. That is
   * right for a click and wrong for the back button: the browser has *already*
   * navigated, so a `deny()` arriving afterwards leaves the address bar naming a
   * step the component refused to enter — a URL that lies. The gate above is
   * synchronous and is the check that applies here.
   *
   * `NV-05-I6`, `NV-05-I7`, `NV-05-M2`, `NV-05-M3`,
   * `docs/navigation-routing-adr.md`.
   */

  /**
   * Put the current step's **id** in the URL under this key, so a step can be
   * shared and the back button moves one step back. Needs
   * `provideSvNavLocation()` at the app root.
   * @default null — no URL synchronisation
   */
  urlKey = input<string | null>(null);

  /*
   * ── Navigation analytics — `X-15` ──────────────────────────────────────────
   *
   * The shared stream is `SV_NAV_TELEMETRY` in `@styloviz/core`, and the free
   * stepper feeds it exactly as the Pro twin does.
   *
   * ⚠️ **This is not the Pro `(telemetry)` output arriving in free.** That one
   *    is a per-step fact stream with branch keys and six event types, and it
   *    stays Pro. This records one entry per MOVE, in a vocabulary shared with
   *    every other navigation surface, and it is a seam rather than a feature:
   *    a kit whose analytics contract worked only for paying consumers would
   *    have a contract nobody could build on.
   *
   * ★ `branchChange` and `stepsInvalidated` are deliberately not recorded here.
   *   The first is a property of the move that follows it, the second is a
   *   consequence of one, and the shared stream records moves — one per move,
   *   or comparing this surface against a sidebar becomes arithmetic about
   *   which component is chattier.
   */

  /**
   * Names this stepper in the shared navigation-analytics stream, when a page
   * has more than one. Ignored unless `provideSvNavTelemetry()` is wired up.
   * @default null
   */
  surfaceId = input<string | null>(null);

  /**
   * Where `localStorage` keeps this workflow's position, so a reload resumes
   * rather than restarting. Stores the step id and branch only — never the
   * host's form data. Empty = no persistence.
   * @default '' — no persistence
   */
  persistKey = input<string>('');

  // ── Server-validated transitions ────────────────────────────────────────────

  /**
   * Ask before moving. With this on, activating a step emits
   * `stepChangeRequest` and nothing happens until the host calls `allow()` or
   * `deny()` — which is what lets a wizard validate the current step against
   * the server before letting the user leave it.
   * @default false
   */
  asyncValidation = input<boolean>(false);

  /**
   * Index currently being validated, or `-1`. That step shows a spinner and the
   * stepper ignores further activations, so a double-click cannot start two
   * validations.
   * @default -1
   */
  validatingIndex = input<number>(-1);

  // ── Revisiting an earlier step (NV-05-I2) ───────────────────────────────────

  /**
   * What returning to an earlier step does to the steps after it. See
   * {@link StepperRevisitPolicy}.
   *
   * ★ `'preserve'` IS TODAY'S BEHAVIOUR, and that is why it is the default:
   *   before this input there was no defined effect at all, so anything else
   *   would start invalidating work in wizards that never asked for it.
   *
   * @default 'preserve' — a revisit invalidates nothing
   */
  revisitPolicy = input<StepperRevisitPolicy>('preserve');

  /**
   * With `revisitPolicy="custom"`, the step ids a revisit invalidates. Ids that
   * are not visible steps are ignored.
   *
   * ```ts
   * protected readonly recomputeTotals = (c: StepperRevisitContext) =>
   *   c.step.id === 'billing' ? ['shipping', 'confirm'] : [];
   * ```
   *
   * @default null — nothing invalidated, and a dev warning if the policy is `custom`
   */
  invalidatesOnRevisit = input<((context: StepperRevisitContext) => readonly string[]) | null>(null);

  // ── Leaving a step with unsaved work (NV-05-I8) ─────────────────────────────

  /**
   * Is there unsaved work in the step the user is on?
   *
   * ★★★ `NV-05-I8`: A WIZARD STEP'S FORM COULD BE ABANDONED BY ONE CLICK ON
   *     ANOTHER STEP, with no warning and no undo. Set this and the stepper
   *     ASKS instead of moving — from `createCloseGuard`, the same primitive
   *     Modal, Drawer and Confirm Dialog use, so the prompt behaves identically
   *     in all four and the order of the questions is decided once (`X-11`,
   *     `docs/close-policy-adr.md`).
   *
   * @default false
   */
  dirty = input<boolean>(false);

  /**
   * The host's own veto on leaving a step, consulted **before** the unsaved
   * check. Return `false` to refuse; return nothing to have no opinion.
   *
   * A veto is silent — it does NOT raise the unsaved-changes prompt, because
   * the host refused for its own reasons and owns its own messaging. That
   * ordering is the primitive's, not this component's.
   *
   * @default null
   */
  canLeaveStep = input<((reason: StepperLeaveReason) => boolean | void) | null>(null);

  /**
   * Render the built-in unsaved-changes prompt. Turn it off to drive your own
   * dialog from `promptingDiscard()` / `discardChanges()` / `keepEditing()`.
   * @default true
   */
  showUnsavedPrompt = input<boolean>(true);

  /** Heading of the unsaved-changes prompt. */
  unsavedTitle = input<string>('Leave this step?');

  /** Body of the unsaved-changes prompt. */
  unsavedMessage = input<string>('This step has changes that have not been saved.');

  /** Label of the button that leaves and loses the changes. */
  discardLabel = input<string>('Discard');

  /** Label of the button that stays on the step. */
  keepEditingLabel = input<string>('Keep editing');

  // ── Loading the definition ──────────────────────────────────────────────────

  /**
   * True while the step definition is being fetched. A wizard defined server-side — onboarding flows, dynamic forms — arrives asynchronously.
   * @default false
   */
  loading = input<boolean>(false);

  /**
   * Failure loading the step definition. Rendered in place of the content, with a retry.
   * @default null
   */
  error   = input<SvDataError | string | null>(null);

  /** The host should re-run the failed load. */
  retry   = output<void>();

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when the active step changes. */
  stepChange = output<StepperChangeEvent>();

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── ★ `X-10`: a step index is ORDINAL, so this component corrects ───────────
   * `clampedActiveIndex()` already clamped for DISPLAY, which is why `T0` found
   * "the index half is already handled" and why a removed or branched-away step
   * could not strand the render. But the host's `activeIndex` kept the old value,
   * so the DOM and the host's state disagreed with nobody told — the classic
   * controlled-component bug, one layer down from where the audit was looking.
   *
   * An index has a nearest valid value, so the rule says correct it: the model is
   * written back and this output says what happened. `sv-tabs` does the opposite
   * on the same question, because a tab id is a NAME and has no nearest tab.
   *
   * ── And correcting waits for `items` to arrive ──────────────────────────────
   * An empty step list is not evidence that index 3 is wrong; it is evidence that
   * nothing has arrived. Correcting then would reset every deep-linked and
   * resumed wizard to step one on first paint, which is the failure this backlog
   * spent T1 avoiding.
   */

  /**
   * Emitted when `activeIndex` names a step that does not exist — `X-10`,
   * `NV-05-I1`. Carries what was asked for, what is shown, and whether
   * `activeIndex` was corrected.
   */
  unresolved = output<SvUnresolvedValue<number>>();
  /** Emitted when a step is clicked. */
  stepClick = output<{ index: number; step: StepperItem }>();
  /** Emitted when navigation to a step is blocked (e.g. linear validation). */
  stepBlocked = output<StepperBlockedEvent>();
  /**
   * A move the host must approve. Only emitted when `asyncValidation` is on.
   * See {@link StepperChangeRequest}.
   */
  stepChangeRequest = output<StepperChangeRequest>();
  /** Emitted when the active branch changes (branch mode). */
  branchChange = output<StepperBranchChangeEvent>();

  /**
   * A named lifecycle transition just happened — `NV-05-M1`.
   *
   * ★ The transition, not just the destination. `enter` and `reopen` both land
   *   in `active`, and a host that invalidates later work needs to know which
   *   of the two it was; `stepChange` cannot tell it.
   */
  stepTransition = output<{
    readonly step: StepperItem;
    readonly index: number;
    readonly transition: StepperTransition;
    readonly from: StepperStepLifecycle;
    readonly to: StepperStepLifecycle;
  }>();

  /** The revisit policy says these steps are no longer done. See {@link StepperInvalidationEvent}. */
  stepsInvalidated = output<StepperInvalidationEvent>();

  /** `complete` and `valid`, reported separately — see {@link StepperFlowStatus}. */
  flowStatusChange = output<StepperFlowStatus>();

  /** The user chose to abandon unsaved work; the move follows. */
  discarded = output<StepperLeaveReason>();

  /** The user chose to stay on the step. Nothing moved. */
  leaveCancelled = output<StepperLeaveReason>();

  private readonly branchShift = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────

  visibleItems = computed<StepperItem[]>(() => this.itemsForBranch(this.activeBranch()));

  /** The steps a given branch would show — `visibleItems` for any branch, not just the active one. */
  private itemsForBranch(branch: string | null): StepperItem[] {
    if (this.mode() !== 'branch') return this.items();
    return this.items().filter(item => !item.branch || item.branch === branch);
  }

  normalizedSteps = computed<NormalizedStep[]>(() => {
    const current = this.clampedActiveIndex();
    return this.visibleItems().map((item, index) => {
      const lifecycle = this.resolveLifecycle(item, index, current);
      const state = this.resolveState(item, lifecycle);
      return { index, item, state, lifecycle };
    });
  });

  /**
   * Both axes of every visible step, for a host that wants to read the machine
   * rather than re-derive it. See {@link StepperStepState}.
   */
  stepStates = computed<readonly StepperStepState[]>(() =>
    this.normalizedSteps().map(step => ({
      id: step.item.id,
      index: step.index,
      lifecycle: step.lifecycle,
      presentation: step.state,
      valid: step.item.valid,
    })),
  );

  /**
   * Is the flow finished, and is what is in it valid? Two questions, two fields
   * — `NV-05-I11`.
   *
   * ★★★ WHAT THE STEPPER DOES NOT OWN, stated where a reader will find it: it
   *     holds no form state, no route state, no persisted payload beyond the
   *     step id (`persistKey`), and no submission transaction. Every field here
   *     is a summary of what the HOST told it through `items`. A `complete`
   *     flow is not a saved one, and this component cannot know whether it is.
   */
  flowStatus = computed<StepperFlowStatus>(() => {
    const steps = this.normalizedSteps();
    let complete = true;
    let valid = true;
    let errored = false;
    let firstIncompleteIndex = -1;
    let unsettledCount = 0;

    for (const step of steps) {
      const required = !step.item.optional;
      if (required && step.lifecycle !== 'complete') {
        complete = false;
        if (firstIncompleteIndex === -1) firstIncompleteIndex = step.index;
      }
      if (step.item.valid === false) valid = false;
      if (step.lifecycle === 'error') errored = true;
      if (!svStepperIsSettled(step.lifecycle)) unsettledCount += 1;
    }

    return { complete, valid, errored, firstIncompleteIndex, unsettledCount };
  });

  /**
   * Report the flow's status when — and only when — it changes.
   *
   * ★ De-duplicated on the serialised value, for the same reason
   *   `reportUnresolved` is: `items` is very often a getter or a `computed`, so
   *   a fresh-but-equal array arrives on every change-detection pass and an
   *   undeduplicated output would emit at frame rate.
   */
  private lastFlowStatus: string | null = null;

  protected readonly reportFlowStatus = effect(() => {
    const status = this.flowStatus();
    untracked(() => {
      const key = JSON.stringify(status);
      if (key === this.lastFlowStatus) return;
      this.lastFlowStatus = key;
      this.flowStatusChange.emit(status);
    });
  });

  clampedActiveIndex = computed(() => {
    const max = this.visibleItems().length - 1;
    if (max < 0) return 0;
    return Math.max(0, Math.min(this.activeIndex(), max));
  });

  rootClasses = computed(() => {
    const isVertical = this.orientation() === 'vertical';
    const base = isVertical ? 'flex flex-col gap-0' : 'flex items-start';
    return [base, this.customClass()].filter(Boolean).join(' ');
  });



  // ── Controlled-value reconciliation (`X-10`) ──────────────────────────────

  /** The last state reported, so a re-render is not a new event. */
  private lastUnresolved: string | null = null;

  /**
   * Bring `activeIndex` into agreement with what is rendered.
   *
   * ★ Held while `visibleItems()` is empty — an empty step list is not evidence
   * that index 3 is wrong, and correcting then resets every deep-linked and
   * resumed wizard to step one on first paint.
   */
  protected readonly reconcileIndex = effect(() => {
    const requested = this.activeIndex();
    const items = this.visibleItems();
    const rendered = this.clampedActiveIndex();

    untracked(() => {
      if (!items.length) {
        if (requested !== 0) {
          this.reportUnresolved(requested, requested, 'not-loaded', false);
        } else {
          this.lastUnresolved = null;
        }
        return;
      }

      if (requested === rendered) {
        this.lastUnresolved = null;
        return;
      }

      this.reportUnresolved(requested, rendered, 'out-of-range', true);
      this.activeIndex.set(rendered);
    });
  });

  /**
   * ★ `NV-05-I1`, the focus half (`X-14`). A branch switch or a host removing
   *   steps can unmount the step button that holds focus, and the browser drops
   *   focus to `<body>` — the top of the document. The index half is
   *   `reconcileIndex` above; this puts focus on the corrected active step's
   *   button, else the host, never `<body>`.
   *
   *   The focused step is read HERE, before this flush re-renders the list —
   *   afterwards the button is gone and there is nothing left to ask.
   */
  protected readonly recoverFocusOnItemsChange = effect(() => {
    const items = this.visibleItems();
    untracked(() => {
      const focused = this.focusedStepId();
      if (focused === null || items.some(item => item.id === focused)) return;
      this.afterRender(() => this.recoverFocus(null));
    });
  });

  private reportUnresolved(
    requested: number,
    rendered: number,
    reason: SvUnresolvedValue<number>['reason'],
    corrected: boolean,
  ): void {
    const key = `${requested}|${rendered}|${reason}`;
    if (key === this.lastUnresolved) return;
    this.lastUnresolved = key;
    this.unresolved.emit({ requested, rendered, reason, corrected });
  }

  // ── Addressability and resume ───────────────────────────────────────────────

  /**
   * The current step's projection into the URL. Inert until `urlKey` is set *and*
   * the app provided a location — see {@link urlKey}.
   *
   * `push`, per the ADR: back moves one step back, which is the gesture users
   * reach for and which today exits the wizard entirely.
   */
  private readonly stepParam = svNavParam(() => this.urlKey(), { mode: 'push' });

  /** Set once a persisted position has been applied; see rule 2 on {@link urlKey}. */
  private readonly resumed = signal(false);

  /** One restore attempt per instance, once there are steps to resolve against. */
  private restoreAttempted = false;

  /** Whether the URL's arriving value has been reconciled with the restore yet. */
  private urlReconciled = false;

  /**
   * The last parameter value this component has acted on or written.
   *
   * ★★ Without it the two effects below are a LOOP, and a subtle one.
   * `normalizedSteps()` depends on the active index — each step's `complete` /
   * `current` / `pending` state is derived from it — so *moving* re-runs the
   * reader, which then finds the URL still naming the step the writer has not
   * got round to updating and moves the user straight back. Observed: stepping
   * forward and back again left the URL and the component locked on the forward
   * step. Same shape as `sv-anchor`'s `lastWritten`, and the second time this
   * family has needed it, which makes it the pattern rather than a workaround:
   * **a component that both reads and writes one location has to be able to
   * recognise its own echo.**
   */
  private lastUrlSeen: string | null = null;

  /**
   * Restore the stored position. Runs once, as soon as there are steps — before
   * that there is nothing to resolve a stored id against, and refusing on an
   * empty list would report a perfectly good blob as stale.
   *
   * ★★ `NV-05-I7` / `NV-05-M3`: resolved against the STORED branch's steps, not
   *    `visibleItems()`. Those are the steps of whatever branch is active NOW —
   *    on a fresh load, the default one — so a stored step that exists only in
   *    the branch the user had chosen was "not found" and every branched resume
   *    silently started over. Waiting on `items()` rather than `visibleItems()`
   *    is the same point: a branch-only list is empty until the branch is
   *    applied, and that is not "no steps yet".
   */
  protected readonly restoreOnce = effect(() => {
    const key = this.persistKey();
    const all = this.items();

    untracked(() => {
      if (this.restoreAttempted || !key || !all.length) return;
      this.restoreAttempted = true;

      const blob = this.readStoredJson(key);
      if (blob === null) return;

      const restored = svRestoreStepperResume(blob);
      if (!restored.ok) {
        // A restore that silently falls back to defaults is right for the user
        // and indistinguishable, during development, from one never wired up.
        svWarnRestoreRefused(SELECTOR, restored);
        return;
      }

      const branch = restored.state.branch;
      const at = this.itemsForBranch(branch).findIndex(item => item.id === restored.state.stepId);
      // ★ What an id buys over an index: a step that no longer exists is
      //   detectable, so the workflow starts over instead of landing on whatever
      //   now happens to sit at that position.
      if (at === -1) return;

      if (branch !== this.activeBranch()) this.activeBranch.set(branch);
      this.activeIndex.set(at);
      this.resumed.set(true);
    });
  });

  /**
   * Save the position after every move.
   *
   * ★ EQUIVALENT MUTANT, and stated rather than hidden: deleting
   * `!this.restoreAttempted` changes no observable behaviour today, and no test
   * can be written that catches it. The reason it is safe is **declaration
   * order** — `restoreOnce` is a field above this one, so it runs first in every
   * flush and the stored position is read before this could overwrite it.
   *
   * The guard stays because that is a bad thing to depend on. Moving this field
   * above `restoreOnce` would make the first flush write the DEFAULT position
   * over the stored one before the restore has seen it, and persistence would
   * silently erase itself on every load — a failure that looks like "persistence
   * was never wired up" rather than like a reordering. Same shape as
   * `sv-accordion`'s `reconciled` guard, which is NOT equivalent because its
   * writer genuinely runs first.
   *
   * (`onKeydown`'s empty-list check in this same file is the other one of these;
   * the convention here is to keep the belt-and-braces pair and say so.)
   */
  protected readonly persistOnChange = effect(() => {
    const index = this.clampedActiveIndex();
    const branch = this.activeBranch();
    const items = this.visibleItems();

    untracked(() => {
      const key = this.persistKey();
      if (!key || !this.restoreAttempted) return;
      const stepId = items[index]?.id;
      if (!stepId) return;
      this.writeStoredJson(key, { stepId, branch });
    });
  });

  /**
   * URL → component. The deep-link and back-button path. See {@link urlKey} for
   * the two rules this enforces and why a denied async validation cannot apply
   * here.
   */
  protected readonly syncFromUrl = effect(() => {
    const raw = this.stepParam.value();
    const steps = this.normalizedSteps();
    const restored = this.resumed();

    untracked(() => {
      // Its own echo, or a re-render that changed nothing in the location.
      if (raw === this.lastUrlSeen) return;
      if (!steps.length) return;

      // ★ The key DISAPPEARING is a move, not a no-op. Step one writes no key,
      //   so with `push` the first back-press from step two lands on the keyless
      //   URL — and reading that as "nothing to do" would make the back button
      //   stop exactly one step short of the thing this adoption exists to fix.
      //   `lastUrlSeen === null` keeps the very first render out of it: a page
      //   that never had the key is not a page somebody navigated back from.
      if (raw === null || raw === '') {
        if (this.lastUrlSeen === null || !this.stepParam.addressable()) return;
        this.lastUrlSeen = null;
        this.applyFromUrl(steps[0], restored);
        return;
      }

      const target = steps.find(step => step.item.id === raw);
      // Not resolvable: either the steps have not arrived, or the link names a
      // step this workflow no longer has. Both mean "do nothing, and look again
      // when the steps change" — validate the value's form, never its membership
      // of a collection that may not have arrived.
      if (!target) return;

      this.lastUrlSeen = raw;
      this.applyFromUrl(target, restored);
    });
  });

  /** The half of {@link syncFromUrl} that is the same for a step and for step one. */
  private applyFromUrl(target: NormalizedStep | undefined, restored: boolean): void {
    if (!target) return;

    if (!this.urlReconciled) {
      this.urlReconciled = true;
      // Rule 2 on `urlKey`: a restored position outranks the URL, on arrival only.
      if (restored) return;
    }

    if (target.index === this.clampedActiveIndex()) return;
    if (this.gateReason(target) !== null) return;

    // ★★ AND A URL-DRIVEN MOVE DOES NOT RAISE THE UNSAVED PROMPT (`NV-05-I8`).
    //    Same reasoning as `asyncValidation` above it: the browser has ALREADY
    //    navigated, so a refusal arriving afterwards leaves the address bar
    //    naming a step the component refused to enter — a URL that lies. The
    //    prompt exists for a gesture the component can still take back, and a
    //    committed history entry is not one.
    this.commitStep(this.clampedActiveIndex(), target, 'address');
  }

  /**
   * Component → URL.
   *
   * The first step writes `null` rather than its own id: it is where the wizard
   * starts, and a URL carrying its own default makes two identical pages look
   * like two different ones to analytics and to a cache.
   */
  protected readonly syncToUrl = effect(() => {
    const index = this.clampedActiveIndex();
    const items = this.visibleItems();

    untracked(() => {
      if (!this.stepParam.addressable()) return;
      // ★ No steps, nothing to name — and writing `null` here would DELETE a deep
      //   link before the steps that justify it have arrived. Third family to hit
      //   the same rule: an empty collection is not evidence, it is an absence.
      if (!items.length) return;

      const next = index === 0 ? null : (items[index]?.id ?? null);
      if (this.stepParam.value() === next) return;

      this.lastUrlSeen = next;
      this.stepParam.set(next);
    });
  });

  /** `null` for absent, unparseable or unavailable storage — a reader cannot tell
   * those apart, and none of them is a refused restore worth warning about. */
  private readStoredJson(key: string): unknown {
    const store = svLocalStorage();
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private writeStoredJson(key: string, resume: SvStepperResume): void {
    const store = svLocalStorage();
    if (!store) return;
    try {
      store.setItem(key, JSON.stringify(svSerializeStepperResume(resume)));
    } catch { /* ignore quota / privacy-mode errors */ }
  }

  // ── State helpers ─────────────────────────────────────────────────────────

  /**
   * Where this step is in the LIFECYCLE (`NV-05-M1`), in precedence order:
   *
   *   1. `item.lifecycle` — the host said so outright.
   *   2. `item.status` — the host pinned an appearance, so infer the lifecycle
   *      that appearance has always implied. `svStepperLifecycleOf` is the map,
   *      and it is chosen so the linear gate's answers do not change.
   *   3. position — behind the cursor is `complete`, on it `active`, ahead
   *      `pending`. Byte-for-byte the rule this component always had.
   */
  private resolveLifecycle(
    item: StepperItem,
    index: number,
    current: number,
  ): StepperStepLifecycle {
    if (item.lifecycle) return item.lifecycle;
    if (item.status) return svStepperLifecycleOf(item.status);
    if (index < current) return 'complete';
    if (index === current) return 'active';
    return 'pending';
  }

  /**
   * What this step LOOKS LIKE.
   *
   * ★ `item.status` still wins, verbatim and first, so every consumer that set
   *   it before gets the identical render. Everything else is the lifecycle
   *   projected through `svStepperPresentation`, which for a positionally
   *   derived lifecycle returns exactly what the old three-line version did.
   */
  private resolveState(item: StepperItem, lifecycle: StepperStepLifecycle): StepperStepStatus {
    if (item.status) return item.status;
    return svStepperPresentation(lifecycle, item.valid);
  }

  isClickable(step: NormalizedStep): boolean {
    if (!this.interactive()) return false;
    return this.blockReason(step) === null;
  }

  private blockReason(step: NormalizedStep): 'disabled' | null {
    // A non-interactive stepper is a read-only tracker, and every step in it is
    // effectively disabled. This used to return `null`, which only stopped
    // `isClickable` (styling and aria) — the rows are still real <button>s with
    // a live (click) handler, so every click navigated anyway.
    if (!this.interactive()) return 'disabled';
    return this.gateReason(step);
  }

  /**
   * The WORKFLOW's own refusal, with `interactive` deliberately left out.
   *
   * ★ Split out for the URL path. `interactive` is a statement about the
   * pointer — a read-only tracker whose steps are not clickable — and folding it
   * in here would make `urlKey` silently inert on one, which is a surprise
   * rather than a rule. The gate is about what the workflow allows, and that is
   * the question a deep link has to answer.
   */
  private gateReason(step: NormalizedStep): 'disabled' | null {
    // `disabled` is read off the PRESENTATION axis on purpose: being disabled is
    // an interaction fact, not a position in the lifecycle. The Pro twin's
    // `linear` and `guardRules` checks, which sit here, ask the lifecycle
    // instead — see `svStepperIsSettled`.
    if (step.state === 'disabled') return 'disabled';
    return null;
  }

  onSelect(step: NormalizedStep): void {
    // A second click while the server is still validating would start a
    // parallel request and make the outcome undefined.
    if (this.validatingIndex() >= 0) return;

    this.stepClick.emit({ index: step.index, step: step.item });
    this.activate(step, 'step-select', true);
  }

  /**
   * The activation path, minus the raw click report.
   *
   * ★ Split out for `discardChanges()`, which resumes an activation the unsaved
   *   prompt interrupted. Re-entering `onSelect` there would emit a SECOND
   *   `stepClick` for one click — a click stream that double-counts is worse
   *   than one that under-counts, because analytics cannot tell.
   */
  private activate(step: NormalizedStep, leaveReason: StepperLeaveReason, guarded: boolean): void {
    const reason = this.blockReason(step);
    if (reason) {
      this.stepBlocked.emit({ index: step.index, step: step.item, reason });
      // ★★ A refusal leaves no other trace anywhere. The user pressed a step,
      //    nothing moved, and no page view was recorded — so a wizard whose
      //    gate is misconfigured is invisible to conventional analytics. This
      //    is the intent that pays for the vocabulary (`X-15`).
      this.recordNav('blocked', step, reason);
      return;
    }

    // ★★ THE UNSAVED CHECK GOES BEFORE THE BRANCH SWITCH, not after it
    //    (`NV-05-I8`). The branch switch is a visible side effect — it changes
    //    which steps exist — so running it first and then raising the prompt
    //    would leave the user looking at a different workflow while being asked
    //    whether to leave the step they are still on.
    if (guarded && step.index !== this.clampedActiveIndex()) {
      if (!this.requestLeave(step, leaveReason)) return;
    }

    if (step.item.selectsBranch && this.activeBranch() !== step.item.selectsBranch) {
      this.activeBranch.set(step.item.selectsBranch);
      this.branchChange.emit({ branch: step.item.selectsBranch, step: step.item });
      this.triggerBranchShift();
    }

    const previous = this.clampedActiveIndex();
    if (previous === step.index) return;

    if (this.asyncValidation()) {
      // Ask, don't move. Moving first and reverting on failure would flash the
      // next step's content — including any form the user has not filled in.
      let settled = false;
      this.stepChangeRequest.emit({
        previousIndex: previous,
        currentIndex: step.index,
        step: step.item,
        allow: () => {
          if (settled) return;
          settled = true;
          this.commitStep(previous, step);
        },
        deny: (reason?: string) => {
          if (settled) return;
          settled = true;
          const refused: StepperBlockReason = reason ?? 'validation';
          this.stepBlocked.emit({ index: step.index, step: step.item, reason: refused });
          this.recordNav('blocked', step, refused);
        },
      });
      return;
    }

    this.commitStep(previous, step);
  }

  /** Apply an approved transition. */
  private commitStep(
    previous: number,
    step: NormalizedStep,
    /**
     * Where the move came from. The ONLY thing this changes is what `X-15`
     * calls the move: a back button and a deep link are `resume`, not a
     * gesture, and counting them together would make the browser look like the
     * kit's most-used navigation surface.
     */
    source: 'gesture' | 'address' = 'gesture',
  ): void {
    // ★ Read before the write. `normalizedSteps()` derives every lifecycle from
    //   the active index, so after `activeIndex.set()` the target's lifecycle is
    //   already `active` and the transition that got it there is unrecoverable.
    const from = step.lifecycle;
    const revisit = step.index < previous
      ? this.invalidatedByRevisit(step, previous)
      : null;

    this.activeIndex.set(step.index);
    this.stepChange.emit({ previousIndex: previous, currentIndex: step.index, step: step.item });

    // `enter` or `reopen` — the two names for landing in `active` (`NV-05-M1`).
    const transition = svStepperTransitionFor(from, 'active');
    if (transition) {
      this.stepTransition.emit({
        step: step.item,
        index: step.index,
        transition,
        from,
        to: 'active',
      });
    }

    this.recordNav(
      source === 'address' ? 'resume' : this.moveIntent(previous, step.index),
      step,
    );

    if (revisit) this.stepsInvalidated.emit(revisit);
  }

  /**
   * Which steps a backwards move invalidates, per {@link revisitPolicy} —
   * `NV-05-I2`. `null` when the answer is "none", so `commitStep` emits nothing
   * at all under the default policy.
   */
  private invalidatedByRevisit(
    step: NormalizedStep,
    previousIndex: number,
  ): StepperInvalidationEvent | null {
    const policy = this.revisitPolicy();
    if (policy === 'preserve') return null;

    const steps = this.normalizedSteps();
    let targets: NormalizedStep[];

    if (policy === 'invalidate-later') {
      // Already `pending` is already invalid; re-reporting it would make a
      // host's reducer run for no change on every backwards move.
      targets = steps.filter(s => s.index > step.index && s.lifecycle !== 'pending');
    } else {
      const namer = this.invalidatesOnRevisit();
      if (!namer) {
        svWarnOnce(
          `${SELECTOR}:revisit-custom-without-namer`,
          `<${SELECTOR}> has revisitPolicy="custom" but no [invalidatesOnRevisit] — no step will ever be invalidated. Provide the function, or use "invalidate-later".`,
        );
        return null;
      }
      const named = new Set(
        namer({
          step: step.item,
          index: step.index,
          previousIndex,
          steps: steps.map(s => s.item),
          lifecycles: steps.map(s => s.lifecycle),
        }),
      );
      // Ids that are not visible steps are dropped rather than passed through:
      // a host applying the event indexes by id, and an id it cannot find is a
      // silent no-op it has no way to notice.
      targets = steps.filter(s => named.has(s.item.id));
    }

    if (!targets.length) return null;

    return {
      step: step.item,
      index: step.index,
      previousIndex,
      transition: 'reset',
      steps: targets.map(s => s.item),
      stepIds: targets.map(s => s.item.id),
    };
  }

  // ── Leaving a step with unsaved work (NV-05-I8) ──────────────────────────────

  /**
   * The shared controlled-close policy, ADOPTED not re-implemented —
   * `createCloseGuard`, `X-11`, `docs/close-policy-adr.md`.
   *
   * ★★★ THE ORDER OF THE QUESTIONS IS THE PART THAT IS EASY TO GET WRONG, and
   *     it is decided in `core`: the host's veto first (silent, its own
   *     messaging), the unsaved prompt second, and a `programmatic` leave never
   *     prompted. Modal, Drawer and Confirm Dialog answer those three
   *     identically, and now so does this.
   *
   * ★ `alwaysAllow` is left at the primitive's default (`['programmatic']`).
   *   The stepper never calls `request()` with `route` or `history` — see
   *   `applyFromUrl` — so listing them here would be dead configuration that
   *   read like a policy.
   */
  private readonly leaveGuard = createCloseGuard({
    dirty: () => this.dirty(),
    guard: () => {
      const guard = this.canLeaveStep();
      if (!guard) return null;
      return (reason: SvCloseReason) => guard(CLOSE_TO_LEAVE[reason] ?? 'programmatic');
    },
  });

  /** True while the unsaved-changes prompt is up. */
  readonly promptingDiscard = this.leaveGuard.prompting;

  /** What the user tried to do, while the prompt is up. */
  readonly promptedReason = computed<StepperLeaveReason | null>(() => {
    const reason = this.leaveGuard.pendingReason();
    return reason === null ? null : (CLOSE_TO_LEAVE[reason] ?? 'programmatic');
  });

  /** The step the prompt is standing in the way of. */
  private pendingLeave: NormalizedStep | null = null;

  /** What held focus when the prompt went up — where Keep editing / Discard send it back. */
  private focusBeforePrompt: HTMLElement | null = null;

  /** Per-instance ids so two steppers on one page do not share a prompt label. */
  readonly unsavedTitleId = `stepper-unsaved-title-${this._uid}`;
  readonly unsavedMessageId = `stepper-unsaved-message-${this._uid}`;

  /**
   * May the user leave the step they are on? `false` means either the host
   * vetoed it or the prompt is now up.
   */

  // ── The shared navigation stream (`X-15`) ──────────────────────────────────

  /**
   * ⚠️ Consent and identifier-stripping live in the recorder, not here. A
   *    component that checked consent itself would be a component that could
   *    forget to — see `nav-telemetry.ts`.
   */
  private readonly nav = svNavRecorder('stepper', () => this.surfaceId());

  /** One move, in the cross-family vocabulary. */
  private recordNav(intent: SvNavIntent, step: NormalizedStep, reason?: string): void {
    this.nav.record({
      intent,
      key: step.item.id,
      label: step.item.label,
      index: step.index,
      reason: reason ?? null,
    });
  }

  /**
   * Which of the three forward-ish intents a committed move was.
   *
   * ★ `advance`/`retreat` are reserved for a move of exactly one, because that
   *   is the distinction worth having: "people are working through the wizard"
   *   versus "people are jumping around in it" is a real difference in how a
   *   flow is being used, and a rule that called any forward move `advance`
   *   would erase it.
   */
  private moveIntent(previous: number, next: number): SvNavIntent {
    if (next === previous + 1) return 'advance';
    if (next === previous - 1) return 'retreat';
    return 'jump';
  }

  private requestLeave(step: NormalizedStep, reason: StepperLeaveReason): boolean {
    // ★ Nothing configured, nothing to ask — and NOTHING TOUCHED. Without this
    //   the guard's `pending` signal is written on every ordinary step click in
    //   every stepper in the kit, which is a behaviour change dressed as a
    //   no-op.
    if (!this.dirty() && !this.canLeaveStep()) return true;

    // ★★ A PROMPT ALREADY UP OWNS THE QUESTION, TARGET INCLUDED.
    //    `createCloseGuard.request` is already idempotent — it refuses and
    //    leaves `pendingReason` alone — but the step being asked about lives
    //    here, and it was written BEFORE the request. So a second click while
    //    the prompt was up re-pointed it: the user was asked "leave step 1?",
    //    pressed Discard, and landed on step 2. The primitive's idempotence has
    //    to extend to the component's own half of the pending state.
    if (this.leaveGuard.prompting()) return false;

    if (this.leaveGuard.request(LEAVE_TO_CLOSE[reason])) return true;

    // A host veto is SILENT — the ADR's rule, not a shortcut. It refused for
    // its own reasons and owns its own messaging; reporting it as unsaved
    // changes would tell the user their work is at risk when the real reason
    // was a request in flight. Nothing is left pending either way.
    if (!this.leaveGuard.prompting()) return false;

    this.pendingLeave = step;
    // ★ A prompt is a refusal the user can overturn, so it is `blocked` with a
    //   reason rather than an intent of its own. A Discard records the move
    //   that follows, which makes "how often is the prompt overruled?" a ratio
    //   of two rows instead of a field nobody sets.
    this.recordNav('blocked', step, 'unsaved');
    this.focusBeforePrompt = this.activeElement();
    this.focusPromptSoon();
    return false;
  }

  /** Prompt button: abandon the unsaved work and complete the move. */
  discardChanges(): void {
    const reason = this.leaveGuard.discard();
    const target = this.pendingLeave;
    this.pendingLeave = null;
    this.restoreFocusAfterPrompt();
    if (reason === null || !target) return;

    // ★ THE REASON THE USER ACTED ON, not `programmatic`. The prompt was an
    //   interruption in the middle of a step click, not a new kind of move.
    const leaveReason = CLOSE_TO_LEAVE[reason] ?? 'programmatic';
    this.discarded.emit(leaveReason);
    // Re-enter unguarded: `asyncValidation`, the branch switch and the
    // transition report all still have to run, and duplicating them here is how
    // the two paths drift apart.
    this.activate(target, leaveReason, false);
  }

  /** Prompt button: stay on the step. Nothing moves. */
  keepEditing(): void {
    const reason = this.promptedReason();
    this.leaveGuard.keep();
    this.pendingLeave = null;
    this.restoreFocusAfterPrompt();
    if (reason) this.leaveCancelled.emit(reason);
  }

  /**
   * ★ `NV-05-I8`, the a11y half. Both prompt buttons UNMOUNT the alertdialog
   *   that holds focus, and a focused element leaving the document sends focus
   *   to `<body>`. So focus goes back to what held it before the prompt (the
   *   step the user pressed), else the current step's button, else the host.
   *   After the render: for Discard the move may change which buttons exist.
   */
  private restoreFocusAfterPrompt(): void {
    const before = this.focusBeforePrompt;
    this.focusBeforePrompt = null;
    this.afterRender(() => this.recoverFocus(before));
  }

  /**
   * Focus the prompt's SAFE choice.
   *
   * ★ Keep editing, not Discard: "the prompt appeared, press Enter" must not
   *   throw the user's work away. Same rule as the Modal's and the confirm
   *   dialog's, and the reason the button order in the template puts Keep
   *   editing first.
   */
  private focusPromptSoon(): void {
    this.afterRender(() => {
      (this._host.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('[data-sv-keep-editing]')
        ?.focus();
    });
  }

  /**
   * A task after the current render. A task rather than `afterNextRender`
   * because the render that matters may be the HOST's (a new `items` array),
   * which nothing here can wait on — the same call `sv-tabs` makes on close.
   * Tracked, so destroy cancels it.
   */
  private afterRender(task: () => void): void {
    if (typeof setTimeout !== 'function') return;
    const id = setTimeout(() => {
      this.focusTasks.delete(id);
      task();
    });
    this.focusTasks.add(id);
  }

  /** `document.activeElement`, when it is inside this stepper. */
  private activeElement(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const active = document.activeElement;
    const root = this._host.nativeElement as HTMLElement;
    return active instanceof HTMLElement && active !== root && root.contains(active) ? active : null;
  }

  /** The id of the step whose button holds focus, or `null`. */
  private focusedStepId(): string | null {
    const prefix = `stepper-item-${this._uid}-`;
    const id = this.activeElement()?.id ?? '';
    return id.startsWith(prefix) ? id.slice(prefix.length) : null;
  }

  /**
   * Put focus back after something holding it unmounted: `preferred` if it is
   * still here, else the active step's button, else the host — never `<body>`.
   *
   * ★ Only when focus actually FELL OUT. If it is somewhere real by the time
   *   this runs — the host moved it, the user clicked elsewhere — that was a
   *   choice, and overriding it would be a focus theft.
   */
  private recoverFocus(preferred: HTMLElement | null): void {
    if (typeof document === 'undefined') return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const current = this.visibleItems()[this.clampedActiveIndex()];
    const root = this._host.nativeElement as HTMLElement;
    svRecoverFocus({
      to: [preferred, current ? this.stepButton(current.id) : null],
      fallback: root,
    });
  }

  /** A step's button, scoped to this instance. `svAttrSelector`: ids are host data. */
  private stepButton(id: string): HTMLElement | null {
    return (this._host.nativeElement as HTMLElement)
      .querySelector<HTMLElement>(svAttrSelector('id', `stepper-item-${this._uid}-${id}`));
  }

  /** Whether this step is waiting on server validation. */
  isValidating(index: number): boolean {
    return this.validatingIndex() === index;
  }

  onStepKeydown(event: KeyboardEvent, step: NormalizedStep): void {
    if (!this.enableHotkeys()) return;

    const list = this.normalizedSteps();
    if (!list.length) return;

    const key = event.key;

    if (/^[1-9]$/.test(key)) {
      const target = Number(key) - 1;
      if (target < list.length) {
        event.preventDefault();
        this.onSelect(list[target]);
        this.focusStep(list[target].item.id);
      }
      return;
    }

    const isVertical = this.orientation() === 'vertical';
    let target: NormalizedStep | undefined;

    if ((isVertical && key === 'ArrowDown') || (!isVertical && key === 'ArrowRight')) {
      target = list[Math.min(list.length - 1, step.index + 1)];
    }

    if ((isVertical && key === 'ArrowUp') || (!isVertical && key === 'ArrowLeft')) {
      target = list[Math.max(0, step.index - 1)];
    }

    if (key === 'Home') target = list[0];
    if (key === 'End') target = list[list.length - 1];

    if (target) {
      event.preventDefault();
      this.onSelect(target);
      this.focusStep(target.item.id);
    }
  }

  // ── Class helpers ─────────────────────────────────────────────────────────

  indicatorClass(step: NormalizedStep): string {
    const size = this.indicatorSizeClass();
    const variant = this.variant();

    const base = [
      'inline-flex shrink-0 items-center justify-center font-semibold transition-colors duration-200',
      size,
      this.shapeClass(variant),
    ];

    // ★ These four fills are what the missing ramp steps were hiding. A mid-500
    //   fill carries white text at 2.15:1 (warning) to 3.76:1 (danger), and the
    //   `dark:` rows repainted the same step for no benefit. `warning` keeps its
    //   yellow and takes near-black text, because white needs warning-700 and
    //   warning-700 is not yellow any more.
    switch (step.state) {
      case 'complete':
        base.push('bg-accent-700 text-white');
        break;
      case 'current':
        base.push('bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/50');
        break;
      case 'error':
        base.push('bg-danger-600 text-white');
        break;
      case 'warning':
        base.push('bg-warning-500 text-gray-900');
        break;
      // ★ A skipped step is PASSED, not pending and not done. Filled enough to
      //   read as behind the user, neutral enough not to claim the work.
      case 'skipped':
        base.push('bg-gray-200 text-gray-600 ring-1 ring-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-500');
        break;
      case 'disabled':
        base.push('bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400');
        break;
      default:
        base.push('bg-white text-gray-500 ring-1 ring-gray-300 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700');
        break;
    }

    if (variant === 'minimal') {
      base.push('ring-0');
      if (step.state === 'current') {
        base.push('bg-primary-500');
      }
    }

    return base.join(' ');
  }

  connectorClass(step: NormalizedStep): string {
    if (step.state === 'complete') return 'bg-accent-400 dark:bg-accent-500';
    if (step.state === 'error') return 'bg-danger-300 dark:bg-danger-500/70';
    if (step.state === 'warning') return 'bg-warning-300 dark:bg-warning-500/70';
    // ★ The rail past a skipped step is TRAVERSED — the flow went through it.
    //   Leaving it at the pending grey drew a broken track behind the user.
    if (step.state === 'skipped') return 'bg-gray-400 dark:bg-gray-500';
    return 'bg-gray-200 dark:bg-gray-700';
  }

  /** Connector thickness — `line` renders a bold, continuous progress bar; every other variant uses a thin hairline. */
  connectorSizeClass(): string {
    return this.variant() === 'line' ? 'h-1' : 'h-px';
  }

  verticalRowPaddingClass(): string {
    if (this.size() === 'sm') return 'pl-11';
    if (this.size() === 'lg') return 'pl-16';
    return 'pl-14';
  }

  verticalConnectorLayoutClass(): string {
    const width = this.variant() === 'line' ? 'w-1' : 'w-0.5';
    if (this.size() === 'sm') return `left-[13px] top-7 h-[calc(100%-1rem)] ${width}`;
    if (this.size() === 'lg') return `left-[19px] top-10 h-[calc(100%-1.35rem)] ${width}`;
    return `left-[15px] top-8 h-[calc(100%-1.15rem)] ${width}`;
  }

  /**
   * Accessible name for a step button — only for the `dot` variant.
   *
   * ★★ THE `dot` VARIANT RENDERS NO TEXT WHATSOEVER. Its indicator span is
   *    `aria-hidden` (it is a decorative dot) and the whole label block is
   *    skipped, so every step button shipped with no accessible name at all: a
   *    screen reader read out N identical, unlabelled buttons and `aria-current`
   *    was the only thing distinguishing them.
   *
   *    The other variants render the label as real text, which is a better name
   *    than anything set here — naming those too would risk an accessible name
   *    that disagrees with what is on screen, so this fills the gap rather than
   *    papering over all of them.
   */
  stepAriaLabel(step: NormalizedStep): string | null {
    if (this.variant() !== 'dot') return null;
    return step.item.optional ? `${step.item.label} (optional)` : step.item.label;
  }

  labelClass(step: NormalizedStep): string {
    const base = [this.labelSizeClass(), 'font-medium tracking-tight'];

    switch (step.state) {
      case 'current':
        base.push('text-gray-900 dark:text-white');
        break;
      case 'complete':
        base.push('text-accent-700 dark:text-accent-400');
        break;
      case 'error':
        base.push('text-danger-700 dark:text-danger-400');
        break;
      case 'warning':
        base.push('text-warning-700 dark:text-warning-400');
        break;
      case 'skipped':
        base.push('text-gray-500 line-through dark:text-gray-400');
        break;
      case 'disabled':
        base.push('text-gray-500 dark:text-gray-400');
        break;
      default:
        base.push('text-gray-600 dark:text-gray-300');
        break;
    }

    return base.join(' ');
  }

  descriptionClass(step: NormalizedStep): string {
    const base = [this.descriptionSizeClass(), 'mt-1 leading-relaxed'];

    if (step.state === 'disabled') {
      base.push('text-gray-500 dark:text-gray-400');
    } else {
      base.push('text-gray-500 dark:text-gray-400');
    }

    return base.join(' ');
  }

  private shapeClass(variant: StepperVariant): string {
    switch (variant) {
      case 'pill':
        return 'rounded-xl px-2.5';
      case 'dot':
      case 'minimal':
        return 'rounded-full';
      default:
        return 'rounded-full';
    }
  }

  private indicatorSizeClass(): string {
    const size = this.size();
    const variant = this.variant();

    if (variant === 'dot' || variant === 'minimal') {
      return size === 'sm' ? 'h-2.5 w-2.5' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';
    }

    if (variant === 'pill') {
      return size === 'sm' ? 'h-7 min-w-7 text-xs' : size === 'lg' ? 'h-10 min-w-10 text-base' : 'h-8 min-w-8 text-sm';
    }

    return size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-10 w-10 text-base' : 'h-8 w-8 text-sm';
  }

  private labelSizeClass(): string {
    return this.size() === 'sm' ? 'text-xs' : this.size() === 'lg' ? 'text-base' : 'text-sm';
  }

  private descriptionSizeClass(): string {
    return this.size() === 'sm' ? 'text-[11px]' : 'text-xs';
  }

  // ── Icon/text helpers ─────────────────────────────────────────────────────

  shouldShowText(_step: NormalizedStep): boolean {
    return !(this.variant() === 'dot' || this.variant() === 'minimal');
  }

  shouldShowIcon(step: NormalizedStep): boolean {
    if (
      step.state === 'complete' ||
      step.state === 'error' ||
      step.state === 'warning' ||
      step.state === 'skipped'
    ) return true;
    return this.variant() === 'icon' && !!step.item.icon;
  }

  /**
   * Icon-library NAME for a step: the state glyph, else the host's own.
   *
   * ★ The Pro twin already had a half-migrated `stepIconName` alongside a raw
   * `icon()` path method; this twin had only the path one. Both now have this
   * single method, so the two cannot drift.
   */
  stepIconName(step: NormalizedStep): string {
    if (step.state === 'complete') return 'check';
    if (step.state === 'error' || step.state === 'warning') return 'alert-triangle';
    // ★ `minus`, not `check` and not the step number. A tick claims work that
    //   was never done; the number reads as still-to-do.
    if (step.state === 'skipped') return 'minus';
    return step.item.icon ?? '';
  }


  indicatorText(step: NormalizedStep): string {
    return String(step.index + 1);
  }

  shouldShowBadge(step: NormalizedStep): boolean {
    return !!step.item.badge || !!step.item.selectsBranch;
  }

  badgeText(step: NormalizedStep): string {
    return step.item.badge ?? step.item.selectsBranch ?? '';
  }

  branchShiftClass(): string {
    return this.branchShift() ? 'stp-branch-shift' : '';
  }

  private triggerBranchShift(): void {
    this.branchShift.set(false);
    queueMicrotask(() => {
      this.branchShift.set(true);
      setTimeout(() => this.branchShift.set(false), 280);
    });
  }

  private focusStep(id: string): void {
    this.stepButton(id)?.focus();
  }
}
