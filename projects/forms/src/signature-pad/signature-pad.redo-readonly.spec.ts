import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSignaturePadComponent } from './signature-pad.component';
import type { SignatureStroke, SignatureValue } from './signature-pad.types';

/**
 * `SR-20` — `redo()` / `canRedo` so a demo (or a host's own toolbar) can put
 * back an undone mark, and `readonly`, so a signature that has already been
 * given can be shown as the record rather than as a greyed-out control.
 */

const BOX = { left: 0, top: 0, width: 400, height: 160 };

async function setup(inputs: ComponentInput<SvSignaturePadComponent> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvSignaturePadComponent, { inputs });
  const canvas = view.fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  const noop = () => undefined;
  canvas.getContext = (() => ({
    setTransform: noop, clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
  })) as unknown as HTMLCanvasElement['getContext'];
  canvas.getBoundingClientRect = () =>
    ({ ...BOX, right: BOX.width, bottom: BOX.height, x: 0, y: 0, toJSON: () => BOX }) as DOMRect;
  (view.fixture.componentInstance as unknown as { resizeToBox: () => void })['resizeToBox']();
  view.fixture.detectChanges();
  return { ...view, canvas, pad: view.fixture.componentInstance };
}

const stroke = (y: number): SignatureStroke => ({
  points: [{ x: 10, y, pressure: 0.5 }, { x: 200, y, pressure: 0.5 }],
});
const value = (n: number): SignatureValue => ({
  strokes: Array.from({ length: n }, (_, i) => stroke(20 + i * 30)),
  width: BOX.width,
  height: BOX.height,
});

function draw(canvas: HTMLCanvasElement): void {
  const ev = (type: string, x: number) => {
    const e = new MouseEvent(type, { clientX: x, clientY: 80, bubbles: true, cancelable: true });
    Object.defineProperties(e, { pointerId: { value: 1 }, pressure: { value: 0.5 }, pointerType: { value: 'pen' } });
    return e;
  };
  canvas.dispatchEvent(ev('pointerdown', 20));
  canvas.dispatchEvent(ev('pointermove', 120));
  canvas.dispatchEvent(ev('pointerup', 120));
}

describe('signature-pad — redo (SR-20)', () => {
  it('★ puts back what undo took, in order', async () => {
    const { pad } = await setup();
    pad.setValue(value(3));
    expect(pad.canRedo()).toBe(false);

    pad.undo();
    pad.undo();
    expect(pad.strokeCount()).toBe(1);
    expect(pad.canRedo()).toBe(true);

    pad.redo();
    expect(pad.strokeCount()).toBe(2);
    expect(pad.value().strokes[1].points[0].y).toBe(50);
    pad.redo();
    expect(pad.value().strokes.map((s) => s.points[0].y)).toEqual([20, 50, 80]);
    expect(pad.canRedo()).toBe(false);
  });

  it('a new mark forks the history', async () => {
    const { pad, canvas } = await setup();
    pad.setValue(value(2));
    pad.undo();
    expect(pad.canRedo()).toBe(true);
    draw(canvas);
    expect(pad.canRedo()).toBe(false);
  });

  it('clear and setValue empty the redo history', async () => {
    const { pad } = await setup();
    pad.setValue(value(2));
    pad.undo();
    pad.clear();
    expect(pad.canRedo()).toBe(false);

    pad.setValue(value(2));
    pad.undo();
    pad.setValue(value(1));
    expect(pad.canRedo()).toBe(false);
  });

  it('reports every redo through signatureChange', async () => {
    const { pad } = await setup();
    const seen: number[] = [];
    pad.signatureChange.subscribe((v) => seen.push(v.strokes.length));
    pad.setValue(value(2));
    pad.undo();
    pad.redo();
    expect(seen).toEqual([2, 1, 2]);
  });
});

describe('signature-pad — readonly (SR-20)', () => {
  it('★ shows the signature at full opacity, with no prompt, field or actions', async () => {
    const { pad, fixture } = await setup({ readonly: true });
    pad.setValue(value(2));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('div')!.className).not.toContain('opacity-60');
    expect(root.querySelector('canvas')!.hasAttribute('data-sv-readonly')).toBe(true);
    expect(root.querySelector('input[type="text"]')).toBeNull();
    expect([...root.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual([]);
    expect(root.querySelector('.border-dashed')).toBeNull();
  });

  it('★ cannot be drawn on, undone, redone or cleared', async () => {
    const { pad, canvas } = await setup({ readonly: true });
    pad.setValue(value(2));
    draw(canvas);
    pad.undo();
    pad.redo();
    pad.clear();
    expect(pad.strokeCount()).toBe(2);
  });

  it('disabled still dims — the two are not the same thing', async () => {
    const { fixture } = await setup({ disabled: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('div')!.className).toContain('opacity-60');
  });
});
