/**
 * swipe-reveal.ts — the rules for a row that slides aside to show actions
 * behind it (FL-F8, `sv-list-view`'s swipe actions).
 *
 * ★★ PURE, AND IN LOGICAL TERMS. A row reveals its START actions when it moves
 *    toward its end edge, and its END actions when it moves toward its start —
 *    right and left in a left-to-right page, the other way round in a
 *    right-to-left one. Every number here is already logical (positive = toward
 *    the end edge, revealing the start actions); the component converts the
 *    pointer's physical travel once, at the edge, with {@link svSwipeLogical}.
 *    Written once here so the free and Pro list views cannot drift apart on
 *    where a release lands.
 *
 * The gesture itself (touch/pen only, the 8px axis lock that leaves vertical
 * scrolling alone, velocity) is `svSwipeGesture`'s.
 */

/** Which edge's actions are showing. */
export type SvSwipeRevealSide = 'start' | 'end';

/** The geometry and options one release is judged against. */
export interface SvSwipeRevealRule {
  /** The row's width in px. */
  readonly width: number;
  /** Width of one action button in px. */
  readonly actionWidth: number;
  /** How many actions sit behind the start edge (revealed by a positive offset). */
  readonly startCount: number;
  /** How many actions sit behind the end edge (revealed by a negative offset). */
  readonly endCount: number;
  /** May a long swipe run the side's first action outright? */
  readonly fullSwipe: boolean;
  /** Fraction of the row's width past which a release is a full swipe. @default 0.6 */
  readonly fullSwipeRatio?: number;
  /** Speed (px/ms) toward the open side that opens a short flick. @default 0.4 */
  readonly flickVelocity?: number;
}

/** Where a release lands. */
export type SvSwipeRevealOutcome =
  | { readonly kind: 'close' }
  | { readonly kind: 'open'; readonly side: SvSwipeRevealSide }
  | { readonly kind: 'commit'; readonly side: SvSwipeRevealSide };

/** Physical travel → logical: in a right-to-left row, moving right is moving toward the start. */
export function svSwipeLogical(physical: number, rtl: boolean): number {
  return rtl ? -physical : physical;
}

/** The width of one side's tray of actions. */
export function svSwipeTrayWidth(side: SvSwipeRevealSide, rule: Pick<SvSwipeRevealRule, 'actionWidth' | 'startCount' | 'endCount'>): number {
  return (side === 'start' ? rule.startCount : rule.endCount) * rule.actionWidth;
}

/**
 * Where the row may be while a finger drags it.
 *
 * ★ A side with no actions does not move at all — a row that slides to show
 *   nothing reads as broken. Past its tray the row keeps following, which is
 *   what lets a full swipe happen, but never further than the row is wide.
 */
export function svSwipeClamp(offset: number, rule: SvSwipeRevealRule): number {
  if (!Number.isFinite(offset)) return 0;
  if (offset > 0 && rule.startCount === 0) return 0;
  if (offset < 0 && rule.endCount === 0) return 0;
  const limit = rule.fullSwipe ? rule.width : Math.max(svSwipeTrayWidth(offset > 0 ? 'start' : 'end', rule), 0);
  return Math.max(-limit, Math.min(limit, offset));
}

/**
 * Judge a release.
 *
 * - Past `fullSwipeRatio` of the width (and `fullSwipe` on): **commit** the
 *   side's first action.
 * - A flick back toward the middle: **close**.
 * - Past half the tray, or a flick toward it after at least 16px: **open**.
 * - Anything else: **close**.
 *
 * @param offset   logical offset at release (already clamped)
 * @param velocity logical speed at release, px/ms (positive = toward the end edge)
 */
export function svSwipeRelease(offset: number, velocity: number, rule: SvSwipeRevealRule): SvSwipeRevealOutcome {
  if (!Number.isFinite(offset) || offset === 0) return { kind: 'close' };
  const side: SvSwipeRevealSide = offset > 0 ? 'start' : 'end';
  const count = side === 'start' ? rule.startCount : rule.endCount;
  if (count === 0) return { kind: 'close' };

  const travel = Math.abs(offset);
  const ratio = rule.fullSwipeRatio ?? 0.6;
  if (rule.fullSwipe && rule.width > 0 && travel >= rule.width * ratio) return { kind: 'commit', side };

  const tray = svSwipeTrayWidth(side, rule);
  const toward = side === 'start' ? velocity : -velocity;
  const flick = rule.flickVelocity ?? 0.4;
  // A flick back toward the middle closes, wherever the row happens to be.
  if (Number.isFinite(toward) && toward <= -flick) return { kind: 'close' };
  if (travel >= tray / 2 || (travel >= 16 && Number.isFinite(toward) && toward >= flick)) return { kind: 'open', side };
  return { kind: 'close' };
}
