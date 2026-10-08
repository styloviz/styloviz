import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvPriceComponent } from './price.component';

/**
 * `fractionDigits` exists because a whole class of prices is never quoted to
 * the cent, and `$1,180,000.00` on a property card reads as a spreadsheet
 * export. The default has to stay `null` — the currency's own convention —
 * because hard-coding two places prints `¥1,200.00`, a figure that does not
 * exist.
 */
async function setup(inputs: ComponentInput<SvPriceComponent>) {
  TestBed.resetTestingModule();
  return render(SvPriceComponent, { inputs });
}

const text = (f: { nativeElement: unknown }) =>
  ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();

describe('SvPriceComponent — fractionDigits', () => {
  it('keeps the currency convention by default', async () => {
    const { fixture } = await setup({ amount: 49.99, currency: 'USD', locale: 'en-US' });
    expect(text(fixture)).toContain('$49.99');
  });

  it('respects a zero-decimal currency by default', async () => {
    // ★ The reason the default is `null` and not `2`.
    const { fixture } = await setup({ amount: 1200, currency: 'JPY', locale: 'en-US' });
    expect(text(fixture)).not.toContain('.00');
  });

  it('drops the decimals when asked', async () => {
    const { fixture } = await setup({
      amount: 1_180_000,
      currency: 'USD',
      locale: 'en-US',
      fractionDigits: 0,
    });
    expect(text(fixture)).toContain('$1,180,000');
    expect(text(fixture)).not.toContain('.00');
  });

  it('rounds rather than truncating at zero decimals', async () => {
    const { fixture } = await setup({
      amount: 1999.6,
      currency: 'USD',
      locale: 'en-US',
      fractionDigits: 0,
    });
    expect(text(fixture)).toContain('$2,000');
  });

  it('applies the same precision to the compare-at price', async () => {
    const { fixture } = await setup({
      amount: 1_320_000,
      compareAt: 1_395_000,
      currency: 'USD',
      locale: 'en-US',
      fractionDigits: 0,
    });
    const body = text(fixture);
    expect(body).toContain('$1,320,000');
    expect(body).toContain('$1,395,000');
    expect(body).not.toContain('.00');
  });

  it('can add precision as well as remove it', async () => {
    const { fixture } = await setup({
      amount: 0.125,
      currency: 'USD',
      locale: 'en-US',
      fractionDigits: 3,
    });
    expect(text(fixture)).toContain('$0.125');
  });

  it('still converts minor units before formatting', async () => {
    const { fixture } = await setup({
      amount: 118_000_000,
      minorUnits: true,
      currency: 'USD',
      locale: 'en-US',
      fractionDigits: 0,
    });
    expect(text(fixture)).toContain('$1,180,000');
  });
});
