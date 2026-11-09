import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svContrast, svMix, svToken } from '@testing/palette';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';

/**
 * FL-J3-OF-19 · OF-17-I4 / X-20 — "the shimmer can be invisible or dazzling".
 * A skeleton is a placeholder, not information, so 1.4.11's 3:1 is the wrong
 * yardstick; the contract is a BAND, the same in both themes: a bone is seen
 * against the page (≥ 1.15:1) without glaring (≤ 2:1), and the wave's sheen
 * moves it visibly (≥ 1.1:1) without flashing (≤ 1.5:1). At 0.35 the light
 * sheen moved it 1.08:1 — invisible — while dark was 1.2:1. Under forced
 * colours the bones are `GrayText` instead of vanishing as Canvas.
 */
const SRC = readFileSync('projects/skeleton-loader/src/lib/skeleton-loader.component.ts', 'utf8');
const sheen = (mode: 'light' | 'dark'): number => {
  const re = mode === 'light'
    ? /'\[--sv-skeleton-sheen:rgb\(255_255_255\/([\d.]+)\)\]/
    : /dark:\[--sv-skeleton-sheen:rgb\(255_255_255\/([\d.]+)\)\]/;
  return Number(re.exec(SRC)![1]);
};

describe('SvSkeletonLoaderComponent — seen, not dazzling (FL-J3-OF-19)', () => {
  it('bones sit in the 1.15–2:1 band against the page, light and dark', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSkeletonLoaderComponent);
    const bone = fixture.componentInstance.boneBase();
    expect(bone).toContain('bg-gray-200');
    expect(bone).toContain('dark:bg-gray-700');
    for (const page of ['white', 'gray-50']) {
      const r = svContrast(svToken('gray-200'), svToken(page));
      expect(r, `light bone on ${page}`).toBeGreaterThanOrEqual(1.15);
      expect(r).toBeLessThanOrEqual(2);
    }
    for (const page of ['gray-900', 'gray-950']) {
      const r = svContrast(svToken('gray-700'), svToken(page));
      expect(r, `dark bone on ${page}`).toBeGreaterThanOrEqual(1.15);
      expect(r).toBeLessThanOrEqual(2);
    }
  });

  it('★ the wave sheen moves a bone by 1.1–1.5:1 in BOTH themes', () => {
    const light = svContrast(svMix(svToken('white'), sheen('light'), svToken('gray-200')), svToken('gray-200'));
    const dark = svContrast(svMix(svToken('white'), sheen('dark'), svToken('gray-700')), svToken('gray-700'));
    for (const [mode, r] of [['light', light], ['dark', dark]] as const) {
      expect(r, `${mode} sheen`).toBeGreaterThanOrEqual(1.1);
      expect(r, `${mode} sheen`).toBeLessThanOrEqual(1.5);
    }
  });

  it('★ bones are GrayText under forced colours', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSkeletonLoaderComponent);
    expect(fixture.componentInstance.boneBase()).toContain('forced-colors:bg-[GrayText]');
  });
});
