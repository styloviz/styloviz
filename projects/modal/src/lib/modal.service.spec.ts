import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SV_MODAL_DATA,
  SvModalRef,
  SvModalService,
  type SvModalResult,
} from './modal.service';
import { svBodyScrollLockDepth, svResetBodyScrollLock } from '@styloviz/core';

/** A dialog that can close itself with whatever the test needs. */
@Component({
  selector: 'sv-test-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="dialog-body">{{ label }}</p>
    <button type="button" data-testid="confirm" (click)="ref.close(true)">Yes</button>
    <button type="button" data-testid="deny" (click)="ref.close(false)">No</button>`,
})
class TestDialogComponent {
  readonly ref = inject(SvModalRef) as SvModalRef<boolean, { label?: string }>;
  readonly data = inject(SV_MODAL_DATA) as { label?: string } | null;
  readonly label = this.data?.label ?? 'no data';
}

function service(): SvModalService {
  TestBed.resetTestingModule();
  return TestBed.inject(SvModalService);
}

/** Let the modal's deferred mount timer run. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  svResetBodyScrollLock(document);
  document.querySelectorAll('[data-sv-modal-service]').forEach((n) => n.remove());
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
});

const dialogBody = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-testid="dialog-body"]');

const button = (id: string): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);

describe('SvModalService — opening', () => {
  it('mounts the dialog component without any host element in the layout', async () => {
    const modal = service();
    modal.open(TestDialogComponent, { data: { label: 'Hello' } });
    await settle();

    expect(dialogBody()?.textContent).toBe('Hello');
    expect(modal.openCount()).toBe(1);
  });

  /**
   * ★★★ PROJECTION IS BY INDEX, SO THE REGION IT LANDS IN IS THE ASSERTION.
   *
   * `createComponent`'s `projectableNodes` ignores the `ng-content` selectors
   * and assigns the Nth array to the Nth entry of `ngContentSelectors` — which
   * is NOT template order. The modal declares header, body, footer; Angular
   * reports `['[slot=body]', '[slot=header]', '[slot=footer]']`. Index 1, the
   * obvious guess, renders the dialog IN THE HEADER, beside the title and above
   * the divider, and nothing warns you.
   *
   * An earlier version of this test asserted only that the content was
   * somewhere inside `[role="dialog"]` — which is true of the header too. It
   * passed against exactly that bug. This one asserts the REGION.
   */
  it('projects the component into the body region, not the header', async () => {
    const modal = service();
    modal.open(TestDialogComponent);
    await settle();

    const body = dialogBody();
    expect(body).toBeTruthy();
    expect(body!.closest('[role="dialog"]')).toBeTruthy();

    const dialog = body!.closest('[role="dialog"]') as HTMLElement;
    const header = dialog.querySelector('h3, h2, [id^="sv-modal-title"]')?.parentElement;
    expect(header?.contains(body!)).toBeFalsy();
    // The body region is the scrolling middle of the panel.
    expect(body!.closest('.flex-1.overflow-y-auto')).toBeTruthy();
  });

  /**
   * ★★ THE PROMISE ITSELF IS WHAT MAKES THE RESULT ONCE-ONLY.
   *
   * Worth pinning separately from the guard in `finish`, because the guard was
   * documented as the thing protecting the value and it is not: `Promise`
   * resolution is already idempotent. This test is the one that would notice if
   * `result` were ever swapped for something that is not — a Subject, a signal,
   * a callback list.
   */
  it('resolves once even though the ref is closed repeatedly', async () => {
    const modal = service();
    const ref = modal.open<boolean>(TestDialogComponent);
    await settle();

    let settles = 0;
    ref.result.then(() => settles++);

    ref.close(true);
    ref.dismiss('escape');
    await settle();
    await settle();

    expect(settles).toBe(1);
  });

  it('hands the dialog its data through injection', async () => {
    const modal = service();
    const ref = modal.open<boolean, { label: string }>(TestDialogComponent, {
      data: { label: 'Injected' },
    });
    await settle();

    expect(ref.data.label).toBe('Injected');
    expect(dialogBody()?.textContent).toBe('Injected');
  });

  it('tears the dialog out of the document when it closes', async () => {
    const modal = service();
    const ref = modal.open(TestDialogComponent);
    await settle();
    expect(dialogBody()).toBeTruthy();

    ref.dismiss();
    await settle();

    expect(dialogBody()).toBeNull();
    expect(document.querySelector('[data-sv-modal-service]')).toBeNull();
    expect(modal.openCount()).toBe(0);
  });
});

describe('SvModalService — the result', () => {
  /**
   * ★★★ THE ASSERTION THE WHOLE API SHAPE EXISTS FOR.
   *
   * `Promise<R | undefined>` makes every caller write `if (result)`, and that is
   * correct exactly until the dialog resolves something falsy — which is the
   * common case. A confirm that resolves `false` means "the user said no", and
   * a truthiness check reads it as "the user cancelled": the no-branch never
   * runs, nothing throws, and the bug presents as the dialog "sometimes not
   * working". `dismissed` is a separate field precisely so `false` can be a
   * real answer.
   */
  it('tells a confirmed false apart from a dismissal', async () => {
    const modal = service();

    const denied = modal.open<boolean>(TestDialogComponent);
    await settle();
    button('deny')!.click();
    const deniedResult: SvModalResult<boolean> = await denied.result;

    expect(deniedResult.dismissed).toBe(false);
    expect(deniedResult).toEqual({ dismissed: false, value: false });

    const cancelled = modal.open<boolean>(TestDialogComponent);
    await settle();
    cancelled.dismiss('escape');
    const cancelledResult = await cancelled.result;

    expect(cancelledResult).toEqual({ dismissed: true, reason: 'escape' });
  });

  it('resolves with the value the dialog closed itself with', async () => {
    const modal = service();
    const ref = modal.open<boolean>(TestDialogComponent);
    await settle();

    button('confirm')!.click();

    await expect(ref.result).resolves.toEqual({ dismissed: false, value: true });
  });

  /**
   * ★★★ FIRST SETTLE WINS.
   *
   * A Save handler calls `close(value)` and the same click lands on the
   * backdrop; or Enter activates Save while an Escape is already queued.
   * Without the guard the second call overwrites a confirmed value with a
   * dismissal — the user pressed Save and the caller was told they cancelled.
   */
  it('ignores a second close, so a value is never overwritten by a dismissal', async () => {
    const modal = service();
    const ref = modal.open<boolean>(TestDialogComponent);
    await settle();

    ref.close(true);
    ref.dismiss('backdrop');
    ref.close(false);

    await expect(ref.result).resolves.toEqual({ dismissed: false, value: true });
  });

  /**
   * ★★★ IT ALWAYS SETTLES.
   *
   * A route change tears the host down with a dialog still up. An `await` that
   * hangs forever is worse than one that rejects: the code after it never runs,
   * nothing is reported, and the only symptom is a feature that stopped
   * happening.
   */
  it('settles every outstanding dialog when the injector is destroyed', async () => {
    const modal = service();
    const a = modal.open(TestDialogComponent);
    const b = modal.open(TestDialogComponent);
    await settle();

    TestBed.resetTestingModule(); // destroys the root injector

    await expect(a.result).resolves.toEqual({ dismissed: true, reason: 'destroyed' });
    await expect(b.result).resolves.toEqual({ dismissed: true, reason: 'destroyed' });
  });

  it('exposes whether it has settled yet', async () => {
    const modal = service();
    const ref = modal.open<boolean>(TestDialogComponent);
    await settle();

    expect(ref.closed()).toBe(false);
    ref.close(true);
    expect(ref.closed()).toBe(true);
  });

  /** A close driven by the component — Escape, backdrop, the × — is a dismissal. */
  it('turns a component-side close into a dismissal with that reason', async () => {
    const modal = service();
    const ref = modal.open<boolean>(TestDialogComponent, { closeOnEsc: true });
    await settle();

    const overlay = document.querySelector('[data-sv-modal-portal] div') as HTMLElement;
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    await expect(ref.result).resolves.toEqual({ dismissed: true, reason: 'escape' });
  });
});

describe('SvModalService — stacking', () => {
  it('counts the dialogs that are open', async () => {
    const modal = service();
    const a = modal.open(TestDialogComponent);
    const b = modal.open(TestDialogComponent);
    await settle();

    expect(modal.openCount()).toBe(2);
    a.dismiss();
    expect(modal.openCount()).toBe(1);
    b.dismiss();
    expect(modal.openCount()).toBe(0);
  });

  /**
   * ★★★ TWO DIALOGS, ONE CLOSES — THE PAGE STAYS LOCKED.
   *
   * A per-instance scroll lock is correct right up to the moment a dialog opens
   * a confirm on top of itself, which this API makes ordinary. Closing the top
   * one used to clear `body.overflow` while the one underneath was still up,
   * and the page began scrolling behind an open dialog.
   */
  it('keeps the page locked while a dialog is still open underneath', async () => {
    const modal = service();
    const a = modal.open(TestDialogComponent);
    const b = modal.open(TestDialogComponent);
    await settle();

    expect(svBodyScrollLockDepth()).toBe(2);
    expect(document.body.style.overflow).toBe('hidden');

    b.dismiss();
    await settle();
    expect(document.body.style.overflow).toBe('hidden');

    a.dismiss();
    await settle();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes everything on closeAll, settling each one', async () => {
    const modal = service();
    const a = modal.open(TestDialogComponent);
    const b = modal.open(TestDialogComponent);
    await settle();

    modal.closeAll();

    await expect(a.result).resolves.toEqual({ dismissed: true, reason: 'close-all' });
    await expect(b.result).resolves.toEqual({ dismissed: true, reason: 'close-all' });
    expect(modal.openCount()).toBe(0);
  });
});
