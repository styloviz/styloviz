import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SvFieldErrorComponent, createFieldError, svDigitsOnly, svNormalizeDigits, type SvServerError, svUniqueId } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type InputMaskPreset = 'phone-us' | 'phone-intl' | 'credit-card' | 'date' | 'time' | 'ssn' | 'zip' | 'ip' | 'custom';
export type InputMaskSize   = 'sm' | 'md' | 'lg';

/**
 * Whether this field's value is regulated or personally identifying.
 *
 * ── Why a masked input needs to answer this at all (`FI-13-I1` / `FI-13-M3`) ─
 *
 * ★★★ FORMATTING A CARD NUMBER PUTS THE HOST'S PAGE IN PCI SCOPE, AND THE
 *     COMPONENT IS WHERE THAT STARTS. A payment page that never touches the PAN
 *     — an iframe or a hosted field from the processor — is SAQ-A. The moment a
 *     script on the merchant's own page can read the digits, it is SAQ-A-EP:
 *     a different questionnaire, a different set of obligations, and a scope
 *     that now includes everything else loaded on that page.
 *
 *     `<sv-input-mask preset="credit-card">` is a script on the merchant's page
 *     that can read the digits. That is not a defect — a merchant may have
 *     perfectly good reasons — but it is a consequence nobody should discover
 *     from an assessor.
 *
 * ★★★ AND THE LEAK NOBODY PLANS FOR IS SESSION REPLAY. FullStory, Hotjar,
 *     Datadog RUM, Clarity, Smartlook and LogRocket record the DOM, including
 *     what is typed into inputs, and ship it to a third party. A "masked" card
 *     field is masked to the eye and completely legible to a replay recorder —
 *     which means the PAN leaves the page, unencrypted, to a vendor who is not
 *     in anybody's scope document. Every one of those tools honours an opt-out
 *     attribute, and this component sets all of them for a sensitive preset so
 *     nobody has to know the list.
 *
 * `'auto'` means `credit-card` and `ssn` are sensitive and everything else is
 * not. Say `'sensitive'` for a custom mask that carries something regulated —
 * a national ID, a policy number, a date of birth.
 */
export type InputMaskSensitivity = 'auto' | 'sensitive' | 'ordinary';
export type InputMaskVariant = 'default' | 'filled' | 'ghost';

const PRESETS: Record<InputMaskPreset, { mask: string; placeholder: string; label: string }> = {
  'phone-us':    { mask: '(###) ###-####',     placeholder: '(555) 555-1234',  label: 'Phone (US)'      },
  'phone-intl':  { mask: '+# (###) ###-####',  placeholder: '+1 (555) 555-1234', label: 'Phone (Intl)' },
  'credit-card': { mask: '#### #### #### ####', placeholder: '1234 5678 9012 3456', label: 'Credit Card' },
  'date':        { mask: '##/##/####',          placeholder: 'MM/DD/YYYY',      label: 'Date'            },
  'time':        { mask: '##:##',               placeholder: 'HH:MM',           label: 'Time'            },
  'ssn':         { mask: '###-##-####',         placeholder: '123-45-6789',      label: 'SSN'             },
  'zip':         { mask: '#####-####',          placeholder: '12345-6789',       label: 'ZIP+4'           },
  'ip':          { mask: '###.###.###.###',     placeholder: '192.168.001.001',  label: 'IP Address'      },
  'custom':      { mask: '',                    placeholder: '',                  label: 'Custom'          },
};

/**
 * The mask's token alphabet.
 *
 * ★★★ `#` WAS THE ONLY TOKEN, WHICH IS WHY A UK POSTCODE CAME OUT AS `11`.
 *     A mask made only of digit slots cannot hold a letter, and the extraction
 *     in front of it deleted every non-digit — so `SW1A 1AA` (a real address)
 *     lost its letters and the two surviving digits were poured into the first
 *     two slots. Nothing was rejected. Something else was accepted.
 *
 * `A` and `*` are additive: no existing preset uses them, so every mask that
 * worked before works identically.
 */
const MASK_TOKENS: Record<string, (ch: string) => boolean> = {
  '#': (ch) => /\p{Nd}/u.test(ch),
  'A': (ch) => /\p{L}/u.test(ch),
  '*': (ch) => /[\p{L}\p{Nd}]/u.test(ch),
};

const isToken = (ch: string): boolean => Object.prototype.hasOwnProperty.call(MASK_TOKENS, ch);

/**
 * Pull out the characters this mask's slots can actually hold, in order.
 *
 * ★★★ THE OLD PATH WAS `extractDigits(value)` FOR EVERY MASK, which is where
 *     all six of the measured manglings come from. It is not "get the digits",
 *     it is "throw away everything that is not a digit and slide the rest up" —
 *     so a character the mask could not hold did not stop anything, it SHIFTED
 *     the remainder by one place and produced a different, well-formed-looking
 *     value.
 *
 * ⚠️ IT IS STILL GREEDY, AND DELIBERATELY. A character that fits no remaining
 *    slot is skipped rather than aborting the parse, because a user typing
 *    `(555) 010-9999` into `(###) ###-####` is typing the literals too and
 *    those must not count as input. What changes is that the skipped
 *    characters are now COUNTED — see `svMaskFit` — instead of vanishing.
 */
function extractForMask(value: string, mask: string): { filled: string; skipped: number } {
  const chars = Array.from(value);
  const m = Array.from(mask);
  const isAlnum = (ch: string): boolean => /[\p{L}\p{Nd}]/u.test(ch);

  let filled = '';
  let skipped = 0;
  let vi = 0;
  let mi = 0;

  /**
   * ★★★ IT WALKS THE MASK, NOT JUST THE MASK'S SLOTS, and the existing suite
   *     is what taught me the difference. A mask may pin a LITERAL DIGIT —
   *     `'1##'` for a country code — and that literal is indistinguishable
   *     from input to anything counting only `#` positions. My first version
   *     collected slots and ignored literals, so `'123'` into `'1##'` filled
   *     both slots with `1` and `2`, overflowed the `3`, and rendered `'12'`.
   *     `input-mask.edges.spec.ts` had a test for exactly that, written before
   *     any of this, and it went red immediately.
   */
  while (vi < chars.length) {
    const ch = chars[vi];

    if (mi >= m.length) {
      // Past the end of the mask: a real character here is input with nowhere
      // to go. Punctuation is not.
      if (isAlnum(ch)) skipped++;
      vi++;
      continue;
    }

    const mc = m[mi];
    if (isToken(mc)) {
      if (MASK_TOKENS[mc](ch)) { filled += ch; vi++; mi++; }
      else if (isAlnum(ch)) { skipped++; vi++; }  // a letter in a digit slot
      else { vi++; }                              // punctuation typed around it
    } else if (ch === mc) {
      vi++; mi++;                                 // the user typed the literal
    } else {
      mi++;                                       // skip the literal, retry `ch`
    }
  }
  return { filled, skipped };
}

function applyMask(raw: string, mask: string): string {
  let result = '';
  let rIdx   = 0;
  for (let i = 0; i < mask.length && rIdx < raw.length; i++) {
    if (isToken(mask[i])) {
      result += raw[rIdx++] ?? '';
    } else {
      result += mask[i];
      // Consume matching literal in raw
      if (raw[rIdx] === mask[i]) rIdx++;
    }
  }
  return result;
}

/**
 * Every decimal digit in `val`, as ASCII.
 *
 * 🔺 THIS WAS `val.replace(/\D/g, '')`, WHICH DELETES THE VALUE RATHER THAN ITS
 *    PUNCTUATION. `\d` is ASCII `0`–`9`, so a phone number or a card number
 *    typed on an Arabic, Bengali or Devanagari keypad — or pasted from a
 *    Japanese IME in fullwidth — came out empty. Same defect as `FI-16-I3` in
 *    the OTP input, same line, different package: fixed in both rather than in
 *    the one that was reported.
 */
function extractDigits(val: string): string {
  return svDigitsOnly(val);
}

// ─── Calendar-aware validation (date / time presets) ──────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 31;
}

/**
 * Validates a partial or complete MMDDYYYY digit string against real calendar
 * rules, so an invalid date (month 13, day 32, Feb 30, Feb 29 on a non-leap
 * year…) can never be fully typed — invalid keystrokes are rejected the
 * moment they'd make the date impossible, not just after the fact.
 * An empty string is always valid (nothing typed yet).
 */
function isValidPartialDate(raw: string): boolean {
  if (!raw) return true;

  // Month, first digit: only 0 or 1 can ever start a valid month.
  if (raw[0] !== '0' && raw[0] !== '1') return false;

  // Month, both digits: must be 01–12.
  if (raw.length >= 2) {
    const month = Number(raw.slice(0, 2));
    if (month < 1 || month > 12) return false;
  }

  const month = raw.length >= 2 ? Number(raw.slice(0, 2)) : 0;

  // Day, first digit: bounded by the tens digit of the month's max day count.
  // Feb is checked leniently (up to 29) until the year narrows it down below.
  if (raw.length >= 3) {
    const maxDay = month ? daysInMonth(month, 2000 /* leap-tentative */) : 31;
    if (Number(raw[2]) > Math.floor(maxDay / 10)) return false;
  }

  // Day, both digits: must be within the month's day count.
  if (raw.length >= 4) {
    const day = Number(raw.slice(2, 4));
    const maxDay = month ? daysInMonth(month, 2000) : 31;
    if (day < 1 || day > maxDay) return false;
  }

  // Once the year is fully typed, re-check the day against the *real*
  // leap-year rule — a Feb 29 accepted tentatively above may turn out
  // invalid once the year completes.
  if (raw.length === 8) {
    const day  = Number(raw.slice(2, 4));
    const year = Number(raw.slice(4, 8));
    if (year < 1 || day > daysInMonth(month, year)) return false;
  }

  return true;
}

/** Validates a partial or complete HHMM digit string (24-hour clock). */
function isValidPartialTime(raw: string): boolean {
  if (!raw) return true;
  if (Number(raw[0]) > 2) return false;
  if (raw.length >= 2 && Number(raw.slice(0, 2)) > 23) return false;
  if (raw.length >= 3 && Number(raw[2]) > 5) return false;
  if (raw.length >= 4 && Number(raw.slice(2, 4)) > 59) return false;
  return true;
}

/**
 * Builds the longest prefix of `fullRaw` that stays calendar-valid throughout,
 * for presets where "invalid" values (bad dates/times) must never be
 * enterable. Handles typing, backspace and paste uniformly: it re-validates
 * from scratch and simply stops at the first character that would break
 * validity, silently dropping anything after it. Presets other than
 * `date`/`time` are returned unchanged.
 */
function buildValidRaw(fullRaw: string, preset: InputMaskPreset): string {
  if (preset !== 'date' && preset !== 'time') return fullRaw;
  const validate = preset === 'date' ? isValidPartialDate : isValidPartialTime;
  let acc = '';
  for (const ch of Array.from(fullRaw)) {
    const next = acc + ch;
    // ★★ Validated as ASCII, kept in the user's script. The validators read
    //    `raw[0] !== '0'` and `Number(raw[2])`, and `Number('١')` is `NaN` — so
    //    before this a date typed in Arabic-Indic digits was refused at its
    //    FIRST keystroke and the field stayed empty (`FI-16-I3`, one more site).
    if (!validate(svNormalizeDigits(next))) break;
    acc = next;
  }
  return acc;
}

/**
 * `text` without a leading, MARKED country code — or `text` unchanged.
 *
 * ── Why this is a function every path calls (`FI-13-I3` / `FI-13-M2`) ──────
 *
 * ★★★ AUTOFILL IS NOT A PASTE. It arrives as an `input` event, so a rule that
 *     lived only in `onPaste` left `autocomplete="tel"` — which this component
 *     sets on `phone-us` — filling `+15550109999` and rendering
 *     `(155) 501-0999`: the exact mangling `FI-13-I3` measured, through the
 *     other door it named. A form's `writeValue` of an E.164 value was the
 *     third door. Typing is unaffected: a typed `+` is gone at the keystroke
 *     that made it, so a typed value never starts with a marker.
 *
 * ★★ THE RULE IS THE ONE THE DOCS ALWAYS STATED: the code is dropped only when
 *    the mask is EXACTLY full without it and nothing else is left over. The
 *    code length is found rather than guessed greedily, so `+15550109999`
 *    (no separator after the code) works as well as `+1 555 010 9999`.
 *
 * ★★ `phone-us` DROPS ONLY `+1`. It is the one preset whose country is known,
 *    and `+44 20 7946 0958` stripped of its `+44` is a well-formed US number
 *    that is not the one pasted — silent alteration again. Any other code
 *    falls through to the ordinary path and is COUNTED as rejected.
 */
function withoutCountryCode(text: string, mask: string, preset: InputMaskPreset): string {
  const slots = Array.from(mask).filter(isToken).length;
  if (slots === 0) return text;
  const direct = extractForMask(text, mask);
  if (direct.skipped === 0 || direct.filled.length < slots) return text;

  const marker = /^\s*(?:\+|00)\s*/u.exec(text);
  if (!marker) return text;
  const rest = Array.from(text.slice(marker[0].length));

  for (let k = 1; k <= 3; k++) {
    const code = rest.slice(0, k);
    if (code.length < k || !code.every((ch) => /\p{Nd}/u.test(ch))) break;
    if (preset === 'phone-us' && svDigitsOnly(code.join('')) !== '1') continue;
    const trimmed = rest.slice(k).join('').replace(/^[\s.\-()]*/u, '');
    const retry = extractForMask(trimmed, mask);
    if (retry.skipped === 0 && retry.filled.length === slots) return trimmed;
  }
  return text;
}

/**
 * SvInputMaskComponent — masked text input for phone, card, date, time, SSN,
 * ZIP and IP formats (plus a fully custom mask pattern).
 *
 * The `date` and `time` presets are calendar-aware, not just character masks:
 * a keystroke that would make the value an impossible date/time (month 13,
 * day 32, Feb 30, Feb 29 on a non-leap year, hour 24, minute 60…) is rejected
 * outright rather than accepted and left for the user to notice later.
 */
@Component({
  selector: 'sv-input-mask',
  standalone: true,
  imports: [SvIconComponent, SvFieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './input-mask.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvInputMaskComponent),
      multi: true,
    },
  ],
})
export class SvInputMaskComponent implements ControlValueAccessor {
  /** Built-in mask preset (phone, credit card, date, SSN, ZIP, IP…). @default 'phone-us' */
  preset      = input<InputMaskPreset>('phone-us');
  /**
   * Custom mask pattern, used when `preset` is `custom`.
   *
   * `#` is the only placeholder character and it accepts a digit; every other
   * character is a literal that is typed in for the user (e.g. '###-##' or
   * '## / ##'). A mask with no `#` in it can never accept input, because the
   * only characters this control reads from a keystroke are digits.
   */
  customMask  = input<string>('');
  /** Formatted value (two-way). */
  value       = model<string>('');
  /** Field size: sm, md or lg. @default 'md' */
  size        = input<InputMaskSize>('md');
  /** Visual variant. @default 'default' */
  variant     = input<InputMaskVariant>('default');
  /** Disable the field. @default false */
  disabled    = input<boolean>(false);
  /** Accessible label for the field. */
  label       = input<string>('');
  /** Error message shown below the field. */
  error       = input<string>('');
  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'credit-card'`.
   *
   * This used to be a raw `<path d="…">` string. That put SVG geometry in
   * every consumer's config and skipped the library's sizing, stroke and
   * dark-mode handling — pass a name instead.
   */
  icon        = input<string>('');

  /**
   * Whether this field carries a regulated or personally identifying value.
   * @default 'auto' — sensitive for `credit-card` and `ssn`, ordinary otherwise.
   *
   * A sensitive field suppresses browser autofill AND opts out of every
   * session-replay recorder the kit knows about. See `InputMaskSensitivity` for
   * why the second one is the part that surprises people.
   */
  sensitivity = input<InputMaskSensitivity>('auto');

  /** Emitted with the masked/formatted value. */
  changed     = output<string>();
  /** Emitted with the raw (unformatted) value. */
  rawChanged  = output<string>();

  readonly focused = signal(false);

  // ── ControlValueAccessor ──
  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /**
   * ★★ A FORM-WRITTEN VALUE TAKES THE SAME PATH AS A TYPED ONE. This read
   *    `extractDigits(v)` — the pre-`FI-13-I2` extraction — so a `patchValue`
   *    of `'SW1A 1AA'` into an `AA#A #AA` mask rendered `'11'`, and an E.164
   *    `'+15550109999'` into `phone-us` rendered `'(155) 501-0999'`. What the
   *    mask cannot hold is counted here too, so the user sees it.
   */
  writeValue(v: string): void {
    const text = v ?? '';
    const { masked, rejected } = this.shape(text);
    // Text the mask shapes to nothing is kept whole (see the edges spec), and
    // nothing of it was lost, so there is nothing to report.
    this.rejectedCount.set(masked ? rejected : 0);
    this.value.set(masked || text);
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  /** Stable unique id so the label + error association always works. */
  private readonly _uid = svUniqueId('sv-mask');
  readonly inputId = `${this._uid}-input`;
  readonly errorId = `${this._uid}-error`;

  /** Virtual-keyboard hint based on the preset. */
  readonly inputMode = computed<'tel' | 'numeric' | 'text'>(() => {
    const p = this.preset();
    if (p === 'phone-us' || p === 'phone-intl') return 'tel';
    if (p === 'custom') return 'text';
    return 'numeric';
  });

  /** Presets whose value is regulated or personally identifying by default. */
  private static readonly SENSITIVE_PRESETS: ReadonlySet<InputMaskPreset> = new Set<InputMaskPreset>([
    'credit-card',
    'ssn',
  ]);

  /** Resolved from `sensitivity` and the preset. */
  readonly isSensitive = computed(() => {
    const declared = this.sensitivity();
    if (declared !== 'auto') return declared === 'sensitive';
    return SvInputMaskComponent.SENSITIVE_PRESETS.has(this.preset());
  });

  /**
   * The `autocomplete` token for this field.
   *
   * ★★ BLANKET `autocomplete="off"` WAS WRONG IN BOTH DIRECTIONS, and it was
   *    what this component did for every preset. On a phone or ZIP field it
   *    denies a real convenience — and browsers largely ignore it there anyway,
   *    so it bought nothing and cost the user a tap. On a card or SSN field it
   *    is the right instruction and is ALSO widely ignored, which is exactly
   *    why the suppression attributes below are not optional: `off` is a
   *    request, and the recorders are not listening to it.
   */
  readonly autocompleteToken = computed<string>(() => {
    if (this.isSensitive()) return 'off';
    switch (this.preset()) {
      case 'phone-us':
      case 'phone-intl': return 'tel';
      case 'zip':        return 'postal-code';
      default:           return 'off';
    }
  });

  /**
   * The value with everything but the last four characters replaced.
   *
   * ★★★ THIS EXISTS SO A HOST NEVER HAS A REASON TO HANDLE THE REAL ONE.
   *     "Who holds the unmasked value" (`FI-13-M3`) is answered badly by a
   *     policy document and well by making the redacted form the easier thing
   *     to reach for. A confirmation screen, a log line, an analytics event, a
   *     support ticket and a receipt all want "the card ending 4242" — and
   *     every one of them is a place a full PAN ends up when the only value on
   *     offer is the full PAN.
   *
   * ★★ IT REDACTS THE DIGITS AND KEEPS THE SEPARATORS, so the shape still reads
   *    as what it is: `•••• •••• •••• 4242`, `•••-••-6789`. A blanket string of
   *    dots is less useful and looks like a bug.
   *
   * ⚠️ Fewer than five digits redacts EVERYTHING. Four digits of a four-digit
   *    value is not a redaction, and "show the last four" applied blindly to a
   *    short value publishes it whole.
   */
  readonly maskedValue = computed<string>(() => {
    const shown = this.value();
    const digits = extractDigits(shown);
    if (digits.length === 0) return '';
    const keep = digits.length >= 5 ? 4 : 0;
    let seen = 0;
    // ★★★ `\p{Nd}`, NOT `\d`. `#` accepts any script's digits and the value
    //     keeps them, so `/\d/g` matched NOTHING in `٤٢٤٢ ٤٢٤٢ ٤٢٤٢ ٤٢٤٢` and
    //     this "redaction" returned the full PAN (`FI-13-M3` / `FI-16-I3`).
    return shown.replace(/\p{Nd}/gu, (d) => {
      seen++;
      return seen > digits.length - keep ? d : '\u2022';
    });
  });

  /**
   * The last four digits, or `''` when there are not enough to spare.
   *
   * ⚠️ Same rule as `maskedValue`: a value of four digits or fewer returns `''`
   *    rather than itself.
   */
  readonly last4 = computed<string>(() => {
    const digits = extractDigits(this.value());
    return digits.length >= 5 ? digits.slice(-4) : '';
  });

  // ── What the mask could not hold ──────────────────────────────────────────
  //
  // ── The defect (`FI-13-I2` / `FI-13-M1`) ─────────────────────────────────
  //
  // ★★★ THE BACKLOG SAID RIGID MASKS "REJECT" LEGITIMATE INTERNATIONAL VALUES.
  //     They do not reject them. They ACCEPT them and change them, silently,
  //     which is strictly worse — there is no error, the field looks complete,
  //     and a different value reaches the server. Measured on this component
  //     before the fix:
  //
  //       phone-intl  "+44 20 7946 0958"  → "+4 (420) 794-6095"   a real London
  //                                          number, now a different one
  //       phone-intl  "+353 1 234 5678"   → "+3 (531) 234-5678"
  //       phone-us    "+1 (555) 010-9999" → "(155) 501-0999"      the paste
  //                                          from `FI-13-I3`, shifted a place
  //       zip         "SW1A 1AA"          → "11"                  Buckingham
  //                                          Palace, as two digits
  //       zip         "D02 AF30"          → "0230"                Irish Eircode
  //       date        "29/03/2026"        → ""                    the way most
  //                                          of the world writes dates
  //
  // ★★★ `FI-13-M1` NAMES THE STRUCTURAL FIX EXACTLY: a mask should shape
  //     input, not decide correctness. It was deciding by destruction. The
  //     shape stays — that is what a mask is for — but what it cannot hold is
  //     now COUNTED and REPORTED, and the verdict belongs to the host.
  //
  // ⚠️ THIS DOES NOT MAKE A RIGID MASK RIGHT FOR A UK POSTCODE. `M1 1AA`,
  //    `SW1A 1AA`, `B33 8TH` and `DN55 1PT` have four different shapes; no
  //    single mask expresses them and none should try. The honest answer is a
  //    plain text field with validation, and the docs now say so. What this
  //    change buys is that choosing wrong is VISIBLE instead of silent.

  /** How many real characters the mask had nowhere to put, at the last input. */
  private readonly rejectedCount = signal(0);

  /**
   * `true` when the last input contained characters the mask could not hold.
   *
   * ★ Not an error. The host decides whether a partially-fitting value is a
   *   problem — a user pasting a number with its country code into a national
   *   field usually is not making a mistake, and a UK postcode in a US ZIP
   *   field is a mis-chosen mask rather than a mis-typed value.
   */
  readonly hasRejected = computed<boolean>(() => this.rejectedCount() > 0);

  /** How many characters were dropped. Zero when everything fitted. */
  readonly rejectedChars = computed<number>(() => this.rejectedCount());

  /**
   * `true` once every slot in the mask is filled.
   *
   * ⚠️ COMPLETENESS IS NOT CORRECTNESS, which is the whole point of
   *    `FI-13-M1`. `(000) 000-0000` is complete and is not a phone number.
   *    This says the shape is full; whether the value is valid is the host's
   *    question, and `errorMessage` is where the host's answer goes.
   */
  readonly maskComplete = computed<boolean>(() => {
    const mask = this.activeMask();
    const slots = Array.from(mask).filter(isToken).length;
    return slots > 0 && extractForMask(this.value(), mask).filled.length >= slots;
  });

  /**
   * What a screen reader is told when characters were dropped.
   *
   * ★★ A COUNT, NOT "INVALID INPUT". The user needs to know something of theirs
   *    did not survive; saying only that the field is invalid, when the field
   *    is showing a full and plausible value, is the same silence in a
   *    different font.
   */
  readonly rejectedMessage = computed<string>(() => {
    const n = this.rejectedCount();
    if (n === 0) return '';
    return n === 1
      ? '1 character did not fit this format and was not entered.'
      : `${n} characters did not fit this format and were not entered.`;
  });

  readonly activeMask = computed(() => {
    if (this.preset() === 'custom') return this.customMask();
    return PRESETS[this.preset()].mask;
  });

  readonly activePlaceholder = computed(() => {
    // Every token becomes an underscore, not just `#` — `A` and `*` are
    // slots too, and a placeholder showing a literal `A` reads as a letter
    // the user is supposed to type.
    if (this.preset() === 'custom') return this.customMask().replace(/[#A*]/g, '_');
    return PRESETS[this.preset()].placeholder;
  });

  readonly activeLabel = computed(() => {
    if (this.label()) return this.label();
    if (this.preset() === 'custom') return 'Custom Mask';
    return PRESETS[this.preset()].label;
  });

  readonly displayValue = computed(() => this.value());

  onInput(e: Event): void {
    this.accept((e.target as HTMLInputElement).value, e.target as HTMLInputElement);
  }

  /**
   * A paste, handled as a paste rather than as a very fast typist.
   *
   * ── The defect (`FI-13-I3` / `FI-13-M2`) ─────────────────────────────────
   *
   * ★★★ `+1 (555) 010-9999` PASTED INTO `phone-us` BECAME `(155) 501-0999`.
   *     Measured. The `+` is punctuation and vanished, the `1` became the first
   *     digit of the area code, and **every digit after it shifted one place**.
   *     The field then looked complete and correct and held a different phone
   *     number. There was no paste handler at all — the browser's default
   *     `input` event ran the same greedy extraction as a keystroke.
   *
   * ★★ WHY A LEADING COUNTRY CODE IS DROPPED RATHER THAN ABSORBED. `phone-us`
   *    has ten slots and the pasted value has eleven digits. Absorbing the
   *    `+1` is the mangling above; refusing the paste loses the nine digits the
   *    user does want. So the leading `1` is dropped ONLY when the mask is
   *    exactly full without it, which is the one reading that produces the
   *    number the user pasted.
   */
  onPaste(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text) return;
    e.preventDefault();

    // The country-code rule lives in `shape()` so autofill and `writeValue`
    // get it too — see `withoutCountryCode`.
    this.accept(text, e.target as HTMLInputElement);
  }

  /** Text → what the mask shows, the raw slot characters, and what was lost. */
  private shape(text: string): { masked: string; raw: string; rejected: number } {
    const mask = this.activeMask();
    const { filled, skipped } = extractForMask(withoutCountryCode(text, mask, this.preset()), mask);
    const raw = buildValidRaw(filled, this.preset());
    // ★★★ `buildValidRaw` can drop characters too — it is the date/time
    //     partial validator — and those are refusals just as much as a letter
    //     in a digit slot. Counting them here is what makes `28/03` in a
    //     `MM/DD/YYYY` mask report a problem instead of quietly becoming empty.
    return { masked: applyMask(raw, mask), raw, rejected: skipped + (Array.from(filled).length - Array.from(raw).length) };
  }

  /**
   * The one place a new value enters, whatever produced it.
   *
   * ★★ TYPING AND PASTING SHARE THIS ON PURPOSE. They differed before only by
   *    accident — there was no paste handler — and a component where the same
   *    text produces two different values depending on how it arrived is a
   *    component nobody can reason about.
   */
  private accept(text: string, el: HTMLInputElement | null): void {
    const { masked, raw, rejected } = this.shape(text);
    this.rejectedCount.set(rejected);

    this.value.set(masked);
    if (el) el.value = masked;
    this.changed.emit(masked);
    // ★ The raw value leaves as ASCII digits (letters untouched), as it did
    //   when this was `svDigitsOnly`: it is what goes to a server or `Number()`.
    //   The DISPLAY keeps the user's own script.
    this.rawChanged.emit(svNormalizeDigits(raw));
    this._onChange(masked);
  }

  onBlur(): void { this.focused.set(false); this._onTouched(); }

  clear(): void {
    if (this.resolvedDisabled()) return;
    this.value.set('');
    this.changed.emit('');
    this.rawChanged.emit('');
    this._onChange('');
  }

  onKeydown(e: KeyboardEvent): void {
    // Allow backspace to remove last digit
    if (e.key === 'Backspace') {
      const el = e.target as HTMLInputElement;
      const pos = el.selectionStart ?? el.value.length;
      // If cursor is after a literal, skip back to digit
      if (pos > 0) {
        const mask = this.activeMask();
        let back = pos - 1;
        // Any slot token, not just `#`, and the mask-aware extraction rather
        // than `extractDigits` — which deleted every letter of an `A` mask.
        while (back > 0 && !isToken(mask[back])) back--;
        const raw = extractForMask(el.value.slice(0, back), mask).filled;
        const masked = applyMask(raw, mask);
        this.value.set(masked);
      }
    }
  }

  readonly inputClass = computed(() => {
    const size: Record<InputMaskSize, string> = {
      sm: 'h-8 text-xs px-2.5 rounded-md',
      md: 'h-10 text-sm px-3 rounded-md',
      lg: 'h-12 text-base px-4 rounded-md',
    };
    const variant: Record<InputMaskVariant, string> = {
      default: 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
      filled:  'border border-transparent bg-gray-100 dark:bg-gray-800',
      ghost:   'border border-transparent bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50',
    };
    const focus = this.focused()
      ? 'border-primary-500 ring-2 ring-primary-400/25 dark:border-primary-400'
      : '';
    const err   = this.error()
      ? 'border-danger-400 ring-2 ring-danger-300/30 dark:border-danger-500'
      : '';
    return `w-full font-mono outline-none transition-all duration-150
      text-gray-900 placeholder-gray-500 dark:text-gray-100 dark:placeholder-gray-400
      disabled:cursor-not-allowed disabled:opacity-50
      ${size[this.size()]} ${variant[this.variant()]} ${err || focus}`;
  });

  // ── Validation error ─────────────────────────────────────────────────────
  //
  // Distinct from this component's `error` input, which reports a failed
  // SUGGESTION LOOKUP and belongs inside the panel. This is the form's verdict
  // on the value, and belongs under the control where a form error is read.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
  protected readonly validationErrorId = svUniqueId('sv-input-mask-error');

  /**
   * What the input is described by.
   *
   * This control carries two error channels: the older `error()` input, and
   * the `serverError`/`errorMessage` pair behind `<sv-field-error>`. Both can
   * be live at once, and the single `aria-describedby` used to name only the
   * first — so a server rejection rendered a message that nothing pointed at.
   */
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [
      this.error() ? this.errorId : '',
      this.fieldError.showError() ? this.validationErrorId : '',
      this.hasRejected() ? this.rejectedId : '',
    ].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  /**
   * The dropped-character notice's id, listed in `describedBy` above.
   *
   * ★★ IT DESCRIBES THE FIELD EVEN THOUGH IT IS NOT AN ERROR. The host may be
   *    perfectly happy with a partial fit — a number pasted with its country
   *    code usually is not a mistake — but the user still has to be told
   *    something of theirs did not survive. So it joins `aria-describedby` and
   *    does NOT set `aria-invalid`.
   */
  protected readonly rejectedId = `${this._uid}-dropped`;

}
