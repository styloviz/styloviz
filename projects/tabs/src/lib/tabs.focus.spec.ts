import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import { SvTabsComponent, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  Where focus goes when the active tab is closed — `X-14`, `NV-06-I1`, `NV-06-M2`
 * ============================================================================
 *
 * ★ Focus on `<body>` is not "focus nowhere". It is focus at the TOP OF THE
 * DOCUMENT, so the next Tab goes to the site's first link — and a user who
 * deleted one tab out of six is returned to the start of the page with no
 * announcement. A mouse user sees none of it.
 *
 * `NV-06-M2`'s policy: **next tab, then previous, then the tablist.** Next first
 * because closing is a forward gesture — the user is working through them, and
 * landing on the one they already dealt with is a step back.
 */

const TABS: TabItem[] = [
  { id: 'a', label: 'Alpha', closable: true },
  { id: 'b', label: 'Bravo', closable: true },
  { id: 'c', label: 'Charlie', closable: true },
];

@Component({
  standalone: true,
  imports: [SvTabsComponent],
  template: `<sv-tabs [tabs]="tabs()" [(activeId)]="active" (tabClose)="remove($event)" />`,
})
class Host {
  readonly tabs = signal<TabItem[]>([...TABS]);
  readonly active = signal('b');
  remove(tab: TabItem): void {
    this.tabs.update((list) => list.filter((t) => t.id !== tab.id));
  }
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host);
  return fixture;
}

const tabButtons = (f: { nativeElement: unknown }) =>
  [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const labelOf = (el: Element | null) => el?.textContent?.trim().replace(/×$/, '').trim() ?? null;

/**
 * ⚠️ Waiting for `activeElement !== theClosedTab` resolves INSTANTLY and proves
 * nothing: once the host removes the tab, the browser has already moved focus to
 * `<body>`. That IS the failure state, so the wait has to be for focus landing
 * somewhere real — which is also the only thing worth asserting.
 */
const untilFocusLands = (f: Parameters<typeof untilRendered>[0]) =>
  untilRendered(
    f,
    () => document.activeElement !== document.body && !!document.activeElement?.isConnected,
  );

describe('SvTabsComponent — focus after a close', () => {
  it('lands on the next tab, not on body', async () => {
    const f = await setup();
    const bravo = tabButtons(f)[1];
    bravo.focus();

    bravo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    expect(document.activeElement).not.toBe(document.body);
    expect(labelOf(document.activeElement)).toBe('Charlie');
  });

  /** Nothing after it, so the policy falls back to the previous one. */
  it('falls back to the previous tab when the closed one was last', async () => {
    const f = await setup();
    const charlie = tabButtons(f)[2];
    charlie.focus();

    charlie.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    expect(labelOf(document.activeElement)).toBe('Bravo');
  });

  /**
   * ★ The case the whole rule exists for. With no tabs left there is no
   * neighbour, and the old code simply returned — which is exactly how focus
   * reached `<body>`.
   */
  it('lands on the tablist when the last tab is closed, never on body', async () => {
    const f = await setup();
    f.componentInstance.tabs.set([{ id: 'only', label: 'Only', closable: true }]);
    f.detectChanges();

    const only = tabButtons(f)[0];
    only.focus();
    only.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    expect(document.activeElement).not.toBe(document.body);
    expect((document.activeElement as HTMLElement).getAttribute('role')).toBe('tablist');
  });

  /**
   * ★ The × is a pointer affordance, but the close it triggers moves focus just
   * as the keyboard path does — a mouse user who then reaches for Tab is a
   * keyboard user, and the strip has to still make sense.
   */
  it('recovers focus for a pointer close too, not only Delete', async () => {
    const f = await setup();
    const bravo = tabButtons(f)[1];
    // The × is a SIBLING of the tab button, not a child — ARIA leaves no valid
    // placement for a focusable control inside a `role="tab"`.
    const close = (f.nativeElement as HTMLElement)
      .querySelectorAll<HTMLElement>('[data-close-tab]')[1];

    bravo.focus();
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    expect(document.activeElement).not.toBe(document.body);
    expect(labelOf(document.activeElement)).toBe('Charlie');
  });

  /**
   * ★ `NV-06-I1` / `NV-06-M2`. The host above only filters `tabs`, so after the
   * ACTIVE tab closes `activeId` still names it. The roving tab stop used to
   * follow that dead id — once the recovered focus left the strip, no tab had
   * `tabindex="0"` and Tab could never reach the tablist again.
   */
  it('keeps exactly one tab tabbable after the active tab closes and focus leaves', async () => {
    const f = await setup();
    const bravo = tabButtons(f)[1];
    bravo.focus();

    bravo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    // Focus leaves the strip entirely.
    (document.activeElement as HTMLElement).blur();
    const list = (f.nativeElement as HTMLElement).querySelector('[role="tablist"]')!;
    list.dispatchEvent(new FocusEvent('focusout', { relatedTarget: null }));
    f.detectChanges();
    await f.whenStable();

    // The host's model is left alone — reported through `unresolved`, not rewritten.
    expect(f.componentInstance.active()).toBe('b');
    const tabbable = tabButtons(f).filter((b) => b.tabIndex === 0);
    expect(tabbable.map((b) => labelOf(b))).toEqual(['Alpha']);
  });

  /**
   * A disabled tab is `aria-disabled`, not `disabled`, so it is still focusable —
   * the neighbour list has to skip it the way the arrow keys do.
   */
  it('skips a disabled neighbour when choosing where focus lands', async () => {
    const f = await setup();
    f.componentInstance.tabs.set([
      { id: 'a', label: 'Alpha', closable: true },
      { id: 'b', label: 'Bravo', closable: true },
      { id: 'c', label: 'Charlie', disabled: true },
      { id: 'd', label: 'Delta' },
    ]);
    f.detectChanges();

    const bravo = tabButtons(f)[1];
    bravo.focus();
    bravo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    expect(labelOf(document.activeElement)).toBe('Delta');
  });

  /** A tab id is host data; a `"` in it used to make the selector throw. */
  it('recovers focus when tab ids contain quotes', async () => {
    const f = await setup();
    f.componentInstance.tabs.set([
      { id: 'x"1', label: 'Alpha', closable: true },
      { id: 'x"2', label: 'Bravo', closable: true },
    ]);
    f.componentInstance.active.set('x"1');
    f.detectChanges();

    const alpha = tabButtons(f)[0];
    alpha.focus();
    alpha.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    f.detectChanges();
    await untilFocusLands(f);

    expect(labelOf(document.activeElement)).toBe('Bravo');
  });
});
