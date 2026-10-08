import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvScrollAreaComponent } from './scroll-area.component';

/**
 * `X-7` — the custom thumb under forced colors and reduced motion.
 *
 * A translucent grey thumb is repainted as Canvas by `forced-colors: active`,
 * i.e. it disappears; the thumb opts out of adjustment and paints CanvasText.
 * The track's fade-in stills under reduced motion. jsdom emulates neither
 * media feature, so the rendered classes are what is pinned.
 */
describe('SvScrollAreaComponent — X-7 contracts', () => {
  it.each(['vertical', 'horizontal'] as const)('%s: renders a thumb with a forced-colors fallback and a still track', async (orientation) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvScrollAreaComponent, { inputs: { variant: 'always', orientation } });
    fixture.componentInstance.viewport.set(100);
    fixture.componentInstance.content.set(400);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const thumb = host.querySelector('[data-sv-thumb]');
    const track = host.querySelector('[data-sv-track]');
    expect(thumb?.className).toContain('forced-colors:forced-color-adjust-none');
    expect(thumb?.className).toContain('forced-colors:bg-[CanvasText]');
    expect(track?.className).toContain('motion-reduce:transition-none');
  });

  it.each(['vertical', 'horizontal'] as const)('%s: the focusable port keeps a visible focus outline under forced colors', async (orientation) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvScrollAreaComponent, { inputs: { orientation, tabStop: 'always' } });
    const port = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-port]');
    expect(port?.getAttribute('tabindex')).toBe('0');
    // The box-shadow ring vanishes under forced colors; an outline does not.
    expect(port?.className).toContain('forced-colors:focus-visible:outline-2');
    expect(port?.className).toContain('forced-colors:focus-visible:outline-solid');
  });
});
