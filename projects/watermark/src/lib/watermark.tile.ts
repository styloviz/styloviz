/**
 * `sv-watermark` — a tiled overlay, tiled correctly.
 *
 * ★★★ THE TILE MUST BE SIZED FROM THE ROTATED BOX, NOT THE UNROTATED ONE.
 *
 * A watermark is a repeating background, and every implementation computes the
 * repeat interval from the text's own width and height — then rotates it. At any
 * angle other than zero those are the wrong numbers: a 120×20 label rotated 30°
 * occupies a 114×70 box, so a 120×20 repeat overlaps its neighbours vertically
 * and gaps horizontally. The result is a moiré of clipped, colliding text that
 * looks like a rendering bug, and the usual "fix" is to pad the tile by eye
 * until it stops looking wrong at the one angle it was tested at.
 *
 * The rotated extent is exact and takes one line:
 *   W' = |w·cos θ| + |h·sin θ|
 *   H' = |w·sin θ| + |h·cos θ|
 */

export interface SvTile {
  /** Tile width in px, including the gap. */
  readonly width: number;
  /** Tile height in px, including the gap. */
  readonly height: number;
  /** Width of the rotated content alone, without the gap. */
  readonly contentWidth: number;
  readonly contentHeight: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * The repeat interval for a rotated label.
 *
 * ★★ THE ANGLE IS TAKEN MODULO 180 VIA `abs`, so −30°, 30°, 150° and 210° all
 * produce the same tile. They must: the rotated bounding box of a rectangle does
 * not care which way round the rotation went, and treating them differently
 * makes the tiling depend on how the author happened to write the angle.
 */
export function svTileSize(
  textWidth: number,
  textHeight: number,
  angleDeg: number,
  gapX: number,
  gapY: number,
): SvTile {
  const w = Math.max(0, Number.isFinite(textWidth) ? textWidth : 0);
  const h = Math.max(0, Number.isFinite(textHeight) ? textHeight : 0);
  const a = rad(Number.isFinite(angleDeg) ? angleDeg : 0);
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));

  const contentWidth = w * cos + h * sin;
  const contentHeight = w * sin + h * cos;

  return {
    contentWidth,
    contentHeight,
    width: contentWidth + Math.max(0, Number.isFinite(gapX) ? gapX : 0),
    height: contentHeight + Math.max(0, Number.isFinite(gapY) ? gapY : 0),
  };
}

/**
 * Offset the odd rows by half a tile.
 *
 * ★★ A SQUARE GRID OF REPEATED TEXT READS AS COLUMNS, and columns are trivially
 * easy to crop out of a screenshot — a watermark that lines up vertically leaves
 * whole clean vertical stripes between the marks. Staggering every other row
 * removes the stripes for free.
 */
export function svRowOffset(rowIndex: number, tileWidth: number, stagger: boolean): number {
  if (!stagger) return 0;
  return rowIndex % 2 === 0 ? 0 : tileWidth / 2;
}

/** How many tiles cover a box, always rounding up so the edges are covered. */
export function svTileCount(boxWidth: number, boxHeight: number, tile: SvTile): { cols: number; rows: number } {
  const w = Number.isFinite(boxWidth) && boxWidth > 0 ? boxWidth : 0;
  const h = Number.isFinite(boxHeight) && boxHeight > 0 ? boxHeight : 0;
  // ★ A BOX WITH NO AREA NEEDS NO TILES, and the `+ 1` below would otherwise
  //   give it one — a lone watermark floating on a container that is not there
  //   yet, which is what every zero-height box is on first render.
  if (tile.width <= 0 || tile.height <= 0 || w <= 0 || h <= 0) return { cols: 0, rows: 0 };
  // ★★ ONE EXTRA IN EACH DIRECTION. Staggered rows start half a tile to the
  //    left, so a count that only covers the box leaves a bare wedge on the
  //    right of every other row — the exact area a screenshot gets cropped to.
  return {
    cols: Math.ceil(w / tile.width) + 1,
    rows: Math.ceil(h / tile.height) + 1,
  };
}

/**
 * Opacity below which the mark is invisible and above which it ruins the page.
 *
 * ★★★ A WATERMARK HAS TWO FAILURE MODES AND THEY PULL IN OPPOSITE DIRECTIONS.
 * Too faint and it is gone the moment the screenshot is compressed to a JPEG —
 * which is what happens to every screenshot. Too strong and people cannot read
 * the document under it, so somebody turns the whole feature off. The usable
 * band is narrow and nobody documents it, so every implementation ships whatever
 * looked right on the developer's monitor.
 */
export const SV_WATERMARK_MIN_OPACITY = 0.04;
export const SV_WATERMARK_MAX_OPACITY = 0.25;

export type SvOpacityVerdict = 'too-faint' | 'usable' | 'too-strong';

export function svOpacityVerdict(opacity: number): SvOpacityVerdict {
  const o = Number.isFinite(opacity) ? opacity : 0;
  if (o < SV_WATERMARK_MIN_OPACITY) return 'too-faint';
  if (o > SV_WATERMARK_MAX_OPACITY) return 'too-strong';
  return 'usable';
}

export function svOpacityLabel(opacity: number): string {
  switch (svOpacityVerdict(opacity)) {
    case 'too-faint':
      return 'Below about 4% the mark survives on screen and disappears the moment the screenshot is saved as a JPEG — which is what happens to every screenshot.';
    case 'too-strong':
      return 'Above about 25% the document underneath becomes hard to read, and somebody turns the watermark off entirely.';
    default:
      return 'Visible in a compressed screenshot, and light enough to read through.';
  }
}

/**
 * A stable fingerprint of the mark's configuration.
 *
 * ★★★ A WATERMARK ONE DEVTOOLS KEYSTROKE CAN DELETE IS DECORATION. The overlay
 * is a DOM node like any other, and removing it — or setting `display: none` on
 * it — takes one click in the inspector. `checkIntegrity()` compares this value
 * with the one published on the overlay, so a mark whose text or angle was edited
 * in place is reported as well as one that was deleted.
 *
 * ⚠️ REPORTED, NOT RESTORED, AND NOT PROVEN. The comparison runs in the same
 * browser the edit was made in; see `SvWatermarkComponent.tampered` for exactly
 * what a mismatch does and does not prove.
 *
 * ★★ It is deliberately NOT a security control, and the docs say so. Anything
 * rendered client-side can be removed by a determined person with the page
 * source; the point is to defeat the casual crop-and-share, which is the actual
 * threat and covers almost every real leak.
 *
 * ★★★ `JSON.stringify` RATHER THAN A JOIN, BECAUSE THE TEXT IS ARBITRARY. The
 * first version concatenated the four fields with a bare separator, which makes
 * `"Confidential3"` at 0 degrees and `"Confidential"` at 30 degrees produce the
 * SAME fingerprint - so changing the angle and the last character of the text
 * together leaves the restorer seeing an intact mark. Any fixed separator has
 * the same flaw for some text; quoting the fields does not.
 */
export function svWatermarkSignature(
  text: string,
  angleDeg: number,
  opacity: number,
  fontSize: number,
): string {
  return JSON.stringify([text, angleDeg, opacity, fontSize]);
}

/** `Confidential · 24 marks · 30°` */
export function svWatermarkLabel(text: string, count: number, angleDeg: number): string {
  return `${text} · ${count} mark${count === 1 ? '' : 's'} · ${angleDeg}°`;
}

// ── Privacy-safe marks (LU-12-I2 / LU-12-M3) ────────────────────────────────

/**
 * An opaque, stable, short token for a viewer id — so a personalised mark can
 * carry `a7k2q9` rather than a name or an email address.
 *
 * ★★★ A MARK IS PUBLISHED TO EVERY SCREENSHOT, SCREEN SHARE AND SUPPORT TICKET
 * THE PAGE EVER APPEARS IN. A watermark reading `jane.doe@acme.com` does its job
 * — it identifies the leaker — and leaks Jane's address to every recipient of
 * every legitimate screenshot too. A token identifies the viewer to the one party
 * that can map it back (the host's server) and to nobody else.
 *
 * ⚠️ IT IS A HASH (32-bit FNV-1a), NOT ENCRYPTION AND NOT A SECRET. Somebody who
 * can enumerate your id space — sequential integers, a staff directory — can hash
 * every candidate and reverse the token. Pass a per-deployment `salt` the client
 * cannot guess, or better, mint the token on the server and bind it through
 * `text`. Collisions are possible (32 bits); treat the token as a lead to look up,
 * not as proof of identity.
 *
 * Deterministic: the same id and salt always produce the same token, so a
 * screenshot taken today and one taken next month name the same viewer.
 */
export function svViewerToken(id: string | number, salt = ''): string {
  const input = `${salt}\u0000${String(id)}`;
  // FNV-1a, 32-bit. `Math.imul` keeps the multiply in 32-bit integer space.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned, base-36, padded to a fixed width so every token looks alike.
  return (hash >>> 0).toString(36).padStart(7, '0');
}

/** Something shaped like `local@domain.tld` anywhere in the text. */
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;

/**
 * Whether the mark text looks like it contains an email address — the dev-mode
 * warning's test. A heuristic, not a PII detector: it cannot see a name.
 */
export function svLooksLikeEmail(text: string): boolean {
  return EMAIL_LIKE.test(text);
}
