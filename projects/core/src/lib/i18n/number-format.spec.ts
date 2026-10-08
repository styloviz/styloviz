import { svCurrencyAffix, svFormatNumber } from './number-format';

/**
 * ============================================================================
 *  Saying a number the way the reader writes it  ·  `FI-15-I3`
 * ============================================================================
 *
 * ★★★ THE DEFECT: `sv-number-input`'s `variant="currency"` meant `'$'`, for
 *     everyone. A `prefix` input was the only way out, which means every
 *     non-USD consumer was either broken or working around the variant.
 *
 * ★★★ AND A PREFIX INPUT CANNOT FIX IT ANYWAY, because the position is not a
 *     constant. Half the world's money goes after the number, and two of the
 *     locales below put a non-breaking space in between.
 *
 * ── ★★ HOW THIS FILE AVOIDS TESTING `Intl` INSTEAD OF THE CODE ──────────────
 *
 * Everything here comes from the platform's CLDR data, which changes between
 * ICU versions. Asserting `'1.234,50 €'` exactly would be asserting the
 * runtime's data, and the test would go red on a Node upgrade for a reason
 * that is not a defect.
 *
 * So the assertions are about the SHAPE the code extracts — which side the
 * symbol is on, that the spacing survives, that a failure degrades rather than
 * throws — and where a literal value is asserted it is one that has been stable
 * across ICU for many years (`$`, `€`, `£`). Anything finer is checked against
 * `Intl`'s own output computed in the test rather than hardcoded.
 */

describe('svCurrencyAffix — which side, and what is in between', () => {
  it('puts the symbol before the number where the locale does', () => {
    const usd = svCurrencyAffix('en-US', 'USD');
    expect(usd.symbol).toBe('$');
    expect(usd.position).toBe('before');
    expect(usd.spacing).toBe('');
  });

  it('puts it AFTER where the locale does, which a prefix input cannot', () => {
    // ★★★ The claim the whole function exists for. `de-DE` writes `1.234,50 €`.
    const eur = svCurrencyAffix('de-DE', 'EUR');
    expect(eur.symbol).toBe('€');
    expect(eur.position).toBe('after');
  });

  it('keeps the spacing the locale uses, non-breaking space included', () => {
    /**
     * ★★ NOT NORMALISED TO A PLAIN SPACE. `de-DE` and `fr-FR` separate the
     *    amount from the symbol with a non-breaking space; replacing it with an
     *    ordinary one is how a currency symbol ends up alone on the next line.
     *    `formatToParts` is the only place that character is visible — reading
     *    it back out of a formatted string would lose which space it was.
     */
    const eur = svCurrencyAffix('de-DE', 'EUR');
    expect(eur.spacing).not.toBe('');
    expect(eur.spacing.trim()).toBe('');
    // Whatever the platform says, it is the same character the platform used.
    const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
      .format(1);
    expect(formatted.endsWith(`${eur.spacing}${eur.symbol}`)).toBe(true);
  });

  it('handles a symbol that is a word, not a glyph', () => {
    // `de-CH` writes `CHF 1'234.50` — three letters, before, with a space. A
    // component that assumed one character would clip it.
    const chf = svCurrencyAffix('de-CH', 'CHF');
    expect(chf.symbol.length).toBeGreaterThan(1);
    expect(chf.position).toBe('before');
  });

  it('gives the same currency a different shape in a different locale', () => {
    // The two-dimensional nature of the problem, in one assertion: the CURRENCY
    // does not decide the position — the LOCALE does. `€` is before the number
    // for an American reader and after it for a German one.
    expect(svCurrencyAffix('en-US', 'EUR').position).toBe('before');
    expect(svCurrencyAffix('de-DE', 'EUR').position).toBe('after');
  });

  describe('when it cannot ask the platform', () => {
    it('returns an empty symbol for no currency', () => {
      expect(svCurrencyAffix('en-US', '')).toEqual({ symbol: '', position: 'before', spacing: '' });
    });

    it('degrades rather than throwing on a bad currency code', () => {
      /**
       * ★★ `Intl.NumberFormat` THROWS `RangeError` FOR A CODE THAT IS NOT THREE
       *    LETTERS, and a component that propagates it renders NOTHING because
       *    of a typo in one input. An empty symbol degrades to a plain number,
       *    which is wrong in a way the developer can see immediately.
       */
      expect(() => svCurrencyAffix('en-US', 'DOLLARS')).not.toThrow();
      expect(svCurrencyAffix('en-US', 'DOLLARS').symbol).toBe('');
      expect(svCurrencyAffix('en-US', 'x').symbol).toBe('');
    });

    it('degrades rather than throwing on a bad locale tag', () => {
      expect(() => svCurrencyAffix('not a locale', 'USD')).not.toThrow();
    });
  });
});

describe('svFormatNumber', () => {
  it('does NOT localise when no locale is given', () => {
    /**
     * ★★★ `''` MEANS "DO NOT LOCALISE", NOT "USE THE BROWSER'S". Defaulting a
     *     published component to the browser's locale changes what every
     *     existing caller renders the day they upgrade — a US app on a German
     *     laptop would start announcing commas. Opting in is the only version
     *     of this that is not a silent behaviour change.
     *
     *     Asserted here rather than left to the component, because it is the
     *     decision that keeps the feature shippable.
     */
    expect(svFormatNumber(1234.5, 2, '')).toBe('1234.50');
    expect(svFormatNumber(1234.5, 0, '')).toBe('1235');
  });

  it('localises separators and grouping when one is', () => {
    // Checked against `Intl`'s own output rather than a hardcoded string, so a
    // CLDR data change is not a red test for something that is not a defect.
    const expected = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.5);
    expect(svFormatNumber(1234.5, 2, 'de-DE')).toBe(expected);
    // …and it is genuinely different from the unlocalised form, or this test
    // would pass against a function that ignored its argument.
    expect(svFormatNumber(1234.5, 2, 'de-DE')).not.toBe(svFormatNumber(1234.5, 2, ''));
  });

  it('honours the digit system the locale uses', () => {
    // `bn-BD` writes `১,২৩৪.৫০`. A component that assumed ASCII digits in its
    // own announcement string would be announcing the wrong thing to exactly
    // the users who cannot check it against the box.
    expect(svFormatNumber(1234.5, 2, 'bn-BD')).not.toMatch(/^[\d.,\s]+$/);
  });

  it('respects the decimal count in both directions', () => {
    expect(svFormatNumber(1.005, 2, '')).toBe('1.00');
    expect(svFormatNumber(1, 3, '')).toBe('1.000');
    expect(svFormatNumber(1, 3, 'en-US')).toBe('1.000');
  });

  it('returns an empty string for a value that is not a number', () => {
    // `NaN` reaches here from a half-typed field, and `Intl` renders it as the
    // literal text "NaN" — which a screen reader then reads out.
    expect(svFormatNumber(NaN, 2, 'en-US')).toBe('');
    expect(svFormatNumber(Infinity, 2, '')).toBe('');
  });

  it('degrades rather than throwing on a bad locale tag', () => {
    expect(() => svFormatNumber(1, 2, 'not a locale')).not.toThrow();
    expect(svFormatNumber(1, 2, 'not a locale')).toBe('1.00');
  });
});
