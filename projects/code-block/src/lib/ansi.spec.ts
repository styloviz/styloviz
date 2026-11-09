import { svAnsiPlainText, svParseAnsi } from './ansi';
import { svIsScrolledToEnd } from './terminal-scroll';

/**
 * The ANSI subset sv-terminal honours, as data: SGR 0 / 1 / 22 / 39 and the
 * 30–37 / 90–97 colours become segments; every other sequence disappears.
 */
const ESC = '\u001b';

describe('svParseAnsi', () => {
  it('returns one plain segment for text with no escapes, and nothing for empty text', () => {
    expect(svParseAnsi('plain')).toEqual([{ text: 'plain', color: null, bright: false, bold: false }]);
    expect(svParseAnsi('')).toEqual([]);
  });

  it('reads the eight colours and resets with 0', () => {
    const segs = svParseAnsi(`${ESC}[31mred${ESC}[0m plain ${ESC}[32mgreen${ESC}[39m done`);
    expect(segs).toEqual([
      { text: 'red', color: 'red', bright: false, bold: false },
      { text: ' plain ', color: null, bright: false, bold: false },
      { text: 'green', color: 'green', bright: false, bold: false },
      { text: ' done', color: null, bright: false, bold: false },
    ]);
  });

  it('reads 90–97 as the bright twins', () => {
    expect(svParseAnsi(`${ESC}[96mcyan`)).toEqual([{ text: 'cyan', color: 'cyan', bright: true, bold: false }]);
  });

  it('combines bold with a colour in one sequence, and 22 ends bold only', () => {
    const segs = svParseAnsi(`${ESC}[1;33mwarn${ESC}[22m still yellow`);
    expect(segs).toEqual([
      { text: 'warn', color: 'yellow', bright: false, bold: true },
      { text: ' still yellow', color: 'yellow', bright: false, bold: false },
    ]);
  });

  it('treats ESC[m as a reset', () => {
    expect(svParseAnsi(`${ESC}[35mx${ESC}[my`)).toEqual([
      { text: 'x', color: 'magenta', bright: false, bold: false },
      { text: 'y', color: null, bright: false, bold: false },
    ]);
  });

  it('skips the sub-parameters of 38;5;n and 38;2;r;g;b instead of reading them as colours', () => {
    // `5` and `2` alone are not colours; `31` after the 256-colour form would be.
    const segs = svParseAnsi(`${ESC}[38;5;196mA${ESC}[0m${ESC}[38;2;10;20;30mB`);
    expect(segs.map((s) => s.color)).toEqual([null]);
    expect(segs.map((s) => s.text).join('')).toBe('AB');
  });

  it('drops cursor, erase and OSC sequences entirely', () => {
    const text = `${ESC}[2K${ESC}[1Aprogress${ESC}]0;window title\u0007 done${ESC}[?25l`;
    expect(svAnsiPlainText(text)).toBe('progress done');
    expect(svParseAnsi(text).every((s) => s.color === null)).toBe(true);
  });

  it('drops a lone ESC', () => {
    expect(svAnsiPlainText(`a${ESC}b`)).toBe('ab');
  });

  it('keeps markup as characters — the output is data, never HTML', () => {
    const segs = svParseAnsi(`${ESC}[31m<img src=x onerror=alert(1)>`);
    expect(segs[0]!.text).toBe('<img src=x onerror=alert(1)>');
  });

  it('merges adjacent runs with the same style', () => {
    expect(svParseAnsi(`${ESC}[31ma${ESC}[31mb`)).toEqual([{ text: 'ab', color: 'red', bright: false, bold: false }]);
  });
});

describe('svIsScrolledToEnd — the autoscroll pause rule', () => {
  it('follows at the bottom', () => {
    expect(svIsScrolledToEnd({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
  });

  it('tolerates a few pixels of rounding below the bottom', () => {
    expect(svIsScrolledToEnd({ scrollTop: 590, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
  });

  it('pauses once the reader has scrolled up past the threshold', () => {
    expect(svIsScrolledToEnd({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 })).toBe(false);
    expect(svIsScrolledToEnd({ scrollTop: 590, scrollHeight: 1000, clientHeight: 400 }, 4)).toBe(false);
  });

  it('counts a box with nothing to scroll as at the end', () => {
    expect(svIsScrolledToEnd({ scrollTop: 0, scrollHeight: 200, clientHeight: 400 })).toBe(true);
  });
});
