import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvBadgeComponent } from './badge.component';

/**
 * The badge is mostly a set of class maps, and a class map is exactly the kind
 * of code that looks right and ships wrong: two cases swapped, or the
 * count-mode arm returning the label-mode string, produces a badge that still
 * renders and still reads correctly — it is just the wrong shape. These pin the
 * three decisions the maps actually make (size, count-vs-label geometry, shape)
 * plus the one accessible-name computation nothing else reaches.
 */

async function setup(inputs: Partial<ComponentInput<SvBadgeComponent>> = {}) {
  // `render` calls configureTestingModule, which throws on a second call in one
  // test unless the module is reset first.
  TestBed.resetTestingModule();
  return render(SvBadgeComponent, {
    inputs: inputs as ComponentInput<SvBadgeComponent>,
  });
}

/** The `<span>` the component renders — scoped to the host, never `screen`. */
const root = (f: { nativeElement: unknown }) =>
  (f.nativeElement as HTMLElement).firstElementChild as HTMLElement;

const rootClass = async (inputs: Partial<ComponentInput<SvBadgeComponent>>) =>
  root((await setup(inputs)).fixture).className;

describe('SvBadgeComponent — size geometry', () => {
  it('scales horizontal padding with size in label mode', async () => {
    expect(await rootClass({ label: 'A', size: 'sm' })).toContain('px-2.5');
    expect(await rootClass({ label: 'A', size: 'md' })).toContain('px-3 ');
    expect(await rootClass({ label: 'A', size: 'lg' })).toContain('px-4');
  });

  it('scales the type ramp with size in label mode', async () => {
    expect(await rootClass({ label: 'A', size: 'sm' })).toContain('text-[11px]');
    expect(await rootClass({ label: 'A', size: 'md' })).toContain('text-xs');
    expect(await rootClass({ label: 'A', size: 'lg' })).toContain('text-sm');
  });

  /**
   * Count mode is a different geometry, not a different padding: a fixed-height
   * pill with a minimum width so a one- and a two-digit count are the same
   * shape. Asserting the `min-w-*` is what distinguishes it from label mode.
   */
  it('switches to a fixed, centred box in count mode at every size', async () => {
    expect(await rootClass({ count: 3, size: 'sm' })).toContain('h-5 min-w-5');
    expect(await rootClass({ count: 3, size: 'md' })).toContain('h-6 min-w-6');
    expect(await rootClass({ count: 3, size: 'lg' })).toContain('h-7 min-w-7');
  });

  it('centres the count but not a label', async () => {
    expect(await rootClass({ count: 3, size: 'md' })).toContain('justify-center');
    expect(await rootClass({ label: 'A', size: 'md' })).not.toContain('justify-center');
  });

  /** count === 0 is *not* count mode — a zero badge is a label badge. */
  it('treats a count of zero as label mode, not an empty count pill', async () => {
    const { fixture } = await setup({ count: 0, label: 'None', size: 'md' });
    expect(fixture.componentInstance.isCountMode()).toBe(false);
    expect(root(fixture).className).not.toContain('min-w-6');
    expect(root(fixture).textContent?.trim()).toBe('None');
  });

  it('renders the count itself, uncapped, when it is under maxCount', async () => {
    const { fixture } = await setup({ count: 7, maxCount: 99 });
    expect(fixture.componentInstance.displayCount()).toBe('7');
  });
});

describe('SvBadgeComponent — shape', () => {
  it('maps each shape to its own radius', async () => {
    expect(await rootClass({ label: 'A', shape: 'square' })).toContain('rounded-none');
    expect(await rootClass({ label: 'A', shape: 'rounded' })).toContain('rounded-md');
    expect(await rootClass({ label: 'A', shape: 'pill' })).toContain('rounded-full');
  });
});

describe('SvBadgeComponent — dismiss control colour', () => {
  /**
   * On a filled badge the background is the variant colour, so a variant-coloured
   * dismiss glyph would be invisible against it. The filled arm is the only
   * place that ignores `variant` entirely.
   */
  it('uses white-on-fill for the dismiss glyph in filled style, ignoring variant', async () => {
    const { fixture } = await setup({
      label: 'Filter',
      dismissible: true,
      badgeStyle: 'filled',
      variant: 'danger',
    });
    const btn = root(fixture).querySelector('button') as HTMLElement;
    expect(btn.className).toContain('text-white/70');
    expect(btn.className).not.toContain('text-danger-500');
  });

  it('uses the variant colour for the dismiss glyph in soft style', async () => {
    const { fixture } = await setup({
      label: 'Filter',
      dismissible: true,
      badgeStyle: 'soft',
      variant: 'danger',
    });
    const btn = root(fixture).querySelector('button') as HTMLElement;
    expect(btn.className).toContain('text-danger-500');
    expect(btn.className).not.toContain('text-white/70');
  });

  it('names the dismiss control from the aria-label when there is no visible label', async () => {
    const { fixture } = await setup({ ariaLabel: 'Premium', dismissible: true });
    const btn = root(fixture).querySelector('button') as HTMLElement;
    expect(btn.getAttribute('aria-label')).toBe('Remove Premium');
  });

  it('falls back to "Remove badge" when the badge has no name at all', async () => {
    const { fixture } = await setup({ dismissible: true });
    const btn = root(fixture).querySelector('button') as HTMLElement;
    expect(btn.getAttribute('aria-label')).toBe('Remove badge');
  });
});

describe('SvBadgeComponent — resolvedAriaLabel', () => {
  it('prefers the explicit override', async () => {
    const { fixture } = await setup({ label: 'Active', ariaLabel: 'Account is active' });
    expect(fixture.componentInstance.resolvedAriaLabel()).toBe('Account is active');
  });

  it('falls back to the visible label', async () => {
    const { fixture } = await setup({ label: 'Active' });
    expect(fixture.componentInstance.resolvedAriaLabel()).toBe('Active');
  });

  it('is empty when the badge carries neither', async () => {
    const { fixture } = await setup({ count: 4 });
    expect(fixture.componentInstance.resolvedAriaLabel()).toBe('');
  });
});

describe('SvBadgeComponent — host role', () => {
  it('prefers status over img when the badge is both live and labelled', async () => {
    const { fixture } = await setup({ label: 'Syncing', live: true, ariaLabel: 'Sync state' });
    expect(fixture.componentInstance.hostRole()).toBe('status');
    expect(root(fixture).getAttribute('aria-live')).toBe('polite');
  });

  it('carries no role and no live region for a plain label', async () => {
    const { fixture } = await setup({ label: 'Draft' });
    expect(fixture.componentInstance.hostRole()).toBeNull();
    expect(root(fixture).getAttribute('role')).toBeNull();
    expect(root(fixture).getAttribute('aria-live')).toBeNull();
  });
});

describe('SvBadgeComponent — every variant follows the theme', () => {
  /**
   * ★★ This block used to cover `brand` alone, under the title "the badge could
   *    not match the button beside it" — because every other variant was painted
   *    with a literal palette, so badges stayed blue on a rose page and `brand`
   *    was the escape hatch. All eight read tokens now, so what is worth pinning
   *    is that none of them regressed.
   *
   * ★ The two assertions are deliberately opposite in kind. Present-only passes
   *   on a badge that still carries a stray literal alongside its token;
   *   absent-only passes on a badge painted in nothing at all. Neither is
   *   sufficient, which is why both are here.
   *
   * ★ `gray` is a token family, not a literal, so `neutral` and `secondary`
   *   naming it is the correct answer rather than a miss — the earlier version of
   *   this test forbade `gray-\d` outright, which only passed because it ran on
   *   `brand` alone.
   */
  const VARIANTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral', 'brand'] as const;
  const STYLES = ['filled', 'soft', 'outline'] as const;

  const OWNED_LITERAL =
    /\b(?:bg|text|border|ring|from|to|via|divide|outline)-(?:blue|emerald|green|red|rose|amber|sky|indigo|violet|slate|zinc|stone|neutral)-\d{2,3}\b/;
  const TOKEN_FAMILY =
    /\b(?:bg|text|border|ring|from|to|via|divide|outline)-(?:primary|accent|warning|danger|info|brand|brandaccent|gray)-\d{2,3}\b/;

  it('paints every variant in every style from a token family, never a literal palette', async () => {
    for (const variant of VARIANTS) {
      for (const badgeStyle of STYLES) {
        const { fixture } = await setup({ label: 'New', variant, badgeStyle });
        const classes = fixture.componentInstance.rootClasses();
        expect(classes, `${variant}/${badgeStyle} names a literal palette a token family owns`)
          .not.toMatch(OWNED_LITERAL);
        expect(classes, `${variant}/${badgeStyle} names no theme token at all`).toMatch(TOKEN_FAMILY);
      }
    }
  });

  it('keeps brand and primary as separate families', async () => {
    const classesFor = async (variant: 'brand' | 'primary') =>
      (await setup({ label: 'New', variant, badgeStyle: 'filled' })).fixture.componentInstance.rootClasses();
    // `toContain('brand-')` would also be satisfied by `brandaccent-600`.
    expect(await classesFor('brand')).toMatch(/\b(?:bg|text|border|ring)-brand-\d{2,3}\b/);
    expect(await classesFor('primary')).toMatch(/\b(?:bg|text|border|ring)-primary-\d{2,3}\b/);
  });

  it('carries the brand tokens through to the dot and the dismiss control', async () => {
    const { fixture } = await setup({ label: 'New', variant: 'brand', dot: true, dismissible: true });
    expect(fixture.componentInstance.dotColorClass()).toContain('brand-');
    expect(fixture.componentInstance.dismissColorClass()).toContain('brand-');
  });
});

