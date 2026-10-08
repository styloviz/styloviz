/**
 * Whether a code that renders will actually scan.
 *
 * ★★★ A QR CODE IS THE ONLY COMPONENT IN THE KIT WHOSE OUTPUT IS READ BY A
 *     MACHINE. A human glancing at a pale-grey-on-white code with a big logo
 *     sees a QR code; a scanner sees nothing. Every check here exists because
 *     the component will happily render something unscannable and say nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  SV_QR_MIN_CONTRAST,
  SV_QR_MIN_QUIET_ZONE,
  SV_QR_RECOVERY,
  svParseHex,
  svQrContrast,
  svQrScannability,
  type SvQrScanCheck,
} from './qr-scannability';

const sound: SvQrScanCheck = {
  foreground: '#000000',
  background: '#ffffff',
  quietZone: 4,
  ecLevel: 'M',
  logoSize: 0,
  size: 200,
  payloadBytes: 40,
  capacityBytes: 250,
};

const kinds = (c: Partial<SvQrScanCheck>): string[] =>
  svQrScannability({ ...sound, ...c }).map(w => w.kind);

describe('svParseHex', () => {
  it('reads both hex forms', () => {
    expect(svParseHex('#fff')).toEqual([255, 255, 255]);
    expect(svParseHex('#000000')).toEqual([0, 0, 0]);
    expect(svParseHex('3b82f6')).toEqual([59, 130, 246]);
  });

  it('refuses anything it cannot read, rather than guessing', () => {
    for (const bad of ['', 'red', 'rgb(0,0,0)', '#12', 'var(--x)']) {
      expect(svParseHex(bad)).toBeNull();
    }
  });
});

describe('svQrContrast', () => {
  it('measures black on white at the maximum', () => {
    expect(svQrContrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('is symmetric — a scanner does not care which is which', () => {
    expect(svQrContrast('#000', '#fff')).toBeCloseTo(svQrContrast('#fff', '#000')!, 9);
  });

  it('returns null rather than a number it cannot justify', () => {
    expect(svQrContrast('tomato', '#fff')).toBeNull();
  });
});

describe('svQrScannability — a code that is fine', () => {
  it('reports nothing wrong', () => {
    expect(svQrScannability(sound)).toEqual([]);
  });
});

describe('svQrScannability — the payload', () => {
  it('refuses one that will not fit', () => {
    // ★★★ Exceeding capacity does not fail: the encoder slices to capacity, so
    //     the code scans perfectly and yields the WRONG data. A truncated URL
    //     is still a URL.
    const [w] = svQrScannability({ ...sound, payloadBytes: 400, capacityBytes: 250 });
    expect(w.kind).toBe('capacity');
    expect(w.message).toContain('would be truncated');
    expect(w.message).toContain('nothing is drawn');
  });

  it('reports capacity FIRST, because it is the fatal one', () => {
    const out = svQrScannability({
      ...sound, payloadBytes: 400, capacityBytes: 250, quietZone: 0, foreground: '#eee',
    });
    expect(out[0].kind).toBe('capacity');
    expect(out.length).toBeGreaterThan(1);
  });

  it('accepts a payload exactly at capacity', () => {
    expect(kinds({ payloadBytes: 250, capacityBytes: 250 })).toEqual([]);
  });
});

describe('svQrScannability — contrast and polarity', () => {
  it('flags a pair a camera cannot separate', () => {
    const out = svQrScannability({ ...sound, foreground: '#bbbbbb' });
    expect(out.some(w => w.kind === 'contrast')).toBe(true);
    expect(out.find(w => w.kind === 'contrast')!.message).toContain('look fine and may not scan');
  });

  it('accepts a pair at the threshold', () => {
    // Anything clearing the bar passes, whatever the hue.
    const out = svQrScannability({ ...sound, foreground: '#1d4ed8', background: '#ffffff' });
    expect(out.some(w => w.kind === 'contrast')).toBe(false);
  });

  it('says so when it cannot check at all', () => {
    const out = svQrScannability({ ...sound, foreground: 'var(--brand)' });
    expect(out.find(w => w.kind === 'contrast')!.message).toContain('cannot be checked');
  });

  it('flags an inverted code SEPARATELY from contrast', () => {
    // ★ White on black has 21:1 contrast and still fails on many scanners,
    //   which assume dark on light. Folding it into the contrast check would
    //   hide it completely.
    const out = svQrScannability({ ...sound, foreground: '#ffffff', background: '#000000' });
    expect(out.map(w => w.kind)).toContain('inverted');
    expect(out.some(w => w.kind === 'contrast')).toBe(false);
  });

  it('does not call a normal code inverted', () => {
    expect(kinds({})).not.toContain('inverted');
  });
});

describe('svQrScannability — the quiet zone', () => {
  it('flags anything under the specified four modules', () => {
    for (const quietZone of [0, 1, 2, 3]) {
      expect(kinds({ quietZone })).toContain('quiet-zone');
    }
  });

  it('accepts four or more', () => {
    for (const quietZone of [4, 6, 10]) {
      expect(kinds({ quietZone })).not.toContain('quiet-zone');
    }
  });

  it('names the requirement rather than asserting a preference', () => {
    const out = svQrScannability({ ...sound, quietZone: 2 });
    expect(out.find(w => w.kind === 'quiet-zone')!.message)
      .toContain(`requires ${SV_QR_MIN_QUIET_ZONE}`);
  });
});

describe('svQrScannability — a logo against the correction budget', () => {
  it('accepts a logo inside the budget', () => {
    // 40px on 200px is 4% of the area; M recovers 15%.
    expect(kinds({ logoSize: 40, size: 200, ecLevel: 'M' })).not.toContain('logo');
  });

  it('flags one that eats more than the level can recover', () => {
    // 100px on 200px is 25% of the area; M recovers 15%.
    const out = svQrScannability({ ...sound, logoSize: 100, size: 200, ecLevel: 'M' });
    const w = out.find(x => x.kind === 'logo')!;
    expect(w.message).toContain('25%');
    expect(w.message).toContain('recover 15%');
  });

  it('lets a higher correction level carry a bigger logo', () => {
    // ★ The trade a host is making when it raises the level — and the reason
    //   raising it also SHRINKS the payload it can hold.
    const at = (ecLevel: 'L' | 'H') => kinds({ logoSize: 100, size: 200, ecLevel });
    expect(at('L')).toContain('logo');
    expect(at('H')).not.toContain('logo');
  });

  it('says what to do about it, not just that it is wrong', () => {
    const out = svQrScannability({ ...sound, logoSize: 120, size: 200, ecLevel: 'L' });
    expect(out.find(w => w.kind === 'logo')!.message)
      .toContain('Raise the correction level or shrink the logo');
  });

  it('ignores a logo that is not there', () => {
    expect(kinds({ logoSize: 0 })).not.toContain('logo');
  });

  it('every level recovers more than the one below it', () => {
    const order: (keyof typeof SV_QR_RECOVERY)[] = ['L', 'M', 'Q', 'H'];
    for (let i = 1; i < order.length; i++) {
      expect(SV_QR_RECOVERY[order[i]!]).toBeGreaterThan(SV_QR_RECOVERY[order[i - 1]!]);
    }
  });
});

describe('svQrScannability — thresholds are specification, not taste', () => {
  it('holds the quiet zone at the ISO figure', () => {
    expect(SV_QR_MIN_QUIET_ZONE).toBe(4);
  });

  it('holds contrast at what a camera needs to separate two tones', () => {
    expect(SV_QR_MIN_CONTRAST).toBe(3);
  });
});
