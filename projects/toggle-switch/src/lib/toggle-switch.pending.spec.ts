import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvToggleSwitchComponent, type SvToggleChange } from './toggle-switch.component';

/**
 * `X-6` / `FI-29-I1` / `FI-29-M1` / `FI-29-M2` — the pending / revert / lock
 * contract.
 *
 * A switch that silently flips back three seconds later is the defining trust
 * failure of a settings screen. It happens because the component has no
 * vocabulary for "the write is out" and the host has no handle to undo with —
 * so these tests are about the two halves of that, plus the third state a
 * disabled switch cannot express: *why* it will not move.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToggleSwitchComponent, {
    inputs: { label: 'Notifications', ...inputs },
  });
  return fixture;
}

const sw = (): HTMLElement => screen.getByRole('switch');

describe('SvToggleSwitchComponent — the write, and the way back', () => {
  it('emits a write alongside the plain toggle, in that order', async () => {
    const order: string[] = [];
    const f = await setup();
    f.componentInstance.toggled.subscribe(() => order.push('toggled'));
    f.componentInstance.toggleRequest.subscribe(() => order.push('request'));

    await userEvent.click(sw());

    // Additive, not a replacement: a switch writing only to local state has no
    // use for a request key, and must not have to accept one to keep working.
    expect(order).toEqual(['toggled', 'request']);
  });

  it('applies the change before it tells anyone, and carries an idempotency key', async () => {
    let seen: SvToggleChange | null = null;
    const f = await setup();
    f.componentInstance.toggleRequest.subscribe((e: SvToggleChange) => {
      seen = e;
      // Already applied by the time the host hears about it. A switch that
      // waits for a round-trip before moving reads as broken.
      expect(f.componentInstance.checked()).toBe(true);
    });

    await userEvent.click(sw());

    expect(seen!.checked).toBe(true);
    expect(seen!.requestKey).toBeTruthy();
    expect(typeof seen!.rollback).toBe('function');
  });

  it('gives every write its own key', async () => {
    const keys: string[] = [];
    const f = await setup();
    f.componentInstance.toggleRequest.subscribe((e: SvToggleChange) => keys.push(e.requestKey));

    await userEvent.click(sw());
    f.componentInstance.checked.set(false);
    f.detectChanges();
    await userEvent.click(sw());

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('puts the value back when the write fails', async () => {
    let latest: SvToggleChange | null = null;
    const f = await setup();
    f.componentInstance.toggleRequest.subscribe((e: SvToggleChange) => (latest = e));

    await userEvent.click(sw());
    expect(f.componentInstance.checked()).toBe(true);

    latest!.rollback();
    f.detectChanges();

    expect(f.componentInstance.checked()).toBe(false);
    expect(sw().getAttribute('aria-checked')).toBe('false');
  });

  /**
   * The reason `pending` is a lock and not just a spinner. Restoring a value
   * from before the user's newer change would throw that change away, and
   * nothing would report it.
   */
  it('refuses a rollback the user has already superseded', async () => {
    const seen: SvToggleChange[] = [];
    const f = await setup();
    f.componentInstance.toggleRequest.subscribe((e: SvToggleChange) => seen.push(e));

    await userEvent.click(sw()); // on
    await userEvent.click(sw()); // off — supersedes the first write

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    seen[0].rollback();
    f.detectChanges();

    expect(f.componentInstance.checked()).toBe(false); // the newer state stands
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('SvToggleSwitchComponent — pending is not loading', () => {
  it('locks the switch and reports itself busy while a write is out', async () => {
    const spy = vi.fn();
    const f = await setup({ pending: true });
    f.componentInstance.toggleRequest.subscribe(spy);

    await userEvent.click(sw());

    expect(spy).not.toHaveBeenCalled();
    expect(f.componentInstance.checked()).toBe(false);
    expect(sw().getAttribute('aria-busy')).toBe('true');
    expect(sw().getAttribute('aria-disabled')).toBe('true');
  });

  it('shows the spinner for pending as well as loading', async () => {
    const pending = await setup({ pending: true });
    expect(pending.nativeElement.querySelector('sv-spinner-arc')).not.toBeNull();

    const loading = await setup({ loading: true });
    expect(loading.nativeElement.querySelector('sv-spinner-arc')).not.toBeNull();
  });

  /**
   * The one visible difference, and the reason they are two inputs. `loading`
   * means the value is unknown, so dimming it is honest. `pending` means the
   * value on screen is exactly what the user chose — fading it reads as "this
   * did not take", which is the failure the whole contract exists to prevent.
   */
  it('does not dim a value the user just chose', async () => {
    const pending = await setup({ pending: true });
    const group = pending.nativeElement.querySelector('[role="group"]') as HTMLElement;
    expect(group.className).not.toContain('opacity-60');
    expect(group.className).toContain('cursor-progress');

    const loading = await setup({ loading: true });
    const dimmed = loading.nativeElement.querySelector('[role="group"]') as HTMLElement;
    expect(dimmed.className).toContain('opacity-60');
  });
});

describe('SvToggleSwitchComponent — saying the write failed', () => {
  it('reports the failure as an alert, beside the control', async () => {
    const f = await setup({ error: 'Could not save that. Try again.' });

    const msg = f.nativeElement.querySelector('[data-sv-state="error"]') as HTMLElement;
    expect(msg.textContent!.trim()).toBe('Could not save that. Try again.');
    expect(msg.getAttribute('role')).toBe('alert');
    expect(sw().getAttribute('aria-describedby')).toContain(msg.id);
  });

  it('normalizes an SvDataError the same as a string', async () => {
    const f = await setup({ error: { message: 'Network unreachable', retryable: true } });
    expect(f.componentInstance.writeErrorMessage()).toBe('Network unreachable');
  });

  /**
   * The bug `check:optimistic-writes` caught before this shipped. `serverError`
   * is the field-error contract and self-expires on the next value change — and
   * a rollback IS a value change, so a failure routed through it would clear in
   * the same tick the switch moved back. The user would watch it revert and be
   * told nothing, which is the exact failure the contract exists to prevent.
   */
  it('survives the rollback that caused it', async () => {
    let latest: SvToggleChange | null = null;
    const f = await setup();
    f.componentInstance.toggleRequest.subscribe((e: SvToggleChange) => (latest = e));

    await userEvent.click(sw());
    f.componentRef.setInput('error', 'Could not save that.');
    latest!.rollback();
    f.detectChanges();

    expect(f.componentInstance.checked()).toBe(false);
    expect(f.nativeElement.querySelector('[data-sv-state="error"]')).not.toBeNull();
  });

  it('says nothing at all when the write succeeded', async () => {
    const f = await setup();
    expect(f.nativeElement.querySelector('[data-sv-state="error"]')).toBeNull();
  });
});

describe('SvToggleSwitchComponent — a lock that says why', () => {
  it('renders the reason and points aria-describedby at it', async () => {
    const f = await setup({ lockReason: 'Enforced by your organization' });

    const reason = f.nativeElement.querySelector('[data-sv-state="locked"]') as HTMLElement;
    expect(reason.textContent!.trim()).toBe('Enforced by your organization');
    expect(sw().getAttribute('aria-describedby')).toContain(reason.id);
  });

  it('refuses the toggle, and says so rather than only looking dead', async () => {
    const spy = vi.fn();
    const f = await setup({ lockReason: 'Your plan does not include this' });
    f.componentInstance.toggled.subscribe(spy);

    await userEvent.click(sw());

    expect(spy).not.toHaveBeenCalled();
    expect(f.componentInstance.checked()).toBe(false);
    expect(sw().getAttribute('aria-disabled')).toBe('true');
  });

  /**
   * A locked switch stays in the tab order on purpose. `tabindex="-1"` would
   * make the explanation unreachable by the readers most likely to need it.
   */
  it('stays focusable, so the reason can be read', async () => {
    await setup({ lockReason: 'Enforced by your organization' });
    expect(sw().getAttribute('tabindex')).toBe('0');
  });

  /**
   * Re-verified 2026-09-26: `tabindex` followed `disabled` alone, so the most
   * natural way to write a locked setting — `[disabled]` PLUS the reason, or a
   * disabled form control plus the reason — put the explanation on a control
   * nobody could tab to.
   */
  it('stays focusable when it is ALSO disabled, and still refuses the toggle', async () => {
    const spy = vi.fn();
    const f = await setup({ disabled: true, lockReason: 'Enforced by your organization' });
    f.componentInstance.toggled.subscribe(spy);
    expect(sw().getAttribute('tabindex')).toBe('0');
    await userEvent.click(sw());
    expect(spy).not.toHaveBeenCalled();
    expect(sw().getAttribute('aria-disabled')).toBe('true');
  });

  it('stays focusable when a form control disabled it and a reason is given', async () => {
    const f = await setup({ lockReason: 'Enforced by your organization' });
    f.componentInstance.setDisabledState(true);
    f.detectChanges();
    expect(sw().getAttribute('tabindex')).toBe('0');
  });

  it('leaves a plain disabled switch out of the tab order, as before', async () => {
    await setup({ disabled: true });
    expect(sw().getAttribute('tabindex')).toBe('-1');
  });

  it('says nothing at all when there is no reason', async () => {
    const f = await setup();
    expect(f.nativeElement.querySelector('[data-sv-state="locked"]')).toBeNull();
  });
});
