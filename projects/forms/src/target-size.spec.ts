import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvChipComponent } from './chip/chip.component';
import { SvRatingComponent } from './rating/rating.component';

/**
 * `FL-J3-FI-20` / `FI-07-I4` / `FI-07-M4` / `FI-18-M5` — 24 px targets (WCAG 2.5.8).
 * jsdom has no layout, so this pins the classes that make the size; axe's
 * `target-size` measures the rendered page in e2e, and `check:ui`'s
 * `target-size-minimum` now sizes a glyph bound from a computed class map.
 */
describe('sv-chip — the remove button is a 24 px target', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`${size}: carries sv-target`, async () => {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvChipComponent, { inputs: { label: 'Design', removable: true, size } });
      const remove = (fixture.nativeElement as HTMLElement).querySelector('button')!;
      expect(remove.getAttribute('aria-label')).toContain('Design');
      expect(remove.classList.contains('sv-target')).toBe(true);
      expect(remove.className).not.toMatch(/overflow-hidden|after:/);
    });
  }
});

describe('sv-rating — whole stars at sm are 24 px slots', () => {
  const slots = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[role="slider"] > span')];

  it('pads each 16 px star by 4 px all round at sm (16 + 8 = 24)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvRatingComponent, { inputs: { value: 2, size: 'sm' } });
    const all = slots(fixture.nativeElement as HTMLElement);
    expect(all.length).toBe(5);
    for (const s of all) expect(s.classList.contains('p-1')).toBe(true);
  });

  it('adds nothing at md and up (the glyph is already 24 px or more), nor when read-only', async () => {
    for (const inputs of [{ size: 'md' as const }, { size: 'lg' as const }, { size: 'sm' as const, readonly: true }]) {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvRatingComponent, { inputs: { value: 2, ...inputs } });
      const root = fixture.nativeElement as HTMLElement;
      const stars = root.querySelectorAll<HTMLElement>('[role="slider"] > span, [role="img"] > span');
      for (const s of stars) expect(s.classList.contains('p-1'), JSON.stringify(inputs)).toBe(false);
    }
  });

  it('keeps the half-star padding at sm', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvRatingComponent, { inputs: { value: 2, size: 'sm', half: true } });
    expect(fixture.componentInstance.slotPadClass()).toBe('px-4 py-1');
  });
});
