import { describe, expect, it } from 'vitest';
import { svReadableInk } from './readable-ink';

/** WCAG 2.x contrast ratio between two `#rrggbb` colours. */
function ratio(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const channel = (i: number): number => {
      const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('svReadableInk', () => {
  /*
   * The claim that makes the function worth having: there is no sRGB colour it
   * can be wrong about. An independent ratio implementation is used above rather
   * than the one under test, so this fails if the 0.1791 threshold drifts.
   *
   * Sampled rather than exhaustive on purpose — 16.7M colours is a slow suite
   * for no extra information, since luminance is monotonic in each channel and
   * the worst case is a plateau, not a spike. Step 17 hits 0 and 255 exactly.
   */
  it('clears AA on every colour it can measure', () => {
    let worst = Infinity;
    let worstHex = '';
    for (let r = 0; r <= 255; r += 17) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 17) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
          const measured = ratio(hex, svReadableInk(hex));
          if (measured < worst) {
            worst = measured;
            worstHex = hex;
          }
        }
      }
    }
    expect(worst, `worst fill was ${worstHex} at ${worst.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * The fills the axe sweep actually caught on /templates/admin/projects/team-board,
   * with the ratios it reported for the flat `text-white` they replaced. Kept as
   * literals so a regression names the colour that broke rather than a number.
   */
  it.each([
    ['#f59e0b', 2.15],
    ['#22d3ee', 1.81],
    ['#10b981', 2.54],
    ['#9ca3af', 2.54],
    ['#3b82f6', 3.68],
    ['#8b5cf6', 4.23],
    ['#f43f5e', 3.67],
  ])('fixes %s, which white failed at %s:1', (fill, whiteRatio) => {
    expect(ratio(fill, '#ffffff')).toBeCloseTo(whiteRatio, 1);
    expect(ratio(fill, svReadableInk(fill))).toBeGreaterThanOrEqual(4.5);
  });

  it('picks white on a dark fill and black on a light one', () => {
    expect(svReadableInk('#000000')).toBe('#ffffff');
    expect(svReadableInk('#1e293b')).toBe('#ffffff');
    expect(svReadableInk('#ffffff')).toBe('#000000');
    expect(svReadableInk('#fde68a')).toBe('#000000');
  });

  it('accepts the short hex form', () => {
    expect(svReadableInk('#fff')).toBe(svReadableInk('#ffffff'));
    expect(svReadableInk('#000')).toBe(svReadableInk('#000000'));
    expect(svReadableInk('#f0a')).toBe(svReadableInk('#ff00aa'));
  });

  it('is case- and whitespace-insensitive', () => {
    expect(svReadableInk('  #F59E0B  ')).toBe('#000000');
  });

  /*
   * Unmeasurable input falls back to white, which is why every caller's own
   * fallback fill has to be a dark stop. This is the contract the kanban board
   * relies on when a card has no colour of its own.
   */
  it.each([['rgb(245, 158, 11)'], ['var(--color-brandaccent-700)'], ['tomato'], ['#12345'], [''], [null], [undefined]])(
    'returns white for unmeasurable input %s',
    (fill) => {
      expect(svReadableInk(fill as string | null | undefined)).toBe('#ffffff');
    },
  );
});
