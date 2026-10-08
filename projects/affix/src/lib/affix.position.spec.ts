import {
  svAffixLabel,
  svAffixState,
  svAffixThreshold,
  svIsAffixed,
  type SvAffixInput,
} from './affix.position';

const at = (over: Partial<SvAffixInput> = {}): SvAffixInput => ({
  scrollY: 0,
  anchorTop: 200,
  height: 120,
  offsetTop: 16,
  containerBottom: null,
  ...over,
});

// ── The three modes ─────────────────────────────────────────────────────────

describe('when the element pins', () => {
  it('stays in flow above its threshold', () => {
    expect(svAffixState(at({ scrollY: 0 })).mode).toBe('static');
    expect(svAffixState(at({ scrollY: 100 })).mode).toBe('static');
  });

  it('pins once the scroll reaches its resting position, less the offset', () => {
    // anchorTop 200, offsetTop 16 → threshold 184.
    expect(svAffixState(at({ scrollY: 183 })).mode).toBe('static');
    expect(svAffixState(at({ scrollY: 185 })).mode).toBe('fixed');
  });

  /**
   * ★★★ AND AT THE THRESHOLD ITSELF, STATIC — WHICH THE TEST ABOVE STEPS OVER.
   * 183 and 185 with nothing at 184 is a fixture that cannot see the comparison
   * flip from `<=` to `<`, and a mutation proved it: the boundary was untested.
   *
   * Static is the right answer there, not a coin toss. At exactly the threshold
   * the element is already sitting `offsetTop` from the viewport top, so pinning
   * moves it nowhere — it only swaps in the placeholder, adds `position: fixed`
   * and emits an `affixChange` nobody can see. A scroll that rests on that pixel
   * would then emit on every jitter of a trackpad. The element pins when it
   * would otherwise start to LEAVE, which is one pixel later.
   */
  it('is still in flow at exactly the threshold, and pins one pixel past it', () => {
    expect(svAffixState(at({ scrollY: 184 })).mode).toBe('static');
    expect(svAffixState(at({ scrollY: 184 })).placeholder).toBe(0);
    expect(svAffixState(at({ scrollY: 184.5 })).mode).toBe('fixed');
  });

  it('pins at the offset, not at zero', () => {
    expect(svAffixState(at({ scrollY: 500, offsetTop: 16 })).top).toBe(16);
    expect(svAffixState(at({ scrollY: 500, offsetTop: 0 })).top).toBe(0);
  });

  it('reports the threshold from the anchor, not from the pinned element', () => {
    expect(svAffixThreshold(200, 16)).toBe(184);
  });

  /**
   * ★★ THE CLASSIC ONE-WAY LATCH. Once pinned, the element's own bounding rect
   * reports the viewport position it was moved to, so re-deriving the threshold
   * from it gives the threshold that keeps it pinned.
   */
  it('never reports a negative threshold for an element already near the top', () => {
    expect(svAffixThreshold(10, 100)).toBe(0);
  });
});

// ── The placeholder ─────────────────────────────────────────────────────────

describe('the placeholder', () => {
  /**
   * ★★★ GOING FIXED REMOVES THE ELEMENT FROM FLOW AND EVERYTHING BELOW JUMPS UP
   * BY ITS HEIGHT — which changes the page height, which changes scrollY, which
   * can unpin it, which puts the height back. The element flickers and the page
   * shudders at exactly the position somebody is reading.
   */
  it('holds nothing while the element is in flow', () => {
    expect(svAffixState(at({ scrollY: 0 })).placeholder).toBe(0);
  });

  it('holds the full height the moment it pins', () => {
    expect(svAffixState(at({ scrollY: 500, height: 120 })).placeholder).toBe(120);
  });

  /**
   * ★★ `docked` IS OUT OF FLOW TOO. A placeholder that disappears when the
   * element docks produces the same jump at the bottom of the container — once
   * instead of continuously, which is harder to notice and no less wrong.
   */
  it('keeps holding the height when the element docks', () => {
    const state = svAffixState(at({ scrollY: 900, containerBottom: 1000, height: 120 }));
    expect(state.mode).toBe('docked');
    expect(state.placeholder).toBe(120);
  });

  it('holds exactly the measured height, so the page height never changes', () => {
    for (const height of [1, 40, 120, 800]) {
      expect(svAffixState(at({ scrollY: 5000, height })).placeholder).toBe(height);
    }
  });

  it('treats a negative measurement as zero rather than shrinking the page', () => {
    expect(svAffixState(at({ scrollY: 5000, height: -30 })).placeholder).toBe(0);
  });
});

// ── The container boundary ──────────────────────────────────────────────────

describe('the container boundary', () => {
  /**
   * ★★★ A PINNED SIDEBAR WITH NO BOUNDARY FLOATS OVER THE FOOTER, over the next
   * section, and — because it is fixed — over whatever the reader scrolled down
   * to look at.
   */
  it('pins freely while the container still has room', () => {
    const state = svAffixState(at({ scrollY: 400, containerBottom: 2000 }));
    expect(state.mode).toBe('fixed');
    expect(state.atBoundary).toBe(false);
  });

  it('parks at the container bottom once the element would overrun it', () => {
    // scrollY 900 + offset 16 + height 120 = 1036 > containerBottom 1000.
    const state = svAffixState(at({ scrollY: 900, containerBottom: 1000 }));
    expect(state.mode).toBe('docked');
    expect(state.atBoundary).toBe(true);
  });

  it('parks so the element ends exactly at the container bottom', () => {
    // Docked top is relative to the container's own box: bottom − height − anchor.
    const state = svAffixState(at({ scrollY: 900, containerBottom: 1000, height: 120, anchorTop: 200 }));
    expect(state.top).toBe(1000 - 120 - 200);
  });

  it('never parks above the container top', () => {
    // A container shorter than the element it holds.
    const state = svAffixState(at({ scrollY: 900, containerBottom: 250, height: 400, anchorTop: 200 }));
    expect(state.top).toBe(0);
  });

  it('pins indefinitely when no boundary was given', () => {
    const state = svAffixState(at({ scrollY: 99999, containerBottom: null }));
    expect(state.mode).toBe('fixed');
  });

  it('ignores a boundary that is not a number', () => {
    expect(svAffixState(at({ scrollY: 900, containerBottom: Number.NaN })).mode).toBe('fixed');
  });

  it('stays static below its threshold even inside a short container', () => {
    // The boundary must not pull an element out of flow it never left.
    const state = svAffixState(at({ scrollY: 0, containerBottom: 220 }));
    expect(state.mode).toBe('static');
    expect(state.placeholder).toBe(0);
  });
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe('the state is a pure function of the measurements', () => {
  /**
   * ★★★ NO STATE, NO HYSTERESIS, NO DEBOUNCE. That is what makes the placeholder
   * SUFFICIENT to stop the flicker rather than merely reduce it: given the same
   * numbers this always returns the same answer, so there is no oscillation for
   * a debounce to paper over.
   */
  it('returns the same answer for the same numbers, in any order of calls', () => {
    const positions = [0, 100, 184, 185, 400, 900, 5000];
    const first = positions.map((scrollY) => svAffixState(at({ scrollY, containerBottom: 1000 })));
    const second = [...positions].reverse().map((scrollY) =>
      svAffixState(at({ scrollY, containerBottom: 1000 })),
    ).reverse();
    expect(second).toEqual(first);
  });

  it('survives non-finite measurements rather than producing NaN positions', () => {
    for (const state of [
      svAffixState(at({ scrollY: Number.NaN })),
      svAffixState(at({ anchorTop: Number.NaN, scrollY: 500 })),
      svAffixState(at({ height: Number.NaN, scrollY: 500 })),
      svAffixState(at({ offsetTop: Number.NaN, scrollY: 500 })),
    ]) {
      expect(Number.isFinite(state.top)).toBe(true);
      expect(Number.isFinite(state.placeholder)).toBe(true);
    }
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('counts both pinned modes as affixed', () => {
    expect(svIsAffixed(svAffixState(at({ scrollY: 0 })))).toBe(false);
    expect(svIsAffixed(svAffixState(at({ scrollY: 500 })))).toBe(true);
    expect(svIsAffixed(svAffixState(at({ scrollY: 900, containerBottom: 1000 })))).toBe(true);
  });

  it('describes each mode in words', () => {
    expect(svAffixLabel(svAffixState(at({ scrollY: 0 })))).toBe('In flow.');
    expect(svAffixLabel(svAffixState(at({ scrollY: 500 })))).toContain('Pinned 16px');
    expect(svAffixLabel(svAffixState(at({ scrollY: 900, containerBottom: 1000 }))))
      .toContain('will not float over what comes next');
  });
});
