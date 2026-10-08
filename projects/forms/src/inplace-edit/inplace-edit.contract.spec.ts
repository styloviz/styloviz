import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvInplaceEditComponent,
  type InplaceEditConflictChoice,
  type InplaceEditSave,
} from './inplace-edit.component';

/**
 * `X-6` / `FI-12-*` — the pending / revert / conflict / permission contract.
 *
 * Everything here is about a field that writes on commit rather than on submit,
 * and the four ways that goes wrong: the write fails and nothing says so, two
 * people edit at once and one of them loses silently, the user may not edit at
 * all and only finds out when saving, and — on a phone — nothing indicates the
 * text is editable in the first place.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvInplaceEditComponent, {
    inputs: { label: 'Display name', value: 'Ada', ...inputs },
  });
  return fixture;
}

const openEditor = async (f: { detectChanges(): void }) => {
  await userEvent.click(screen.getByRole('button', { name: /Edit Display name/i }));
  f.detectChanges();
};

const editorInput = (): HTMLInputElement =>
  document.querySelector('input[type="text"]') as HTMLInputElement;

describe('SvInplaceEditComponent — the write, and the way back', () => {
  it('emits a write alongside the plain save, in that order', async () => {
    const order: string[] = [];
    const f = await setup();
    f.componentInstance.save.subscribe(() => order.push('save'));
    f.componentInstance.saveRequest.subscribe(() => order.push('request'));

    await openEditor(f);
    await userEvent.clear(editorInput());
    await userEvent.type(editorInput(), 'Grace');
    await userEvent.keyboard('{Enter}');
    f.detectChanges();

    expect(order).toEqual(['save', 'request']);
  });

  it('carries the previous value, an idempotency key and a rollback', async () => {
    let seen: InplaceEditSave | null = null;
    const f = await setup();
    f.componentInstance.saveRequest.subscribe((e: InplaceEditSave) => (seen = e));

    await openEditor(f);
    await userEvent.clear(editorInput());
    await userEvent.type(editorInput(), 'Grace');
    await userEvent.keyboard('{Enter}');
    f.detectChanges();

    expect(seen!.value).toBe('Grace');
    expect(seen!.previous).toBe('Ada');
    expect(seen!.requestKey).toBeTruthy();
    expect(f.componentInstance.value()).toBe('Grace');
  });

  it('puts the old value back when the write fails', async () => {
    let latest: InplaceEditSave | null = null;
    const f = await setup();
    f.componentInstance.saveRequest.subscribe((e: InplaceEditSave) => (latest = e));

    await openEditor(f);
    await userEvent.clear(editorInput());
    await userEvent.type(editorInput(), 'Grace');
    await userEvent.keyboard('{Enter}');
    f.detectChanges();

    latest!.rollback();
    f.detectChanges();

    expect(f.componentInstance.value()).toBe('Ada');
  });

  it('normalizes an SvDataError into the message region', async () => {
    const f = await setup({ error: { message: 'Save service unavailable', retryable: true } });
    f.detectChanges();

    expect(screen.getByRole('alert').textContent).toContain('Save service unavailable');
  });
});

describe('SvInplaceEditComponent — two people, one field', () => {
  const conflict = { theirs: 'Grace Hopper', by: 'Priya', at: '2 minutes ago' };

  it('shows both values rather than picking one', async () => {
    const f = await setup({ conflict });
    f.detectChanges();

    const region = f.nativeElement.querySelector('[data-sv-state="conflict"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.querySelector('[data-sv-conflict="theirs"]')!.textContent).toContain('Grace Hopper');
    expect(screen.getByRole('button', { name: /Keep mine/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Use theirs/i })).toBeTruthy();
  });

  /**
   * "Someone else changed this" is a fact. "Priya changed this 2 minutes ago"
   * is the same fact plus the two things that actually decide the answer.
   */
  it('names who and when, when the host knows', async () => {
    const f = await setup({ conflict });
    f.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('Priya changed this field 2 minutes ago');
  });

  it('falls back to an honest sentence when it does not', async () => {
    const f = await setup({ conflict: { theirs: 'Grace Hopper' } });
    f.detectChanges();
    expect(screen.getByRole('alert').textContent).toContain('This field was changed elsewhere');
  });

  it('applies the winner and says which one it was', async () => {
    let choice: InplaceEditConflictChoice | null = null;
    const f = await setup({ conflict });
    f.componentInstance.conflictResolved.subscribe((e: InplaceEditConflictChoice) => (choice = e));
    f.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: /Use theirs/i }));
    f.detectChanges();

    expect(choice!.choice).toBe('theirs');
    expect(choice!.value).toBe('Grace Hopper');
    expect(f.componentInstance.value()).toBe('Grace Hopper');
  });

  it('keeps the draft when the user stands by it', async () => {
    let choice: InplaceEditConflictChoice | null = null;
    const f = await setup({ conflict });
    f.componentInstance.conflictResolved.subscribe((e: InplaceEditConflictChoice) => (choice = e));
    f.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: /Keep mine/i }));
    f.detectChanges();

    expect(choice!.choice).toBe('mine');
    expect(f.componentInstance.value()).toBe(choice!.value);
  });

  it('hides the ordinary save/cancel actions while the choice is up', async () => {
    const f = await setup({ conflict });
    f.detectChanges();
    expect(screen.queryByRole('button', { name: /^Save$/ })).toBeNull();
  });
});

describe('SvInplaceEditComponent — a field the user may not edit', () => {
  it('says why, instead of failing on save', async () => {
    const f = await setup({ lockReason: 'Only an administrator can change this' });

    const locked = f.nativeElement.querySelector('[data-sv-state="locked"]') as HTMLElement;
    expect(locked.textContent).toContain('Ada');
    expect(f.nativeElement.textContent).toContain('Only an administrator can change this');
    expect(locked.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('offers no way in at all', async () => {
    const f = await setup({ lockReason: 'Only an administrator can change this' });
    expect(screen.queryByRole('button', { name: /Edit Display name/i })).toBeNull();
    expect(f.nativeElement.querySelector('input')).toBeNull();
  });

  /**
   * The alternative it replaces is worse than a disabled field: letting the
   * user type, then failing on save, costs them the edit as well as the answer.
   */
  it('outranks a live error, because there was never a write to fail', async () => {
    const f = await setup({ lockReason: 'Read-only', error: 'Save failed' });
    expect(f.nativeElement.querySelector('input')).toBeNull();
  });
});

describe('SvInplaceEditComponent — an affordance that exists on touch', () => {
  /**
   * `FI-12-I2`. Tailwind compiles `hover:` to `@media (hover: hover)`, so the
   * hover underline the old default relied on never renders on a phone: the
   * field looks like plain text and nothing says otherwise.
   */
  it('renders a pencil by default, shown outright on a coarse pointer', async () => {
    const f = await setup();
    const pencil = f.nativeElement.querySelector('sv-icon[name="edit"]')?.parentElement as HTMLElement;

    expect(pencil).toBeTruthy();
    expect(pencil.className).toContain('pointer-coarse:opacity-100');
    expect(pencil.className).toContain('group-hover:opacity-100');
    // Decorative: the value button beside it already offers the same action,
    // and two tab stops onto one field is worse than none.
    expect(pencil.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps trigger="click" exactly as it was, for dense tables', async () => {
    const f = await setup({ trigger: 'click' });
    expect(f.nativeElement.querySelector('sv-icon[name="edit"]')).toBeNull();
  });

  it('renders trigger="button" as a real, always-visible button', async () => {
    await setup({ trigger: 'button' });
    const btn = screen.getByRole('button', { name: /Edit Display name/i });
    expect(btn.className).not.toContain('opacity-0');
  });
});
