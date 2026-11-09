import { render, type ComponentInput } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSignaturePadComponent } from './signature-pad.component';
import { rescale, svSignatureRecord, toSvg, type SignatureValue } from './signature-pad.types';

/**
 * `SR-12` — ink, taps, repaint, per-stroke colour, and a pad restored while
 * hidden.
 *
 *  (a) the default ink was `#111827`, the pad's own dark-mode background, so
 *      every signature was invisible in dark mode;
 *  (b) a one-point tap was stored but could not be undone;
 *  (c) changing `penColor` / `penWidth` repainted nothing;
 *  (d) the SVG painted every stroke in the CURRENT colour, the PNG in the one
 *      it was drawn in;
 *  (e) `setValue()` on a hidden (1 × 1) pad squashed the record for good.
 *
 * jsdom has no 2-D context, so every canvas — the pad's and the export copy
 * `toDataUrl()` makes — gets a recorder through the prototype.
 */

const BOX = { left: 10, top: 20, width: 400, height: 160 };

interface Op {
  readonly op: 'clear' | 'stroke';
  readonly color: string;
  readonly width: number;
}

const recorders = new WeakMap<HTMLCanvasElement, Op[]>();
const opsOf = (canvas: HTMLCanvasElement): Op[] => recorders.get(canvas) ?? [];
let lastCreated: HTMLCanvasElement | null = null;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
const originalCreateElement = Document.prototype.createElement;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let ops = recorders.get(this);
    if (!ops) recorders.set(this, (ops = []));
    const state = { strokeStyle: '', lineWidth: 0 };
    return {
      get strokeStyle() { return state.strokeStyle; },
      set strokeStyle(v: string) { state.strokeStyle = v; },
      get lineWidth() { return state.lineWidth; },
      set lineWidth(v: number) { state.lineWidth = v; },
      lineCap: '', lineJoin: '',
      setTransform: () => undefined,
      clearRect: () => ops!.push({ op: 'clear', color: '', width: 0 }),
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => ops!.push({ op: 'stroke', color: state.strokeStyle, width: state.lineWidth }),
    } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext'];
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,STUB';
  Document.prototype.createElement = function (this: Document, tag: string, options?: ElementCreationOptions) {
    const el = originalCreateElement.call(this, tag, options);
    if (tag.toLowerCase() === 'canvas') lastCreated = el as HTMLCanvasElement;
    return el;
  } as Document['createElement'];
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  Document.prototype.createElement = originalCreateElement;
});

afterEach(() => document.documentElement.classList.remove('dark'));

function placeCanvas(canvas: HTMLCanvasElement, box: { width: number; height: number }): void {
  canvas.getBoundingClientRect = () =>
    ({ left: BOX.left, top: BOX.top, width: box.width, height: box.height,
       right: BOX.left + box.width, bottom: BOX.top + box.height, x: BOX.left, y: BOX.top,
       toJSON: () => box }) as DOMRect;
}

async function setup(
  inputs: ComponentInput<SvSignaturePadComponent> = {},
  box: { width: number; height: number } = BOX,
) {
  TestBed.resetTestingModule();
  const view = await render(SvSignaturePadComponent, { inputs });
  const canvas = view.fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  placeCanvas(canvas, box);
  const resize = () => (view.fixture.componentInstance as unknown as { resizeToBox: () => void })['resizeToBox']();
  resize();
  view.fixture.detectChanges();
  return { ...view, canvas, resize, pad: view.fixture.componentInstance };
}

/** jsdom has no `PointerEvent`; a `MouseEvent` carries the fields the pad reads. */
function pointerEvent(type: string, x: number, y: number): Event {
  const event = new MouseEvent(type, { clientX: BOX.left + x, clientY: BOX.top + y, bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, pressure: { value: 0.5 } });
  return event;
}

function sign(canvas: HTMLCanvasElement, points: [number, number][]): void {
  canvas.dispatchEvent(pointerEvent('pointerdown', ...points[0]));
  for (const p of points.slice(1)) canvas.dispatchEvent(pointerEvent('pointermove', ...p));
  canvas.dispatchEvent(pointerEvent('pointerup', ...points[points.length - 1]));
}

/** The colours the most recent full repaint used, after its last `clear`. */
function lastPaint(canvas: HTMLCanvasElement): Op[] {
  const ops = opsOf(canvas);
  const at = ops.map((o) => o.op).lastIndexOf('clear');
  return ops.slice(at + 1);
}

const LIGHT_INK = 'rgb(17, 24, 39)';
const DARK_INK = 'rgb(243, 244, 246)';

describe('signature-pad — ink follows the theme (SR-12a)', () => {
  it('defaults penColor to empty and gives the canvas a themed text colour', async () => {
    const { pad, canvas } = await setup();
    expect(pad.penColor()).toBe('');
    expect(canvas.className).toContain('text-gray-900');
    expect(canvas.className).toContain('dark:text-gray-100');
  });

  it('draws in the canvas CSS colour, and repaints when the theme class changes', async () => {
    const { canvas } = await setup();
    canvas.style.color = LIGHT_INK;
    sign(canvas, [[10, 10], [60, 40]]);
    expect(opsOf(canvas).filter((o) => o.op === 'stroke').every((o) => o.color === LIGHT_INK)).toBe(true);

    // The kit's dark mode is a class on <html>; the bitmap does not cascade.
    canvas.style.color = DARK_INK;
    document.documentElement.classList.add('dark');
    await Promise.resolve();
    const repaint = lastPaint(canvas).filter((o) => o.op === 'stroke');
    expect(repaint.length).toBeGreaterThan(0);
    expect(repaint.every((o) => o.color === DARK_INK)).toBe(true);
  });

  it('exports in document ink, not the dark-mode screen ink', async () => {
    const { pad, canvas } = await setup();
    canvas.style.color = DARK_INK;
    sign(canvas, [[10, 10], [60, 40]]);

    expect(pad.toDataUrl()).toBe('data:image/png;base64,STUB');
    const exported = opsOf(lastCreated!).filter((o) => o.op === 'stroke');
    expect(exported.length).toBeGreaterThan(0);
    expect(exported.every((o) => o.color === '#111827')).toBe(true);

    expect(pad.toSvgString()).toContain('stroke="#111827"');
  });

  it('honours an explicit penColor on screen and in both exports', async () => {
    const { pad, canvas } = await setup({ penColor: '#1d4ed8' });
    canvas.style.color = DARK_INK;
    sign(canvas, [[10, 10], [60, 40]]);
    expect(opsOf(canvas).filter((o) => o.op === 'stroke').every((o) => o.color === '#1d4ed8')).toBe(true);
    pad.toDataUrl();
    expect(opsOf(lastCreated!).filter((o) => o.op === 'stroke').every((o) => o.color === '#1d4ed8')).toBe(true);
    expect(pad.toSvgString()).toContain('stroke="#1d4ed8"');
  });
});

describe('signature-pad — a tap is not a stroke (SR-12b)', () => {
  it('discards a one-point tap: nothing to undo, nothing in the value, no event', async () => {
    const { pad, canvas } = await setup();
    const changes: SignatureValue[] = [];
    pad.signatureChange.subscribe((v) => changes.push(v));

    sign(canvas, [[20, 20]]);
    expect(pad.value().strokes).toEqual([]);
    expect(pad.strokeCount()).toBe(0);
    expect(changes).toEqual([]);

    sign(canvas, [[20, 20], [80, 40]]);
    expect(pad.value().strokes.length).toBe(1);
    expect(pad.strokeCount()).toBe(1);
  });
});

describe('signature-pad — pen changes repaint (SR-12c)', () => {
  it('repaints theme-ink strokes when penColor or penWidth changes', async () => {
    const { fixture, canvas } = await setup();
    canvas.style.color = LIGHT_INK;
    sign(canvas, [[10, 10], [60, 40]]);

    fixture.componentRef.setInput('penColor', '#dc2626');
    fixture.detectChanges();
    expect(lastPaint(canvas).filter((o) => o.op === 'stroke').every((o) => o.color === '#dc2626')).toBe(true);

    // A stroke with no stored width (a record from before SR-12) follows penWidth.
    const { fixture: f2, canvas: c2, pad: p2 } = await setup();
    p2.setValue({ strokes: [{ points: [{ x: 1, y: 1, pressure: 0.5 }, { x: 50, y: 50, pressure: 0.5 }] }], width: BOX.width, height: BOX.height });
    f2.componentRef.setInput('penWidth', 5);
    f2.detectChanges();
    expect(lastPaint(c2).filter((o) => o.op === 'stroke').every((o) => o.width === 5)).toBe(true);
  });

  it('keeps a stroke drawn with an explicit colour in that colour', async () => {
    const { fixture, canvas } = await setup({ penColor: '#1d4ed8' });
    sign(canvas, [[10, 10], [60, 40]]);
    fixture.componentRef.setInput('penColor', '#dc2626');
    fixture.detectChanges();
    expect(lastPaint(canvas).filter((o) => o.op === 'stroke').every((o) => o.color === '#1d4ed8')).toBe(true);
  });
});

describe('signature-pad — per-stroke ink (SR-12d)', () => {
  it('records colour and width on each stroke, and the SVG uses them', async () => {
    const { fixture, pad, canvas } = await setup({ penColor: '#1d4ed8', penWidth: 3 });
    sign(canvas, [[10, 10], [60, 40]]);
    fixture.componentRef.setInput('penColor', '#dc2626');
    fixture.componentRef.setInput('penWidth', 1);
    fixture.detectChanges();
    sign(canvas, [[100, 10], [160, 40]]);

    const [first, second] = pad.value().strokes;
    expect(first).toMatchObject({ color: '#1d4ed8', width: 3 });
    expect(second).toMatchObject({ color: '#dc2626', width: 1 });

    const svg = pad.toSvgString()!;
    expect(svg).toContain('stroke="#1d4ed8" stroke-width="3"');
    expect(svg).toContain('stroke="#dc2626" stroke-width="1"');
  });

  it('leaves colour and width out of the v1 record, so old records verify unchanged', () => {
    const points = [{ x: 1, y: 2, pressure: 0.5 }, { x: 3, y: 4, pressure: 0.5 }];
    const plain: SignatureValue = { strokes: [{ points }], width: 300, height: 120 };
    const inked: SignatureValue = { strokes: [{ points, color: '#1d4ed8', width: 3 }], width: 300, height: 120 };
    expect(svSignatureRecord(inked, 'I agree', '2026-01-01T00:00:00.000Z'))
      .toBe(svSignatureRecord(plain, 'I agree', '2026-01-01T00:00:00.000Z'));
  });

  it('keeps colour and width through a rescale', () => {
    const value: SignatureValue = {
      strokes: [{ points: [{ x: 10, y: 10, pressure: 0.5 }, { x: 20, y: 20, pressure: 0.5 }], color: '#1d4ed8', width: 3 }],
      width: 100, height: 100,
    };
    expect(rescale(value, 200, 200)[0]).toMatchObject({ color: '#1d4ed8', width: 3 });
  });

  it('escapes a stored colour before writing it into the SVG', () => {
    const svg = toSvg([{ points: [{ x: 0, y: 0, pressure: 0.5 }, { x: 5, y: 5, pressure: 0.5 }], color: '"/><script>x</script>' }], 10, 10)!;
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('stroke="&quot;/&gt;&lt;script&gt;x&lt;/script&gt;"');
  });
});

describe('signature-pad — restored while hidden (SR-12e)', () => {
  const record: SignatureValue = {
    strokes: [{ points: [{ x: 30, y: 12, pressure: 0.5 }, { x: 270, y: 108, pressure: 0.5 }] }],
    width: 300,
    height: 120,
  };

  it('rescales into the real box once the pad gets one, instead of staying a 1 × 1 dot', async () => {
    const { pad, canvas, resize } = await setup({}, { width: 0, height: 0 });
    pad.setValue(record);

    placeCanvas(canvas, { width: 600, height: 240 });
    resize();
    expect(pad.value().strokes).toEqual(rescale(record, 600, 240));
  });

  it('stops re-fitting once the signer has added to the restored record', async () => {
    const { pad, canvas, resize } = await setup({}, BOX);
    pad.setValue(record);
    sign(canvas, [[10, 10], [60, 40]]);
    const edited = pad.value().strokes;

    placeCanvas(canvas, { width: 800, height: 320 });
    resize();
    expect(pad.value().strokes).toBe(edited);
  });
});
