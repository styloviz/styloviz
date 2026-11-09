import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { afterEach, beforeEach, vi } from 'vitest';
import { SvQrCodeComponent, svQrModuleLayout } from './qr-code.component';

/**
 * FL-J3-DD-27 — modules are snapped to whole device pixels, so no fillRect has
 * a fractional edge and neighbouring modules share no antialiased seam.
 */
describe('svQrModuleLayout', () => {
  it.each([
    [200, 29, 1],
    [200, 29, 2],
    [200, 33, 1.5],
    [256, 37, 3],
    [120, 25, 1.25],
  ])('size %i, %i modules, dpr %s → whole-pixel module, centred', (size, total, dpr) => {
    const { module, offset } = svQrModuleLayout(size, total, dpr);
    expect(Number.isInteger(module)).toBe(true);
    expect(Number.isInteger(offset)).toBe(true);
    expect(module).toBeGreaterThanOrEqual(1);
    const canvasPx = Math.round(size * dpr);
    expect(offset * 2 + module * total).toBeLessThanOrEqual(canvasPx);
    // The leftover is less than one module per side — as large as it can be.
    expect(canvasPx - module * total).toBeLessThan(total);
    expect(Math.abs(canvasPx - module * total - offset * 2)).toBeLessThanOrEqual(1);
  });

  it('never returns a zero module, even on a canvas too small for the symbol', () => {
    expect(svQrModuleLayout(10, 29, 1).module).toBe(1);
    expect(svQrModuleLayout(10, 29, 1).offset).toBe(0);
  });

  it('treats a bad device pixel ratio as 1', () => {
    expect(svQrModuleLayout(200, 29, Number.NaN)).toEqual(svQrModuleLayout(200, 29, 1));
  });
});

describe('SvQrCodeComponent — draws on whole device pixels', () => {
  const rects: number[][] = [];
  const originalDpr = window.devicePixelRatio;

  beforeEach(() => {
    rects.length = 0;
    const ctx = {
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn((...a: number[]) => { rects.push(a); }),
      drawImage: vi.fn(),
      fillStyle: '',
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: vi.fn(() => ctx), configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1.5, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
  });

  it('every module rectangle has integer coordinates and size at dpr 1.5', async () => {
    TestBed.resetTestingModule();
    await render(SvQrCodeComponent, { inputs: { value: 'https://example.test/a', size: 201, background: 'transparent' } });
    expect(rects.length).toBeGreaterThan(10);
    for (const r of rects) expect(r.every(Number.isInteger)).toBe(true);
  });

  it('sizes the backing store to whole device pixels', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvQrCodeComponent, { inputs: { value: 'x', size: 201 } });
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    expect(canvas.width).toBe(302); // round(201 × 1.5)
    expect(canvas.style.width).toBe('201px');
  });
});
