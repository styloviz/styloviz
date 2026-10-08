import { Component, DestroyRef, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { SvFloatingLayerService, SvOverlayStackService, type SvFloatingAnchor } from '@styloviz/core';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction } from './toolbar.component';

/**
 * The toolbar's place among the page's layers:
 *
 * - `LU-11` overflow menu on the shared overlay stack (`N-4`) — its z-index,
 *   Escape only while topmost, the portal host tied to the toolbar's
 *   `DestroyRef`, and focus recovery inside the open menu (`X-10`);
 * - `X-5` — the opt-in `floatingAnchor` registration with the floating layer.
 *
 * Geometry at `size="md"`, 160px wide: three actions inline, the rest in More.
 */

const ACTIONS: readonly ToolbarAction[] = [
  { id: 'a', label: 'Alpha', icon: 'a' },
  { id: 'b', label: 'Bravo', icon: 'b' },
  { id: 'c', label: 'Charlie', icon: 'c' },
  { id: 'd', label: 'Delta', icon: 'd' },
  { id: 'e', label: 'Echo', icon: 'e', disabled: true },
  { id: 'f', label: 'Foxtrot', icon: 'f', toggle: true },
];

function rect(width: number, height = 40): DOMRect {
  return {
    x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** The toolbar host is `width` wide, its strip 48px tall; everything else a 32px box. */
function geometry(width: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'SV-TOOLBAR') return rect(width);
    if (this.getAttribute('role') === 'toolbar') return rect(width, 48);
    return rect(32);
  });
}

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `<sv-toolbar overflow="menu" label="Editor" [actions]="actions()" [busyIds]="busy()"
                         [floatingAnchor]="anchor()" />`,
})
class Host {
  readonly actions = signal<readonly ToolbarAction[]>(ACTIONS);
  readonly busy = signal<readonly string[]>([]);
  readonly anchor = signal<SvFloatingAnchor | null>(null);
}

async function setup(width = 160): Promise<ComponentFixture<Host>> {
  geometry(width);
  TestBed.resetTestingModule();
  const { fixture } = await render(Host);
  await fixture.whenStable();
  return fixture;
}

const tb = (f: ComponentFixture<Host>) =>
  f.debugElement.query(By.directive(SvToolbarComponent)).componentInstance as SvToolbarComponent;
const strip = (f: ComponentFixture<Host>) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="toolbar"]') as HTMLElement;
const more = (f: ComponentFixture<Host>) => strip(f).querySelector<HTMLButtonElement>('[data-sv-toolbar-more]') as HTMLButtonElement;
const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');
const items = () => [...document.body.querySelectorAll<HTMLButtonElement>('[data-sv-toolbar-menuitem]')];
const label = (el: Element | null) => el?.textContent?.trim();
const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

async function open(f: ComponentFixture<Host>): Promise<void> {
  more(f).click();
  f.detectChanges();
  await f.whenStable();
}

/** Change the host's data and let the toolbar re-render and reconcile. */
async function settle(f: ComponentFixture<Host>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SvToolbarComponent — overflow menu on the overlay stack', () => {
  it('takes its z-index from the overlay stack, not a hard-coded 9999', async () => {
    const f = await setup();
    const stack = TestBed.inject(SvOverlayStackService);
    const below = stack.push('sheet');
    await open(f);

    const z = Number(menu()?.style.zIndex);
    expect(menu()?.style.zIndex).not.toBe('9999');
    expect(z).toBeGreaterThan(below.zIndex);
    expect(stack.size).toBe(2);

    escape();
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(stack.size).toBe(1);
    below.release();
  });

  it('handles Escape only while it is the topmost overlay', async () => {
    const f = await setup();
    await open(f);
    const dialog = TestBed.inject(SvOverlayStackService).push('modal');

    escape();
    f.detectChanges();
    expect(menu(), 'an Escape meant for the dialog above closed the menu').toBeTruthy();

    dialog.release();
    escape();
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(f));
  });

  it('does not treat a click in a surface opened above it as outside', async () => {
    const f = await setup();
    await open(f);
    const dialogEl = document.createElement('div');
    document.body.appendChild(dialogEl);
    const dialog = TestBed.inject(SvOverlayStackService).push('modal', { element: () => dialogEl });

    dialogEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    f.detectChanges();
    expect(menu()).toBeTruthy();

    dialog.release();
    dialogEl.remove();
  });

  it('releases its stack entry when the mount throws', async () => {
    const f = await setup();
    const stack = TestBed.inject(SvOverlayStackService);
    const c = tb(f);
    const tpl = (c as unknown as { menuTpl: { createEmbeddedView: () => never } }).menuTpl;
    vi.spyOn(tpl, 'createEmbeddedView').mockImplementation(() => { throw new Error('mount failed'); });

    expect(() => c.openMenu()).toThrow('mount failed');
    expect(stack.size).toBe(0);
    expect(c.menuOpen()).toBe(false);
    expect(document.body.querySelector('.sv-toolbar-menu-portal')).toBeNull();
  });

  it('ties the portal host to the toolbar DestroyRef on every open', async () => {
    const f = await setup();
    const ref = f.debugElement.query(By.directive(SvToolbarComponent)).injector.get(DestroyRef);
    const onDestroy = vi.spyOn(Object.getPrototypeOf(ref) as DestroyRef, 'onDestroy');
    const c = tb(f);

    // Counted across the synchronous open only — change detection afterwards
    // registers its own render hooks on the same DestroyRef.
    for (let round = 1; round <= 3; round++) {
      const before = onDestroy.mock.calls.length;
      c.openMenu();
      expect(onDestroy.mock.calls.length - before, `open #${round}`).toBe(1);
      c.closeMenu(false);
      f.detectChanges();
    }
  });
});

describe('SvToolbarComponent — focus inside the open menu (X-10)', () => {
  it('a focused item that is removed hands focus to the item now in its place', async () => {
    const f = await setup();
    await open(f);
    expect(items().map(label)).toEqual(['Delta', 'Echo', 'Foxtrot']);
    const delta = items()[0];
    delta.focus();
    expect(document.activeElement).toBe(delta);

    f.componentInstance.actions.set(ACTIONS.filter((a) => a.id !== 'd'));
    await settle(f);

    expect(menu()).toBeTruthy();
    expect(label(document.activeElement)).toBe('Foxtrot');
    expect(document.activeElement).not.toBe(document.body);
  });

  it('the last item removed while focused hands focus to the one before it', async () => {
    const f = await setup();
    await open(f);
    items()[2].focus();

    // Foxtrot leaves the menu; Delta is the only enabled item left.
    f.componentInstance.actions.set(ACTIONS.filter((a) => a.id !== 'f'));
    await settle(f);

    expect(label(document.activeElement)).toBe('Delta');
  });

  it('a focused item that turns busy (disabled) does not keep a dead focus', async () => {
    const f = await setup();
    await open(f);
    items()[0].focus();

    f.componentInstance.busy.set(['d']);
    await settle(f);

    expect(items()[0].disabled).toBe(true);
    expect(label(document.activeElement)).toBe('Foxtrot');
  });

  it('leaves focus alone when an item it is not on changes', async () => {
    const f = await setup();
    await open(f);
    const delta = items()[0];
    delta.focus();

    f.componentInstance.busy.set(['f']);
    await settle(f);

    expect(document.activeElement).toBe(delta);
  });

  it('a menu emptied while focused sends focus to the toolbar tab stop, never <body>', async () => {
    const f = await setup();
    await open(f);
    items()[0].focus();

    f.componentInstance.actions.set(ACTIONS.slice(0, 3));
    await settle(f);

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(strip(f).querySelector('[data-action-id="a"]'));
  });
});

describe('SvToolbarComponent — floatingAnchor (X-5)', () => {
  it('registers nothing and renders no hook by default', async () => {
    const f = await setup(400);
    expect(TestBed.inject(SvFloatingLayerService).regions()).toEqual([]);
    expect(strip(f).hasAttribute('data-sv-floating')).toBe(false);
    expect(strip(f).getAttribute('style')).toBeNull();
  });

  it('registers the strip on the chosen edge so corner controls clear it', async () => {
    const f = await setup(400);
    const layer = TestBed.inject(SvFloatingLayerService);
    const fab = layer.register({ anchor: 'top-right', height: 56, order: 10, label: 'fab' });
    expect(fab.offset()).toBe(0);

    f.componentInstance.anchor.set('top');
    await settle(f);

    const region = layer.regions().find((r) => r.label === 'toolbar');
    expect(region?.anchor).toBe('top');
    expect(region?.height).toBe(48);
    expect(strip(f).getAttribute('data-sv-floating')).toBe('top');
    expect(fab.offset()).toBe(48 + layer.gap);

    f.componentInstance.anchor.set(null);
    await settle(f);
    expect(layer.regions().some((r) => r.label === 'toolbar')).toBe(false);
    expect(strip(f).hasAttribute('data-sv-floating')).toBe(false);
    fab.release();
  });

  it('leaves the layer when destroyed', async () => {
    const f = await setup(400);
    f.componentInstance.anchor.set('top');
    await settle(f);
    const layer = TestBed.inject(SvFloatingLayerService);
    expect(layer.regions().some((r) => r.label === 'toolbar')).toBe(true);
    f.destroy();
    expect(layer.regions().some((r) => r.label === 'toolbar')).toBe(false);
  });
});
