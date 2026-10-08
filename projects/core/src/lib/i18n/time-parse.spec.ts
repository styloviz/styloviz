import { svParseTime, svResolveHour24, svFormatTime } from './time-parse';

/**
 * ============================================================================
 *  Reading a time somebody typed  ·  `FI-28-I1` / `FI-28-M1`
 * ============================================================================
 *
 * ★★★ MEASURED, NOT ASSERTED: `sv-time-picker` open with `format="24h"` and
 *     `withSeconds` exposes **146 tab stops**, and minute `37` is the **61st**.
 *     There is no text input anywhere in the component and no arrow-key
 *     navigation, so document order is the only navigation there is. Setting
 *     14:37 by keyboard meant sixty-one presses of Tab.
 *
 * ★★ THE PARSER RETURNS PARTS, NOT A TIME, and that is the whole design. `2:30`
 *    is not a time in a 12-hour control — it is two, and only the component
 *    knows which. A parser that guessed would be right half the time and silent
 *    about it.
 */

const at = (h: number, m = 0, s = 0, period: 'AM' | 'PM' | null = null) => ({
  hour: h, minute: m, second: s, period,
});

describe('svParseTime — the forms people actually type', () => {
  it('reads the colon forms', () => {
    expect(svParseTime('14:30')).toEqual(at(14, 30));
    expect(svParseTime('09:05:30')).toEqual(at(9, 5, 30));
    expect(svParseTime('9:5')).toEqual(at(9, 5));
  });

  it('reads a dot, because half of Europe types one', () => {
    expect(svParseTime('14.30')).toEqual(at(14, 30));
  });

  it('reads bare digits, which is what a fast typist produces', () => {
    // ★★ THE LENGTH IS THE GRAMMAR. `143` can only be 1:43 and `1430` can only
    //    be 14:30, so each length has exactly one reading and none of them
    //    needs a guess.
    expect(svParseTime('14')).toEqual(at(14));
    expect(svParseTime('143')).toEqual(at(1, 43));
    expect(svParseTime('1430')).toEqual(at(14, 30));
    expect(svParseTime('93015')).toEqual(at(9, 30, 15));
    expect(svParseTime('143015')).toEqual(at(14, 30, 15));
  });

  it('reads a day period and keeps the hour as written', () => {
    expect(svParseTime('2:30 PM')).toEqual(at(2, 30, 0, 'PM'));
    expect(svParseTime('2:30pm')).toEqual(at(2, 30, 0, 'PM'));
    expect(svParseTime('2 am')).toEqual(at(2, 0, 0, 'AM'));
    expect(svParseTime('11:59:59 p.m.')).toEqual(at(11, 59, 59, 'PM'));
  });

  it('reads non-Latin digits, the same defect as `FI-16-I3`', () => {
    /**
     * ★★★ THE SAME `\\d`-IS-ASCII PROBLEM THAT EMPTIED THE OTP FIELD. A time
     *     typed on an Arabic, Bengali or Japanese keypad has to parse, or this
     *     new typed path is unusable for exactly the users the old one already
     *     failed.
     */
    expect(svParseTime('١٤:٣٠')).toEqual(at(14, 30));       // Arabic-Indic
    expect(svParseTime('১৪:৩০')).toEqual(at(14, 30));       // Bengali
    expect(svParseTime('１４:３０')).toEqual(at(14, 30));      // fullwidth
    expect(svParseTime('２:３０ PM')).toEqual(at(2, 30, 0, 'PM'));
  });

  it('reads a fullwidth colon, which a Japanese IME emits', () => {
    expect(svParseTime('１４：３０')).toEqual(at(14, 30));
  });

  it('reads a day period written in its own script', () => {
    // Not a locale table — four scripts where the marker is not a Latin
    // abbreviation. `FI-28-M4` is the complete version.
    expect(svParseTime('٢:٣٠ م')).toEqual(at(2, 30, 0, 'PM'));
    expect(svParseTime('2:30 午後')).toEqual(at(2, 30, 0, 'PM'));
    expect(svParseTime('2:30 오전')).toEqual(at(2, 30, 0, 'AM'));
  });
});

describe('svParseTime — what it refuses', () => {
  it('refuses an out-of-range time rather than clamping it', () => {
    /**
     * ⚠️ THE DECISION WORTH DEFENDING. `25:00` could be clamped to `23:59` and
     *    the control would look like it worked — which teaches the user their
     *    typing was accepted. `null` lets the field say "that is not a time"
     *    and leave the text alone to be corrected.
     */
    expect(svParseTime('25:00')).toBeNull();
    expect(svParseTime('12:61')).toBeNull();
    expect(svParseTime('10:30:75')).toBeNull();
  });

  it('refuses a 12-hour reading of an hour that is not one', () => {
    // "0 PM" and "13 PM" are not times anybody means.
    expect(svParseTime('0 PM')).toBeNull();
    expect(svParseTime('13:00 PM')).toBeNull();
  });

  it('refuses a half-typed time instead of filling in zeros', () => {
    // ★ "14:" is somebody mid-keystroke. Reading it as 14:00 commits a value
    //   they have not finished choosing, and does it on every keystroke.
    expect(svParseTime('14:')).toBeNull();
    expect(svParseTime(':30')).toBeNull();
  });

  it('refuses text that is not a time', () => {
    expect(svParseTime('')).toBeNull();
    expect(svParseTime('   ')).toBeNull();
    expect(svParseTime('noon')).toBeNull();
    expect(svParseTime('14:30 tomorrow')).toBeNull();
    expect(svParseTime('1:2:3:4')).toBeNull();
    expect(svParseTime('1234567')).toBeNull();
  });

  it('refuses rather than throwing on anything at all', () => {
    for (const junk of ['::::', '--', '👍', '1e3', 'NaN', '0x0E']) {
      expect(() => svParseTime(junk), junk).not.toThrow();
    }
  });
});

describe('svResolveHour24', () => {
  it('is the identity for an hour the text made unambiguous', () => {
    expect(svResolveHour24(at(14, 30), 'AM')).toBe(14);
    expect(svResolveHour24(at(0, 30), 'PM')).toBe(0);
  });

  it('applies the named period', () => {
    expect(svResolveHour24(at(2, 30, 0, 'PM'), null)).toBe(14);
    expect(svResolveHour24(at(2, 30, 0, 'AM'), null)).toBe(2);
  });

  it('gets the two 12 o’clocks right', () => {
    /**
     * ★★★ THE CASES THAT GO WRONG. 12 AM is `00` and 12 PM is `12` — the
     *     opposite of the `+12` rule that works for every other hour, so an
     *     implementation that applies `+12` uniformly is correct for eleven
     *     hours out of twelve and puts midnight at noon.
     */
    expect(svResolveHour24(at(12, 0, 0, 'AM'), null)).toBe(0);
    expect(svResolveHour24(at(12, 0, 0, 'PM'), null)).toBe(12);
  });

  it('falls back to what the control is already showing', () => {
    expect(svResolveHour24(at(2, 30), 'PM')).toBe(14);
    expect(svResolveHour24(at(2, 30), 'AM')).toBe(2);
  });

  it('ignores the fallback for an hour above 12', () => {
    /**
     * ⚠️ Typing `14:30` into a 12-hour control that currently shows AM means
     *    14:30. Honouring the fallback there would make the control disagree
     *    with the one unambiguous thing the user could have done.
     */
    expect(svResolveHour24(at(14, 30), 'AM')).toBe(14);
    expect(svResolveHour24(at(23, 0), 'AM')).toBe(23);
  });

  it('leaves a bare hour alone when there is no fallback', () => {
    expect(svResolveHour24(at(2, 30), null)).toBe(2);
  });

  it('round-trips every hour of the day through 12-hour form', () => {
    // ★★ The property, not twenty-four assertions: every 24-hour hour has a
    //    12-hour spelling that resolves back to it.
    for (let h = 0; h < 24; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      expect(svResolveHour24(at(h12, 0, 0, period), null), `${h}`).toBe(h);
    }
  });
});

describe('svFormatTime', () => {
  it('pads and includes seconds only when asked', () => {
    expect(svFormatTime(9, 5, 0)).toBe('09:05');
    expect(svFormatTime(9, 5, 3, true)).toBe('09:05:03');
    expect(svFormatTime(0, 0, 0)).toBe('00:00');
  });

  it('round-trips with the parser for every minute of a day', () => {
    // ★★ 1440 values, which is cheap and is the only way to know the two
    //    functions agree at the boundaries rather than in the middle.
    for (let t = 0; t < 1440; t++) {
      const text = svFormatTime(Math.floor(t / 60), t % 60, 0);
      const parsed = svParseTime(text);
      expect(parsed, text).not.toBeNull();
      expect(svResolveHour24(parsed!, null) * 60 + parsed!.minute, text).toBe(t);
    }
  });
});
