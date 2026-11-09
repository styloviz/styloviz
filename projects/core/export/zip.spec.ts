import { createZipBlob } from './zip';

/**
 * A ZIP is a binary format with three cross-referencing structures, and the
 * failure mode is not an exception — it is a file that downloads happily and
 * then will not open. So these tests read the bytes back and check the parts an
 * extractor checks: the four magic signatures, the CRC-32 of each payload, and
 * the offsets the central directory uses to find the local headers.
 *
 * jsdom has no `Blob.text()` and no `Blob.arrayBuffer()` that returns the real
 * bytes reliably, so everything goes through `FileReader`.
 */

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Reference CRC-32 (IEEE), computed a different way than the module under test. */
function crc32Reference(input: string): number {
  const bytes = new TextEncoder().encode(input);
  let crc = ~0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      // Bit-at-a-time, no lookup table — an independent implementation, so a
      // table built with the wrong polynomial cannot agree with it by accident.
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

const u32 = (b: Uint8Array, at: number): number =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, true);
const u16 = (b: Uint8Array, at: number): number =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(at, true);

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const END_SIG = 0x06054b50;

describe('createZipBlob', () => {
  it('writes a local header, a central record and an end record for one file', async () => {
    const blob = createZipBlob([{ name: 'README.md', content: 'hello' }]);
    expect(blob.type).toBe('application/zip');
    const b = await readBytes(blob);

    expect(u32(b, 0)).toBe(LOCAL_SIG);

    const nameLen = u16(b, 26);
    expect(nameLen).toBe('README.md'.length);
    const local = 30 + nameLen + 'hello'.length;
    expect(u32(b, local)).toBe(CENTRAL_SIG);

    const end = b.length - 22;
    expect(u32(b, end)).toBe(END_SIG);
    expect(u16(b, end + 8)).toBe(1); // entries on this disk
    expect(u16(b, end + 10)).toBe(1); // total entries
    expect(u32(b, end + 16)).toBe(local); // central directory starts here
  });

  it('stores the payload uncompressed and records its CRC-32', async () => {
    const content = 'The quick brown fox jumps over the lazy dog';
    const b = await readBytes(createZipBlob([{ name: 'a.txt', content }]));

    expect(u16(b, 8)).toBe(0); // method 0 = store
    expect(u32(b, 14)).toBe(crc32Reference(content));
    expect(u32(b, 18)).toBe(content.length); // compressed size
    expect(u32(b, 22)).toBe(content.length); // uncompressed size

    const payload = b.slice(30 + 'a.txt'.length, 30 + 'a.txt'.length + content.length);
    expect(new TextDecoder().decode(payload)).toBe(content);
  });

  it('encodes names and content as UTF-8, sizing the header in bytes not characters', async () => {
    // 'é' is two bytes. A header sized in characters produces an archive whose
    // local header lies about its own length, and every later offset is wrong.
    const name = 'café.txt';
    const content = 'naïve';
    const b = await readBytes(createZipBlob([{ name, content }]));

    const nameBytes = new TextEncoder().encode(name);
    const contentBytes = new TextEncoder().encode(content);
    expect(nameBytes.length).toBe(name.length + 1);
    expect(u16(b, 26)).toBe(nameBytes.length);
    expect(u32(b, 18)).toBe(contentBytes.length);
    expect(u32(b, 30 + nameBytes.length + contentBytes.length)).toBe(CENTRAL_SIG);
  });

  it('points each central record at the offset of its own local header', async () => {
    const entries = [
      { name: 'a.txt', content: 'aaaa' },
      { name: 'b.txt', content: 'bb' },
    ];
    const b = await readBytes(createZipBlob(entries));

    const firstLocal = 30 + 5 + 4;
    const secondLocal = firstLocal + 30 + 5 + 2;
    expect(u32(b, firstLocal)).toBe(LOCAL_SIG); // second file's local header
    expect(u32(b, secondLocal)).toBe(CENTRAL_SIG); // central directory begins

    // Central record #1 → offset 0, central record #2 → offset of file 2.
    expect(u32(b, secondLocal + 42)).toBe(0);
    const secondCentral = secondLocal + 46 + 5;
    expect(u32(b, secondCentral)).toBe(CENTRAL_SIG);
    expect(u32(b, secondCentral + 42)).toBe(firstLocal);
  });

  it('produces a valid empty archive — 22 bytes, no entries', async () => {
    // The boundary an extractor still has to accept. Anything that assumed at
    // least one entry would write a central directory offset past the end.
    const b = await readBytes(createZipBlob([]));
    expect(b.length).toBe(22);
    expect(u32(b, 0)).toBe(END_SIG);
    expect(u16(b, 10)).toBe(0);
    expect(u32(b, 12)).toBe(0); // central directory size
    expect(u32(b, 16)).toBe(0); // central directory offset
  });

  it('handles an empty file inside a non-empty archive', async () => {
    const b = await readBytes(createZipBlob([{ name: 'empty', content: '' }]));
    expect(u32(b, 18)).toBe(0);
    expect(u32(b, 14)).toBe(crc32Reference('')); // CRC of nothing is 0
    expect(u32(b, 30 + 'empty'.length)).toBe(CENTRAL_SIG);
  });

  it('writes a DOS date no earlier than the format allows', async () => {
    // The DOS date epoch is 1980; a year below it would wrap and produce a file
    // dated in the future. `Math.max(1980, …)` is the guard, and the packed
    // fields must stay inside their bit widths either way.
    const b = await readBytes(createZipBlob([{ name: 'x', content: 'x' }]));
    const date = u16(b, 12);
    const year = 1980 + ((date >> 9) & 0x7f);
    const month = (date >> 5) & 0x0f;
    const day = date & 0x1f;
    expect(year).toBeGreaterThanOrEqual(1980);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    // Local and central records must agree, or extractors disagree about mtime.
    const centralAt = 30 + 'x'.length + 'x'.length; // local header + name + payload
    expect(u16(b, centralAt + 14)).toBe(date);
  });
});
