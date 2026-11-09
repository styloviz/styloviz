/*
 * @styloviz/core/gestures — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
/** The shared drag-to-dismiss gesture for sliding surfaces (FL-J3-OF-20). */
export { svSwipeGesture, svSwipeDismisses, svIsSwipePointer } from './swipe-gesture';
export type { SvSwipeDirection, SvSwipeSample, SvSwipeGestureOptions, SvSwipeDismissRule } from './swipe-gesture';
export { svSwipeClamp, svSwipeLogical, svSwipeRelease, svSwipeTrayWidth } from './swipe-reveal';
export type { SvSwipeRevealSide, SvSwipeRevealRule, SvSwipeRevealOutcome } from './swipe-reveal';
