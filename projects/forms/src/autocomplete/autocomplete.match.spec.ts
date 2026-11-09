import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAutocompleteComponent, type AutocompleteOption } from './autocomplete.component';

/** `FL-J3-FI-08` / `FI-01-I4` / `FI-01-M2` — folded matching and a match mode. */
const PEOPLE: AutocompleteOption[] = [
  { value: 'p1', label: 'José Ramos' },
  { value: 'p2', label: 'Anna Müller' },
  { value: 'p3', label: 'Lovelace, Ada' },
  { value: 'p4', label: 'Canada Desk' },
  { value: 'p5', label: 'İlker Yılmaz' },
];

afterEach(() => document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove()));

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAutocompleteComponent, { inputs: { options: PEOPLE, ...inputs } });
  return fixture.componentInstance;
}

describe('sv-autocomplete — accent- and case-folded matching', () => {
  it('finds José from “jose” and Müller from “MULLER”', async () => {
    const c = await setup();
    c.query.set('jose');
    expect(c.filtered().map((o) => o.value)).toEqual(['p1']);
    c.query.set('MULLER');
    expect(c.filtered().map((o) => o.value)).toEqual(['p2']);
  });

  it('highlights the original characters, accent included', async () => {
    const c = await setup();
    c.query.set('jose');
    expect(c.highlightSegments('José Ramos').filter((s) => s.match).map((s) => s.text)).toEqual(['José']);
  });

  it('lower-cases in its locale — Turkish İ', async () => {
    const c = await setup({ locale: 'tr' });
    c.query.set('ilker');
    expect(c.filtered().map((o) => o.value)).toEqual(['p5']);
  });
});

describe('sv-autocomplete — match mode', () => {
  it('substring (default) matches inside a word', async () => {
    const c = await setup();
    c.query.set('ada');
    expect(c.filtered().map((o) => o.value)).toEqual(['p3', 'p4']);
  });

  it('prefix matches the start of a word only', async () => {
    const c = await setup({ match: 'prefix' });
    c.query.set('ada');
    expect(c.filtered().map((o) => o.value)).toEqual(['p3']);
    expect(c.highlightSegments('Canada Desk').some((s) => s.match)).toBe(false);
  });

  it('a host function decides on its own', async () => {
    const c = await setup({ match: (o: AutocompleteOption, q: string) => o.value === q });
    c.query.set('p4');
    expect(c.filtered().map((o) => o.value)).toEqual(['p4']);
  });

  it('serverSide shows the options as given, whatever the mode', async () => {
    const c = await setup({ serverSide: true, match: 'prefix' });
    c.query.set('zzz');
    expect(c.filtered().length).toBe(5);
  });
});
