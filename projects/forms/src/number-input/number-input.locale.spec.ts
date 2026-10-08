import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvNumberInputComponent } from './number-input.component';

/**
 * ============================================================================
 *  `variant="currency"` meant dollars  ·  `FI-15-I3` (and the `I2`/`M1` rescope)
 * ============================================================================
 *
 * ★★★ THE DEFECT. `effectivePrefix` was `variant() === 'currency' ? '$' : ''`.
 *     Every non-USD consumer was either broken or working around the variant
 *     they were told to use.
 *
 * ★★★ AND `prefix` WAS NOT THE FIX, WHICH IS THE PART WORTH SAYING. The
 *     position is not a constant: `de-DE` writes `1.234,50 €` and `fr-FR`
 *     writes `1 234,50 €` — symbol AFTER the number, with a non-breaking space.
 *     `de-CH` writes `CHF 1'234.50`. A `prefix` input can only ever produce the
 *     American shape.
 *
 * ── 🔺 `FI-15-I2` / `FI-15-M1` ARE NARROWER HERE THAN THEY READ ─────────────
 *
 *    "Locale decimal separators" cannot apply to the BOX, because this is an
 *    `<input type="number">` and its IDL value is canonical by specification:
 *    `.` for the decimal, no grouping, `''` for anything the browser cannot
 *    parse. Verified in this runner — setting `'12,5'` yields `''`. So writing
 *    `1.234,50` into the field produces an EMPTY field, and the browser already
 *    owns the job anyway: a German user on a German browser types `12,5` and
 *    the element hands the component `12.5`.
 *
 *    What the component fully owns is the string it builds for
 *    `aria-valuetext`, and that is where the locale goes. The box is a machine
 *    field; the announcement is for a person.
 * ============================================================================
 */

async function setup(inputs: Partial<ComponentInput<SvNumberInputComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvNumberInputComponent, {
    inputs: inputs as ComponentInput<SvNumberInputComponent>,
  });
  return { ...r, c: r.fixture.componentInstance };
}

describe('the currency symbol', () => {
  it('comes from the code, not from the variant', async () => {
    const { c } = await setup({ variant: 'currency', currency: 'EUR', locale: 'en-US' });
    expect(c.effectivePrefix()).toContain('€');
    expect(c.effectivePrefix()).not.toContain('$');
  });

  it('goes AFTER the number where the locale puts it', async () => {
    // ★★★ The claim `prefix` cannot satisfy. Same currency, different locale,
    //     different side.
    const { c } = await setup({ variant: 'currency', currency: 'EUR', locale: 'de-DE' });
    expect(c.effectivePrefix()).toBe('');
    expect(c.effectiveSuffix()).toContain('€');
  });

  it('keeps the non-breaking space the locale uses', async () => {
    // Not normalised: replacing it with an ordinary space is how a currency
    // symbol ends up alone on the next line.
    const { c } = await setup({ variant: 'currency', currency: 'EUR', locale: 'de-DE' });
    const suffix = c.effectiveSuffix();
    expect(suffix.length).toBeGreaterThan(1);
    expect(suffix.trim()).toBe('€');
    expect(suffix.startsWith(' ')).toBe(false); // a plain space would mean it was normalised
  });

  it('handles a symbol that is a word', async () => {
    // `de-CH` writes `CHF 1'234.50`. A component assuming one character clips it.
    const { c } = await setup({ variant: 'currency', currency: 'CHF', locale: 'de-CH' });
    expect(c.effectivePrefix()).toContain('CHF');
  });

  it('works without the variant at all', async () => {
    // `currency` is the input that means currency; `variant` is a styling
    // preset that happened to carry a default.
    const { c } = await setup({ currency: 'GBP', locale: 'en-GB' });
    expect(c.effectivePrefix()).toContain('£');
  });
});

describe('what did not change, which is what makes this shippable', () => {
  it('still renders "$" for variant="currency" with no code', async () => {
    /**
     * ⚠️ A COMPATIBILITY DEFAULT, NOT A CLAIM THAT DOLLARS ARE NEUTRAL.
     *    Changing it would silently alter what every existing caller renders on
     *    upgrade — a formatting change nobody asked for, in a released package.
     *    The docs say to set `currency`; the default says nothing new.
     */
    const { c } = await setup({ variant: 'currency' });
    expect(c.effectivePrefix()).toBe('$');
  });

  it('still lets an explicit prefix win', async () => {
    // The escape hatch that existed before `currency` did. A host using it has
    // already decided, and this change must not overrule them.
    const { c } = await setup({ variant: 'currency', currency: 'EUR', prefix: 'Kč' });
    expect(c.effectivePrefix()).toBe('Kč');
  });

  it('still renders "%" for the percentage variant', async () => {
    const { c } = await setup({ variant: 'percentage' });
    expect(c.effectiveSuffix()).toBe('%');
  });

  it('announces exactly as before when no locale is set', async () => {
    // ★★★ THE LINE THAT KEEPS EVERY EXISTING CALLER BYTE-IDENTICAL. `''` means
    //     "do not localise", not "use the browser's" — the latter would change
    //     what a US app renders the day it runs on a German laptop.
    const { c } = await setup({ variant: 'currency', value: 1234.5, decimals: 2 });
    expect(c.valueText()).toBe('$1234.50');
  });
});

describe('the announcement', () => {
  it('localises the number, which the box cannot', async () => {
    const { c } = await setup({ currency: 'EUR', locale: 'de-DE', value: 1234.5, decimals: 2 });
    const text = c.valueText();

    // Grouping and a comma decimal — neither of which can go in a
    // `type="number"` field.
    expect(text).toContain('1.234,50');
    expect(text).toContain('€');
    // And the symbol is on the side de-DE puts it.
    expect(text.trim().endsWith('€')).toBe(true);
  });

  it('leaves the box canonical while it does so', async () => {
    /**
     * ★★ THE TWO HALVES, ASSERTED TOGETHER, BECAUSE THE WHOLE DESIGN IS THAT
     *    THEY DIFFER. `<input type="number">` sanitises anything non-canonical
     *    to `''` — so if `displayValue()` ever started returning the localised
     *    form, the field would go blank and the value would be unrecoverable.
     */
    const { c, fixture } = await setup({ currency: 'EUR', locale: 'de-DE', value: 1234.5, decimals: 2 });
    expect(c.displayValue()).toBe('1234.50');

    const box = (fixture.nativeElement as HTMLElement).querySelector('input[type="number"]')!;
    expect((box as HTMLInputElement).value).toBe('1234.50');
  });

  it('puts the locale on the input as `lang`, which is the one thing that reaches the box', async () => {
    /**
     * ★★★ `FI-15-I2`'s ACTUAL FIX, AND IT IS ONE ATTRIBUTE. Browsers decide
     *     which decimal separator a `type="number"` field ACCEPTS from the
     *     ELEMENT's language, not only from the browser's own. Without
     *     `lang="de-DE"`, a German user on an English browser has the comma
     *     rejected at the keyboard — they type `1`, `,`, `5` and the box reads
     *     `15`. Silently. That is the defect the item describes.
     *
     * ⚠️ THE EFFECT IS THE BROWSER'S AND THIS SUITE CANNOT SEE IT. jsdom does
     *    not implement `type="number"` keyboard handling at all. So this
     *    asserts the attribute and nothing more — which is the entire extent of
     *    what the component controls, and is better than a test that appears to
     *    prove more than it does.
     */
    const { fixture } = await setup({ locale: 'de-DE' });
    const box = (fixture.nativeElement as HTMLElement).querySelector('input[type="number"]')!;
    expect(box.getAttribute('lang')).toBe('de-DE');
  });

  it('leaves `lang` off entirely when no locale is set', async () => {
    // An empty `lang=""` is not the same as no `lang`: it means "unknown
    // language" and can reset an inherited one from an ancestor.
    const { fixture } = await setup();
    const box = (fixture.nativeElement as HTMLElement).querySelector('input[type="number"]')!;
    expect(box.hasAttribute('lang')).toBe(false);
  });

  it('announces the settled value while the box holds a draft', async () => {
    /**
     * ★★ THE TWO DIVERGE ON PURPOSE. `displayValue()` shows what the user is
     *    typing — `-` is a state on the way to a number and the box must keep
     *    it. `aria-valuetext` is re-read on every change, and announcing "minus"
     *    as the field's value is noise at best. The last COMMITTED number is
     *    what the field is worth.
     *
     * 🔺 The first draft of this test used `'12.'`, which `parseFloat` reads as
     *    12 — so the value genuinely became 12 and the test was asserting that
     *    a committed value had not been committed. `'-'` is the state that is
     *    actually un-numeric.
     */
    const { c } = await setup({ locale: 'de-DE', value: 42, decimals: 2 });
    c.onInput({ target: { value: '-' } } as unknown as Event);

    expect(c.displayValue()).toBe('-');
    expect(c.valueText()).toContain('42');
  });

  it('says nothing extra when there is no locale and no affix', async () => {
    // Pre-existing behaviour: an empty `aria-valuetext` means "let the browser
    // announce the number itself", which is right when there is nothing to add.
    const { c } = await setup({ value: 5 });
    expect(c.valueText()).toBe('');
  });
});

describe('a bad code or tag', () => {
  it('degrades to no symbol rather than rendering nothing', async () => {
    // `Intl.NumberFormat` throws `RangeError` for a code that is not three
    // letters. A component that propagated it would render nothing at all
    // because of one typo.
    const { c } = await setup({ currency: 'DOLLARS', locale: 'en-US' });
    expect(c.effectivePrefix()).toBe('');
    expect(c.effectiveSuffix()).toBe('');
  });

  it('falls back to the unlocalised number for a bad tag', async () => {
    const { c } = await setup({ locale: 'not a locale', value: 1234.5, decimals: 2, currency: 'USD' });
    expect(() => c.valueText()).not.toThrow();
    expect(c.valueText()).toContain('1234.50');
  });
});
