import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvPriceComponent } from './price.component';

/**
 * `compareAt` is what turns a price into a discount. `null` is the ordinary
 * case — most products are not on sale — and it must produce no struck-through
 * figure at all rather than a formatted zero.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvPriceComponent, { inputs });
  return fixture;
}

describe('SvPriceComponent — compareAt', () => {
  it('formats a comparison price when there is one', async () => {
    // `amount` is in major units for this component, not minor.
    const f = await setup({ amount: 19.99, compareAt: 29.99, currency: 'GBP' });
    expect(f.componentInstance.formattedCompareAt()).toContain('29.99');
  });

  /** ★ Assert the negative: no comparison means no struck-through figure. */
  it('produces nothing at all when there is no comparison price', async () => {
    const f = await setup({ amount: 19.99, currency: 'GBP' });
    expect(f.componentInstance.formattedCompareAt()).toBe('');
    expect((f.nativeElement as HTMLElement).querySelector('s, del')).toBeNull();
  });

  /** Zero is a comparison price — "was free" — and is not the same as absent. */
  it('treats a comparison of zero as present', async () => {
    const f = await setup({ amount: 19.99, compareAt: 0, currency: 'GBP' });
    expect(f.componentInstance.formattedCompareAt()).not.toBe('');
  });
});
