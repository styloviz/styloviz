import { svCompilePattern, svIsCatastrophicPattern } from './pattern';

/**
 * ============================================================================
 *  Compiling someone else's regular expression
 * ============================================================================
 *
 * ★★★ THE COST BEING PREVENTED IS NOT HYPOTHETICAL AND NOT SMALL. Measured on
 *     Node 24 / V8, one `.test()` call against a 30-character input:
 *     `(a|a?)+b` 32.9 s, `(x|x)*y` 6.0 s, `(a*)*b` 4.2 s, `([a-zA-Z]+)*$` 2.3 s,
 *     `(a+)+b` 1.9 s. The kit ran these on every keystroke, from a schema the
 *     server sent.
 *
 * ★★ SO THE TESTS DO NOT RUN THE BAD PATTERNS. A spec that proved the danger by
 *    reproducing it would hang the suite for half a minute per case, on a
 *    machine whose engine may be faster or slower than the one the number came
 *    from — a timing assertion that flakes is worse than no assertion. What is
 *    asserted instead is the classification, over a table where **every entry
 *    was measured by hand before it was written down** (`/tmp/redos.mjs`, and
 *    the figures are in `pattern.ts`'s header).
 *
 * ★ The safe list matters as much as the dangerous one. A checker that refuses
 *   `[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}` is a checker that gets switched off,
 *   and then nothing is checked at all.
 * ============================================================================
 */

describe('svIsCatastrophicPattern — R1, a repeating group that repeats', () => {
  const NESTED = [
    ['(a+)+b', 'the canonical one: 1.9 s measured'],
    ['(a*)*b', '4.2 s measured'],
    ['(a+)*b', 'star outside, plus inside'],
    ['([a-zA-Z]+)*$', '2.3 s measured — the inner quantifier is on a class'],
    ['(\\d{2,})+$', '{2,} is unbounded, which `{2,4}` is not'],
    ['(?:(?:a+)+)b', 'non-capturing groups are the same shape'],
    ['(a|a?)+b', '32.9 s measured — the `?` inside is the nested quantifier'],
  ] as const;

  it.each(NESTED)('flags %s (%s)', (pattern) => {
    expect(svIsCatastrophicPattern(pattern)).not.toBeNull();
  });

  it('does not flag a bounded inner quantifier', () => {
    // `{2,4}` cannot repeat unboundedly, so the outer `+` has a finite number of
    // divisions to try. Flagging it would refuse a large class of real patterns
    // for nothing.
    expect(svIsCatastrophicPattern('(\\d{2,4})+$')).toBeNull();
  });

  it('does not flag an unquantified group containing a quantifier', () => {
    // `(\d+)` is every capture group ever written. The danger needs BOTH
    // quantifiers; this test is what stops the rule being "contains a plus".
    expect(svIsCatastrophicPattern('(\\d+)')).toBeNull();
    expect(svIsCatastrophicPattern('^(\\w+)@(\\w+)$')).toBeNull();
  });
});

describe('svIsCatastrophicPattern — R2, a repeating alternation that overlaps', () => {
  it('flags identical branches', () => {
    // 6.0 s measured. The one R2 case V8 does not optimise away.
    expect(svIsCatastrophicPattern('(x|x)*y')).not.toBeNull();
  });

  it('flags branches sharing a first character', () => {
    expect(svIsCatastrophicPattern('(a|ab)+c')).not.toBeNull();
  });

  it('flags branches it cannot enumerate, rather than assuming they are disjoint', () => {
    // `(\s|\S)+` is the textbook example. Its branches are escapes this module
    // will not expand, and "cannot tell" has to mean "assume overlapping" —
    // the other default silently passes the most famous ReDoS in the canon.
    expect(svIsCatastrophicPattern('(\\s|\\S)+$')).not.toBeNull();
  });

  /**
   * ★★ The measured truth, recorded rather than smoothed over: V8 completes
   *    `(a|ab)+c` and `(\s|\S)+$` instantly. They are flagged anyway, because
   *    that optimisation is in no specification and this kit also runs on
   *    JavaScriptCore and SpiderMonkey. Refusing a pattern one engine handles
   *    costs a line in a problem list; accepting one another engine does not
   *    costs the user their browser.
   */

  it('leaves a disjoint alternation alone', () => {
    expect(svIsCatastrophicPattern('(cat|dog)+')).toBeNull();
    expect(svIsCatastrophicPattern('^(yes|no)+$')).toBeNull();
  });

  it('leaves an UNQUANTIFIED overlapping alternation alone', () => {
    // `(a|ab)` without a quantifier has nothing to explode. This is the claim
    // that keeps the rule about repetition rather than about alternation.
    expect(svIsCatastrophicPattern('(a|ab)c')).toBeNull();
  });
});

describe('svIsCatastrophicPattern — the scanner underneath', () => {
  /**
   * ★★★ EVERY CASE HERE WAS CHOSEN BY MUTATING THE SCANNER AND KEEPING ONLY THE
   *     INPUTS WHOSE VERDICT CHANGED.
   *
   *     The first draft of this block asserted the obvious things — `[()]+`,
   *     `[(]*[)]*`, `[a|b]+`, `[]]+` — and **all four passed with character-class
   *     skipping deleted from the scanner entirely**. They were not testing the
   *     skipping; they were passing because a `)` inside a class is always
   *     followed by the class's own `]`, so the bogus group it closes never
   *     picks up a quantifier and never gets flagged either way.
   *
   *     A test that passes against the broken implementation is not evidence.
   *     These are the two inputs that actually distinguish.
   */
  it('does not let a `(` inside a character class steal a later `)`', () => {
    // `(a+[(]b)+` IS catastrophic — an unbounded group whose body repeats. With
    // the class read as literal text the outer group closes at the real `)`,
    // carries `+`, and is flagged. Read naively, the `(` inside the class opens
    // a second group that swallows that `)`; the outer one then never closes,
    // is never recorded, and the pattern passes. A FALSE NEGATIVE on a genuine
    // 2-second freeze — the worst direction for this checker to be wrong in.
    expect(svIsCatastrophicPattern('(a+[(]b)+')).not.toBeNull();
  });

  it('does not mistake a `|` inside a character class for an alternation', () => {
    // `([|]ab)+` repeats a group matching one punctuation character then `ab` —
    // perfectly safe. Read naively, the class's `|` splits the body into `[`
    // and `]ab`; `[` is a branch whose first characters cannot be enumerated,
    // which the overlap test must treat as overlapping, and the pattern is
    // refused. A false positive, which is how a checker gets switched off.
    expect(svIsCatastrophicPattern('([|]ab)+')).toBeNull();
  });

  it('does not mistake an escaped `*` or `+` for a quantifier', () => {
    // `(\+\*)+` repeats two literal punctuation marks — no nested quantifier at
    // all. A scanner reading `+` and `*` without honouring the backslash flags it.
    expect(svIsCatastrophicPattern('(\\+\\*)+')).toBeNull();
  });

  it('does not mistake an escaped parenthesis for a group', () => {
    expect(svIsCatastrophicPattern('\\(\\d+\\)')).toBeNull();
  });

  it('handles a `]` as the first member of a class', () => {
    expect(svIsCatastrophicPattern('[]]+')).toBeNull();
  });

  it('still finds the nested quantifier through a named group', () => {
    expect(svIsCatastrophicPattern('(?<word>a+)+b')).not.toBeNull();
  });

  it('still finds it through a non-capturing group', () => {
    expect(svIsCatastrophicPattern('(?:a+)+b')).not.toBeNull();
  });
});

describe('svIsCatastrophicPattern — patterns people actually write', () => {
  /**
   * ★★★ A CHECKER THAT REFUSES ORDINARY PATTERNS GETS SWITCHED OFF, and then
   *     nothing is checked. This list is the one that decides whether the
   *     feature survives contact with a real schema.
   */
  const REAL = [
    '\\d{4}',
    '[A-Z]{2}\\d{6}',
    '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}',
    '\\+?[0-9 ()-]{7,20}',
    '[0-9]{3}-[0-9]{2}-[0-9]{4}',
    '^[A-Za-z][A-Za-z0-9_-]{2,31}$',
    'https?://[^\\s]+',
    '[^@]+@[^@]+',
    '^(0[1-9]|1[0-2])/\\d{2}$',
    '^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
  ] as const;

  it.each(REAL)('leaves %s alone', (pattern) => {
    expect(svIsCatastrophicPattern(pattern)).toBeNull();
  });
});

describe('svCompilePattern', () => {
  it('anchors by default, because unanchored validation validates almost nothing', () => {
    const { regexp } = svCompilePattern('\\d{4}');
    expect(regexp).not.toBeNull();
    expect(regexp!.test('1999')).toBe(true);
    // The bug this prevents: unanchored, both of these match.
    expect(regexp!.test('12345')).toBe(false);
    expect(regexp!.test('not-a-year-1999')).toBe(false);
  });

  it('anchors with a NON-capturing group, so the author’s own numbering survives', () => {
    const { regexp } = svCompilePattern('(\\d{2})-(\\d{2})');
    expect(regexp!.exec('01-02')?.[1]).toBe('01');
    expect(regexp!.exec('01-02')?.[2]).toBe('02');
  });

  it('can be told not to anchor', () => {
    const { regexp } = svCompilePattern('\\d{4}', { anchor: false });
    expect(regexp!.test('not-a-year-1999')).toBe(true);
  });

  it('reports an unparseable pattern instead of throwing', () => {
    // The old behaviour in sv-form-builder: this threw inside a computed() and
    // took the whole form down. One unbalanced bracket in a CMS field.
    const result = svCompilePattern('(');
    expect(result.regexp).toBeNull();
    expect(result.problem).toBe('invalid');
    expect(result.reason).toContain('not a valid regular expression');
  });

  it('refuses a catastrophic pattern and says which shape it found', () => {
    const result = svCompilePattern('(a+)+b');
    expect(result.regexp).toBeNull();
    expect(result.problem).toBe('catastrophic');
    // The message has to name the offending fragment: a schema author looking
    // at a list of twelve fields needs to know which one, and why.
    expect(result.reason).toContain('(a+)');
    expect(result.reason).toContain('freeze');
  });

  it('compiles a catastrophic pattern when the host explicitly allows it', () => {
    const result = svCompilePattern('(a+)+b', { allowUnsafe: true });
    expect(result.regexp).not.toBeNull();
    expect(result.problem).toBeUndefined();
  });

  it('still refuses an unparseable pattern under allowUnsafe', () => {
    // There is nothing to trust: a pattern that does not parse cannot be run
    // whatever anyone believes about where it came from.
    const result = svCompilePattern('(', { allowUnsafe: true });
    expect(result.regexp).toBeNull();
    expect(result.problem).toBe('invalid');
  });

  it('never returns both a regexp and a problem', () => {
    // The contract the callers rely on: `regexp` non-null means "run it", and
    // there is no third case to get wrong.
    for (const source of ['\\d{4}', '(a+)+b', '(', '(cat|dog)+', '[']) {
      const r = svCompilePattern(source);
      expect(Boolean(r.regexp) && Boolean(r.problem), source).toBe(false);
      expect(Boolean(r.regexp) || Boolean(r.problem), source).toBe(true);
    }
  });
});
