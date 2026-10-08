import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';

import {
  isSignatureEmpty,
  rescale,
  toSvg,
  type SignaturePadSize,
  type SignaturePoint,
  type SignatureStroke,
  isSigned,
  svSignatureHash,
  svSignatureRecord,
  SV_SIGNATURE_RECORD_FORMAT,
  type SignatureAttestation,
  type SignatureValue,
} from './signature-pad.types';
import { svUniqueId } from '@styloviz/core';

/**
 * SignaturePad — sign with a finger, a pen or a mouse.
 *
 * ★★★ THE THREE THINGS THAT MAKE THIS HARDER THAN IT LOOKS
 *
 * 1. **A canvas has two sizes, and getting them out of step is the whole bug.**
 *    The CSS box is what the user sees and points at; `canvas.width/height` is
 *    the bitmap. Leave the bitmap at its 300×150 default while CSS stretches it
 *    and every stroke is blurry AND lands offset from the pointer — worse the
 *    further from the origin. The bitmap has to be the box size × device pixel
 *    ratio, with the context scaled to match.
 * 2. **Resizing the canvas ERASES it.** Assigning `canvas.width` clears the
 *    bitmap, which the browser also does when the DPR changes. A pad that keeps
 *    only pixels therefore loses the signature on an orientation change, a
 *    responsive breakpoint, or a window dragged to another monitor — after the
 *    user has signed. Strokes are stored as points and re-rendered, so a resize
 *    is a redraw.
 * 3. **Pointer capture, or a stroke breaks the moment it leaves the box.**
 *    Signatures overshoot. Without capture the pad never sees the `up`, so the
 *    stroke stays open and the next touch continues it from wherever it stopped.
 *
 * ── Not a `ControlValueAccessor`, deliberately (`FI-21-I2`, `X-8`) ─────────
 *
 * ★★★ IT CANNOT BE ONE WITHOUT THROWING AWAY THE PART THAT MATTERS. A CVA
 *     moves ONE value in and out of a form control, and this component's value
 *     is not one thing: `SignatureValue` carries the stroke geometry, the
 *     typed name, and — once `attest()` has run — an
 *     attestation with the consent wording, its digest, the timestamp and the
 *     signer metadata. Collapse that into a `formControlName` and the host gets
 *     back a picture, which is exactly the failure `FI-21-M1` was filed for:
 *     E-SIGN, UETA and eIDAS care about intent, attribution and association
 *     with the record signed, and a stroke list addresses none of them.
 *
 * ★★ AND THE ATTESTATION IS ASYNCHRONOUS. `attest()` hashes the consent text,
 *    so the real value is only available from a promise — and `writeValue` /
 *    `registerOnChange` have nowhere to put one. A CVA here would have to emit
 *    the *unattested* value on every stroke and leave the host to remember to
 *    ask for the attested one before submitting, which is a footgun with a
 *    legal consequence.
 *
 * So the contract a host takes on instead, in full:
 *
 *  • Read `(signatureChange)` for a live draft, or call `value()`.
 *  • Call `await signedValue()` — NOT `value()` — for anything that will be
 *    stored or sent. It is `value()` plus a freshly computed attestation —
 *    or, for a restored record nobody has touched, the attestation it came
 *    with (see `setValue()`).
 *  • `attest()` returns `null` when there is nothing to attest to (unsigned) or
 *    no `consentText` was given. A null is not an error to swallow: it means
 *    this signature is not a record, and submitting it as one is the bug.
 *  • Validation is the host's. There is no `required` that a form group can
 *    see; use `(emptyChange)` or `isEmpty()`.
 *  • `setValue()` restores a draft, and deliberately keeps any attestation
 *    already on it rather than recomputing one — re-attesting on load would
 *    date the record to the moment it was opened.
 *
 * `svVerifySignature` is exported so a server can check the digest against the
 * consent text it believes was shown.
 *
 * @example
 * ```html
 * <sv-signature-pad label="Sign here" (signatureChange)="draft.set($event)" />
 * ```
 */
@Component({
  selector: 'sv-signature-pad',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './signature-pad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSignaturePadComponent {
  private readonly hostRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * Accessible name for the pad.
   *
   * ★ A `<canvas>` has no intrinsic name and no text inside it, so without this
   * a screen reader announces nothing at all where the signature belongs.
   *
   * @default 'Signature'
   */
  readonly label = input<string>('Signature');

  /** Helper text under the pad. @default '' */
  readonly hint = input<string>('');

  /** Height preset for the drawing area. @default 'md' */
  readonly size = input<SignaturePadSize>('md');

  /** Ink colour. Any CSS colour. @default '#111827' */
  readonly penColor = input<string>('#111827');

  /** Stroke width in CSS pixels, before pressure. @default 2 */
  readonly penWidth = input<number>(2);

  /**
   * Vary the stroke with pointer pressure where the device reports it.
   *
   * Off by default: a mouse reports a constant 0.5, so on the commonest input
   * it changes nothing but the arithmetic.
   *
   * @default false
   */
  readonly pressureSensitive = input<boolean>(false);

  /** Show the Undo / Clear toolbar. @default true */
  readonly showActions = input<boolean>(true);

  /** Show the baseline the signature sits on. @default true */
  readonly showBaseline = input<boolean>(true);

  /** Nothing can be drawn, and the actions are hidden. @default false */
  readonly disabled = input<boolean>(false);

  /** Extra classes on the root element. @default '' */
  readonly customClass = input<string>('');

  // ── The typed-name alternative (FI-21-M2) ─────────────────────────────────

  /**
   * Offer a typed name beside the pad. @default true
   *
   * ★★★ ON BY DEFAULT, AND THE LAYOUT CHANGE IS THE POINT. A `<canvas>` you must
   *     draw on cannot be operated from a keyboard — not "is awkward", cannot.
   *     A screen-reader user, a keyboard-only user and anyone with a tremor meet
   *     a required field with no path through it, and WCAG 2.1.1 has no partial
   *     credit. Defaulting this off would have shipped the fix and left every
   *     existing pad exactly as inaccessible as it was.
   *
   * Turn it off only when the host provides its own alternative route — not to
   * tidy the layout.
   */
  readonly allowTyped = input(true, { transform: booleanAttribute });

  /** Label for the typed-name field. @default 'Or type your full name' */
  readonly typedNameLabel = input<string>('Or type your full name');

  /**
   * The typed name. Two-way bindable.
   *
   * ⚠️ THE ATTESTATION WORDING IS THE HOST'S. "By typing my name I agree to…"
   *    is a legal sentence about a specific agreement, and a component that
   *    invents one is writing contracts it has not read. Put it in `hint`.
   */
  readonly typedName = model<string>('');

  /**
   * The exact wording the signer is agreeing to. Rendered above the pad, and
   * hashed into the attestation verbatim. @default '' — no consent shown.
   *
   * ── Why the component will not write this for you (`FI-21-M1`) ────────────
   *
   * ★★★ A COMPONENT THAT INVENTS LEGAL TEXT IS WRITING CONTRACTS IT HAS NOT
   *     READ. The wording is jurisdiction-specific, product-specific and
   *     language-specific, and a plausible-sounding default is worse than none:
   *     it would ship in real agreements, unread, because it looked finished.
   *
   * ★★ WITHOUT IT, `attest()` RETURNS `null`. A record whose consent field is
   *    empty attests to nothing — it says somebody drew a shape at a time — and
   *    producing one anyway would let a host believe they had evidence.
   */
  readonly consentText = input<string>('');

  /**
   * What the host knows about the signer — account id, session, IP,
   * authentication method. Opaque to the component, hashed into the
   * attestation. @default null
   *
   * ★★ THIS IS THE ATTRIBUTION HALF AND THE COMPONENT CANNOT SUPPLY IT. A
   *    canvas knows a pointer moved; it does not know who was holding it. An
   *    authenticated session id is worth more as evidence than the drawing is.
   */
  readonly signerMetadata = input<Readonly<Record<string, string>> | null>(null);

  /**
   * Per-instance id for the typed-name field's `<label for>`.
   *
   * ★ Not `Math.random()`: the server and the client would generate different
   *   ids for the same element, and hydration would either warn or silently
   *   break the association. A process-wide counter is deterministic per render
   *   pass. (The same reasoning as every other `_uid` in this kit.)
   */
  readonly typedNameId = svUniqueId('sv-signature-name');

  /**
   * Id for the consent paragraph, so the canvas and the typed-name field can
   * both point `aria-describedby` at it.
   *
   * ★ Same counter as `typedNameId`, for the same reason — a random id differs
   *   between the server render and the client hydration, and the association
   *   then silently stops existing rather than failing loudly.
   */
  readonly consentId = svUniqueId('sv-signature-consent');

  /** Id of the `hint` line, so the typed-name field can be described by it. */
  readonly hintId = svUniqueId('sv-signature-hint');

  /**
   * ★★ THE TYPED-NAME FIELD IS DESCRIBED BY THE HINT TOO (`FI-21-M2`). The
   *    template tells hosts the "By typing my name I agree…" sentence belongs
   *    in `hint` — and the hint was a bare paragraph, so a screen-reader user
   *    tabbing into the field met the name box without the sentence that says
   *    what typing into it means.
   */
  protected readonly typedNameDescribedBy = computed<string | null>(() => {
    const ids = [this.consentText() ? this.consentId : '', this.hint() ? this.hintId : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Fires when a stroke ends, on undo, and on clear. */
  readonly signatureChange = output<SignatureValue>();

  /** Fires the first time the pad goes from empty to signed, and back. */
  readonly emptyChange = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * The signature itself.
   *
   * ★ Points, not pixels — see the class comment. Everything else here is a
   * derivation of this, including whether the pad counts as signed.
   */
  private readonly strokes = signal<readonly SignatureStroke[]>([]);

  /** The stroke being drawn right now, if any. */
  private current: SignaturePoint[] | null = null;

  /** The canvas box in CSS pixels, kept for export and for rescaling. */
  private readonly box = signal<{ width: number; height: number }>({ width: 0, height: 0 });

  private lastEmpty = true;

  /** Nothing drawn on the canvas. About the CANVAS — export, undo, clear. */
  readonly isEmpty = computed<boolean>(() => isSignatureEmpty(this.strokes()));

  /**
   * The field has been completed, by either route.
   *
   * ★ Distinct from `isEmpty` on purpose: a typed name completes the field
   *   without a single stroke, and there is still nothing to undo or export.
   */
  readonly signed = computed<boolean>(() => isSigned(this.strokes(), this.typedName()));

  /** How many completed marks are on the pad. */
  readonly strokeCount = computed<number>(
    () => this.strokes().filter((s) => s.points.length > 1).length,
  );

  constructor() {
    afterNextRender(() => {
      this.resizeToBox();
      const el = this.canvasRef()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;

      /**
       * ★★ Re-render on resize rather than hope it does not happen.
       *
       * The observer fires for the responsive breakpoint, the orientation
       * change and the sidebar that just opened — each of which resets the
       * bitmap. Because the strokes are data, the answer is simply to draw
       * them again at the new size.
       */
      const observer = new ResizeObserver(() => this.resizeToBox());
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  // ── Pointer handling ──────────────────────────────────────────────────────

  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled()) return;
    const el = this.canvasRef()?.nativeElement;
    if (!el) return;

    // ★ Capture, so a signature that overshoots the box still delivers its
    // `up`. Without it the stroke never closes and the next touch continues it.
    el.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    this.current = [this.pointFrom(event, el)];
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.current || this.disabled()) return;
    const el = this.canvasRef()?.nativeElement;
    if (!el) return;
    event.preventDefault();

    const point = this.pointFrom(event, el);
    const previous = this.current[this.current.length - 1];
    // ★ Drop sub-pixel jitter. A trackpad reports hundreds of points a second,
    // most of them within the same pixel; keeping them triples the stored size
    // and changes nothing on screen.
    if (Math.abs(point.x - previous.x) < 0.5 && Math.abs(point.y - previous.y) < 0.5) return;

    this.current.push(point);
    this.drawSegment(previous, point);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.current) return;
    const el = this.canvasRef()?.nativeElement;
    el?.releasePointerCapture?.(event.pointerId);

    const stroke: SignatureStroke = { points: this.current };
    this.current = null;
    this.strokes.update((list) => [...list, stroke]);
    this.emit();
  }

  /**
   * The pointer left without an `up` we could see (a cancelled gesture, a
   * system dialog). The stroke so far is real — keep it rather than discard it.
   */
  protected onPointerCancel(event: PointerEvent): void {
    this.onPointerUp(event);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  /** Remove the last mark. Undo works on STROKES, not on points. */
  undo(): void {
    if (this.disabled() || this.strokes().length === 0) return;
    this.strokes.update((list) => list.slice(0, -1));
    this.redraw();
    this.emit();
  }

  clear(): void {
    if (this.disabled() || this.strokes().length === 0) return;
    this.strokes.set([]);
    this.redraw();
    this.emit();
  }

  /**
   * The current value, for a host that would rather pull than listen.
   *
   * For a record restored by `setValue()` and not edited since, this is that
   * record as it was given — original geometry and attestation included — so
   * its digest still verifies.
   */
  value(): SignatureValue {
    const kept = this.keptRecord();
    if (kept) return kept;
    const { width, height } = this.box();
    return { strokes: this.strokes(), width, height, typedName: this.typedName() };
  }

  /**
   * PNG data URL, or `null` when the pad is empty.
   *
   * ★★ `null`, NOT A BLANK IMAGE. `canvas.toDataURL()` on an untouched pad
   * returns a perfectly valid PNG of nothing, and a caller that stores it has
   * filed a signature that no one gave — with no way to tell it apart from one
   * that was signed in invisible ink.
   */
  toDataUrl(type = 'image/png'): string | null {
    if (this.isEmpty()) return null;
    return this.canvasRef()?.nativeElement.toDataURL(type) ?? null;
  }

  /** SVG document, or `null` when empty. A signature is a vector. */
  toSvgString(): string | null {
    const { width, height } = this.box();
    return toSvg(this.strokes(), width, height, this.penColor(), this.penWidth());
  }

  /**
   * Replay a stored signature, rescaled into the current box.
   *
   * ★★★ AN ATTESTATION ON THE VALUE IS KEPT, NOT DROPPED AND NOT RECOMPUTED.
   *     This method was documented as keeping it and did neither: `value()`
   *     rebuilt the value from the rescaled strokes, so the attestation
   *     vanished — and a host calling `signedValue()` afterwards got a FRESH
   *     one, dating the record to the moment it was opened. The stored record
   *     is now held as given and returned by `value()` / `signedValue()` until
   *     a stroke, an undo, a clear or a typed-name edit changes what is signed;
   *     from then on the old digest no longer describes the value, so it goes.
   */
  setValue(value: SignatureValue): void {
    const { width, height } = this.box();
    this.strokes.set(rescale(value, width, height));
    // ★ Restored too, or replaying a stored signature would silently drop the
    //   half of it that some hosts rely on as the attestation.
    this.typedName.set(value.typedName ?? '');
    this.restored = value.attestation
      ? { record: { ...value, typedName: value.typedName ?? '' }, strokes: this.strokes() }
      : null;
    this.redraw();
    this.emit();
  }

  /** A record restored by `setValue()` with an attestation, until it is edited. */
  private restored: { readonly record: SignatureValue; readonly strokes: readonly SignatureStroke[] } | null = null;

  /**
   * The restored record while it still describes what is on the pad. Checked
   * by identity and value rather than cleared in each edit path, because
   * `typedName` is a two-way model a host can change from outside.
   */
  private keptRecord(): SignatureValue | null {
    const r = this.restored;
    if (!r) return null;
    if (r.strokes === this.strokes() && r.record.typedName === this.typedName()) return r.record;
    this.restored = null;
    return null;
  }

  /** The typed-name field changed. */
  onTypedNameInput(event: Event): void {
    this.typedName.set((event.target as HTMLInputElement).value);
    this.emit();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Match the bitmap to the CSS box at the current device pixel ratio, then
   * redraw.
   *
   * ★★★ THE `setTransform` IS THE FIX FOR BOTH BLUR AND OFFSET. The bitmap is
   * `box × dpr` device pixels; scaling the context by `dpr` lets every other
   * line in this file keep working in CSS pixels, which is the coordinate space
   * the pointer events already report.
   */
  private resizeToBox(): void {
    const el = this.canvasRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));

    const nextW = Math.round(width * dpr);
    const nextH = Math.round(height * dpr);
    // Assigning width/height clears the bitmap, so only do it when it changed.
    if (el.width !== nextW || el.height !== nextH) {
      el.width = nextW;
      el.height = nextH;
    }
    this.box.set({ width, height });

    const ctx = el.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  private redraw(): void {
    const el = this.canvasRef()?.nativeElement;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const { width, height } = this.box();
    ctx.clearRect(0, 0, width, height);
    for (const stroke of this.strokes()) {
      for (let i = 1; i < stroke.points.length; i++) {
        this.drawSegment(stroke.points[i - 1], stroke.points[i]);
      }
    }
  }

  private drawSegment(from: SignaturePoint, to: SignaturePoint): void {
    const ctx = this.canvasRef()?.nativeElement.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = this.penColor();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.pressureSensitive()
      ? Math.max(0.5, this.penWidth() * (0.5 + to.pressure))
      : this.penWidth();
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  private pointFrom(event: PointerEvent, el: HTMLCanvasElement): SignaturePoint {
    const rect = el.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      // A mouse and a pressure-less pen both report 0.5; so does jsdom.
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    };
  }

  /**
   * Produce the attestation for what is currently signed — consent wording,
   * timestamp, signer metadata and a digest over all of it (`FI-21-M1`).
   *
   * Returns `null`, rather than a half-record, in three cases:
   *
   *   • the field is not signed — there is nothing to attest to;
   *   • `consentText` is empty — see that input; a record with no consent says
   *     only that somebody drew a shape at a time;
   *   • `crypto.subtle` is unavailable (plain `http://`, or SSR) — an
   *     attestation with a blank digest is worse than none, because it looks
   *     like one.
   *
   * ★★ ASYNC AND HOST-DRIVEN, NOT COMPUTED ON EVERY STROKE. `crypto.subtle` is
   *    a promise API, and the moment that matters is submission rather than the
   *    twentieth point of a squiggle. Call it when the host acts on the
   *    signature; the returned value is a snapshot of that instant, including
   *    its own timestamp.
   *
   * ⚠️ READ `SignatureAttestation` BEFORE RELYING ON THE HASH. It is computed in
   *    the signer's own browser by the party being attested, so it is not
   *    tamper-evidence and not a seal. What it does is bind the consent wording
   *    to the artefact and make accidental drift detectable. The evidentiary
   *    step is the server's.
   *
   * @param now injectable for tests and for a host with a trusted clock.
   */
  async attest(now: Date = new Date()): Promise<SignatureAttestation | null> {
    if (!this.signed()) return null;
    const consentText = this.consentText();
    if (consentText.trim() === '') return null;

    const signedAt = now.toISOString();
    const signer = this.signerMetadata() ?? undefined;
    const hash = await svSignatureHash(
      svSignatureRecord(this.value(), consentText, signedAt, signer),
    );
    if (hash === null) return null;

    return {
      consentText,
      signedAt,
      hash,
      hashAlgorithm: 'SHA-256',
      recordFormat: SV_SIGNATURE_RECORD_FORMAT,
      ...(signer ? { signer } : {}),
    };
  }

  /**
   * The current value with a freshly-computed attestation attached, or the
   * plain value when one cannot be produced.
   *
   * ★ The shape a host actually wants at submit time: one object to send.
   */
  async signedValue(now: Date = new Date()): Promise<SignatureValue> {
    const kept = this.keptRecord();
    if (kept) return kept;
    const attestation = await this.attest(now);
    return attestation ? { ...this.value(), attestation } : this.value();
  }

  private emit(): void {
    this.signatureChange.emit(this.value());
    // ★★ `emptyChange` reports whether the FIELD is unsigned, not whether the
    //    canvas is blank — a host wiring it to a submit button must not be told
    //    "still empty" by a pad somebody has typed their name into.
    const empty = !this.signed();
    if (empty !== this.lastEmpty) {
      this.lastEmpty = empty;
      this.emptyChange.emit(empty);
    }
  }

  // ── Classes ───────────────────────────────────────────────────────────────

  protected readonly heightClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-28';
      case 'lg': return 'h-56';
      default: return 'h-40';
    }
  });

  protected readonly rootClasses = computed<string>(() =>
    ['w-full', this.disabled() ? 'opacity-60' : '', this.customClass()].filter(Boolean).join(' '),
  );

  /** Unused today, but the host element is how a consumer measures the pad. */
  protected host(): HTMLElement {
    return this.hostRef.nativeElement as HTMLElement;
  }
}
