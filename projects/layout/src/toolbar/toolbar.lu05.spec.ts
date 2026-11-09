import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvTooltipComponent } from '@styloviz/overlays';
import { SvToolbarComponent, svToolbarAriaShortcut, type ToolbarAction } from './toolbar.component';

/**
 * FL-J3-LU-05 — toolbar action metadata: `pending` (`LU-11-M4`) and `shortcut`
 * (`LU-11-M5`), the two things `LU-11-I6` said an action had no way to say.
 *
 * ★★ A pending action is NOT disabled. Disabling the button a keyboard user
 *    just pressed throws their focus away; `aria-busy` + an inert click keeps
 *    it where it was while the request runs.
 * ★  A shortcut is ADVERTISED, not bound: `aria-keyshortcuts` for assistive
 *    tech, `sv-kbd` chips for the eye (composed, not re-implemented).
 */

const ACTIONS: ToolbarAction[] = [
  { id: 'save', label: 'Save', icon: 'save', shortcut: 'mod+s' },
  { id: 'bold', label: 'Bold', icon: 'bold', shortcut: 'ctrl+b', tooltip: 'Bold text' },
  { id: 'sync', label: 'Sync', icon: 'refresh-cw', pending: true },
  { id: 'plain', label: 'Plain', icon: 'type' },
];

@Component({
  imports: [SvToolbarComponent],
  template: `<sv-toolbar label="Editor" [actions]="actions()" [busyIds]="busy()" [overflow]="overflow()" (actionClick)="clicked.push($event)" />`,
})
class Host {
  readonly actions = signal<readonly ToolbarAction[]>(ACTIONS);
  readonly busy = signal<readonly string[]>([]);
  readonly overflow = signal<'scroll' | 'menu'>('scroll');
  readonly clicked: string[] = [];
}

async function setup(overflow: 'scroll' | 'menu' = 'scroll') {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host, { detectChangesOnRender: false });
  fixture.componentInstance.overflow.set(overflow);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

const root = (f: ComponentFixture<Host>) => f.nativeElement as HTMLElement;
const btn = (f: ComponentFixture<Host>, id: string) =>
  root(f).querySelector<HTMLButtonElement>(`[data-sv-toolbar-index][data-action-id="${id}"]`)!;
const toolbar = (f: ComponentFixture<Host>) =>
  f.debugElement.query(By.directive(SvToolbarComponent)).componentInstance as SvToolbarComponent;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.querySelectorAll('[role="menu"], [role="tooltip"]').forEach((n) => n.remove());
});

describe('SvToolbarComponent — pending actions (LU-11-M4)', () => {
  it('★ reports aria-busy and swaps the icon for a spinner', async () => {
    const f = await setup();
    const sync = btn(f, 'sync');
    expect(sync.getAttribute('aria-busy')).toBe('true');
    expect(sync.hasAttribute('data-sv-pending')).toBe(true);
    const tb = toolbar(f);
    expect(tb.isPending(ACTIONS[2])).toBe(true);
    // One icon only — the spinner — and it only spins when motion is welcome.
    const icons = f.debugElement.queryAll(By.css('[data-action-id="sync"] sv-icon'));
    expect(icons).toHaveLength(1);
    expect(icons[0].componentInstance.name()).toBe('loader');
    expect(icons[0].componentInstance.cssClass()).toContain('motion-safe:animate-spin');
  });

  it('★ ignores the click — no second request — but stays focusable (not disabled)', async () => {
    const f = await setup();
    const sync = btn(f, 'sync');
    sync.click();
    expect(f.componentInstance.clicked).toEqual([]);
    expect(sync.disabled).toBe(false);
    sync.focus();
    expect(document.activeElement).toBe(sync);
  });

  it('runs again once the host clears pending', async () => {
    const f = await setup();
    f.componentInstance.actions.set(ACTIONS.map((a) => (a.id === 'sync' ? { ...a, pending: false } : a)));
    f.detectChanges();
    expect(btn(f, 'sync').getAttribute('aria-busy')).toBeNull();
    btn(f, 'sync').click();
    expect(f.componentInstance.clicked).toEqual(['sync']);
  });

  it('busyIds shows the same spinner as pending — one busy state, two ways to set it', async () => {
    const f = await setup();
    f.componentInstance.busy.set(['plain']);
    f.detectChanges();
    expect(btn(f, 'plain').getAttribute('aria-busy')).toBe('true');
    const icon = f.debugElement.query(By.css('[data-action-id="plain"] sv-icon'));
    expect(icon.componentInstance.name()).toBe('loader');
    expect(toolbar(f).hasBusy()).toBe(true);
  });

  it('a pending action in the overflow menu is busy and cannot be chosen', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.tagName === 'SV-TOOLBAR' ? 90 : 32;
      return { x: 0, y: 0, top: 0, left: 0, width, height: 40, right: width, bottom: 40, toJSON: () => ({}) } as DOMRect;
    });
    const f = await setup('menu');
    const tb = toolbar(f);
    expect(tb.hasOverflow()).toBe(true);
    tb.openMenu();
    f.detectChanges();
    const item = document.body.querySelector<HTMLButtonElement>('[data-sv-toolbar-menuitem][data-action-id="sync"]')!;
    expect(item.getAttribute('aria-busy')).toBe('true');
    expect(item.disabled).toBe(true);
    tb.onMenuSelect(ACTIONS[2]);
    expect(f.componentInstance.clicked).toEqual([]);
    tb.closeMenu(false);
  });
});

describe('SvToolbarComponent — shortcuts (LU-11-M5)', () => {
  it('★ exposes the shortcut as aria-keyshortcuts, in ARIA key names', async () => {
    const f = await setup();
    expect(btn(f, 'bold').getAttribute('aria-keyshortcuts')).toBe('Control+B');
    expect(['Control+S', 'Meta+S']).toContain(btn(f, 'save').getAttribute('aria-keyshortcuts'));
    expect(btn(f, 'plain').hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('★ draws the keys with sv-kbd in a real tooltip, which replaces the plain-text title', async () => {
    const f = await setup();
    const tips = f.debugElement.queryAll(By.directive(SvTooltipComponent));
    // Only the two actions with a shortcut are wrapped.
    expect(tips).toHaveLength(2);
    const boldTip = tips[1].componentInstance as SvTooltipComponent;
    expect(boldTip.text()).toBe('Bold text');
    expect(boldTip.kbd()).toEqual(['Ctrl', 'B']);
    // No double tooltip: the native title is dropped where the real one exists…
    expect(btn(f, 'bold').hasAttribute('title')).toBe(false);
    // …and kept where it does not.
    expect(btn(f, 'plain').getAttribute('title')).toBe('Plain');
  });

  it('the tooltip renders its chips through sv-kbd when it opens', async () => {
    const f = await setup();
    const tip = f.debugElement.queryAll(By.directive(SvTooltipComponent))[1];
    (tip.nativeElement.firstElementChild as HTMLElement).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const bubble = document.body.querySelector('[role="tooltip"]') ?? (f.nativeElement as HTMLElement).querySelector('[role="tooltip"]');
    expect(bubble).not.toBeNull();
    expect(bubble!.querySelectorAll('sv-kbd')).toHaveLength(2);
  });

  it('roving focus and arrow keys still reach a button wrapped in its tooltip', async () => {
    const f = await setup();
    btn(f, 'save').focus();
    btn(f, 'save').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(btn(f, 'bold'));
  });

  it('shows the shortcut in the overflow-menu row too, as sv-kbd chips hidden from AT', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.tagName === 'SV-TOOLBAR' ? 54 : 32;
      return { x: 0, y: 0, top: 0, left: 0, width, height: 40, right: width, bottom: 40, toJSON: () => ({}) } as DOMRect;
    });
    const f = await setup('menu');
    const tb = toolbar(f);
    tb.openMenu();
    f.detectChanges();
    const row = document.body.querySelector<HTMLElement>('[data-sv-toolbar-menuitem][data-action-id="bold"]')!;
    expect(row.getAttribute('aria-keyshortcuts')).toBe('Control+B');
    const chips = row.querySelector('[data-sv-toolbar-shortcut]')!;
    expect(chips.getAttribute('aria-hidden')).toBe('true');
    expect(chips.querySelectorAll('sv-kbd')).toHaveLength(2);
    tb.closeMenu(false);
  });
});

describe('svToolbarAriaShortcut', () => {
  it.each([
    ['ctrl+b', 'other', 'Control+B'],
    ['mod+s', 'other', 'Control+S'],
    ['mod+s', 'apple', 'Meta+S'],
    ['cmd+shift+k', 'other', 'Meta+Shift+K'],
    ['alt+enter', 'other', 'Alt+Enter'],
    ['shift+F10', 'other', 'Shift+F10'],
    ['ctrl++', 'other', 'Control++'],
  ] as const)('%s on %s → %s', (chord, platform, expected) => {
    expect(svToolbarAriaShortcut(chord, platform)).toBe(expected);
  });

  it('returns null for nothing, and for a sequence (a space means "alternatives" in ARIA)', () => {
    expect(svToolbarAriaShortcut(undefined)).toBeNull();
    expect(svToolbarAriaShortcut('  ')).toBeNull();
    expect(svToolbarAriaShortcut('g i')).toBeNull();
  });
});
