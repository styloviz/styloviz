import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svContrast, svToken } from '@testing/palette';
import { SvSpinnerComponent, type SpinnerStyle, type SpinnerVariant } from './spinner.component';

/**
 * FL-J3-OF-19 · OF-18-I7 / X-20 — a spinner is thin geometry, the hardest case
 * for WCAG 1.4.11 non-text contrast. Every colour variant is measured, light
 * and dark, against everything the arc touches: its own track and the page
 * (white / gray-50 light; gray-900 / gray-950 dark). Colours come from the
 * kit's real palette (`@testing/palette`), read from the classes the
 * component actually renders. And under forced colours the ramps give way to
 * system colours, so the turning arc never matches its track.
 */
const VARIANTS: readonly Exclude<SpinnerVariant, 'white'>[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral'];
const LIGHT_PAGES = ['white', 'gray-50'];
const DARK_PAGES = ['gray-900', 'gray-950'];

async function classesOf(variant: SpinnerVariant, spinnerStyle: SpinnerStyle) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSpinnerComponent, { inputs: { variant, spinnerStyle } });
  const c = fixture.componentInstance;
  return { track: c.trackColor(), fill: c.fillColor(), dot: c.dotColor() };
}

/** `prefix` + `family-step`, light (unprefixed) or `dark:`. */
function token(classes: string, utility: string, mode: 'light' | 'dark'): string {
  const re = mode === 'light'
    ? new RegExp(`(?:^|\\s)${utility}-([a-z]+-\\d+)(?=\\s|$)`)
    : new RegExp(`(?:^|\\s)dark:${utility}-([a-z]+-\\d+)(?=\\s|$)`);
  const m = re.exec(classes);
  if (!m) throw new Error(`no ${mode} ${utility}-* in "${classes}"`);
  return m[1];
}

describe('SvSpinnerComponent — non-text contrast (FL-J3-OF-19)', () => {
  describe.each(VARIANTS)('%s', (variant) => {
    it('★ the border arc clears 3:1 against its track and the page, light and dark', async () => {
      const { track, fill } = await classesOf(variant, 'border');
      for (const mode of ['light', 'dark'] as const) {
        const arc = svToken(token(fill, 'border-t', mode));
        const ring = svToken(token(track, 'border', mode));
        expect(svContrast(arc, ring), `${variant} ${mode}: arc vs track`).toBeGreaterThanOrEqual(3);
        for (const page of mode === 'light' ? LIGHT_PAGES : DARK_PAGES) {
          expect(svContrast(arc, svToken(page)), `${variant} ${mode}: arc vs ${page}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it('the dots, pulse and bars clear 3:1 against the page, light and dark', async () => {
      const { dot } = await classesOf(variant, 'dots');
      for (const mode of ['light', 'dark'] as const) {
        const ink = svToken(token(dot, 'bg', mode));
        for (const page of mode === 'light' ? LIGHT_PAGES : DARK_PAGES) {
          expect(svContrast(ink, svToken(page)), `${variant} ${mode}: dot vs ${page}`).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });

  it('the white variant clears 3:1 on the dark surfaces it is meant for', async () => {
    const { fill } = await classesOf('white', 'border');
    expect(fill).toContain('border-t-white');
    for (const page of DARK_PAGES) expect(svContrast(svToken('white'), svToken(page))).toBeGreaterThanOrEqual(3);
  });

  it.each(['border', 'dots', 'pulse', 'bars'] as const)('★ %s falls back to system colours under forced colours', async (style) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSpinnerComponent, { inputs: { spinnerStyle: style } });
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    if (style === 'border') {
      expect(html).toContain('forced-colors:border-[GrayText]');
      expect(html).toContain('forced-colors:border-t-[Highlight]');
    } else {
      expect(html).toContain('forced-colors:bg-[Highlight]');
    }
  });
});
