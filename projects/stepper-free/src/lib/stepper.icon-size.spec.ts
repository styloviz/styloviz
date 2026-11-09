import { render } from '@testing-library/angular';
import { SvStepperComponent, type StepperItem, type StepperSize, type StepperVariant } from './stepper.component';

/**
 * `SR-09` — the state glyph used to be `h-[65%] w-[65%]` on the <svg>. The
 * icon host is content-sized, so 65 % resolved against the icon's own 20 px:
 * 13 px in a 32 px circle, 3 px left of centre, in every variant. It is now an
 * absolute size per variant × size. jsdom has no layout, so this pins the size
 * map; `e2e/stepper-geometry.spec.ts` measures the centring.
 */
const STEPS: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Confirm' },
];

const EXPECTED: Record<'circle' | 'dot', Record<StepperSize, number>> = {
  circle: { xs: 12, sm: 14, md: 16, lg: 20 },
  dot:    { xs: 6,  sm: 7,  md: 8,  lg: 10 },
};

const VARIANTS: readonly StepperVariant[] = ['default', 'pill', 'icon', 'dot', 'minimal', 'line', 'card'];
const SIZES: readonly StepperSize[] = ['xs', 'sm', 'md', 'lg'];

describe('SvStepperComponent — indicator glyph size (SR-09)', () => {
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      it(`${variant} / ${size}: the complete-step glyph has an absolute size`, async () => {
        const { fixture } = await render(SvStepperComponent, {
          inputs: { items: STEPS, activeIndex: 1, variant, size },
        });
        const host = fixture.nativeElement as HTMLElement;
        const svg = host.querySelector<SVGElement>('sv-icon svg.block.shrink-0');
        expect(svg, 'a state glyph is rendered for the complete step').not.toBeNull();

        const kind = variant === 'dot' || variant === 'minimal' ? 'dot' : 'circle';
        expect(svg!.getAttribute('width')).toBe(String(EXPECTED[kind][size]));
        expect(svg!.getAttribute('height')).toBe(String(EXPECTED[kind][size]));
        expect(svg!.getAttribute('class') ?? '').not.toContain('%');
      });
    }
  }

  it('sets leading-none on the indicator so the glyph host adds no line-box offset', async () => {
    const { fixture } = await render(SvStepperComponent, { inputs: { items: STEPS, activeIndex: 1 } });
    const svg = (fixture.nativeElement as HTMLElement).querySelector('sv-icon svg.block.shrink-0')!;
    expect(svg.closest('span')!.className).toContain('leading-none');
  });
});
