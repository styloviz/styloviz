import {
  SV_WATERMARK_MAX_OPACITY,
  SV_WATERMARK_MIN_OPACITY,
  svOpacityLabel,
  svOpacityVerdict,
  svRowOffset,
  svTileCount,
  svTileSize,
  svWatermarkLabel,
  svWatermarkSignature,
} from './watermark.tile';

// ── The rotated tile ────────────────────────────────────────────────────────

describe('the tile', () => {
  it('is the text box itself at zero degrees', () => {
    const tile = svTileSize(120, 20, 0, 0, 0);
    expect(tile.contentWidth).toBeCloseTo(120, 6);
    expect(tile.contentHeight).toBeCloseTo(20, 6);
  });

  /**
   * ★★★ THE TILE MUST BE SIZED FROM THE ROTATED BOX. A 120×20 label rotated 30°
   * occupies a 114×70 box; a 120×20 repeat overlaps its neighbours vertically
   * and gaps horizontally, and the result is a moiré of clipped, colliding text.
   */
  it('grows to the rotated extent at an angle', () => {
    const tile = svTileSize(120, 20, 30, 0, 0);
    // 120·cos30 + 20·sin30 = 103.9 + 10 = 113.9
    expect(tile.contentWidth).toBeCloseTo(120 * Math.cos(Math.PI / 6) + 20 * 0.5, 4);
    // 120·sin30 + 20·cos30 = 60 + 17.3 = 77.3
    expect(tile.contentHeight).toBeCloseTo(60 + 20 * Math.cos(Math.PI / 6), 4);
    // And it is emphatically not the unrotated height.
    expect(tile.contentHeight).toBeGreaterThan(20 * 3);
  });

  it('swaps the extents at ninety degrees', () => {
    const tile = svTileSize(120, 20, 90, 0, 0);
    expect(tile.contentWidth).toBeCloseTo(20, 6);
    expect(tile.contentHeight).toBeCloseTo(120, 6);
  });

  it('is widest at forty-five degrees for a square label', () => {
    const flat = svTileSize(50, 50, 0, 0, 0);
    const tilted = svTileSize(50, 50, 45, 0, 0);
    expect(tilted.contentWidth).toBeGreaterThan(flat.contentWidth);
    expect(tilted.contentWidth).toBeCloseTo(50 * Math.SQRT2, 5);
  });

  /**
   * ★★ THE ROTATED BOUNDING BOX DOES NOT CARE WHICH WAY THE ROTATION WENT, so
   * the tiling must not depend on how the author happened to write the angle.
   */
  it('is the same for equivalent angles written differently', () => {
    const a = svTileSize(120, 20, 30, 8, 8);
    for (const angle of [-30, 150, 210, -150]) {
      const b = svTileSize(120, 20, angle, 8, 8);
      expect(b.contentWidth).toBeCloseTo(a.contentWidth, 6);
      expect(b.contentHeight).toBeCloseTo(a.contentHeight, 6);
    }
  });

  it('adds the gap on top of the rotated extent, not instead of it', () => {
    const tile = svTileSize(120, 20, 30, 40, 24);
    expect(tile.width).toBeCloseTo(tile.contentWidth + 40, 6);
    expect(tile.height).toBeCloseTo(tile.contentHeight + 24, 6);
  });

  it('never produces a negative or NaN tile', () => {
    for (const tile of [
      svTileSize(-10, -10, 30, -5, -5),
      svTileSize(Number.NaN, 20, 30, 8, 8),
      svTileSize(120, Number.NaN, 30, 8, 8),
      svTileSize(120, 20, Number.NaN, 8, 8),
      svTileSize(120, 20, 30, Number.NaN, Number.NaN),
    ]) {
      expect(Number.isFinite(tile.width)).toBe(true);
      expect(Number.isFinite(tile.height)).toBe(true);
      expect(tile.width).toBeGreaterThanOrEqual(0);
      expect(tile.height).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── Staggering ──────────────────────────────────────────────────────────────

describe('the stagger', () => {
  /**
   * ★★ A SQUARE GRID READS AS COLUMNS, and columns leave clean vertical stripes
   * a screenshot can be cropped to.
   */
  it('offsets every other row by half a tile', () => {
    expect(svRowOffset(0, 200, true)).toBe(0);
    expect(svRowOffset(1, 200, true)).toBe(100);
    expect(svRowOffset(2, 200, true)).toBe(0);
    expect(svRowOffset(3, 200, true)).toBe(100);
  });

  it('leaves the grid square when the stagger is off', () => {
    expect(svRowOffset(1, 200, false)).toBe(0);
    expect(svRowOffset(7, 200, false)).toBe(0);
  });
});

// ── Coverage ────────────────────────────────────────────────────────────────

describe('covering the box', () => {
  /**
   * ★★★ EXACT COUNTS ON A BOX THAT DOES NOT DIVIDE EVENLY. Two mutations hid
   * behind the first version of this test. It asserted `>= 3` on a 250×45 box,
   * which is true for `ceil` (4) and for `floor` (3) alike — and the neighbouring
   * test used a 300×60 box that divides exactly, where `ceil` and `floor` agree.
   * Between them, rounding the tile count DOWN was invisible: the last row of
   * marks simply stops short of the bottom edge, which reads as a design choice.
   *
   * 250 ÷ 100 = 2.5 and 45 ÷ 20 = 2.25, so `ceil` gives 3 and 4 where `floor`
   * gives 2 and 3 — the numbers now say which.
   */
  it('rounds up so a partial tile still covers the edge', () => {
    const tile = svTileSize(100, 20, 0, 0, 0);
    // ceil(2.5) + 1 and ceil(2.25) + 1.
    expect(svTileCount(250, 45, tile)).toEqual({ cols: 4, rows: 4 });
    // One pixel past a whole tile still needs the extra one.
    expect(svTileCount(201, 41, tile)).toEqual({ cols: 4, rows: 4 });
  });

  /**
   * ★★ ONE EXTRA IN EACH DIRECTION. Staggered rows start half a tile to the
   * left, so a count that only just covers the box leaves a bare wedge on the
   * right of every other row — the exact area a screenshot gets cropped to.
   */
  it('draws one more than strictly needed, for the staggered rows', () => {
    const tile = svTileSize(100, 20, 0, 0, 0);
    const exact = svTileCount(300, 60, tile);
    expect(exact.cols).toBe(4);
    expect(exact.rows).toBe(4);
  });

  it('draws nothing for a box with no area', () => {
    const tile = svTileSize(100, 20, 0, 0, 0);
    expect(svTileCount(0, 0, tile)).toEqual({ cols: 0, rows: 0 });
  });

  it('draws nothing rather than looping forever on a zero-size tile', () => {
    expect(svTileCount(500, 500, { width: 0, height: 0, contentWidth: 0, contentHeight: 0 }))
      .toEqual({ cols: 0, rows: 0 });
  });
});

// ── Opacity ─────────────────────────────────────────────────────────────────

describe('the opacity band', () => {
  /**
   * ★★★ TWO FAILURE MODES PULLING IN OPPOSITE DIRECTIONS. Too faint and it is
   * gone the moment the screenshot is compressed; too strong and somebody turns
   * the feature off.
   */
  it('calls a mark that will not survive compression too faint', () => {
    expect(svOpacityVerdict(0.01)).toBe('too-faint');
    expect(svOpacityVerdict(SV_WATERMARK_MIN_OPACITY - 0.001)).toBe('too-faint');
  });

  it('calls a mark that buries the document too strong', () => {
    expect(svOpacityVerdict(0.6)).toBe('too-strong');
    expect(svOpacityVerdict(SV_WATERMARK_MAX_OPACITY + 0.001)).toBe('too-strong');
  });

  it('accepts the whole usable band, inclusive at both ends', () => {
    expect(svOpacityVerdict(SV_WATERMARK_MIN_OPACITY)).toBe('usable');
    expect(svOpacityVerdict(SV_WATERMARK_MAX_OPACITY)).toBe('usable');
    expect(svOpacityVerdict(0.1)).toBe('usable');
  });

  it('says which way it is wrong, and what happens', () => {
    expect(svOpacityLabel(0.01)).toContain('JPEG');
    expect(svOpacityLabel(0.6)).toContain('turns the watermark off');
    expect(svOpacityLabel(0.1)).toContain('light enough to read through');
  });

  it('treats a nonsense opacity as too faint rather than crashing', () => {
    expect(svOpacityVerdict(Number.NaN)).toBe('too-faint');
  });
});

// ── The signature ───────────────────────────────────────────────────────────

describe('the tamper signature', () => {
  /**
   * ★★★ A WATERMARK ONE DEVTOOLS KEYSTROKE CAN DELETE IS DECORATION. The
   * signature is what a restored mark is compared against, so an edit in place
   * is caught as well as an outright removal.
   */
  it('changes when any part of the mark changes', () => {
    const base = svWatermarkSignature('Confidential', 30, 0.1, 14);
    expect(svWatermarkSignature('Public', 30, 0.1, 14)).not.toBe(base);
    expect(svWatermarkSignature('Confidential', 45, 0.1, 14)).not.toBe(base);
    expect(svWatermarkSignature('Confidential', 30, 0.2, 14)).not.toBe(base);
    expect(svWatermarkSignature('Confidential', 30, 0.1, 18)).not.toBe(base);
  });

  it('is stable for the same configuration', () => {
    expect(svWatermarkSignature('Confidential', 30, 0.1, 14))
      .toBe(svWatermarkSignature('Confidential', 30, 0.1, 14));
  });

  /**
   * ★★ A SEPARATOR THAT CANNOT OCCUR IN THE TEXT. Joining on a comma or a space
   * would let a mark reading `"Confidential, 30"` at angle 0 collide with
   * `"Confidential"` at angle 30 — a different mark with the same fingerprint,
   * which the restorer would then accept as intact.
   */
  /**
   * ★★★ THE COLLISION A BARE CONCATENATION ALLOWS. The first version joined the
   * four fields with a bare separator, so `"Confidential3"` at 0 degrees and
   * `"Confidential"` at 30 degrees produced the identical fingerprint - change
   * the angle and the last character together and the restorer sees an intact
   * mark. Every fixed separator has the same flaw for some text; quoting does
   * not.
   */
  it('does not collide when a field boundary is ambiguous', () => {
    expect(svWatermarkSignature('Confidential3', 0, 0.1, 14))
      .not.toBe(svWatermarkSignature('Confidential', 30, 0.1, 14));
  });

  it('does not collide when the text contains a plausible separator', () => {
    for (const t of ['Confidential,30', 'Confidential 30', 'Confidential|30']) {
      expect(svWatermarkSignature(t, 0, 0.1, 14))
        .not.toBe(svWatermarkSignature('Confidential', 30, 0.1, 14));
    }
  });
});

// ── Label ───────────────────────────────────────────────────────────────────

describe('the label', () => {
  it('names the text, the count and the angle', () => {
    expect(svWatermarkLabel('Confidential', 24, 30)).toBe('Confidential · 24 marks · 30°');
  });

  it('says one mark in the singular', () => {
    expect(svWatermarkLabel('Draft', 1, 0)).toBe('Draft · 1 mark · 0°');
  });
});
