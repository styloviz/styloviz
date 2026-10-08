import {
  Component,
  input,
  computed,
  ElementRef,
  viewChild,
  effect,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { encodeQR, svQrCapacityBytes, svQrPayloadBytes } from './qr-encoder.util';
import {
  SV_QR_MIN_QUIET_ZONE,
  svQrScannability,
  type SvQrWarning,
} from './qr-scannability';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvQrCodeComponent — Generates a QR code from a string value.
 *
 * Features:
 * - Pure-canvas rendering, no external dependencies
 * - Supports L / M / Q / H error correction levels
 * - Optional center logo overlay
 * - Configurable foreground / background colors
 * - `download()` method exports PNG
 * - Accessible: role="img" with aria-label
 */
@Component({
  selector: 'sv-qr-code',
  standalone: true,
  imports: [],
  templateUrl: './qr-code.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvQrCodeComponent implements AfterViewInit {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** The text or URL to encode. */
  value = input<string>('');

  /** Canvas pixel size (width & height). @default 200 */
  size = input<number>(200);

  /** Error correction level. @default 'M' */
  errorCorrection = input<QrErrorCorrection>('M');

  /** Foreground (dark module) color. @default '#000000' */
  foreground = input<string>('#000000');

  /** Background (light module) color. Use 'transparent' for no background. @default '#ffffff' */
  background = input<string>('#ffffff');

  /** Optional center logo URL. */
  logo = input<string>('');

  /** Logo size in pixels. @default 40 */
  logoSize = input<number>(40);

  /**
   * Quiet zone around the code, in modules.
   *
   * ★★ ISO/IEC 18004 REQUIRES FOUR. The default was 2, which is not a smaller
   *    margin but a code a scanner may be unable to find the edges of against
   *    whatever surrounds it. Raised to the specified value; anything lower is
   *    still accepted and warned about, because a host may be placing the code
   *    on a known blank field.
   * @default 4
   */
  quietZone = input<number>(SV_QR_MIN_QUIET_ZONE);

  /**
   * Accessible label override for the rendered code. When empty, falls back to
   * `QR code for: <value>`. Provide a human label (e.g. "Scan to pay") when the
   * encoded value is a long or opaque string. @default ''
   */
  ariaLabel = input<string>('');

  /**
   * Show a payload meter beneath the code — a native `<meter>` of the encoded
   * bytes against the capacity of the chosen correction level, labelled with
   * `payloadLabel()` (e.g. "180 / 250 bytes"). @default false
   */
  showPayloadMeter = input<boolean>(false);

  // ── View refs ─────────────────────────────────────────────────────────────

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Everything that would stop this code scanning.
   *
   * ★★★ THE COMPONENT WILL HAPPILY RENDER SOMETHING UNSCANNABLE AND SAY NOTHING,
   *     which is the same class of failure as a chart clamping a negative into a
   *     plausible bar: valid-looking output that does not work. A human glancing
   *     at pale grey on white with a big logo sees a QR code; a scanner sees
   *     nothing.
   */
  readonly warnings = computed<readonly SvQrWarning[]>(() =>
    svQrScannability({
      foreground: this.foreground(),
      background: this.background(),
      quietZone: this.quietZone(),
      ecLevel: this.errorCorrection(),
      logoSize: this.logo() ? this.logoSize() : 0,
      size: this.size(),
      payloadBytes: svQrPayloadBytes(this.value()),
      capacityBytes: svQrCapacityBytes(this.errorCorrection()),
    }),
  );

  /**
   * True when the payload cannot be encoded without being cut.
   *
   * ★★★ THIS IS THE ONE THAT REFUSES TO DRAW. The others lower the odds of a
   *     scan; this one guarantees the wrong data — the encoder slices the byte
   *     array to capacity, so an over-long payload yields a code that scans
   *     perfectly and returns a truncated URL, which is still a URL.
   */
  readonly overCapacity = computed(
    () => svQrPayloadBytes(this.value()) > svQrCapacityBytes(this.errorCorrection()),
  );

  /** How full the payload is, `0`–`1`, for a capacity meter. */
  readonly payloadFill = computed(() => {
    const cap = svQrCapacityBytes(this.errorCorrection());
    return cap > 0 ? Math.min(1, svQrPayloadBytes(this.value()) / cap) : 0;
  });

  /** Encoded payload size in bytes, for the meter's value. */
  readonly payloadBytes = computed(() => svQrPayloadBytes(this.value()));

  /** Capacity of the chosen correction level in bytes, for the meter's max. */
  readonly capacityBytes = computed(() => svQrCapacityBytes(this.errorCorrection()));

  /** `"180 / 250 bytes"`, for the meter's label. */
  readonly payloadLabel = computed(
    () => `${svQrPayloadBytes(this.value())} / ${svQrCapacityBytes(this.errorCorrection())} bytes`,
  );

  /** Explicit override, else a description derived from the encoded value. */
  readonly resolvedAriaLabel = computed(() =>
    this.ariaLabel() ||
    (this.value() ? `QR code for: ${this.value()}` : 'QR code: no value'),
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    // Re-render whenever any input changes
    effect(() => {
      // Read all relevant signals to subscribe
      const v  = this.value();
      const sz = this.size();
      const ec = this.errorCorrection();
      const fg = this.foreground();
      const bg = this.background();
      const lg = this.logo();
      const ls = this.logoSize();
      const qz = this.quietZone();

      void [v, sz, ec, fg, bg, lg, ls, qz]; // ensure reactivity
      this.render();
    });
  }

  ngAfterViewInit(): void {
    this.render();
  }

  // ── Public methods ────────────────────────────────────────────────────────

  /** Download the QR code as a PNG file. */
  download(filename = 'qr-code.png'): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private render(): void {
    // ★ SSR: reached from a lifecycle hook (or a constructor `effect`), both of
    // which run during a prerender. Guarding at the top of the helper keeps the
    // hook readable and covers every other caller too.
    // There is no canvas rasteriser on a server; the QR redraws on hydration.
    if (typeof window === 'undefined') return;
    // ★ Nothing is drawn for a payload that would be truncated, so there is no
    //   canvas to draw on — and encoding it would produce the very matrix the
    //   component just refused to show.
    if (this.overCapacity()) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const sz  = this.size();
    const dpr = window.devicePixelRatio || 1;
    // Assigning width/height also resets the context transform, so the scale
    // below has to come after it.
    canvas.width  = sz * dpr;
    canvas.height = sz * dpr;
    canvas.style.width  = `${sz}px`;
    canvas.style.height = `${sz}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, sz, sz);

    // Nothing to encode. Returning BEFORE the clear, which is what this used
    // to do, left the previous code on the canvas — so clearing a bound field
    // left a scannable code on screen for a value that no longer existed.
    if (!this.value()) return;

    const matrix = encodeQR(this.value(), this.errorCorrection());
    const qz     = this.quietZone();
    const totalModules = matrix.length + qz * 2;
    const moduleSize = sz / totalModules;

    // Background
    if (this.background() !== 'transparent') {
      ctx.fillStyle = this.background();
      ctx.fillRect(0, 0, sz, sz);
    }

    // Modules
    ctx.fillStyle = this.foreground();
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const x = (c + qz) * moduleSize;
          const y = (r + qz) * moduleSize;
          ctx.fillRect(x, y, moduleSize, moduleSize);
        }
      }
    }

    // Optional logo
    const logoUrl = this.logo();
    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ls  = this.logoSize();
        const lx  = (sz - ls) / 2;
        const ly  = (sz - ls) / 2;
        // White background behind logo
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx - 4, ly - 4, ls + 8, ls + 8);
        ctx.drawImage(img, lx, ly, ls, ls);
      };
      img.src = logoUrl;
    }
  }
}
