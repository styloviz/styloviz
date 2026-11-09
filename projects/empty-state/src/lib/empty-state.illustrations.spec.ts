import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { Type } from '@angular/core';
import {
  SvIllustrationErrorComponent,
  SvIllustrationNoAccessComponent,
  SvIllustrationNoDataComponent,
  SvIllustrationNoResultsComponent,
} from './empty-state.illustrations';

/**
 * The four built-in empty-state illustrations (`SR-34`): each one renders a
 * single decorative scene, illustration-sized, themed with classes so it
 * follows dark mode and the palette — the same contract `check:ui`'s
 * `inline-svg-illustration` rule holds the source to.
 */
const ALL: readonly Type<unknown>[] = [
  SvIllustrationNoDataComponent,
  SvIllustrationNoResultsComponent,
  SvIllustrationNoAccessComponent,
  SvIllustrationErrorComponent,
];

describe('empty-state illustrations', () => {
  it.each(ALL.map((c) => [c.name, c] as const))('%s draws one decorative, themed scene', async (_name, component) => {
    TestBed.resetTestingModule();
    const { container } = await render(component);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    const svg = svgs[0];
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(w).toBeGreaterThanOrEqual(64);
    expect(h).toBeGreaterThanOrEqual(64);
    // Every shape that paints is themed by class, with a dark arm somewhere.
    expect(svg.querySelectorAll('[class*="fill-"], [class*="stroke-"]').length).toBeGreaterThan(3);
    expect(svg.innerHTML).toMatch(/dark:(fill|stroke)-/);
    // No hard-coded colours — they would not follow the theme.
    expect(svg.innerHTML).not.toMatch(/fill="#|stroke="#/);
  });
});
