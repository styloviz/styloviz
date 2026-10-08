import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvSignaturePadComponent } from './signature-pad.component';
import {
  isSignatureEmpty,
  pointCount,
  rescale,
  toSvg,
  type SignatureStroke,
  type SignatureValue,
} from './signature-pad.types';

/**
 * `sv-signature-pad`.
 *
 * jsdom has no 2-D context and no layout, so what is worth asserting here is
 * not "did it paint" — it is the MODEL, which is where every real bug lives:
 *
 *   • the signature survives a resize, because it is points and not pixels
 *   • a stray tap is not a signature
 *   • an empty pad exports NOTHING, not a blank PNG
 *   • undo removes a stroke, not a point
 *
 * The canvas is stubbed to a fixed box and a recording context, so the
 * coordinate maths is checked against real numbers rather than jsdom's zeros.
 */

const BOX = { left: 20, top: 40, width: 400, height: 160 };

interface Recorder {
  readonly ops: string[];
  readonly transforms: number[][];
}

/** A 2-D context that records rather than draws, plus a fixed box. */
function stubCanvas(canvas: HTMLCanvasElement): Recorder {
  const ops: string[] = [];
  const transforms: number[][] = [];
  const ctx = {
    strokeStyle: '', lineCap: '', lineJoin: '', lineWidth: 0,
    setTransform: (...a: number[]) => transforms.push(a),
    clearRect: () => ops.push('clear'),
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => ops.push(`move ${x.toFixed(0)},${y.toFixed(0)}`),
    lineTo: (x: number, y: number) => ops.push(`line ${x.toFixed(0)},${y.toFixed(0)}`),
    stroke: () => ops.push('stroke'),
  };
  canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
  canvas.getBoundingClientRect = () =>
    ({ ...BOX, right: BOX.left + BOX.width, bottom: BOX.top + BOX.height, x: BOX.left, y: BOX.top, toJSON: () => BOX }) as DOMRect;
  canvas.toDataURL = () => 'data:image/png;base64,STUB';
  return { ops, transforms };
}

async function setup(inputs: ComponentInput<SvSignaturePadComponent> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvSignaturePadComponent, { inputs });
  const canvas = view.fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  const recorder = stubCanvas(canvas);
  /**
   * ★ Re-measure AFTER the stub is in place.
   *
   * The component measures once in `afterNextRender`, which has already run by
   * the time `render()` returns — against jsdom's all-zero rect. In a browser a
   * ResizeObserver would fire the moment the element got a real size; here the
   * stub IS that moment, so the same call is made explicitly. Without it every
   * coordinate assertion below is checked against a 1×1 box.
   */
  (view.fixture.componentInstance as unknown as { resizeToBox: () => void })['resizeToBox']();
  view.fixture.detectChanges();
  return { ...view, canvas, recorder, pad: view.fixture.componentInstance };
}

/**
 * A pointer event, synthesised.
 *
 * ★★ jsdom DOES NOT IMPLEMENT `PointerEvent` — `new PointerEvent(…)` throws
 * `ReferenceError`. Any component built on the pointer model (which is the
 * right model: one code path for mouse, touch and pen, with capture) is
 * therefore untestable in jsdom until the event is built by hand. A `MouseEvent`
 * carries `clientX/clientY` correctly; `pointerId` and `pressure` are attached
 * on top, which is exactly the surface the component reads.
 */
function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pressure: { value: 0.5 },
    pointerType: { value: 'pen' },
  });
  return event;
}

/** Dispatch a pointer sequence in CSS pixels relative to the canvas box. */
function sign(canvas: HTMLCanvasElement, points: [number, number][]): void {
  const at = (i: number, type: string) =>
    pointerEvent(type, BOX.left + points[i][0], BOX.top + points[i][1]);
  canvas.dispatchEvent(at(0, 'pointerdown'));
  for (let i = 1; i < points.length; i++) {
    canvas.dispatchEvent(at(i, 'pointermove'));
  }
  canvas.dispatchEvent(at(points.length - 1, 'pointerup'));
}

// ── The stroke model ─────────────────────────────────────────────────────────

describe('signature-pad — the model', () => {
  const mark = (n: number): SignatureStroke => ({
    points: Array.from({ length: n }, (_, i) => ({ x: i, y: i, pressure: 0.5 })),
  });

  /**
   * ★★★ A STRAY TAP IS NOT A SIGNATURE.
   *
   * A pointer-down/up with no movement leaves one point — enough for
   * `strokes.length > 0`, and nothing a human would call a signature. Counting
   * it is how a form accepts a consent nobody gave.
   */
  it('does not call a single dot a signature', () => {
    expect(isSignatureEmpty([])).toBe(true);
    expect(isSignatureEmpty([mark(1)])).toBe(true);
    expect(isSignatureEmpty([mark(2)])).toBe(false);
    expect(isSignatureEmpty([mark(1), mark(1)])).toBe(true);
  });

  it('counts points across strokes', () => {
    expect(pointCount([mark(3), mark(4)])).toBe(7);
  });

  /**
   * ★★ A STORED SIGNATURE IS ONLY PORTABLE IF IT CARRIES ITS BOX.
   *
   * Points are captured in the CSS pixels of the pad that was signed in.
   * Replaying them into a print view or a PDF at a different size without
   * rescaling draws a signature that is the wrong size and clipped.
   */
  it('rescales into a different box', () => {
    const value: SignatureValue = { strokes: [{ points: [{ x: 10, y: 20, pressure: 0.5 }] }], width: 100, height: 200 };
    const out = rescale(value, 200, 100);
    expect(out[0].points[0]).toEqual({ x: 20, y: 10, pressure: 0.5 });
  });

  it('leaves the strokes alone at the same size, and when the box is unknown', () => {
    const value: SignatureValue = { strokes: [mark(2)], width: 100, height: 100 };
    expect(rescale(value, 100, 100)).toBe(value.strokes);
    expect(rescale({ ...value, width: 0, height: 0 }, 50, 50)).toBe(value.strokes);
  });

  /**
   * ★★★ AN EMPTY PAD EXPORTS NOTHING.
   *
   * `toSvg` returns `null` rather than an empty document, for the same reason
   * `toDataUrl` does: a caller that stores a blank export has filed a signature
   * nobody gave, and it is indistinguishable from one signed in invisible ink.
   */
  it('exports null when there is nothing to export', () => {
    expect(toSvg([], 100, 50)).toBeNull();
    expect(toSvg([mark(1)], 100, 50)).toBeNull();
  });

  /** A signature is a VECTOR — a bitmap of one is resolution-bound forever. */
  it('exports an SVG path with the box as its viewBox', () => {
    const svg = toSvg([mark(3)], 400, 160, '#000', 3)!;
    expect(svg).toContain('viewBox="0 0 400 160"');
    expect(svg).toContain('<path d="M0.00 0.00 L1.00 1.00 L2.00 2.00"');
    expect(svg).toContain('stroke-width="3"');
  });
});

// ── The component ────────────────────────────────────────────────────────────

describe('SvSignaturePadComponent', () => {
  it('names the canvas, which has no text of its own', async () => {
    await setup({ label: 'Sign the agreement' });
    const canvas = screen.getByRole('img', { name: 'Sign the agreement' });
    expect(canvas.tagName).toBe('CANVAS');
  });

  /**
   * ★★★ WITHOUT `touch-action: none` A PHONE SCROLLS INSTEAD OF SIGNING.
   *
   * The browser claims the gesture as soon as a finger moves, so the pad gets a
   * `pointerdown`, a `pointercancel`, and nothing else — the page scrolls and
   * the signature is a dot.
   */
  it('opts out of touch scrolling on the canvas itself', async () => {
    const { canvas } = await setup();
    expect(canvas.getAttribute('style')).toContain('touch-action: none');
  });

  it('records a stroke in canvas coordinates, not page coordinates', async () => {
    const { canvas, pad } = await setup();

    sign(canvas, [[10, 10], [40, 30], [90, 20]]);

    const value = pad.value();
    expect(value.strokes).toHaveLength(1);
    // The box starts at (20, 40) on the page; the points must be relative to it.
    expect(value.strokes[0].points[0]).toEqual({ x: 10, y: 10, pressure: 0.5 });
    expect(pad.isEmpty()).toBe(false);
  });

  /**
   * ★★★ THE SIGNATURE SURVIVES A RESIZE.
   *
   * Assigning `canvas.width` CLEARS the bitmap, and the browser does exactly
   * that on an orientation change, a responsive breakpoint, or a window dragged
   * to a monitor with a different pixel ratio. A pad holding only pixels loses
   * the signature at all three — after the user has signed. This asserts the
   * strokes are still there and were re-rendered.
   */
  it('redraws from the stroke model when the canvas is resized', async () => {
    const { canvas, pad, recorder } = await setup();
    sign(canvas, [[10, 10], [40, 30], [90, 20]]);
    const before = pad.value().strokes;

    recorder.ops.length = 0;
    canvas.width = 10; // exactly what a resize does — the bitmap is now blank
    (pad as unknown as { resizeToBox: () => void })['resizeToBox']();

    expect(pad.value().strokes).toEqual(before);
    expect(pad.isEmpty()).toBe(false);
    expect(recorder.ops.filter((o) => o.startsWith('line')).length).toBe(2);
  });

  /**
   * ★★ THE CONTEXT IS SCALED BY THE DEVICE PIXEL RATIO.
   *
   * Without it every stroke is blurry AND lands offset from the pointer, worse
   * the further from the origin — the classic "my signature is above my finger"
   * bug on a retina screen.
   */
  it('sizes the bitmap by the pixel ratio and scales the context to match', async () => {
    const original = globalThis.devicePixelRatio;
    Object.defineProperty(globalThis, 'devicePixelRatio', { value: 2, configurable: true });
    try {
      const { pad, canvas, recorder } = await setup();
      (pad as unknown as { resizeToBox: () => void })['resizeToBox']();

      expect(canvas.width).toBe(BOX.width * 2);
      expect(canvas.height).toBe(BOX.height * 2);
      expect(recorder.transforms.at(-1)).toEqual([2, 0, 0, 2, 0, 0]);
    } finally {
      Object.defineProperty(globalThis, 'devicePixelRatio', { value: original, configurable: true });
    }
  });

  /** ★ Undo removes a MARK. Removing the last point would be an eraser. */
  it('undoes one stroke at a time', async () => {
    const { canvas, pad } = await setup();
    sign(canvas, [[10, 10], [20, 20]]);
    sign(canvas, [[50, 10], [60, 20], [70, 30]]);
    expect(pad.strokeCount()).toBe(2);

    pad.undo();

    expect(pad.strokeCount()).toBe(1);
    expect(pad.value().strokes[0].points).toHaveLength(2);
  });

  it('clears everything, and says it is empty again', async () => {
    const { canvas, pad } = await setup();
    sign(canvas, [[10, 10], [20, 20]]);

    pad.clear();

    expect(pad.value().strokes).toHaveLength(0);
    expect(pad.isEmpty()).toBe(true);
  });

  /**
   * ★★★ AN UNSIGNED PAD EXPORTS `null`, NOT A BLANK PNG.
   *
   * `canvas.toDataURL()` on an untouched pad returns a perfectly valid image of
   * nothing. A caller that stores it has filed a signature nobody gave.
   */
  it('refuses to export an empty pad', async () => {
    const { canvas, pad } = await setup();
    expect(pad.toDataUrl()).toBeNull();
    expect(pad.toSvgString()).toBeNull();

    sign(canvas, [[10, 10], [20, 20]]);

    expect(pad.toDataUrl()).toBe('data:image/png;base64,STUB');
    expect(pad.toSvgString()).toContain('<svg');
  });

  it('reports the value when a stroke ends, and when it is cleared', async () => {
    const { canvas, pad } = await setup();
    const seen: number[] = [];
    pad.signatureChange.subscribe((v) => seen.push(v.strokes.length));

    sign(canvas, [[10, 10], [20, 20]]);
    pad.clear();

    expect(seen).toEqual([1, 0]);
  });

  /** `emptyChange` is for the host's Submit button — it fires on transitions only. */
  it('announces empty → signed → empty, once each', async () => {
    const { canvas, pad } = await setup();
    const seen: boolean[] = [];
    pad.emptyChange.subscribe((e) => seen.push(e));

    sign(canvas, [[10, 10], [20, 20]]);
    sign(canvas, [[30, 10], [40, 20]]); // still signed — no event
    pad.clear();

    expect(seen).toEqual([false, true]);
  });

  it('draws nothing while disabled', async () => {
    const { canvas, pad } = await setup({ disabled: true });
    sign(canvas, [[10, 10], [20, 20]]);
    expect(pad.isEmpty()).toBe(true);
  });

  /** A stored signature replays into the current box, rescaled. */
  it('accepts a value back', async () => {
    const { pad } = await setup();
    pad.setValue({ strokes: [{ points: [{ x: 50, y: 25, pressure: 0.5 }, { x: 100, y: 50, pressure: 0.5 }] }], width: 200, height: 80 });

    // Captured in a 200×80 box, replayed into 400×160 — twice the size.
    expect(pad.value().strokes[0].points[0]).toEqual({ x: 100, y: 50, pressure: 0.5 });
    expect(pad.isEmpty()).toBe(false);
  });

  it('offers Undo and Clear only once there is something to act on', async () => {
    const { canvas, fixture } = await setup();
    const undo = () => screen.getByRole('button', { name: /Undo/ }) as HTMLButtonElement;
    const clear = () => screen.getByRole('button', { name: /Clear/ }) as HTMLButtonElement;
    expect(undo().disabled).toBe(true);
    expect(clear().disabled).toBe(true);

    sign(canvas, [[10, 10], [20, 20]]);
    fixture.detectChanges();

    expect(undo().disabled).toBe(false);
    expect(clear().disabled).toBe(false);
  });
});
