import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSpinnerArcComponent } from './spinner-arc.component';

/**
 * This component exists to end the drift between 21 hand-copied spinners, and
 * the drift that mattered most was invisible: six of those copies had no
 * `aria-hidden` and no label, so a screen reader announced a decorative shape
 * — or announced nothing where the spinner was the only sign of progress.
 *
 * So the thing worth pinning is not the SVG. It is the single either/or that
 * replaced all 21 decisions: no `label` means decorative and silent, a `label`
 * means it is the only loading affordance present and must be announced. Both
 * halves are one ternary apiece, which is exactly how they would regress.
 */

async function setup(inputs: Partial<ComponentInput<SvSpinnerArcComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSpinnerArcComponent, {
    inputs: inputs as ComponentInput<SvSpinnerArcComponent>,
  });
  const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
  return { fixture, svg };
}

describe('SvSpinnerArcComponent — how it is announced', () => {
  it('is silent to a screen reader by default', async () => {
    const { svg } = await setup();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();
  });

  it('becomes an announced image once it carries the whole message', async () => {
    const { svg } = await setup({ label: 'Loading suggestions' });
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Loading suggestions');
    // Announced AND hidden is the contradiction that renders it silent again.
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  it('treats an empty label as no label, not as an unnamed image', async () => {
    // Hosts pass `[label]="isOnly() ? 'Loading' : ''"`. An empty string reaching
    // `role="img"` would produce an image with no accessible name.
    const { svg } = await setup({ label: '' });
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SvSpinnerArcComponent — how it is styled', () => {
  it('always spins, whatever the host passes', async () => {
    const { svg } = await setup();
    expect(svg.classList.contains('animate-spin')).toBe(true);

    const { svg: styled } = await setup({ cssClass: 'h-7 w-7 text-primary-500' });
    expect(styled.classList.contains('animate-spin')).toBe(true);
    expect(styled.classList.contains('shrink-0')).toBe(true);
  });

  it('applies the size and colour it was given', async () => {
    const { svg } = await setup({ cssClass: 'h-7 w-7 text-primary-500' });
    for (const c of ['h-7', 'w-7', 'text-primary-500']) {
      expect(svg.classList.contains(c)).toBe(true);
    }
  });

  it('leaves no empty class token behind when cssClass is unset', async () => {
    // `'animate-spin shrink-0 ' + ''` untrimmed yields a trailing space, and a
    // stray token in `class` is the kind of thing snapshot diffs churn on.
    const { svg } = await setup();
    expect(svg.getAttribute('class')).toBe('animate-spin shrink-0');
  });
});
