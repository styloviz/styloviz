import {
  svSplitPastedList, svApplyPastedList, svPasteListSummary,
} from './paste-list';

/**
 * ============================================================================
 *  Pasting a list into a control that takes one at a time  ·  `FI-26-I3`/`M3`
 * ============================================================================
 *
 * ★★★ NEITHER TAG INPUT HAD A PASTE HANDLER AT ALL — grepped in both twins,
 *     zero occurrences of `paste` or `clipboard`. Pasting two hundred email
 *     addresses put two hundred addresses in the query box as ONE STRING, and
 *     Enter made a single tag labelled with the entire list.
 *
 * ★★ The item asked what happens when a paste of 200 hits a limit of 50. The
 *    answer was that the limit never came into it, because the paste was never
 *    a list.
 */

describe('svSplitPastedList — the delimiter set, written down', () => {
  it('splits on comma, semicolon, tab and newline', () => {
    expect(svSplitPastedList('a@x.com, b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(svSplitPastedList('a@x.com; b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(svSplitPastedList('a@x.com\tb@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(svSplitPastedList('a@x.com\nb@x.com')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('handles a Windows newline without leaving a \\r on the end', () => {
    /**
     * ★★ AN INVISIBLE CHARACTER IS THE WORST KIND OF DIFFERENCE. A list copied
     *    out of Notepad arrives `\r\n`-separated; treating `\r` as content
     *    leaves `"a@x.com\r"`, which then fails an equality check against the
     *    identical-LOOKING entry already in the list — so it is added twice and
     *    the two chips are indistinguishable.
     */
    expect(svSplitPastedList('a@x.com\r\nb@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(svSplitPastedList('a@x.com\r\n')[0]).not.toContain('\r');
  });

  it('does NOT split on a space, because names have spaces in them', () => {
    // ⚠️ The decision worth defending. Splitting on whitespace turns every
    //    pasted person into two broken tags.
    expect(svSplitPastedList('Alex Chen, Priya Nair')).toEqual(['Alex Chen', 'Priya Nair']);
  });

  it('keeps a quoted segment together with its comma', () => {
    /**
     * ★★★ `"Chen, Alex" <a@x.com>` IS ONE ENTRY IN EVERY MAIL CLIENT'S
     *     CLIPBOARD FORMAT. Splitting inside the quotes produces two entries,
     *     neither of which is an address — and both of which look plausible
     *     enough to end up as tags.
     */
    expect(svSplitPastedList('"Chen, Alex" <a@x.com>, b@x.com'))
      .toEqual(['"Chen, Alex" <a@x.com>', 'b@x.com']);
  });

  it('collapses runs of delimiters and trims each entry', () => {
    expect(svSplitPastedList('a@x.com,,,\n\n  b@x.com  ,')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('is empty for empty or whitespace-only text', () => {
    expect(svSplitPastedList('')).toEqual([]);
    expect(svSplitPastedList('   \n\t ')).toEqual([]);
    expect(svSplitPastedList(null as unknown as string)).toEqual([]);
  });

  it('is one entry when there is nothing to split on', () => {
    // The ordinary single paste must keep working — it is most of the traffic.
    expect(svSplitPastedList('a@x.com')).toEqual(['a@x.com']);
  });
});

describe('svApplyPastedList — 200 into 50', () => {
  const many = (n: number): string[] => Array.from({ length: n }, (_, i) => `u${i}@x.com`);

  it('accepts what fits and reports the rest, which is the only honest answer', () => {
    /**
     * ★★★ THE ITEM'S QUESTION. Taking all 200 breaks the host's cap. Taking
     *     none punishes the user for 150 they could not have known about.
     *     Taking 50 SILENTLY is the worst of the three, because the list looks
     *     like it worked and 150 addresses are gone.
     */
    const r = svApplyPastedList(many(200), { max: 50 });
    expect(r.accepted).toHaveLength(50);
    expect(r.rejected).toHaveLength(150);
    expect(r.total).toBe(200);
    expect(new Set(r.rejected.map((x) => x.reason))).toEqual(new Set(['limit']));
  });

  it('counts what is already there against the cap', () => {
    const r = svApplyPastedList(many(10), { existing: ['a@x.com', 'b@x.com'], max: 5 });
    expect(r.accepted).toHaveLength(3);
  });

  it('preserves order and takes the FIRST n', () => {
    // ⚠️ Not "the ones that fit best" — there is no such thing — and not the
    //    last n, which would silently prefer the bottom of a pasted column.
    const r = svApplyPastedList(['a', 'b', 'c', 'd'], { max: 2 });
    expect(r.accepted).toEqual(['a', 'b']);
  });

  it('reports a duplicate as a duplicate, not as the thing that hit the cap', () => {
    /**
     * ★★ THE ORDER OF THE CHECKS IS THE MESSAGE. An entry that was going to be
     *    rejected as a duplicate must not be reported as "over the limit"
     *    merely because it happened to be sitting on the boundary — the user
     *    would go and delete tags to make room for something that was never
     *    going to be added.
     */
    const r = svApplyPastedList(['a', 'b'], { existing: ['a'], max: 1 });
    expect(r.rejected).toEqual([{ text: 'a', reason: 'duplicate' }, { text: 'b', reason: 'limit' }]);
  });

  it('treats a repeat inside the paste itself as a duplicate', () => {
    // Otherwise two identical entries land, which is the `FI-26-I1` defect
    // arriving through a different door.
    const r = svApplyPastedList(['a', 'b', 'a']);
    expect(r.accepted).toEqual(['a', 'b']);
    expect(r.rejected).toEqual([{ text: 'a', reason: 'duplicate' }]);
  });

  it('uses the host’s idea of "same" when given one', () => {
    const ci = (x: string, y: string): boolean => x.toLowerCase() === y.toLowerCase();
    const r = svApplyPastedList(['A@x.com'], { existing: ['a@x.com'], compare: ci });
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].reason).toBe('duplicate');
  });

  it('lets the host refuse an entry outright', () => {
    const r = svApplyPastedList(['a@x.com', 'nonsense'], {
      validate: (e) => e.includes('@'),
    });
    expect(r.accepted).toEqual(['a@x.com']);
    expect(r.rejected).toEqual([{ text: 'nonsense', reason: 'invalid' }]);
  });

  it('has no cap when max is 0', () => {
    expect(svApplyPastedList(many(300), { max: 0 }).accepted).toHaveLength(300);
  });

  it('accepts everything when nothing is in the way', () => {
    const r = svApplyPastedList(['a', 'b', 'c']);
    expect(r.accepted).toEqual(['a', 'b', 'c']);
    expect(r.rejected).toEqual([]);
  });
});

describe('svPasteListSummary', () => {
  it('is empty when everything went in, so nothing is announced', () => {
    expect(svPasteListSummary(svApplyPastedList(['a', 'b']))).toBe('');
  });

  it('names the reasons separately, because they need different actions', () => {
    /**
     * ★★ "150 were not added" tells somebody nothing about what to do.
     *    "50 added, 120 over the limit, 30 already in the list" tells them to
     *    remove some tags or split the paste.
     */
    const r = svApplyPastedList(['a', 'b', 'c', 'd'], { existing: ['a'], max: 3, validate: (e) => e !== 'd' });
    const s = svPasteListSummary(r, 'tag');
    expect(s).toContain('added');
    expect(s).toContain('already in the list');
    expect(s).toContain('not recognised');
  });

  it('gets the singular right', () => {
    const r = svApplyPastedList(['a', 'b'], { existing: ['a'] });
    expect(svPasteListSummary(r, 'tag')).toContain('1 tag added');
  });
});
