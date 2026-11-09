import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { svContrast, svMix, svToken } from '@testing/palette';
import { SvProgressBarComponent, type ProgressBarVariant } from './progress-bar.component';

/**
 * FL-J3-OF-19 · OF-14-I6 / X-20 — the fill boundary is the information in a
 * progress bar, so the fill must clear 3:1 (WCAG 1.4.11) against the track it
 * sits in: `gray-100` light, `gray-700/60` over `gray-900` dark. Stripes may
 * only ever RAISE that contrast, a 4px (`xs`) bar draws none, and under forced
 * colours the fill is `Highlight` inside a `CanvasText`-edged track.
 */
const VARIANTS: readonly ProgressBarVariant[] = ['primary', 'success', 'warning', 'danger', 'info', 'neutral'];
const LIGHT_TRACK = svToken('gray-100');
const DARK_TRACK = svMix(svToken('gray-700'), 0.6, svToken('gray-900'));

async function setup(inputs: Partial<ComponentInput<SvProgressBarComponent>>) {
  TestBed.resetTestingModule();
  const r = await render(SvProgressBarComponent, { inputs: inputs as ComponentInput<SvProgressBarComponent> });
  return { c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

function fillToken(classes: string, mode: 'light' | 'dark'): string {
  const dark = /(?:^|\s)dark:bg-([a-z]+-\d+)(?=\s|$)/.exec(classes)?.[1];
  const light = /(?:^|\s)bg-([a-z]+-\d+)(?=\s|$)/.exec(classes)?.[1];
  const t = mode === 'dark' ? (dark ?? light) : light;
  if (!t) throw new Error(`no fill in "${classes}"`);
  return t;
}

describe('SvProgressBarComponent — fill-boundary contrast (FL-J3-OF-19)', () => {
  it.each(VARIANTS)('★ the %s fill clears 3:1 against its track, light and dark', async (variant) => {
    const { c } = await setup({ value: 50, variant });
    expect(svContrast(svToken(fillToken(c.fillClasses(), 'light')), LIGHT_TRACK), `${variant} light`).toBeGreaterThanOrEqual(3);
    expect(svContrast(svToken(fillToken(c.fillClasses(), 'dark')), DARK_TRACK), `${variant} dark`).toBeGreaterThanOrEqual(3);
  });

  it.each(VARIANTS)('the %s indeterminate sweep uses the same accessible fill', async (variant) => {
    const { c } = await setup({ indeterminate: true, variant });
    expect(svContrast(svToken(fillToken(c.sweepClass(), 'light')), LIGHT_TRACK)).toBeGreaterThanOrEqual(3);
    expect(svContrast(svToken(fillToken(c.sweepClass(), 'dark')), DARK_TRACK)).toBeGreaterThanOrEqual(3);
  });

  it.each(VARIANTS)('★ %s stripes push away from the track, so they can only raise the contrast', async (variant) => {
    const { c } = await setup({ value: 50, variant, striped: true });
    const classes = c.fillClasses();
    expect(classes).toContain('[--sv-progress-stripe:rgba(0,0,0,.12)]');
    expect(classes).toContain('dark:[--sv-progress-stripe:rgba(255,255,255,.15)]');
    const lightFill = svToken(fillToken(classes, 'light'));
    const darkFill = svToken(fillToken(classes, 'dark'));
    const lightStripe = svMix(svToken('black'), 0.12, lightFill);
    const darkStripe = svMix(svToken('white'), 0.15, darkFill);
    expect(svContrast(lightStripe, LIGHT_TRACK)).toBeGreaterThanOrEqual(svContrast(lightFill, LIGHT_TRACK));
    expect(svContrast(darkStripe, DARK_TRACK)).toBeGreaterThanOrEqual(svContrast(darkFill, DARK_TRACK));
  });

  it('★ draws no stripes on a 4px (xs) bar', async () => {
    const { c } = await setup({ value: 50, striped: true, animated: true, size: 'xs' });
    expect(c.stripesShown()).toBe(false);
    expect(c.fillClasses()).not.toContain('linear-gradient');
    expect(c.fillClasses()).not.toContain('progress-stripe');
  });

  it('★ falls back to Highlight inside a CanvasText edge under forced colours', async () => {
    const { c, host } = await setup({ value: 50 });
    expect(c.fillClasses()).toContain('forced-colors:bg-[Highlight]');
    expect(host.innerHTML).toContain('forced-colors:border-[CanvasText]');
  });
});
