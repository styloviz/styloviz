/**
 * WCAG 2.x contrast, and saying a colour out loud.
 *
 * ── Why this is in `core` and not in the component that needed it ───────────
 *
 * ★★★ THE KIT ALREADY HAD THIS LOGIC, IN THE APP. `theme-builder.color.ts`
 *     carries a complete, tested WCAG audit — and it lives in
 *     `src/app/pages/theme-builder/`, which no library can import. So the colour
 *     picker's own contrast item (`FI-08-M1`) was one `Ctrl-C` away from
 *     becoming the kit's second contrast checker, which is exactly how two
 *     implementations drift until a designer's audit and a component's badge
 *     disagree about the same pair of colours.
 *
 *     The functions moved here and the theme builder re-exports them. One
 *     definition, two callers, and the app's existing specs cover it.
 *
 * ── Scope: WCAG 2.x, not APCA ───────────────────────────────────────────────
 *
 * ⚠️ The 4.5:1 / 3:1 ratios are the thresholds an auditor, a procurement
 *    questionnaire and a lawsuit will use, so this reports those. APCA is better
 *    perceptual science and is not what anyone is measured against yet; when it
 *    is, it belongs beside this rather than replacing it silently.
 */

import { svFormatLabel } from '@styloviz/core/i18n';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_CORE_LABELS, type SvCoreLabels } from '@styloviz/core/i18n';

/** The `core` labels `svColorName` builds a colour's name from. */
export type SvColorNameLabels = Pick<
  SvCoreLabels,
  | 'colorName'
  | 'colorBlack' | 'colorWhite' | 'colorDarkGrey' | 'colorLightGrey' | 'colorGrey'
  | 'colorRed' | 'colorOrange' | 'colorYellow' | 'colorLime' | 'colorGreen' | 'colorTeal'
  | 'colorCyan' | 'colorBlue' | 'colorIndigo' | 'colorPurple' | 'colorMagenta'
  | 'colorVeryDark' | 'colorDark' | 'colorVeryPale' | 'colorPale' | 'colorMuted' | 'colorVivid'
>;

/** Red, green, blue — each 0–255. */
export interface SvRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** True for `#abc`, `#aabbcc`, with or without the leading `#`, any case. */
export function svIsValidHex(value: string): boolean {
  return /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value.trim());
}

/** Expands a 3-digit shorthand to 6 digits and ensures a leading `#`, lowercased. */
export function svNormalizeHex(value: string): string {
  let v = value.trim().toLowerCase();
  if (!v.startsWith('#')) v = `#${v}`;
  if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
}

export function svHexToRgb(hex: string): SvRgb {
  const h = svNormalizeHex(hex);
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function svRelativeLuminance({ r, g, b }: SvRgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => srgbToLinear(v / 255));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG contrast ratio between two hex colours — 1 (identical) to 21 (black on white). */
export function svContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const a = svRelativeLuminance(svHexToRgb(foregroundHex));
  const b = svRelativeLuminance(svHexToRgb(backgroundHex));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export type SvWcagGrade = 'AAA' | 'AA' | 'AA Large' | 'Fail'; // sv-i18n-ignore: WCAG grade identifier

/**
 * The strongest grade a ratio earns for normal-size text, or `AA Large` when it
 * only clears the 3:1 bar that applies to ≥18.66px bold / ≥24px text and to
 * non-text UI boundaries.
 */
export function svWcagGrade(ratio: number): SvWcagGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large'; // sv-i18n-ignore: WCAG grade identifier
  return 'Fail';
}

/**
 * Rounded the way an audit tool prints it.
 *
 * ★★ FLOORED, NEVER ROUNDED UP PAST A THRESHOLD. `4.47` printed as "4.5:1" next
 *    to a green "AA" badge is a component telling a designer their text passes
 *    when it does not, and the error is invisible precisely because the number
 *    looks like the threshold.
 */
export function svFormatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
}

// ── Saying a colour out loud (FI-08-M2) ───────────────────────────────────────

/**
 * A plain-English name for a colour.
 *
 * ★★★ `#3B82F6` IS NOT AN ANNOUNCEMENT. A screen reader reads a hex value one
 *     character at a time — "number three B eight two F six" — which tells a
 *     user nothing about what they just picked. "Medium blue" does.
 *
 * ★★ DERIVED, NOT LOOKED UP. A table of the 148 CSS colour names sounds more
 *    precise and announces worse: the nearest entry to a muted blue-grey is
 *    "LightSlateGray", which is a name for a hex code rather than a description
 *    of a colour. Hue bucket plus lightness and saturation qualifiers produces
 *    something a person can picture, and has no table to keep in step.
 *
 * The words come from `labels` (the `core` namespace — `SV_CORE_LABELS` for
 * English), and `colorName` orders them, so a language that puts the hue first
 * reorders the template rather than the code.
 */
export function svColorName(hex: string, labels: SvColorNameLabels): string {
  const { r, g, b } = svHexToRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  // Achromatic: no hue worth naming, so lightness is the whole description.
  if (s < 0.08 || d < 0.02) {
    if (l < 0.06) return labels.colorBlack;
    if (l > 0.95) return labels.colorWhite;
    if (l < 0.3) return labels.colorDarkGrey;
    if (l > 0.75) return labels.colorLightGrey;
    return labels.colorGrey;
  }

  const rn = r / 255, gn = g / 255, bn = b / 255;
  let h: number;
  if (max === rn)      h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else                 h = (rn - gn) / d + 4;
  h = (h * 60 + 360) % 360;

  const hue =
    h < 15  ? labels.colorRed    : h < 45  ? labels.colorOrange  : h < 70  ? labels.colorYellow :
    h < 90  ? labels.colorLime   : h < 160 ? labels.colorGreen   : h < 190 ? labels.colorTeal   :
    h < 210 ? labels.colorCyan   : h < 250 ? labels.colorBlue    : h < 280 ? labels.colorIndigo :
    h < 310 ? labels.colorPurple : h < 340 ? labels.colorMagenta : labels.colorRed;

  // ★ Lightness first, then saturation, because that is the order people say
  //   them: "pale dusty blue", never "dusty pale blue".
  const lightness =
    l < 0.2  ? labels.colorVeryDark : l < 0.38 ? labels.colorDark :
    l > 0.88 ? labels.colorVeryPale : l > 0.72 ? labels.colorPale : '';
  const saturation = s < 0.25 ? labels.colorMuted : s > 0.85 ? labels.colorVivid : '';

  // An empty qualifier leaves a double space; collapse it.
  return svFormatLabel(labels.colorName, { lightness, saturation, hue }).replace(/\s+/g, ' ').trim();
}

/**
 * `svColorName` in the app's words — the `core` labels after every
 * `provideSvLabels()`. Call in an injection context (a field initializer).
 */
export function injectSvColorNamer(): (hex: string) => string {
  const labels = injectSvLabels('core', SV_CORE_LABELS);
  return (hex) => svColorName(hex, labels);
}
