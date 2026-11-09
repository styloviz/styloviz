/**
 * swipe-gesture.ts — the one drag-to-dismiss gesture the kit's sliding
 * surfaces share (FL-J3-OF-20, `OF-05-M3`).
 *
 * ★★★ IT WAS WRITTEN ONCE, IN THE SIDEBAR, AND THE DRAWER NEEDED IT TOO. The
 *     sidebar's drawer followed a finger and closed past a third of its width;
 *     the Drawer — the same surface with four edges — had no gesture at all,
 *     and the action sheet planned on top of it needs the same one again. So
 *     the tracking lives here, and each surface keeps only its own rule for
 *     WHEN a release dismisses.
 *
 * What it owns, and every caller would otherwise get subtly different:
 *
 *  - **Touch and pen only** — a mouse drag over a panel is a text selection.
 *    The caller decides by not calling `svSwipeGesture` for `pointerType ===
 *    'mouse'`; {@link svIsSwipePointer} says the same thing in one place.
 *  - **Axis lock** — nothing is reported until the pointer has moved 8px, and
 *    then only if it moved along the gesture's axis. A vertical scroll inside
 *    a side drawer must never drag the drawer.
 *  - **Velocity** — measured over the last 100 ms of movement, so a flick that
 *    covers 40px quickly can dismiss where a slow 40px drag springs back.
 *  - **Teardown** — document listeners exist only while a finger is down, and
 *    the returned function removes them (call it on destroy).
 */

/** The physical direction a surface leaves in. */
export type SvSwipeDirection = 'left' | 'right' | 'up' | 'down';

/** A finished gesture, measured along its direction. */
export interface SvSwipeSample {
  /** Pixels moved toward `toward` (negative when moved the other way). */
  readonly travel: number;
  /** Speed toward `toward` at release, in px/ms (negative when moving away). */
  readonly velocity: number;
}

/** Options for {@link svSwipeGesture}. */
export interface SvSwipeGestureOptions {
  /** The direction that counts as positive travel. Read when the gesture starts. */
  readonly toward: SvSwipeDirection;
  /** Each move along the axis, with the travel so far. */
  readonly onMove?: (travel: number) => void;
  /**
   * The release. `null` when the gesture never locked onto this axis (a
   * scroll, a tap) — the caller should just reset.
   */
  readonly onEnd: (sample: SvSwipeSample | null) => void;
}

/** Pixels of movement before a gesture commits to an axis. */
const AXIS_LOCK_PX = 8;
/** The window velocity is measured over. */
const VELOCITY_WINDOW_MS = 100;

/** True for the pointers a swipe belongs to: touch and pen, never a mouse. */
export function svIsSwipePointer(event: PointerEvent): boolean {
  return event.pointerType !== 'mouse';
}

/**
 * Track one swipe from `start` (a `pointerdown`). Returns a function that
 * stops tracking without reporting — call it from the owner's destroy.
 */
export function svSwipeGesture(start: PointerEvent, options: SvSwipeGestureOptions): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const horizontal = options.toward === 'left' || options.toward === 'right';
  const sign = options.toward === 'right' || options.toward === 'down' ? 1 : -1;
  let axis: 'x' | 'y' | null = null;
  let travel = 0;
  const samples: { t: number; travel: number }[] = [{ t: stamp(start), travel: 0 }];

  const move = (e: PointerEvent): void => {
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    if (axis === null && Math.hypot(dx, dy) > AXIS_LOCK_PX) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (axis !== (horizontal ? 'x' : 'y')) return;
    travel = (horizontal ? dx : dy) * sign;
    const t = stamp(e);
    samples.push({ t, travel });
    while (samples.length > 2 && t - samples[0].t > VELOCITY_WINDOW_MS) samples.shift();
    options.onMove?.(travel);
  };

  let done = false;
  const stop = (): void => {
    if (done) return;
    done = true;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
  };
  const end = (): void => {
    stop();
    if (axis !== (horizontal ? 'x' : 'y')) { options.onEnd(null); return; }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    options.onEnd({ travel, velocity: dt > 0 ? (last.travel - first.travel) / dt : 0 });
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  return stop;
}

/** Thresholds for {@link svSwipeDismisses}. */
export interface SvSwipeDismissRule {
  /** Pixels of travel that always dismiss. @default min(96, extent / 3) */
  readonly distance?: number;
  /** Speed (px/ms) that dismisses a shorter flick. `0` turns flicks off. @default 0.5 */
  readonly velocity?: number;
}

/**
 * Whether a release dismisses: far enough, or fast enough toward the edge.
 *
 * ★ A flick still has to have MOVED (16px): a tap with a jittery finger can
 *   report a large instantaneous speed over two pixels.
 */
export function svSwipeDismisses(sample: SvSwipeSample | null, extent: number, rule: SvSwipeDismissRule = {}): boolean {
  if (!sample || sample.travel <= 0) return false;
  const distance = rule.distance ?? Math.min(96, extent / 3);
  if (sample.travel > distance) return true;
  const velocity = rule.velocity ?? 0.5;
  return velocity > 0 && sample.travel >= 16 && sample.velocity >= velocity;
}

/** The event's own time — every real event has one; a synthetic one may not. */
function stamp(e: Event): number {
  if (typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp)) return e.timeStamp;
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
