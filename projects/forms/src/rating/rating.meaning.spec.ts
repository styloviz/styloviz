import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvRatingComponent } from './rating.component';

/**
 * `FI-18-I1` / `FI-18-M2` / `FI-18-I2` — a number is not a meaning, and half a
 * glyph is not a target.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 *
 * ★★★ ONLY STARS ARE ORDINAL BY CONVENTION. Five stars is a quality scale the
 *     world already agreed on, so "3 of 5 stars" is a complete sentence. Three
 *     hearts is not a rating of 3 — it is a like count wearing a rating's
 *     clothes — and fire and thumb have no shared scale at all. The component
 *     announced "3 of 5 hearts" regardless, which hands a screen-reader user a
 *     number and nothing to do with it.
 *
 * ★★ `aria-valuetext` exists precisely to carry what `aria-valuenow` cannot. One
 *    that only restates the number earns nothing.
 *
 * ★★★ AND TURNING ON `half` HALVED EVERY POINTER TARGET. A 24px glyph split down
 *     the middle is two 12px targets against WCAG 2.5.8's 24. On a phone the
 *     difference between 4 and 4.5 is a thumb's width, and the wrong one is what
 *     gets submitted. The keyboard path was always fine — which is not an answer
 *     on a touchscreen.
 */

async function setup(inputs: Partial<ComponentInput<SvRatingComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvRatingComponent, { inputs: inputs as ComponentInput<SvRatingComponent> });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const slider = (h: HTMLElement) => h.querySelector<HTMLElement>('[role="slider"]')!;
const slots = (h: HTMLElement) =>
  [...h.querySelectorAll<HTMLElement>('[role="slider"] > span')];

const LEVELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];

describe('SvRatingComponent — the scale can say what it means', () => {
  it('still announces stars numerically when nothing is declared', async () => {
    const { fixture } = await setup({ value: 3, max: 5 });
    expect(slider(el(fixture)).getAttribute('aria-valuetext')).toBe('3 of 5 stars');
  });

  it('announces the declared meaning, with the number kept in front of it', async () => {
    // ★ The number stays: a slider announcing only "Great" strands anyone
    //   working out how much further the scale goes.
    const { fixture } = await setup({ value: 4, max: 5, levelLabels: LEVELS });
    expect(slider(el(fixture)).getAttribute('aria-valuetext')).toBe('4 of 5 — Great');
  });

  it('falls back to the noun for a half step, which has no name', async () => {
    const { fixture } = await setup({ value: 3.5, max: 5, half: true, levelLabels: LEVELS });
    expect(slider(el(fixture)).getAttribute('aria-valuetext')).toBe('3.5 of 5 stars');
  });

  it('lets a heart scale be measured in something other than hearts', async () => {
    const { fixture } = await setup({ value: 2, max: 5, variant: 'heart', scaleNoun: 'levels of urgency' });
    expect(slider(el(fixture)).getAttribute('aria-valuetext')).toBe('2 of 5 levels of urgency');
  });

  it('keeps the per-variant noun when the host says nothing', async () => {
    const { fixture } = await setup({ value: 2, max: 5, variant: 'fire' });
    expect(slider(el(fixture)).getAttribute('aria-valuetext')).toBe('2 of 5 flames');
  });

  it('ignores a level label that does not exist', async () => {
    const { fixture } = await setup({ value: 5, max: 5, levelLabels: ['Poor', 'Fair'] });
    expect(slider(el(fixture)).getAttribute('aria-valuetext')).toBe('5 of 5 stars');
  });

  it('carries the meaning into the summary block too', async () => {
    const { fixture } = await setup({
      summary: true, value: 4.2, max: 5, variant: 'heart',
      scaleNoun: 'levels of urgency', distribution: [1, 2, 3, 4, 5],
    });
    const img = el(fixture).querySelector('[role="img"]')!;
    expect(img.getAttribute('aria-label')).toContain('levels of urgency');
  });

  it('shows the meaning beside the glyphs, without replacing the number', async () => {
    const { fixture } = await setup({ value: 4, max: 5, levelLabels: LEVELS });
    const text = el(fixture).textContent ?? '';
    expect(text).toContain('4/5');
    expect(text).toContain('Great');
  });
});

describe('SvRatingComponent — a half target is still a target', () => {
  it('pads each slot when half-steps are on, so a half is 24px not 12', async () => {
    // 24px glyph + 12px each side = a 48px slot = two 24px halves.
    const { fixture } = await setup({ value: 3, max: 5, half: true, size: 'md' });
    expect(slots(el(fixture)).every(s => s.className.includes('px-3'))).toBe(true);
  });

  it('sizes the padding per glyph size, because the glyph is what varies', async () => {
    for (const [size, cls] of [['sm', 'px-4'], ['md', 'px-3'], ['lg', 'px-2'], ['xl', 'px-1']] as const) {
      const { fixture } = await setup({ value: 3, max: 5, half: true, size });
      expect(slots(el(fixture))[0].className).toContain(cls);
    }
  });

  it('adds nothing when half-steps are off — a whole glyph is already a target', async () => {
    const { fixture } = await setup({ value: 3, max: 5, size: 'md' });
    const cls = slots(el(fixture))[0].className;
    expect(cls).not.toMatch(/\bpx-[1-4]\b/);
  });

  it('keeps the keyboard path stepping by halves', async () => {
    // Not new — asserted here because it is the reason the pointer fix is about
    // target SIZE rather than about offering half-steps some other way.
    const { fixture } = await setup({ value: 3, max: 5, half: true });
    slider(el(fixture)).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(fixture.componentInstance.value()).toBe(3.5);
  });
});

describe('SvRatingComponent — half targets, re-verified 2026-09-26', () => {
  it('makes a small half target 24px tall as well as 24px wide', async () => {
    // A 16px glyph padded only sideways gave 24×16 halves — still under 2.5.8.
    const { fixture } = await setup({ value: 3, max: 5, half: true, size: 'sm' });
    const cls = slots(el(fixture))[0].className;
    expect(cls).toContain('px-4');
    expect(cls).toContain('py-1');
  });

  it('does not widen a read-only half rating — a display has no targets', async () => {
    const { fixture } = await setup({ value: 3.5, max: 5, half: true, readonly: true, size: 'md' });
    const glyphSlots = [...el(fixture).querySelectorAll<HTMLElement>('[role="img"] > span')];
    expect(glyphSlots.length).toBe(5);
    expect(glyphSlots.every(s => !/\bp[xy]-[1-4]\b/.test(s.className))).toBe(true);
  });
});
