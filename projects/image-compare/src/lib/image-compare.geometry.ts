/**
 * `sv-image-compare` — a before/after wipe that admits when it is not one.
 *
 * ★★★ TWO IMAGES OF DIFFERENT ASPECT RATIOS CANNOT BE COMPARED BY WIPING
 * BETWEEN THEM.
 *
 * The control stacks them and reveals one through a moving edge, which only
 * means anything if a given pixel shows the same subject in both. Feed it a
 * 4:3 "before" and a 16:9 "after" and one of them is scaled or cropped to fit —
 * so part of what the reader is shown as "the change" is the reframing, and the
 * conclusion they draw is about the crop. The failure is invisible: the widget
 * looks exactly right, and the difference it shows is real, and it is the wrong
 * difference.
 */

/**
 * Aspect ratios differing by more than this are not comparable by wiping.
 *
 * ★★ 1% rather than 0, because two exports of the same source routinely differ
 * by a pixel — 1920×1080 against 1920×1081 is the same picture, and refusing it
 * would train people to ignore the warning.
 */
export const SV_ASPECT_TOLERANCE = 0.01;

export interface SvAspect {
  readonly before: number;
  readonly after: number;
  /** Relative difference, 0 when identical. */
  readonly difference: number;
  /** True when the two cannot honestly be wiped between. */
  readonly mismatched: boolean;
  /** False when either image has not reported its size yet. */
  readonly known: boolean;
}

/** Do these two images describe the same frame? */
export function svAspect(
  beforeWidth: number,
  beforeHeight: number,
  afterWidth: number,
  afterHeight: number,
): SvAspect {
  const ok = (n: number): boolean => Number.isFinite(n) && n > 0;
  // ★ INVARIANT: `known: false` always comes with `mismatched: false`. Nothing
  //   may be claimed about a pair that has not been measured, and `svAspectLabel`
  //   relies on this rather than re-checking `known` itself.
  if (!ok(beforeWidth) || !ok(beforeHeight) || !ok(afterWidth) || !ok(afterHeight)) {
    return { before: 0, after: 0, difference: 0, mismatched: false, known: false };
  }
  const before = beforeWidth / beforeHeight;
  const after = afterWidth / afterHeight;
  // ★★ RELATIVE, NOT ABSOLUTE. An absolute threshold treats a 0.05 difference
  //    between 0.5 and 0.55 (a 10% reframing) as the same as between 3.0 and
  //    3.05 (under 2%), and the first of those is the one that matters.
  const difference = Math.abs(before - after) / Math.max(before, after);
  // ★ A HAIR OF SLACK ON THE COMPARISON ITSELF. Two ratios exactly one tolerance
  //   apart compute to 0.010000000000000009 in binary floating point, so a bare
  //   `>` flips the verdict on numbers a reader would call identical to the
  //   threshold — and the warning it produces cannot be acted on.
  return {
    before,
    after,
    difference,
    mismatched: difference > SV_ASPECT_TOLERANCE + 1e-9,
    known: true,
  };
}

export function svAspectLabel(aspect: SvAspect): string {
  // ★★ NO `known` CHECK HERE, DELIBERATELY. It used to be the first line, and a
  //    mutation that removed it changed nothing — because `svAspect` returns
  //    `mismatched: false` in the same branch that returns `known: false`, so an
  //    unmeasured pair already falls out of the line below. The guard could not
  //    affect any result the module can produce; it was the appearance of care,
  //    and the invariant it was standing in for is stated where it lives.
  if (!aspect.mismatched) return '';
  return `These two images are different shapes (${aspect.before.toFixed(2)}:1 against ${aspect.after.toFixed(2)}:1), so one of them is being cropped or stretched to fit. Part of what the wipe shows is the reframing, not the change.`;
}

/**
 * What kind of mismatch this is — because the fix is different for each.
 *
 * ★★★ "DIFFERENT SHAPES" IS A SYMPTOM, NOT A DIAGNOSIS. A pair whose ratios are
 * RECIPROCAL (4000×3000 against 3000×4000) is not a reframing at all: it is one
 * file carrying an EXIF orientation tag the other does not, and the answer is to
 * re-export, not to re-crop. Telling that user their images are "different
 * shapes" sends them to fix the one thing that is not wrong.
 */
export type SvFrameVerdict =
  /** Not measured yet. */
  | 'unknown'
  /** Same pixel dimensions. Nothing to say. */
  | 'identical'
  /** Same shape, different pixel size — the wipe is valid, one side is softer. */
  | 'scaled'
  /** A quarter turn apart. Almost always EXIF orientation. */
  | 'rotated'
  /** Genuinely different shapes — one is cropped or stretched to fit. */
  | 'reshaped';

export interface SvFrames {
  readonly verdict: SvFrameVerdict;
  readonly aspect: SvAspect;
  /** Non-empty when the reader must be warned before believing the picture. */
  readonly warning: string;
  /** Non-empty when there is something worth saying that is not a warning. */
  readonly note: string;
}

/**
 * Classify a pair of frames.
 *
 * ★★★ AND THE LIMIT, WHICH MATTERS MORE THAN THE CHECK: this compares
 * DIMENSIONS, never content. Two files of identical size can still be different
 * crops of the same scene — a tighter framing, a nudged horizon, a different
 * lens — and no measurement available to a browser can tell. A wipe between
 * those shows a difference that is entirely real and entirely not the change.
 * Which is why `landmarks` exists: the reader verifies the framing by eye
 * against a fixed reference, because the component cannot verify it for them.
 */
export function svFrames(
  beforeWidth: number,
  beforeHeight: number,
  afterWidth: number,
  afterHeight: number,
): SvFrames {
  const aspect = svAspect(beforeWidth, beforeHeight, afterWidth, afterHeight);
  if (!aspect.known) {
    return { verdict: 'unknown', aspect, warning: '', note: '' };
  }

  const size = (w: number, h: number) => `${w}×${h}`;
  const both = `${size(beforeWidth, beforeHeight)} against ${size(afterWidth, afterHeight)}`;

  if (!aspect.mismatched) {
    if (beforeWidth === afterWidth && beforeHeight === afterHeight) {
      return { verdict: 'identical', aspect, warning: '', note: '' };
    }
    return {
      verdict: 'scaled',
      aspect,
      warning: '',
      note:
        `These are the same shape at different sizes (${both}), so the wipe is honest — ` +
        `but the smaller one is being scaled up to fit, and will look softer than it is.`,
    };
  }

  // ★ A SQUARE IS ITS OWN RECIPROCAL, so the rotation test has to exclude one or
  //   every square pair would be reported as a quarter turn out.
  const square = Math.abs(aspect.before - 1) <= SV_ASPECT_TOLERANCE;
  const flipped = 1 / aspect.before;
  const rotated =
    !square &&
    Math.abs(aspect.after - flipped) / Math.max(aspect.after, flipped)
      <= SV_ASPECT_TOLERANCE + 1e-9;

  if (rotated) {
    return {
      verdict: 'rotated',
      aspect,
      warning:
        `One of these is a quarter turn out (${both}). That is almost always an EXIF ` +
        `orientation tag applied to one file and not the other — re-export it rather ` +
        `than re-cropping, because the picture is right and only the rotation is wrong.`,
      note: '',
    };
  }

  return { verdict: 'reshaped', aspect, warning: svAspectLabel(aspect), note: '' };
}

/** Clamp a wipe position into 0–1. */
export function svClampPosition(position: number): number {
  if (!Number.isFinite(position)) return 0.5;
  return Math.max(0, Math.min(1, position));
}

/** Wipe position from a pointer at `clientX` over a box. */
export function svPositionFromPointer(clientX: number, boxLeft: number, boxWidth: number): number {
  // ★★ THE LOAD-BEARING PART OF THIS GUARD IS `< 0`, NOT `=== 0`. A mutation
  //    that removed it entirely survived the zero-width test, because dividing
  //    by zero yields ±Infinity (or NaN) and `svClampPosition` already returns
  //    0.5 for anything non-finite — the zero case is covered twice. A NEGATIVE
  //    width divides cleanly to a mirrored position, which nothing downstream
  //    would notice, so that is the case this line actually decides.
  if (!Number.isFinite(boxWidth) || boxWidth <= 0) return 0.5;
  return svClampPosition((clientX - boxLeft) / boxWidth);
}

/**
 * How far the keyboard moves the wipe.
 *
 * ★★★ THIS CONTROL IS ALMOST NEVER KEYBOARD-OPERABLE, and it is a slider — the
 * one widget with an unambiguous, universally-implemented keyboard contract.
 * Arrows nudge, Page keys jump, Home and End go to the extremes; every
 * screen-reader user and everyone who cannot use a mouse already knows it. A
 * drag-only implementation excludes them from a comparison they can otherwise
 * fully perceive.
 */
export const SV_STEP = 0.01;
export const SV_PAGE_STEP = 0.1;

export function svPositionForKey(key: string, position: number): number | null {
  const at = svClampPosition(position);
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return svClampPosition(at - SV_STEP);
    case 'ArrowRight':
    case 'ArrowUp':
      return svClampPosition(at + SV_STEP);
    case 'PageDown':
      return svClampPosition(at - SV_PAGE_STEP);
    case 'PageUp':
      return svClampPosition(at + SV_PAGE_STEP);
    case 'Home':
      return 0;
    case 'End':
      return 1;
    default:
      // ★★ null, NOT the unchanged position. The caller uses it to decide
      //    whether to call `preventDefault()`, and swallowing Tab or a
      //    single-key shortcut because the handler "handled" it by returning the
      //    same number is how a slider traps focus.
      return null;
  }
}

/** `inset(0 42% 0 0)` — the clip that reveals the "after" image up to the wipe. */
export function svClipInset(position: number): string {
  const pct = (1 - svClampPosition(position)) * 100;
  return `inset(0 ${pct.toFixed(3)}% 0 0)`;
}

/** ARIA slider value, as a whole percentage. */
export function svAriaValue(position: number): number {
  return Math.round(svClampPosition(position) * 100);
}

export function svPositionLabel(position: number, beforeAlt: string, afterAlt: string): string {
  const pct = svAriaValue(position);
  if (pct === 0) return `Showing ${beforeAlt} only.`;
  if (pct === 100) return `Showing ${afterAlt} only.`;
  return `${pct}% ${afterAlt}, ${100 - pct}% ${beforeAlt}.`;
}
