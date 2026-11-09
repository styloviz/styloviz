import { svIsSwipePointer, svSwipeDismisses, svSwipeGesture, type SvSwipeSample } from './swipe-gesture';

/**
 * FL-J3-OF-20 — the shared drag-to-dismiss gesture (`sv-sidebar-nav` and
 * `sv-drawer`): axis lock, signed travel per direction, velocity over the last
 * 100 ms, and listeners only while a finger is down.
 */
function pointer(type: string, x: number, y: number, t: number, pointerType = 'touch'): PointerEvent {
  const e = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(e, { clientX: x, clientY: y, pointerType, pointerId: 1 });
  Object.defineProperty(e, 'timeStamp', { value: t });
  return e;
}

function run(toward: 'left' | 'right' | 'up' | 'down', path: [number, number, number][]) {
  const [x0, y0, t0] = path[0];
  const moves: number[] = [];
  let ended: SvSwipeSample | null | undefined;
  svSwipeGesture(pointer('pointerdown', x0, y0, t0), {
    toward,
    onMove: (travel) => moves.push(travel),
    onEnd: (s) => (ended = s),
  });
  for (const [x, y, t] of path.slice(1)) document.dispatchEvent(pointer('pointermove', x, y, t));
  const [xl, yl, tl] = path[path.length - 1];
  document.dispatchEvent(pointer('pointerup', xl, yl, tl));
  return { moves, ended };
}

describe('svSwipeGesture', () => {
  it('measures travel toward each physical direction', () => {
    expect(run('right', [[100, 100, 0], [140, 102, 50], [180, 104, 100]]).ended?.travel).toBe(80);
    expect(run('left', [[100, 100, 0], [60, 100, 50]]).ended?.travel).toBe(40);
    expect(run('down', [[100, 100, 0], [101, 160, 50]]).ended?.travel).toBe(60);
    expect(run('up', [[100, 100, 0], [100, 30, 50]]).ended?.travel).toBe(70);
    // Moving the other way is negative.
    expect(run('right', [[100, 100, 0], [40, 100, 50]]).ended?.travel).toBe(-60);
  });

  it('★ locks onto the axis: a vertical scroll never drags a side drawer', () => {
    const { moves, ended } = run('right', [[100, 100, 0], [104, 150, 30], [140, 300, 60]]);
    expect(moves).toEqual([]);
    expect(ended).toBeNull();
  });

  it('reports nothing for a tap under the 8px lock', () => {
    expect(run('right', [[100, 100, 0], [104, 103, 30]]).ended).toBeNull();
  });

  it('measures release velocity over the last 100 ms', () => {
    const slow = run('right', [[0, 0, 0], [20, 0, 200], [40, 0, 400], [60, 0, 600]]).ended!;
    expect(slow.velocity).toBeCloseTo(0.1, 2);
    const flick = run('right', [[0, 0, 0], [20, 0, 20], [50, 0, 40]]).ended!;
    expect(flick.velocity).toBeGreaterThan(1);
  });

  it('removes its document listeners on release, and on stop()', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    run('right', [[0, 0, 0], [30, 0, 10]]);
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));
    remove.mockClear();
    const stop = svSwipeGesture(pointer('pointerdown', 0, 0, 0), { toward: 'right', onEnd: () => undefined });
    stop();
    expect(remove).toHaveBeenCalledTimes(3);
    remove.mockRestore();
  });
});

describe('svSwipeDismisses', () => {
  it('★ dismisses past a third of the surface, at most 96px', () => {
    expect(svSwipeDismisses({ travel: 97, velocity: 0 }, 400)).toBe(true);
    expect(svSwipeDismisses({ travel: 95, velocity: 0 }, 400)).toBe(false);
    expect(svSwipeDismisses({ travel: 61, velocity: 0 }, 180)).toBe(true);
  });

  it('★ dismisses a short, fast flick — and not a jittery tap', () => {
    expect(svSwipeDismisses({ travel: 30, velocity: 0.8 }, 400)).toBe(true);
    expect(svSwipeDismisses({ travel: 30, velocity: 0.2 }, 400)).toBe(false);
    expect(svSwipeDismisses({ travel: 6, velocity: 5 }, 400)).toBe(false);
    expect(svSwipeDismisses({ travel: 30, velocity: 0.8 }, 400, { velocity: 0 })).toBe(false);
  });

  it('never dismisses a swipe away from the edge, or no swipe at all', () => {
    expect(svSwipeDismisses({ travel: -200, velocity: -3 }, 400)).toBe(false);
    expect(svSwipeDismisses(null, 400)).toBe(false);
  });
});

describe('svIsSwipePointer', () => {
  it('is touch and pen, never a mouse', () => {
    expect(svIsSwipePointer(pointer('pointerdown', 0, 0, 0, 'touch'))).toBe(true);
    expect(svIsSwipePointer(pointer('pointerdown', 0, 0, 0, 'pen'))).toBe(true);
    expect(svIsSwipePointer(pointer('pointerdown', 0, 0, 0, 'mouse'))).toBe(false);
  });
});
