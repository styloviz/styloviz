import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvCreateRequest } from '@styloviz/core/forms';
import { SvAutocompleteComponent, type AutocompleteOption } from './autocomplete.component';

/**
 * `FL-J3-FI-03` / `X-13` / `FI-01-M3` — "Create ‹query›" on the autocomplete:
 * an explicit option row, a typed `createRequest`, the pending entry.
 */
const OPTIONS: AutocompleteOption[] = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
];

afterEach(() => document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove()));

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const requests: SvCreateRequest[] = [];
  const { fixture } = await render(SvAutocompleteComponent, {
    inputs: { options: OPTIONS, creatable: true, ...inputs },
    on: { createRequest: (r: SvCreateRequest) => requests.push(r) },
  });
  const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  const key = (k: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    fixture.detectChanges();
  };
  return { fixture, c: fixture.componentInstance, input, type, key, requests };
}

const createRow = () => document.querySelector<HTMLElement>('.sv-ac-portal [data-sv-create="option"]');

describe('sv-autocomplete — create new (X-13)', () => {
  it('offers the Create row only when creatable and nothing is labelled the query', async () => {
    const off = await setup({ creatable: false });
    off.type('Grace Hopper');
    expect(createRow()).toBeNull();

    const s = await setup();
    s.type('ada lovelace');
    expect(createRow()).toBeNull();
    s.type('Grace Hopper');
    expect(createRow()).not.toBeNull();
    expect(createRow()!.getAttribute('role')).toBe('option');
    expect(createRow()!.textContent).toContain('Create “Grace Hopper”');
  });

  it('is the last stop for ↓/End, named by aria-activedescendant, and Enter creates', async () => {
    const s = await setup();
    s.type('Grace Hopper');
    s.key('End');
    expect(s.input.getAttribute('aria-activedescendant')).toBe(createRow()!.id);
    s.key('Enter');
    expect(s.requests).toHaveLength(1);
    expect(s.requests[0]).toEqual(expect.objectContaining({ label: 'Grace Hopper', value: 'Grace Hopper', awaited: false }));
    expect(s.c.value()).toBe('Grace Hopper');
    expect(s.c.open()).toBe(false);
  });

  it('resolve() swaps in the server id; reject() clears the field and shows why', async () => {
    const s = await setup();
    s.type('Grace Hopper');
    createRow()!.click();
    s.requests[0].resolve({ value: 'p_7' });
    s.fixture.detectChanges();
    expect(s.c.value()).toBe('p_7');
    expect(s.input.value).toBe('Grace Hopper');

    s.type('Linus');
    createRow()!.click();
    s.requests[1].reject('Name in use');
    s.fixture.detectChanges();
    expect(s.c.value()).toBe('');
    expect((s.fixture.nativeElement as HTMLElement).querySelector('[data-sv-create="failed"]')!.textContent)
      .toContain('Name in use');
  });

  it('awaitCreate: busy while the host saves, the value set only on resolve()', async () => {
    const s = await setup({ awaitCreate: true });
    s.type('Grace Hopper');
    createRow()!.click();
    s.fixture.detectChanges();
    expect(s.requests[0].awaited).toBe(true);
    expect(s.input.getAttribute('aria-busy')).toBe('true');
    expect(s.c.value()).toBe('Grace Hopper'); // the typed text, as an autocomplete always holds it
    expect((s.fixture.nativeElement as HTMLElement).querySelector('[data-sv-create="pending"]')).not.toBeNull();
    // No second create while one is in flight.
    s.type('Another');
    expect(createRow()).toBeNull();
    s.requests[0].resolve({ value: 'p_7', label: 'Grace Hopper' });
    s.fixture.detectChanges();
    expect(s.c.value()).toBe('p_7');
    expect(s.input.getAttribute('aria-busy')).toBeNull();
  });
});
