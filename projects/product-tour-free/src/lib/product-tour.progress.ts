import {
  svPersistState,
  svRestoreState,
  type SvPersistedState,
  type SvRestoreSpec,
} from '@styloviz/core';

/** Who owns a `persistKey` blob. Namespaced by selector. */
export const SV_TOUR_PROGRESS_KIND = 'sv-product-tour/progress';
/** Schema version of {@link SvTourProgress} — the ENVELOPE, not the tour. */
export const SV_TOUR_PROGRESS_VERSION = 1;

/** How a tour ended, or that it did not. */
export type SvTourStatus = 'active' | 'completed' | 'dismissed';

/**
 * What a tour stores between visits (`X-12`, `OF-13-I6`, `OF-13-M4`).
 *
 * ★★★ `stepId`, NEVER `stepIndex`. A saved index is wrong the moment the tour's
 *     steps change: insert one step and every index after it shifts, so a
 *     returning user resumes on a step that talks about something else with
 *     total confidence. An id survives an edit — and an id that has
 *     DISAPPEARED is detectable, which is what lets resuming degrade to
 *     restarting instead of guessing.
 *
 * ★★ `status` IS THE HALF THE AUDIT SAID WAS MISSING: dismissal and completion
 *    were not recorded at all, so "don't show this again" had nothing to read.
 *    They are different facts — a user who skipped a tour may want it back, a
 *    user who finished it does not — so they are two values, not one boolean.
 */
export interface SvTourProgress {
  /** Which tour definition this belongs to. */
  readonly tourId: string;
  /** Which VERSION of that definition. Progress from another is not adoptable. */
  readonly tourVersion: number;
  /** The step the user was on, by id. `null` before the first step is shown. */
  readonly stepId: string | null;
  /** Checklist ticks, by step id. */
  readonly completedIds: readonly string[];
  /** How it ended, or `'active'`. */
  readonly status: SvTourStatus;
}

/** Why a restored progress did not put the user back where they were. */
export type SvTourResumeReason =
  /** Resumed on the stored step. */
  | 'resumed'
  /** `resume="restart"` — the host asked for the first step every time. */
  | 'policy'
  /** The stored step id is not in `steps` any more. */
  | 'step-missing'
  /** `tourVersion` has moved on: the stored position means nothing now. */
  | 'version-changed'
  /** `resume="never"` — do not restore a position at all. */
  | 'declined';

/** What the tour did with the progress it found. */
export interface SvTourProgressRestored {
  /** The progress as stored. */
  readonly progress: SvTourProgress;
  /** The step index the tour settled on. */
  readonly index: number;
  /** Why that index, and not the stored one. */
  readonly reason: SvTourResumeReason;
}

/** A tour whose steps were authored against a different version than the app. */
export interface SvTourSchemaStale {
  /** The version the steps declare. */
  readonly tourVersion: number;
  /** The version the host says the UI is at. */
  readonly expectedVersion: number;
}

function readProgress(state: unknown): SvTourProgress | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const record = state as Record<string, unknown>;
  const tourId = record['tourId'];
  const tourVersion = record['tourVersion'];
  const stepId = record['stepId'];
  const completedIds = record['completedIds'];
  const status = record['status'];
  // ★ Every member checked, and one wrong member refuses the WHOLE blob rather
  //   than being dropped. What comes back out of `localStorage` is whatever
  //   anyone with devtools decided to put there, and restoring the half that
  //   parses puts a user somewhere they never were: step 4 of a tour whose
  //   ticks were silently discarded.
  if (typeof tourId !== 'string' || tourId === '') return null;
  if (typeof tourVersion !== 'number' || !Number.isFinite(tourVersion)) return null;
  if (stepId !== null && typeof stepId !== 'string') return null;
  if (!Array.isArray(completedIds) || completedIds.some((id) => typeof id !== 'string')) {
    return null;
  }
  if (status !== 'active' && status !== 'completed' && status !== 'dismissed') return null;
  return {
    tourId,
    tourVersion,
    stepId,
    completedIds: completedIds as readonly string[],
    status,
  };
}

const PROGRESS_SCHEMA: SvRestoreSpec<SvTourProgress> = {
  kind: SV_TOUR_PROGRESS_KIND,
  version: SV_TOUR_PROGRESS_VERSION,
  read: readProgress,
  // ★ No `adoptLegacy`. The other families had bare blobs in browsers before
  //   the envelope existed; a tour never persisted anything at all, so there
  //   is nothing in the wild to adopt — and an `adoptLegacy` that accepts any
  //   object makes `malformed` unreachable.
};

/** Wrap a tour's progress for storage under `persistKey`. */
export function svSerializeTourProgress(
  progress: SvTourProgress,
): SvPersistedState<SvTourProgress> {
  return svPersistState(SV_TOUR_PROGRESS_KIND, SV_TOUR_PROGRESS_VERSION, progress);
}

/** Read a `persistKey` blob back, or say why it cannot be. */
export function svRestoreTourProgress(blob: unknown) {
  return svRestoreState(blob, PROGRESS_SCHEMA);
}
