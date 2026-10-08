import {
  SV_QUIET_CODE128,
  SV_QUIET_EAN_LEFT,
  SV_QUIET_EAN_RIGHT,
  svBarcodeWidth,
  svCode128Check,
  svCode128Savings,
  svCode128Values,
  svEncode,
  svEncodingLabel,
  svGtinCheckDigit,
  svIsGuardModule,
  svSnapModuleWidth,
  svValidate,
} from './barcode-1d.encode';

/** The bar/space pattern as a `1`/`0` string, for comparing against the spec. */
const bits = (value: string, symbology: 'code128' | 'ean13' | 'ean8'): string => {
  const e = svEncode(value, symbology);
  let out = '';
  for (const m of e.modules) out += (m.bar ? '1' : '0').repeat(m.width);
  return out;
};

// ── Check digits ────────────────────────────────────────────────────────────

describe('the GTIN check digit', () => {
  /**
   * ★★★ THE WEIGHTS RUN FROM THE RIGHT. Anchoring at the left is correct for
   * EAN-13 by accident (payload 12, even) and wrong for EAN-8 (payload 7, odd),
   * so the bug passes every EAN-13 test anyone writes.
   */
  it('checks the textbook EAN-13', () => {
    // 590123412345 → 7 is the published example in the EAN specification.
    expect(svGtinCheckDigit('590123412345')).toBe(7);
  });

  it('checks a second EAN-13, independently known', () => {
    expect(svGtinCheckDigit('400638133393')).toBe(1);
  });

  it('checks an EAN-8, where a left-anchored weighting would be wrong', () => {
    // 9638507 → 4. With the weights anchored at the LEFT this comes out
    // differently, which is the whole point of the fixture.
    expect(svGtinCheckDigit('9638507')).toBe(4);
  });

  it('produces zero when the weighted sum lands on a multiple of ten', () => {
    // Constructed: any payload whose weighted sum is 0 mod 10 must check to 0,
    // not to 10.
    expect(svGtinCheckDigit('000000000000')).toBe(0);
  });

  it('always produces a single digit', () => {
    for (let i = 0; i < 1000; i++) {
      const payload = String(i).padStart(12, '0');
      const d = svGtinCheckDigit(payload);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(9);
    }
  });
});

describe('the Code 128 check character', () => {
  /**
   * ★★★ WEIGHTED BY POSITION WITH THE START CHARACTER AT WEIGHT ONE. Weighting
   * from zero produces a symbol that prints perfectly and scans as nothing.
   */
  it('matches a hand-computed example, with the arithmetic written out', () => {
    // ★ SPELLED OUT RATHER THAN REMEMBERED. A "known" constant recalled from a
    //   reference is not a verification — the first version of this test
    //   asserted 54 from memory and the code was right. So: "PJJ123C" in subset
    //   B is Start B(104), P(48), J(42), J(42), 1(17), 2(18), 3(19), C(35).
    //   104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7
    //   = 104 + 48 + 84 + 126 + 68 + 90 + 114 + 245 = 879, and 879 − 8·103 = 55.
    const values = svCode128Values('PJJ123C');
    expect(values).toEqual([104, 48, 42, 42, 17, 18, 19, 35]);

    const weighted = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0);
    expect(weighted).toBe(879);
    expect(svCode128Check(values)).toBe(55);
  });

  /**
   * ★★ THE PROPERTY A SCANNER ACTUALLY CHECKS. A reader recomputes the weighted
   * sum over everything it received and compares it to the transmitted check
   * character; the symbol is valid exactly when they agree.
   */
  it('produces a check a decoder would accept, for every kind of payload', () => {
    for (const s of ['A', 'PJJ123C', 'hello world', '12345678', 'AB12345678CD', '~!@#']) {
      const values = svCode128Values(s);
      const check = svCode128Check(values);
      const recomputed = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
      expect(check).toBe(recomputed);
    }
  });

  it('stays inside the 0–102 code space', () => {
    for (const s of ['A', 'hello world', '0123456789', '~!@#$%^&*()']) {
      const c = svCode128Check(svCode128Values(s));
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(102);
    }
  });

  it('changes when any character changes', () => {
    const a = svCode128Check(svCode128Values('ABC123'));
    const b = svCode128Check(svCode128Values('ABC124'));
    expect(a).not.toBe(b);
  });

  /**
   * ★★ POSITION MATTERS, WHICH IS WHAT THE WEIGHTING BUYS. An unweighted sum
   * gives a transposition the same check as the original — the single commonest
   * data-entry error, waved straight through.
   */
  it('distinguishes a transposition', () => {
    expect(svCode128Check(svCode128Values('AB')))
      .not.toBe(svCode128Check(svCode128Values('BA')));
  });
});

// ── Subset switching ────────────────────────────────────────────────────────

describe('Code 128 subset selection', () => {
  it('starts in B for text', () => {
    expect(svCode128Values('HELLO')[0]).toBe(104);
  });

  /**
   * ★★★ SUBSET C HALVES THE PRINTED WIDTH OF A NUMERIC PAYLOAD. An encoder that
   * only ever uses B produces symbols that overflow the label stock, and the
   * operator's fix is to shrink the module width until it stops scanning.
   */
  it('starts in C for a long numeric payload, and packs two digits per character', () => {
    const values = svCode128Values('12345678');
    expect(values[0]).toBe(105);
    // Start C plus four pair characters.
    expect(values).toHaveLength(5);
    expect(values.slice(1)).toEqual([12, 34, 56, 78]);
  });

  it('halves the character count for a long serial', () => {
    const s = svCode128Savings('0123456789012345678901');
    expect(s.characters).toBeLessThan(s.ifSubsetBOnly / 1.8);
  });

  /**
   * ★★ THE THRESHOLDS ARE NOT SYMMETRIC AND THAT IS DELIBERATE. Four digits at
   * the start are worth Start C because the start character is free; mid-string
   * a switch costs a character, so it takes six. Switching for a short run makes
   * the symbol LONGER.
   */
  /**
   * ★★★ THE VALUES, NOT THE LENGTH. Lowering the start threshold from four to
   * two survived every test in this file, because at three leading digits the
   * two encodings are the same LENGTH — Start B + '1' + '2' + '3' against
   * Start C + 12 + Shift-B + '3' — and every assertion here counted characters.
   * A wrong-but-same-length encoding is exactly the failure that ships: the
   * label comes out the right width and scans as something else.
   */
  it('stays in B for a three-digit leading run, and encodes it as three characters', () => {
    // Start B = 104; '1'/'2'/'3' in subset B are 0x31/0x32/0x33 − 32.
    expect(svCode128Values('123')).toEqual([104, 17, 18, 19]);
  });

  /**
   * ★★ AND THE ONE EXCEPTION BELOW FOUR. A value that IS two digits and nothing
   * else pays no switch back, so Start C wins: two characters against three.
   * The spec calls this out separately; it is not an off-by-one on the
   * threshold, and "42X" is still Start B.
   */
  it('starts in C for a value of exactly two digits, and only then', () => {
    expect(svCode128Values('42')).toEqual([105, 42]);
    expect(svCode128Values('42X')).toEqual([104, 20, 18, 56]);
  });

  /**
   * ★★★ THE FREE SWITCH AT THE END OF THE STRING. A run that reaches the end
   * and pairs exactly is worth switching for at FOUR rather than six, because
   * there is no switch back to pay for. Deleting that clause left every test
   * passing: the mid-string tests all used runs of six or more, so nothing
   * observed the cheaper boundary.
   */
  it('takes the cheaper switch when an even digit run reaches the end', () => {
    // 'A' 'B', then Shift-C (99), then the pairs 12 and 34.
    expect(svCode128Values('AB1234')).toEqual([104, 33, 34, 99, 12, 34]);
    expect(svCode128Savings('AB1234').characters).toBe(6);
  });

  /**
   * ★★★ AND WITH AN ODD TAIL IT SPENDS ONE DIGIT TO REACH THE EVEN ONE. I
   * expected 'AB12345' to stay in subset B outright — five digits, cannot pair,
   * no switch. It does better than that: it emits '1' in B, which leaves a
   * four-digit run that DOES reach the end and pair, and takes the free switch
   * there. Seven characters against the eight staying in B costs.
   *
   * The behaviour falls out of the loop re-evaluating the rule at every
   * position rather than deciding once per run, which is worth pinning: a
   * refactor to "classify each run up front" would quietly lose it, and losing
   * it makes labels wider with every test still green.
   */
  it('spends one digit to reach an even tail, rather than giving the switch up', () => {
    // 'A' 'B' '1', then Shift-C (99) and the pairs 23 and 45.
    expect(svCode128Values('AB12345')).toEqual([104, 33, 34, 17, 99, 23, 45]);
    expect(svCode128Savings('AB12345')).toEqual({ characters: 7, ifSubsetBOnly: 8 });
  });

  it('does not switch to C for a short mid-string digit run', () => {
    const values = svCode128Values('AB12CD');
    expect(values).not.toContain(99);
  });

  it('switches to C for a long mid-string digit run', () => {
    const values = svCode128Values('AB12345678CD');
    expect(values).toContain(99);
  });

  it('switches back to B when the digits stop', () => {
    const values = svCode128Values('12345678AB');
    expect(values[0]).toBe(105);
    expect(values).toContain(100);
  });

  it('handles an odd digit run without dropping a digit', () => {
    // Nine digits: eight pair up in C, the ninth has to fall back to B.
    const values = svCode128Values('123456789');
    expect(values[0]).toBe(105);
    expect(values).toContain(100);
    // '9' encoded in B is 0x39 − 32 = 25.
    expect(values[values.length - 1]).toBe(25);
  });

  it('never emits a value outside the code space', () => {
    for (const s of ['hello 123 world 456789', '~~~999999~~~', ' ', '999999999999999']) {
      for (const v of svCode128Values(s)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(106);
      }
    }
  });
});

// ── Validation ──────────────────────────────────────────────────────────────

describe('what cannot be encoded', () => {
  /**
   * ★★ REFUSING IS THE FEATURE. A component that renders something for every
   * input ships an unscannable label to a warehouse.
   */
  it('accepts a 12-digit EAN-13 payload and a 13-digit one with a good check', () => {
    expect(svValidate('590123412345', 'ean13')).toBeNull();
    expect(svValidate('5901234123457', 'ean13')).toBeNull();
  });

  it('names the wrong check digit rather than silently re-deriving it', () => {
    const why = svValidate('5901234123458', 'ean13');
    expect(why).toContain('check digit is wrong');
    expect(why).toContain('checks to 7');
    expect(why).toContain('different article number');
  });

  it('rejects the wrong length and says what it wanted', () => {
    expect(svValidate('59012341234', 'ean13')).toContain('needs 12 digits');
    expect(svValidate('123', 'ean8')).toContain('needs 7 digits');
  });

  it('rejects non-digits for EAN', () => {
    expect(svValidate('59012341234X', 'ean13')).toContain('digits only');
  });

  it('rejects a character Code 128 subset B cannot carry, and says which', () => {
    const why = svValidate('ABéCD', 'code128');
    expect(why).toContain('position 3');
  });

  it('rejects nothing at all', () => {
    expect(svValidate('', 'code128')).toBe('Nothing to encode.');
  });

  it('renders no modules for an input it refused', () => {
    const e = svEncode('123', 'ean13');
    expect(e.error).not.toBeNull();
    expect(e.modules).toEqual([]);
    expect(e.moduleCount).toBe(0);
  });
});

// ── Encoding to modules ─────────────────────────────────────────────────────

describe('the drawn symbol', () => {
  it('starts and ends an EAN-13 with the guard pattern', () => {
    const b = bits('590123412345', 'ean13');
    expect(b.startsWith('101')).toBe(true);
    expect(b.endsWith('101')).toBe(true);
  });

  it('puts the centre guard exactly where the spec does', () => {
    const b = bits('590123412345', 'ean13');
    expect(b.slice(45, 50)).toBe('01010');
  });

  it('is exactly 95 modules wide, as EAN-13 always is', () => {
    expect(svEncode('590123412345', 'ean13').moduleCount).toBe(95);
  });

  it('is exactly 67 modules wide for EAN-8', () => {
    expect(svEncode('9638507', 'ean8').moduleCount).toBe(67);
  });

  /**
   * ★★★ THIRTEEN DIGITS IN TWELVE DIGITS' WORTH OF BARS. The leading digit is
   * carried by the L/G parity pattern of the left half and by nothing else, so
   * two codes differing only in their first digit must produce different bars.
   */
  it('encodes the leading digit in the parity of the left half', () => {
    const a = bits('590123412345', 'ean13');
    const b = bits('690123412345', 'ean13');
    expect(a).not.toBe(b);
    // ★ THE FIRST FIVE RIGHT-HAND DIGITS ONLY. The sixth is the check digit,
    //   which is derived from all twelve and therefore legitimately differs —
    //   comparing the whole right half proves nothing about parity.
    expect(a.slice(50, 85)).toBe(b.slice(50, 85));
    expect(a.slice(3, 45)).not.toBe(b.slice(3, 45));
  });

  /**
   * ★★★ AND THE PARITY PATTERN HAS TO BE READ AT THE RIGHT INDEX. Shifting it by
   * one position survived the test above: two codes with different leading
   * digits still produce different bars under a shifted pattern, so "not equal"
   * proves nothing about WHICH pattern was applied. The check that does is
   * structural — L-codes carry an odd number of dark modules (three) and
   * G-codes an even number (four), so the parity string is directly readable
   * off the encoded bits, position by position.
   */
  it('applies the parity pattern position by position, not one place off', () => {
    /** 'L' or 'G' for each of the six left-half digits, read off the bars. */
    const leftParity = (value: string): string => {
      const b = bits(value, 'ean13');
      let out = '';
      for (let i = 0; i < 6; i++) {
        const group = b.slice(3 + i * 7, 3 + (i + 1) * 7);
        const ones = group.split('').filter((c) => c === '1').length;
        out += ones % 2 === 1 ? 'L' : 'G';
      }
      return out;
    };

    // Leading digit 0 → LLLLLL. A one-place shift runs off the end of the
    // six-character pattern, so the sixth digit comes out G.
    expect(leftParity('012345678901')).toBe('LLLLLL');
    // Leading digit 5 → LGGLLG, which is asymmetric in every position.
    expect(leftParity('512345678901')).toBe('LGGLLG');
    // Leading digit 9 → LGGLGL.
    expect(leftParity('912345678901')).toBe('LGGLGL');
  });

  it('covers every module with no gap and no overlap', () => {
    for (const [v, s] of [['590123412345', 'ean13'], ['9638507', 'ean8'], ['ABC-123', 'code128']] as const) {
      const e = svEncode(v, s);
      let at = 0;
      for (const m of e.modules) {
        expect(m.at).toBe(at);
        expect(m.width).toBeGreaterThan(0);
        at += m.width;
      }
      expect(at).toBe(e.moduleCount);
    }
  });

  it('alternates bar and space, never two bars in a row', () => {
    for (const [v, s] of [['590123412345', 'ean13'], ['HELLO 42', 'code128']] as const) {
      const mods = svEncode(v, s).modules;
      for (let i = 1; i < mods.length; i++) expect(mods[i].bar).not.toBe(mods[i - 1].bar);
    }
  });

  it('starts and ends a Code 128 symbol with a bar', () => {
    const mods = svEncode('HELLO', 'code128').modules;
    expect(mods[0].bar).toBe(true);
    expect(mods[mods.length - 1].bar).toBe(true);
  });

  /**
   * ★★★ THE STOP PATTERN CARRIES ITS OWN TERMINATING BAR. It is the one pattern
   * with SEVEN runs (`2331112`, thirteen modules) where every other has six of
   * eleven. The first version of this encoder appended a further two-module bar
   * "because the spec has a trailing bar" — producing two adjacent bars, which
   * a scanner reads as one wider bar and therefore as a different stop pattern.
   * Two adjacent black bars look exactly like one black bar, so nothing about
   * the rendering would ever have shown it.
   */
  it('terminates with the stop pattern\'s own two-module bar, and no extra one', () => {
    const e = svEncode('A', 'code128');
    const last = e.modules[e.modules.length - 1];
    expect(last.bar).toBe(true);
    expect(last.width).toBe(2);

    // Start + data + check at eleven modules each, plus the thirteen-module stop.
    expect(e.moduleCount).toBe(11 * 3 + 13);
  });

  it('reports the check digit it appended in the human-readable text', () => {
    const e = svEncode('590123412345', 'ean13');
    expect(e.text).toBe('5901234123457');
    expect(e.check).toBe(7);
  });

  it('does not append a second check digit to a value that already has one', () => {
    expect(svEncode('5901234123457', 'ean13').text).toBe('5901234123457');
  });
});

// ── Quiet zones ─────────────────────────────────────────────────────────────

describe('the quiet zones', () => {
  /**
   * ★★★ PART OF THE SYMBOL, NOT PADDING AROUND IT. The scanner uses the blank
   * margins to find the edges; flush against a table border, a perfect barcode
   * stops scanning and nobody can see why.
   */
  it('reserves the mandated margins, asymmetrically for EAN', () => {
    const e = svEncode('590123412345', 'ean13');
    expect(e.quietLeft).toBe(SV_QUIET_EAN_LEFT);
    expect(e.quietRight).toBe(SV_QUIET_EAN_RIGHT);
    expect(e.quietLeft).not.toBe(e.quietRight);
  });

  it('reserves ten modules each side for Code 128', () => {
    const e = svEncode('HELLO', 'code128');
    expect(e.quietLeft).toBe(SV_QUIET_CODE128);
    expect(e.quietRight).toBe(SV_QUIET_CODE128);
  });

  it('counts the quiet zones in the drawn width', () => {
    const e = svEncode('590123412345', 'ean13');
    expect(svBarcodeWidth(e, 2)).toBe((11 + 95 + 7) * 2);
  });

  it('reserves them even for a value it refused, so the layout does not jump', () => {
    const e = svEncode('123', 'ean13');
    expect(e.quietLeft).toBe(SV_QUIET_EAN_LEFT);
  });
});

// ── Module width ────────────────────────────────────────────────────────────

describe('the module width', () => {
  /**
   * ★★★ A SUB-PIXEL MODULE IS AN UNSCANNABLE BARCODE THAT LOOKS FINE. A scanner
   * measures ratios between runs, and antialiasing jitter reads as different
   * run lengths.
   */
  it('snaps to whole device pixels', () => {
    expect(svSnapModuleWidth(1.7, 1)).toBe(2);
    expect(svSnapModuleWidth(2.4, 1)).toBe(2);
  });

  it('snaps in device pixels, not CSS pixels, on a retina screen', () => {
    // 1.7 CSS px at dpr 2 is 3.4 device px → 3 device px → 1.5 CSS px.
    expect(svSnapModuleWidth(1.7, 2)).toBe(1.5);
  });

  it('never collapses a module to zero', () => {
    expect(svSnapModuleWidth(0.1, 1)).toBe(1);
    expect(svSnapModuleWidth(0, 1)).toBe(1);
  });

  it('survives a nonsense device pixel ratio rather than producing NaN', () => {
    expect(svSnapModuleWidth(2, Number.NaN)).toBe(2);
    expect(svSnapModuleWidth(2, 0)).toBe(2);
    expect(svSnapModuleWidth(2, -3)).toBe(2);
  });
});

// ── Guard bars ──────────────────────────────────────────────────────────────

describe('the extended guard bars', () => {
  /**
   * ★★ NOT A FLOURISH. The long guards are how a human recognises the symbol and
   * where it splits; an EAN with every bar the same height still scans and no
   * operator recognises it.
   */
  it('extends the outer and centre guards on an EAN-13', () => {
    const e = svEncode('590123412345', 'ean13');
    const guard = e.modules.filter((m) => svIsGuardModule(e, m));
    // Three runs at each end plus five in the middle.
    expect(guard.length).toBeGreaterThanOrEqual(9);
    expect(svIsGuardModule(e, e.modules[0])).toBe(true);
    expect(svIsGuardModule(e, e.modules[e.modules.length - 1])).toBe(true);
  });

  it('puts the centre guard at module 45 on an EAN-13 and 31 on an EAN-8', () => {
    const a = svEncode('590123412345', 'ean13');
    expect(svIsGuardModule(a, { at: 45, width: 1, bar: false })).toBe(true);
    expect(svIsGuardModule(a, { at: 44, width: 1, bar: false })).toBe(false);

    const b = svEncode('9638507', 'ean8');
    expect(svIsGuardModule(b, { at: 31, width: 1, bar: false })).toBe(true);
    expect(svIsGuardModule(b, { at: 30, width: 1, bar: false })).toBe(false);
  });

  /**
   * ★★ THE GUARD SET, EXACTLY — NOT "AT LEAST NINE". Shortening the trailing
   * guard from three modules to two left every assertion above green: the last
   * module is still a guard, and a count expressed as `>=` cannot see one go
   * missing. The three positions are fixed by the symbol's geometry (95 modules:
   * 3 + 42 + 5 + 42 + 3), so the spec can name them.
   */
  it('marks exactly the eleven guard modules of an EAN-13, and no others', () => {
    const e = svEncode('590123412345', 'ean13');
    const marked = e.modules.filter((m) => svIsGuardModule(e, m)).map((m) => m.at);
    expect(marked).toEqual([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  });

  it('marks exactly the eleven guard modules of an EAN-8', () => {
    // 67 modules: 3 + 28 + 5 + 28 + 3.
    const e = svEncode('9638507', 'ean8');
    const marked = e.modules.filter((m) => svIsGuardModule(e, m)).map((m) => m.at);
    expect(marked).toEqual([0, 1, 2, 31, 32, 33, 34, 35, 64, 65, 66]);
  });

  it('has no guard bars on Code 128, which has no such thing', () => {
    const e = svEncode('HELLO', 'code128');
    expect(e.modules.some((m) => svIsGuardModule(e, m))).toBe(false);
  });
});

// ── Label ───────────────────────────────────────────────────────────────────

describe('the encoding label', () => {
  it('names the symbology, the encoded text and the check', () => {
    expect(svEncodingLabel(svEncode('590123412345', 'ean13')))
      .toBe('EAN-13 · 5901234123457 · check 7');
  });

  it('says so when nothing could be encoded', () => {
    expect(svEncodingLabel(svEncode('12', 'ean13'))).toBe('EAN-13 · cannot encode');
  });

  it('names Code 128 by its own name', () => {
    expect(svEncodingLabel(svEncode('A', 'code128'))).toContain('Code 128');
  });
});
