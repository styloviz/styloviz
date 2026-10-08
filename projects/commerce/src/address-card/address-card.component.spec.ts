import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvAddressCardComponent,
  type Address,
  type AddressActionEvent,
} from './address-card.component';

/**
 * The card has two lives. As a display it is a block of text with actions; as a
 * checkout picker the whole card becomes a radio. The second is where the
 * hazard is — `role="radio"` may not contain other controls, so the edit and
 * remove buttons have to disappear when it does, or a keyboard user finds
 * buttons inside a radio that a screen reader will not offer them.
 */

const ADDRESS: Address = {
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
};

async function setup(inputs: Partial<ComponentInput<SvAddressCardComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAddressCardComponent, {
    inputs: { address: ADDRESS, ...inputs } as ComponentInput<SvAddressCardComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const card = (f: { nativeElement: unknown }) => el(f).firstElementChild as HTMLElement;

describe('SvAddressCardComponent — what it shows', () => {
  it('joins the recipient into one name', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.fullName()).toBe('Sazzad Hossain');
    expect(el(fixture).textContent).toContain('Sazzad Hossain');
  });

  it('assembles the city line the way an envelope reads', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.cityLine()).toBe('Dhaka, Dhaka 1207');
  });

  it('leaves out the parts an address does not have', async () => {
    const { fixture } = await setup({
      address: { ...ADDRESS, state: '', postalCode: '' },
    });
    expect(fixture.componentInstance.cityLine()).toBe('Dhaka');
  });

  it('names the kind of address it is', async () => {
    for (const [kind, label] of [
      ['shipping', 'Shipping'],
      ['billing', 'Billing'],
      ['both', 'Shipping & billing'],
    ] as const) {
      const { fixture } = await setup({ address: { ...ADDRESS, kind } });
      expect(fixture.componentInstance.kindLabel()).toBe(label);
    }

    const { fixture: none } = await setup();
    expect(none.componentInstance.kindLabel()).toBe('');
  });

  it('marks the default address', async () => {
    const { fixture: plain } = await setup();
    expect(plain.componentInstance.isDefault()).toBe(false);

    const { fixture } = await setup({ address: { ...ADDRESS, isDefault: true } });
    expect(fixture.componentInstance.isDefault()).toBe(true);
    expect(el(fixture).textContent).toContain('Default');
  });
});

describe('SvAddressCardComponent — as a display', () => {
  it('claims no interactive role at all', async () => {
    const { fixture } = await setup();
    const root = card(fixture);
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('tabindex')).toBeNull();
    expect(root.getAttribute('aria-checked')).toBeNull();
  });

  it('ignores a click', async () => {
    let picks = 0;
    const { fixture } = await setup();
    fixture.componentInstance.addressSelected.subscribe(() => { picks += 1; });

    await userEvent.click(card(fixture));
    expect(picks).toBe(0);
  });

  it('offers edit and remove, each named', async () => {
    let edits = 0;
    let removes = 0;
    const { fixture } = await setup();
    fixture.componentInstance.edit.subscribe(() => { edits += 1; });
    fixture.componentInstance.remove.subscribe(() => { removes += 1; });

    await userEvent.click(screen.getByRole('button', { name: 'Edit address' }));
    // Remove asks first — see the two-step delete below.
    await userEvent.click(screen.getByRole('button', { name: 'Remove address' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect([edits, removes]).toEqual([1, 1]);
  });

  it('drops the actions the host does not want', async () => {
    await setup({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Edit address' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove address' })).toBeTruthy();

    await setup({ showActions: false });
    expect(screen.queryByRole('button', { name: 'Remove address' })).toBeNull();
  });

  it('offers to make it the default, unless it already is', async () => {
    let calls = 0;
    const { fixture } = await setup();
    fixture.componentInstance.setDefault.subscribe(() => { calls += 1; });
    expect(fixture.componentInstance.showSetDefault()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Set as default/i }));
    expect(calls).toBe(1);

    const { fixture: already } = await setup({ address: { ...ADDRESS, isDefault: true } });
    expect(already.componentInstance.showSetDefault()).toBe(false);
  });
});

describe('SvAddressCardComponent — as a picker', () => {
  it('becomes a radio the whole card answers for', async () => {
    const { fixture } = await setup({ selectable: true });
    const root = card(fixture);
    expect(root.getAttribute('role')).toBe('radio');
    expect(root.getAttribute('aria-checked')).toBe('false');
    expect(root.getAttribute('tabindex')).toBe('0');
    expect(root.getAttribute('aria-label')).toBe('Select address for Sazzad Hossain');
  });

  it('shows the selection the parent gave it', async () => {
    const { fixture } = await setup({ selectable: true, selected: true });
    expect(card(fixture).getAttribute('aria-checked')).toBe('true');
  });

  it('reports the whole address when chosen', async () => {
    const chosen: Address[] = [];
    const { fixture } = await setup({ selectable: true });
    fixture.componentInstance.addressSelected.subscribe((a) => chosen.push(a));

    await userEvent.click(card(fixture));
    expect(chosen).toEqual([ADDRESS]);
  });

  it('is choosable from the keyboard, and swallows the key', async () => {
    const chosen: Address[] = [];
    const { fixture } = await setup({ selectable: true });
    fixture.componentInstance.addressSelected.subscribe((a) => chosen.push(a));

    for (const key of ['Enter', ' ']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      card(fixture).dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    expect(chosen.length).toBe(2);
  });

  it('puts no other control inside the radio', async () => {
    // A radio may not contain interactive descendants: a screen reader will not
    // offer them, and they steal the tab stop from the radio itself.
    const { fixture } = await setup({ selectable: true, showActions: true });
    expect(card(fixture).querySelectorAll('button').length).toBe(0);
    expect(fixture.componentInstance.showSetDefault()).toBe(false);
  });
});

/**
 * ============================================================================
 *  Writes against one address
 * ============================================================================
 *
 * Deleting a saved address and moving the default flag are both server writes,
 * and this card renders ONE address out of a book the host owns — so there is no
 * `rollback()` to hand back, and nothing is applied optimistically. What the card
 * owes instead: an idempotency key so a retry cannot delete twice, a confirmation
 * before the irreversible half, a lock while the request is out, and somewhere
 * for the failure to appear.
 */
describe('SvAddressCardComponent — writes it cannot undo', () => {
  it('asks before deleting, and only then reports it', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Remove address' }));
    expect(seen).toEqual([]);
    expect(screen.getByRole('group', { name: /Confirm removing/i })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(seen).toHaveLength(1);
    expect(seen[0].address).toEqual(ADDRESS);
    expect(seen[0].requestKey).toBeTruthy();
  });

  it('withdraws the question on Keep, and on a second press of the ×', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await setup();
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));
    const trash = screen.getByRole('button', { name: 'Remove address' });

    await userEvent.click(trash);
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('group', { name: /Confirm removing/i })).toBeNull();

    await userEvent.click(trash);
    await userEvent.click(trash);
    expect(screen.queryByRole('group', { name: /Confirm removing/i })).toBeNull();
    expect(seen).toEqual([]);
  });

  it('tells assistive tech whether the question is up', async () => {
    await setup();
    const trash = screen.getByRole('button', { name: 'Remove address' });
    expect(trash.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(trash);
    expect(trash.getAttribute('aria-expanded')).toBe('true');
  });

  /** For hosts that run their own dialog — the card must not ask twice. */
  it('goes straight through when the host confirms for itself', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await setup({ confirmRemove: false });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));

    await userEvent.click(screen.getByRole('button', { name: 'Remove address' }));

    expect(seen).toHaveLength(1);
    expect(screen.queryByRole('group', { name: /Confirm removing/i })).toBeNull();
  });

  it('gives every write its own request key', async () => {
    const keys: string[] = [];
    const { fixture } = await setup({ confirmRemove: false });
    fixture.componentInstance.remove.subscribe((e) => keys.push(e.requestKey));
    fixture.componentInstance.setDefault.subscribe((e) => keys.push(e.requestKey));

    await userEvent.click(screen.getByRole('button', { name: 'Remove address' }));
    await userEvent.click(screen.getByRole('button', { name: /Set as default/i }));

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('locks every action while a write is in flight', async () => {
    const seen: AddressActionEvent[] = [];
    const { fixture } = await setup({ saving: true, confirmRemove: false });
    fixture.componentInstance.remove.subscribe((e) => seen.push(e));
    fixture.componentInstance.setDefault.subscribe((e) => seen.push(e));

    for (const name of ['Edit address', 'Remove address', /Set as default/i]) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Remove address' }).getAttribute('aria-busy'))
      .toBe('true');

    fixture.componentInstance.onRemove();
    fixture.componentInstance.onSetDefault();
    expect(seen).toEqual([]);
  });

  it('leaves aria-busy off when nothing is in flight', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Remove address' }).getAttribute('aria-busy'))
      .toBeNull();
  });

  it('reports a failed write on a card that has not changed', async () => {
    const { fixture } = await setup({ actionError: 'Could not delete that address.' });

    const alert = el(fixture).querySelector('[data-sv-state="action-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Could not delete that address.');
    // The address is still on screen — the host never took it out.
    expect(el(fixture).textContent).toContain('12 Bishop Street');
  });

  it('reads a structured error as well as a string', async () => {
    const { fixture } = await setup({ actionError: { message: 'Conflict', status: 409 } });
    expect(el(fixture).querySelector('[data-sv-state="action-error"]')?.textContent)
      .toContain('Conflict');
  });

  it('says nothing when nothing failed', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('[data-sv-state="action-error"]')).toBeNull();
  });
});

// X-14: optional partial masking for a shared screen or a support view.
describe('SvAddressCardComponent — maskLevel', () => {
  const text = (f: { nativeElement: unknown }) => el(f).textContent?.replace(/\s+/g, ' ') ?? '';

  it("prints everything by default ('none')", async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.maskLevel()).toBe('none');
    expect(text(fixture)).toContain('12 Bishop Street');
    expect(text(fixture)).toContain('Flat 4');
    expect(text(fixture)).toContain('1207');
    expect(text(fixture)).toContain('+880 1700 000000');
  });

  it.each([false, true])("masks house number, inward postcode and phone under 'partial' (selectable: %s)", async (selectable) => {
    const { fixture } = await setup({ maskLevel: 'partial', selectable });
    const t = text(fixture);
    expect(t).toContain('•• Bishop Street');
    expect(t).toContain('Flat •');
    expect(t).toContain('Dhaka, Dhaka 12••');
    expect(t).toContain('+••• •••• ••0000');
    expect(t).not.toContain('12 Bishop');
    expect(t).not.toContain('1207');
    // Country and street name stay legible so the person can tell addresses apart.
    expect(t).toContain('Bangladesh');
  });

  it('keeps the outward half of a UK postcode', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAddressCardComponent, {
      inputs: {
        address: { ...ADDRESS, line1: '221B Baker Street', postalCode: 'NW1 6XE', city: 'London', state: '' },
        maskLevel: 'partial',
      },
    });
    const t = text(fixture);
    expect(t).toContain('•••• Baker Street');
    expect(t).toContain('London NW1 •••');
  });
});
