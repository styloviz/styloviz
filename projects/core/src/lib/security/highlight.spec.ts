import { svHighlightPositions, svHighlightSegments } from './highlight';

/**
 * ============================================================================
 *  Marking the query inside a result label  ·  `FI-01-I3`
 * ============================================================================
 *
 * ★★★ THE CLAIM THAT MATTERS IS THE ONE ABOUT REJOINING. Every segment run must
 *     concatenate back to the original label, character for character — that
 *     single property is what makes the whole approach safe, because it means
 *     no text was invented, dropped, escaped, or re-cased on the way through.
 *     It is asserted for every case below rather than in one place.
 *
 * ★★ AND THE TEXT NEVER CONTAINS MARKUP THIS MODULE WROTE. There is no `<mark>`
 *     anywhere in the output. The template writes it. An implementation that
 *     went back to string-building would fail `rejoins` immediately.
 * ============================================================================
 */

const rejoin = (segments: readonly { text: string }[]): string =>
  segments.map((s) => s.text).join('');

const marked = (segments: readonly { text: string; match: boolean }[]): string[] =>
  segments.filter((s) => s.match).map((s) => s.text);

describe('svHighlightSegments', () => {
  it('marks the query where it appears', () => {
    const segments = svHighlightSegments('Settings', 'set');
    expect(segments).toEqual([
      { text: 'Set', match: true },
      { text: 'tings', match: false },
    ]);
  });

  it('marks EVERY occurrence, not just the first', () => {
    // `sv-search-bar`'s third implementation of this marks only the first —
    // recorded in the working document as a follow-up rather than smoothed over
    // here, because its `{pre, match, post}` shape is exported API.
    const segments = svHighlightSegments('banana', 'an');
    expect(marked(segments)).toEqual(['an', 'an']);
    expect(rejoin(segments)).toBe('banana');
  });

  it('keeps the label’s own capitalisation in the marked run', () => {
    // ★★★ The mistake this kills: slicing the matched run out of the QUERY
    //     instead of out of the text. It passes every length and position
    //     assertion and silently lower-cases half of every result list.
    const segments = svHighlightSegments('Paris', 'paris');
    expect(marked(segments)).toEqual(['Paris']);
    expect(rejoin(segments)).toBe('Paris');
  });

  it('rejoins to the original label in every shape', () => {
    const cases: [string, string][] = [
      ['Settings', 'set'],
      ['banana', 'an'],
      ['banana', 'banana'],
      ['banana', 'x'],
      ['banana', ''],
      ['', 'an'],
      ['aaaa', 'aa'],
      ['Ünïcôde ñame', 'ô'],
      ['  padded  ', 'padded'],
    ];
    for (const [text, query] of cases) {
      expect(rejoin(svHighlightSegments(text, query)), `${text} / ${query}`).toBe(text);
    }
  });

  it('never emits an empty run', () => {
    // An empty segment renders an empty `<mark>`, which some screen readers
    // announce and which shows as a 0-width highlight box in Safari.
    for (const [text, query] of [['banana', 'b'], ['banana', 'a'], ['aaaa', 'aa'], ['abc', 'abc']]) {
      const segments = svHighlightSegments(text, query);
      expect(segments.every((s) => s.text.length > 0), `${text} / ${query}`).toBe(true);
    }
  });

  it('returns one unmatched run when nothing matches', () => {
    expect(svHighlightSegments('Go Home', 'xyz')).toEqual([{ text: 'Go Home', match: false }]);
  });

  it('treats a whitespace-only query as no query', () => {
    expect(svHighlightSegments('Go Home', '   ')).toEqual([{ text: 'Go Home', match: false }]);
  });

  describe('the query is user input, so it is never compiled', () => {
    /**
     * ★★★ `new RegExp(query)` IS TWO BUGS AT ONCE, AND BOTH ARE REACHABLE BY
     *     TYPING. `(` is a `SyntaxError` thrown out of a template expression;
     *     `(a+)+` is the frozen tab measured in `pattern.ts`. `sv-autocomplete`
     *     escaped the query before building its regex, which handles both — but
     *     not building one has nothing to get wrong.
     */
    it('does not throw on a query that is not a valid regular expression', () => {
      expect(() => svHighlightSegments('a (b) c', '(')).not.toThrow();
      expect(marked(svHighlightSegments('a (b) c', '('))).toEqual(['(']);
    });

    it('treats regex metacharacters as the literal characters they are', () => {
      expect(marked(svHighlightSegments('file.txt', '.'))).toEqual(['.']);
      // A `.` matching every character is what an unescaped regex does here.
      expect(svHighlightSegments('file.txt', '.')).toHaveLength(3);
      expect(marked(svHighlightSegments('a+b', '+'))).toEqual(['+']);
      expect(marked(svHighlightSegments('50%', '%'))).toEqual(['%']);
    });

    it('cannot be made slow by a catastrophic query', () => {
      const started = Date.now();
      svHighlightSegments('a'.repeat(200), '(a+)+b');
      expect(Date.now() - started).toBeLessThan(100);
    });
  });

  describe('a label containing markup', () => {
    /**
     * ★★★ THE DEFECT `FI-01-I3` IS ABOUT. `sv-autocomplete` bound
     *     `label.replace(re, '<mark>$1</mark>')` to `[innerHTML]`. Angular's
     *     sanitiser stops scripts — it does not stop `<b>`, `<a href>` or
     *     `<img src>`, so a suggestion API could style the row, add a link, or
     *     point an image at a host that logs every viewer's IP as the list
     *     scrolls past.
     */
    it('is returned as text, with no markup awareness at all', () => {
      const label = '<img src=x onerror=alert(1)>';
      const segments = svHighlightSegments(label, 'img');
      expect(rejoin(segments)).toBe(label);
      // The `<` and `>` are ordinary characters in ordinary runs. Nothing here
      // knows they are markup, which is exactly the property being asserted:
      // the template interpolates these, so Angular escapes them.
      expect(marked(segments)).toEqual(['img']);
    });

    it('does not put the module’s own markup into the text', () => {
      for (const query of ['a', 'mark', '<']) {
        const segments = svHighlightSegments('a <mark> b', query);
        expect(rejoin(segments)).toBe('a <mark> b');
      }
    });
  });
});

describe('svHighlightPositions', () => {
  it('marks the characters it is given', () => {
    expect(svHighlightPositions('abcd', [0, 2])).toEqual([
      { text: 'a', match: true },
      { text: 'b', match: false },
      { text: 'c', match: true },
      { text: 'd', match: false },
    ]);
  });

  it('coalesces adjacent matches into one run', () => {
    // Three `<mark>` elements around three consecutive characters is a stutter,
    // not a highlight — and each one gets its own rounded background.
    expect(svHighlightPositions('abcd', [0, 1, 2])).toEqual([
      { text: 'abc', match: true },
      { text: 'd', match: false },
    ]);
  });

  it('does not care what order the positions arrive in', () => {
    expect(svHighlightPositions('abcd', [2, 0, 1])).toEqual(
      svHighlightPositions('abcd', [0, 1, 2]),
    );
  });

  it('returns one unmatched run for an empty set', () => {
    expect(svHighlightPositions('abcd', [])).toEqual([{ text: 'abcd', match: false }]);
  });

  it('ignores positions past the end of the text', () => {
    const segments = svHighlightPositions('ab', [0, 99]);
    expect(rejoin(segments)).toBe('ab');
    expect(marked(segments)).toEqual(['a']);
  });

  it('rejoins to the original text', () => {
    for (const positions of [[0], [1], [0, 1, 2, 3], [3], [0, 3]]) {
      expect(rejoin(svHighlightPositions('abcd', positions))).toBe('abcd');
    }
  });
});
