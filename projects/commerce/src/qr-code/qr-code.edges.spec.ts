import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvQrCodeComponent } from './qr-code.component';

/**
 * ★★ jsdom has NO 2D canvas context: `getContext('2d')` returns null (and logs
 * "not implemented"). Everything the component draws is therefore unreachable
 * here, and no assertion about the painted pixels would mean anything. What IS
 * reachable, and what these cover, is the sizing that happens BEFORE the
 * context is asked for — which is where the device-pixel-ratio handling lives.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvQrCodeComponent, { inputs });
  return fixture;
}

const canvasOf = (f: { nativeElement: unknown }) =>
  (f.nativeElement as HTMLElement).querySelector('canvas')!;

describe('SvQrCodeComponent — the backing store', () => {
  it('scales the backing store by the device pixel ratio', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    try {
      const f = await setup({ value: 'hi', size: 120 });
      const canvas = canvasOf(f);
      expect(canvas.width).toBe(240);
      expect(canvas.style.width).toBe('120px');
    } finally {
      if (original) Object.defineProperty(window, 'devicePixelRatio', original);
      else delete (window as unknown as Record<string, unknown>).devicePixelRatio;
    }
  });

  /**
   * ★ A ratio of 0 — reported by some headless and embedded browsers — would
   * otherwise give the canvas a zero-pixel backing store and paint nothing at
   * all. It falls back to 1.
   */
  it('falls back to a ratio of 1 when the platform reports zero', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 });
    try {
      const f = await setup({ value: 'hi', size: 120 });
      const canvas = canvasOf(f);
      expect(canvas.width).toBe(120);
      expect(canvas.height).toBe(120);
    } finally {
      if (original) Object.defineProperty(window, 'devicePixelRatio', original);
      else delete (window as unknown as Record<string, unknown>).devicePixelRatio;
    }
  });

  it('resizes the backing store when the size input changes', async () => {
    const f = await setup({ value: 'hi', size: 100 });
    f.componentRef.setInput('size', 160);
    f.detectChanges();
    expect(canvasOf(f).style.width).toBe('160px');
  });
});
