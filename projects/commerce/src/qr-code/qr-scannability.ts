/**
 * qr-scannability.ts — whether a code that renders will actually scan.
 *
 * ★★★ A QR CODE IS THE ONLY COMPONENT IN THE KIT WHOSE OUTPUT IS READ BY A
 *     MACHINE, and that changes what "looks right" is worth. A human glancing at
 *     a pale-grey-on-white code with a big logo sees a QR code; a scanner sees
 *     nothing. Every check here exists because the component will happily render
 *     something unscannable and say nothing — the same class of failure as a
 *     chart clamping a negative into a plausible bar.
 *
 * ★★ THE THRESHOLDS ARE NOT DESIGN OPINIONS. The quiet zone is four modules in
 *    ISO/IEC 18004; the correction levels recover a known percentage of the
 *    symbol; contrast is what a camera has to separate. Treating any of them as
 *    taste is how a code ships that works on the designer's phone and nowhere
 *    else.
 */

import { svFormatLabel } from '@styloviz/core/i18n';
import type { SvCommerceLabels } from '../commerce.labels';

/** Error-correction levels, and how much of the symbol each can lose. */
export type SvQrEcLevel = 'L' | 'M' | 'Q' | 'H';

/** Recoverable fraction of the symbol at each level, per ISO/IEC 18004. */
export const SV_QR_RECOVERY: Record<SvQrEcLevel, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.30,
};

/** The quiet zone the specification requires, in modules. */
export const SV_QR_MIN_QUIET_ZONE = 4;

/** The contrast a scanner needs between dark and light modules. */
export const SV_QR_MIN_CONTRAST = 3;

/** One thing wrong with a code, in words. */
export interface SvQrWarning {
  readonly kind: 'contrast' | 'quiet-zone' | 'logo' | 'capacity' | 'inverted';
  readonly message: string;
}

type Rgb = readonly [number, number, number];

/** Parse `#rgb`, `#rrggbb`, or return `null` for anything else. */
export function svParseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.split('').map(c => c + c).join('') : m[1]!;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(c: Rgb): number {
  const chan = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
}

/** Contrast ratio between two colours, or `null` when either is unreadable. */
export function svQrContrast(foreground: string, background: string): number | null {
  const fg = svParseHex(foreground);
  const bg = svParseHex(background);
  if (!fg || !bg) return null;
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Options for {@link svQrScannability}. */
export interface SvQrScanCheck {
  readonly foreground: string;
  readonly background: string;
  /** Quiet zone, in modules. */
  readonly quietZone: number;
  /** Error correction level in force. */
  readonly ecLevel: SvQrEcLevel;
  /** Logo edge length in pixels, or `0` when there is none. */
  readonly logoSize: number;
  /** Rendered edge length of the whole symbol, in pixels. */
  readonly size: number;
  /** Payload bytes, and the capacity they are measured against. */
  readonly payloadBytes: number;
  readonly capacityBytes: number;
}

/**
 * Everything wrong with a code, in the order a host should care about it.
 *
 * ★ A payload over capacity comes first and is fatal: the others degrade the
 *   odds of a scan, but that one guarantees the WRONG data is encoded, and a
 *   truncated URL is still a URL.
 *
 * ★ An inverted code — light modules on a dark ground — is called out
 *   separately from contrast, because it passes a contrast check comfortably
 *   and still fails on many scanners, which assume dark-on-light. It is a
 *   warning rather than an error because some readers do cope.
 */
/** The labels {@link svQrScannability} writes its warnings from. */
export type SvQrScanLabels = Pick<
  SvCommerceLabels,
  | 'qrWarningCapacity'
  | 'qrWarningContrastUnreadable'
  | 'qrWarningContrastLow'
  | 'qrWarningInverted'
  | 'qrWarningQuietZone'
  | 'qrWarningLogo'
>;

export function svQrScannability(check: SvQrScanCheck, labels: SvQrScanLabels): readonly SvQrWarning[] {
  const out: SvQrWarning[] = [];

  if (check.payloadBytes > check.capacityBytes) {
    out.push({
      kind: 'capacity',
      message: svFormatLabel(labels.qrWarningCapacity, {
        bytes: String(check.payloadBytes),
        capacity: String(check.capacityBytes),
        level: check.ecLevel,
      }),
    });
  }

  const contrast = svQrContrast(check.foreground, check.background);
  if (contrast === null) {
    out.push({ kind: 'contrast', message: labels.qrWarningContrastUnreadable });
  } else if (contrast < SV_QR_MIN_CONTRAST) {
    out.push({
      kind: 'contrast',
      message: svFormatLabel(labels.qrWarningContrastLow, {
        contrast: contrast.toFixed(1),
        min: String(SV_QR_MIN_CONTRAST),
      }),
    });
  }

  const fg = svParseHex(check.foreground);
  const bg = svParseHex(check.background);
  if (fg && bg && luminance(fg) > luminance(bg)) {
    out.push({ kind: 'inverted', message: labels.qrWarningInverted });
  }

  if (check.quietZone < SV_QR_MIN_QUIET_ZONE) {
    out.push({
      kind: 'quiet-zone',
      message: svFormatLabel(labels.qrWarningQuietZone, {
        modules: String(check.quietZone),
        min: String(SV_QR_MIN_QUIET_ZONE),
      }),
    });
  }

  if (check.logoSize > 0 && check.size > 0) {
    // A square logo occludes its own area out of the symbol's area.
    const coverage = (check.logoSize * check.logoSize) / (check.size * check.size);
    const budget = SV_QR_RECOVERY[check.ecLevel];
    if (coverage > budget) {
      out.push({
        kind: 'logo',
        message: svFormatLabel(labels.qrWarningLogo, {
          coverage: String(Math.round(coverage * 100)),
          level: check.ecLevel,
          budget: String(Math.round(budget * 100)),
        }),
      });
    }
  }

  return out;
}
