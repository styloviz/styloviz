import {
  svDiffLines,
  svDiffSummary,
  svDiffValues,
  svValueDiffSummary,
  type SvValueChange,
} from './diff';

/**
 * The diff engine, owned once.
 *
 * ★★★ Four families were each growing a corner of this. Code Block RENDERS a
 * diff it is handed and computes nothing; JSON Viewer wanted a JSON diff, Tree
 * View wanted to compare trees, Descriptions wanted to diff a record. Four UIs,
 * four half-engines, four sets of edge cases found separately. This is the
 * engine, and it is pure so it can be tested as arithmetic.
 */

const kinds = (r: ReturnType<typeof svDiffLines>) =>
  r.hunks.flatMap((h) => h.lines.map((l) => `${l.kind}:${l.text}`));

describe('svDiffLines', () => {
  it('says nothing about two identical texts', () => {
    const r = svDiffLines('a\nb\nc', 'a\nb\nc');
    expect(r.identical).toBe(true);
    expect(r.hunks).toEqual([]);
    expect(r.summary).toBe('No changes.');
  });

  it('finds a single changed line as a delete and an add', () => {
    const r = svDiffLines('a\nb\nc', 'a\nB\nc');
    expect(kinds(r)).toEqual(['context:a', 'del:b', 'add:B', 'context:c']);
    expect(r.added).toBe(1);
    expect(r.removed).toBe(1);
  });

  it('numbers the lines against their own side', () => {
    const r = svDiffLines('a\nb', 'a\nx\nb');
    const line = r.hunks[0].lines.find((l) => l.kind === 'add')!;
    // ★ An added line has no line number in the original, and a removed one has
    //   none in the new text. Filling either in is how a diff points at a line
    //   that does not exist.
    expect(line.oldNo).toBeNull();
    expect(line.newNo).toBe(2);
  });

  it('handles an empty side without inventing a blank line', () => {
    // `''.split('\n')` is `['']`, so a naive implementation reports one removed
    // empty line for a text that was never there.
    expect(svDiffLines('', 'a').removed).toBe(0);
    expect(svDiffLines('a', '').added).toBe(0);
    expect(svDiffLines('', '').identical).toBe(true);
  });

  it('keeps context either side, and collapses the rest', () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 15', 'CHANGED');
    const r = svDiffLines(before, after, { context: 2 });

    expect(r.hunks).toHaveLength(1);
    // 2 before + del + add + 2 after
    expect(r.hunks[0].lines).toHaveLength(6);
    expect(r.hunks[0].header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
  });

  it('merges two changes that would otherwise abut', () => {
    const before = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 3', 'A').replace('line 6', 'B');
    // ★ Two hunks separated by nothing is one hunk, and emitting them apart
    //   makes the count in the summary wrong.
    expect(svDiffLines(before, after, { context: 3 }).hunks).toHaveLength(1);
  });

  it('separates two changes that are genuinely far apart', () => {
    const before = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 3', 'A').replace('line 50', 'B');
    expect(svDiffLines(before, after, { context: 2 }).hunks).toHaveLength(2);
  });

  it('can be told to ignore whitespace', () => {
    expect(svDiffLines('  a  \nb', 'a\nb').identical).toBe(false);
    expect(svDiffLines('  a  \nb', 'a\nb', { ignoreWhitespace: true }).identical).toBe(true);
  });

  it('can be told to ignore case', () => {
    expect(svDiffLines('Hello', 'hello', { ignoreCase: true }).identical).toBe(true);
    expect(svDiffLines('Hello', 'hello').identical).toBe(false);
  });

  it('reports the ORIGINAL text even when comparing loosely', () => {
    // ★ The comparison is normalised; the output must not be. A diff that
    //   returned the trimmed line would silently rewrite the file it is
    //   describing.
    const r = svDiffLines('  a  \nb', '  a  \nB', { ignoreWhitespace: true });
    expect(kinds(r)).toContain('context:  a  ');
  });

  it('gives up rather than grinding on two unrelated texts', () => {
    // ★★★ Myers is O(ND) — fast when the texts are related and quadratic when
    //     they are not, which is exactly what a user reaches by pasting the
    //     wrong file. Forty seconds of work to produce one giant delete
    //     followed by one giant insert helps nobody.
    const a = Array.from({ length: 400 }, (_, i) => `alpha ${i}`).join('\n');
    const b = Array.from({ length: 400 }, (_, i) => `beta ${i * 7}`).join('\n');
    const r = svDiffLines(a, b, { maxEdits: 40 });

    expect(r.tooDifferent).toBe(true);
    expect(r.summary).toContain('too different');
    expect(r.added).toBe(400);
    expect(r.removed).toBe(400);
  });

  it('does not give up on a large but related text', () => {
    const before = Array.from({ length: 800 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 400', 'CHANGED');
    const r = svDiffLines(before, after);
    expect(r.tooDifferent).toBe(false);
    expect(r.added).toBe(1);
    expect(r.removed).toBe(1);
  });

  it('numbers every hunk with a stable id', () => {
    const before = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 3', 'A').replace('line 50', 'B');
    expect(svDiffLines(before, after, { context: 1 }).hunks.map((h) => h.id))
      .toEqual(['hunk-1', 'hunk-2']);
  });
});

describe('svDiffSummary', () => {
  it('is the sentence a screen reader gets instead of the colours', () => {
    // ★★ A diff conveys everything through red and green, which is the plainest
    //    possible 1.4.1 failure.
    expect(svDiffSummary(3, 12, 4)).toBe('3 changes, 12 lines added, 4 lines removed.');
  });

  it('counts in the singular when there is one of something', () => {
    expect(svDiffSummary(1, 1, 0)).toBe('1 change, 1 line added.');
  });

  it('says so when there is nothing to say', () => {
    expect(svDiffSummary(0, 0, 0)).toBe('No changes.');
  });
});

describe('svDiffValues', () => {
  const before = { id: 1, name: 'Ada', meta: { updatedAt: 'monday', by: 'system' }, tags: ['a', 'b'] };

  it('reports only what changed', () => {
    const changes = svDiffValues(before, { ...before, name: 'Grace' });
    expect(changes).toEqual<SvValueChange[]>([
      { path: 'name', kind: 'changed', before: 'Ada', after: 'Grace' },
    ]);
  });

  it('names a nested path in full', () => {
    const changes = svDiffValues(before, {
      ...before,
      meta: { ...before.meta, by: 'ada' },
    });
    expect(changes[0].path).toBe('meta.by');
  });

  it('indexes into an array', () => {
    const changes = svDiffValues(before, { ...before, tags: ['a', 'z'] });
    expect(changes[0].path).toBe('tags.1');
  });

  it('tells an added field from a removed one', () => {
    const added = svDiffValues({ a: 1 }, { a: 1, b: 2 });
    expect(added[0]).toEqual({ path: 'b', kind: 'added', before: undefined, after: 2 });

    const removed = svDiffValues({ a: 1, b: 2 }, { a: 1 });
    expect(removed[0]).toEqual({ path: 'b', kind: 'removed', before: 2, after: undefined });
  });

  it('takes a path predicate, not a key one', () => {
    // ★★★ Every real object comparison carries fields that always differ and
    //     never matter. The predicate takes the PATH so `meta.updatedAt` can be
    //     ignored while a top-level `updatedAt` is not.
    const changes = svDiffValues(
      before,
      { ...before, meta: { updatedAt: 'tuesday', by: 'system' } },
      { ignore: (path) => path === 'meta.updatedAt' },
    );
    expect(changes).toEqual([]);
  });

  it('keeps the reader’s own key order', () => {
    // A diff sorted alphabetically reorders the object under the reader.
    const changes = svDiffValues(
      { zebra: 1, apple: 1 },
      { zebra: 2, apple: 2 },
    );
    expect(changes.map((c) => c.path)).toEqual(['zebra', 'apple']);
  });

  it('can include what did not change', () => {
    const changes = svDiffValues({ a: 1, b: 2 }, { a: 1, b: 3 }, { includeUnchanged: true });
    expect(changes.map((c) => `${c.path}:${c.kind}`)).toEqual(['a:unchanged', 'b:changed']);
  });

  it('treats a null as a value rather than an absence', () => {
    const changes = svDiffValues({ a: null }, { a: 0 });
    expect(changes[0]).toEqual({ path: 'a', kind: 'changed', before: null, after: 0 });
  });

  it('does not report a field that is absent from both', () => {
    expect(svDiffValues({ a: undefined }, { a: undefined })).toEqual([]);
  });

  it('stops at maxDepth rather than recursing forever', () => {
    // ★ A cyclic structure is a hang and a stack overflow, and both are worse
    //   than an incomplete answer that says so.
    const deep = (n: number): unknown => (n === 0 ? 'leaf' : { next: deep(n - 1) });
    const changes = svDiffValues(deep(20), deep(20), { maxDepth: 3 });
    expect(changes).toEqual([]);

    const differing = svDiffValues(deep(20), { next: { next: { next: 'other' } } }, { maxDepth: 3 });
    expect(differing).toHaveLength(1);
  });

  it('compares two arrays of different lengths without dropping the tail', () => {
    const changes = svDiffValues({ t: ['a'] }, { t: ['a', 'b'] });
    expect(changes).toEqual([{ path: 't.1', kind: 'added', before: undefined, after: 'b' }]);
  });

  it('treats a swap of container type as one change, not a merge', () => {
    const changes = svDiffValues({ t: ['a'] }, { t: { 0: 'a' } });
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe('changed');
  });
});

describe('svValueDiffSummary', () => {
  it('counts by kind', () => {
    const changes = svDiffValues({ a: 1, b: 2, c: 3 }, { a: 9, b: 2, d: 4 });
    expect(svValueDiffSummary(changes)).toBe('3 fields: 1 changed, 1 added, 1 removed.');
  });

  it('is singular for one', () => {
    expect(svValueDiffSummary(svDiffValues({ a: 1 }, { a: 2 }))).toBe('1 field: 1 changed.');
  });

  it('ignores the unchanged ones it was asked to include', () => {
    const changes = svDiffValues({ a: 1, b: 2 }, { a: 1, b: 3 }, { includeUnchanged: true });
    expect(svValueDiffSummary(changes)).toBe('1 field: 1 changed.');
  });

  it('says so when there is nothing', () => {
    expect(svValueDiffSummary([])).toBe('No changes.');
  });
});
