import {
  svDiffSplitSections,
  svDiffViewItems,
  svLineDiff,
  svPairWordSegments,
  svParsePatch,
  svWordDiff,
  type SvDiffRow,
} from './diff-viewer.logic';

/**
 * The pure half of sv-diff-viewer. The engine is core's `svDiffLines`; what is
 * pinned here is the adaptation — line endings, the final newline, the size
 * cap, word segments, patch parsing — and the folding a reader sees.
 */

const kinds = (rows: readonly SvDiffRow[]) => rows.map((r) => `${r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '}${r.text}`);

describe('svLineDiff', () => {
  it('two empty texts are identical with no rows', () => {
    const d = svLineDiff('', '');
    expect(d).toMatchObject({ identical: true, status: 'ok', added: 0, removed: 0, rows: [] });
  });

  it('identical texts keep every line as context, numbered on both sides', () => {
    const d = svLineDiff('a\nb\nc\n', 'a\nb\nc\n');
    expect(d.identical).toBe(true);
    expect(kinds(d.rows)).toEqual([' a', ' b', ' c']);
    expect(d.rows.map((r) => [r.oldNo, r.newNo])).toEqual([[1, 1], [2, 2], [3, 3]]);
  });

  it('an insertion is one added line with no old number', () => {
    const d = svLineDiff('a\nc\n', 'a\nb\nc\n');
    expect(kinds(d.rows)).toEqual([' a', '+b', ' c']);
    expect(d.rows[1]).toMatchObject({ oldNo: null, newNo: 2 });
    expect(d).toMatchObject({ added: 1, removed: 0, identical: false });
  });

  it('a deletion is one removed line with no new number', () => {
    const d = svLineDiff('a\nb\nc\n', 'a\nc\n');
    expect(kinds(d.rows)).toEqual([' a', '-b', ' c']);
    expect(d.rows[1]).toMatchObject({ oldNo: 2, newNo: null });
  });

  it('a replacement is a removal followed by an addition', () => {
    const d = svLineDiff('a\nold\nc\n', 'a\nnew\nc\n');
    expect(kinds(d.rows)).toEqual([' a', '-old', '+new', ' c']);
    expect(d).toMatchObject({ added: 1, removed: 1 });
  });

  it('from nothing, every line is added; to nothing, every line is removed', () => {
    expect(kinds(svLineDiff('', 'x\ny').rows)).toEqual(['+x', '+y']);
    expect(kinds(svLineDiff('x\ny', '').rows)).toEqual(['-x', '-y']);
  });

  it('a text that is one empty line is not the same as an empty text', () => {
    const d = svLineDiff('', '\n');
    expect(d.identical).toBe(false);
    expect(kinds(d.rows)).toEqual(['+']);
  });

  it('treats CRLF and LF as the same line ending, and says they differed', () => {
    const d = svLineDiff('a\r\nb\r\n', 'a\nb\n');
    expect(d.identical).toBe(true);
    expect(d.lineEndingsDiffer).toBe(true);
    expect(kinds(d.rows)).toEqual([' a', ' b']);
  });

  it('a missing final newline on one side changes the last line, and flags the side without it', () => {
    const d = svLineDiff('a\nb\n', 'a\nb');
    expect(kinds(d.rows)).toEqual([' a', '-b', '+b']);
    expect(d.rows[1]!.noEol).toBeUndefined();
    expect(d.rows[2]!.noEol).toBe(true);
    // The marker never leaks into the text.
    expect(d.rows.every((r) => !/[]/.test(r.text))).toBe(true);
  });

  it('no final newline on either side is not a change', () => {
    expect(svLineDiff('a\nb', 'a\nb').identical).toBe(true);
  });

  it('can ignore whitespace and case', () => {
    expect(svLineDiff('  Hello', 'hello', { ignoreWhitespace: true, ignoreCase: true }).identical).toBe(true);
    expect(svLineDiff('  Hello', 'hello').identical).toBe(false);
  });

  it('refuses past maxLines and says how big each side was', () => {
    const big = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const d = svLineDiff(big, big + '\nmore', { maxLines: 40 });
    expect(d).toMatchObject({ status: 'too-large', rows: [], oldLineCount: 30, newLineCount: 31 });
    expect(svLineDiff(big, big, { maxLines: 0 }).status).toBe('ok');
  });

  it('reports a wholesale replacement when the edit budget runs out', () => {
    const a = Array.from({ length: 50 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 50 }, (_, i) => `b${i}`).join('\n');
    const d = svLineDiff(a, b, { maxEdits: 10 });
    expect(d.status).toBe('too-different');
    expect(d.removed).toBe(50);
    expect(d.added).toBe(50);
  });
});

describe('svWordDiff', () => {
  it('marks only the words that changed', () => {
    const w = svWordDiff('const total = price * qty;', 'const total = price * quantity;')!;
    expect(w.before.filter((s) => s.changed).map((s) => s.text)).toEqual(['qty']);
    expect(w.after.filter((s) => s.changed).map((s) => s.text)).toEqual(['quantity']);
    expect(w.before.map((s) => s.text).join('')).toBe('const total = price * qty;');
  });

  it('declines when the lines share no word', () => {
    expect(svWordDiff('alpha beta', 'gamma delta')).toBeNull();
  });

  it('declines on lines too long to be worth it', () => {
    const long = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ');
    expect(svWordDiff(long, long + ' x')).toBeNull();
  });
});

describe('svPairWordSegments', () => {
  it('pairs removals with additions within a change block and leaves the rest whole', () => {
    const rows = svLineDiff('keep\nlet a = 1;\nlet b = 2;\nend', 'keep\nlet a = 10;\nend').rows;
    const view = svPairWordSegments(rows);
    const del = view.filter((r) => r.kind === 'del');
    const add = view.find((r) => r.kind === 'add')!;
    expect(del[0]!.segments?.some((s) => s.changed && s.text === '1')).toBe(true);
    expect(add.segments?.some((s) => s.changed && s.text === '10')).toBe(true);
    expect(del[1]!.segments).toBeNull();
    expect(view.filter((r) => r.kind === 'context').every((r) => r.segments === null)).toBe(true);
  });
});

describe('svDiffViewItems — folding unchanged runs', () => {
  const lines = (n: number, prefix = 'l') => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

  it('keeps `context` lines either side of a change and folds the rest', () => {
    const a = [...lines(10), 'old', ...lines(10, 'm')].join('\n');
    const b = [...lines(10), 'new', ...lines(10, 'm')].join('\n');
    const view = svPairWordSegments(svLineDiff(a, b).rows);
    const items = svDiffViewItems(view, 3, new Set());
    expect(items.map((i) => i.type)).toEqual([
      'fold', 'row', 'row', 'row', 'row', 'row', 'row', 'row', 'row', 'fold',
    ]);
    expect(items[0]).toMatchObject({ type: 'fold', count: 7 });
    expect(items[items.length - 1]).toMatchObject({ type: 'fold', count: 7 });
  });

  it('unfolds a run once its id is expanded', () => {
    const a = [...lines(10), 'old'].join('\n');
    const b = [...lines(10), 'new'].join('\n');
    const view = svPairWordSegments(svLineDiff(a, b).rows);
    const folded = svDiffViewItems(view, 3, new Set());
    const fold = folded.find((i) => i.type === 'fold')!;
    const open = svDiffViewItems(view, 3, new Set([fold.id]));
    expect(open.some((i) => i.type === 'fold')).toBe(false);
    expect(open.filter((i) => i.type === 'row')).toHaveLength(view.length);
  });

  it('does not fold a single line — the button would be taller than the line', () => {
    const a = [...lines(4), 'old', ...lines(4, 'm')].join('\n');
    const b = [...lines(4), 'new', ...lines(4, 'm')].join('\n');
    const items = svDiffViewItems(svPairWordSegments(svLineDiff(a, b).rows), 3, new Set());
    expect(items.some((i) => i.type === 'fold')).toBe(false);
  });

  it('folds the whole of an identical text', () => {
    const view = svPairWordSegments(svLineDiff(lines(6).join('\n'), lines(6).join('\n')).rows);
    expect(svDiffViewItems(view, 3, new Set())).toEqual([
      expect.objectContaining({ type: 'fold', count: 6 }),
    ]);
  });

  it('lays the same items out side by side, padding the shorter side of a change', () => {
    const view = svPairWordSegments(svLineDiff('a\nx\ny\nb', 'a\nz\nb').rows);
    const sections = svDiffSplitSections(svDiffViewItems(view, 3, new Set()));
    expect(sections).toHaveLength(1);
    const section = sections[0]!;
    if (section.type !== 'rows') throw new Error('expected rows');
    expect(section.rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null])).toEqual([
      ['a', 'a'],
      ['x', 'z'],
      ['y', null],
      ['b', 'b'],
    ]);
  });
});

describe('svParsePatch', () => {
  const PATCH = [
    'diff --git a/src/app.ts b/src/app.ts',
    'index 3b18e51..a1c2d3f 100644',
    '--- a/src/app.ts',
    '+++ b/src/app.ts',
    '@@ -10,4 +10,4 @@ export class App {',
    '   readonly title = "app";',
    '-  readonly count = 1;',
    '+  readonly count = 2;',
    '   ngOnInit() {}',
    '',
    '@@ -40,2 +40,3 @@',
    ' }',
    '+// end',
    ' export {}',
    '\\ No newline at end of file',
  ].join('\n');

  it('reads the hunks, the line numbers and the names', () => {
    const p = svParsePatch(PATCH);
    expect(p.valid).toBe(true);
    expect(p.oldName).toBe('src/app.ts');
    expect(p.newName).toBe('src/app.ts');
    expect(p).toMatchObject({ added: 2, removed: 1, moreFiles: false });
    expect(p.rows[0]).toMatchObject({ kind: 'context', oldNo: 10, newNo: 10 });
    expect(p.rows[1]).toMatchObject({ kind: 'del', oldNo: 11, newNo: null, text: '  readonly count = 1;' });
    expect(p.rows[2]).toMatchObject({ kind: 'add', oldNo: null, newNo: 11 });
  });

  it('reads an empty line inside a hunk as an empty context line', () => {
    const p = svParsePatch(PATCH);
    expect(p.rows[4]).toMatchObject({ kind: 'context', text: '', oldNo: 13, newNo: 13 });
  });

  it('counts the lines a patch leaves out, before and between hunks', () => {
    const p = svParsePatch(PATCH);
    expect(p.gaps).toEqual([
      { before: 0, count: 9 },
      { before: 5, count: 26 },
    ]);
  });

  it('flags "No newline at end of file" on the line it follows', () => {
    const p = svParsePatch(PATCH);
    expect(p.rows[p.rows.length - 1]).toMatchObject({ text: 'export {}', noEol: true });
  });

  it('shows the first file of a multi-file patch and says there were more', () => {
    const p = svParsePatch(`${PATCH}\ndiff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -1 +1 @@\n-x\n+y`);
    expect(p.moreFiles).toBe(true);
    expect(p.rows.some((r) => r.text === 'y')).toBe(false);
  });

  it('is not valid without a hunk header, and keeps markup as text', () => {
    expect(svParsePatch('just some text').valid).toBe(false);
    const p = svParsePatch('@@ -1 +1 @@\n-<b>a</b>\n+<script>x</script>');
    expect(p.rows.map((r) => r.text)).toEqual(['<b>a</b>', '<script>x</script>']);
  });

  it('handles CRLF patches', () => {
    const p = svParsePatch('@@ -1,2 +1,2 @@\r\n a\r\n-b\r\n+c\r\n');
    expect(p.rows.map((r) => r.text)).toEqual(['a', 'b', 'c']);
  });

  it('folds nothing across a gap — the patch never carried those lines', () => {
    const p = svParsePatch(PATCH);
    const items = svDiffViewItems(svPairWordSegments(p.rows), 3, new Set(), p.gaps);
    expect(items[0]).toMatchObject({ type: 'gap', count: 9 });
    expect(items.filter((i) => i.type === 'gap')).toHaveLength(2);
  });
});
