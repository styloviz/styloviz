import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvAddressFormComponent } from './address-form.component';
import {
  SvAddressCardComponent,
  type Address,
  type AddressActionEvent,
} from './address-card.component';
import {
  DEFAULT_ADDRESS_SCHEMAS,
  resolveAddressSchema,
  type AddressSaveEvent,
  type AddressVerificationStatus,
} from './address-schema';

/**
 * Three things this pair used to get wrong, all of them the kind that only shows
 * up outside the United States or outside the happy path:
 *
 * 1. The field list was markup, so every address needed a state and a postal
 *    code and both were required. A UK address has an optional county and a Hong
 *    Kong one has no postal code at all — the form was unsubmittable for both
 *    unless you invented data.
 * 2. Removing the DEFAULT address emitted the same event as removing any other,
 *    leaving the host to guess whether a new default was wanted and which.
 * 3. Verification was a boolean, so "we could not reach the verifier" and "this
 *    address is wrong" were the same state — and it gated submit.
 */

// ─── Form: the field list is data ─────────────────────────────────────────────

async function form(inputs: Partial<ComponentInput<SvAddressFormComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAddressFormComponent, {
    inputs: inputs as ComponentInput<SvAddressFormComponent>,
  });
}

const label = (name: string) =>
  screen.getByLabelText(new RegExp(`^${name}\\b`)) as HTMLInputElement;
const maybeLabel = (name: string) =>
  screen.queryByLabelText(new RegExp(`^${name}\\b`)) as HTMLInputElement | null;
const countrySelect = () => screen.getByLabelText('Country') as HTMLSelectElement;
const submit = () => screen.getByRole('button', { name: 'Save address' });

/** Field labels in the order the form renders them, country aside. */
function renderedFields(f: { nativeElement: unknown }): string[] {
  const root = f.nativeElement as HTMLElement;
  return [...root.querySelectorAll('label[for]')]
    .map((l) => (l.textContent ?? '').replace(/\(optional\)/, '').trim())
    .filter((t) => t !== 'Country');
}

describe('SvAddressFormComponent — the country decides the fields', () => {
  it('takes a UK address with no county', async () => {
    // ★ The headline case. County is optional in the UK, and the old form
    //   refused to submit without one.
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await form();
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    await userEvent.type(label('First name'), 'Ada');
    await userEvent.type(label('Last name'), 'Lovelace');
    await userEvent.type(label('Address'), '12 Bishop Street');
    await userEvent.type(label('Town or city'), 'London');
    await userEvent.type(label('Postcode'), 'EC1A 1BB');
    await userEvent.click(submit());

    expect(saves.length).toBe(1);
    expect(saves[0].address.state).toBe('');
    expect(saves[0].address.country).toBe('United Kingdom');
  });

  it('says which fields are optional in words', async () => {
    await form();
    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    const county = screen.getByLabelText(/^County\b/);
    expect(county.closest('div')?.querySelector('label')?.textContent).toContain('(optional)');
  });

  it('does not render a postal code for a country that has none', async () => {
    // Hong Kong has no postal code. Absent, not present-and-optional: an empty
    // box with no rule behind it is a question nobody can answer.
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await form();
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    await userEvent.selectOptions(countrySelect(), 'Hong Kong');
    expect(maybeLabel('Postal code')).toBeNull();
    expect(maybeLabel('Postcode')).toBeNull();
    expect(label('District')).toBeTruthy();

    await userEvent.type(label('First name'), 'Ada');
    await userEvent.type(label('Last name'), 'Lovelace');
    await userEvent.type(label('Address'), '8 Queen’s Road');
    await userEvent.type(label('District'), 'Central');
    await userEvent.click(submit());

    expect(saves.length).toBe(1);
    expect(saves[0].address.postalCode).toBe('');
  });

  it('puts the postal code before the city where that is the order', async () => {
    const { fixture } = await form({ showLabelField: false });
    await userEvent.selectOptions(countrySelect(), 'Germany');

    const fields = renderedFields(fixture);
    expect(fields).toEqual([
      'First name', 'Last name', 'Address', 'Apartment, suite, etc.',
      'Postal code', 'City', 'Phone',
    ]);
    // Germany has no region field in a postal address at all.
    expect(maybeLabel('State')).toBeNull();
  });

  it('relabels the region rather than calling everything a state', async () => {
    await form();
    for (const [country, region] of [
      ['United States', 'State'],
      ['Canada', 'Province'],
      ['Japan', 'Prefecture'],
      ['United Arab Emirates', 'Emirate'],
    ] as const) {
      await userEvent.selectOptions(countrySelect(), country);
      expect(screen.getByLabelText(new RegExp(`^${region}\\b`))).toBeTruthy();
    }
  });

  it('offers a closed list where the subdivisions are a closed list', async () => {
    await form();
    await userEvent.selectOptions(countrySelect(), 'Australia');
    const state = screen.getByLabelText(/^State\b/) as HTMLSelectElement;
    expect(state.tagName).toBe('SELECT');
    expect([...state.options].map((o) => o.value)).toContain('New South Wales');
  });

  it('shows a number pad for an all-digit postal code and not otherwise', async () => {
    await form();
    await userEvent.selectOptions(countrySelect(), 'Germany');
    expect(label('Postal code').getAttribute('inputmode')).toBe('numeric');

    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    expect(label('Postcode').getAttribute('inputmode')).toBe('text');
  });

  it('keeps a stored address editable when its country is not in the list', async () => {
    // A record from an API can hold anything. Falling back to the generic schema
    // means every field is offered and none is demanded — an unrecognised
    // country must not make the address impossible to correct.
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await form({
      value: {
        firstName: 'Ada', lastName: 'Lovelace', line1: '1 High Street',
        city: 'Valletta', state: '', postalCode: '', country: 'Malta',
      },
    });
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    fixture.componentInstance.onSubmit(new Event('submit'));
    expect(saves.length).toBe(1);
    expect(saves[0].address.country).toBe('Malta');
  });
});

describe('resolveAddressSchema', () => {
  it('matches on the stored country name', () => {
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, 'United Kingdom')?.code).toBe('GB');
  });

  it('matches on the ISO code, because records often hold that instead', () => {
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, 'GB')?.name).toBe('United Kingdom');
  });

  it('ignores case and surrounding space', () => {
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, '  united kingdom ')?.code).toBe('GB');
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, 'gb')?.code).toBe('GB');
  });

  it('has nothing to say about an empty or unknown country', () => {
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, '')).toBeNull();
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, '   ')).toBeNull();
    expect(resolveAddressSchema(DEFAULT_ADDRESS_SCHEMAS, 'Malta')).toBeNull();
  });

  it('prefers a name match over a code match', () => {
    const schemas = [
      { code: 'XX', name: 'Nowhere', fields: [] },
      { code: 'Nowhere', name: 'Somewhere', fields: [] },
    ];
    expect(resolveAddressSchema(schemas, 'Nowhere')?.code).toBe('XX');
  });
});

describe('SvAddressFormComponent — switching country', () => {
  it('does not ship a field the new country does not have', async () => {
    // ★ The value is still in the signal. Germany has no region, so sending it
    //   would store a state against an address that has none — and the card
    //   would print it.
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await form();
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    await userEvent.type(label('County'), 'Kent');
    await userEvent.selectOptions(countrySelect(), 'Germany');
    await userEvent.type(label('First name'), 'Ada');
    await userEvent.type(label('Last name'), 'Lovelace');
    await userEvent.type(label('Address'), 'Torstraße 1');
    await userEvent.type(label('Postal code'), '10119');
    await userEvent.type(label('City'), 'Berlin');
    await userEvent.click(submit());

    expect(saves.length).toBe(1);
    expect(saves[0].address.state).toBe('');
  });

  it('does not carry a typed value into whatever field takes that slot', async () => {
    // `track field.name`, not `$index`. Under index tracking the County input
    // becomes the Postal code input when the country changes, keeping its value.
    await form();
    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    await userEvent.type(label('County'), 'Kent');
    await userEvent.selectOptions(countrySelect(), 'Germany');

    expect(label('Postal code').value).toBe('');
    expect(label('City').value).toBe('');
  });

  it('keeps the fields both countries share', async () => {
    await form();
    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    await userEvent.type(label('First name'), 'Ada');
    await userEvent.type(label('Town or city'), 'London');
    await userEvent.selectOptions(countrySelect(), 'United States');

    expect(label('First name').value).toBe('Ada');
    expect(label('City').value).toBe('London');
  });

  it('says the country changed, so the host can re-verify the new shape', async () => {
    const seen: string[] = [];
    const { fixture } = await form();
    fixture.componentInstance.countryChange.subscribe((c) => seen.push(c));

    await userEvent.selectOptions(countrySelect(), 'Japan');
    expect(seen).toEqual(['Japan']);
  });

  it('re-asks for what the new country requires and not the old', async () => {
    const { fixture } = await form();
    await userEvent.selectOptions(countrySelect(), 'United Kingdom');
    await userEvent.click(submit());
    // Postcode is required in the UK; county is not.
    expect(fixture.componentInstance.errorFor('postalCode')).toBe('Required');
    expect(fixture.componentInstance.errorFor('state')).toBe('');

    await userEvent.selectOptions(countrySelect(), 'Hong Kong');
    fixture.detectChanges();
    // Hong Kong has no postal code field, so there is nothing to require.
    expect(fixture.componentInstance.errorFor('postalCode')).toBe('');
    expect(fixture.componentInstance.errorFor('state')).toBe('Required');
  });
});

// ─── Form: verification is advisory ───────────────────────────────────────────

const ALL_STATUSES: readonly AddressVerificationStatus[] = [
  'unverified', 'verifying', 'verified', 'corrected', 'unavailable', 'failed',
];

describe('SvAddressFormComponent — verification never blocks', () => {
  it('leaves submit enabled in every state, unavailable included', async () => {
    // ★ A verifier is a third party that times out. A form that treats "we
    //   could not check" as "this is wrong" stops taking good addresses the
    //   moment somebody else has an outage.
    for (const status of ALL_STATUSES) {
      const { fixture } = await form({ verification: { status } });
      fixture.detectChanges();
      expect((submit() as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('saves an unverified address, and says that is what it is', async () => {
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await form({ verification: { status: 'unavailable' } });
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    await userEvent.selectOptions(countrySelect(), 'Germany');
    await userEvent.type(label('First name'), 'Ada');
    await userEvent.type(label('Last name'), 'Lovelace');
    await userEvent.type(label('Address'), 'Torstraße 1');
    await userEvent.type(label('Postal code'), '10119');
    await userEvent.type(label('City'), 'Berlin');
    await userEvent.click(submit());

    expect(saves.length).toBe(1);
    expect(saves[0].verification).toBe('unavailable');
  });

  it('says nothing at all before anything has been checked', async () => {
    const { fixture } = await form();
    expect(fixture.componentInstance.showVerification()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-sv-verification]')).toBeNull();
  });

  it('announces politely rather than interrupting mid-field', async () => {
    const { fixture } = await form({ verification: { status: 'verified' } });
    const strip = (fixture.nativeElement as HTMLElement)
      .querySelector('[data-sv-verification]');
    const region = strip?.closest('[aria-live]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(strip?.getAttribute('role')).toBeNull();
  });

  // DD-39-I3: a region inserted together with its first message is usually not
  // announced, so the live region exists before any verdict and only its content
  // is conditional.
  it('keeps the live region in the DOM before any verdict, and fills it in place', async () => {
    const { fixture } = await form();
    const root = fixture.nativeElement as HTMLElement;
    const region = root.querySelector('[data-sv-verification-region]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('polite');
    expect(region!.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('verification', { status: 'verified' });
    fixture.detectChanges();
    expect(root.querySelector('[data-sv-verification-region]')).toBe(region);
    expect(region!.querySelector('[data-sv-verification]')).not.toBeNull();
    expect(region!.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('marks a check in flight as busy', async () => {
    const { fixture } = await form({ verification: { status: 'verifying' } });
    const strip = (fixture.nativeElement as HTMLElement)
      .querySelector('[data-sv-verification]');
    expect(strip?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Checking this address…')).toBeTruthy();
  });

  it("has wording for every state, and takes the host's instead", async () => {
    for (const status of ALL_STATUSES.filter((s) => s !== 'unverified')) {
      const { fixture } = await form({ verification: { status } });
      expect(fixture.componentInstance.verificationMessage().length).toBeGreaterThan(0);
    }
    await form({ verification: { status: 'failed', message: 'Nem találjuk ezt a címet.' } });
    expect(screen.getByText('Nem találjuk ezt a címet.')).toBeTruthy();
  });

  it('tells an outage apart from a rejection by tone', async () => {
    const { fixture: outage } = await form({ verification: { status: 'unavailable' } });
    const { fixture: rejected } = await form({ verification: { status: 'failed' } });
    expect(outage.componentInstance.verificationClass()).toContain('warning');
    expect(rejected.componentInstance.verificationClass()).toContain('danger');
  });

  it('offers the corrected address, and fills it in on request', async () => {
    const suggestion: Address = {
      firstName: 'Ada', lastName: 'Lovelace',
      line1: '12 Bishop Street', city: 'London', state: 'Greater London',
      postalCode: 'EC1A 1BB', country: 'United Kingdom',
    };
    const applied: Address[] = [];
    const { fixture } = await form({
      verification: { status: 'corrected', suggestion },
    });
    fixture.componentInstance.suggestionApplied.subscribe((a) => applied.push(a));

    expect(screen.getByText('EC1A 1BB', { exact: false })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Use this address' }));

    expect(fixture.componentInstance.line1()).toBe('12 Bishop Street');
    expect(fixture.componentInstance.country()).toBe('United Kingdom');
    expect(applied).toEqual([suggestion]);
  });

  it('offers nothing to apply when there is no suggestion to apply', async () => {
    const { fixture } = await form({ verification: { status: 'corrected' } });
    expect(fixture.componentInstance.suggestionLines()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Use this address' })).toBeNull();
  });

  it('will not submit twice while the first one is still in flight', async () => {
    const saves: AddressSaveEvent[] = [];
    const { fixture } = await form({
      saving: true,
      value: {
        firstName: 'Ada', lastName: 'Lovelace', line1: '12 Bishop Street',
        city: 'London', state: '', postalCode: 'EC1A 1BB',
        country: 'United Kingdom',
      },
    });
    fixture.componentInstance.save.subscribe((e) => saves.push(e));

    fixture.componentInstance.onSubmit(new Event('submit'));
    expect(saves).toEqual([]);
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
  });
});

// ─── Card: removing the default is a different question ───────────────────────

const HOME: Address = {
  id: 'a1', label: 'Home', firstName: 'Sazzad', lastName: 'Hossain',
  line1: '12 Bishop Street', city: 'Dhaka', state: 'Dhaka',
  postalCode: '1207', country: 'Bangladesh', isDefault: true,
};
const WORK: Address = {
  id: 'a2', label: 'Work', firstName: 'Sazzad', lastName: 'Hossain',
  line1: '90 Gulshan Avenue', city: 'Dhaka', state: 'Dhaka',
  postalCode: '1212', country: 'Bangladesh',
};
const STORE: Address = {
  id: 'a3', label: 'Store', firstName: 'Sazzad', lastName: 'Hossain',
  line1: '5 Mirpur Road', city: 'Dhaka', state: 'Dhaka',
  postalCode: '1216', country: 'Bangladesh',
};

async function card(inputs: Partial<ComponentInput<SvAddressCardComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAddressCardComponent, {
    inputs: { address: HOME, ...inputs } as ComponentInput<SvAddressCardComponent>,
  });
}

const trash = () => screen.getByRole('button', { name: 'Remove address' });
const confirm = () => screen.getByRole('button', { name: 'Remove' });

describe('SvAddressCardComponent — removing the default address', () => {
  it('asks a different question when the address is the default one', async () => {
    await card({ defaultCandidates: [WORK] });
    await userEvent.click(trash());
    expect(screen.getByText('Remove your default address?')).toBeTruthy();
    expect(screen.queryByText('Remove this address?')).toBeNull();
  });

  it('asks the ordinary question when it is not', async () => {
    await card({ address: WORK, defaultCandidates: [HOME] });
    await userEvent.click(trash());
    expect(screen.getByText('Remove this address?')).toBeTruthy();
    expect(screen.queryByLabelText('Make this the new default')).toBeNull();
  });

  it('offers the successor as a choice, preselected', async () => {
    // An unselected dropdown that quietly means "no new default" is the same
    // trap the whole input is here to close.
    const seen: AddressActionEvent[] = [];
    const { fixture } = await card({ defaultCandidates: [WORK, STORE] });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(trash());
    const select = screen.getByLabelText('Make this the new default') as HTMLSelectElement;
    expect(select.value).toBe('a2');

    await userEvent.click(confirm());
    expect(seen.length).toBe(1);
    expect(seen[0].wasDefault).toBe(true);
    expect(seen[0].nextDefaultId).toBe('a2');
  });

  it('sends the successor that was actually chosen', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await card({ defaultCandidates: [WORK, STORE] });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(trash());
    await userEvent.selectOptions(
      screen.getByLabelText('Make this the new default'),
      'a3',
    );
    await userEvent.click(confirm());
    expect(seen[0].nextDefaultId).toBe('a3');
  });

  it('describes each candidate well enough to tell them apart', async () => {
    const { fixture } = await card({ defaultCandidates: [WORK] });
    expect(fixture.componentInstance.candidateLabel(WORK))
      .toBe('Work · Sazzad Hossain · 90 Gulshan Avenue');
  });

  it('says out loud when there will be no default left', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await card();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(trash());
    expect(screen.getByText('You will be left with no default address.')).toBeTruthy();
    expect(screen.queryByLabelText('Make this the new default')).toBeNull();

    await userEvent.click(confirm());
    expect(seen[0].wasDefault).toBe(true);
    expect(seen[0].nextDefaultId).toBeUndefined();
  });

  it('never offers this address as its own successor', async () => {
    const { fixture } = await card({ defaultCandidates: [HOME, WORK] });
    expect(fixture.componentInstance.promotable().map((a) => a.id)).toEqual(['a2']);
  });

  it('skips a candidate with no id, since there is nothing to send', async () => {
    const { fixture } = await card({
      defaultCandidates: [{ ...WORK, id: undefined }, STORE],
    });
    expect(fixture.componentInstance.promotable().map((a) => a.id)).toEqual(['a3']);
  });

  it('ignores candidates entirely when this address is not the default', async () => {
    const { fixture } = await card({ address: WORK, defaultCandidates: [HOME, STORE] });
    expect(fixture.componentInstance.promotable()).toEqual([]);
    expect(fixture.componentInstance.losingDefault()).toBe(false);
  });

  it('reports what was true at the moment of the action, not afterwards', async () => {
    // The host may have dropped the record by the time it handles the event, so
    // `wasDefault` travels with it rather than being re-derived.
    const seen: AddressActionEvent[] = [];
    // Candidates ARE supplied here. A non-default removal must still report no
    // successor: a host that reassigns `isDefault` on whatever comes back would
    // otherwise strip the badge off the address that still holds it.
    const { fixture } = await card({ address: WORK, defaultCandidates: [HOME, STORE] });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(trash());
    await userEvent.click(confirm());
    expect(seen[0].wasDefault).toBe(false);
    expect(seen[0].nextDefaultId).toBeUndefined();
  });

  it('carries the same detail on set-default', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await card({ address: WORK });
    fixture.componentInstance.setDefault.subscribe((e) => seen.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Set as default' }));
    expect(seen[0].wasDefault).toBe(false);
    expect(seen[0].requestKey).toBeTruthy();
  });

  it('gives two cards on one page different ids for the successor select', async () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const { fixture: a } = await card({ defaultCandidates: [WORK] });
    const b = TestBed.createComponent(SvAddressCardComponent);
    b.componentRef.setInput('address', HOME);
    b.componentRef.setInput('defaultCandidates', [WORK]);
    b.detectChanges();
    await b.whenStable();
    expect(a.componentInstance.successorId()).not.toBe(b.componentInstance.successorId());
  });

  it('keeps a chosen successor across an unrelated candidate change', async () => {
    const { fixture } = await card({ defaultCandidates: [WORK, STORE] });
    fixture.componentInstance.nextDefaultId.set('a3');
    fixture.componentRef.setInput('defaultCandidates', [STORE, WORK]);
    fixture.detectChanges();
    expect(fixture.componentInstance.nextDefaultId()).toBe('a3');
  });

  it('re-seeds when the chosen successor is no longer a candidate', async () => {
    const { fixture } = await card({ defaultCandidates: [WORK, STORE] });
    fixture.componentInstance.nextDefaultId.set('a3');
    fixture.componentRef.setInput('defaultCandidates', [WORK]);
    fixture.detectChanges();
    expect(fixture.componentInstance.nextDefaultId()).toBe('a2');
  });

  it('will not let a slow round-trip become two deletes', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await card({ saving: true, defaultCandidates: [WORK] });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    fixture.componentInstance.confirmRemoval();
    expect(seen).toEqual([]);
  });
});
