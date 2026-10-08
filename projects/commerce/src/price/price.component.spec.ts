import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvPriceComponent } from './price.component';

/**
 * Money on a screen. Two things can be quietly wrong about it: the number, and
 * which number it is. The second is the one nobody checks — a strike-through
 * says "was" to someone looking at it and nothing at all to someone listening,
 * so a discounted price used to read out as two amounts with no way to tell
 * which one is being charged.
 */

async function setup(inputs: Partial<ComponentInput<SvPriceComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvPriceComponent, {
    inputs: { amount: 49.99, ...inputs } as ComponentInput<SvPriceComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const text = (f: { nativeElement: unknown }) => el(f).textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SvPriceComponent — the number', () => {
  it('formats as currency for its locale', async () => {
    const { fixture } = await setup({ amount: 49.99 });
    expect(fixture.componentInstance.formattedAmount()).toBe('$49.99');
  });

  it('takes another currency and another locale', async () => {
    const { fixture } = await setup({ amount: 1234.5, currency: 'EUR', locale: 'de-DE' });
    const formatted = fixture.componentInstance.formattedAmount();
    expect(formatted).toContain('€');
    expect(formatted).toContain('1.234,50');
  });

  it('reads cents when the host stores cents', async () => {
    const { fixture } = await setup({ amount: 4999, minorUnits: true });
    expect(fixture.componentInstance.formattedAmount()).toBe('$49.99');
  });

  it('shows a free label instead of a zero, when there is one', async () => {
    const { fixture } = await setup({ amount: 0, freeLabel: 'Free' });
    expect(fixture.componentInstance.isFree()).toBe(true);
    expect(text(fixture)).toBe('Free');
  });

  it('formats a real zero when there is no free label', async () => {
    const { fixture } = await setup({ amount: 0 });
    expect(fixture.componentInstance.isFree()).toBe(false);
    expect(text(fixture)).toBe('$0.00');
  });
});

describe('SvPriceComponent — the discount', () => {
  it('shows nothing extra without a compare-at price', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.hasDiscount()).toBe(false);
    expect(el(fixture).querySelector('s')).toBeNull();
  });

  it('strikes the original through and works out the saving', async () => {
    const { fixture } = await setup({ amount: 49.99, compareAt: 79.99 });
    expect(fixture.componentInstance.hasDiscount()).toBe(true);
    expect(fixture.componentInstance.formattedCompareAt()).toBe('$79.99');
    expect(fixture.componentInstance.discountPercent()).toBe(38);
  });

  it('ignores a compare-at price that is not actually higher', async () => {
    const { fixture: same } = await setup({ amount: 49.99, compareAt: 49.99 });
    expect(same.componentInstance.hasDiscount()).toBe(false);

    const { fixture: lower } = await setup({ amount: 49.99, compareAt: 20 });
    expect(lower.componentInstance.hasDiscount()).toBe(false);
    expect(lower.componentInstance.discountPercent()).toBe(0);
  });

  it('does not divide by a compare-at price of zero', async () => {
    const { fixture } = await setup({ amount: 0, compareAt: 0 });
    expect(fixture.componentInstance.discountPercent()).toBe(0);
    expect(text(fixture)).not.toContain('NaN');
  });

  it('shows the saving as a badge, as text, or not at all', async () => {
    const { fixture: badge } = await setup({ amount: 50, compareAt: 100, discount: 'badge' });
    expect(text(badge)).toContain('50%');

    const { fixture: asText } = await setup({ amount: 50, compareAt: 100, discount: 'text' });
    expect(text(asText)).toContain('Save 50%');

    const { fixture: none } = await setup({ amount: 50, compareAt: 100, discount: 'none' });
    expect(text(none)).not.toContain('50%');
    expect(none.componentInstance.hasDiscount()).toBe(true);
  });
});

describe('SvPriceComponent — what is read out', () => {
  it('says which price is which', async () => {
    // Without these the pair reads as "$49.99 $79.99".
    await setup({ amount: 49.99, compareAt: 79.99 });
    expect(screen.getByText(/Sale price/)).toBeTruthy();
    expect(screen.getByText(/Regular price/)).toBeTruthy();
  });

  it('says nothing extra when there is only one price', async () => {
    await setup({ amount: 49.99 });
    expect(screen.queryByText(/Sale price/)).toBeNull();
    expect(screen.queryByText(/Regular price/)).toBeNull();
  });

  it('reads the badge as a saving, not as a minus sign', async () => {
    const { fixture } = await setup({ amount: 50, compareAt: 100 });
    // The root is a <span> too, so match the badge by its own class.
    const badge = el(fixture).querySelector('span.rounded-full');
    expect(badge?.getAttribute('aria-label')).toBe('50% off');
  });
});

describe('SvPriceComponent — presentation', () => {
  it('scales the amount and the compare-at together', async () => {
    const { fixture } = await setup({ size: 'xl' });
    expect(fixture.componentInstance.amountClass()).toBe('text-3xl');
    expect(fixture.componentInstance.compareClass()).toBe('text-lg');
  });

  it.each([
    ['start', 'justify-start'],
    ['center', 'justify-center'],
    ['end', 'justify-end'],
  ] as const)('aligns %s', async (align, expected) => {
    const { fixture } = await setup({ align });
    expect(fixture.componentInstance.alignClass()).toContain(expected);
  });

  it('colours the amount only once it is a sale price', async () => {
    const { fixture } = await setup({ amount: 50 });
    expect(el(fixture).innerHTML).toContain('text-gray-900');

    const { fixture: sale } = await setup({ amount: 50, compareAt: 100 });
    expect(el(sale).innerHTML).toContain('text-danger-600');
  });
});
