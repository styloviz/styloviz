import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvModalComponent, type ModalCloseReason } from './modal.component';
import { until } from '../../../../src/testing/async';

/**
 * ============================================================================
 *  `sv-modal` — the controlled-close policy (`OF-09-I5`, `OF-09-M3`, `X-11`)
 * ============================================================================
 *
 * ★★★ A FORM IN A MODAL COULD BE THROWN AWAY BY A MISSED CLICK. The backdrop
 *     is the whole screen around the panel and Escape is one key; both
 *     discarded everything the user had typed, with no warning and no undo.
 *
 * ★★ The prompt itself is `createCloseGuard`, shared with Drawer and Confirm
 *    Dialog, because a "you have unsaved changes" prompt written four times
 *    behaves four ways. What this file asserts is the WIRING: that every close
 *    path asks, that the answers do what they say, and that the eventual close
 *    is reported with the reason the user actually acted on.
 */

async function open(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: { title: 'Edit profile', isOpen: true, ...inputs } as ComponentInput<SvModalComponent>,
  });
  await until(() => document.querySelector('[role="dialog"]') !== null, {
    label: 'the dialog to mount',
  });
  fixture.detectChanges();
  return { c: fixture.componentInstance, fixture };
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const backdrop = () => panel().parentElement!;
const prompt = () => document.querySelector('[data-sv-state="unsaved-prompt"]') as HTMLElement | null;
const discardBtn = () => document.querySelector('[data-sv-discard]') as HTMLButtonElement | null;
const keepBtn = () => document.querySelector('[data-sv-keep-editing]') as HTMLButtonElement | null;
const escape = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
});

describe('sv-modal — a clean dialog behaves exactly as before', () => {
  it('closes on every path with no prompt', async () => {
    for (const act of [
      (c: SvModalComponent) => c.close('programmatic'),
      (c: SvModalComponent) => c.onKeydown(escape()),
    ]) {
      const { c, fixture } = await open();
      act(c);
      fixture.detectChanges();
      expect(prompt()).toBeNull();
      expect(c.isOpen()).toBe(false);
    }
  });
});

describe('sv-modal — [dirty] asks instead of discarding', () => {
  it('holds a backdrop dismissal and puts the question over the panel', async () => {
    const { c, fixture } = await open({ dirty: true });
    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(c.isOpen()).toBe(true);
    expect(c.promptingDiscard()).toBe(true);
    expect(prompt()?.textContent).toContain('Discard your changes?');
    // ★ A second, nested decision inside a dialog — and NOT `aria-modal`: the
    //   outer dialog owns that, and claiming it twice tells a screen reader
    //   the panel is background when it is the subject of the question.
    expect(prompt()?.getAttribute('role')).toBe('alertdialog');
    expect(prompt()?.hasAttribute('aria-modal')).toBe(false);
  });

  it('holds Escape too, and every other path through close()', async () => {
    const { c, fixture } = await open({ dirty: true });
    c.onKeydown(escape());
    fixture.detectChanges();
    expect(c.isOpen()).toBe(true);
    expect(c.promptedReason()).toBe('escape');

    c.keepEditing();
    fixture.detectChanges();
    c.close('close-button');
    fixture.detectChanges();
    expect(c.isOpen()).toBe(true);
    expect(c.promptedReason()).toBe('close-button');
  });

  it('★ closes with the reason the USER acted on, not "programmatic"', async () => {
    const { c, fixture } = await open({ dirty: true });
    const dismissed: ModalCloseReason[] = [];
    const discarded: ModalCloseReason[] = [];
    c.dismissed.subscribe((r) => dismissed.push(r));
    c.discarded.subscribe((r) => discarded.push(r));

    c.onKeydown(escape());
    fixture.detectChanges();
    discardBtn()!.click();
    fixture.detectChanges();

    expect(c.isOpen()).toBe(false);
    expect(discarded).toEqual(['escape']);
    // ★★ The prompt interrupted a dismissal; it is not a new kind of close.
    //    Reporting `programmatic` here would tell the host's analytics that
    //    code closed a dialog the user closed.
    expect(dismissed).toEqual(['escape']);
  });

  it('keeps the dialog open and reports the abandoned attempt', async () => {
    const { c, fixture } = await open({ dirty: true });
    const cancelled: ModalCloseReason[] = [];
    c.closeCancelled.subscribe((r) => cancelled.push(r));

    c.onKeydown(escape());
    fixture.detectChanges();
    keepBtn()!.click();
    fixture.detectChanges();

    expect(c.isOpen()).toBe(true);
    expect(prompt()).toBeNull();
    expect(cancelled).toEqual(['escape']);
  });

  it('★ focuses the safe choice, not the destructive one', async () => {
    // "Prompt appeared, press Enter" must not throw the user's work away —
    // the same rule as the confirm dialog's `initialFocus` default.
    const { c, fixture } = await open({ dirty: true });
    c.onKeydown(escape());
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(keepBtn());
  });

  it('lets a programmatic close through, because the host already decided', async () => {
    const { c, fixture } = await open({ dirty: true });
    c.close('programmatic');
    fixture.detectChanges();

    expect(c.isOpen()).toBe(false);
    expect(prompt()).toBeNull();
  });

  it('asks again on the next attempt after the user stayed', async () => {
    const { c, fixture } = await open({ dirty: true });
    c.onKeydown(escape());
    fixture.detectChanges();
    c.keepEditing();
    fixture.detectChanges();

    c.onKeydown(escape());
    fixture.detectChanges();
    expect(c.promptingDiscard()).toBe(true);
  });
});

describe('sv-modal — [canClose]: the host veto', () => {
  it('refuses the close and says nothing about unsaved changes', async () => {
    // ★★ A VETO AND A DIRTY PROMPT ARE DIFFERENT REFUSALS. The host said "not
    //    now" for its own reasons; telling the user their changes are unsaved
    //    would be the component inventing a reason.
    const { c, fixture } = await open({ dirty: true, canClose: () => false });
    c.onKeydown(escape());
    fixture.detectChanges();

    expect(c.isOpen()).toBe(true);
    expect(prompt()).toBeNull();
    expect(c.promptingDiscard()).toBe(false);
  });

  it('lets a guard object to one path and ignore the others', async () => {
    const { c, fixture } = await open({
      canClose: (reason: ModalCloseReason) => (reason === 'backdrop' ? false : undefined),
    });

    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(c.isOpen()).toBe(true);

    c.onKeydown(escape());
    fixture.detectChanges();
    expect(c.isOpen()).toBe(false);
  });

  it('is consulted for a programmatic close as well', async () => {
    // Unlike the dirty prompt: a veto is the host's own rule, so it applies to
    // the host's own call too — it is the one that wrote both.
    const { c, fixture } = await open({ canClose: () => false });
    c.close('programmatic');
    fixture.detectChanges();
    expect(c.isOpen()).toBe(true);
  });
});

describe('sv-modal — the prompt does not become a trap', () => {
  it('only one dialog role is exposed at a time for the prompt', async () => {
    const { c, fixture } = await open({ dirty: true });
    c.onKeydown(escape());
    fixture.detectChanges();

    // The panel keeps its own `role="dialog"`; the prompt adds exactly one
    // `alertdialog` on top of it.
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('clears the prompt when the dialog is closed by other means', async () => {
    const { c, fixture } = await open({ dirty: true });
    c.onKeydown(escape());
    fixture.detectChanges();
    expect(c.promptingDiscard()).toBe(true);

    // The host closed it from outside — the two-way binding, a route change,
    // its own "Saved" handler.
    c.isOpen.set(false);
    fixture.detectChanges();

    expect(c.promptingDiscard()).toBe(false);
  });
});
