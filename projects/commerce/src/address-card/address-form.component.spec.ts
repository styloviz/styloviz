import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvAddressFormComponent } from './address-form.component';
import type { Address } from './address-card.component';
import type { AddressSaveEvent } from './address-schema';

/**
 * A form with no `<form>` library behind it: signals for the fields, a
 * submitted flag for when to complain. Two things about that were only half
 * done — every id was a literal, so two of these on one page (shipping and
 * billing, which is the ordinary checkout) shared them; and a field said it was
 * invalid without ever saying which message explained why.
 */

const EXISTING: Address = {
  id: 'a1',
  label: 'Home',
  firstName: 'Sazzad',
  lastName: 'Hossain',
  line1: '12 Bishop Street',
  line2: 'Flat 4',
  city: 'Dhaka',
  state: 'Dhaka',
  postalCode: '1207',
  country: 'Bangladesh',
  phone: '+880 1700 000000',
  isDefault: true,
};

async function setup(inputs: Partial<ComponentInput<SvAddressFormComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAddressFormComponent, {
    inputs: inputs as ComponentInput<SvAddressFormComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

/**
 * Labels carry an "(optional)" suffix where the country does not require the
 * field, so matching is by prefix rather than by the whole string.
 */
const field = (name: string) =>
  screen.getByLabelText(new RegExp(`^${name}\\b`)) as HTMLInputElement;

const country = () => screen.getByLabelText('Country') as HTMLSelectElement;

/** Fill every field Bangladesh requires. */
async function fillRequired() {
  await userEvent.selectOptions(country(), 'Bangladesh');
  await userEvent.type(field('First name'), 'Sazzad');
  await userEvent.type(field('Last name'), 'Hossain');
  await userEvent.type(field('Address'), '12 Bishop Street');
  await userEvent.type(field('City'), 'Dhaka');
  await userEvent.type(field('District'), 'Dhaka');
}

describe('SvAddressFormComponent — labels and ids', () => {
  it('links every label to its own control', async () => {
    await setup({ value: EXISTING });
    for (const name of ['First name', 'Last name', 'Address', 'City', 'District', 'Postal code', 'Country']) {
      expect(screen.getByLabelText(new RegExp(`^${name}\\b`))).toBeTruthy();
    }
  });

  it('gives two forms on one page different ids', async () => {
    // A checkout showing shipping and billing side by side rendered the same
    // literal ids twice, and every `<label for>` in the second form resolved to
    // the first form's input.
    // Both instances must share an application: ids are per application (svUniqueId).
    const { fixture: a } = await setup();
    const b = TestBed.createComponent(SvAddressFormComponent);
    b.detectChanges();
    await b.whenStable();
    const ids = (f: { nativeElement: unknown }) =>
      [...el(f).querySelectorAll('[id]')].map((n) => n.getAttribute('id'));

    const first = ids(a);
    const second = ids(b);
    expect(first.length).toBeGreaterThan(5);
    expect(first.some((id) => second.includes(id))).toBe(false);
  });
});

describe('SvAddressFormComponent — validation', () => {
  it('says nothing until the form is submitted', async () => {
    const { fixture } = await setup();
    expect(screen.queryAllByText('Required').length).toBe(0);
    expect(fixture.componentInstance.errorFor('firstName')).toBe('');
  });

  it('refuses an empty submit and marks every required field', async () => {
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(saves).toEqual([]);
    // Country, plus the three the generic schema requires before a country is
    // known: first name, last name, street. Not city, not region, not postal
    // code — the country that decides those has not been picked yet.
    expect(screen.getAllByText('Required').length).toBe(4);
  });

  it('points each invalid control at the message that explains it', async () => {
    // `aria-invalid` on its own tells a screen-reader user something is wrong
    // and never what.
    const { fixture } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    fixture.detectChanges();

    const first = field('First name');
    expect(first.getAttribute('aria-invalid')).toBe('true');
    const describedBy = first.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = el(fixture).querySelector(`#${describedBy}`);
    expect(message?.textContent).toBe('Required');
    expect(message?.getAttribute('role')).toBe('alert');
  });

  it('stops complaining once a field is filled in', async () => {
    const { fixture } = await setup({ value: { ...EXISTING, city: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(fixture.componentInstance.errorFor('city')).toBe('Required');

    await userEvent.type(field('City'), 'Dhaka');
    fixture.detectChanges();
    expect(fixture.componentInstance.errorFor('city')).toBe('');
    expect(field('City').getAttribute('aria-describedby')).toBeNull();
  });

  it('treats whitespace as empty', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.firstName.set('   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(fixture.componentInstance.errorFor('firstName')).toBe('Required');
  });

  it('never asks for the optional fields', async () => {
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(saves.length).toBe(1);
    expect(saves[0].address.label).toBeUndefined();
    expect(saves[0].address.phone).toBeUndefined();
    // Bangladesh's postal code is optional, and it was left blank.
    expect(saves[0].address.postalCode).toBe('');
  });
});

describe('SvAddressFormComponent — what it hands back', () => {
  it('trims what it collects, and drops the empty optional parts', async () => {
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.save.subscribe((e) => saves.push(e));
    const c = fixture.componentInstance;

    c.country.set('Bangladesh');
    c.firstName.set('  Sazzad ');
    c.lastName.set('Hossain');
    c.line1.set(' 12 Bishop Street ');
    c.line2.set('   ');
    c.city.set('Dhaka');
    c.state.set('Dhaka');
    c.postalCode.set('1207');
    c.onSubmit(new Event('submit'));

    expect(saves[0].address.firstName).toBe('Sazzad');
    expect(saves[0].address.line1).toBe('12 Bishop Street');
    expect(saves[0].address.line2).toBeUndefined();
  });

  it('does not let the browser navigate away on submit', async () => {
    const { fixture } = await setup();
    const event = new Event('submit', { cancelable: true });
    fixture.componentInstance.onSubmit(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the id and kind of the address it is editing', async () => {
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await setup({ value: { ...EXISTING, kind: 'shipping' } });
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    fixture.componentInstance.onSubmit(new Event('submit'));
    expect(saves[0].address.id).toBe('a1');
    expect(saves[0].address.kind).toBe('shipping');
    expect(saves[0].address.isDefault).toBe(true);
  });

  it('says when it was cancelled', async () => {
    let cancels = 0;
    const { fixture } = await setup();
    fixture.componentInstance.cancelled.subscribe(() => { cancels += 1; });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancels).toBe(1);
  });
});

describe('SvAddressFormComponent — edit mode', () => {
  it('fills itself in from the address it was given', async () => {
    const { fixture } = await setup({ value: EXISTING });
    expect(fixture.componentInstance.firstName()).toBe('Sazzad');
    expect(field('City').value).toBe('Dhaka');
    expect(fixture.componentInstance.isDefault()).toBe(true);
  });

  it('repopulates when it is pointed at a different address', async () => {
    const { fixture } = await setup({ value: EXISTING });
    fixture.componentInstance.city.set('Chittagong');
    expect(fixture.componentInstance.city()).toBe('Chittagong');

    fixture.componentRef.setInput('value', { ...EXISTING, city: 'Sylhet' });
    fixture.detectChanges();
    expect(fixture.componentInstance.city()).toBe('Sylhet');
  });

  it('starts empty with nothing to edit', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.firstName()).toBe('');
    expect(fixture.componentInstance.isDefault()).toBe(false);
  });
});

describe('SvAddressFormComponent — what the host can change', () => {
  it('takes its own wording', async () => {
    await setup({ title: 'Shipping address', submitLabel: 'Continue', cancelLabel: 'Back' });
    expect(screen.getByText('Shipping address')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('drops the parts it was told to drop', async () => {
    await setup({ showCancel: false, showLabelField: false, showDefaultToggle: false });
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByLabelText(/^Label/)).toBeNull();
  });

  it('offers the countries it was given, and only those', async () => {
    await setup({
      schemas: [
        { code: 'BD', name: 'Bangladesh', fields: [] },
        { code: 'JP', name: 'Japan', fields: [] },
      ],
    });
    const options = [...country().options].map((o) => o.textContent?.trim()).filter((t) => t);
    expect(options).toContain('Bangladesh');
    expect(options).toContain('Japan');
    expect(options).not.toContain('France');
  });

  it('relabels the country selector', async () => {
    await setup({ countryLabel: 'Country or region' });
    expect(screen.getByLabelText('Country or region')).toBeTruthy();
  });
});
