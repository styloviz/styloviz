import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvButtonComponent } from './button.component';

/**
 * Every variant follows the theme.
 *
 * ★ This file used to be `button.brand-variant.spec.ts`, and it proved the
 *   opposite: that `brand` alone read the token families while every other
 *   variant was a literal Tailwind palette, so buttons stayed blue on an olive
 *   page. Now all of them paint from `@theme`, and the thing worth proving is
 *   that NONE of them regresses to a literal — because a single `bg-blue-600`
 *   left in one arm of one style map is invisible until a buyer rebrands and
 *   finds one button that ignored them.
 *
 * ★★ The two assertions are deliberately opposite in kind. Checking a token
 *    family is PRESENT would pass on a button that painted both a token and a
 *    stray literal; checking no owned literal is present would pass on a button
 *    painted in nothing at all. A regression needs both to catch it.
 */
async function setup(inputs: ComponentInput<SvButtonComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvButtonComponent, { inputs: { label: 'Search', ...inputs } });
}

const classesOf = (f: { nativeElement: unknown }) =>
  (f.nativeElement as HTMLElement).querySelector('button,a')?.className ?? '';

const STYLES = ['solid', 'outline', 'soft', 'ghost', 'link', 'gradient'] as const;
const VARIANTS = [
  'primary', 'brand', 'secondary', 'success',
  'warning', 'danger', 'info', 'neutral', 'ghost', 'link',
] as const;

/**
 * Literal Tailwind families a kit token family owns. `teal`, `cyan` and
 * `orange` are absent on purpose — the gradient arms keep those as their far
 * stop, because collapsing them into a semantic family would paint both ends of
 * a gradient the same colour the moment a buyer picks one.
 */
const OWNED_LITERAL =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|caret|placeholder|shadow|accent)-(?:blue|emerald|green|red|rose|amber|sky|indigo|violet|slate|zinc|stone|neutral)-\d{2,3}\b/;

const TOKEN_FAMILY =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|caret|placeholder|shadow|accent)-(?:primary|accent|warning|danger|info|brand|brandaccent|gray)-\d{2,3}\b/;

describe('SvButtonComponent — theme tokens', () => {
  for (const variant of VARIANTS) {
    for (const btnStyle of STYLES) {
      it(`paints ${variant}/${btnStyle} from token families only`, async () => {
        const { fixture } = await setup({ variant, btnStyle });
        const cls = classesOf(fixture);
        expect(cls, 'a literal palette a token family owns').not.toMatch(OWNED_LITERAL);
        expect(cls, 'no theme token at all').toMatch(TOKEN_FAMILY);
      });
    }
  }

  it('keeps brand and primary as separate families', async () => {
    const brand = classesOf((await setup({ variant: 'brand' })).fixture);
    const primary = classesOf((await setup({ variant: 'primary' })).fixture);
    expect(brand).toMatch(/\bbg-brand-\d{2,3}\b/);
    expect(brand).not.toMatch(/\bbg-primary-\d{2,3}\b/);
    expect(primary).toMatch(/\bbg-primary-\d{2,3}\b/);
  });

  it('paints each semantic variant from the family that names it', async () => {
    // `\b` matters: `toContain('accent-')` would also be satisfied by
    // `brandaccent-600`, so the success arm could pass while painted from the
    // wrong family entirely.
    const expected: readonly (readonly [(typeof VARIANTS)[number], RegExp])[] = [
      ['primary', /\bbg-primary-\d{2,3}\b/],
      ['success', /\bbg-accent-\d{2,3}\b/],
      ['warning', /\bbg-warning-\d{2,3}\b/],
      ['danger', /\bbg-danger-\d{2,3}\b/],
      ['info', /\bbg-info-\d{2,3}\b/],
    ];
    for (const [variant, family] of expected) {
      const cls = classesOf((await setup({ variant, btnStyle: 'solid' })).fixture);
      expect(cls, variant).toMatch(family);
    }
  });

  it('still renders label, icon and disabled state like any other variant', async () => {
    const { fixture } = await setup({ variant: 'brand', icon: 'search', disabled: true });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Search');
    expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
  });
});
