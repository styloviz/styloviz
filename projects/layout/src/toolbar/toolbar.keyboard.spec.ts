import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction } from './toolbar.component';

/**
 * ARIA's toolbar pattern is a single tab stop plus arrow keys. Two things go
 * wrong in practice: disabled buttons ending up in the rotation, and — on a
 * page with more than one toolbar — focus jumping to the *other* toolbar's
 * button because both use the same action ids. Both are covered here.
 */

const actions: ToolbarAction[] = [
  { id: 'a', label: 'A', icon: 'a' },
  { id: 'b', label: 'B', icon: 'b', disabled: true },
  { id: 'c', label: 'C', icon: 'c' },
  { id: 'd', label: 'D', icon: 'd' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToolbarComponent, { inputs: { actions, ...inputs } });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const btn = (f: { nativeElement: unknown }, id: string) =>
  el(f).querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`);
const press = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

describe('SvToolbarComponent — the single tab stop', () => {
  it('puts the tab stop on the first ENABLED action, not the first action', async () => {
    const f = await setup({
      actions: [{ id: 'b', label: 'B', icon: 'b', disabled: true }, ...actions.slice(2)],
    });
    expect(btn(f, 'b')?.getAttribute('tabindex')).toBe('-1');
    expect(btn(f, 'c')?.getAttribute('tabindex')).toBe('0');
  });

  /**
   * ★ Weak by construction, and kept anyway. `tabIndexFor`'s own
   * `if (action.disabled) return -1` is redundant with `_firstEnabledId`
   * already skipping disabled actions, so deleting it changes no observable
   * answer — no test can distinguish it. What this pins is the CONTRACT (a
   * disabled button is never a tab stop); the test above, which puts a disabled
   * action first, is the one that fails if `_firstEnabledId` stops filtering.
   */
  it('gives every disabled action -1 regardless of where the stop is', async () => {
    const f = await setup();
    expect(f.componentInstance.tabIndexFor(actions[1])).toBe(-1);
    expect(btn(f, 'b')?.getAttribute('tabindex')).toBe('-1');
  });

  /** All-disabled: there is no first enabled id, so nothing may claim tabindex 0. */
  it('leaves no tab stop at all when every action is disabled', async () => {
    const allOff = actions.map((a) => ({ ...a, disabled: true }));
    const f = await setup({ actions: allOff });
    for (const a of allOff) expect(f.componentInstance.tabIndexFor(a)).toBe(-1);
    expect(el(f).querySelector('[tabindex="0"]')).toBeNull();
  });

  it('moves the tab stop to whichever button the arrows landed on', async () => {
    const f = await setup();
    btn(f, 'a')?.dispatchEvent(press('ArrowRight'));
    f.detectChanges();
    expect(btn(f, 'a')?.getAttribute('tabindex')).toBe('-1');
    expect(btn(f, 'c')?.getAttribute('tabindex')).toBe('0');
  });
});

describe('SvToolbarComponent — arrow navigation', () => {
  it('skips the disabled button on the way right and wraps at the end', async () => {
    const f = await setup();
    const target = btn(f, 'a') as HTMLButtonElement;

    target.dispatchEvent(press('ArrowRight'));
    expect(document.activeElement).toBe(btn(f, 'c'));

    (btn(f, 'c') as HTMLButtonElement).dispatchEvent(press('ArrowDown'));
    expect(document.activeElement).toBe(btn(f, 'd'));

    (btn(f, 'd') as HTMLButtonElement).dispatchEvent(press('ArrowRight'));
    expect(document.activeElement).toBe(btn(f, 'a'));
  });

  it('wraps backwards off the first button', async () => {
    const f = await setup();
    (btn(f, 'a') as HTMLButtonElement).dispatchEvent(press('ArrowLeft'));
    expect(document.activeElement).toBe(btn(f, 'd'));

    (btn(f, 'd') as HTMLButtonElement).dispatchEvent(press('ArrowUp'));
    expect(document.activeElement).toBe(btn(f, 'c'));
  });

  it('jumps to the first and last enabled buttons with Home and End', async () => {
    const f = await setup();
    (btn(f, 'c') as HTMLButtonElement).dispatchEvent(press('End'));
    expect(document.activeElement).toBe(btn(f, 'd'));

    (btn(f, 'd') as HTMLButtonElement).dispatchEvent(press('Home'));
    expect(document.activeElement).toBe(btn(f, 'a'));
  });

  it('claims the key it handled, and leaves the rest to the browser', async () => {
    const f = await setup();
    const handled = press('ArrowRight');
    (btn(f, 'a') as HTMLButtonElement).dispatchEvent(handled);
    expect(handled.defaultPrevented).toBe(true);

    const ignored = press('x');
    (btn(f, 'a') as HTMLButtonElement).dispatchEvent(ignored);
    expect(ignored.defaultPrevented).toBe(false);
  });

  /** One enabled button is already at both ends — arrowing must be a no-op, not a self-focus loop. */
  it('does nothing when only one action is navigable', async () => {
    const one: ToolbarAction[] = [
      { id: 'only', label: 'Only', icon: 'o' },
      { id: 'off', label: 'Off', icon: 'x', disabled: true },
    ];
    const f = await setup({ actions: one });
    document.body.focus();
    const before = document.activeElement;
    const e = press('ArrowRight');
    (btn(f, 'only') as HTMLButtonElement).dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  /**
   * The keydown handler is bound per button, but `onKeydown` is public API and a
   * host could hand it an action that is not in the list (a stale reference held
   * across a `groups` swap). It must bail rather than navigate from index -1.
   */
  it('ignores a key event for an action it does not own', async () => {
    const f = await setup();
    const e = press('ArrowRight');
    f.componentInstance.onKeydown(e, { id: 'ghost', label: 'Ghost', icon: 'g' });
    expect(e.defaultPrevented).toBe(false);
  });
});

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `
    <sv-toolbar data-which="first" [actions]="actions" label="First" />
    <sv-toolbar data-which="second" [actions]="actions" label="Second" />
  `,
})
class TwoToolbarsHost {
  readonly actions = actions;
}

/**
 * ★ REGRESSION TESTS — do not delete as redundant.
 * PHASE3_LAYOUT_UTILITIES_AUDIT.md finding #1 (backlog `X-1` / `X-3`): roving
 * focus used a document-wide lookup keyed by action id, so on a page with two
 * toolbars an arrow key in one focused the other's button. Focus is now scoped
 * to the component's own host; these tests are what keep it that way.
 */
describe('SvToolbarComponent — two toolbars on one page', () => {
  /**
   * Both toolbars carry `data-action-id="c"`, so an unscoped lookup would focus
   * both — and, in document order, the LAST one wins. That is why this is
   * driven from the FIRST toolbar: a key pressed in the second one lands
   * correctly by accident and proves nothing.
   */
  it('regression: keeps arrow focus inside the first toolbar when both share action ids (audit finding #1)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(TwoToolbarsHost);
    const host = fixture.nativeElement as HTMLElement;
    const first = host.querySelector<HTMLElement>('[data-which="first"]') as HTMLElement;
    const second = host.querySelector<HTMLElement>('[data-which="second"]') as HTMLElement;

    (first.querySelector('[data-action-id="a"]') as HTMLButtonElement).dispatchEvent(press('ArrowRight'));

    expect(document.activeElement).toBe(first.querySelector('[data-action-id="c"]'));
    expect(second.contains(document.activeElement)).toBe(false);
  });

  it('regression: keeps arrow focus inside the second toolbar too (audit finding #1)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(TwoToolbarsHost);
    const host = fixture.nativeElement as HTMLElement;
    const second = host.querySelector<HTMLElement>('[data-which="second"]') as HTMLElement;

    (second.querySelector('[data-action-id="a"]') as HTMLButtonElement).dispatchEvent(press('ArrowRight'));

    expect(document.activeElement).toBe(second.querySelector('[data-action-id="c"]'));
  });

  /** The fix was to stop asking the DOCUMENT; pin that no global lookup comes back. */
  it('regression: never resolves a roving target through a document-wide lookup (audit finding #1)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(TwoToolbarsHost);
    const first = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-which="first"]') as HTMLElement;
    const byId = vi.spyOn(document, 'getElementById');
    const bySelector = vi.spyOn(document, 'querySelector');
    const bySelectorAll = vi.spyOn(document, 'querySelectorAll');

    (first.querySelector('[data-action-id="a"]') as HTMLButtonElement).dispatchEvent(press('End'));

    expect(document.activeElement).toBe(first.querySelector('[data-action-id="d"]'));
    expect(byId).not.toHaveBeenCalled();
    expect(bySelector).not.toHaveBeenCalled();
    expect(bySelectorAll).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
