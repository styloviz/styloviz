import { svDescribedBy } from './described-by';

/**
 * `FI-27-I3` / `FI-27-M1` — one `aria-describedby` composer, with one order.
 *
 * The shape this replaces was `showError() ? errorId : null`, which is not
 * "describe this field" but "describe this field with the error INSTEAD of the
 * hint". Every test here is about composing rather than choosing.
 */
describe('svDescribedBy', () => {
  it('composes hint, error and count in that order', () => {
    expect(svDescribedBy({ hint: 'h', error: 'e', count: 'c' })).toBe('h e c');
  });

  /**
   * The order is a property of this function, not of its callers — arguments
   * given out of order still come back in it. Each call site choosing for
   * itself is how a kit ends up with fields that read differently for no reason
   * a user could name.
   */
  it('fixes the order regardless of how the parts are written', () => {
    expect(svDescribedBy({ count: 'c', error: 'e', hint: 'h' })).toBe('h e c');
  });

  it('keeps every part that is present, rather than choosing one', () => {
    expect(svDescribedBy({ hint: 'h', error: 'e' })).toBe('h e');
    expect(svDescribedBy({ hint: 'h', count: 'c' })).toBe('h c');
    expect(svDescribedBy({ error: 'e', count: 'c' })).toBe('e c');
  });

  it('drops a part the template is not rendering', () => {
    // The condition passed is the same one the template renders on, so an id
    // can never name an element that is not there — which announces nothing and
    // reports nothing.
    expect(svDescribedBy({ hint: false, error: 'e', count: null })).toBe('e');
    expect(svDescribedBy({ hint: undefined, error: '', count: '   ' })).toBeNull();
  });

  /**
   * `aria-describedby=""` is a present attribute naming nothing, and some
   * assistive tech treats that differently from an absent one.
   */
  it('returns null rather than an empty string when there is nothing to say', () => {
    expect(svDescribedBy({})).toBeNull();
    expect(svDescribedBy({ hint: false, error: false, count: false })).toBeNull();
  });

  it('appends extras after the three named parts, in the order given', () => {
    expect(svDescribedBy({ hint: 'h', error: 'e', extra: ['x', 'y'] })).toBe('h e x y');
    expect(svDescribedBy({ extra: ['only'] })).toBe('only');
  });

  it('drops empty extras without leaving a gap in the list', () => {
    expect(svDescribedBy({ hint: 'h', extra: [false, 'x', null, undefined, ''] })).toBe('h x');
  });

  /**
   * A control that describes itself with one id twice makes some readers
   * announce it twice, and the caller cannot always tell — `extra` is often
   * built from a list the host supplies.
   */
  it('says each id once', () => {
    expect(svDescribedBy({ hint: 'h', error: 'h', extra: ['h', 'x'] })).toBe('h x');
  });
});
