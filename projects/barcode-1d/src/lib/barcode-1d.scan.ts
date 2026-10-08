import type { BarcodeSymbology } from './barcode-1d.types';

/**
 * Physical size, which is the only size a scanner has an opinion about.
 *
 * ★★★ A BARCODE IS CORRECT IN MODULES AND SCANNABLE IN MILLIMETRES. Every
 * number this component produced was in CSS pixels, and a CSS pixel is not a
 * length a scanner can act on — it survives one print dialog's "fit to page"
 * and becomes something else. The X-dimension (the width of one module, on
 * paper) is the specified quantity in ISO/IEC 15416 and the GS1 specification,
 * and it is what decides whether a symbol reads at all.
 */

/**
 * One CSS pixel, in millimetres.
 *
 * ★ Fixed by the CSS spec at 1/96 inch, not a device measurement — which is
 * what makes this convertible at all. Note the coincidence worth knowing:
 * 0.2646 mm is almost exactly the EAN floor below, so a one-pixel module sits
 * on the minimum and anything narrower is beneath it. The existing pixel-snap
 * and this floor are the same wall approached from two sides.
 */
export const SV_MM_PER_CSS_PX = 25.4 / 96;

/**
 * The X-dimension each symbology is specified at, in millimetres.
 *
 * EAN is defined at 0.33 mm and permitted between 80% and 200% of it, so 100%
 * magnification is the nominal. Code 128 has no single nominal; GS1 general
 * distribution treats 0.495 mm as the reference.
 */
export const SV_BARCODE_NOMINAL_X_MM: Record<BarcodeSymbology, number> = {
  ean13: 0.33,
  ean8: 0.33,
  code128: 0.495,
};

/**
 * The narrowest X-dimension each symbology may legally be printed at, in mm.
 *
 * ★ These are floors, not targets. EAN's is 80% magnification of the 0.33 mm
 * nominal; Code 128's is the GS1 general-distribution minimum. Printing at the
 * floor assumes a good printer and a close-range scanner — the docs say so
 * rather than implying the component can guarantee either.
 */
export const SV_BARCODE_MIN_X_MM: Record<BarcodeSymbology, number> = {
  ean13: 0.264,
  ean8: 0.264,
  code128: 0.25,
};

/** What one symbol will physically measure, and whether that is enough. */
export interface SvBarcodeScanSize {
  /** Width of one module on paper, in mm. */
  readonly xMm: number;
  /** Full symbol width including quiet zones, in mm. */
  readonly widthMm: number;
  /** Bar height, in mm. */
  readonly heightMm: number;
  /** Percent of the symbology's nominal X-dimension. */
  readonly magnification: number;
  /** The floor this symbology may not go below. */
  readonly minXMm: number;
  /** True when `xMm` is under the floor — the symbol may not scan. */
  readonly belowMinimum: boolean;
  /** One sentence naming the problem, or `''` when there is none. */
  readonly warning: string;
}

const round = (v: number, places = 2): number => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

/**
 * Work out the physical size of a symbol.
 *
 * `overrideXMm` is the printed X-dimension when the host has pinned one; give
 * `0` and the CSS pixel width is converted instead, which is what the screen
 * shows and what an untouched print job produces.
 */
export function svScanSize(
  symbology: BarcodeSymbology,
  moduleWidthCssPx: number,
  totalModules: number,
  barHeightCssPx: number,
  overrideXMm = 0,
): SvBarcodeScanSize {
  const xMm = round(overrideXMm > 0 ? overrideXMm : moduleWidthCssPx * SV_MM_PER_CSS_PX, 4);
  const minXMm = SV_BARCODE_MIN_X_MM[symbology];
  const nominal = SV_BARCODE_NOMINAL_X_MM[symbology];
  const belowMinimum = xMm > 0 && xMm < minXMm;

  // Height is a scanning parameter too — a scanner sweeping at an angle needs
  // bar to cross the beam — but it is not the one that breaks first, so it is
  // reported rather than enforced.
  return {
    xMm,
    widthMm: round(xMm * totalModules),
    heightMm: round(barHeightCssPx * SV_MM_PER_CSS_PX),
    magnification: Math.round((xMm / nominal) * 100),
    minXMm,
    belowMinimum,
    warning: belowMinimum
      ? `One module measures ${xMm.toFixed(3)} mm on paper. ` +
        `${symbology === 'code128' ? 'Code 128' : 'EAN'} needs at least ` +
        `${minXMm} mm, so this may not scan. Widen the module or print it larger.`
      : '',
  };
}
