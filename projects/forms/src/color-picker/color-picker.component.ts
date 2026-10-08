import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  EmbeddedViewRef,
  forwardRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
  ViewChild,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { ColorPickerFormat, ColorPickerSize, ColorSwatch } from './color-picker.types';
import { DEFAULT_SWATCHES } from './color-picker.types';
import {
  svStackedPopup,
  SvFieldErrorComponent,
  createFieldError,
  svColorName,
  svContrastRatio,
  svFormatRatio,
  svHexToRgb,
  svWcagGrade,
  type SvServerError,
  type SvWcagGrade,
  svListenWhile,
  type SvListenWhileRef,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Colour math helpers ──────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: max ? d / max : 0, v: max };
}

/**
 * HSV -> RGB.
 *
 * The three rows are the R, G and B channel values for each of the six hue
 * sectors. They were written with `q` and `t` transposed, which rotated every
 * colour this picker produced by a full sector: the Red preset (#ef4444) came
 * back as #efef44, and the default #3b82f6 rendered as #3baff6. Nothing that
 * went in came out again — including the value a form had just been given.
 *
 * The wrap on the first line covers one specific input: hue 360, which both the
 * End key and the right end of the hue rail produce. Un-wrapped it makes
 * `Math.floor(h * 6)` equal 6 — one index past the end of every row.
 */
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = (((h % 360) + 360) % 360) / 360;
  const i = Math.floor(h * 6);
  const f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, q, p, p, t, v],
    [t, v, v, q, p, p],
    [p, p, t, v, v, q],
  ].map(a => a[i % 6]!);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Panel width (px) — matches the w-64 Tailwind class (256 px). */
const PANEL_W = 264;
/** Approximate picker panel height for flip calculation (px). */
const PANEL_H = 420;
/** Gap between trigger edge and panel (px). */
const GAP = 6;
/** Floor for the clamped panel height — below this it scrolls internally. */
const MIN_PANEL_H = 160;
/** Minimum distance the panel keeps from any viewport edge (px). */
const MARGIN = 8;

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'sv-color-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvIconComponent, FormsModule, SvFieldErrorComponent],
  templateUrl: './color-picker.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvColorPickerComponent),
      multi: true,
    },
  ],
})
export class SvColorPickerComponent implements OnInit, OnDestroy, ControlValueAccessor {
  private readonly el     = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appRef = inject(ApplicationRef);

  // ── Inputs ──
  /** Selected color (two-way). @default '#3b82f6' */
  value     = model<string>('#3b82f6');
  /** Output format: hex, rgb or hsl. @default 'hex' */
  format    = input<ColorPickerFormat>('hex');
  /** Picker size: sm, md or lg. @default 'md' */
  size      = input<ColorPickerSize>('md');
  /** Preset swatch palette. @default DEFAULT_SWATCHES */
  swatches  = input<readonly ColorSwatch[]>(DEFAULT_SWATCHES);
  /** Disable the picker. @default false */
  disabled  = input<boolean>(false);
  /** Accessible label for the control. */
  label     = input<string>('');
  /** Show the alpha (transparency) channel. @default false */
  showAlpha = input<boolean>(false);

  /**
   * A background to check the chosen colour against. @default ''
   *
   * ── The defect this exists for (`FI-08-I2` / `FI-08-M1`) ──────────────────
   *
   * ★★★ A PICKER THAT LETS YOU CHOOSE AN UNREADABLE PAIR WITHOUT SAYING SO IS A
   *     COMPONENT THAT MANUFACTURES ACCESSIBILITY BUGS. Someone picks a pleasant
   *     mid-grey for body text on white, ships it, and finds out at audit — from
   *     a tool that was never in the loop when the decision was made. The number
   *     costs nothing to show at the moment it can still change the answer.
   *
   * ★★ **This reuses the theme builder's audit logic rather than restating it.**
   *    That code lived in `src/app/` where no library could reach it, so the
   *    obvious move was a copy — and two contrast checkers drift until a
   *    designer's audit and a component's badge disagree about the same pair.
   *    It moved to `@styloviz/core`; the theme builder re-exports it.
   *
   * ⚠️ Reports WCAG 2.x, not APCA. 4.5:1 and 3:1 are what an auditor, a
   *    procurement questionnaire and a lawsuit measure against.
   */
  contrastBackground = input<string>('');

  /**
   * Turn the hex into words for assistive tech. @default `svColorName`
   *
   * ★★★ `#3B82F6` IS NOT AN ANNOUNCEMENT. A screen reader reads it one character
   *     at a time and the user learns nothing about what they picked.
   *
   * ⚠️ The default is English. A component cannot translate, so a host that
   *    needs another language passes its own namer — the point is that the
   *    default is a description rather than a code, not that this particular
   *    vocabulary is the right one everywhere.
   */
  colorNamer = input<(hex: string) => string>(svColorName);

  // ── Outputs ──
  /** Emitted with the new color whenever it changes. */
  colorChange = output<string>();

  // ── State ──
  readonly open       = signal(false);
  readonly hexInput   = signal('#3b82f6');
  readonly hue        = signal(217);
  readonly saturation = signal(0.91);
  readonly brightness = signal(0.96);
  readonly alpha      = signal(1);

  /** Flip/align state — same pattern as SvDatePickerComponent. */
  readonly openAbove  = signal(false);
  readonly alignRight = signal(false);

  /**
   * Inline style object applied to the portal panel.
   * Uses position:fixed with exact viewport coords so the panel
   * escapes all parent overflow and transform containment.
   */
  readonly panelStyle = signal<Record<string, string>>({});

  // ── Portal state ──
  private portalEl: HTMLElement | null = null;
  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.open(),
    element: () => this.portalEl,
  });
  private portalView: EmbeddedViewRef<object> | null = null;

  /**
   * Capture-phase scroll listener — fires for ANY scrollable ancestor,
   * not just the window. Recalculates the panel position each frame so
   * the panel tracks the trigger during page or container scroll.
   */
  private _rafId: number | null = null;
  private readonly _scrollHandler = (): void => {
    if (!this.open()) return;
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.open()) {
        this._calcPos();
        this.portalView?.detectChanges();
      }
    });
  };

  /** The ng-template that holds the picker panel markup. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  private _draggingGradient = false;
  private _draggingHue      = false;
  private _draggingAlpha    = false;
  /** True while any of the three drags runs — drives the move listener (`svListenWhile`). */
  private readonly _dragActive = signal(false);

  readonly gradientCanvas = viewChild<ElementRef<HTMLDivElement>>('gradientCanvas');
  readonly hueSlider      = viewChild<ElementRef<HTMLDivElement>>('hueSlider');
  readonly alphaSlider    = viewChild<ElementRef<HTMLDivElement>>('alphaSlider');

  // ── Computed ──
  readonly hueColor = computed(() => {
    const { r, g, b } = hsvToRgb(this.hue(), 1, 1);
    return `rgb(${r},${g},${b})`;
  });

  readonly currentColor = computed(() => {
    const { r, g, b } = hsvToRgb(this.hue(), this.saturation(), this.brightness());
    if (this.showAlpha()) return `rgba(${r},${g},${b},${this.alpha()})`;
    return rgbToHex(r, g, b);
  });

  /**
   * The trigger's accessible name.
   *
   * ★ It used to be `'Pick colour: ' + displayValue()` in the template, with the
   * field name carried separately by an `aria-labelledby` pointing at the label
   * span — and `aria-labelledby` OUTRANKS `aria-label`, so the value was
   * discarded. Folding both into one name is what the date and time pickers do.
   */
  /** The current colour as a hex string, whatever `format` prints. */
  readonly currentHex = computed<string>(() => {
    const { r, g, b } = hsvToRgb(this.hue(), this.saturation(), this.brightness());
    return rgbToHex(r, g, b);
  });

  /** The current colour in words — "medium blue", not "#3b82f6". */
  readonly colorName = computed<string>(() => this.colorNamer()(this.currentHex()));

  readonly triggerAriaLabel = computed<string>(() => {
    const name = this.label();
    // ★ The NAME first and the code after it. A reader gets the useful half
    //   immediately and can keep listening for the exact value if it wants it.
    const said = `${this.colorName()}, ${this.displayValue()}`;
    return name ? `${name}: ${said}` : `Pick colour: ${said}`;
  });

  // ── Contrast against a supplied background ────────────────────────────────

  /** Whether a background was given to check against. */
  readonly hasContrast = computed<boolean>(() => {
    const bg = this.contrastBackground().trim();
    return /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(bg);
  });

  /**
   * The colour a reader actually sees on the background.
   *
   * 🔺 With `showAlpha`, a 30 %-opaque black on white is a light grey — but the
   *    ratio used to be taken from the opaque hex, so it reported 21:1 AAA for a
   *    pair that fails. The foreground is now composited over the background
   *    first (straight alpha, sRGB — what a browser paints).
   */
  readonly contrastForeground = computed<string>(() => {
    const hex = this.currentHex();
    const a = this.showAlpha() ? this.alpha() : 1;
    if (a >= 1 || !this.hasContrast()) return hex;
    const fg = hexToRgb(hex);
    const bg = svHexToRgb(this.contrastBackground());
    const mix = (f: number, b: number): number => Math.round(f * a + b * (1 - a));
    return rgbToHex(mix(fg.r, bg.r), mix(fg.g, bg.g), mix(fg.b, bg.b));
  });

  readonly contrastValue = computed<number>(() =>
    this.hasContrast() ? svContrastRatio(this.contrastForeground(), this.contrastBackground()) : 0,
  );

  readonly contrastText = computed<string>(() => svFormatRatio(this.contrastValue()));
  readonly contrastGrade = computed<SvWcagGrade>(() => svWcagGrade(this.contrastValue()));

  /**
   * A sentence, not a badge.
   *
   * ★★ "4.1:1, AA Large" is a fact a specialist can read. "Fails for body text"
   *    is the same fact to everybody else, and the person choosing a colour is
   *    usually the second kind of reader.
   */
  readonly contrastSummary = computed<string>(() => {
    if (!this.hasContrast()) return '';
    const grade = this.contrastGrade();
    const detail =
      grade === 'Fail' ? 'fails WCAG for any text size'
      : grade === 'AA Large' ? 'passes for large text only'
      : `passes ${grade} for body text`;
    return `Contrast ${this.contrastText()} — ${detail}`;
  });

  /** Colour of the contrast chip. Never colour ALONE — the words carry it. */
  readonly contrastChipClass = computed<string>(() => {
    switch (this.contrastGrade()) {
      case 'AAA':
      case 'AA':       return 'bg-accent-50 text-accent-700 ring-accent-200 dark:bg-accent-950/60 dark:text-accent-300 dark:ring-accent-800';
      case 'AA Large': return 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-950/60 dark:text-warning-300 dark:ring-warning-800';
      default:         return 'bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-950/60 dark:text-danger-300 dark:ring-danger-800';
    }
  });

  readonly displayValue = computed(() => {
    const { r, g, b } = hsvToRgb(this.hue(), this.saturation(), this.brightness());
    switch (this.format()) {
      case 'rgb': return `rgb(${r}, ${g}, ${b})`;
      case 'hsl': { const hsl = rgbToHsl(r, g, b); return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`; }
      default:    return rgbToHex(r, g, b);
    }
  });

  readonly selectorPosition = computed(() => ({
    left: `${this.saturation() * 100}%`,
    top:  `${(1 - this.brightness()) * 100}%`,
  }));

  readonly huePosition = computed(() => `${(this.hue() / 360) * 100}%`);

  // Unique ID for the floating panel (deterministic, SSR-safe).
  readonly _uid = svUniqueId('sv-cp');

  // ── ControlValueAccessor ──
  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: string): void { if (v) this.value.set(v); }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  /** Accessible name for the 2D saturation/brightness area. */
  readonly gradientValueText = computed(() =>
    `Saturation ${Math.round(this.saturation() * 100)}%, brightness ${Math.round(this.brightness() * 100)}%`
  );
  /**
   * ARIA has no two-axis slider, and `role="slider"` requires `aria-valuenow`.
   * Saturation is the primary axis — the horizontal one, which is what the
   * left/right arrows move — so it carries the numeric value, while
   * `gradientValueText` announces both axes in words, which is what a user
   * actually needs to hear.
   */
  readonly saturationValue = computed(() => Math.round(this.saturation() * 100));

  readonly hueValue   = computed(() => Math.round(this.hue()));
  /**
   * ★ A bare "217" is a number with no unit and no meaning. Say the degrees
   *   and what the resulting colour is, so moving the hue rail is heard as
   *   "217 degrees, vivid blue" rather than a count.
   */
  readonly hueValueText = computed(() => `${this.hueValue()} degrees, ${this.colorName()}`);
  readonly alphaValue = computed(() => Math.round(this.alpha() * 100));

  /** Global move listeners, attached only while a drag runs (see constructor). */
  private readonly _moves: SvListenWhileRef;

  constructor() {
    // ★ Moves are listened to only during the drag (1.0 audit, M2) — a document-level
    //   @HostListener ran change detection on every mouse move anywhere on the page.
    this._moves = svListenWhile(() => this._dragActive(), 'document', {
      mousemove: (e) => this.onMouseMove(e as MouseEvent),
    });
    effect(() => {
      const v = this.value();
      if (v && v.startsWith('#')) {
        const { r, g, b } = hexToRgb(v);
        const { h, s, v: bv } = rgbToHsv(r, g, b);
        this.hue.set(h);
        this.saturation.set(s);
        this.brightness.set(bv);
        this.hexInput.set(v);
      }
    });
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    // Capture phase catches scroll from any scrollable ancestor, not just window.
    // ★ SSR: this hook runs during a prerender, where there is no `window`
    // or `document`. A scroll listener is a browser-only affordance, so
    // skipping it server-side loses nothing.
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    }
  }

  ngOnDestroy(): void {
    // ★ `ngOnDestroy` runs on the server too — a prerender destroys the
    // application after every route.
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this.destroyPortal();
  }

  // ── Global listeners ──

  @HostListener('document:mousedown', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.open()) return;
    const t = e.target as Node;
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(t)) return;
    if (this.el.nativeElement.contains(t)) return;
    if (this.portalEl?.contains(t)) return;
    this.close();
  }

  /**
   * Escape is listened for on the document, not the host: the panel is portalled
   * into <body> and focus is moved into it on open, so a key pressed there never
   * bubbles through this component's element. Bound to the host, this handler
   * could only ever have fired while the panel was already shut.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Only the topmost surface acts on Escape (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (this.open()) this.close(true);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) this.close();
  }

  // ── Position calculation ──

  private _calcPos(): void {
    const trigger = this.el.nativeElement.querySelector('[data-trigger]') as HTMLElement
      ?? this.el.nativeElement;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const above = spaceBelow < PANEL_H && spaceAbove > spaceBelow;
    const right  = rect.left + PANEL_W > vw;

    this.openAbove.set(above);
    this.alignRight.set(right);

    const style: Record<string, string> = {
      position: 'fixed',
      zIndex:   '9999',
      width:    `${PANEL_W}px`,
    };
    style[above ? 'bottom' : 'top'] = above
      ? `${vh - rect.top + GAP}px`
      : `${rect.bottom + GAP}px`;
    // Cap the height to the room actually available on the chosen side. Without
    // this, flipping ABOVE a trigger that sits near the top of the viewport puts
    // the panel's top edge off-screen (Date Picker Pro: y=-35).
    style['maxHeight'] = `${Math.max(MIN_PANEL_H, (above ? rect.top : vh - rect.bottom) - GAP - MARGIN)}px`;
    // Anchor to one viewport edge and cap the width to the distance from that
    // anchor to the opposite edge. A CSS `max-w` bounds SIZE, not POSITION — so
    // without this cap a far-edge-anchored panel still renders off-screen on a
    // narrow viewport (the bug that put Mega Menu's left edge at x=-220).
    const anchor = right ? Math.max(MARGIN, vw - rect.right) : Math.max(MARGIN, rect.left);
    style[right ? 'right' : 'left'] = `${anchor}px`;
    style['maxWidth'] = `${vw - anchor - MARGIN}px`;

    this.panelStyle.set(style);
  }

  // ── Public API ──

  toggle(): void {
    if (this.resolvedDisabled()) return;
    if (this.open()) { this.close(); return; }

    this._calcPos();

    // Mount the panel into document.body via a lightweight portal.
    if (!this.panelTpl) return;

    this.portalEl = document.createElement('div');
    this.portalEl.className = 'sv-cp-portal';

    this.portalView = this.panelTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portalEl!.appendChild(n));
    document.body.appendChild(this.portalEl);

    this.open.set(true);
    // Move focus into the panel for keyboard users.
    setTimeout(() => this.portalEl?.querySelector<HTMLElement>('[data-gradient]')?.focus());
  }

  close(returnFocus = false): void {
    this.destroyPortal();
    this.open.set(false);
    this._onTouched();
    if (returnFocus) {
      this.el.nativeElement.querySelector<HTMLElement>('[data-trigger]')?.focus();
    }
  }

  // ── Keyboard support (sliders) ──

  /** Gradient (2D saturation × brightness) — arrows nudge, Home/End jump. */
  onGradientKeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 0.1 : 0.02;
    let s = this.saturation(), v = this.brightness(), handled = true;
    switch (e.key) {
      case 'ArrowLeft':  s -= step; break;
      case 'ArrowRight': s += step; break;
      case 'ArrowUp':    v += step; break;
      case 'ArrowDown':  v -= step; break;
      case 'Home':       s = 0; break;
      case 'End':        s = 1; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    this.saturation.set(Math.max(0, Math.min(1, s)));
    this.brightness.set(Math.max(0, Math.min(1, v)));
    this.syncHexFromHsv();
    this.emit();
  }

  /** Hue rail — arrows ±1° (±10° with Shift), Home/End to ends. */
  onHueKeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 10 : 1;
    let h = this.hue(), handled = true;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':  h -= step; break;
      case 'ArrowRight':
      case 'ArrowUp':    h += step; break;
      case 'Home':       h = 0; break;
      case 'End':        h = 360; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    this.hue.set(Math.max(0, Math.min(360, h)));
    this.syncHexFromHsv();
    this.emit();
  }

  /** Alpha rail — arrows ±1% (±10% with Shift), Home/End to ends. */
  onAlphaKeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 0.1 : 0.01;
    let a = this.alpha(), handled = true;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':  a -= step; break;
      case 'ArrowRight':
      case 'ArrowUp':    a += step; break;
      case 'Home':       a = 0; break;
      case 'End':        a = 1; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    this.alpha.set(Math.round(Math.max(0, Math.min(1, a)) * 100) / 100);
    this.emit();
  }

  private syncHexFromHsv(): void {
    const { r, g, b } = hsvToRgb(this.hue(), this.saturation(), this.brightness());
    this.hexInput.set(rgbToHex(r, g, b));
  }

  onAlphaTouch(e: TouchEvent): void {
    const touch = e.touches[0];
    if (touch) this.updateAlpha(touch as unknown as MouseEvent);
  }

  selectSwatch(color: string): void {
    this.hexInput.set(color);
    this.applyHex(color);
  }

  onHexChange(val: string): void {
    if (/^#[0-9a-fA-F]{6}$/.test(val)) this.applyHex(val);
  }

  private applyHex(hex: string): void {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, v } = rgbToHsv(r, g, b);
    this.hue.set(h);
    this.saturation.set(s);
    this.brightness.set(v);
    this.emit();
  }

  private emit(): void {
    const c = this.currentColor();
    this.value.set(c);
    this.colorChange.emit(c);
    this._onChange(c);
  }

  // ── Gradient canvas drag ──
  onGradientMousedown(e: MouseEvent): void {
    this._draggingGradient = true;
    this._dragActive.set(true);
    this._moves.sync();
    this.updateGradient(e);
  }

  onMouseMove(e: MouseEvent): void {
    if (this._draggingGradient) this.updateGradient(e);
    if (this._draggingHue)      this.updateHue(e);
    if (this._draggingAlpha)    this.updateAlpha(e);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this._draggingGradient = false;
    this._draggingHue = false;
    this._draggingAlpha = false;
    this._dragActive.set(false);
  }

  private updateGradient(e: MouseEvent): void {
    const el = this.gradientCanvas()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    this.saturation.set(s);
    this.brightness.set(v);
    this.emit();
  }

  onHueMousedown(e: MouseEvent): void {
    this._draggingHue = true;
    this._dragActive.set(true);
    this._moves.sync();
    this.updateHue(e);
  }

  private updateHue(e: MouseEvent): void {
    const el = this.hueSlider()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    this.hue.set(h);
    const { r, g, b } = hsvToRgb(h, this.saturation(), this.brightness());
    this.hexInput.set(rgbToHex(r, g, b));
    this.emit();
  }

  onAlphaMousedown(e: MouseEvent): void {
    this._draggingAlpha = true;
    this._dragActive.set(true);
    this._moves.sync();
    this.updateAlpha(e);
  }

  private updateAlpha(e: MouseEvent): void {
    const el = this.alphaSlider()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const a = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.alpha.set(Math.round(a * 100) / 100);
    this.emit();
  }

  onGradientTouch(e: TouchEvent): void {
    const touch = e.touches[0];
    if (touch) this.updateGradient(touch as unknown as MouseEvent);
  }

  onHueTouch(e: TouchEvent): void {
    const touch = e.touches[0];
    if (touch) this.updateHue(touch as unknown as MouseEvent);
  }

  // ── Size helpers ──

  readonly triggerSizeClass = computed(() => ({
    sm: 'h-7 gap-1.5 rounded-lg px-2 text-xs',
    md: 'h-9 gap-2 rounded-xl px-3 text-sm',
    lg: 'h-11 gap-2.5 rounded-xl px-4 text-base',
  }[this.size()]));

  readonly swatchSizeClass = computed(() => ({
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }[this.size()]));

  // ── Portal lifecycle ──

  private destroyPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portalEl?.remove();
    this.portalEl = null;
  }

  // ── Validation error ─────────────────────────────────────────────────────
  //
  // This control had no error slot at all: a form could reject it with no way
  // to say why. `serverError` outranks `errorMessage` while it is still about
  // the current value, and expires on the next change — see `createFieldError`.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
  protected readonly errorId = computed(() => `${this._errUid}-error`);
  private readonly _errUid = svUniqueId('sv-color-picker');

}
