import type { BarcodeModule, BarcodeSymbology } from './barcode-1d.types';

/**
 * `sv-barcode-1d` — barcodes that scan.
 *
 * ★★★ A BARCODE WITH THE WRONG CHECK DIGIT DOES NOT FAIL TO SCAN. IT SCANS AS A
 * DIFFERENT NUMBER.
 *
 * That is the whole reason this is arithmetic and not CSS. Every "pure CSS
 * barcode" on the internet draws stripes from the digits and stops there, and
 * the result is a picture of a barcode: a scanner either rejects it or — with
 * EAN-13, where the thirteenth digit is a checksum over the other twelve —
 * reads a valid-looking article number that belongs to something else. A
 * mislabelled shipment is a worse outcome than a label that obviously failed.
 *
 * ★★★ AND THE QUIET ZONE IS PART OF THE SYMBOL, NOT PADDING AROUND IT. The spec
 * mandates blank margins (10 modules for Code 128; 11 left and 7 right for
 * EAN-13) because the scanner uses them to find the edges. Lay a barcode flush
 * against a table cell border and it stops scanning, and nobody looking at it
 * can see why — the bars are all correct.
 */

// ── Code 128 ────────────────────────────────────────────────────────────────

/**
 * The 107 Code 128 patterns, as bar/space run lengths in modules.
 *
 * Each entry is six runs — bar, space, bar, space, bar, space — summing to 11
 * modules. Value 106 (stop) is the exception: seven runs, 13 modules.
 */
const CODE128_PATTERNS: readonly string[] = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;
const CODE128_SHIFT_B = 100;
const CODE128_SHIFT_C = 99;

/**
 * Quiet zone, in modules, on each side.
 *
 * ★★★ NOT DECORATION. The scanner locates the symbol by finding blank margins;
 * without them the first bar has nothing to be distinguished from and the read
 * fails. Code 128 wants 10 modules or 6.4 mm, whichever is greater; EAN wants
 * 11 on the left and 7 on the right, which is why they are separate numbers.
 */
export const SV_QUIET_CODE128 = 10;
export const SV_QUIET_EAN_LEFT = 11;
export const SV_QUIET_EAN_RIGHT = 7;

/** Code 128 subset B covers printable ASCII, space through DEL-1. */
function inSubsetB(code: number): boolean {
  return code >= 32 && code <= 126;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';

/** How many digits run consecutively from `at`. */
function digitRun(value: string, at: number): number {
  let n = 0;
  while (at + n < value.length && isDigit(value[at + n])) n++;
  return n;
}

/**
 * Pick the Code 128 code values for a string, switching between subsets B and C.
 *
 * ★★★ SUBSET C IS NOT AN OPTIMISATION, IT IS THE DIFFERENCE BETWEEN A LABEL THAT
 * FITS AND ONE THAT DOES NOT. C packs two digits into one symbol character, so a
 * 20-digit serial is 10 characters instead of 20 — the printed symbol is
 * literally half as wide. Encoders that only ever use B produce barcodes that
 * overflow the label stock, and the operator's fix is to shrink the module width
 * until it stops scanning.
 *
 * ★★ The switch thresholds are the ones the spec recommends and they are not
 * symmetric: four digits at the START are worth a Start C (the start character
 * is free), but mid-string a switch costs a character, so it takes six. Encoding
 * a two-digit run in C mid-string makes the symbol LONGER.
 */
export function svCode128Values(value: string): readonly number[] {
  const out: number[] = [];
  let i = 0;

  const leading = digitRun(value, 0);
  // An odd leading run cannot be fully paired, so the last digit falls to B.
  //
  // ★★★ FOUR AT THE START — OR EXACTLY TWO IN TOTAL, WHICH IS A SEPARATE RULE
  //     AND NOT AN OFF-BY-ONE. The spec's start-character rule is "4 or more
  //     leading digits", because below that a Start C buys nothing: "123X"
  //     costs 4 characters either way. The one exception is a value that IS two
  //     digits and nothing else — "42" is Start C plus one character, against
  //     Start B plus two — and it is the exception because there is no switch
  //     back to pay for. Found by a mutation: lowering the threshold to 2
  //     wholesale survived every test, because at 3 leading digits the two
  //     encodings are the same LENGTH and no test compared the values.
  let inC = leading >= 4 || (leading === 2 && value.length === 2);
  out.push(inC ? CODE128_START_C : CODE128_START_B);

  while (i < value.length) {
    if (inC) {
      const run = digitRun(value, i);
      if (run >= 2) {
        out.push(Number(value.slice(i, i + 2)));
        i += 2;
        continue;
      }
      out.push(CODE128_SHIFT_B);
      inC = false;
      continue;
    }

    const run = digitRun(value, i);
    // Six mid-string, or a run that reaches the end and pairs exactly — the
    // latter because there is no switch back to pay for.
    if (run >= 6 || (run >= 4 && i + run === value.length && run % 2 === 0)) {
      out.push(CODE128_SHIFT_C);
      inC = true;
      continue;
    }

    out.push(value.charCodeAt(i) - 32);
    i++;
  }
  return out;
}

/**
 * The mod-103 check character.
 *
 * ★★★ WEIGHTED BY POSITION, AND THE START CHARACTER HAS WEIGHT ONE. Sum the
 * start value plus each data value multiplied by its 1-based position, mod 103.
 * The commonest wrong implementation weights from zero, which produces a valid
 * Code 128 symbol encoding the right characters with a check the scanner
 * rejects — so the label prints, looks perfect, and reads as nothing.
 */
export function svCode128Check(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  return sum % 103;
}

// ── EAN ─────────────────────────────────────────────────────────────────────

const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];

/**
 * Which of the first six digits use the G table, per the leading digit.
 *
 * ★★★ THIRTEEN DIGITS IN TWELVE DIGITS' WORTH OF BARS. An EAN-13 symbol only
 * draws twelve digits; the FIRST one is encoded in the parity pattern of the
 * left half — L or G per position. Miss this and you have printed a valid
 * EAN-13 for a different leading digit, which is a different country prefix and
 * a different product. It is also why an EAN-13 cannot simply be "the digits,
 * striped".
 */
const EAN13_PARITY: readonly string[] = [
  'LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL',
];

/**
 * GTIN mod-10 check digit, over a payload that does NOT include the check.
 *
 * ★★★ THE WEIGHTS RUN FROM THE RIGHT, NOT FROM THE LEFT. The rightmost payload
 * digit takes weight 3, then 1, alternating leftwards. Anchoring at the left
 * instead happens to be correct for EAN-13 (payload 12, even) and WRONG for
 * EAN-8 (payload 7, odd) — so the bug ships, passes every EAN-13 test anyone
 * writes, and corrupts every short code.
 */
export function svGtinCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = payload.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += Number(payload[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Why this value cannot be encoded, or null when it can.
 *
 * ★★ REFUSING IS THE FEATURE. A component that renders SOMETHING for every input
 * ships an unscannable label to a warehouse; one that says "EAN-13 needs 12 or
 * 13 digits, this has 11" gets fixed before it is printed.
 */
export function svValidate(value: string, symbology: BarcodeSymbology): string | null {
  if (value.length === 0) return 'Nothing to encode.';

  if (symbology === 'code128') {
    for (let i = 0; i < value.length; i++) {
      if (!inSubsetB(value.charCodeAt(i))) {
        return `Code 128 here covers printable ASCII only; “${value[i]}” at position ${i + 1} is outside it.`;
      }
    }
    return null;
  }

  const want = symbology === 'ean13' ? 12 : 7;
  if (!/^\d+$/.test(value)) return `${symbology === 'ean13' ? 'EAN-13' : 'EAN-8'} is digits only.`;
  if (value.length === want) return null;
  if (value.length === want + 1) {
    const expected = svGtinCheckDigit(value.slice(0, want));
    return Number(value[want]) === expected
      ? null
      : `The check digit is wrong: ${value} ends in ${value[want]}, but ${value.slice(0, want)} checks to ${expected}. A scanner would read this as a different article number, or as nothing.`;
  }
  return `${symbology === 'ean13' ? 'EAN-13' : 'EAN-8'} needs ${want} digits (or ${want + 1} including the check digit); this has ${value.length}.`;
}

// ── Encoding to modules ─────────────────────────────────────────────────────

export interface SvEncoded {
  /** Bars and spaces, left to right, excluding the quiet zones. */
  readonly modules: readonly BarcodeModule[];
  /** Total width of the symbol in modules, excluding the quiet zones. */
  readonly moduleCount: number;
  readonly quietLeft: number;
  readonly quietRight: number;
  /** The digits or characters a human should read under the bars. */
  readonly text: string;
  /** The check character/digit this encoder computed, for the inspect view. */
  readonly check: number | null;
  readonly symbology: BarcodeSymbology;
  /** Non-null when the value could not be encoded; `modules` is then empty. */
  readonly error: string | null;
}

/** Turn a `1`/`0` string into runs, tracking the running offset. */
function runsOf(bits: string, at: number, out: BarcodeModule[]): number {
  let i = 0;
  while (i < bits.length) {
    const bit = bits[i];
    let n = 1;
    while (i + n < bits.length && bits[i + n] === bit) n++;
    out.push({ at: at + i, width: n, bar: bit === '1' });
    i += n;
  }
  return at + bits.length;
}

function encodeCode128(value: string): SvEncoded {
  const values = svCode128Values(value);
  const check = svCode128Check(values);
  const all = [...values, check, CODE128_STOP];

  const out: BarcodeModule[] = [];
  let at = 0;
  for (const v of all) {
    const pattern = CODE128_PATTERNS[v];
    // Patterns alternate bar, space, bar, … starting with a bar.
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      out.push({ at, width, bar: i % 2 === 0 });
      at += width;
    }
  }
  // ★★ NO EXTRA TRAILING BAR HERE. The stop character's pattern is already
  //    SEVEN runs — `2331112`, thirteen modules — where every other pattern is
  //    six runs of eleven, and that seventh run IS the terminating bar. Appending
  //    another one produced two adjacent bars, which a scanner reads as a single
  //    wider bar and therefore as a different stop pattern. Found by a spec that
  //    asserts the symbol alternates bar and space throughout; it is invisible
  //    to the eye, because two adjacent black bars look like one black bar.
  return {
    modules: out, moduleCount: at,
    quietLeft: SV_QUIET_CODE128, quietRight: SV_QUIET_CODE128,
    text: value, check, symbology: 'code128', error: null,
  };
}

function encodeEan(value: string, symbology: 'ean13' | 'ean8'): SvEncoded {
  const want = symbology === 'ean13' ? 12 : 7;
  const payload = value.slice(0, want);
  const check = svGtinCheckDigit(payload);
  const digits = `${payload}${check}`;

  let bits = '101'; // left guard
  if (symbology === 'ean13') {
    const parity = EAN13_PARITY[Number(digits[0])];
    for (let i = 1; i <= 6; i++) {
      const d = Number(digits[i]);
      bits += parity[i - 1] === 'L' ? EAN_L[d] : EAN_G[d];
    }
    bits += '01010'; // centre guard
    for (let i = 7; i <= 12; i++) bits += EAN_R[Number(digits[i])];
  } else {
    for (let i = 0; i < 4; i++) bits += EAN_L[Number(digits[i])];
    bits += '01010';
    for (let i = 4; i < 8; i++) bits += EAN_R[Number(digits[i])];
  }
  bits += '101'; // right guard

  const out: BarcodeModule[] = [];
  const total = runsOf(bits, 0, out);

  return {
    modules: out, moduleCount: total,
    quietLeft: SV_QUIET_EAN_LEFT, quietRight: SV_QUIET_EAN_RIGHT,
    text: digits, check, symbology, error: null,
  };
}

/** Encode a value, or report why it cannot be encoded. */
export function svEncode(value: string, symbology: BarcodeSymbology): SvEncoded {
  const error = svValidate(value, symbology);
  if (error) {
    return {
      modules: [], moduleCount: 0,
      quietLeft: symbology === 'code128' ? SV_QUIET_CODE128 : SV_QUIET_EAN_LEFT,
      quietRight: symbology === 'code128' ? SV_QUIET_CODE128 : SV_QUIET_EAN_RIGHT,
      text: value, check: null, symbology, error,
    };
  }
  return symbology === 'code128' ? encodeCode128(value) : encodeEan(value, symbology);
}

// ── Rendering geometry ──────────────────────────────────────────────────────

/**
 * Snap the module width to whole device pixels.
 *
 * ★★★ A SUB-PIXEL MODULE IS AN UNSCANNABLE BARCODE, AND IT LOOKS FINE. At 1.7px
 * per module the browser antialiases every edge, and neighbouring bars end up a
 * pixel wider or narrower than each other essentially at random. A scanner
 * measures RATIOS between runs, so that jitter is read as different run lengths
 * — and the symbol either fails or, on Code 128, decodes to something else.
 * Snapping to whole device pixels costs a little width and buys a symbol that
 * reads.
 */
export function svSnapModuleWidth(desired: number, devicePixelRatio = 1): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const devicePixels = Math.max(1, Math.round(desired * dpr));
  return devicePixels / dpr;
}

/** Full drawn width, in px, including both quiet zones. */
export function svBarcodeWidth(encoded: SvEncoded, moduleWidth: number): number {
  return (encoded.quietLeft + encoded.moduleCount + encoded.quietRight) * moduleWidth;
}

/**
 * EAN guard bars run below the digit row; the rest stop at the text.
 *
 * ★★ NOT A STYLISTIC FLOURISH. The extended guards are how a human — and a
 * badly-aimed scanner — sees where the symbol begins, ends and splits. An EAN
 * drawn with every bar the same height is a symbol that still scans and that no
 * operator recognises.
 */
export function svIsGuardModule(encoded: SvEncoded, m: BarcodeModule): boolean {
  if (encoded.symbology === 'code128') return false;
  const end = encoded.moduleCount;
  const centre = encoded.symbology === 'ean13' ? 45 : 31;
  return (
    (m.at < 3) ||
    (m.at >= end - 3) ||
    (m.at >= centre && m.at < centre + 5)
  );
}

/** `EAN-13 · 5901234123457 · check digit 7` */
export function svEncodingLabel(encoded: SvEncoded): string {
  const name = encoded.symbology === 'code128' ? 'Code 128' : encoded.symbology === 'ean13' ? 'EAN-13' : 'EAN-8';
  if (encoded.error) return `${name} · cannot encode`;
  return `${name} · ${encoded.text}${encoded.check === null ? '' : ` · check ${encoded.check}`}`;
}

/** How many symbol characters the encoder used, and how many it saved with subset C. */
export function svCode128Savings(value: string): { characters: number; ifSubsetBOnly: number } {
  return { characters: svCode128Values(value).length, ifSubsetBOnly: value.length + 1 };
}
