import {
  svPersistState,
  svRestoreState,
  type SvPersistedState,
  type SvRestoreSpec,
} from '@styloviz/core';

/** Who owns a `persistKey` blob. Namespaced by selector. */
export const SV_STEPPER_RESUME_KIND = 'sv-stepper/resume';
/** Schema version of {@link SvStepperResume} — the ENVELOPE, not the workflow. */
export const SV_STEPPER_RESUME_VERSION = 1;

/**
 * Where a wizard left off (`NV-05-I7`, `NV-05-M3`).
 *
 * The source backlog calls a five-step wizard that loses everything on reload
 * *"the most damaging failure in this document"*, and it was the default.
 *
 * ★★★ `stepId`, NEVER `stepIndex`, for the same reason `sv-product-tour` gives:
 *     a saved index is wrong the moment the workflow's steps change. Insert a
 *     step and every index after it shifts, so a returning user resumes on a
 *     step that asks for something else with total confidence. An id survives an
 *     edit — and an id that has **disappeared** is detectable, which is what lets
 *     resuming degrade to starting over instead of guessing.
 *
 * ★★ `branch` is here because it is the other half of "where you were". A
 *    branching workflow resumed on the right step of the wrong branch is a
 *    worse outcome than not resuming: the step renders, the labels look
 *    plausible, and the path the user chose has been silently discarded.
 *
 * ── What this deliberately does NOT hold ────────────────────────────────────
 * **The form data.** A stepper knows which step you are on; it has never seen
 * what you typed, which lives in the host's forms. Storing a position is a
 * different mechanism from storing a payload, with a different failure mode and
 * a different privacy story — a component that quietly copied a host's form
 * values into `localStorage` would be writing personal data to disk on the
 * host's behalf without being asked. `X-9` states the split: **the step survives
 * a refresh and the data does not.**
 */
export interface SvStepperResume {
  /** The step the user was on, by id. */
  readonly stepId: string;
  /** The active branch, or `null` for a workflow with no branching. */
  readonly branch: string | null;
}

function readResume(state: unknown): SvStepperResume | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const record = state as Record<string, unknown>;
  const stepId = record['stepId'];
  const branch = record['branch'];

  // ★ Every member checked, and one wrong member refuses the WHOLE blob rather
  //   than being dropped. What comes out of `localStorage` is whatever anyone
  //   with devtools decided to put there, and restoring the half that parses is
  //   how a user lands on step 4 of a branch they never chose.
  if (typeof stepId !== 'string' || stepId === '') return null;
  if (branch !== null && typeof branch !== 'string') return null;

  return { stepId, branch };
}

const RESUME_SCHEMA: SvRestoreSpec<SvStepperResume> = {
  kind: SV_STEPPER_RESUME_KIND,
  version: SV_STEPPER_RESUME_VERSION,
  read: readResume,
  // ★ No `adoptLegacy`. A stepper has never persisted anything, so there is
  //   nothing in the wild to adopt — and an `adoptLegacy` that accepts any
  //   object makes the `malformed` refusal unreachable.
};

/** Wrap a stepper's position for storage under `persistKey`. */
export function svSerializeStepperResume(
  resume: SvStepperResume,
): SvPersistedState<SvStepperResume> {
  return svPersistState(SV_STEPPER_RESUME_KIND, SV_STEPPER_RESUME_VERSION, resume);
}

/** Read a `persistKey` blob back, or say precisely why it cannot be. */
export function svRestoreStepperResume(blob: unknown) {
  return svRestoreState(blob, RESUME_SCHEMA);
}
