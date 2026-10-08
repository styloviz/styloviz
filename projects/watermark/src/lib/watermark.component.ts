import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { svElementSize, svWarnOnce, svUniqueId } from '@styloviz/core';
import {
  svLooksLikeEmail,
  svOpacityLabel,
  svOpacityVerdict,
  svRowOffset,
  svTileCount,
  svTileSize,
  svWatermarkLabel,
  svViewerToken,
  svWatermarkSignature,
} from './watermark.tile';

export type WatermarkVariant =
  /** Tiled across the whole box. */
  | 'tiled'
  /** One mark, centred. */
  | 'single'
  /** Tiled, plus a note about what the mark is and is not. */
  | 'inspect';

/**
 * `<sv-watermark>` — a tiled overlay, tiled correctly.
 *
 * ★★★ THE TILE IS SIZED FROM THE ROTATED BOX. Every implementation computes the
 * repeat from the text's own width and height and then rotates it, which at any
 * angle but zero overlaps vertically and gaps horizontally — a moiré of clipped,
 * colliding text that looks like a rendering bug.
 */
@Component({
  selector: 'sv-watermark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './watermark.component.html',
})
export class SvWatermarkComponent {
  private readonly uid = svUniqueId('sv-wm');
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');
  private readonly probe = viewChild<ElementRef<HTMLElement>>('probe');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Presentation: `'tiled'` across the whole box, one centred `'single'` mark, or `'inspect'` (tiled plus a note on what the mark is and is not). @default 'tiled' */
  readonly variant = input<WatermarkVariant>('tiled');

  /**
   * The mark.
   *
   * ⚠️ PRIVACY: whatever you put here is published to every screenshot, screen
   * share and support ticket the page appears in — and to the DOM, the
   * visually-hidden label and the `data-sv-signature` attribute. Do not put a
   * viewer's name or email here; bind `viewerId` (or a server-minted token)
   * instead. Dev mode warns once when the text looks like an email address.
   * @default 'Confidential'
   */
  readonly text = input<string>('Confidential');

  /**
   * An id identifying the viewer, hashed into an opaque token by
   * `svViewerToken(viewerId, viewerSalt)` and appended to the mark as
   * `text · token`. The raw id never reaches the DOM.
   *
   * ★★ THE TOKEN IDENTIFIES THE VIEWER ONLY TO WHOEVER CAN MAP IT BACK — your
   * server — rather than to every recipient of every screenshot. It is a hash,
   * not a secret: see `svViewerToken` for why a guessable id space needs a salt.
   * @default null — no token, the mark is `text` alone
   */
  readonly viewerId = input<string | number | null>(null);

  /** Salt mixed into the viewer token. Use a per-deployment value the client cannot guess. @default '' */
  readonly viewerSalt = input<string>('');

  /** Rotation in degrees. @default -30 */
  readonly angle = input<number>(-30);

  /** 0–1. Outside roughly 0.04–0.25 the mark stops working — see `opacityVerdict`. @default 0.08 */
  readonly opacity = input<number>(0.08);

  /** Font size in px. @default 14 */
  readonly fontSize = input<number>(14);

  /** Extra space between marks, in px. @default 80 / 60 */
  readonly gapX = input<number>(80);
  /** Extra vertical space between rows of marks, in px. @default 60 */
  readonly gapY = input<number>(60);

  /**
   * Offset every other row by half a tile.
   *
   * ★★ A square grid reads as columns, and columns leave clean vertical stripes
   * a screenshot can be cropped to.
   * @default true
   */
  readonly stagger = input<boolean>(true);

  /**
   * Re-tile automatically when the box resizes (a `ResizeObserver` through
   * `svElementSize`, throttled to one measurement per frame) and when web fonts
   * finish loading. Turn it off to drive `measure()` yourself — e.g. for a box
   * whose size you already track, or in a test.
   *
   * ★★ WITHOUT IT A RESIZED BOX KEEPS THE TILING IT WAS MEASURED AT — gaps down
   * one edge when it grows, marks stacked past the clip when it shrinks. The
   * observer measures the border box on the first render, so the first paint is
   * already tiled; the server renders no marks (zero size) and the browser tiles
   * on hydration.
   * @default true
   */
  readonly observeResize = input<boolean>(true);

  /**
   * Emitted by `checkIntegrity()` when the mark in the DOM no longer matches the
   * signature the host captured.
   *
   * ★★★ WHAT IT PROVES, PRECISELY: that at the moment of the check, in this
   * browser, the rendered overlay was missing, hidden, or carried a different
   * configuration (text, angle, opacity, font size) than the one expected — i.e.
   * a client-side DOM mutation, or a configuration change, was observed.
   *
   * ⚠️ WHAT IT DOES NOT PROVE: that the content is protected, that nobody
   * screenshotted it first, that a silent check means the mark was intact (the
   * check runs in the same page an attacker controls; they can stub it, block the
   * event, or copy the content out of the DOM without touching the overlay), or
   * anything a compliance control needs — it is not an audit record, not
   * tamper-evident, and not server-verified. The mark is not restored. Watermarking
   * is deterrence, not security: treat this event as a telemetry hint, never as a
   * control. A durable mark is burned in on the server (an exported PDF or image).
   */
  readonly tampered = output<void>();

  // ── Measured state ────────────────────────────────────────────────────────

  readonly boxWidth = signal(0);
  readonly boxHeight = signal(0);

  /**
   * The rendered width of one unrotated mark, read from a hidden probe after web
   * fonts have loaded — keyed by the text and size it was measured for, so a
   * stale reading is never applied to a new text.
   */
  private readonly measuredText = signal<{ key: string; width: number } | null>(null);

  /** The box's border-box size, observed. Zero on the server and when `observeResize` is off. */
  private readonly observedSize = svElementSize(() =>
    this.observeResize() ? (this.box()?.nativeElement ?? null) : null,
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  /** The viewer token, or `null` when no `viewerId` is bound. */
  readonly viewerToken = computed(() => {
    const id = this.viewerId();
    return id === null || id === '' ? null : svViewerToken(id, this.viewerSalt());
  });

  /** What is actually drawn: `text`, plus ` · token` when a viewer id is bound. */
  readonly markText = computed(() => {
    const token = this.viewerToken();
    return token === null ? this.text() : `${this.text()} · ${token}`;
  });

  private readonly textKey = computed(() => `${this.fontSize()}|${this.markText()}`);

  /**
   * ★★ THE TEXT BOX IS ESTIMATED FROM THE FONT SIZE UNTIL IT CAN BE MEASURED.
   * 0.58em per character is the usual average advance for a proportional face,
   * and the gap absorbs the error. Once the page's web fonts have loaded, the
   * width of a real (hidden, unrotated) mark replaces the estimate — otherwise a
   * font swap after first paint shifts every mark while the tiling stays sized
   * for the fallback face.
   */
  readonly textWidth = computed(() => {
    const measured = this.measuredText();
    if (measured && measured.key === this.textKey() && measured.width > 0) return measured.width;
    return this.markText().length * this.fontSize() * 0.58;
  });
  readonly textHeight = computed(() => this.fontSize() * 1.4);

  readonly tile = computed(() =>
    svTileSize(this.textWidth(), this.textHeight(), this.angle(), this.gapX(), this.gapY()),
  );

  readonly counts = computed(() => svTileCount(this.boxWidth(), this.boxHeight(), this.tile()));

  readonly rows = computed(() => Array.from({ length: this.counts().rows }, (_, i) => i));
  readonly cols = computed(() => Array.from({ length: this.counts().cols }, (_, i) => i));

  readonly markCount = computed(() => this.counts().rows * this.counts().cols);

  readonly opacityVerdict = computed(() => svOpacityVerdict(this.opacity()));
  readonly opacityLabel = computed(() => svOpacityLabel(this.opacity()));

  readonly signature = computed(() =>
    svWatermarkSignature(this.markText(), this.angle(), this.opacity(), this.fontSize()),
  );

  readonly label = computed(() =>
    svWatermarkLabel(this.markText(), this.variant() === 'single' ? 1 : this.markCount(), this.angle()),
  );

  constructor() {
    // The observer's reading drives the tiling. Manual `measure()` still works
    // alongside it; whichever ran last wins, and both read the border box.
    effect(() => {
      const size = this.observedSize();
      if (!this.observeResize()) return;
      this.boxWidth.set(size.width);
      this.boxHeight.set(size.height);
    });

    // A new text or size needs a new probe reading — after the probe re-renders.
    effect(() => {
      this.textKey();
      untracked(() => afterNextRender(() => this.measureText(), { injector: this.injector }));
    });

    // ★ PRIVACY: an email in a mark leaks to every screenshot. Warn, don't refuse
    //   — the component cannot know the host's policy, only that this looks risky.
    // ⚠️ REDACTED: the warning must not become a second leak. The value never
    //   reaches the console (log collectors, shared devtools screenshots) and the
    //   warn-once key is a constant, so it is not retained in the dedupe `Set`
    //   either — one warning per app session, whatever the address.
    effect(() => {
      if (svLooksLikeEmail(this.markText())) {
        svWarnOnce(
          'watermark-email',
          'sv-watermark: the mark text looks like it contains an email address (value redacted). ' +
            'It will appear in every screenshot and screen share of this page. ' +
            'Bind [viewerId] to carry an opaque token instead.',
        );
      }
    });

    // ★ An unsalted token of a sequential id (user 1041, 1042…) can be reversed
    //   by hashing the candidates. Warn once; the id itself is never logged.
    effect(() => {
      const id = this.viewerId();
      if (id !== null && id !== '' && this.viewerSalt() === '') {
        svWarnOnce(
          'watermark-unsalted-viewer',
          'sv-watermark: [viewerId] is set without [viewerSalt]. An unsalted token of a guessable id ' +
            '(a sequential user number) can be reversed by hashing candidates — bind a per-deployment salt.',
        );
      }
    });

    this.watchFonts();
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  /** Re-read the box size (and the rendered text width). Automatic unless `observeResize` is off. */
  measure(): void {
    const el = this.box()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.boxWidth.set(rect.width);
    this.boxHeight.set(rect.height);
    this.measureText();
  }

  /**
   * Compare the rendered mark with a signature captured earlier, and emit
   * `tampered` when they differ. See `tampered` for what that does and does not
   * prove.
   *
   * ★★★ A WATERMARK ONE DEVTOOLS KEYSTROKE CAN DELETE IS DECORATION — and this
   * is deliberately NOT a security control. Anything rendered client-side can be
   * removed by somebody with the page source; the point is to defeat the casual
   * crop-and-share, which covers almost every real leak.
   *
   * It checks the configuration AND the DOM: the overlay must still be in the
   * component, visible (`display`/`visibility`), untransformed, at the
   * configured opacity, and carry the expected signature; and every mark in it
   * must be present (the expected count), carry the expected text, and still
   * paint (not hidden, transparent or zero-size). A deleted, hidden or edited
   * overlay or mark fails.
   */
  checkIntegrity(expected: string): boolean {
    const intact = this.signature() === expected && this.overlayIntact(expected);
    if (!intact) this.tampered.emit();
    return intact;
  }

  rowOffset(row: number): number {
    return svRowOffset(row, this.tile().width, this.stagger());
  }

  wmId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private overlayIntact(expected: string): boolean {
    const box = this.box()?.nativeElement;
    const el = this.overlay()?.nativeElement;
    if (!box || !el || !box.contains(el)) return false;
    if (el.getAttribute('data-sv-signature') !== expected) return false;
    if (el.getAttribute('aria-hidden') !== 'true') return false;
    if (el.style.opacity !== String(this.opacity())) return false;
    // ★ The marks themselves, not just their container: deleting the children,
    //   blanking their text or hiding them one by one leaves the overlay intact.
    const marks = [...el.querySelectorAll<HTMLElement>('[data-sv-mark]')];
    const expectedCount = this.variant() === 'single' ? 1 : this.rows().length * this.cols().length;
    if (marks.length !== expectedCount) return false;
    const text = this.markText();
    if (marks.some((m) => (m.textContent ?? '').trim() !== text)) return false;
    const view = this.document.defaultView;
    if (view) {
      const style = view.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.transform && style.transform !== 'none') return false;
      if (marks.some((m) => svMarkHidden(view.getComputedStyle(m)))) return false;
    }
    return true;
  }

  /** Read the rendered width of one unrotated mark. jsdom and the server report zero, which keeps the estimate. */
  private measureText(): void {
    const el = this.probe()?.nativeElement;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    if (width > 0) this.measuredText.set({ key: this.textKey(), width });
  }

  /**
   * ★★ FONT LOADING SHIFTS THE MARKS AFTER PAINT. The first render uses the
   * fallback face; when the web font arrives every mark changes width while the
   * tiling stays sized for the old one. `document.fonts.ready` covers the
   * initial load and `loadingdone` covers fonts loaded later (a lazy route, a
   * `font-display: swap` arriving late). SSR-safe: no `document.fonts`, no-op.
   */
  private watchFonts(): void {
    const fonts = (this.document as Document | undefined)?.fonts;
    if (!fonts) return;
    let alive = true;
    const remeasure = (): void => {
      if (alive && this.observeResize()) this.measure();
    };
    fonts.ready.then(remeasure, () => undefined);
    fonts.addEventListener?.('loadingdone', remeasure);
    inject(DestroyRef).onDestroy(() => {
      alive = false;
      fonts.removeEventListener?.('loadingdone', remeasure);
    });
  }
}

/** A mark that is still in the DOM but no longer paints anything readable. */
function svMarkHidden(style: CSSStyleDeclaration): boolean {
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  if (style.opacity !== '' && Number(style.opacity) === 0) return true;
  if (style.color === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(style.color)) return true;
  if (style.fontSize !== '' && parseFloat(style.fontSize) === 0) return true;
  return false;
}
