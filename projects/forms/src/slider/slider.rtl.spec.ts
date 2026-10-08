import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSliderComponent } from './slider.component';

/**
 * ============================================================================
 *  The slider in a right-to-left layout  ·  `FI-24-I2`
 * ============================================================================
 *
 * ★★★ THE ITEM ASKED "does the right arrow increase or decrease?", AND THAT
 *     TURNED OUT TO BE THE PART THAT ALREADY WORKED. This slider is a native
 *     `<input type="range">`, and the browser flips both the thumb and the
 *     arrow keys in an RTL context — per platform, consistently with every
 *     other range input on the user's machine. Overriding it would have been
 *     the bug.
 *
 * ★★★ WHAT WAS BROKEN IS EVERYTHING THE COMPONENT DRAWS AND MEASURES AROUND
 *     THAT INPUT, and none of it was in the item:
 *
 *       1. the fill bar was `left-0` + `width: N%` — a PHYSICAL left, so it
 *          grew left-to-right while the thumb grew right-to-left. The bar
 *          showed the complement of the value.
 *       2. the range fill bound `[style.left]` / `[style.right]`, same.
 *       3. `(clientX - rect.left) / rect.width` read a fraction from the
 *          physical left edge, and that fraction decides WHICH HANDLE a click
 *          reaches. In RTL it picked the wrong one.
 *
 * ⚠️ 1 AND 2 ARE FIXED IN CSS, NOT IN TYPESCRIPT. `inset-inline-start` is
 *    resolved by the browser from the same `direction` the native input reads,
 *    so the fill and the thumb cannot disagree. A component computing its own
 *    left/right from a direction flag would reimplement that and drift from it
 *    the first time a stylesheet set `direction` without a `dir` attribute.
 */

async function setup(inputs: Partial<ComponentInput<SvSliderComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvSliderComponent, {
    inputs: inputs as ComponentInput<SvSliderComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const rect = (el: Element, left: number, width: number): void => {
  el.getBoundingClientRect = () => ({ left, width, right: left + width,
    top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
};

const move = (c: SvSliderComponent, el: Element, clientX: number): void => {
  c.onTrackPointerMove({ currentTarget: el, clientX } as unknown as PointerEvent);
};

afterEach(() => { document.documentElement.removeAttribute('dir'); });

describe('the fill uses logical insets, so it follows the thumb', () => {
  it('anchors the single fill to the inline START, not the physical left', async () => {
    /**
     * ★★★ ASSERTED AS A CLASS BECAUSE THAT IS WHERE THE BEHAVIOUR IS. jsdom has
     *     no layout, so there is no rendered position to measure — but the
     *     difference between `left-0` and `start-0` is exactly the difference
     *     between a bar that follows the thumb and one that opposes it, and the
     *     class is what the browser reads. Asserting the absence of `left-0` is
     *     what stops it coming back.
     */
    const { host } = await setup({ value: 40 });
    const fill = host.querySelector('[class*="rounded-full"][style*="width"]')!;
    expect(fill.className).toContain('start-0');
    expect(fill.className).not.toContain('left-0');
  });

  it('binds the range fill to inline insets rather than left/right', async () => {
    const { host } = await setup({ range: true, rangeStart: 20, rangeEnd: 60 });
    const html = host.innerHTML;
    // The rendered style attribute carries whichever property was bound.
    expect(html).toContain('inset-inline-start');
    expect(html).toContain('inset-inline-end');
  });

  it('still puts the fill where the value says in LTR', async () => {
    // ★★ THE CONTROL. A "fix" that broke the ordinary case would be worse than
    //    the defect, since LTR is most of the traffic.
    const { c } = await setup({ value: 40, min: 0, max: 100 });
    expect(c.fillPercent()).toBe('40%');
  });
});

describe('the pointer fraction is logical', () => {
  it('reads left-to-right in an LTR slider, exactly as before', async () => {
    const { c, host } = await setup({ range: true, rangeStart: 0, rangeEnd: 100, min: 0, max: 100 });
    const track = host.querySelector('[class*="relative"]')!;
    rect(track, 100, 200);

    move(c, track, 110);           // near the physical left = near 0
    expect(c.startOnTop()).toBe(true);   // the START handle is the nearer one
    move(c, track, 290);           // near the physical right = near 100
    expect(c.startOnTop()).toBe(false);
  });

  it('reads right-to-left in an RTL slider, which picks the other handle', async () => {
    /**
     * ★★★ THE DEFECT, AS A CONSEQUENCE RATHER THAN A COORDINATE. `startOnTop`
     *     decides which of two stacked native inputs a click reaches, and it
     *     decides by asking which handle the pointer is nearest. Feed it an
     *     LTR fraction in an RTL layout and it answers with the handle at the
     *     other end of the track — so the user grabs the maximum and the
     *     minimum moves.
     */
    document.documentElement.setAttribute('dir', 'rtl');
    const { c, host } = await setup({ range: true, rangeStart: 0, rangeEnd: 100, min: 0, max: 100 });
    const track = host.querySelector('[class*="relative"]')!;
    rect(track, 100, 200);

    move(c, track, 110);           // physical left, which in RTL is the MAXIMUM
    expect(c.startOnTop()).toBe(false);
    move(c, track, 290);           // physical right, which in RTL is the MINIMUM
    expect(c.startOnTop()).toBe(true);
  });

  it('is unchanged by a zero-width track rather than going NaN', async () => {
    const { c, host } = await setup({ range: true, rangeStart: 20, rangeEnd: 60 });
    const track = host.querySelector('[class*="relative"]')!;
    rect(track, 0, 0);
    move(c, track, 50);
    expect(Number.isNaN(c.rangeStart())).toBe(false);
    expect(c.rangeEnd()).toBe(60);
  });
});

describe('the keyboard is the platform’s job, and is left alone', () => {
  it('has no arrow-key handler of its own to get the direction wrong', async () => {
    /**
     * ★★★ THE ANSWER TO THE ITEM AS WRITTEN, ASSERTED AS AN ABSENCE. A native
     *     `<input type="range">` already flips Left/Right in an RTL context,
     *     per platform, consistently with every other slider on the user's
     *     machine. A component that added its own `keydown` would have to
     *     re-derive that and would disagree with the platform somewhere — so
     *     the right implementation is no implementation, and this test exists
     *     to stop somebody "fixing" it later.
     */
    const { fixture } = await setup({ value: 40 });
    /**
     * ⚠️ ASSERTED THROUGH `DebugElement.listeners`, NOT THROUGH `innerHTML`.
     *    My first version checked `host.innerHTML` for the string `keydown` —
     *    which an Angular event binding NEVER puts in the DOM, so it could not
     *    have failed for any implementation. `typecheck:all` caught the unused
     *    variable it left behind, which is how the vacuity was noticed at all.
     */
    const ranges = fixture.debugElement.queryAll(
      (de) => (de.nativeElement as HTMLElement)?.tagName === 'INPUT',
    );
    expect(ranges.length).toBeGreaterThan(0);
    for (const de of ranges) {
      const names = de.listeners.map((l) => l.name);
      expect(names, names.join(',')).not.toContain('keydown');
      expect(names).toContain('input'); // and the ones it DOES bind are there
    }
  });

  it('reports value, bounds and text the same way in both directions', async () => {
    // ★★ `aria-valuenow` and friends are NUMBERS, and numbers do not flip.
    //    A screen reader in Arabic announces 40 of 100 whichever way the track
    //    is drawn, and an implementation that "helpfully" mirrored the value
    //    would be reporting a different number to AT than to the eye.
    const ltr = await setup({ value: 40, min: 0, max: 100 });
    const ltrNow = ltr.host.querySelector('input[type="range"]')!.getAttribute('aria-valuenow');

    document.documentElement.setAttribute('dir', 'rtl');
    const rtl = await setup({ value: 40, min: 0, max: 100 });
    const rtlNow = rtl.host.querySelector('input[type="range"]')!.getAttribute('aria-valuenow');

    expect(rtlNow).toBe(ltrNow);
    expect(rtlNow).toBe('40');
  });
});

describe('re-verification 2026-09-26 — the value bubbles centre in both directions', () => {
  it('shifts each bubble back towards its anchor in RTL', async () => {
    // 🔺 In RTL the inline start is the right edge; a physical -50% shift alone
    //    pushed each bubble a full width away from its handle.
    const { host } = await setup({ range: true, showValue: true });
    const bubbles = [...host.querySelectorAll<HTMLElement>('span[class*="-translate-x-1/2"]')];
    expect(bubbles.length).toBe(2);
    for (const b of bubbles) expect(b.className).toContain('rtl:translate-x-1/2');
  });
});
