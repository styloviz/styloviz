import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction } from './toolbar.component';
import { until } from '../../../../src/testing/async';

/**
 * `LU-11-M3` — overflow menu mode. `overflow="menu"` measures the width the
 * parent allows and moves the trailing actions into a "More" menu button whose
 * panel is a body portal. The default, `scroll`, must be untouched.
 *
 * Geometry at `size="md"`: a 32px button, 4px gaps, 12px of chrome. Six plain
 * actions need 224px; at 160px, three fit beside the More button.
 */

const ACTIONS: readonly ToolbarAction[] = [
  { id: 'a', label: 'Alpha', icon: 'a' },
  { id: 'b', label: 'Bravo', icon: 'b' },
  { id: 'c', label: 'Charlie', icon: 'c' },
  { id: 'd', label: 'Delta', icon: 'd' },
  { id: 'e', label: 'Echo', icon: 'e', disabled: true },
  { id: 'f', label: 'Foxtrot', icon: 'f', toggle: true },
];

function rect(width: number): DOMRect {
  return {
    x: 0, y: 0, top: 0, left: 0, width, height: 40, right: width, bottom: 40,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Report `width` for the toolbar host and a plausible box for everything else. */
function hostWidth(width: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'SV-TOOLBAR' ? rect(width) : rect(32);
  });
}

/** A ResizeObserver the test can drive. */
class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  constructor(private readonly cb: ResizeObserverCallback) { FakeResizeObserver.last = this; }
  observe(): void { /* driven by emit() */ }
  unobserve(): void { /* nothing to release */ }
  disconnect(): void { /* nothing to release */ }
  emit(width: number): void {
    const entry = {
      borderBoxSize: [{ inlineSize: width, blockSize: 40 }],
      contentRect: rect(width),
    } as unknown as ResizeObserverEntry;
    this.cb([entry], this as unknown as ResizeObserver);
  }
}

/**
 * Rendered through a host so the toolbar sits in a real `<sv-toolbar>` element —
 * `TestBed.createComponent` would mount it on a bare `<div>`, and the width stub
 * below keys on the tag.
 */
@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `<sv-toolbar overflow="menu" label="Editor" [actions]="actions()" />`,
})
class MenuHost {
  readonly actions = signal<readonly ToolbarAction[]>(ACTIONS);
}

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `<sv-toolbar label="Editor" [actions]="actions" />`,
})
class ScrollHost {
  readonly actions = ACTIONS;
}

async function setup(actions: readonly ToolbarAction[] = ACTIONS) {
  TestBed.resetTestingModule();
  const { fixture } = await render(MenuHost, { detectChangesOnRender: false });
  fixture.componentInstance.actions.set(actions);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

const tb = (f: ComponentFixture<unknown>) =>
  f.debugElement.query(By.directive(SvToolbarComponent)).componentInstance as SvToolbarComponent;
const el = (f: ComponentFixture<unknown>) =>
  (f.nativeElement as HTMLElement).querySelector('sv-toolbar') as HTMLElement;
const inline = (f: ComponentFixture<unknown>) =>
  [...el(f).querySelectorAll<HTMLElement>('[data-sv-toolbar-index]')].map((b) => b.dataset['actionId']);
const more = (f: ComponentFixture<unknown>) => el(f).querySelector<HTMLButtonElement>('[data-sv-toolbar-more]');
const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');
const items = () => [...document.body.querySelectorAll<HTMLButtonElement>('[data-sv-toolbar-menuitem]')];
const press = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FakeResizeObserver.last = null;
});

describe('SvToolbarComponent — overflow menu mode (LU-11-M3)', () => {
  it('leaves the default scroll mode alone: every action inline, no More button, no block host', async () => {
    hostWidth(100);
    TestBed.resetTestingModule();
    const { fixture: f } = await render(ScrollHost);
    expect(inline(f)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(more(f)).toBeNull();
    expect(el(f).classList.contains('block')).toBe(false);
  });

  it('shows everything while the width is unknown, rather than collapsing it all', async () => {
    hostWidth(0);
    const f = await setup();
    expect(inline(f)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(more(f)).toBeNull();
  });

  it('moves the trailing actions that do not fit into a More button', async () => {
    hostWidth(160);
    const f = await setup();
    expect(el(f).classList.contains('block')).toBe(true);
    expect(inline(f)).toEqual(['a', 'b', 'c']);
    const m = more(f) as HTMLButtonElement;
    expect(m.getAttribute('aria-haspopup')).toBe('menu');
    expect(m.getAttribute('aria-expanded')).toBe('false');
    expect(m.getAttribute('aria-label')).toBe('More actions');
  });

  it('puts nothing in a menu when everything fits', async () => {
    hostWidth(400);
    const f = await setup();
    expect(inline(f)).toHaveLength(6);
    expect(more(f)).toBeNull();
  });

  it('makes the More button part of the roving tab stop', async () => {
    hostWidth(160);
    const f = await setup();
    el(f).querySelector<HTMLButtonElement>('[data-action-id="a"]')?.dispatchEvent(press('End'));
    expect(document.activeElement).toBe(more(f));
    f.detectChanges();
    expect(more(f)?.getAttribute('tabindex')).toBe('0');

    (more(f) as HTMLButtonElement).dispatchEvent(press('ArrowRight'));
    expect(document.activeElement).toBe(el(f).querySelector('[data-action-id="a"]'));
  });

  it('opens a body-portal menu of the overflowed actions and focuses the first enabled one', async () => {
    hostWidth(160);
    const f = await setup();
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();

    const panel = menu() as HTMLElement;
    expect(panel).toBeTruthy();
    expect(el(f).contains(panel)).toBe(false);
    expect(panel.getAttribute('aria-label')).toBe('More actions');
    expect(more(f)?.getAttribute('aria-expanded')).toBe('true');
    expect(more(f)?.getAttribute('aria-controls')).toBe(panel.id);

    expect(items().map((b) => b.textContent?.trim())).toEqual(['Delta', 'Echo', 'Foxtrot']);
    expect(items()[0].getAttribute('role')).toBe('menuitem');
    expect(items()[1].disabled).toBe(true);
    expect(items()[2].getAttribute('role')).toBe('menuitemcheckbox');
    expect(items()[2].getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('walks the enabled items with the arrow keys, Home and End, skipping disabled ones', async () => {
    hostWidth(160);
    const f = await setup();
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();
    const panel = menu() as HTMLElement;
    const [delta, , foxtrot] = items();

    delta.dispatchEvent(press('ArrowDown'));
    expect(document.activeElement).toBe(foxtrot);
    foxtrot.dispatchEvent(press('ArrowDown'));
    expect(document.activeElement).toBe(delta);
    delta.dispatchEvent(press('ArrowUp'));
    expect(document.activeElement).toBe(foxtrot);
    foxtrot.dispatchEvent(press('Home'));
    expect(document.activeElement).toBe(delta);
    delta.dispatchEvent(press('End'));
    expect(document.activeElement).toBe(foxtrot);
    expect(panel.isConnected).toBe(true);
  });

  it('closes on Escape, removes the portal and hands focus back to More', async () => {
    hostWidth(160);
    const f = await setup();
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();

    document.activeElement?.dispatchEvent(press('Escape'));
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(document.body.querySelector('.sv-toolbar-menu-portal')).toBeNull();
    expect(document.activeElement).toBe(more(f));
    expect(more(f)?.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens from the keyboard: Down focuses the first item, Up the last', async () => {
    hostWidth(160);
    const f = await setup();
    (more(f) as HTMLButtonElement).dispatchEvent(press('ArrowDown'));
    f.detectChanges();
    expect(document.activeElement).toBe(items()[0]);

    document.activeElement?.dispatchEvent(press('Escape'));
    f.detectChanges();
    (more(f) as HTMLButtonElement).dispatchEvent(press('ArrowUp'));
    f.detectChanges();
    expect(document.activeElement).toBe(items()[2]);
  });

  it('runs the action from the menu: emits, toggles, closes', async () => {
    hostWidth(160);
    const f = await setup();
    const fired: string[] = [];
    tb(f).actionClick.subscribe((id) => fired.push(id));

    (more(f) as HTMLButtonElement).click();
    f.detectChanges();
    items()[2].click();
    f.detectChanges();

    expect(fired).toEqual(['f']);
    expect(tb(f).activeIds().has('f')).toBe(true);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(f));

    (more(f) as HTMLButtonElement).click();
    f.detectChanges();
    expect(items()[2].getAttribute('aria-checked')).toBe('true');
  });

  it('never runs a disabled action from the menu', async () => {
    hostWidth(160);
    const f = await setup();
    const fired: string[] = [];
    tb(f).actionClick.subscribe((id) => fired.push(id));
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();
    tb(f).onMenuSelect(ACTIONS[4]);
    expect(fired).toEqual([]);
  });

  it('closes on a click outside, but not on a click inside the panel', async () => {
    hostWidth(160);
    const f = await setup();
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();

    (menu() as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu()).toBeTruthy();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    f.detectChanges();
    expect(menu()).toBeNull();
  });

  it('does not leave the portal behind when destroyed while open', async () => {
    hostWidth(160);
    const f = await setup();
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();
    expect(menu()).toBeTruthy();

    f.destroy();
    expect(menu()).toBeNull();
    expect(document.body.querySelector('.sv-toolbar-menu-portal')).toBeNull();
  });

  it('re-splits when the container resizes, and closes a menu with nothing left in it', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    hostWidth(160);
    const f = await setup();
    expect(inline(f)).toEqual(['a', 'b', 'c']);
    (more(f) as HTMLButtonElement).click();
    f.detectChanges();
    expect(menu()).toBeTruthy();

    FakeResizeObserver.last?.emit(400);
    await until(() => {
      f.detectChanges();
      return inline(f).length === 6;
    }, { label: 'all six actions inline after the resize' });
    expect(more(f)).toBeNull();
    expect(menu()).toBeNull();

    FakeResizeObserver.last?.emit(80);
    await until(() => {
      f.detectChanges();
      return inline(f).length === 1;
    }, { label: 'one action inline at 80px' });
  });

  it('counts separators when deciding what fits', async () => {
    hostWidth(160);
    const withDividers = ACTIONS.map((a, i) => (i === 0 ? { ...a, dividerAfter: true } : a));
    const f = await setup(withDividers);
    // 12 + 4×32 + 5 (separator) + 4×4 (gaps between 5 children) = 161 > 160.
    expect(inline(f)).toEqual(['a', 'b']);
  });
});
