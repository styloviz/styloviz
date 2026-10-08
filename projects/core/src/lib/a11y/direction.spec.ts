import { svIsRtl, svPointerFraction } from './direction';

/**
 * ============================================================================
 *  Which way the text runs  ·  `FI-24-I2`
 * ============================================================================
 *
 * ★★ THE BACKLOG ASKED "in an RTL layout, does the right arrow increase or
 *    decrease?" and the answer is: the browser decides, correctly, because
 *    `sv-slider` is a native `<input type="range">`. **The keyboard was never
 *    broken.** What was broken is everything drawn and measured around it.
 */

const inDom = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

afterEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('dir'); });

describe('svIsRtl', () => {
  it('is false with nothing to read', () => {
    expect(svIsRtl(null)).toBe(false);
    expect(svIsRtl(undefined)).toBe(false);
  });

  it('reads `dir` on the element itself', () => {
    const host = inDom('<span dir="rtl" id="a">x</span>');
    expect(svIsRtl(host.querySelector('#a'))).toBe(true);
  });

  it('reads `dir` from an ancestor', () => {
    /**
     * ⚠️ THIS IS THE ASSERTION THAT MADE THE ATTRIBUTE WALK NECESSARY. jsdom's
     *    `getComputedStyle` does NOT inherit `direction`, so it reports `'ltr'`
     *    for this element — an implementation that trusted only the computed
     *    style would pass every browser and fail here, and a suite that then
     *    dropped the test would be testing nothing.
     */
    const host = inDom('<div dir="rtl"><section><span id="a">x</span></section></div>');
    expect(svIsRtl(host.querySelector('#a'))).toBe(true);
  });

  it('lets a nearer `dir="ltr"` win over a further `dir="rtl"`', () => {
    // An LTR island inside an RTL page — a code block, a phone number, a
    // product name. `closest` gets this right for free; a loop looking only
    // for "rtl" anywhere above would not.
    const host = inDom('<div dir="rtl"><div dir="ltr"><span id="a">x</span></div></div>');
    expect(svIsRtl(host.querySelector('#a'))).toBe(false);
  });

  it('falls back to the document', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const host = inDom('<span id="a">x</span>');
    expect(svIsRtl(host.querySelector('#a'))).toBe(true);
  });

  it('is false for an ordinary LTR element', () => {
    const host = inDom('<span id="a">x</span>');
    expect(svIsRtl(host.querySelector('#a'))).toBe(false);
  });

  it('does not throw on a detached node', () => {
    const el = document.createElement('div');
    expect(() => svIsRtl(el)).not.toThrow();
    expect(svIsRtl(el)).toBe(false);
  });
});

describe('svPointerFraction', () => {
  const track = (dir: 'ltr' | 'rtl'): Element => {
    const host = inDom(`<div dir="${dir}"><div id="t"></div></div>`);
    const el = host.querySelector('#t')!;
    // jsdom has no layout, so the rect is supplied.
    el.getBoundingClientRect = () => ({ left: 100, width: 200, right: 300,
      top: 0, bottom: 0, height: 0, x: 100, y: 0, toJSON: () => ({}) }) as DOMRect;
    return el;
  };

  it('measures from the left in LTR, exactly as before', () => {
    const el = track('ltr');
    expect(svPointerFraction(100, el)).toBe(0);
    expect(svPointerFraction(200, el)).toBe(0.5);
    expect(svPointerFraction(300, el)).toBe(1);
  });

  it('measures from the RIGHT in RTL, which is the whole defect', () => {
    /**
     * ★★★ `(clientX - rect.left) / rect.width` HAS A DIRECTION IN IT AND THE
     *     DIRECTION IS LTR. In an RTL slider the thumb at `max` is drawn at the
     *     physical LEFT, so the old expression reported `0` for a click on the
     *     maximum. That fraction is what picks which handle a click grabs, so
     *     the wrong handle moved — and it moved the wrong way.
     */
    const el = track('rtl');
    expect(svPointerFraction(100, el)).toBe(1);
    expect(svPointerFraction(200, el)).toBe(0.5);
    expect(svPointerFraction(300, el)).toBe(0);
  });

  it('clamps outside the element rather than reporting past the ends', () => {
    expect(svPointerFraction(0, track('ltr'))).toBe(0);
    expect(svPointerFraction(9999, track('ltr'))).toBe(1);
    expect(svPointerFraction(0, track('rtl'))).toBe(1);
    expect(svPointerFraction(9999, track('rtl'))).toBe(0);
  });

  it('returns 0 for a zero-width element instead of NaN', () => {
    // ⚠️ Measured before layout, or while `display: none`. NaN would propagate
    //    into a value and out through the form.
    const host = inDom('<div id="t"></div>');
    const el = host.querySelector('#t')!;
    el.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;
    expect(svPointerFraction(50, el)).toBe(0);
  });

  it('is symmetric: the two directions sum to 1 at every point', () => {
    // ★★ The property rather than three samples. If they ever stop summing to
    //    1, one of them has acquired an off-by-one in the rect arithmetic.
    for (let x = 100; x <= 300; x += 7) {
      expect(svPointerFraction(x, track('ltr')) + svPointerFraction(x, track('rtl')), String(x))
        .toBeCloseTo(1, 10);
    }
  });
});
