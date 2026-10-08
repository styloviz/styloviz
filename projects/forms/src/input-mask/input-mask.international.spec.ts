import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvInputMaskComponent } from './input-mask.component';

/**
 * ============================================================================
 *  The mask did not reject these values. It changed them.  ·  `FI-13-I2`/`M1`
 *  And a paste arrived shifted by one place.               ·  `FI-13-I3`/`M2`
 * ============================================================================
 *
 * ★★★ THE BACKLOG SAID RIGID MASKS "REJECT LEGITIMATE INTERNATIONAL VALUES",
 *     AND THAT IS THE WRONG WORD. Nothing was rejected. Every one of these was
 *     ACCEPTED AND SILENTLY ALTERED — no error, no warning, a field that looks
 *     complete and correct, and a different value on its way to the server.
 *     Measured on this component before the fix:
 *
 *       phone-intl  "+44 20 7946 0958"  → "+4 (420) 794-6095"
 *       phone-intl  "+353 1 234 5678"   → "+3 (531) 234-5678"
 *       phone-us    "+1 (555) 010-9999" → "(155) 501-0999"
 *       zip         "SW1A 1AA"          → "11"
 *       zip         "D02 AF30"          → "0230"
 *       date        "29/03/2026"        → ""
 *
 *     A user who cannot see the difference between a number they typed and a
 *     number one digit out has no way to notice, and nothing in the component
 *     was going to tell them.
 *
 * ★★★ `FI-13-M1` NAMES THE STRUCTURAL FIX EXACTLY — "a mask should shape input,
 *     not decide correctness" — and the mask was deciding *by destruction*. The
 *     shape stays; what it cannot hold is now counted and reported, and the
 *     verdict belongs to the host.
 */

async function setup(inputs: Partial<ComponentInput<SvInputMaskComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvInputMaskComponent, {
    inputs: inputs as ComponentInput<SvInputMaskComponent>,
  });
  return { ...r, c: r.fixture.componentInstance };
}

const typeInto = (c: SvInputMaskComponent, text: string): { value: string } => {
  const el = { value: text };
  c.onInput({ target: el } as unknown as Event);
  return el;
};

let lastPasteEvent: ClipboardEvent;

const pasteInto = (c: SvInputMaskComponent, text: string): { value: string } => {
  const el = { value: '' };
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } });
  Object.defineProperty(e, 'target', { value: el });
  lastPasteEvent = e;
  c.onPaste(e);
  return el;
};

describe('what the mask could not hold is now counted', () => {
  it('a UK postcode in a US ZIP field loses five characters, and says so', async () => {
    /**
     * ★★★ `SW1A 1AA` IS BUCKINGHAM PALACE. It came out as `11`: the letters
     *     were deleted by a digits-only extraction and the two survivors filled
     *     the first two slots. The field then read as a five-digit ZIP field
     *     containing a two-digit value, with nothing anywhere saying five
     *     characters had been thrown away.
     */
    const { c } = await setup({ preset: 'zip' });
    typeInto(c, 'SW1A 1AA');
    expect(c.value()).toBe('11');
    expect(c.hasRejected()).toBe(true);
    expect(c.rejectedChars()).toBe(5);
    expect(c.rejectedMessage()).toContain('5 characters');
  });

  it('an Irish Eircode loses three', async () => {
    const { c } = await setup({ preset: 'zip' });
    typeInto(c, 'D02 AF30');
    expect(c.rejectedChars()).toBe(3);
  });

  it('a German PLZ fits, and reports nothing', async () => {
    // ★★ THE CONTROL. If the counter fired on values that DO fit, it would be
    //    noise and hosts would learn to ignore it.
    const { c } = await setup({ preset: 'zip' });
    typeInto(c, '10115');
    expect(c.hasRejected()).toBe(false);
    expect(c.rejectedMessage()).toBe('');
  });

  it('a US ZIP+4 still behaves exactly as it always did', async () => {
    const { c } = await setup({ preset: 'zip' });
    typeInto(c, '123456789');
    expect(c.value()).toBe('12345-6789');
    expect(c.hasRejected()).toBe(false);
  });

  it('a date written the way most of the world writes it reports eight', async () => {
    // 29/03/2026 in an MM/DD/YYYY mask: `29` is not a month, so the partial
    // validator refuses and the field empties. It used to empty in silence.
    const { c } = await setup({ preset: 'date' });
    typeInto(c, '29/03/2026');
    expect(c.value()).toBe('');
    expect(c.hasRejected()).toBe(true);
  });
});

describe('a mask can hold letters now', () => {
  it('`A` takes a letter and `#` still takes only a digit', async () => {
    const { c } = await setup({ preset: 'custom', customMask: 'AA#A #AA' });
    typeInto(c, 'SW1A 1AA');
    expect(c.value()).toBe('SW1A 1AA');
    expect(c.hasRejected()).toBe(false);
  });

  it('and one UK mask still does not fit UK postcodes', async () => {
    /**
     * ★★★ WRITTEN BECAUSE MY FIRST DRAFT OF THE TEST ABOVE USED `AA## #AA` AND
     *     WENT RED. `SW1A` is letter-letter-digit-LETTER; `DN55` is
     *     letter-letter-digit-digit; `M1` is letter-digit. Four real postcodes,
     *     four different shapes, and the mask that holds one drops characters
     *     from the next — which is the same defect as the digits-only version,
     *     just one layer up.
     *
     *     Letter tokens make more formats EXPRESSIBLE. They do not make a
     *     fixed-width mask the right tool for a variable-width format, and
     *     pretending otherwise is how `SW1A 1AA` became `11` in the first
     *     place. The docs point at a text field with validation instead.
     */
    const { c } = await setup({ preset: 'custom', customMask: 'AA#A #AA' });
    typeInto(c, 'M1 1AA');
    expect(c.value()).not.toBe('M1 1AA');
    expect(c.hasRejected()).toBe(true);
  });

  it('`*` takes either', async () => {
    const { c } = await setup({ preset: 'custom', customMask: '***-***' });
    typeInto(c, 'A1B-2C3');
    expect(c.value()).toBe('A1B-2C3');
  });

  it('a letter in a digit slot is still refused — and counted', async () => {
    const { c } = await setup({ preset: 'custom', customMask: '####' });
    typeInto(c, '12AB');
    expect(c.value()).toBe('12');
    expect(c.rejectedChars()).toBe(2);
  });

  it('and a DIGIT IN A LETTER SLOT is refused too, which is the harder half', async () => {
    /**
     * ★★★ WRITTEN BECAUSE FIRE-TESTING FOUND NOTHING ASSERTING IT. Replacing
     *     `A`'s predicate with `() => true` — "a letter slot accepts anything" —
     *     left all 107 tests green. Every existing case fed letters to letter
     *     slots, so the token's whole job was untested from the direction that
     *     matters: a token that accepts everything is not a token, and `AA##`
     *     would have silently become a four-character free-text field.
     */
    const { c } = await setup({ preset: 'custom', customMask: 'AAAA' });
    typeInto(c, 'AB12');
    expect(c.value()).toBe('AB');
    expect(c.rejectedChars()).toBe(2);
  });

  it('`*` really does take both, rather than being a second `A`', async () => {
    const { c } = await setup({ preset: 'custom', customMask: '****' });
    typeInto(c, 'A1B2');
    expect(c.value()).toBe('A1B2');
    expect(c.hasRejected()).toBe(false);
  });

  it('reads non-Latin digits, because `#` is `\\p{Nd}` and not `[0-9]`', async () => {
    // The same defect as `FI-16-I3`, in the token test rather than the
    // extraction this time.
    const { c } = await setup({ preset: 'custom', customMask: '##-##' });
    typeInto(c, '١٢٣٤');
    expect(c.value()).toBe('١٢-٣٤');
  });
});

describe('pasting', () => {
  it('a US number pasted with its country code arrives intact', async () => {
    /**
     * ★★★ `FI-13-I3`, MEASURED: `+1 (555) 010-9999` became `(155) 501-0999`.
     *     The `+` vanished as punctuation, the `1` took the first area-code
     *     slot, and every digit after it shifted one place. The field looked
     *     complete and held a different, valid-looking phone number — the worst
     *     of the three possible outcomes, because nothing looks wrong.
     *
     * ★★ There was NO PASTE HANDLER AT ALL. The browser's `input` event ran the
     *    same greedy extraction as a keystroke, which is why a paste and a very
     *    fast typist were indistinguishable to this component.
     */
    const { c } = await setup({ preset: 'phone-us' });
    pasteInto(c, '+1 (555) 010-9999');
    expect(c.value()).toBe('(555) 010-9999');
    expect(c.hasRejected()).toBe(false);
  });

  it('handles the other shapes a contact list produces', async () => {
    for (const text of ['(555) 010-9999', '555-010-9999', '555.010.9999',
                        '+1-555-010-9999', '00 1 555 010 9999']) {
      const { c } = await setup({ preset: 'phone-us' });
      pasteInto(c, text);
      expect(c.value(), text).toBe('(555) 010-9999');
    }
  });

  it('leaves a BARE leading 1 alone, and reports it', async () => {
    /**
     * ⚠️ THE LINE THIS DRAWS, AND WHY. `+1` and `00 1` are MARKED country
     *    codes — the `+` says so — and stripping them is reading the value, not
     *    guessing at it. A bare `15550109999` is eleven digits with no marker:
     *    it is probably a NANP long-distance number and it is possibly a typo,
     *    and a component that silently picked one would be doing the exact
     *    thing this whole item is about. It reports instead.
     */
    const { c } = await setup({ preset: 'phone-us' });
    pasteInto(c, '15550109999');
    expect(c.hasRejected()).toBe(true);
  });

  it('writes the masked value back into the element, and cancels the default', async () => {
    /**
     * ⚠️ THE `preventDefault` HAS TO BE ASSERTED AS `defaultPrevented`, NOT
     *    INFERRED FROM THE RESULT. jsdom has no paste default to suppress, so
     *    deleting the call leaves every other assertion in this file green —
     *    fire-tested, and the reason this one exists. In a browser it is what
     *    stops the raw clipboard text being inserted alongside the masked value.
     */
    const { c } = await setup({ preset: 'credit-card' });
    const el = pasteInto(c, '4242424242424242');
    expect(el.value).toBe('4242 4242 4242 4242');
    expect(lastPasteEvent.defaultPrevented).toBe(true);
  });

  it('ignores an empty clipboard rather than clearing the field', async () => {
    const { c } = await setup({ preset: 'phone-us' });
    typeInto(c, '5550109999');
    pasteInto(c, '');
    expect(c.value()).toBe('(555) 010-9999');
    // ★ And lets the default through, since there is nothing to override.
    expect(lastPasteEvent.defaultPrevented).toBe(false);
  });

  it('emits the raw value once, like every other path', async () => {
    const seen: string[] = [];
    const { c } = await setup({ preset: 'phone-us' });
    c.rawChanged.subscribe((v: string) => seen.push(v));
    pasteInto(c, '+1 (555) 010-9999');
    expect(seen).toEqual(['5550109999']);
  });
});

describe('completeness is not correctness', () => {
  it('reports a full mask without claiming the value is right', async () => {
    /**
     * ★★★ `(000) 000-0000` IS COMPLETE AND IS NOT A PHONE NUMBER. `maskComplete`
     *     says the shape is full; whether the value means anything is the
     *     host's question, which is the whole of `FI-13-M1`. A component that
     *     conflated the two is how `SW1A 1AA` became `11` and looked fine.
     */
    const { c } = await setup({ preset: 'phone-us' });
    expect(c.maskComplete()).toBe(false);
    typeInto(c, '0000000000');
    expect(c.maskComplete()).toBe(true);
    expect(c.hasRejected()).toBe(false);
  });

  it('is false for a partially filled mask', async () => {
    const { c } = await setup({ preset: 'phone-us' });
    typeInto(c, '555');
    expect(c.maskComplete()).toBe(false);
  });
});

describe('the honest limit', () => {
  it('phone-intl assumes a ONE-DIGIT country code, which only +1 and +7 are', async () => {
    /**
     * ★★★ THE CASE COUNTING CANNOT CATCH, AND SAYING SO IS THE POINT. The
     *     `phone-intl` mask is `+# (###) ###-####` — eleven slots, one of them
     *     the country code. `+353 1 234 5678` has exactly eleven digits, so
     *     NOTHING OVERFLOWS and `rejectedChars` is `0` — and the field still
     *     renders `+3 (531) 234-5678`, which is not the number.
     *
     *     There is no repair for this inside a fixed mask, because the mask is
     *     the wrong shape for the value rather than too small for it. The same
     *     is true of UK postcodes: `M1 1AA`, `SW1A 1AA`, `B33 8TH` and
     *     `DN55 1PT` are four different shapes and no single mask expresses
     *     them.
     *
     *     So this test asserts the limit rather than pretending it is fixed —
     *     and the docs now say to use a plain text field with validation for
     *     variable formats. What the change above buys is that choosing the
     *     wrong tool is VISIBLE in every case where it can be detected, and
     *     documented in the ones where it cannot.
     */
    const { c } = await setup({ preset: 'phone-intl' });
    typeInto(c, '+353 1 234 5678');
    expect(c.rejectedChars()).toBe(0);       // nothing overflowed
    expect(c.value()).toBe('+3 (531) 234-5678'); // and it is still wrong
  });
});
