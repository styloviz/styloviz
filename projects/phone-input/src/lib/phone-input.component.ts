import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  TemplateRef,
  ViewChild,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { SvInputMaskComponent, type InputMaskSize, type InputMaskVariant } from '@styloviz/forms';
import { PHONE_COUNTRIES, type PhoneCountry } from './phone-countries';
import { svUniqueId } from '@styloviz/core/a11y';
import { svDigitsOnly, injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import {
  createAnchorScrollGuard,
  createPortalHost,
  svStackedPopup,
  svSuccessorIndex,
  svPositionAnchored,
  type SvPlacement,
  type SvPortalHost,
} from '@styloviz/core/overlay';
import { svLengthHint, svMaxNational, svNationalMask } from './phone-plan';
import { SvPhoneFlagComponent } from './phone-flag.component';
import { SvIconComponent } from '@styloviz/icons';
import { SV_PHONE_INPUT_LABELS } from './phone-input.labels';

import { registerPhoneInputIcons } from './phone-input.component.icons';
/**
 * SvPhoneInputComponent — a phone number field with a country picker in
 * front of it, driving `@styloviz/forms`' `sv-input-mask` `custom` mask per
 * selected country. `sv-input-mask` has no leading-content slot to project
 * a picker button into, so this renders the picker as an adjacent,
 * height-matched control instead of literally fusing into the same box —
 * `[&_input]:rounded-s-none` on the mask flattens its near (start-side)
 * corners so the seam still reads as one control.
 *
 * ## Sensitive-value boundary
 *
 * This is a **capture** surface, not a display one: it exists to collect a
 * phone number the person is typing, so the value is shown in full while they
 * type and there is no mask, reveal gate or copy action to audit. It keeps no
 * copy beyond the bound `value` / `e164`, sends nothing anywhere, and a host
 * that later DISPLAYS a stored number should mask it (e.g. `svMaskTail` from
 * `@styloviz/core`). See `docs/sensitive-value-policy.md`.
 *
 * ```html
 * <sv-phone-input [(value)]="phone" [(country)]="country" />
 * ```
 */

@Component({
  selector: 'sv-phone-input',
  standalone: true,
  imports: [NgClass, SvInputMaskComponent, SvPhoneFlagComponent, SvIconComponent],
  templateUrl: './phone-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SvPhoneInputComponent), multi: true },
  ],
})
export class SvPhoneInputComponent implements ControlValueAccessor {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerPhoneInputIcons();

  /** @internal Accessible names — English unless `provideSvLabels({ phoneInput })` says otherwise. */
  protected readonly labels = injectSvLabels('phoneInput', SV_PHONE_INPUT_LABELS);
  private readonly locale = svLocale();

  /** Formatted phone value (two-way), forwarded straight from `sv-input-mask`. */
  value = model<string>('');
  /** Selected country, by ISO 3166-1 alpha-2 code (two-way). @default 'US' */
  country = model<string>('US');
  /** Restrict the picker to a subset of the bundled countries. `null`/empty = show all. */
  countries = input<readonly string[] | null>(null);

  /**
   * Replace the bundled numbering data outright.
   *
   * ★★★ THE ANSWER TO THE PART A BIGGER TABLE CANNOT FIX. Numbering plans change
   * more often than a release cycle — new mobile prefixes, new area codes, whole
   * plans renumbered — so a table compiled into a component is stale the day it
   * ships. The bundled list is a best effort for eight countries; a host that
   * needs the other two hundred, or needs today's data, passes its own in
   * (generated from libphonenumber, fetched, whatever it keeps current) and the
   * component stops pretending to own knowledge it cannot maintain.
   * @default null
   */
  plans = input<readonly PhoneCountry[] | null>(null);
  /** Field size, forwarded to `sv-input-mask`. @default 'md' */
  size = input<InputMaskSize>('md');
  /** Disable the whole control. @default false */
  disabled = input<boolean>(false);
  /** Field label. @default 'Phone number' */
  label = input<string>(this.labels.phoneNumber);
  /** Error message, forwarded to `sv-input-mask`. */
  error = input<string>('');

  // ── Forwarded to the number field (`SR-23`) ──────────────────────────────

  /** Helper text under the control, linked to it with `aria-describedby`. @default '' */
  hint = input<string>('');
  /** Placeholder for the number field. Empty shows the plan's own shape. @default '' */
  placeholder = input<string>('');
  /** Mark the number required. @default false */
  required = input<boolean>(false);
  /** The `name` the number submits under in a native form. @default '' */
  name = input<string>('');
  /** Field style, forwarded to `sv-input-mask`. @default 'default' */
  variant = input<InputMaskVariant>('default');

  /** Id of the hint line, for `aria-describedby`. */
  protected readonly hintId = svUniqueId('sv-phone-hint');

  // ── ControlValueAccessor (`SR-23`) ───────────────────────────────────────
  //
  // ★★ DELEGATED TO THE MASK, NOT RE-IMPLEMENTED. The form value is the same
  //    formatted string `[(value)]` carries, and a written value goes through
  //    the mask's own `writeValue` — which shapes a pasted or patched E.164
  //    number exactly as a typed one. Re-doing that here would be a second
  //    copy of the rule the mask's specs already pin. Store `e164Changed`, as
  //    ever; bind the form to whatever your form displays.

  private readonly maskRef = viewChild(SvInputMaskComponent);
  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** A written value waiting for the mask to exist. */
  private _pendingWrite: string | null = null;
  /** True while a form write is landing, so it is not reported back as an edit. */
  private _writing = false;
  /** The first render has happened — the mask's inputs are bound. */
  private _rendered = false;

  /** `[disabled]` OR a disabled parent form control. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: string | null): void {
    const text = v ?? '';
    const mask = this.maskRef();
    if (!mask || !this._rendered) {
      // ★ Before the first render the mask may EXIST with its inputs not yet
      //   bound — shaping then runs against an empty mask and keeps the text
      //   whole. Show it as given, and shape it once the mask is up.
      this._pendingWrite = text;
      this.value.set(text);
      return;
    }
    this._writing = true;
    mask.writeValue(text);
    this.value.set(mask.value());
    this._writing = false;
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this._formDisabled.set(isDisabled); }

  /** The mask's value changed — a keystroke, a paste, a clear. */
  protected onMaskValue(v: string): void {
    this.value.set(v);
    if (!this._writing) this._onChange(v);
  }

  /** Focus left the whole control — the country button and the field together. */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this._onTouched();
  }

  /**
   * The extension, kept in its own field and OUT of the number.
   *
   * ★★ AN EXTENSION IS NOT PART OF A PHONE NUMBER. E.164 has no room for one —
   *    it is a country code plus a subscriber number and nothing else — so an
   *    extension typed into the main field corrupts the value that gets dialled
   *    and stored. Users type them anyway, because there is nowhere else to put
   *    them, which is exactly why the field has to exist.
   * @default ''
   */
  extension = model<string>('');

  /** Show the extension field. @default false */
  showExtension = input<boolean>(false);

  /** Emitted with the raw (unformatted) digits, forwarded from `sv-input-mask`. */
  readonly rawChanged = output<string>();

  /**
   * The value to STORE, in E.164, or `''` when there is nothing storable yet.
   *
   * ★★★ THIS IS THE ONE OUTPUT A BACKEND SHOULD PERSIST, and until now the
   *     component published no such thing: a host got the formatted display
   *     string, which carries the user's spaces, brackets and dashes, or the
   *     bare digits, which carry no country at all. Storing either is how the
   *     same person ends up in a database three times — as `(555) 123-4567`, as
   *     `5551234567`, and as `+15551234567` — and why matching a number against
   *     an inbound call fails.
   *
   * ★ The extension is deliberately NOT in it. E.164 has no extension, and
   *   appending one produces a string that looks canonical and cannot be
   *   dialled. Keep it in its own column, the way `extension` keeps it in its
   *   own field.
   */
  readonly e164 = computed<string>(() => {
    // 🔺 `svDigitsOnly`, not `replace(/\D/g, '')`: `\d` is ASCII, so a number
    //    typed on an Arabic, Bengali or Devanagari keypad came out EMPTY and the
    //    field silently had no value. `FI-16-I3` reported it against the OTP
    //    input; it was the same line here.
    if (!svDigitsOnly(this.value())) return '';
    // ★ The dial code stays on the ASCII path deliberately: it is the kit's own
    //   country table, not something a user typed, so there is nothing to
    //   normalise and a `svDigitsOnly` here would only suggest otherwise.
    const dial = this.activeCountry().dialCode.replace(/\D/g, '');
    const national = this.nationalDigits();
    return national ? `+${dial}${national}` : '';
  });

  /** Emitted whenever the storable E.164 value changes. */
  readonly e164Changed = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly applyPendingWrite = afterNextRender(() => {
    this._rendered = true;
    const pending = this._pendingWrite;
    this._pendingWrite = null;
    if (pending !== null && this.maskRef()) this.writeValue(pending);
  });

  /**
   * ★ An EFFECT rather than an emit at each call site. The storable value moves
   *   when the digits change AND when the country changes, and there are three
   *   places either can happen — a mask edit, a country pick, and a preset
   *   reset that clears the field. Emitting from each is how one of them ends up
   *   forgotten and a host quietly stores a stale number.
   */
  protected readonly publishE164 = effect(() => {
    this.e164Changed.emit(this.e164());
  });

  /**
   * Stable id so the extension label points at its own field.
   *
   * ★ A COUNTER, NOT `Math.random()`. The server and the client would pick
   *   different values, so the `for`/`id` pair would not match after hydration
   *   and the label would stop naming the field — silently, and only in the
   *   rendered application rather than in any test.
   */
  protected readonly extensionId = svUniqueId('sv-phone-ext');

  /** Digits only — an extension with punctuation in it is not dialable. */
  protected onExtensionInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.extension.set(svDigitsOnly(raw));
  }

  readonly open = signal(false);

  /** The plan table in force — the host's, or the bundled best effort. */
  private readonly planTable = computed<readonly PhoneCountry[]>(() => {
    const supplied = this.plans();
    return supplied && supplied.length ? supplied : this.bundledCountries;
  });

  /**
   * The bundled list with each name in the kit's locale (`Intl.DisplayNames`);
   * the English in `PHONE_COUNTRIES` is the fallback where `Intl` has none.
   * A host's own `plans` keep the names the host wrote.
   */
  private readonly bundledCountries: readonly PhoneCountry[] = localizedCountries(PHONE_COUNTRIES, this.locale);

  readonly availableCountries = computed<readonly PhoneCountry[]>(() => {
    const table = this.planTable();
    const allow = this.countries();
    if (!allow || allow.length === 0) return table;
    const wanted = new Set(allow.map((c) => c.toUpperCase()));
    const filtered = table.filter((c) => wanted.has(c.code.toUpperCase()));
    return filtered.length ? filtered : table;
  });

  /**
   * The highlighted row in the open list — the one `aria-activedescendant`
   * names and Enter selects.
   *
   * ★★ IT FOLLOWS THE COUNTRY, NOT THE ROW NUMBER. As a plain signal it kept
   *    its index when `countries` (or `plans`) changed under an open list:
   *    highlighting Japan, the 8th row, and then filtering to two countries
   *    left `aria-activedescendant` naming an option id that no longer
   *    existed — a screen reader announced nothing and Enter selected nothing.
   *    Now a highlighted country that survives the change stays highlighted
   *    at its new row, and one that was filtered out hands the highlight on by
   *    the kit's mutation rule (`svSuccessorIndex`, `X-12`): the row now at
   *    its place, else the one before it. The list is never empty, so the
   *    result is always a real row.
   */
  readonly activeIndex = linkedSignal<readonly PhoneCountry[], number>({
    source: this.availableCountries,
    computation: (list, previous) => {
      if (!previous) return 0;
      const highlighted = previous.source[previous.value];
      const kept = highlighted ? list.findIndex((c) => c.code === highlighted.code) : -1;
      return kept >= 0 ? kept : svSuccessorIndex(previous.value, list.length);
    },
  });

  readonly activeCountry = computed<PhoneCountry>(() => {
    const list = this.availableCountries();
    return list.find((c) => c.code === this.country()) ?? list[0];
  });

  /**
   * The mask for the NATIONAL number — the country code is not in it.
   *
   * ★★★ It used to be. `phone-intl` was `+# (###) ###-####`, so the field spent
   * a slot on a country code the picker already displays and had ten left for a
   * number that might need more — and `+#` accepted exactly one digit, which
   * made `+44` untypable. Every non-NANP country in the bundled list shared that
   * one mask.
   */
  readonly activeMask = computed(() => svNationalMask(this.activeCountry()));

  /**
   * Digits typed so far, country code excluded.
   *
   * ★★★ A NATIONAL NUMBER MAY BEGIN WITH THE SAME DIGITS AS THE DIAL CODE.
   *     Indian mobiles start with 9, and `91` is India's code — so stripping a
   *     leading `91` whenever it appeared turned the ten-digit `9198765432` into
   *     `98765432` and stored `+9198765432`, a different (and wrong) number.
   *     The code is only taken off when the value says it is there: it opens
   *     with `+` or the `00` international prefix, or it has more digits than
   *     the national plan allows, so the surplus can only be a typed code.
   */
  readonly nationalDigits = computed(() => {
    const raw = this.value().trimStart();
    const digits = svDigitsOnly(raw);
    const country = this.activeCountry();
    const dial = country.dialCode.replace(/\D/g, '');
    if (raw.startsWith('+')) {
      return digits.startsWith(dial) ? digits.slice(dial.length) : digits;
    }
    if (raw.startsWith('00') && digits.startsWith(`00${dial}`)) {
      return digits.slice(2 + dial.length);
    }
    if (digits.length > svMaxNational(country.nationalDigits) && digits.startsWith(dial)) {
      return digits.slice(dial.length);
    }
    return digits;
  });

  /**
   * What the plan expected, when it disagrees with what was typed.
   *
   * ★★ A HINT, NOT AN ERROR. The plan may be out of date — that is the premise
   * of the whole file — so a number the table calls too short may be perfectly
   * dialable. It says what it expected and leaves the judgement to the person
   * who can actually check. The E.164 ceiling is the exception, because that is
   * the format's own rule and cannot go stale.
   */
  readonly lengthHint = computed(() =>
    svLengthHint(this.nationalDigits(), this.activeCountry(), this.labels, this.locale),
  );

  private readonly _uid = svUniqueId('sv-phone');
  readonly buttonId = `${this._uid}-button`;
  readonly listboxId = `${this._uid}-listbox`;
  /**
   * Id of the visible label rendered above the row. The wrapper is a
   * `role="group"` named by it via `aria-labelledby`, so a screen reader
   * announces "Phone number" once for the control as a whole; the picker and
   * the number field each carry their own `aria-label` (`SR-03`).
   */
  readonly labelId = `${this._uid}-label`;

  /**
   * The picker button's accessible name. Combines the shared field label
   * with the selected country so the picker announces both — `aria-labelledby`
   * would win over `aria-label` and drop the country, so we put both into
   * one `aria-label` string instead (`SR-03`).
   */
  protected readonly pickerAriaLabel = computed(() => {
    const c = this.activeCountry();
    return svFormatLabel(
      this.labels.pickerName,
      { label: this.label() || this.labels.country, country: c.name, dialCode: c.dialCode },
      this.locale,
    );
  });

  protected readonly buttonSizeClass = computed<string>(() => {
    const map: Record<InputMaskSize, string> = {
      sm: 'h-8 text-xs',
      md: 'h-10 text-sm',
      lg: 'h-12 text-base',
    };
    return map[this.size()];
  });

  toggle(): void {
    if (this.resolvedDisabled()) return;
    const next = !this.open();
    this.open.set(next);
    // `activeCountry` is always drawn from `availableCountries`, so it is always
    // found — there is no "not in the list" case to fall back from.
    if (next) {
      this.activeIndex.set(this.availableCountries().indexOf(this.activeCountry()));
      this.ensurePortal();
    } else {
      this.destroyPortal();
    }
  }

  close(): void {
    this.open.set(false);
    this.destroyPortal();
  }

  /**
   * Select a country. The digits are KEPT.
   *
   * ★★ They used to be thrown away whenever the mask preset changed, which was
   * every switch between NANP and anywhere else. That made the commonest
   * correction in this control — realising the country is wrong and fixing it —
   * cost the user their number. It is safe to keep them now because the mask
   * covers the NATIONAL number only: the country code was never in the digits,
   * so changing the country re-groups them rather than re-interpreting them.
   */
  select(code: string): void {
    const target = this.availableCountries().find((c) => c.code === code);
    if (!target) return;
    this.country.set(code);
    this.close();
  }

  onButtonKeydown(e: KeyboardEvent): void {
    /**
     * ★★ FOCUS STAYS ON THE TRIGGER WHILE THE LISTBOX IS OPEN, so while it is
     *    open every list key has to work from here — not a subset of them.
     *    This handler used to treat Enter and Space as "move down one", the
     *    same as ArrowDown: a keyboard user who opened the list, arrowed to
     *    their country and pressed Enter got the NEXT country highlighted and
     *    nothing selected, and there was no key on the trigger that selected
     *    at all. ↑, Home and End did nothing either. One handler for the open
     *    list, whichever element the key arrived on, keeps the two in step.
     */
    if (this.open()) {
      this.onListKeydown(e);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.toggle();
    }
  }

  onListKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveActive(-1);
        break;
      case 'Home':
        e.preventDefault();
        this.activeIndex.set(0);
        break;
      case 'End':
        e.preventDefault();
        this.activeIndex.set(this.availableCountries().length - 1);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const c = this.availableCountries()[this.activeIndex()];
        if (c) this.select(c.code);
        break;
      }
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
      default:
        if (this.isTypeaheadKey(e)) {
          e.preventDefault();
          this.typeahead(e.key);
        }
    }
  }

  /** Characters typed in quick succession, and when the last one arrived. */
  private typeaheadBuffer = '';
  private typeaheadAt = 0;

  private isTypeaheadKey(e: KeyboardEvent): boolean {
    return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
  }

  /**
   * Type-to-select, as a native `<select>` does it.
   *
   * ★ Keystrokes within 500 ms build a prefix ("un" → United Kingdom, then
   *   United States); the same letter pressed again cycles through the countries
   *   that start with it. Matching is on the country name, case- and
   *   accent-insensitive, and never wraps onto a non-match.
   */
  private typeahead(key: string): void {
    // Never empty: `planTable` falls back to the bundled list, and so does a
    // `countries` filter that matches nothing.
    const list = this.availableCountries();
    const now = Date.now();
    const fresh = now - this.typeaheadAt > 500;
    this.typeaheadAt = now;
    const char = fold(key);
    const repeated = !fresh && this.typeaheadBuffer.length > 0 && [...this.typeaheadBuffer].every((c) => c === char);
    this.typeaheadBuffer = fresh ? char : this.typeaheadBuffer + char;
    const prefix = repeated ? char : this.typeaheadBuffer;
    // A new search, or a repeated letter, starts AFTER the current option so it
    // moves; an extended prefix starts AT it so "u", "un" does not skip ahead.
    const start = this.activeIndex() + (fresh || repeated ? 1 : 0);
    for (let step = 0; step < list.length; step++) {
      const i = (start + step) % list.length;
      if (fold(list[i].name).startsWith(prefix)) {
        this.activeIndex.set(i);
        return;
      }
    }
  }

  private moveActive(delta: number): void {
    const len = this.availableCountries().length;   // never 0 — see `typeahead`
    this.activeIndex.update((i) => (i + delta + len) % len);
  }

  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.open(),
    // The listbox is body-portaled (`SR-04`), so the surface the stack routes
    // outside clicks against is the portal, not the host.
    element: () => this.portal?.element ?? this.host.nativeElement,
  });

  // ── Body portalled listbox (`SR-04`) ──
  /**
   * The picker used to live inside the trigger's `div.relative` with
   * `position: absolute`, and every showcase card with `isolate overflow-hidden`
   * clipped it. It is now a body portaled `position: fixed` panel, re-anchored
   * via `svPositionAnchored` so it can never run off the viewport edge either.
   */
  private readonly appRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  /** The ng-template that holds the portaled listbox markup. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;
  /**
   * The picker button, captured via a template ref so the portal can
   * re-anchor against it on every open and the scroll guard can detect a
   * moved trigger (`SR-04`).
   */
  private readonly pickerBtn = viewChild<ElementRef<HTMLElement>>('pickerBtn');
  /** Read the button element, refreshing whenever the viewChild resolves. */
  protected readonly buttonRef = computed<HTMLElement | null>(
    () => this.pickerBtn()?.nativeElement ?? null,
  );
  private portal: SvPortalHost | null = null;
  private portalView: EmbeddedViewRef<object> | null = null;
  /**
   * Pixels between the trigger and the panel. Mirrors the kit's other
   * anchored surfaces — small enough to read as the same control, large
   * enough to separate them visually.
   */
  private static readonly GAP = 4;
  /**
   * Floor for the clamped panel height — below this it scrolls internally.
   * Mirrors the autocomplete's constant so the two look like one kit.
   */
  private static readonly MIN_PANEL_H = 160;
  /**
   * Minimum distance the panel keeps from any viewport edge (px).
   */
  private static readonly MARGIN = 8;

  /** Inline style object applied to the portal panel. */
  protected readonly panelStyle = signal<Record<string, string>>({});

  /**
   * Closes the panel when the trigger moves off the page while the list is
   * open. A portal that re-positions over a no-longer-visible trigger is
   * worse than closing it — the user is scrolling away, not selecting.
   */
  private readonly _scrollGuard = createAnchorScrollGuard({
    anchor: () => this.buttonRef(),
    isOpen: () => this.open(),
    onMoved: () => this.close(),
    portal: () => this.portal?.element ?? null,
    threshold: 1,
  });

  constructor() {
    // Clean up the portal on host destroy (the `DestroyRef` is the owner —
    // a `ngOnDestroy` that throws before reaching its teardown would
    // otherwise leave a static-positioned block at the end of <body>).
    this.destroyRef.onDestroy(() => this.destroyPortal());

    // Keep the highlighted country in view while ↑↓/Home/End/typeahead move
    // it — focus stays on the trigger, so the browser will not scroll the
    // list for us. `nearest` scrolls only the listbox, never the page.
    afterRenderEffect(() => {
      if (!this.open()) return;
      const id = `${this.listboxId}-opt-${this.activeIndex()}`;
      const option = this.portal?.element.querySelector<HTMLElement>(`[id="${id}"]`);
      option?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /**
   * Re-anchor rather than close on resize: on Android the soft keyboard is a
   * resize, and the same rule the autocomplete follows (`SR-01`).
   */
  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this.open()) this.ensurePortal();
  }

  /**
   * Open / re-anchor the portal. Idempotent: re-running on an open panel
   * just re-measures and re-positions it.
   */
  private ensurePortal(): void {
    if (!this.open()) return;
    if (this.portal) {
      this._calcPos();
      this.portalView?.detectChanges();
      return;
    }
    if (!this.panelTpl) return;
    this._calcPos();
    this.portal = createPortalHost({
      origin: this.host.nativeElement,
      className: 'sv-phone-portal',
      label: 'phone-input',
      destroyRef: this.destroyRef,
    });
    this.portalView = this.panelTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    // Render BEFORE inserting into the document — an unstyled panel would
    // grow the page for a tick, queue a `scroll`, and the scroll guard would
    // close the panel it had just opened. See the autocomplete's openPortal
    // for the same sequence.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portal!.element.appendChild(n));
    this.portal.attach();
    this._scrollGuard.capture();
  }

  /**
   * Position the panel under the trigger. Uses `svPositionAnchored` with
   * `bottom-start` placement (and `flip: true` for the case the trigger
   * sits near the viewport bottom), and clamps the height to whatever
   * space the chosen side has so it never runs off-screen.
   */
  private _calcPos(): void {
    const button = this.buttonRef();
    if (!button || typeof window === 'undefined') return;
    const rect = button.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Estimate the panel size: width matches the trigger; height is bounded
    // by the chosen side. `svPositionAnchored` only needs a lower bound to
    // decide which side fits, so a conservative estimate is enough.
    const estWidth = Math.min(224, vw - 2 * SvPhoneInputComponent.MARGIN);
    const sideBottom = vh - rect.bottom - SvPhoneInputComponent.MARGIN;
    const sideTop = rect.top - SvPhoneInputComponent.MARGIN;
    const preferred: SvPlacement = sideBottom < 200 && sideTop > sideBottom
      ? 'top-start'
      : 'bottom-start';
    const pos = svPositionAnchored({
      anchor: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      panel: { width: estWidth, height: Math.max(SvPhoneInputComponent.MIN_PANEL_H, sideBottom) },
      placement: preferred,
      offset: SvPhoneInputComponent.GAP,
      margin: SvPhoneInputComponent.MARGIN,
      viewport: { width: vw, height: vh },
      flip: true,
      // `bottom-start` lines up on the trigger's START edge — its right edge
      // in an RTL host, where the picker sits on the right (`SR-05`).
      rtl: getComputedStyle(button).direction === 'rtl',
    });
    const above = pos.placement.startsWith('top');
    const maxHeight = Math.max(
      SvPhoneInputComponent.MIN_PANEL_H,
      (above ? rect.top : vh - rect.bottom)
        - SvPhoneInputComponent.GAP
        - SvPhoneInputComponent.MARGIN,
    );
    // Opened ABOVE, the panel hangs from its bottom edge: its real height is
    // only known after render, so a `top` computed from the estimate would
    // leave a gap (or overlap the trigger) whenever the list is shorter or
    // taller than guessed.
    const vertical: Record<string, string> = above
      ? { bottom: `${vh - rect.top + SvPhoneInputComponent.GAP}px` }
      : { top: `${pos.top}px` };
    this.panelStyle.set({
      position: 'fixed',
      zIndex: '9999',
      ...vertical,
      left:   `${pos.left}px`,
      width:  `${estWidth}px`,
      maxHeight: `${maxHeight}px`,
      maxWidth: `${vw - SvPhoneInputComponent.MARGIN * 2}px`,
    });
  }

  private destroyPortal(): void {
    this._scrollGuard.destroy();
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portal?.destroy();
    this.portal = null;
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(e: PointerEvent): void {
    if (!this.open()) return;
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(e.target)) return;
    if (this.host.nativeElement.contains(e.target as Node)) return;
    if (this.portal?.element.contains(e.target as Node)) return;
    this.close();
  }
}

/** Lower-case and strip diacritics, so "é" matches "e". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Each country's region name in `locale`, keeping the English name where `Intl` has none. */
function localizedCountries(list: readonly PhoneCountry[], locale: string): readonly PhoneCountry[] {
  let names: Intl.DisplayNames;
  try {
    names = new Intl.DisplayNames(locale || undefined, { type: 'region' });
  } catch {
    return list;
  }
  return list.map((c) => {
    let name: string | undefined;
    try {
      name = names.of(c.code.toUpperCase());
    } catch {
      name = undefined;
    }
    return name && name !== c.code.toUpperCase() ? { ...c, name } : c;
  });
}
