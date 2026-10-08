/**
 * Minimal, dependency-free ZIP writer.
 *
 * Produces a valid `.zip` Blob using the STORE method (no compression), which
 * is enough for shipping a small bundle of text files entirely client-side —
 * no backend, no external library, no network call. Every standard archive
 * tool (Explorer, Finder, `unzip`) opens the result.
 *
 * Only text entries are supported (encoded as UTF-8), which is all the demo
 * template download needs.
 */

/** A single file to place inside the archive. */
export interface ZipEntry {
  /** Path within the archive, e.g. `README.md` or `docs/SETUP.md`. */
  readonly name: string;
  /** UTF-8 text content of the file. */
  readonly content: string;
}

/** Precomputed CRC-32 lookup table (IEEE polynomial). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Packs a JS Date into DOS date/time words used by the ZIP format. */
function dosDateTime(d: Date): { readonly date: number; readonly time: number } {
  const year = Math.max(1980, d.getFullYear());
  const date = (((year - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date: date & 0xffff, time: time & 0xffff };
}

/**
 * Builds a `.zip` archive from the given text entries and returns it as a Blob
 * ready to be handed to an object URL for download.
 */
export function createZipBlob(entries: readonly ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const { date, time } = dosDateTime(new Date());

  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const size = data.length;

    // ── Local file header (30 bytes + name) ──
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed to extract
    lv.setUint16(6, 0, true); // general purpose flags
    lv.setUint16(8, 0, true); // compression method: 0 = store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra field length
    local.set(nameBytes, 30);
    localChunks.push(local, data);

    // ── Central directory record (46 bytes + name) ──
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0, true); // external attributes
    cv.setUint32(42, offset, true); // relative offset of local header
    central.set(nameBytes, 46);
    centralChunks.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centralChunks.reduce((n, c) => n + c.length, 0);
  const centralOffset = offset;

  // ── End of central directory record (22 bytes) ──
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // signature
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // disk with central dir
  ev.setUint16(8, entries.length, true); // entries on this disk
  ev.setUint16(10, entries.length, true); // total entries
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true); // comment length

  // Concatenate everything into a single ArrayBuffer-backed array so it is a
  // valid, strictly-typed `BlobPart`.
  const parts: Uint8Array[] = [...localChunks, ...centralChunks, end];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }

  return new Blob([out], { type: 'application/zip' });
}
