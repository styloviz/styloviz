import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAddressCardComponent, type Address } from './address-card.component';

/**
 * X-12 — Remove hands the decision to the host, and nothing moved focus when
 * the card went. Focus must move to the next card, else the previous one, else
 * the list — never <body>. And the confirm strip, when it closes, gives focus
 * back to the trash button that opened it.
 */

const address = (id: string): Address => ({
  id,
  firstName: `First ${id}`,
  lastName: 'Last',
  line1: `${id} Bishop Street`,
  city: 'Dhaka',
  state: 'Dhaka',
  postalCode: '1207',
  country: 'Bangladesh',
});

@Component({
  standalone: true,
  imports: [SvAddressCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="book">
      @for (a of addresses(); track a.id) {
        <sv-address-card [address]="a" [confirmRemove]="confirmRemove()" (remove)="drop(a.id)" />
      }
    </div>
  `,
})
class AddressBookHost {
  readonly confirmRemove = input<boolean>(true);
  /** When false the host keeps the card — a failed delete. */
  readonly dropOnRemove = input<boolean>(true);
  readonly addresses = signal<Address[]>(['a', 'b', 'c'].map(address));

  drop(id: string | undefined): void {
    if (this.dropOnRemove()) this.addresses.update((all) => all.filter((a) => a.id !== id));
  }
}

async function setup(confirmRemove: boolean, ids?: string[], dropOnRemove = true) {
  TestBed.resetTestingModule();
  const { fixture } = await render(AddressBookHost, { inputs: { confirmRemove, dropOnRemove } });
  if (ids) {
    fixture.componentInstance.addresses.set(ids.map(address));
    fixture.detectChanges();
  }
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const card = (f: Fixture, id: string) =>
  Array.from(f.nativeElement.querySelectorAll('sv-address-card') as NodeListOf<HTMLElement>).find((c) =>
    c.textContent?.includes(`First ${id}`),
  ) ?? null;

const trash = (f: Fixture, id: string) => card(f, id)!.querySelector('[aria-label="Remove address"]') as HTMLButtonElement;

const stripButton = (f: Fixture, id: string, label: 'Remove' | 'Keep') =>
  Array.from(
    card(f, id)!.querySelectorAll('[aria-label="Confirm removing this address"] button') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.textContent?.trim() === label)!;

async function click(f: Fixture, el: HTMLElement): Promise<void> {
  el.focus();
  el.click();
  f.detectChanges();
  await f.whenStable();
  await Promise.resolve();
}

async function remove(f: Fixture, id: string, confirm: boolean): Promise<void> {
  await click(f, trash(f, id));
  if (confirm) await click(f, stripButton(f, id, 'Remove'));
}

describe('SvAddressCardComponent — focus after remove (X-12)', () => {
  it.each([true, false])('confirmRemove=%s: the next card takes focus when the host drops this one', async (confirm) => {
    const f = await setup(confirm);
    await remove(f, 'b', confirm);
    expect(card(f, 'b')).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(card(f, 'c')!.contains(document.activeElement)).toBe(true);
  });

  it.each([true, false])('confirmRemove=%s: the previous card takes focus when the last one goes', async (confirm) => {
    const f = await setup(confirm);
    await remove(f, 'c', confirm);
    expect(card(f, 'b')!.contains(document.activeElement)).toBe(true);
  });

  it.each([true, false])('confirmRemove=%s: the list takes focus when the only card goes — never <body>', async (confirm) => {
    const f = await setup(confirm, ['a']);
    await remove(f, 'a', confirm);
    expect(document.activeElement).toBe(f.nativeElement.querySelector('[data-testid="book"]'));
  });

  it('"Keep" gives focus back to the trash button', async () => {
    const f = await setup(true);
    await click(f, trash(f, 'a'));
    await click(f, stripButton(f, 'a', 'Keep'));
    expect(document.activeElement).toBe(trash(f, 'a'));
  });

  it('a delete the host does not apply leaves focus on the trash button', async () => {
    const f = await setup(true, undefined, false);
    await remove(f, 'a', true);
    expect(card(f, 'a')).not.toBeNull();
    expect(document.activeElement).toBe(trash(f, 'a'));
  });
});
