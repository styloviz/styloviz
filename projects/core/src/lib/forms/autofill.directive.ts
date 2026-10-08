import {
  CSP_NONCE,
  Directive,
  ElementRef,
  PLATFORM_ID,
  inject,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Name of the keyframes that fire when a control ENTERS the autofilled state.
 * Exported so a host can recognise the event if it listens itself.
 */
export const SV_AUTOFILL_START = 'sv-autofill-start';
/** Name of the keyframes that fire when a control LEAVES the autofilled state. */
export const SV_AUTOFILL_END = 'sv-autofill-end';

/**
 * The stylesheet, injected once per document.
 *
 * Both keyframes are **empty** — `from {} to {}`. They animate nothing and are
 * never visible; they exist only because entering or leaving `:autofill`
 * restarts an animation, and `animationstart` is the one event the browser
 * fires for a fill that fires no input event. Nothing here is affected by
 * `prefers-reduced-motion`, because nothing here moves.
 *
 * ── Scoped to `[svAutofill]`, and that is not cosmetic ──────────────────────
 *
 * ⚠️ The first draft matched `input, textarea, select`. Measured against real
 *    Chromium, that **trampled a consumer's own animation on their own input**:
 *    `input:not(:-webkit-autofill)` is specificity (0,1,1) and beats a plain
 *    `.my-spinner` at (0,1,0), so `animation-name` was overwritten on every
 *    text input in the host application, kit-owned or not. Scoping to the
 *    attribute limits the blast radius to controls that opted in.
 *
 *    The remaining limitation, measured the same way: on a control that DOES
 *    carry `svAutofill`, this wins over a host's `animation-name`. Animate a
 *    wrapper rather than the native control itself.
 */
const STYLE = `
@keyframes ${SV_AUTOFILL_START} { from {} to {} }
@keyframes ${SV_AUTOFILL_END} { from {} to {} }
[svAutofill]:-webkit-autofill {
  animation-name: ${SV_AUTOFILL_START};
  animation-duration: 1ms;
}
[svAutofill]:not(:-webkit-autofill) {
  animation-name: ${SV_AUTOFILL_END};
  animation-duration: 1ms;
}
`;

/** Documents this stylesheet has already been added to. */
const INSTALLED = new WeakSet<Document>();

function installStyles(doc: Document, nonce: string | null): void {
  if (INSTALLED.has(doc)) return;
  INSTALLED.add(doc);
  const el = doc.createElement('style');
  // Honoured when the app sets Angular's CSP_NONCE. Without it a strict
  // `style-src` policy drops the sheet, the animation never runs, and the
  // detector silently reports "never autofilled" — the pre-existing behaviour,
  // so a strict-CSP app is no worse off than before, only not better.
  if (nonce) el.setAttribute('nonce', nonce);
  el.textContent = STYLE;
  doc.head.appendChild(el);
}

/**
 * Report whether this control has been filled by the browser.
 *
 * ── Why this cannot be done with an event listener ───────────────────────────
 *
 * ★★ CHROME'S PAGE-LOAD AUTOFILL FIRES NO `input` EVENT. It sets the element's
 *    `value` directly and marks it `:autofill`; the `input` event arrives later,
 *    on the user's first interaction — or never, if they submit without
 *    touching the field. Everything downstream that is driven by a signal fed
 *    from `(input)` is therefore stale at exactly the moment the field is
 *    full: a floating label sits on top of the filled text, a "clear" button
 *    stays hidden, a character counter reads zero.
 *
 *    There is no event for it. What there IS: entering `:autofill` restarts any
 *    animation the selector declares, which fires `animationstart` — a real
 *    event, on the element, at the right moment. The keyframes above animate
 *    nothing; they are a notification channel wearing an animation's clothes.
 *    This is the standard technique for the same reason everywhere: it is the
 *    only one.
 *
 * ── What it does NOT tell you ───────────────────────────────────────────────
 *
 * The element's `value` is readable, but a password field filled on load is
 * masked to script until the user interacts with the page — `el.value` comes
 * back empty. So treat this as "the browser has put something here", which is
 * what a label needs to know, and not as a value.
 *
 * ```html
 * <input #inputEl svAutofill />
 * ```
 * ```ts
 * private readonly autofill = viewChild(SvAutofillDirective);
 * readonly labelIsFloated = computed(() =>
 *   this.isFocused() || !!this.value() || !!this.autofill()?.autofilled(),
 * );
 * ```
 */
@Directive({
  selector: '[svAutofill]',
  standalone: true,
  host: {
    '(animationstart)': '_onAnimationStart($event)',
    '(input)': '_onInput($event)',
  },
})
export class SvAutofillDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly nonce = inject(CSP_NONCE, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _autofilled = signal(false);

  /** Whether the browser has filled this control. */
  readonly autofilled = this._autofilled.asReadonly();

  /** Emitted when the autofilled state changes. */
  readonly autofillChange = output<boolean>();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    // ── There is deliberately no `el.matches(':autofill')` probe here ──────
    //
    // The obvious worry is a fill that landed before this directive existed,
    // with its animation already started and its event already missed. It
    // cannot happen: the stylesheet that declares the animation is installed by
    // THIS constructor, and a CSS animation begins when its declaration begins
    // to apply — so for an element that is already filled, the animation starts
    // the moment the sheet lands, which is after the listener is attached.
    //
    // Worth recording because the probe was written first, and jsdom answers
    // `true` to `matches(':autofill')` for EVERY input — a pseudo-class it does
    // not implement but does parse. Every text field in the kit reported itself
    // autofilled under test. The redundant line was the whole bug.
    installStyles(this.el.nativeElement.ownerDocument, this.nonce);
  }

  protected _onAnimationStart(event: AnimationEvent): void {
    if (event.animationName === SV_AUTOFILL_START) this._set(true);
    else if (event.animationName === SV_AUTOFILL_END) this._set(false);
  }

  /**
   * The user typed, so whatever the browser put here is no longer what is in
   * the field — and the host's own value signal is authoritative again.
   *
   * Not left to the `:autofill` end-animation alone: browsers differ on whether
   * editing an autofilled field clears the state, and a label that stayed
   * floated because of a fill the user has since replaced is reporting
   * something that is no longer true.
   *
   * ★★ ONLY AN `InputEvent` IS THE USER. Measured in Chrome 153
   *    (`scripts/probes/autofill-real-chrome.mjs`): a page-load password fill
   *    fires `animationstart` and THEN a trusted `input` per field — a plain
   *    `Event`, not an `InputEvent`. Treating that as typing flipped
   *    `autofilled()` back to `false` while the field was still filled. Typing,
   *    deleting, pasting and dropping all arrive as `InputEvent`s.
   */
  protected _onInput(event: Event): void {
    if (typeof InputEvent !== 'undefined' && !(event instanceof InputEvent)) return;
    this._set(false);
  }

  private _set(next: boolean): void {
    if (this._autofilled() === next) return;
    this._autofilled.set(next);
    this.autofillChange.emit(next);
  }
}
