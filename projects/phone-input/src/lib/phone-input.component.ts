import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvInputMaskComponent, type InputMaskSize } from '@styloviz/forms';
import { PHONE_COUNTRIES, type PhoneCountry } from './phone-countries';
import {
  svStackedPopup, svDigitsOnly,
  svSuccessorIndex,
  svUniqueId,
} from '@styloviz/core';
import { svLengthHint, svMaxNational, svNationalMask } from './phone-plan';
import { SvPhoneFlagComponent } from './phone-flag.component';
import { SvIconComponent } from '@styloviz/icons';

/**
 * SvPhoneInputComponent — a phone number field with a country picker in
 * front of it, driving `@styloviz/forms`' `sv-input-mask` `phone-us` /
 * `phone-intl` presets. `sv-input-mask` has no leading-content slot to
 * project a picker button into, so this renders the picker as an adjacent,
 * height-matched control instead of literally fusing into the same box —
 * `[&_input]:rounded-l-none` on the mask flattens its near corners so the
 * seam still reads as one control.
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
})
export class SvPhoneInputComponent {
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
  label = input<string>('Phone number');
  /** Error message, forwarded to `sv-input-mask`. */
  error = input<string>('');

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
    return supplied && supplied.length ? supplied : PHONE_COUNTRIES;
  });

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
    svLengthHint(this.nationalDigits(), this.activeCountry()),
  );

  private readonly _uid = svUniqueId('sv-phone');
  readonly buttonId = `${this._uid}-button`;
  readonly listboxId = `${this._uid}-listbox`;

  /**
   * The picker button's accessible name. Explicit rather than left to
   * content-derived computation, because this control also sits beside
   * `sv-input-mask`'s own `<label for>` — an ambient outer label would win
   * over the button's flag+text content and announce "Phone number" instead
   * of the selected country.
   */
  protected readonly pickerAriaLabel = computed(() => {
    const c = this.activeCountry();
    return `Country: ${c.name} (${c.dialCode})`;
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
    if (this.disabled()) return;
    const next = !this.open();
    this.open.set(next);
    // `activeCountry` is always drawn from `availableCountries`, so it is always
    // found — there is no "not in the list" case to fall back from.
    if (next) this.activeIndex.set(this.availableCountries().indexOf(this.activeCountry()));
  }

  close(): void {
    this.open.set(false);
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
    element: () => this.host.nativeElement,
  });

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(e: PointerEvent): void {
    if (!this.open()) return;
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(e.target)) return;
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }
}

/** Lower-case and strip diacritics, so "é" matches "e". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
