import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvProgressRingComponent, type ProgressRingVariant } from './progress-ring.component';

/**
 * `OF-15-I3` / `OF-15-M2` / `OF-15-I7` / `OF-15-M6` — re-verification.
 *
 * ★★★ THE GRADIENT-ID DEFECT IS INVISIBLE IN A SINGLE-INSTANCE DEMO. The
 *     proof has to put several rings in ONE document and check that every
 *     `url(#…)` resolves to the gradient its own ring defined.
 */

@Component({
  standalone: true,
  imports: [SvProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (v of variants; track $index) {
      <div data-ring-host>
        <sv-progress-ring [variant]="v" [value]="30 + $index * 10" [color]="colors[$index]" />
      </div>
    }
  `,
})
class ManyRingsHost {
  readonly variants: readonly ProgressRingVariant[] = ['gradient', 'default', 'gradient', 'dashed', 'glow', 'gradient'];
  readonly colors: readonly string[] = ['#ff0000', '#00ff00', '#0000ff', '#111111', '#222222', '#333333'];
}

async function setup(inputs: Partial<ComponentInput<SvProgressRingComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvProgressRingComponent, {
    inputs: inputs as ComponentInput<SvProgressRingComponent>,
  });
}

const arc = (root: ParentNode = document) =>
  root.querySelectorAll('circle')[1] as SVGCircleElement;

describe('SvProgressRingComponent — many rings in one document (OF-15-I3, OF-15-M2)', () => {
  it('★ every gradient ring points at its OWN gradient, and every id is unique', async () => {
    TestBed.resetTestingModule();
    await render(ManyRingsHost);
    const hosts = [...document.querySelectorAll<HTMLElement>('[data-ring-host]')];
    expect(hosts).toHaveLength(6);

    const ids = [...document.querySelectorAll('linearGradient')].map(g => g.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    // Every element id in the document is unique, not just the gradients.
    const all = [...document.querySelectorAll('[id]')].map(e => e.id);
    expect(new Set(all).size).toBe(all.length);

    hosts.forEach((host, i) => {
      const stroke = arc(host).getAttribute('stroke') ?? '';
      const own = host.querySelector('linearGradient');
      if (i === 0 || i === 2 || i === 5) {
        // The reference resolves inside the same ring, to the ring's own colour.
        expect(own).not.toBeNull();
        expect(stroke).toBe(`url(#${own!.id})`);
        const target = document.getElementById(own!.id);
        expect(target).toBe(own);
        expect(own!.querySelector('stop')!.getAttribute('stop-color'))
          .toBe(['#ff0000', '', '#0000ff', '', '', '#333333'][i]);
      } else {
        // Non-gradient variants define no id and reference none.
        expect(own).toBeNull();
        expect(stroke).not.toContain('url(#');
      }
    });
  });
});

describe('SvProgressRingComponent — out-of-range and invalid values (OF-15-I7)', () => {
  it('★ the centre label agrees with the arc and the announcement', async () => {
    const { fixture } = await setup({ value: 150 });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('100%');
    expect(text).not.toContain('150');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    expect(fixture.componentInstance.dashOffset()).toBeCloseTo(0, 6);
  });

  it('clamps a negative value in the label too', async () => {
    const { fixture } = await setup({ value: -20 });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('0%');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('-20');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('★ reads %s as zero, never "NaN" in the DOM', async (value) => {
    const { fixture } = await setup({ value });
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    const c = fixture.componentInstance;
    expect(c.pct()).toBe(0);
    expect(c.dashOffset()).toBeCloseTo(c.circumference(), 6);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('0%');
  });
});

describe('SvProgressRingComponent — the dashed arc carries the value (OF-15-M6)', () => {
  const drawnLength = (dasharray: string) => {
    const parts = dasharray.split(' ').map(Number);
    // Dashes are the even entries; the last gap is the whole circle.
    return parts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
  };

  it('★ 25% and 75% draw different amounts of dashes', async () => {
    const { fixture: quarter } = await setup({ variant: 'dashed', value: 25 });
    const qa = arc().getAttribute('stroke-dasharray')!;
    const c = quarter.componentInstance.circumference();
    expect(arc().getAttribute('stroke-dashoffset')).toBe('0');

    await setup({ variant: 'dashed', value: 75 });
    const ta = arc().getAttribute('stroke-dasharray')!;

    expect(qa).not.toBe(ta);
    // The dashes stop where the progress stops: less than a quarter of the
    // circle is inked at 25%, and more than a quarter-plus-gaps at 75%.
    expect(drawnLength(qa)).toBeLessThanOrEqual(c * 0.25 + 1e-6);
    expect(drawnLength(ta)).toBeGreaterThan(drawnLength(qa) * 2);
    expect(drawnLength(ta)).toBeLessThanOrEqual(c * 0.75 + 1e-6);
    // The array ends with a gap as long as the circle, so the pattern never repeats.
    expect(Number(qa.split(' ').at(-1))).toBeCloseTo(c, 2);
  });

  it('draws nothing at zero — not a dot from a round cap', async () => {
    const { fixture } = await setup({ variant: 'dashed', value: 0 });
    const c = fixture.componentInstance;
    expect(arc().getAttribute('stroke-dasharray')).toBe(`${c.circumference()}`);
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(c.circumference(), 6);
  });

  it('leaves the other variants on the solid offset model', async () => {
    const { fixture } = await setup({ variant: 'default', value: 40 });
    const c = fixture.componentInstance;
    expect(arc().getAttribute('stroke-dasharray')).toBe(`${c.circumference()}`);
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(c.dashOffset(), 6);
  });
});
