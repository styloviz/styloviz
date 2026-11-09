/**
 * Saying a number the way the reader writes it.
 *
 * ── What this is for, and what it deliberately is not ───────────────────────
 *
 * ★★★ `sv-number-input` HARDCODED `'$'` (`FI-15-I3`). `variant="currency"`
 *     meant dollars, for everyone, with a `prefix` input as the only way out —
 *     so every non-USD consumer was either broken or working around the
 *     variant. That is the defect these functions exist to close.
 *
 * ★★★ AND THE POSITION IS NOT A CONSTANT EITHER, WHICH IS THE HALF A PREFIX
 *     INPUT CANNOT FIX. Measured:
 *
 *         en-US  USD   $1,234.50
 *         en-GB  GBP   £1,234.50
 *         de-DE  EUR   1.234,50 €      ← after, with a space
 *         fr-FR  EUR   1 234,50 €      ← after, and the group is a space
 *         de-CH  CHF   CHF 1'234.50    ← before, with a space
 *         bn-BD  BDT   ১,২৩৪.৫০৳       ← after, no space, Bengali digits
 *
 *     A `prefix` input can only ever produce the first two. Half the world's
 *     money goes on the other end of the number.
 *
 * ★★ NOTHING HERE IS A TABLE. Every separator, symbol and position is read out
 *    of `Intl.NumberFormat().formatToParts()` — the platform's own CLDR data.
 *    A hardcoded list of locales is a list that is wrong the year after it is
 *    written, and wrong silently, for the users least able to report it.
 *
 * ⚠️ THIS IS NOT A `SvLocaleContext`. That is `X-9` and it is a bigger design.
 *    These are two pure functions over a BCP-47 tag, so a component can take a
 *    `locale` input today and be re-plumbed into a context later without its
 *    behaviour changing.
 */

/** Where a currency symbol sits, and what it wears. */
export interface SvCurrencyAffix {
  /** The symbol as this locale writes it — `$`, `€`, `£`, `CHF`, `৳`. */
  readonly symbol: string;
  /** Which side of the number it goes on. */
  readonly position: 'before' | 'after';
  /**
   * The literal between symbol and number — usually `''` or a space.
   *
   * ★ Often a NON-BREAKING space (`U+00A0`) or a narrow one (`U+202F`), and
   *   they are NAMED here rather than embedded: an invisible character in a
   *   comment shows a reader nothing, and `no-irregular-whitespace` is right
   *   to refuse one in source even when it is the thing being described.
   *   that is kept as-is rather than normalised. Replacing it with a plain
   *   space is how a currency symbol ends up alone on the next line.
   */
  readonly spacing: string;
}

/** What `svCurrencyAffix` returns when it cannot ask the platform. */
const UNKNOWN_AFFIX: SvCurrencyAffix = { symbol: '', position: 'before', spacing: '' };

/**
 * How this locale writes a currency amount's symbol.
 *
 * @param locale BCP-47 tag. `''` means "the runtime's default".
 * @param currency ISO 4217 code — `'USD'`, `'EUR'`, `'JPY'`.
 *
 * ★★ IT RETURNS AN EMPTY SYMBOL RATHER THAN THROWING on an unknown code.
 *    `Intl.NumberFormat` throws a `RangeError` for a currency code that is not
 *    three letters, and a component that propagates that renders nothing at all
 *    because of a typo in one input. An empty symbol degrades to a plain number,
 *    which is wrong in a way the developer can see.
 */
export function svCurrencyAffix(locale: string, currency: string): SvCurrencyAffix {
  if (!currency) return UNKNOWN_AFFIX;
  let parts: Intl.NumberFormatPart[];
  try {
    parts = new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency,
    }).formatToParts(1);
  } catch {
    return UNKNOWN_AFFIX;
  }

  const symbolAt = parts.findIndex((p) => p.type === 'currency');
  const numberAt = parts.findIndex((p) => p.type === 'integer');
  if (symbolAt === -1 || numberAt === -1) return UNKNOWN_AFFIX;

  const position = symbolAt < numberAt ? 'before' : 'after';
  // The literal that sits between them, if any. `formatToParts` reports it as
  // its own `literal` part, which is the only place the non-breaking space is
  // visible — reading it back out of a formatted string would lose it.
  const between = position === 'before' ? parts[symbolAt + 1] : parts[symbolAt - 1];
  const spacing = between?.type === 'literal' ? between.value : '';

  return { symbol: parts[symbolAt].value, position, spacing };
}

/**
 * A number as this locale writes it — separators, grouping and digits.
 *
 * ★★ FOR ANNOUNCEMENT AND DISPLAY, NOT FOR AN `<input type="number">`. That
 *    element's IDL value is canonical by specification: `.` for the decimal, no
 *    grouping, and `''` for anything it cannot parse. So a component using one
 *    **cannot** put `1.234,50` in the box, and pretending otherwise produces an
 *    empty field. What it CAN localise is the string it builds itself — the
 *    `aria-valuetext` a screen reader announces — and that is what this is for.
 *
 * ⚠️ `''` LOCALE MEANS "DO NOT LOCALISE", NOT "USE THE BROWSER'S". Defaulting a
 *    published component to the browser's locale would change what every
 *    existing caller renders the day they upgrade — a US app on a German
 *    laptop would start announcing commas. Opting in is the only version of
 *    this that is not a silent behaviour change, and the default is a
 *    compatibility decision rather than a claim that en-US is neutral.
 */
export function svFormatNumber(value: number, decimals: number, locale: string): string {
  if (!Number.isFinite(value)) return '';
  if (!locale) return value.toFixed(decimals);
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // An invalid tag is a developer mistake, not a user-facing failure.
    return value.toFixed(decimals);
  }
}
