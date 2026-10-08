import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvWatermarkComponent } from './watermark.component';

/**
 * `X-7` forced colors. Without an opt-out, the mode draws an opaque Canvas
 * "readability backplate" behind every rotated mark — a grid of boxes over the
 * content — and a grey mark may match the user's Canvas outright. jsdom cannot
 * emulate the mode, so the rendered classes are what is pinned.
 */
describe('SvWatermarkComponent — forced-colors fallback (X-7)', () => {
  it.each(['tiled', 'single'] as const)('%s: the overlay opts out and every mark paints CanvasText', async (variant) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvWatermarkComponent, { inputs: { variant, text: 'Draft' } });
    const host = fixture.nativeElement as HTMLElement;
    // jsdom has no layout: give the box a size so the tiled grid has marks.
    const box = host.querySelector('[data-sv-watermark]') as HTMLElement;
    box.getBoundingClientRect = () => ({ width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
    fixture.componentInstance.measure();
    fixture.detectChanges();
    expect(host.querySelector('[data-sv-overlay]')?.className).toContain('forced-colors:forced-color-adjust-none');
    const marks = Array.from(host.querySelectorAll('[data-sv-mark]'));
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark.className).toContain('forced-colors:text-[CanvasText]');
  });
});
