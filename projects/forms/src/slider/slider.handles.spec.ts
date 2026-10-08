import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSliderComponent } from './slider.component';

/**
 * `FI-24-I1` / `FI-24-M2` — which handle moves, and how close they may get.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 *
 * The two range handles are stacked native `<input type="range">` elements
 * filling the same box. Whichever is painted on top is the one a click reaches;
 * the component cannot intercept the hit test, only arrange it in advance.
 *
 * ★★★ THE OLD RULE WAS A MAGIC NUMBER COVERING ONE CASE OF THREE:
 *     `position(start) >= 97 ? start on top : end on top`.
 *
 *     • start 50 / end 51, mid-track. End is on top. A user reaching for START
 *       grabs END — which is already at its lower clamp, so dragging left does
 *       nothing at all. The only way to move the start handle is to drag the
 *       end one out of the way first, and nothing on screen says so.
 *     • 97 % is "near the right edge", not "adjacent". Two handles a pixel apart
 *       at 40 % are as stuck as two at 99 %.
 *
 * ★★ And the minimum gap was real but unwritten: the handlers clamped `start` to
 *    `end - step` and `end` to `start + step`, so the handles could never meet —
 *    a one-step minimum enforced as a side effect of clamping, documented
 *    nowhere and impossible to change.
 */

async function setup(inputs: ComponentInput<SvSliderComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvSliderComponent, { inputs });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const wrapper = (h: HTMLElement) => h.querySelector<HTMLElement>('[class*="relative w-full"]')!;

/** Pretend the track is 200px wide starting at x=0, and hover at `frac`. */
function hover(host: HTMLElement, frac: number): void {
  const w = wrapper(host);
  w.getBoundingClientRect = () =>
    ({ left: 0, width: 200, top: 0, height: 16, right: 200, bottom: 16, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  w.dispatchEvent(
    Object.assign(new Event('pointermove', { bubbles: true }), { clientX: frac * 200 }),
  );
}

describe('SvSliderComponent — the pointer picks the nearer handle', () => {
  it('puts the start handle on top when the pointer is nearer to it', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 50, rangeEnd: 51 });
    hover(el(fixture), 0.45);
    fixture.detectChanges();
    expect(fixture.componentInstance.startOnTop()).toBe(true);
  });

  it('puts the end handle on top when the pointer is nearer to that', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 50, rangeEnd: 51 });
    hover(el(fixture), 0.60);
    fixture.detectChanges();
    expect(fixture.componentInstance.startOnTop()).toBe(false);
  });

  it('reaches a start handle sitting one step from the end one, mid-track', async () => {
    // ★★★ The case the 97% rule could not see. Before this, a user could not
    //     move the start handle at all without first dragging the end handle
    //     out of the way.
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 40, rangeEnd: 41 });
    hover(el(fixture), 0.38);
    fixture.detectChanges();
    expect(fixture.componentInstance.startZIndex()).toBe('z-20');
    expect(fixture.componentInstance.endZIndex()).toBe('z-10');
  });

  it('forgets the pointer when it leaves the track', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 50, rangeEnd: 51 });
    hover(el(fixture), 0.10);
    fixture.detectChanges();
    expect(fixture.componentInstance.startOnTop()).toBe(true);

    wrapper(el(fixture)).dispatchEvent(new Event('pointerleave', { bubbles: true }));
    fixture.detectChanges();
    // Back to the fallback: nothing is pinned at max, so the conventional order.
    expect(fixture.componentInstance.startOnTop()).toBe(false);
  });
});

describe('SvSliderComponent — the fallback, for a touch with no hover', () => {
  it('lifts the start handle when the end one has nowhere to go', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 60, rangeEnd: 100 });
    expect(fixture.componentInstance.startOnTop()).toBe(true);
  });

  it('leaves the conventional order when both handles can still move', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 60, rangeEnd: 99 });
    expect(fixture.componentInstance.startOnTop()).toBe(false);
  });

  it('does not lift a start handle that is itself pinned at the minimum', async () => {
    // Both ends jammed: lifting `start` would buy nothing, since it cannot move
    // left either, and would take the end handle out of reach for no gain.
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 0, rangeEnd: 100 });
    expect(fixture.componentInstance.startOnTop()).toBe(false);
  });
});

describe('SvSliderComponent — the minimum gap is now stated', () => {
  it('defaults to one step, which is what it always silently was', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, step: 5, rangeStart: 20, rangeEnd: 80 });
    expect(fixture.componentInstance.resolvedMinGap()).toBe(5);
  });

  it('tracks step rather than freezing at whatever step was', async () => {
    // ★ Why the default is `null` and not a number: a numeric default would
    //   have captured `step` once and stopped following it.
    const { fixture } = await setup({ range: true, step: 1 });
    fixture.componentRef.setInput('step', 10);
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedMinGap()).toBe(10);
  });

  it('keeps the handles a stated distance apart', async () => {
    const { fixture } = await setup({
      range: true, min: 0, max: 100, step: 1, minGap: 20, rangeStart: 20, rangeEnd: 80,
    });
    const c = fixture.componentInstance;
    const inputs = [...el(fixture).querySelectorAll<HTMLInputElement>('input[type="range"]')];
    const start = inputs[0];

    start.value = '75';
    start.dispatchEvent(new Event('input', { bubbles: true }));
    expect(c.rangeStart()).toBe(60);   // 80 − 20, not 75
    expect(c.rangeEnd()).toBe(80);
  });

  it('holds the gap from the other side too', async () => {
    const { fixture } = await setup({
      range: true, min: 0, max: 100, step: 1, minGap: 20, rangeStart: 20, rangeEnd: 80,
    });
    const c = fixture.componentInstance;
    const end = [...el(fixture).querySelectorAll<HTMLInputElement>('input[type="range"]')][1];

    end.value = '25';
    end.dispatchEvent(new Event('input', { bubbles: true }));
    expect(c.rangeEnd()).toBe(40);     // 20 + 20
  });

  it('ignores a negative gap rather than inverting the handles', async () => {
    const { fixture } = await setup({ range: true, step: 2, minGap: -5 });
    expect(fixture.componentInstance.resolvedMinGap()).toBe(2);
  });
});

describe('SvSliderComponent — the paired number fields (FI-24-M1)', () => {
  /**
   * ★★★ A SLIDER CANNOT STATE AN EXACT NUMBER. On a 0–10,000 track one pixel is
   *     tens of units, so a drag can say "about 4,200" and never 4,250. Arrows
   *     can, at 200 presses. The field is the standard mitigation — and it is
   *     not a second control: it writes through the SAME clamping the handles
   *     use, because two paths to one value that clamp differently is how a
   *     range ends up with `start` past `end` and no error anywhere.
   */
  it('renders nothing extra unless asked', async () => {
    const { fixture } = await setup({ range: true });
    expect(el(fixture).querySelectorAll('sv-number-input').length).toBe(0);
  });

  it('pairs one field with a single-value slider', async () => {
    const { fixture } = await setup({ showInputs: true, value: 40, label: 'Budget' });
    const fields = el(fixture).querySelectorAll('sv-number-input');
    expect(fields.length).toBe(1);
    fixture.componentInstance.setValueFromInput(4250);
    expect(fixture.componentInstance.value()).toBe(100);   // clamped to max
  });

  it('pairs two fields with a range slider, named per handle', async () => {
    const { fixture } = await setup({ range: true, showInputs: true, label: 'Price' });
    const fields = [...el(fixture).querySelectorAll('sv-number-input')];
    expect(fields.length).toBe(2);
    const names = [...el(fixture).querySelectorAll('input[type="number"]')]
      .map(i => i.getAttribute('aria-label'));
    expect(names).toEqual(['Price minimum', 'Price maximum']);
  });

  it('holds the minimum gap when the number is typed rather than dragged', async () => {
    const { fixture } = await setup({
      range: true, showInputs: true, min: 0, max: 100, step: 1, minGap: 20,
      rangeStart: 20, rangeEnd: 80,
    });
    const c = fixture.componentInstance;
    c.setRangeStartFromInput(75);
    expect(c.rangeStart()).toBe(60);
    c.setRangeEndFromInput(10);
    expect(c.rangeEnd()).toBe(80);
  });

  it('clamps a typed number to the track bounds', async () => {
    const { fixture } = await setup({
      range: true, showInputs: true, min: 10, max: 90, rangeStart: 20, rangeEnd: 80,
    });
    const c = fixture.componentInstance;
    c.setRangeStartFromInput(-999);
    expect(c.rangeStart()).toBe(10);
    c.setRangeEndFromInput(999);
    expect(c.rangeEnd()).toBe(90);
  });

  it('reports the change once, like a drag does', async () => {
    const seen: [number, number][] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSliderComponent, {
      inputs: { range: true, showInputs: true, min: 0, max: 100, rangeStart: 20, rangeEnd: 80 } as ComponentInput<SvSliderComponent>,
      on: { rangeChange: (r: [number, number]) => seen.push(r) },
    });
    fixture.componentInstance.setRangeStartFromInput(30);
    expect(seen).toEqual([[30, 80]]);
  });

  it('says nothing when the typed number is the one already held', async () => {
    const seen: [number, number][] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSliderComponent, {
      inputs: { range: true, showInputs: true, rangeStart: 20, rangeEnd: 80 } as ComponentInput<SvSliderComponent>,
      on: { rangeChange: (r: [number, number]) => seen.push(r) },
    });
    fixture.componentInstance.setRangeStartFromInput(20);
    expect(seen).toEqual([]);
  });

  it('gives the field the decimals the track actually steps in', async () => {
    // ★ A step of 0.5 with a whole-number field is a field that cannot express
    //   half the values the track can.
    const { fixture } = await setup({ showInputs: true, step: 0.25 });
    expect(fixture.componentInstance.inputDecimals()).toBe(2);

    const whole = await setup({ showInputs: true, step: 5 });
    expect(whole.fixture.componentInstance.inputDecimals()).toBe(0);
  });
});

describe('SvSliderComponent — re-verification 2026-09-26: the clamp holds on screen', () => {
  it('puts the native thumb back when a repeat drag into the gap leaves the model unchanged', async () => {
    // 🔺 The first drag moves the model (20 → 60), so `[value]` rewrites the input.
    //    The SECOND drag into the gap leaves the model at 60 — Angular writes
    //    nothing, and the native thumb stayed at 75, past the gap.
    const { fixture } = await setup({
      range: true, min: 0, max: 100, step: 1, minGap: 20, rangeStart: 20, rangeEnd: 80,
    });
    const c = fixture.componentInstance;
    const [start, end] = [...el(fixture).querySelectorAll<HTMLInputElement>('input[type="range"]')];

    start.value = '75';
    start.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    start.value = '90';
    start.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(c.rangeStart()).toBe(60);
    expect(start.value).toBe('60');

    end.value = '10';
    end.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(c.rangeEnd()).toBe(80);
    expect(end.value).toBe('80');
  });
});
