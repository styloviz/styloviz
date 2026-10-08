import { parseMarkdown, safeHref } from './markdown-parser';

/**
 * Pathological input (1.0 audit, M5). The parser re-runs on every streamed
 * chunk, and its input is model output — which a prompt injection controls.
 * Two patterns backtracked quadratically: ~2 s for 50,000 spaces each. Every
 * case here must finish in a few milliseconds, AND mean what it meant before.
 */
const fast = (fn: () => unknown, budgetMs = 100) => {
  const t = performance.now();
  fn();
  return performance.now() - t < budgetMs;
};
const ws = ' '.repeat(50_000);

describe('markdown parser — linear time on hostile input', () => {
  it('a long whitespace line after a pipe row', () => {
    expect(fast(() => parseMarkdown(`| a | b |\n${ws}x\n`))).toBe(true);
  });

  it('a link URL made of spaces', () => {
    expect(fast(() => safeHref(`/x${ws}y`))).toBe(true);
    expect(fast(() => parseMarkdown(`[t](/x${ws}y)`))).toBe(true);
  });
});

describe('markdown parser — same meaning as before', () => {
  it.each([
    ['| --- | --- |', true],
    ['|---|---|', true],
    ['--- | :--: | ---:', true],
    ['--- | :-: | ---:', false],
    [' | :--- | ', true],
    ['---', true],
    ['|---||---|', false],
    ['| - | --- |', false],
    ['| a | b |', false],
    ['|', false],
  ])('delimiter row %j → table %s', (divider, isTable) => {
    const blocks = parseMarkdown(`| h1 | h2 |\n${divider}\n| 1 | 2 |\n`);
    expect(blocks.some((b) => b.kind === 'table')).toBe(isTable);
  });

  it.each([
    ['/docs/page "Title"', '/docs/page'],
    ['https://a.example/x  (paren title)', 'https://a.example/x'],
    ["/u 'single'", '/u'],
    ['/plain', '/plain'],
    ['javascript:alert(1) "t"', null],
  ])('safeHref(%j) → %j', (raw, expected) => {
    expect(safeHref(raw)).toBe(expected);
  });
});
