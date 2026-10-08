import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { SvErrorShellComponent, SvSkeletonShellComponent, type SvDataError, svUniqueId } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import {
  svBarcodeWidth,
  svCode128Savings,
  svEncode,
  svEncodingLabel,
  svIsGuardModule,
  svSnapModuleWidth,
  type SvEncoded,
} from './barcode-1d.encode';
import { svScanSize, type SvBarcodeScanSize } from './barcode-1d.scan';
import type { BarcodeModule, BarcodeSymbology, BarcodeVariant } from './barcode-1d.types';

/**
 * `<sv-barcode-1d>` — Code 128 and EAN barcodes, encoded properly.
 *
 * ★★★ A BARCODE WITH THE WRONG CHECK DIGIT DOES NOT FAIL TO SCAN — IT SCANS AS
 * A DIFFERENT NUMBER. That is why this is arithmetic rather than CSS stripes,
 * and why an input it cannot encode is refused with a reason instead of drawn
 * anyway.
 */
@Component({
  selector: 'sv-barcode-1d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvIconComponent, SvErrorShellComponent, SvSkeletonShellComponent],
  templateUrl: './barcode-1d.component.html',
  /**
   * ★★★ PRINT IS WHERE A CORRECT BARCODE STOPS SCANNING. Three things a print
   *     path does by default, each of which destroys a symbol that was right on
   *     screen:
   *
   *     1. **Background stripping.** Browsers drop backgrounds when printing
   *        unless told otherwise. The white behind the bars is not decoration —
   *        it is the light half of the contrast a scanner measures, and the
   *        quiet zone is nothing BUT background. `print-color-adjust: exact`.
   *     2. **Rescaling.** "Shrink to fit" and any `@page` scale change the
   *        X-dimension, which is the one number a scanner has an opinion about.
   *        `--sv-bc-print-width` pins the physical width in millimetres when the
   *        host has stated one, so the symbol measures the same whatever the
   *        dialog decides.
   *     3. **Page breaks.** Half a symbol on each of two sheets is not a symbol.
   *
   *     `!important` is load-bearing: the width it overrides is an SVG
   *     presentation attribute set from the pixel geometry.
   */
  styles: [`
    @media print {
      :host {
        /* ★ break-inside is ignored on an inline box, and a custom element is
           inline by default — so without this the page-break rule below did
           nothing. Block (not inline-block) because the host's content is
           already block-level, so this matches what the screen lays out. */
        display: block;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      [data-sv-svg] {
        width: var(--sv-bc-print-width, auto) !important;
        height: auto !important;
      }
      /* The inspect report is a development aid, not part of the label. */
      [data-sv-inspect] { display: none !important; }
    }
  `],
})
export class SvBarcode1dComponent {
  private readonly uid = svUniqueId('sv-bc');

  // ── Async state ───────────────────────────────────────────────────────────

  /** True while the value to encode is being fetched; shows a skeleton in place of the barcode. @default false */
  readonly loading = input<boolean>(false);
  /**
   * Load failure, shown as an error panel in place of the content. Use `toSvDataError()` from
   * `@styloviz/core` to normalize an `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);
  /** Emitted when the user presses the error panel's "Try again" button (retryable errors only); the host should re-run the failed load. */
  readonly retry = output<void>();

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Bars with text, bars alone, or bars with the encoder's report. @default 'labelled' */
  readonly variant = input<BarcodeVariant>('labelled');

  /** What to encode. For EAN, with or without the check digit. @default '' */
  readonly value = input<string>('');

  /** Barcode standard `value` is encoded in: `'code128'`, `'ean13'` or `'ean8'` (check digit computed). @default 'code128' */
  readonly symbology = input<BarcodeSymbology>('code128');

  /**
   * Requested width of one module, in CSS px.
   *
   * ★★ Requested, not final — see `moduleWidth`. A module narrower than a whole
   * device pixel antialiases, and a scanner reads the antialiasing as different
   * run widths.
   * @default 2
   */
  readonly requestedModuleWidth = input<number>(2);

  /** Device pixel ratio to snap against. @default 1 */
  readonly devicePixelRatio = input<number>(1);

  /** Bar height in px, excluding the human-readable text. @default 64 */
  readonly barHeight = input<number>(64);

  /**
   * Draw the quiet zones as a visible margin outline.
   *
   * ★★ For the `inspect` view. The quiet zone is invisible by nature, which is
   * exactly why people lay a barcode flush against a border and cannot see what
   * broke it.
   * @default false
   */
  readonly showQuietZone = input<boolean>(false);

  /**
   * Physical width of one module when printed, in millimetres. `0` leaves the
   * printed size to the browser, which is what an untouched print job does.
   *
   * ★ This is the X-dimension, the quantity ISO/IEC 15416 and GS1 actually
   * specify — and the reason it exists as its own input is that CSS pixels do
   * not survive a print dialog. Pin it and the symbol measures the same on
   * paper whatever "fit to page" decides.
   * @default 0
   */
  readonly printModuleWidthMm = input<number>(0);

  /** Emitted whenever the value cannot be encoded, with the reason. */
  readonly encodeError = output<string>();

  /**
   * Emitted when the symbol's physical size falls below the floor its
   * symbology may be printed at. Carries the measurements, so a label pipeline
   * can refuse the job rather than print a roll of stickers that will not read.
   */
  readonly scanSizeWarning = output<SvBarcodeScanSize>();

  constructor() {
    // ★ Both of these used to be emitted from inside a `computed`. A computed
    // must be pure: it is memoised, may not run at all when nothing reads it,
    // and may run again when something does — so the emission was neither
    // guaranteed nor guaranteed-once. An effect is the construct that means
    // "when this value changes, do something".
    effect(() => {
      const message = this.encoded().error;
      if (message) this.encodeError.emit(message);
    });
    effect(() => {
      const size = this.scanSize();
      if (size.belowMinimum) this.scanSizeWarning.emit(size);
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly encoded = computed<SvEncoded>(() => svEncode(this.value(), this.symbology()));

  /** The width actually drawn, after snapping to whole device pixels. */
  readonly moduleWidth = computed(() =>
    svSnapModuleWidth(this.requestedModuleWidth(), this.devicePixelRatio()),
  );

  /** True when the requested width was not achievable and was adjusted. */
  readonly widthAdjusted = computed(
    () => Math.abs(this.moduleWidth() - this.requestedModuleWidth()) > 1e-9,
  );

  readonly totalWidth = computed(() => svBarcodeWidth(this.encoded(), this.moduleWidth()));

  /**
   * ★★ Guard bars run below the digit row, so the text sits between them. The
   * extra height is part of the symbol's readability, not decoration.
   */
  readonly guardOverhang = computed(() => (this.encoded().symbology === 'code128' ? 0 : 8));

  readonly totalHeight = computed(() => {
    const text = this.variant() === 'bare' ? 0 : 14;
    return this.barHeight() + this.guardOverhang() + text;
  });

  readonly savings = computed(() =>
    this.symbology() === 'code128' && !this.encoded().error
      ? svCode128Savings(this.value())
      : null,
  );

  readonly encodingLabel = computed(() => svEncodingLabel(this.encoded()));

  readonly isRefused = computed(() => this.encoded().error !== null);

  // ── Physical size ─────────────────────────────────────────────────────────

  /** Total modules across the symbol, quiet zones included. */
  readonly totalModules = computed(() => {
    const e = this.encoded();
    return e.moduleCount + e.quietLeft + e.quietRight;
  });

  /**
   * What this symbol measures on paper, and whether that is enough.
   *
   * ★★ Every number this component reported was in CSS pixels, and a scanner
   * has no opinion about those. The X-dimension in millimetres is the specified
   * quantity, and a container that squeezes the module below the floor produced
   * a symbol that looked perfect and did not read.
   */
  readonly scanSize = computed<SvBarcodeScanSize>(() =>
    svScanSize(
      this.symbology(),
      this.moduleWidth(),
      this.totalModules(),
      this.barHeight(),
      this.printModuleWidthMm(),
    ),
  );

  /** Printed width of the whole symbol, as a CSS length, or null. */
  readonly printWidth = computed<string | null>(() =>
    this.printModuleWidthMm() > 0
      ? `${(this.printModuleWidthMm() * this.totalModules()).toFixed(3)}mm`
      : null,
  );

  /** Only the bars — spaces are encoded but never painted. */
  readonly bars = computed(() => this.encoded().modules.filter((m) => m.bar));

  // ── Presentation ──────────────────────────────────────────────────────────

  bcId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }

  x(m: BarcodeModule): number {
    return (this.encoded().quietLeft + m.at) * this.moduleWidth();
  }

  width(m: BarcodeModule): number {
    return m.width * this.moduleWidth();
  }

  height(m: BarcodeModule): number {
    return this.barHeight() + (svIsGuardModule(this.encoded(), m) ? this.guardOverhang() : 0);
  }

  isGuard(m: BarcodeModule): boolean {
    return svIsGuardModule(this.encoded(), m);
  }

  /** x of the left edge of the encoded symbol, in px. */
  get symbolLeft(): number {
    return this.encoded().quietLeft * this.moduleWidth();
  }

  symbolWidth(): number {
    return this.encoded().moduleCount * this.moduleWidth();
  }

  /**
   * ★★★ THE ACCESSIBLE NAME IS THE ENCODED TEXT, NOT "barcode". A screen-reader
   * user cannot scan the symbol, and the whole content of this graphic is the
   * string inside it — including the check digit the encoder appended, which is
   * part of the number as printed.
   */
  ariaLabel(): string {
    const e = this.encoded();
    if (e.error) return `Barcode could not be generated: ${e.error}`;
    return `${e.symbology === 'code128' ? 'Code 128' : e.symbology === 'ean13' ? 'EAN-13' : 'EAN-8'} barcode: ${e.text}`;
  }
}
