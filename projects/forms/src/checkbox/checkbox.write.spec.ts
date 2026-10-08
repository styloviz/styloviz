import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvCheckboxComponent, type SvCheckboxChange } from './checkbox.component';

/**
 * `X-6` — the pending / revert / error contract, on a checkbox.
 *
 * `X-6` named four controls. Toggle Switch and Inplace Edit adopted it; Rating
 * and Checkbox — "in a settings context, same shape, unstated" — did not, so a
 * settings list mixing switches and checkboxes had a way back for half its rows.
 * Same shape as `sv-toggle-switch`'s `toggle-switch.pending.spec.ts`.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvCheckboxComponent, {
    inputs: { label: 'Weekly digest', ...inputs },
  });
  return fixture;
}

const box = () => screen.getByRole('checkbox') as HTMLInputElement;

describe('SvCheckboxComponent — the write, and the way back', () => {
  it('emits a write alongside the plain change, in that order', async () => {
    const order: string[] = [];
    const f = await setup();
    f.componentInstance.changed.subscribe(() => order.push('changed'));
    f.componentInstance.changeRequest.subscribe(() => order.push('request'));

    await userEvent.click(box());

    expect(order).toEqual(['changed', 'request']);
  });

  it('applies the change first and carries a fresh idempotency key each time', async () => {
    const seen: SvCheckboxChange[] = [];
    const f = await setup();
    f.componentInstance.changeRequest.subscribe((e: SvCheckboxChange) => {
      expect(f.componentInstance.checked()).toBe(e.checked);
      seen.push(e);
    });

    await userEvent.click(box());
    await userEvent.click(box());

    expect(seen.map((e) => e.checked)).toEqual([true, false]);
    expect(seen[0].requestKey).toBeTruthy();
    expect(seen[0].requestKey).not.toBe(seen[1].requestKey);
  });

  it('puts the value back — in the DOM and the form model — when the write fails', async () => {
    let latest: SvCheckboxChange | null = null;
    const written: boolean[] = [];
    const f = await setup();
    f.componentInstance.registerOnChange((v) => written.push(v));
    f.componentInstance.changeRequest.subscribe((e: SvCheckboxChange) => (latest = e));

    await userEvent.click(box());
    expect(box().checked).toBe(true);

    latest!.rollback();
    f.detectChanges();

    expect(f.componentInstance.checked()).toBe(false);
    expect(box().checked).toBe(false);
    expect(written).toEqual([true, false]);
  });

  it('refuses a stale rollback rather than discarding a newer change', async () => {
    const handles: SvCheckboxChange[] = [];
    const f = await setup();
    f.componentInstance.changeRequest.subscribe((e: SvCheckboxChange) => handles.push(e));

    await userEvent.click(box()); // → true
    await userEvent.click(box()); // → false
    handles[0].rollback();        // would restore `false` from before the FIRST change
    f.detectChanges();

    expect(f.componentInstance.checked()).toBe(false);
    expect(handles).toHaveLength(2);
  });
});

describe('SvCheckboxComponent — pending', () => {
  it('holds the value while the write is out, without dimming or disabling it', async () => {
    const requests: SvCheckboxChange[] = [];
    const f = await setup({ checked: true, pending: true });
    f.componentInstance.changeRequest.subscribe((e: SvCheckboxChange) => requests.push(e));

    await userEvent.click(box());

    expect(requests).toHaveLength(0);
    expect(f.componentInstance.checked()).toBe(true);
    // The native box must not have flipped behind the signal's back.
    expect(box().checked).toBe(true);
    expect(box().disabled).toBe(false);
    expect(box().getAttribute('aria-busy')).toBe('true');
    const label = box().closest('label')!;
    expect(label.classList.contains('opacity-60')).toBe(false);
  });

  it('says nothing about being busy when it is not', async () => {
    await setup();
    expect(box().getAttribute('aria-busy')).toBeNull();
  });
});

describe('SvCheckboxComponent — a failed write', () => {
  it('renders the failure as an alert and describes the box by it', async () => {
    const f = await setup({ error: 'Could not save your preference.' });
    const alert = screen.getByRole('alert');
    expect(alert.textContent?.trim()).toBe('Could not save your preference.');
    expect(box().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    expect(f.componentInstance.writeErrorMessage()).toBe('Could not save your preference.');
  });

  it('accepts an SvDataError and survives the rollback that follows it', async () => {
    let latest: SvCheckboxChange | null = null;
    const f = await setup();
    f.componentInstance.changeRequest.subscribe((e: SvCheckboxChange) => (latest = e));
    await userEvent.click(box());

    latest!.rollback();
    f.componentRef.setInput('error', { message: 'Server said no.', status: 503 });
    f.detectChanges();

    // `serverError` would have expired here — the rollback changed the value.
    expect(screen.getByRole('alert').textContent?.trim()).toBe('Server said no.');
  });

  it('renders no alert when nothing failed', async () => {
    await setup();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
