import {
  SV_BARCODE_MIN_X_MM,
  SV_BARCODE_NOMINAL_X_MM,
  SV_MM_PER_CSS_PX,
  svScanSize,
} from './barcode-1d.scan';

/**
 * Physical size, which is the only size a scanner has an opinion about.
 *
 * ★ Every number this component produced was in CSS pixels. A CSS pixel is a
 * layout unit, not a length on paper — and the X-dimension in millimetres is
 * the quantity ISO/IEC 15416 and GS1 actually specify.
 */

describe('SV_MM_PER_CSS_PX', () => {
  it('is fixed by the CSS spec, not measured from a device', () => {
    expect(SV_MM_PER_CSS_PX).toBeCloseTo(25.4 / 96, 10);
  });

  it('lands a one-pixel module almost exactly on the EAN floor', () => {
    // ★ Worth knowing rather than discovering: 0.2646 mm against a 0.264 mm
    // floor. The existing pixel-snap and this floor are the same wall from two
    // sides — a sub-pixel module both antialiases AND drops under the minimum.
    expect(SV_MM_PER_CSS_PX).toBeGreaterThan(SV_BARCODE_MIN_X_MM.ean13);
    expect(SV_MM_PER_CSS_PX - SV_BARCODE_MIN_X_MM.ean13).toBeLessThan(0.001);
  });
});

describe('svScanSize', () => {
  it('converts a pixel module to millimetres', () => {
    const s = svScanSize('code128', 2, 100, 64);
    expect(s.xMm).toBeCloseTo(0.5292, 3);
    expect(s.widthMm).toBeCloseTo(52.92, 1);
    expect(s.heightMm).toBeCloseTo(16.93, 1);
  });

  it('reports magnification against the symbology’s own nominal', () => {
    // EAN is defined at 0.33 mm; Code 128's reference is 0.495 mm. The same
    // pixel width is therefore a different percentage in each.
    const ean = svScanSize('ean13', 1.25, 113, 64);
    const c128 = svScanSize('code128', 1.25, 113, 64);
    expect(ean.magnification).toBeGreaterThan(c128.magnification);
    expect(ean.magnification).toBe(Math.round((ean.xMm / SV_BARCODE_NOMINAL_X_MM.ean13) * 100));
  });

  it('flags a module under the floor and says what to do', () => {
    const s = svScanSize('ean13', 0.75, 113, 64);
    expect(s.belowMinimum).toBe(true);
    expect(s.warning).toContain('may not scan');
    expect(s.warning).toContain('0.264');
  });

  it('passes a module on or above the floor', () => {
    const s = svScanSize('ean13', 1, 113, 64);
    expect(s.belowMinimum).toBe(false);
    expect(s.warning).toBe('');
  });

  it('holds Code 128 to its own, lower floor', () => {
    // 0.9px is 0.238 mm: under EAN's 0.264 and under Code 128's 0.25 too —
    // so pick a width that separates them.
    const px = 0.98; // ≈ 0.2593 mm
    expect(svScanSize('ean13', px, 100, 64).belowMinimum).toBe(true);
    expect(svScanSize('code128', px, 100, 64).belowMinimum).toBe(false);
  });

  it('measures the printed size when the host has pinned one', () => {
    // ★ The pinned value REPLACES the pixel conversion rather than adjusting
    // it: the whole point is that the CSS size stops mattering on paper.
    const s = svScanSize('ean13', 4, 113, 64, 0.33);
    expect(s.xMm).toBe(0.33);
    expect(s.magnification).toBe(100);
    expect(s.widthMm).toBeCloseTo(37.29, 1);
  });

  it('flags a pinned size that is itself too small', () => {
    const s = svScanSize('ean13', 4, 113, 64, 0.2);
    // A generous on-screen size does not rescue a print setting below the floor.
    expect(s.belowMinimum).toBe(true);
  });

  it('says nothing about a symbol with no width at all', () => {
    const s = svScanSize('code128', 0, 0, 0);
    expect(s.belowMinimum).toBe(false);
    expect(s.warning).toBe('');
  });
});
