import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import type { MenuGroup } from '@styloviz/core';
import { SvSidebarComponent } from './sidebar.component';
import { until } from '../../../../src/testing/async';

/**
 * The sidebar's sub-navigation is driven entirely off the URL: which item is
 * expanded comes from the path, which child is selected comes from `?c=`. That
 * makes the interesting cases the ones with no `?c=` at all, a `?c=` naming a
 * child that is not rendered, and an id needing escaping before it can go into
 * a selector.
 */

const GROUPS: MenuGroup[] = [
  {
    groupLabel: 'Overview',
    items: [
      {
        label: 'Components',
        route: '/components',
        icon: 'cube',
        childGroups: [
          { label: 'Forms', items: [{ id: 'input-field', label: 'Input Field' }, { id: 'select', label: 'Select' }] },
        ],
      },
      { label: 'Reports', route: '/reports', icon: 'book' },
    ],
  },
];

async function setup(url: string, inputs: Partial<ComponentInput<SvSidebarComponent>> = {}) {
  TestBed.resetTestingModule();
  const rendered = await render(SvSidebarComponent, {
    inputs: { menuGroups: GROUPS, ...inputs } as ComponentInput<SvSidebarComponent>,
    providers: [provideRouter([{ path: '**', children: [] }])],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  rendered.fixture.detectChanges();
  return rendered;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

/**
 * jsdom has no `CSS` global at all, so `CSS.escape` — which the component uses
 * to build the `[data-nav-item="…"]` selector — throws inside a
 * requestAnimationFrame callback where nothing can catch it, and every test
 * below would pass vacuously. Every browser the kit supports ships it; this is
 * an environment gap, not a component defect, so a faithful stub is installed
 * rather than the component being changed.
 */
// Cast right through `globalThis`: an intersection keeps the real `CSS`
// declaration, and this double is only the one method the component uses.
const g = globalThis as unknown as { CSS?: { escape(v: string): string } };
let hadCss = false;
beforeAll(() => {
  hadCss = typeof g.CSS !== 'undefined';
  if (!hadCss) g.CSS = { escape: (v: string) => v.replace(/["\\]/g, '\\$&') };
});
afterAll(() => {
  if (!hadCss) delete g.CSS;
});

describe('SvSidebarComponent — sub-navigation driven by the URL', () => {
  it('expands the sub-navigation only for the section the URL is in', async () => {
    const off = await setup('/reports');
    expect(el(off.fixture).querySelector('[data-nav-item]')).toBeNull();

    const on = await setup('/components');
    expect(el(on.fixture).querySelectorAll('[data-nav-item]').length).toBe(2);
  });

  it('reads the selected child out of the query string', async () => {
    const { fixture } = await setup('/components?c=select');
    expect(fixture.componentInstance.activeChildId()).toBe('select');
  });

  it('decodes a child id that had to be escaped in the URL', async () => {
    const { fixture } = await setup('/components?c=a%2Fb');
    expect(fixture.componentInstance.activeChildId()).toBe('a/b');
  });

  /** A bare section URL shows the overview, so nothing may look selected. */
  it('selects nothing when the URL names no child', async () => {
    const { fixture } = await setup('/components');
    expect(fixture.componentInstance.activeChildId()).toBeNull();
    expect(el(fixture).querySelector('[aria-current="page"]')).toBeNull();
  });

  it('marks exactly the named child as the current page', async () => {
    const { fixture } = await setup('/components?c=select');
    const current = el(fixture).querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('data-nav-item')).toBe('select');
  });

  it('styles the selected child apart from its siblings', async () => {
    const { fixture } = await setup('/components?c=select');
    const c = fixture.componentInstance;
    expect(c.childItemClass('select')).toContain('bg-primary-50');
    expect(c.childItemClass('input-field')).not.toContain('bg-primary-50');
    expect(c.childItemClass('input-field')).toContain('text-gray-500');
  });

  it('knows which section it is in', async () => {
    const { fixture } = await setup('/components?c=select');
    expect(fixture.componentInstance.isOnRoute('/components')).toBe(true);
    expect(fixture.componentInstance.isOnRoute('/reports')).toBe(false);
  });

  /** Collapsed there is no room for sub-navigation, whatever the URL says. */
  it('hides the sub-navigation when collapsed even on its own route', async () => {
    const { fixture } = await setup('/components?c=select', { collapsed: true });
    expect(el(fixture).querySelector('[data-nav-item]')).toBeNull();
    expect(fixture.componentInstance.activeChildId()).toBe('select');
  });
});

describe('SvSidebarComponent — keeping the selection in view', () => {
  /**
   * jsdom has no layout and no `scrollIntoView`, so the assertion is on the
   * CALL, not on any resulting position — a zero-size measurement here would
   * mean nothing. What is worth pinning is that it targets the right element
   * and honours the reduced-motion preference.
   */
  it('scrolls the selected child into the middle of the rail', async () => {
    const calls: ScrollIntoViewOptions[] = [];
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const original = proto['scrollIntoView'];
    proto['scrollIntoView'] = function (this: Element, opts: ScrollIntoViewOptions) {
      if (this.getAttribute('data-nav-item')) calls.push(opts);
    };
    try {
      await setup('/components?c=select');
      await until(() => calls.length > 0, { label: 'the active child to be scrolled into view' });
      expect(calls[0].block).toBe('center');
      expect(calls[0].behavior).toBe('smooth');
    } finally {
      if (original) proto['scrollIntoView'] = original;
      else delete proto['scrollIntoView'];
    }
  });

  it('jumps instead of animating when the user asked for reduced motion', async () => {
    const calls: ScrollIntoViewOptions[] = [];
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const original = proto['scrollIntoView'];
    proto['scrollIntoView'] = function (this: Element, opts: ScrollIntoViewOptions) {
      if (this.getAttribute('data-nav-item')) calls.push(opts);
    };
    // jsdom ships no matchMedia at all, so the component's `typeof` guard
    // short-circuits and reduced motion is unreachable until one is supplied.
    const win = window as unknown as { matchMedia?: (q: string) => MediaQueryList };
    const originalMm = win.matchMedia;
    win.matchMedia = (q: string) => ({ matches: q.includes('reduced-motion'), media: q }) as MediaQueryList;
    try {
      await setup('/components?c=select');
      await until(() => calls.length > 0, { label: 'the active child to be scrolled into view' });
      expect(calls[0].behavior).toBe('auto');
    } finally {
      if (originalMm) win.matchMedia = originalMm;
      else delete win.matchMedia;
      if (original) proto['scrollIntoView'] = original;
      else delete proto['scrollIntoView'];
    }
  });

  /**
   * The negative: `?c=` naming a child that is not rendered (wrong section,
   * collapsed rail, stale bookmark) must scroll nothing rather than throw out
   * of a requestAnimationFrame callback, where no test could catch it.
   */
  it('scrolls nothing when the named child is not on screen', async () => {
    let calls = 0;
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const original = proto['scrollIntoView'];
    proto['scrollIntoView'] = function () { calls++; };
    try {
      await setup('/components?c=no-such-child');
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      expect(calls).toBe(0);
    } finally {
      if (original) proto['scrollIntoView'] = original;
      else delete proto['scrollIntoView'];
    }
  });
});
