import type { ButtonStyle, ButtonVariant } from './button.component';

/**
 * Which of the variant × style combinations are DESIGNED, and which merely
 * compile.
 *
 * ── The defect this answers (`FI-02-I1` / `FI-02-M1`) ───────────────────────
 *
 * ★★★ 10 VARIANTS × 6 STYLES × 5 SIZES × 3 SHAPES IS 900 RENDERABLE BUTTONS,
 *     AND NOBODY HAS EVER LOOKED AT THEM ALL. The type system permits every
 *     one; the design system intends a fraction. Between those two facts sits a
 *     component that will happily render `variant="link" btnStyle="gradient"`
 *     with a straight face, and a buyer who reasonably assumes that anything
 *     the types accept is something the kit stands behind.
 *
 * ★★ SIZE AND SHAPE ARE NOT THE PROBLEM. They are orthogonal — every size works
 *    with every shape and every colour row, because they touch padding and
 *    border-radius and nothing else. **The 900 collapses to 60**: one entry per
 *    (variant, style). Publishing a 900-row table would have been a way of
 *    looking thorough while saying less.
 *
 * ── The two degenerate axes ─────────────────────────────────────────────────
 *
 * ★★★ `ghost` AND `link` EXIST ON BOTH AXES, AND THAT IS THE WHOLE MESS.
 *     `variant` is meant to say WHICH COLOUR and `btnStyle` WHICH TREATMENT —
 *     but `variant="ghost"` is "no colour" and `btnStyle="ghost"` is "no fill",
 *     so the two say overlapping things and every pairing of them is a
 *     restatement, a contradiction, or both. The same for `link`.
 *
 *     They are not removed: they are load-bearing for existing callers, and
 *     `variant="ghost"` alone (with the default `solid`) is a perfectly good
 *     toolbar button. What changes is that the kit now SAYS which pairings it
 *     stands behind instead of leaving 60 doors open and hoping.
 *
 * ⚠️ `compiles` IS NOT `broken`. Every entry here renders, has a focus ring and
 *    passes `check:contrast`. It means: not part of the designed set, not
 *    covered by design review, and liable to look like a mistake rather than a
 *    choice. Use one and you own it.
 */
export type ButtonComboStatus = 'designed' | 'compiles';

export interface ButtonCombo {
  readonly variant: ButtonVariant;
  readonly btnStyle: ButtonStyle;
  readonly status: ButtonComboStatus;
  /** Why, for anything that is not `designed`. */
  readonly note?: string;
}

const VARIANTS: readonly ButtonVariant[] = [
  'primary', 'brand', 'secondary', 'success', 'warning',
  'danger', 'info', 'neutral', 'ghost', 'link',
];

const STYLES: readonly ButtonStyle[] = [
  'solid', 'outline', 'soft', 'ghost', 'link', 'gradient',
];

/** The colour variants — the ones that name a hue rather than an absence of one. */
export const BUTTON_COLOUR_VARIANTS: readonly ButtonVariant[] = [
  'primary', 'brand', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral',
];

function classify(v: ButtonVariant, s: ButtonStyle): ButtonCombo {
  // ── `link` as a VARIANT ───────────────────────────────────────────────────
  if (v === 'link') {
    if (s === 'link') {
      return { variant: v, btnStyle: s, status: 'compiles',
        note: 'Says "link" twice. Identical to variant="primary" btnStyle="link"; pick one axis.' };
    }
    if (s === 'gradient' || s === 'solid') {
      return { variant: v, btnStyle: s, status: 'compiles',
        note: 'A link-coloured fill. Renders, but a filled button that reads as a link is the thing link styling exists to avoid.' };
    }
    return { variant: v, btnStyle: s, status: 'compiles',
      note: 'Restates btnStyle. Use variant="primary" with this style instead.' };
  }

  // ── `ghost` as a VARIANT ──────────────────────────────────────────────────
  if (v === 'ghost') {
    if (s === 'solid') {
      return { variant: v, btnStyle: s, status: 'designed' };   // the toolbar button
    }
    if (s === 'ghost') {
      return { variant: v, btnStyle: s, status: 'compiles',
        note: 'Says "ghost" twice. Same render as variant="ghost" btnStyle="solid".' };
    }
    if (s === 'gradient') {
      return { variant: v, btnStyle: s, status: 'compiles',
        note: 'A gradient on the variant whose point is having no fill.' };
    }
    return { variant: v, btnStyle: s, status: 'compiles',
      note: 'A colourless variant under a treatment that exists to shape a colour.' };
  }

  // ── Colour variants ───────────────────────────────────────────────────────
  if (s === 'gradient' && (v === 'secondary' || v === 'neutral')) {
    return { variant: v, btnStyle: s, status: 'compiles',
      note: 'A grey-to-grey gradient. It renders; it is not a design the kit proposes.' };
  }
  return { variant: v, btnStyle: s, status: 'designed' };
}

/**
 * Every (variant, style) pairing the component accepts, with its status.
 *
 * Built rather than typed out, so it cannot fall behind the unions: adding a
 * variant adds six rows here and the spec fails until they are classified.
 */
export const BUTTON_MATRIX: readonly ButtonCombo[] =
  VARIANTS.flatMap((v) => STYLES.map((s) => classify(v, s)));

/** The pairings the kit stands behind. */
export const BUTTON_DESIGNED: readonly ButtonCombo[] =
  BUTTON_MATRIX.filter((c) => c.status === 'designed');
