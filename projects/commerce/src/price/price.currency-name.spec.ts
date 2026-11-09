import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvPriceComponent, svCurrencySymbolIsAmbiguous } from './price.component';

/**
 * FL-J3-DD-03 — "£" or "$" alone does not say which currency a screen-reader
 * user is being charged in. When the symbol is shared, the figure is spoken
 * with the currency's full name and the symbol is hidden from the a11y tree.
 */

async function setup(inputs: Partial<ComponentInput<SvPriceComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvPriceComponent, {
    inputs: { amount: 49.99, ...inputs } as ComponentInput<SvPriceComponent>,
  });
  return fixture.nativeElement as HTMLElement;
}

/** The figure's accessible text: sr-only spans in, aria-hidden spans out. */
function spoken(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** What is painted: sr-only spans out. */
function seen(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove());
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('svCurrencySymbolIsAmbiguous', () => {
  it('calls "$" for USD in en-US ambiguous — it is also the CAD and AUD narrow symbol', () => {
    expect(svCurrencySymbolIsAmbiguous('USD', 'en-US')).toBe(true);
  });

  it('calls "CA$" for CAD in en-US unambiguous', () => {
    expect(svCurrencySymbolIsAmbiguous('CAD', 'en-US')).toBe(false);
  });

  it('calls "$" for CAD in en-CA ambiguous', () => {
    expect(svCurrencySymbolIsAmbiguous('CAD', 'en-CA')).toBe(true);
  });

  it('calls "£" for GBP ambiguous — EGP, FKP and GIP share it', () => {
    expect(svCurrencySymbolIsAmbiguous('GBP', 'en-GB')).toBe(true);
  });

  it('calls "€" unambiguous', () => {
    expect(svCurrencySymbolIsAmbiguous('EUR', 'de-DE')).toBe(false);
  });

  it('never throws on an unknown code', () => {
    expect(svCurrencySymbolIsAmbiguous('XYZ!', 'en-US')).toBe(false);
  });
});

describe('SvPriceComponent — currencyName', () => {
  it('USD: speaks "US dollars" and hides the bare "$" from assistive tech', async () => {
    const el = await setup({ currency: 'USD', locale: 'en-US' });
    expect(spoken(el)).toBe('49.99 US dollars');
    expect(seen(el)).toBe('$49.99');
    expect(el.querySelector('[aria-hidden="true"]')?.textContent).toBe('$49.99');
  });

  it('CAD in en-US: "CA$" already names it, so nothing is added', async () => {
    const el = await setup({ currency: 'CAD', locale: 'en-US' });
    expect(spoken(el)).toBe('CA$49.99');
    expect(el.querySelector('.sr-only')).toBeNull();
  });

  it('CAD in en-CA: "$" is ambiguous, so "Canadian dollars" is spoken', async () => {
    const el = await setup({ currency: 'CAD', locale: 'en-CA' });
    expect(spoken(el)).toBe('49.99 Canadian dollars');
  });

  it('GBP: speaks "British pounds" in place of "£"', async () => {
    const el = await setup({ currency: 'GBP', locale: 'en-GB' });
    expect(spoken(el)).toBe('49.99 British pounds');
    expect(seen(el)).toBe('£49.99');
  });

  it('names the compare-at and the range too, inside their own labels', async () => {
    const sale = await setup({ currency: 'GBP', locale: 'en-GB', amount: 40, compareAt: 50, discount: 'none' });
    expect(spoken(sale)).toBe('Sale price 40.00 British poundsRegular price 50.00 British pounds'); // separate elements
    const range = await setup({ currency: 'USD', locale: 'en-US', amount: 10, amountTo: 20 });
    expect(spoken(range)).toBe('10.00 US dollarsto 20.00 US dollars'); // separate elements
  });

  it('`always` names an unambiguous symbol too', async () => {
    const el = await setup({ currency: 'EUR', locale: 'en-IE', currencyName: 'always' });
    expect(spoken(el)).toBe('49.99 euros');
  });

  it('`never` keeps the symbol only', async () => {
    const el = await setup({ currency: 'USD', locale: 'en-US', currencyName: 'never' });
    expect(spoken(el)).toBe('$49.99');
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('keeps the negative-zero rule in the spoken figure', async () => {
    const el = await setup({ currency: 'USD', locale: 'en-US', amount: -0.001 });
    expect(spoken(el)).toBe('0.00 US dollars');
  });

  it('follows the minor-unit scale', async () => {
    const el = await setup({ currency: 'USD', locale: 'en-US', amount: 4999, minorUnits: true });
    expect(spoken(el)).toBe('49.99 US dollars');
  });

  it('falls back to the plain figure for an unknown currency', async () => {
    const el = await setup({ currency: 'NOPE' });
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
