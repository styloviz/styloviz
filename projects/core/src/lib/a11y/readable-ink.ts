/**
 * Black or white, whichever reads better on `fill`.
 *
 * For the case a static contrast checker cannot reach: a chip whose background
 * arrives at runtime, from data. `check-contrast-pairs.mjs` names this exact
 * situation in its `BG_UNKNOWABLE` list, because `[style.background]="lbl.color"`
 * is an expression and no scanner can evaluate it. The answer is not to check
 * it harder but to derive an ink that cannot be wrong.
 *
 * The two candidates are pure black and pure white on purpose. The worst
 * possible fill sits at relative luminance 0.1791, where both land at 4.58:1 —
 * so this clears WCAG AA (4.5:1) for **any** colour a caller can pass. A softer
 * dark than `#000000` drops that floor below 4.5 and takes the guarantee with
 * it, which is the whole value of the function.
 *
 * Accepts `#rgb` and `#rrggbb`. Anything else — `rgb(…)`, a named colour, a
 * `var()` — cannot be measured without a live element, so it gets white; pass a
 * hex if the fill is light. Callers whose fallback fill is a token should point
 * it at a dark stop (700 or above) so that default is right.
 *
 * @example
 * ```html
 * <span [style.background]="label.color" [style.color]="svReadableInk(label.color)">
 * ```
 */
export function svReadableInk(fill: string | null | undefined): '#000000' | '#ffffff' {
  const hex = expandHex(fill?.trim() ?? '');
  if (!hex) return '#ffffff';

  // sRGB relative luminance, WCAG 2.x §Relative luminance.
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);

  return luminance > 0.1791 ? '#000000' : '#ffffff';
}

/** The six hex digits of `#rgb` or `#rrggbb`, or `null` if it is neither. */
function expandHex(value: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.slice(1);
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return value
      .slice(1)
      .split('')
      .map((d) => d + d)
      .join('');
  }
  return null;
}
