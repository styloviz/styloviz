import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvPriceComponent } from './price.component';

/**
 * The parts of a price that are wrong quietly: which scale the stored integer is
 * on, which way a half-cent goes, whether the figure includes tax, and whether a
 * minus sign in front of it means anything to someone listening rather than
 * looking. None of it shows up in a rendered demo — all of it shows up in a
 * reconciliation.
 */

async function setup(inputs: Partial<ComponentInput<SvPriceComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvPriceComponent, {
    inputs: { amount: 49.99, ...inputs } as ComponentInput<SvPriceComponent>,
  });
}

const text = (f: { nativeElement: unknown }) =>
  ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();

describe('SvPriceComponent — minor units are not always hundredths', () => {
  it('divides by 100 for a two-decimal currency', async () => {
    const { fixture } = await setup({ amount: 4999, minorUnits: true, currency: 'USD' });
    expect(fixture.componentInstance.formattedAmount()).toBe('$49.99');
  });

  it('does not divide at all for a zero-decimal currency', async () => {
    // ★ JPY has no minor unit: 1000 is ¥1,000, not ¥10.
    const { fixture } = await setup({ amount: 1000, minorUnits: true, currency: 'JPY' });
    expect(fixture.componentInstance.formattedAmount()).toContain('1,000');
  });

  it('divides by 1000 for a three-decimal currency', async () => {
    const { fixture } = await setup({ amount: 1000, minorUnits: true, currency: 'KWD' });
    expect(fixture.componentInstance.formattedAmount()).toContain('1.000');
  });

  it('keeps the stored scale when the printed precision is overridden', async () => {
    // fractionDigits is about how the figure PRINTS. A house price held in cents
    // and shown without decimals is still cents.
    const { fixture } = await setup({
      amount: 118_000_000,
      minorUnits: true,
      currency: 'USD',
      fractionDigits: 0,
    });
    expect(fixture.componentInstance.formattedAmount()).toBe('$1,180,000');
  });
});

describe('SvPriceComponent — the rounding rule', () => {
  it('rounds a half away from zero by default', async () => {
    const { fixture } = await setup({ amount: 1.005 });
    expect(fixture.componentInstance.formattedAmount()).toBe('$1.01');
  });

  it('never rounds up when told to floor', async () => {
    const { fixture } = await setup({ amount: 1.239, roundingMode: 'floor' });
    expect(fixture.componentInstance.formattedAmount()).toBe('$1.23');
  });

  it('never quotes below the real price when told to ceil', async () => {
    const { fixture } = await setup({ amount: 1.001, roundingMode: 'ceil' });
    expect(fixture.componentInstance.formattedAmount()).toBe('$1.01');
  });

  it('truncates rather than rounding when told to', async () => {
    const { fixture } = await setup({
      amount: 1999.6,
      fractionDigits: 0,
      roundingMode: 'trunc',
    });
    expect(fixture.componentInstance.formattedAmount()).toBe('$1,999');
  });
});

describe('SvPriceComponent — money owed the other way', () => {
  it('prints a negative amount as a credit and says so out loud', async () => {
    const { fixture } = await setup({ amount: -12.5 });
    expect(fixture.componentInstance.isCredit()).toBe(true);
    expect(fixture.componentInstance.formattedAmount()).toBe('-$12.50');
    expect(screen.getByText(/Credit/)).toBeTruthy();
  });

  it('does not call a zero a credit', async () => {
    const { fixture } = await setup({ amount: 0 });
    expect(fixture.componentInstance.isCredit()).toBe(false);
  });

  it('collapses negative zero, which reads as a refund', async () => {
    // A figure that rounded away to nothing must not print "-$0.00".
    const { fixture } = await setup({ amount: -0 });
    expect(fixture.componentInstance.formattedAmount()).toBe('$0.00');
  });

  it('collapses a figure that rounds away to nothing', async () => {
    const { fixture } = await setup({ amount: -0.001 });
    expect(fixture.componentInstance.formattedAmount()).toBe('$0.00');
    // …and does not announce a credit over a figure that prints as zero.
    expect(fixture.componentInstance.isCredit()).toBe(false);
  });

  it('keeps the sign when the rounding mode says the figure really is negative', async () => {
    // Under floor, -0.001 IS -$0.01 — which is why the zero test is not a threshold.
    const { fixture } = await setup({ amount: -0.001, roundingMode: 'floor' });
    expect(fixture.componentInstance.formattedAmount()).toBe('-$0.01');
    expect(fixture.componentInstance.isCredit()).toBe(true);
  });

  it('refuses to advertise a saving against a negative amount', async () => {
    // -50 against 100 used to work out to "150% off".
    const { fixture } = await setup({ amount: -50, compareAt: 100 });
    expect(fixture.componentInstance.hasDiscount()).toBe(false);
    expect(fixture.componentInstance.discountPercent()).toBe(0);
  });
});

describe('SvPriceComponent — ranges', () => {
  it('prints both ends of a range', async () => {
    const { fixture } = await setup({ amount: 49.99, amountTo: 79.99 });
    expect(fixture.componentInstance.hasRange()).toBe(true);
    expect(text(fixture)).toContain('$49.99');
    expect(text(fixture)).toContain('$79.99');
  });

  it('reads the dash as a word, because a glyph is not one', async () => {
    await setup({ amount: 49.99, amountTo: 79.99 });
    expect(screen.getByText(/to/)).toBeTruthy();
  });

  it('ignores an upper bound that is not above the lower one', async () => {
    const { fixture: equal } = await setup({ amount: 49.99, amountTo: 49.99 });
    expect(equal.componentInstance.hasRange()).toBe(false);

    // Printing this as given would say the cheapest variant costs the most.
    const { fixture: backwards } = await setup({ amount: 49.99, amountTo: 20 });
    expect(backwards.componentInstance.hasRange()).toBe(false);
    expect(text(backwards)).not.toContain('$20.00');
  });

  it('drops the saving on a range, since a percentage off a span is not one number', async () => {
    const { fixture } = await setup({ amount: 49.99, amountTo: 79.99, compareAt: 99.99 });
    expect(fixture.componentInstance.hasDiscount()).toBe(false);
    expect(text(fixture)).not.toContain('$99.99');
  });

  it('prints an open-ended range with its label', async () => {
    const { fixture } = await setup({ amount: 49.99, from: true });
    expect(fixture.componentInstance.isFrom()).toBe(true);
    expect(text(fixture)).toBe('From$49.99'); // separate spans; the gap is visual
  });

  it('takes the wording for the open-ended range', async () => {
    const { fixture } = await setup({ amount: 49.99, from: true, fromLabel: 'Ab' });
    expect(text(fixture)).toBe('Ab$49.99');
  });

  it('lets a closed range outrank "from", which a closed range already says', async () => {
    const { fixture } = await setup({ amount: 49.99, amountTo: 79.99, from: true });
    expect(fixture.componentInstance.isFrom()).toBe(false);
    expect(text(fixture)).not.toContain('From');
  });

  it('does not call the bottom of a range free', async () => {
    // "Free – $79.99" is a lie about every variant but one.
    const { fixture } = await setup({ amount: 0, amountTo: 79.99, freeLabel: 'Free' });
    expect(fixture.componentInstance.isFree()).toBe(false);
    expect(text(fixture)).toContain('$0.00');
  });
});

describe('SvPriceComponent — the tax basis', () => {
  it('states nothing by default, because the component cannot know', async () => {
    const { fixture } = await setup({ amount: 49.99 });
    expect(fixture.componentInstance.taxNote()).toBe('');
    expect(text(fixture)).toBe('$49.99');
  });

  it('says the price includes tax when it does', async () => {
    const { fixture } = await setup({ amount: 49.99, taxMode: 'inclusive' });
    expect(text(fixture)).toContain('incl. tax');
  });

  it('says the price excludes tax when it does', async () => {
    const { fixture } = await setup({ amount: 49.99, taxMode: 'exclusive' });
    expect(text(fixture)).toContain('excl. tax');
  });

  it('takes the name of the tax, and a rate along with it', async () => {
    const { fixture } = await setup({
      amount: 49.99,
      taxMode: 'inclusive',
      taxLabel: '20% VAT',
    });
    expect(text(fixture)).toContain('incl. 20% VAT');
  });

  it('states the basis as text, not as a colour or a tooltip', async () => {
    const { fixture } = await setup({ amount: 49.99, taxMode: 'inclusive', taxLabel: 'GST' });
    expect(screen.getByText('incl. GST')).toBeTruthy();
    expect(fixture.componentInstance.taxNote()).toBe('incl. GST');
  });
});

describe('SvPriceComponent — a currency code Intl will not take', () => {
  it('prints the figure and the code instead of throwing', async () => {
    // A bad ISO code arrives from an API, not a template, and an uncaught throw
    // in a computed blanks the whole product grid rather than the one bad price.
    // 'XX' is malformed, so Intl rejects it — a well-formed but unassigned code
    // like 'XYZ' it accepts and renders as "XYZ 49.99" itself.
    const { fixture } = await setup({ amount: 49.99, currency: 'XX' });
    expect(fixture.componentInstance.formattedAmount()).toBe('XX 49.99');
  });

  it('falls back to hundredths for the minor-unit scale', async () => {
    const { fixture } = await setup({ amount: 4999, minorUnits: true, currency: 'XX' });
    expect(fixture.componentInstance.formattedAmount()).toBe('XX 49.99');
  });
});
