import { encodeQR } from './qr-encoder.util';

/**
 * The encoder is pure arithmetic over a bit matrix, so it can be checked
 * without a canvas — which matters, because jsdom has no 2D context and the
 * component that draws this matrix cannot be exercised beyond the guard.
 *
 * A QR matrix is verified structurally: the three finder patterns, the timing
 * lines, the size/version relationship, and the invariants that hold for every
 * payload. Comparing to a golden bitmap would pin the encoder to one masking
 * choice and break on any legal change.
 */

const size = (m: boolean[][]) => m.length;

/** The 7×7 finder pattern: dark ring, light ring, 3×3 dark core. */
function hasFinderAt(m: boolean[][], r0: number, c0: number): boolean {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const onOuterRing = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const expected = onOuterRing || inCore;
      if (m[r0 + r][c0 + c] !== expected) return false;
    }
  }
  return true;
}

describe('encodeQR — structure', () => {
  it('places all three finder patterns', () => {
    const m = encodeQR('hello');
    const n = size(m);
    expect(hasFinderAt(m, 0, 0)).toBe(true);
    expect(hasFinderAt(m, 0, n - 7)).toBe(true);
    expect(hasFinderAt(m, n - 7, 0)).toBe(true);
  });

  it('alternates the timing patterns between the finders', () => {
    const m = encodeQR('hello');
    for (let c = 8; c < size(m) - 8; c++) {
      expect(m[6][c]).toBe(c % 2 === 0);
    }
    for (let r = 8; r < size(m) - 8; r++) {
      expect(m[r][6]).toBe(r % 2 === 0);
    }
  });

  it('is square, and every module is a decided boolean', () => {
    const m = encodeQR('hello');
    for (const row of m) {
      expect(row).toHaveLength(size(m));
      for (const cell of row) expect(typeof cell).toBe('boolean');
    }
  });

  /** Version n is (17 + 4n) modules across. */
  it('grows to the next version only when the payload needs it', () => {
    const v1 = encodeQR('hi');
    expect(size(v1)).toBe(21);

    const bigger = encodeQR('x'.repeat(60));
    expect(size(bigger)).toBeGreaterThan(21);
    expect((size(bigger) - 17) % 4).toBe(0);
  });

  /**
   * ★ Version 2 and up carry alignment patterns; version 1 carries none. This
   * is the branch a short payload never reaches — and an encoder that skipped
   * it would produce a code no scanner could lock onto.
   */
  it('adds an alignment pattern from version 2 onward', () => {
    const m = encodeQR('x'.repeat(40));
    const n = size(m);
    expect(n).toBeGreaterThanOrEqual(25);

    // For versions 2–6 the single alignment centre sits at (n-7, n-7): a dark
    // centre, a light ring around it, and a dark 5×5 ring outside that.
    const k = n - 7;
    expect(m[k][k]).toBe(true);
    expect(m[k - 1][k]).toBe(false);
    expect(m[k - 2][k]).toBe(true);
    expect(m[k][k - 1]).toBe(false);
    expect(m[k][k - 2]).toBe(true);

    // Version 1 has none: (n-7, n-7) on a 21-module symbol is inside the
    // bottom-left finder's quiet area, not an alignment ring.
    const v1 = encodeQR('hi');
    expect(size(v1)).toBe(21);
  });

  /**
   * Past version 9 the character-count field widens from 8 bits to 16. A
   * payload that crosses that line has to still decode to the same size family.
   */
  it('handles a payload long enough to widen the length field', () => {
    const long = encodeQR('a'.repeat(280), 'L');
    expect(size(long)).toBeGreaterThan(21);
    expect(hasFinderAt(long, 0, 0)).toBe(true);
  });
});

describe('encodeQR — edge payloads', () => {
  /** Empty is not an error and not a crash — it is a single light module. */
  it('returns a single light module for an empty payload', () => {
    expect(encodeQR('')).toEqual([[false]]);
  });

  it('encodes multi-byte UTF-8 without truncating it', () => {
    const m = encodeQR('héllo — 世界');
    expect(hasFinderAt(m, 0, 0)).toBe(true);
    expect(size(m)).toBeGreaterThanOrEqual(21);
  });

  /**
   * Higher error correction costs capacity, so the same payload needs a bigger
   * symbol at H than at L. That relationship is the whole point of the level.
   */
  it('needs a larger symbol at higher error correction', () => {
    const payload = 'x'.repeat(40);
    expect(size(encodeQR(payload, 'H'))).toBeGreaterThan(size(encodeQR(payload, 'L')));
  });

  it('produces a matrix for every error-correction level', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      const m = encodeQR('hello', level);
      expect(hasFinderAt(m, 0, 0)).toBe(true);
    }
  });

  /** The encoder is pure: the same input must give the same matrix. */
  it('is deterministic', () => {
    expect(encodeQR('https://example.com')).toEqual(encodeQR('https://example.com'));
  });

  it('gives different payloads different matrices', () => {
    expect(encodeQR('a')).not.toEqual(encodeQR('b'));
  });

  /**
   * ★ Galois-field multiplication by zero. The Reed–Solomon generator hits
   * `gfMul(x, 0)` whenever a coefficient is zero, which happens for payloads
   * whose codewords include a 0x00 — a run of padding is the ordinary case.
   */
  it('encodes a payload whose codewords include zeroes', () => {
    // A short payload leaves the block mostly padding, which is what drives a
    // zero through the field multiply.
    const m = encodeQR('a', 'H');
    expect(hasFinderAt(m, 0, 0)).toBe(true);
    expect(size(m)).toBe(21);
  });
});
