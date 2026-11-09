import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSpinnerComponent, type SpinnerStyle } from './spinner.component';

/**
 * FL-J3-OF-01 · OF-18-I4 / OF-18-M5 — every spinner style has a reduced-motion
 * path. jsdom does not evaluate media queries, so the contract pinned here is
 * the `motion-reduce:` utilities Tailwind compiles into
 * `@media (prefers-reduced-motion: reduce)` rules:
 *
 * - `border` keeps turning (a frozen ring reads as a hang) but slowly;
 * - `dots`, `pulse` and `bars` stand still, and stay visible as a static icon.
 */
async function setup(spinnerStyle: SpinnerStyle) {
  TestBed.resetTestingModule();
  const r = await render(SvSpinnerComponent, { inputs: { spinnerStyle } });
  return r.fixture.nativeElement as HTMLElement;
}

describe('SvSpinnerComponent — reduced motion (FL-J3-OF-01)', () => {
  it('slows the border ring rather than freezing it', async () => {
    const host = await setup('border');
    const ring = host.querySelector('[data-sv-spinner-motion="slow"]') as HTMLElement;
    expect(ring.className).toContain('animate-spin');
    expect(ring.className).toContain('motion-reduce:[animation-duration:2.4s]');
  });

  it('stills every bouncing dot and steps their opacity into a static ellipsis', async () => {
    const host = await setup('dots');
    const dots = Array.from(host.querySelectorAll('[data-sv-spinner-motion="static"] > div')) as HTMLElement[];
    expect(dots).toHaveLength(3);
    for (const d of dots) expect(d.className).toContain('motion-reduce:animate-none');
    expect(dots[0].className).toContain('motion-reduce:opacity-40');
    expect(dots[1].className).toContain('motion-reduce:opacity-70');
  });

  it('drops the ping ring of the pulse style and keeps the solid dot', async () => {
    const host = await setup('pulse');
    const [ping, dot] = Array.from(host.querySelectorAll('[data-sv-spinner-motion="static"] > div')) as HTMLElement[];
    expect(ping.className).toContain('animate-ping');
    expect(ping.className).toContain('motion-reduce:hidden');
    expect(dot.className).not.toContain('motion-reduce:hidden');
  });

  it('freezes the equaliser bars at staggered heights', async () => {
    const host = await setup('bars');
    const bars = Array.from(host.querySelectorAll('[data-sv-spinner-motion="static"] > div')) as HTMLElement[];
    expect(bars).toHaveLength(4);
    for (const b of bars) expect(b.className).toContain('motion-reduce:animate-none');
    expect(bars.filter((b) => /motion-reduce:scale-y-/.test(b.className))).toHaveLength(3);
  });

  it('leaves no style with an animation that has no reduced-motion variant', async () => {
    for (const style of ['border', 'dots', 'pulse', 'bars'] as const) {
      const host = await setup(style);
      for (const node of Array.from(host.querySelectorAll('[class*="animate-"]')) as HTMLElement[]) {
        expect(node.className, `${style}: ${node.className}`).toMatch(/motion-reduce:/);
      }
    }
  });
});
