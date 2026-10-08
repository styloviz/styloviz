import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAddressCardComponent } from './address-card.component';
import type { Address } from './address-card.component';

/**
 * Every name field on an address is optional — a company delivery has no first
 * name, an imported record may have neither — and the card has to compose a
 * line out of whatever it was given without leaving stray whitespace.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAddressCardComponent, { inputs });
  return fixture;
}

const addr = (over: Partial<Address> = {}): Address => ({
  line1: '1 High Street',
  city: 'Leeds',
  country: 'GB',
  ...over,
} as Address);

describe('SvAddressCardComponent — the name line', () => {
  it('joins both names', async () => {
    const f = await setup({ address: addr({ firstName: 'Ada', lastName: 'Lovelace' }) });
    expect(f.componentInstance.fullName()).toBe('Ada Lovelace');
  });

  it('leaves no stray space when only one name is given', async () => {
    const first = await setup({ address: addr({ firstName: 'Ada' }) });
    expect(first.componentInstance.fullName()).toBe('Ada');

    const last = await setup({ address: addr({ lastName: 'Lovelace' }) });
    expect(last.componentInstance.fullName()).toBe('Lovelace');
  });

  it('is empty when the address carries no name at all', async () => {
    const f = await setup({ address: addr() });
    expect(f.componentInstance.fullName()).toBe('');
  });
});

describe('SvAddressCardComponent — the city line', () => {
  it('separates city and state with a comma, and the postcode with a space', async () => {
    const f = await setup({ address: addr({ city: 'Austin', state: 'TX', postalCode: '78701' }) });
    expect(f.componentInstance.cityLine()).toBe('Austin, TX 78701');
  });

  it('drops the comma when there is no state', async () => {
    const f = await setup({ address: addr({ city: 'Leeds', postalCode: 'LS1 4AP' }) });
    expect(f.componentInstance.cityLine()).toBe('Leeds LS1 4AP');
  });

  it('is empty when it has neither', async () => {
    const f = await setup({ address: addr({ city: '', postalCode: '' }) });
    expect(f.componentInstance.cityLine()).toBe('');
  });
});

describe('SvAddressCardComponent — selection', () => {
  it('selects on Enter when the card is selectable', async () => {
    const f = await setup({ address: addr(), selectable: true });
    const seen: Address[] = [];
    f.componentInstance.addressSelected.subscribe((a) => seen.push(a));

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    f.componentInstance.onKeydownSelect(event);

    expect(seen).toHaveLength(1);
    expect(event.defaultPrevented).toBe(true);
  });

  /**
   * ★ Assert the negative: a card that is not selectable must neither emit nor
   * swallow the key — Space still has to scroll the page underneath it.
   */
  it('ignores the key entirely when the card is not selectable', async () => {
    const f = await setup({ address: addr() });
    const seen: Address[] = [];
    f.componentInstance.addressSelected.subscribe((a) => seen.push(a));

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    f.componentInstance.onKeydownSelect(event);

    expect(seen).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores a pointer selection too when not selectable', async () => {
    const f = await setup({ address: addr() });
    const seen: Address[] = [];
    f.componentInstance.addressSelected.subscribe((a) => seen.push(a));
    f.componentInstance.onSelect();
    expect(seen).toEqual([]);
  });
});
