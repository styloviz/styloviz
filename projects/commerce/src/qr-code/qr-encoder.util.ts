/**
 * Minimal QR Code encoder — returns a boolean matrix (true = dark module).
 *
 * Supports error-correction levels L, M, Q, H.
 * Byte encoding mode (UTF-8). Versions 1–10.
 * Based on ISO/IEC 18004:2015.
 *
 * No external dependencies.
 */

// ─── GF(256) arithmetic ───────────────────────────────────────────────────────

const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);

(function initGalois(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  // ★ Unreachable with the callers this file has, and the two branches this
  // file does not cover: `gfPolyMul` only ever multiplies generator
  // coefficients, which are non-zero by construction, and `gfRemainder` guards
  // its own `coef !== 0` before calling in. Removed, a future caller that did
  // pass 0 would index `LOG[0]`, which is undefined, and silently poison the
  // whole error-correction block. Kept deliberately.
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

function gfPoly(degree: number): number[] {
  let p = [1];
  for (let i = 0; i < degree; i++) {
    const q = [1, EXP[i]];
    const r = new Array(p.length + q.length - 1).fill(0);
    for (let j = 0; j < p.length; j++)
      for (let k = 0; k < q.length; k++)
        r[j + k] ^= gfMul(p[j], q[k]);
    p = r;
  }
  return p;
}

/**
 * Reed-Solomon remainder.
 * FIX: pad data with ecCodewordsPerBlock zeros before division so the
 *      polynomial long-division has room to accumulate the remainder.
 */
function gfRemainder(data: number[], gen: number[]): number[] {
  const out = [...data, ...new Array(gen.length - 1).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = out[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        out[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return out.slice(data.length);
}

// ─── QR version capacity tables (version 1–10, L/M/Q/H) ─────────────────────
// blocks format: [count1, dcLen1, count2, dcLen2, ...]

type ECLevel = 'L' | 'M' | 'Q' | 'H';

interface VersionInfo {
  totalCodewords: number;
  ec: Record<ECLevel, { ecCodewordsPerBlock: number; blocks: number[] }>;
}

const VERSION_INFO: VersionInfo[] = [
  { totalCodewords: 26,  ec: { L:{ecCodewordsPerBlock:7,  blocks:[1,19]}, M:{ecCodewordsPerBlock:10, blocks:[1,16]}, Q:{ecCodewordsPerBlock:13, blocks:[1,13]}, H:{ecCodewordsPerBlock:17, blocks:[1,9]}  }},
  { totalCodewords: 44,  ec: { L:{ecCodewordsPerBlock:10, blocks:[1,34]}, M:{ecCodewordsPerBlock:16, blocks:[1,28]}, Q:{ecCodewordsPerBlock:22, blocks:[1,22]}, H:{ecCodewordsPerBlock:28, blocks:[1,16]} }},
  { totalCodewords: 70,  ec: { L:{ecCodewordsPerBlock:15, blocks:[1,55]}, M:{ecCodewordsPerBlock:26, blocks:[1,44]}, Q:{ecCodewordsPerBlock:18, blocks:[2,17]}, H:{ecCodewordsPerBlock:22, blocks:[2,13]} }},
  { totalCodewords: 100, ec: { L:{ecCodewordsPerBlock:20, blocks:[1,80]}, M:{ecCodewordsPerBlock:18, blocks:[2,32]}, Q:{ecCodewordsPerBlock:26, blocks:[2,24]}, H:{ecCodewordsPerBlock:16, blocks:[4,9]}  }},
  { totalCodewords: 134, ec: { L:{ecCodewordsPerBlock:26, blocks:[1,108]}, M:{ecCodewordsPerBlock:24, blocks:[2,43]}, Q:{ecCodewordsPerBlock:18, blocks:[2,15,2,16]}, H:{ecCodewordsPerBlock:22, blocks:[2,11,2,12]} }},
  { totalCodewords: 172, ec: { L:{ecCodewordsPerBlock:18, blocks:[2,68]},  M:{ecCodewordsPerBlock:16, blocks:[4,27]}, Q:{ecCodewordsPerBlock:24, blocks:[4,19]},          H:{ecCodewordsPerBlock:28, blocks:[4,15]} }},
  { totalCodewords: 196, ec: { L:{ecCodewordsPerBlock:20, blocks:[2,78]},  M:{ecCodewordsPerBlock:18, blocks:[4,31]}, Q:{ecCodewordsPerBlock:18, blocks:[2,14,4,15]},     H:{ecCodewordsPerBlock:26, blocks:[4,13,1,14]} }},
  { totalCodewords: 242, ec: { L:{ecCodewordsPerBlock:24, blocks:[2,97]},  M:{ecCodewordsPerBlock:22, blocks:[2,38,2,39]}, Q:{ecCodewordsPerBlock:22, blocks:[4,18,2,19]}, H:{ecCodewordsPerBlock:26, blocks:[4,14,2,15]} }},
  { totalCodewords: 292, ec: { L:{ecCodewordsPerBlock:30, blocks:[2,116]}, M:{ecCodewordsPerBlock:22, blocks:[3,36,2,37]}, Q:{ecCodewordsPerBlock:20, blocks:[4,16,4,17]}, H:{ecCodewordsPerBlock:24, blocks:[4,12,4,13]} }},
  { totalCodewords: 346, ec: { L:{ecCodewordsPerBlock:18, blocks:[2,68,2,69]}, M:{ecCodewordsPerBlock:26, blocks:[4,43,1,44]}, Q:{ecCodewordsPerBlock:24, blocks:[6,19,2,20]}, H:{ecCodewordsPerBlock:28, blocks:[6,15,2,16]} }},
];

// ─── Bit stream helper ────────────────────────────────────────────────────────

class BitStream {
  private data: number[] = [];
  private bitLen = 0;

  push(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      const byteIdx = this.bitLen >> 3;
      if (byteIdx >= this.data.length) this.data.push(0);
      this.data[byteIdx] |= ((value >> i) & 1) << (7 - (this.bitLen & 7));
      this.bitLen++;
    }
  }

  bytes(): number[] { return [...this.data]; }
}

// ─── Helper: data codeword capacity ──────────────────────────────────────────

/**
 * FIX: the old inline formula was:
 *   `blocks.reduce((s,b,i) => i%2===0 ? s + b*ecCW : s + b, 0)`
 * which added dcLen values to the EC count, collapsing dataCapacity to 0.
 * Correct: only even-indexed entries are block counts; sum(count × ecCW).
 */
function dataCapacityFor(version: number, ecLevel: ECLevel): number {
  const ecInfo = VERSION_INFO[version - 1].ec[ecLevel];
  let totalEc = 0;
  for (let i = 0; i < ecInfo.blocks.length; i += 2) {
    totalEc += ecInfo.blocks[i] * ecInfo.ecCodewordsPerBlock;
  }
  return VERSION_INFO[version - 1].totalCodewords - totalEc;
}

// ─── Encode data ─────────────────────────────────────────────────────────────

function encodeBytes(text: string, version: number, ecLevel: ECLevel): number[] {
  const utf8     = new TextEncoder().encode(text);
  const capacity = dataCapacityFor(version, ecLevel);

  const bs = new BitStream();
  bs.push(0b0100, 4);
  bs.push(utf8.length, version < 10 ? 8 : 16);
  for (const byte of utf8) bs.push(byte, 8);
  bs.push(0, 4);

  const bytes = bs.bytes();
  while (bytes.length < capacity) {
    bytes.push(0xec);
    if (bytes.length < capacity) bytes.push(0x11);
  }
  return bytes.slice(0, capacity);
}

function addECC(data: number[], version: number, ecLevel: ECLevel): number[] {
  const ecInfo = VERSION_INFO[version - 1].ec[ecLevel];
  const gen    = gfPoly(ecInfo.ecCodewordsPerBlock);
  const blocks = ecInfo.blocks;

  const dataBlocks: number[][] = [];
  const ecBlocks:   number[][] = [];
  let offset = 0;

  for (let i = 0; i < blocks.length; i += 2) {
    const count = blocks[i];
    const dcLen = blocks[i + 1];
    for (let j = 0; j < count; j++) {
      const block = data.slice(offset, offset + dcLen);
      offset += dcLen;
      dataBlocks.push(block);
      ecBlocks.push(gfRemainder(block, gen));
    }
  }

  const out: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++)
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecInfo.ecCodewordsPerBlock; i++)
    for (const b of ecBlocks) out.push(b[i]);
  return out;
}

// ─── QR matrix builder ───────────────────────────────────────────────────────

const FORMAT_INFO: Record<ECLevel, number[]> = {
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
};

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r, _) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * Build an empty QR matrix with all function modules placed.
 *
 * FIX: also reserves format-information areas as non-null (false) BEFORE
 *      placeData() runs, so data bits are never written into those cells.
 *      Previously these cells were null and placeData() consumed real data
 *      bits for them, shifting every subsequent bit one position off.
 */
function buildMatrix(version: number): { matrix: (boolean | null)[][]; size: number } {
  const size   = version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));

  // Finder patterns + separators
  for (const [fr, fc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = fr + r, mc = fc + c;
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const onRing  = r === 0 || r === 6 || c === 0 || c === 6;
        matrix[mr][mc] = inOuter && (onRing || inInner);
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[size - 8][8] = true;

  // Reserve format-information areas (set to false so placeData skips them)
  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;   // row 8, cols 0-8
    if (matrix[i][8] === null) matrix[i][8] = false;   // col 8, rows 0-8
  }
  for (let i = size - 7; i < size; i++) {
    if (matrix[i][8] === null) matrix[i][8] = false;   // col 8, bottom
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;   // row 8, top-right
  }

  return { matrix, size };
}

function placeAlignmentPatterns(matrix: (boolean | null)[][], version: number): void {
  if (version < 2) return;
  const ALIGN: Record<number, number[]> = {
    2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34],
    7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50],
  };
  // ★ The `?? []` arms are unreachable — `version < 2` returned above and the
  // table covers 2–10, which is the whole range this encoder produces. They are
  // equivalent mutants and two of the branches this file does not cover.
  for (const r of (ALIGN[version] ?? [])) {
    for (const c of (ALIGN[version] ?? [])) {
      if (matrix[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const onEdge = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          matrix[r + dr][c + dc] = onEdge || (dr === 0 && dc === 0);
        }
    }
  }
}

/**
 * Place the 15-bit format-information word into both copies in the matrix.
 *
 * Per ISO/IEC 18004 §8.9, bits are placed MSB-first — bit 14 is the most
 * significant and lands at the start of each strip.
 *
 * First copy — around top-left finder:
 *   bit 14 → (8, 0)
 *   bit 13 → (8, 1)
 *   bit 12 → (8, 2)
 *   bit 11 → (8, 3)
 *   bit 10 → (8, 4)
 *   bit  9 → (8, 5)
 *   bit  8 → (8, 7)   (skip col 6 = vertical timing)
 *   bit  7 → (8, 8)
 *   bit  6 → (7, 8)   (skip row 6 = horizontal timing)
 *   bit  5 → (5, 8)
 *   bit  4 → (4, 8)
 *   bit  3 → (3, 8)
 *   bit  2 → (2, 8)
 *   bit  1 → (1, 8)
 *   bit  0 → (0, 8)
 *
 * Second copy — bottom-left (col 8) then top-right (row 8):
 *   bit 14 → (size-1, 8)
 *   bit 13 → (size-2, 8)
 *   bit 12 → (size-3, 8)
 *   bit 11 → (size-4, 8)
 *   bit 10 → (size-5, 8)
 *   bit  9 → (size-6, 8)
 *   bit  8 → (size-7, 8)
 *   bit  7 → (8, size-8)
 *   bit  6 → (8, size-7)
 *   bit  5 → (8, size-6)
 *   bit  4 → (8, size-5)
 *   bit  3 → (8, size-4)
 *   bit  2 → (8, size-3)
 *   bit  1 → (8, size-2)
 *   bit  0 → (8, size-1)
 */
function placeFormatInfo(matrix: (boolean | null)[][], formatWord: number, size: number): void {
  const bit = (i: number): boolean => ((formatWord >> i) & 1) === 1;

  // ── First copy ───────────────────────────────────────────────────────────
  // Horizontal strip — row 8: cols 0..5 hold bits 14..9
  for (let i = 0; i <= 5; i++) matrix[8][i] = bit(14 - i);
  matrix[8][7] = bit(8);   // skip col 6 timing
  matrix[8][8] = bit(7);   // corner

  // Vertical strip — col 8: row 7 holds bit 6, rows 5..0 hold bits 5..0
  matrix[7][8] = bit(6);
  for (let i = 0; i <= 5; i++) matrix[5 - i][8] = bit(5 - i);

  // ── Second copy ──────────────────────────────────────────────────────────
  // Vertical strip — col 8: rows size-1..size-7 hold bits 14..8
  for (let i = 0; i <= 6; i++) matrix[size - 1 - i][8] = bit(14 - i);
  // Horizontal strip — row 8: cols size-8..size-1 hold bits 7..0
  for (let i = 0; i <= 7; i++) matrix[8][size - 8 + i] = bit(7 - i);

  // Dark module — always dark.
  matrix[size - 8][8] = true;
}

function placeData(matrix: (boolean | null)[][], codewords: number[], size: number): void {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let col = size - 1, goingUp = true;

  while (col >= 0) {
    if (col === 6) col--;
    const cols = [col, col - 1];
    for (let r = 0; r < size; r++) {
      const row = goingUp ? size - 1 - r : r;
      for (const c of cols) {
        if (c < 0 || matrix[row][c] !== null) continue;
        matrix[row][c] = bitIdx < totalBits
          ? ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
          : false;
        bitIdx++;
      }
    }
    goingUp = !goingUp;
    col -= 2;
  }
}

/**
 * Apply a mask to the matrix.
 *
 * Per ISO/IEC 18004 §8.8, the mask is applied ONLY to data / EC modules —
 * NEVER to function modules (finder patterns, separators, timing patterns,
 * alignment patterns, format-info reservations, dark module).
 *
 * `isFunction[r][c] === true` marks every cell that belongs to a function
 * module; those cells pass through unchanged.
 */
function applyMask(
  matrix:     (boolean | null)[][],
  isFunction: boolean[][],
  maskFn:     (r: number, c: number) => boolean,
): boolean[][] {
  return matrix.map((row, r) =>
    row.map((cell, c) => {
      if (cell === null) return false;
      if (isFunction[r][c]) return cell;          // never mask function modules
      return maskFn(r, c) ? !cell : cell;
    }),
  );
}

function penalty(matrix: boolean[][], size: number): number {
  let score = 0;
  for (let r = 0; r < size; r++) {
    let hr = 1, vr = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) { hr++; if (hr === 5) score += 3; else if (hr > 5) score++; } else hr = 1;
      if (matrix[c][r] === matrix[c - 1][r]) { vr++; if (vr === 5) score += 3; else if (vr > 5) score++; } else vr = 1;
    }
  }
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (matrix[r][c] === matrix[r][c+1] && matrix[r][c] === matrix[r+1][c] && matrix[r][c] === matrix[r+1][c+1])
        score += 3;
  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encode `text` into a QR code boolean matrix.
 * Returns a 2D array where `true` = dark module.
 */
/** The largest version this encoder implements. */
export const SV_QR_MAX_VERSION = 10;

/**
 * How many UTF-8 bytes fit at a correction level, at the largest version here.
 *
 * ★★★ THE PAYLOAD CAP IS THE MOST DANGEROUS THING ABOUT A QR ENCODER, because
 *     exceeding it does not fail — `encodeBytes` slices the byte array to
 *     capacity, so an over-long payload produces a code that **scans perfectly
 *     and yields the wrong data**. A truncated URL is still a URL. Valid-looking
 *     output that is silently wrong is worse than an error, and it is the same
 *     class of failure as a chart clamping a negative.
 *
 * ★ Higher correction means MORE redundancy and therefore LESS room: `H` holds
 *   roughly half what `L` does. That is the trade a host is making when it
 *   raises the level to survive a logo, and it is worth stating because it runs
 *   the opposite way to intuition.
 */
export function svQrCapacityBytes(ecLevel: ECLevel = 'M'): number {
  // 4 bits of mode indicator + 16 bits of length at these versions.
  const overheadBits = 4 + 16;
  const bits = dataCapacityFor(SV_QR_MAX_VERSION, ecLevel) * 8 - overheadBits;
  return Math.max(0, Math.floor(bits / 8));
}

/** How many UTF-8 bytes a payload actually needs. */
export function svQrPayloadBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** True when the payload will NOT fit and must be refused rather than cut. */
export function svQrOverCapacity(text: string, ecLevel: ECLevel = 'M'): boolean {
  return svQrPayloadBytes(text) > svQrCapacityBytes(ecLevel);
}

export function encodeQR(text: string, ecLevel: ECLevel = 'M'): boolean[][] {
  if (!text) return [[false]];

  // Find the smallest version whose data capacity fits the payload.
  // FIX: old formula computed dcLen = 0 for all versions, forcing version 10.
  const utf8Len = new TextEncoder().encode(text).length;
  let version = 10;
  for (let v = 1; v <= 10; v++) {
    if (Math.ceil((4 + 8 + utf8Len * 8) / 8) <= dataCapacityFor(v, ecLevel)) {
      version = v;
      break;
    }
  }

  const size = version * 4 + 17;

  // 1. Lay down all function modules (finders, separators, timing, alignment,
  //    format-info reservations, dark module) — no data yet.
  const { matrix } = buildMatrix(version);
  placeAlignmentPatterns(matrix, version);

  // Snapshot which cells belong to function modules. Anything that is
  // already non-null at this point is a function cell and must NOT be masked.
  const isFunction: boolean[][] = matrix.map(row => row.map(cell => cell !== null));

  // 2. Place the data + EC codewords into the remaining null cells.
  placeData(matrix, addECC(encodeBytes(text, version, ecLevel), version, ecLevel), size);

  // 3. Choose the mask pattern with the lowest penalty score.
  let bestMask = 0, bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    const p = penalty(applyMask(matrix, isFunction, MASKS[m]), size);
    if (p < bestPenalty) { bestPenalty = p; bestMask = m; }
  }

  // 4. Apply the winning mask and overlay the format-info bits.
  const finalMatrix = applyMask(matrix, isFunction, MASKS[bestMask]).map(r => [...r]) as (boolean | null)[][];
  placeFormatInfo(finalMatrix, FORMAT_INFO[ecLevel][bestMask], size);

  return finalMatrix.map(r => r.map(c => c ?? false));
}
