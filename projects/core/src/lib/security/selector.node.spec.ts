import { svAttrSelector, svEscapeAttrValue } from './selector';

/**
 * ★★ THE TEST THAT WOULD HAVE CAUGHT THE BUG IS THE HYPHEN ONE. `CSS.escape`
 *    escapes a hyphen-led identifier, so `CSS.escape('data-x')` is `data\\-x`
 *    — valid, and matching nothing inside a quoted attribute value. That is the
 *    silent half; the `ReferenceError` half only shows up where `CSS` is
 *    undefined.
 */
describe('svEscapeAttrValue', () => {
  it('escapes the two characters that can end a double-quoted string', () => {
    expect(svEscapeAttrValue('say "hi"')).toBe('say \\"hi\\"');
    expect(svEscapeAttrValue('a\\b')).toBe('a\\\\b');
  });

  it('leaves everything else alone, unlike CSS.escape', () => {
    for (const value of ['orders', 'order-8814', '42', 'a b', 'a.b', 'a#b', 'ünïcode']) {
      expect(svEscapeAttrValue(value)).toBe(value);
    }
  });

  it('is a no-op on an empty string', () => {
    expect(svEscapeAttrValue('')).toBe('');
  });
});

describe('svAttrSelector', () => {
  it('builds a quoted attribute selector', () => {
    expect(svAttrSelector('data-nav-item', 'orders')).toBe('[data-nav-item="orders"]');
  });

  it('keeps a hyphenated id matchable', () => {
    expect(svAttrSelector('data-day', '2026-09-21')).toBe('[data-day="2026-09-21"]');
  });

  /** A value that would otherwise close the string early and throw SyntaxError. */
  it('survives a quote in the value', () => {
    expect(svAttrSelector('data-id', 'a"b')).toBe('[data-id="a\\"b"]');
  });
});

/**
 * ⚠️ NOT A TEST OF `CSS.escape` — a test of the ENVIRONMENT, pinned because the
 *    bug this file exists to prevent is invisible without it: jsdom defines no
 *    `CSS` global at all, so `CSS?.escape` throws rather than evaluating to
 *    `undefined`, and a `try` around it turns a broken feature into a silent
 *    one.
 */
describe('why the guard cannot be optional chaining', () => {
  it('has no CSS global to chain off', () => {
    expect(typeof (globalThis as Record<string, unknown>)['CSS']).toBe('undefined');
    // `CSS?.escape` here would be a ReferenceError, not `undefined`.
    expect(() => (0, eval)('CSS?.escape')).toThrow(ReferenceError);
  });
});
