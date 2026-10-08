import type { StepperStepStatus } from './stepper.component';

/**
 * ============================================================================
 *  The step LIFECYCLE, and the named transitions between its states
 * ============================================================================
 *
 * `NV-05-M1`. The stepper already had `StepperStepStatus` and it was never a
 * lifecycle — it is a **presentation** vocabulary. `warning` and `disabled` are
 * things a step LOOKS LIKE; `skipped` is something a step IS, and it was
 * missing entirely. The two axes had been collapsed into one union, which is
 * why no transition could be named: half the members are not states anything
 * transitions into.
 *
 * ★★★ THE TWO AXES, AND WHICH ONE OWNS WHICH QUESTION.
 *
 *   | Question                            | Axis          |
 *   |-------------------------------------|---------------|
 *   | Has the user finished with this step?| **lifecycle** |
 *   | May a linear gate open past it?     | **lifecycle** |
 *   | What colour is the indicator?       | presentation  |
 *   | Is it clickable?                    | presentation  |
 *
 * Presentation is DERIVED from lifecycle (plus `valid`) by
 * {@link svStepperPresentation}, unless the host pins it with
 * `StepperItem.status` — which still wins, verbatim, exactly as it did before
 * this file existed. Nothing was deleted and nothing was renamed.
 *
 * ★★ `valid` IS NOT A LIFECYCLE STATE, AND THAT IS `NV-05-I11`. A step can be
 *    complete with invalid data (the user filled it in, the server disagreed)
 *    or valid but unsaved. Folding validity into the lifecycle would make those
 *    unsayable, which is precisely the conflation the item names. It is a
 *    second, independent fact, and it only reaches the LOOK of a step, never
 *    its position in the machine.
 */

// ─── The lifecycle ───────────────────────────────────────────────────────────

/**
 * Where a step is in its own life.
 *
 * - `pending` — not reached, or reset back to un-started.
 * - `active` — the step the user is on.
 * - `complete` — finished. Says nothing about whether its data is *valid*; see
 *   `StepperItem.valid`.
 * - `skipped` — passed over without being done. The state the old union had no
 *   word for, and the one an optional step in a wizard ends in.
 * - `error` — attempted and failed.
 */
export type StepperStepLifecycle =
  | 'pending'
  | 'active'
  | 'complete'
  | 'skipped'
  | 'error';

/**
 * The transitions, by name. There are six, and nothing else is legal.
 *
 * ★ `enter` and `reopen` are separate names for the same destination because
 *   they are different events to a host: entering a step for the first time and
 *   RETURNING to one the user already finished are the two halves of
 *   `NV-05-I2`, and a host that invalidates later work on a revisit needs to be
 *   able to tell them apart.
 */
export type StepperTransition =
  | 'enter'
  | 'complete'
  | 'skip'
  | 'fail'
  | 'reopen'
  | 'reset';

export interface StepperTransitionRule {
  /** The lifecycle states this transition may be taken from. */
  readonly from: readonly StepperStepLifecycle[];
  /** The lifecycle state it lands in. */
  readonly to: StepperStepLifecycle;
}

/**
 * The whole machine, as data.
 *
 * ```
 *   pending ──enter──▶ active ──complete──▶ complete ─┐
 *      │                 │  ├──fail─────▶ error ──────┤──reopen──▶ active
 *      └──skip───────────┴──┴──skip─────▶ skipped ────┘
 *
 *   complete | skipped | error | active ──reset──▶ pending
 * ```
 *
 * ★ A table rather than a `switch`, so the legal set is one thing a test can
 *   enumerate and a consumer can read. `svStepperTransitionFor` depends on it
 *   being unambiguous — no two rules share a `to` and an overlapping `from` —
 *   and `stepper.machine.spec.ts` asserts that property rather than trusting it.
 */
export const SV_STEPPER_TRANSITIONS: Readonly<Record<StepperTransition, StepperTransitionRule>> = {
  enter: { from: ['pending'], to: 'active' },
  complete: { from: ['active'], to: 'complete' },
  skip: { from: ['pending', 'active'], to: 'skipped' },
  fail: { from: ['active'], to: 'error' },
  reopen: { from: ['complete', 'skipped', 'error'], to: 'active' },
  reset: { from: ['active', 'complete', 'skipped', 'error'], to: 'pending' },
};

/** Every lifecycle state, in machine order — for exhaustive iteration. */
export const SV_STEPPER_LIFECYCLES: readonly StepperStepLifecycle[] = [
  'pending',
  'active',
  'complete',
  'skipped',
  'error',
];

/** May `transition` be taken from `from`? */
export function svStepperCanTransition(
  from: StepperStepLifecycle,
  transition: StepperTransition,
): boolean {
  return SV_STEPPER_TRANSITIONS[transition].from.includes(from);
}

/**
 * Take a named transition. Returns the resulting lifecycle state, or `null` if
 * the transition is not legal from `from`.
 *
 * ★ `null`, not a throw. This is called from a host reducing its own step list
 *   and from analytics code reading events back; an illegal transition is a
 *   fact to handle, not a crash.
 */
export function svStepperTransition(
  from: StepperStepLifecycle,
  transition: StepperTransition,
): StepperStepLifecycle | null {
  return svStepperCanTransition(from, transition) ? SV_STEPPER_TRANSITIONS[transition].to : null;
}

/**
 * Which transition names the move from `from` to `to`, or `null` if no
 * transition does.
 *
 * A state to itself is `null`: staying put is not a transition, and reporting
 * one would tell a host's reducer to re-run side effects on every render.
 */
export function svStepperTransitionFor(
  from: StepperStepLifecycle,
  to: StepperStepLifecycle,
): StepperTransition | null {
  if (from === to) return null;
  for (const name of Object.keys(SV_STEPPER_TRANSITIONS) as StepperTransition[]) {
    const rule = SV_STEPPER_TRANSITIONS[name];
    if (rule.to === to && rule.from.includes(from)) return name;
  }
  return null;
}

// ─── Lifecycle ⇄ presentation ────────────────────────────────────────────────

/**
 * Lifecycle (+ validity) → what the step LOOKS LIKE.
 *
 * ★★ `complete` WITH `valid: false` IS `warning`, NOT `error`. `error` means
 *    the step itself failed; a complete step whose data no longer validates is
 *    a step the user needs to go back to, and the kit already had a colour for
 *    exactly that. This is the only place the two axes meet, and it is one
 *    function so the meeting is reviewable.
 *
 * ★ An `active` step with `valid: false` still looks `current`. Shouting at
 *   somebody who is mid-way through typing into a form is the single most
 *   common validation-UX mistake, and a stepper that did it by default would
 *   make `valid` unusable while a step is open.
 *
 * ★ `skipped` is its own presentation member, added to `StepperStepStatus`
 *   alongside the existing six. Rendering it as `pending` would invite the user
 *   back into a step the flow has deliberately passed, and rendering it as
 *   `complete` claims work that was never done.
 */
export function svStepperPresentation(
  lifecycle: StepperStepLifecycle,
  valid?: boolean,
): StepperStepStatus {
  switch (lifecycle) {
    case 'active':
      return 'current';
    case 'complete':
      return valid === false ? 'warning' : 'complete';
    case 'skipped':
      return 'skipped';
    case 'error':
      return 'error';
    default:
      return 'pending';
  }
}

/**
 * What LIFECYCLE a host's pinned presentation status implies.
 *
 * ★★★ THIS MAP EXISTS SO THE LINEAR GATE DID NOT CHANGE MEANING. Gating used
 *     to ask `state !== 'complete'` of the presentation status; it now asks the
 *     lifecycle, and every one of the six pre-existing members had to map to a
 *     lifecycle that gives the identical answer. `warning` → `error` rather
 *     than `complete` for that reason: a host that marks a step `warning` gets
 *     it gated today and must keep getting it gated, however tempting
 *     "warning means done, with reservations" reads.
 *
 * `disabled` → `pending`, because *disabled* is an interaction fact, not a
 * position in the machine. The gate still reads `disabled` off the
 * presentation status, which is where it belongs.
 */
export function svStepperLifecycleOf(status: StepperStepStatus): StepperStepLifecycle {
  switch (status) {
    case 'current':
      return 'active';
    case 'complete':
      return 'complete';
    case 'skipped':
      return 'skipped';
    case 'error':
    case 'warning':
      return 'error';
    default:
      return 'pending';
  }
}

/**
 * Does this lifecycle state count as "the flow may move past it"?
 *
 * `complete` and `skipped`, and nothing else. Skipping is a legitimate exit
 * from a step — an optional address-override the user declined is not an
 * unfinished step — and the old union's inability to say so is why a wizard
 * with optional steps could not use `linear` at all.
 */
export function svStepperIsSettled(lifecycle: StepperStepLifecycle): boolean {
  return lifecycle === 'complete' || lifecycle === 'skipped';
}
