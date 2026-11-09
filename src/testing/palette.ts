/**
 * ============================================================================
 *  @testing/palette — the kit's real colours, for non-text contrast specs
 * ============================================================================
 *
 * jsdom computes no styles, so a spec cannot ask the browser what colour a
 * `bg-warning-500` paints. This reads the answer from the same two sources the
 * browser does: Tailwind's own `theme.css` (oklch defaults) overridden by the
 * `@theme { … }` block in `projects/core/styles/styloviz.css` (the kit's hex
 * ramps) — the stylesheet `@styloviz/core` ships, generated from
 * `src/styles.css` and kept identical by `check:generated`. Reading the shipped
 * copy keeps this helper working in the public mirror, which has no `src/styles.css`.
 * Template scopes (`.tpl-<id>`) are deliberately NOT applied — a component in
 * `projects/**` ships with the base palette. Same resolution order as
 * `scripts/check-contrast-pairs.mjs`.
 */
import { readFileSync } from 'node:fs';

type Rgb = readonly [number, number, number];

function oklchToRgb(L: number, C: number, H: number): Rgb {
  L /= 100;
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const f = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
  return [f(r), f(g), f(bb)].map((v) => Math.max(0, Math.min(1, v))) as unknown as Rgb;
}

const hexToRgb = (h: string): Rgb =>
  [0, 2, 4].map((i) => parseInt(h.slice(1).substr(i, 2), 16) / 255) as unknown as Rgb;

let cache: Map<string, Rgb> | null = null;

function palette(): Map<string, Rgb> {
  if (cache) return cache;
  const out = new Map<string, Rgb>([['white', [1, 1, 1]], ['black', [0, 0, 0]]]);
  const theme = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
  for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/g)) {
    out.set(`${m[1]}-${m[2]}`, oklchToRgb(+m[3], +m[4], +m[5]));
  }
  const css = readFileSync('projects/core/styles/styloviz.css', 'utf8');
  // Anchored: the file's header comment shows an `@theme { … }` example.
  const at = css.search(/^@theme\s*\{/m);
  let depth = 0;
  let end = -1;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  for (const m of css.slice(at, end).matchAll(/--color-([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
    out.set(m[1], hexToRgb(m[2]));
  }
  cache = out;
  return out;
}

/** The sRGB value (0–1 channels) of a palette token such as `'primary-600'` or `'white'`. */
export function svToken(name: string): Rgb {
  const rgb = palette().get(name);
  if (!rgb) throw new Error(`@testing/palette: no colour token "${name}"`);
  return rgb;
}

/** `top` at opacity `alpha` composited over `under`. */
export function svMix(top: Rgb, alpha: number, under: Rgb): Rgb {
  return top.map((c, i) => c * alpha + under[i] * (1 - alpha)) as unknown as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2.x contrast ratio between two colours. */
export function svContrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
