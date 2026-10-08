import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  provideSvNavLocation,
  svNoopNavLocation,
  svQueryParamNavLocation,
} from '@styloviz/core';
import { SvTabsComponent, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  URL synchronisation — `NV-06-I5`, `NV-06-M3`
 * ============================================================================
 *
 * "Refresh a settings page and you are back on the first tab" is the failure the
 * audit named, and a link to *the Billing tab* is the feature nobody could write.
 * Both halves of the opt-in are asserted here, including the case where only one
 * is present — which has to be inert rather than half-wired.
 *
 * The decision this file exists to protect is in
 * *"accepts a tab the definitions do not name yet"*: membership is not validated,
 * because `tabs()` is `[]` until a fetch lands and validating there would drop
 * every deep link in an app whose tabs come from the server.
 */

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'billing', label: 'Billing', disabled: true },
  { id: 'team', label: 'Team' },
];

function at(url: string): void {
  window.history.replaceState(null, '', url);
}

beforeEach(() => at('/settings'));

async function setup(
  inputs: Partial<ComponentInput<SvTabsComponent>> = {},
  addressable = true,
) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTabsComponent, {
    inputs: { tabs: TABS, ...inputs } as ComponentInput<SvTabsComponent>,
    providers: [
      provideSvNavLocation(addressable ? svQueryParamNavLocation() : svNoopNavLocation()),
    ],
  });
  return fixture;
}

const query = () => new URLSearchParams(window.location.search);
const select = (f: { componentInstance: SvTabsComponent }, id: string) =>
  f.componentInstance.selectTab(TABS.find((t) => t.id === id)!);

describe('SvTabsComponent — opting in', () => {
  /** No key: this instance does not own a parameter, whatever the app provided. */
  it('touches no URL without a urlKey', async () => {
    const f = await setup();
    select(f, 'team');
    f.detectChanges();
    expect(window.location.search).toBe('');
    expect(f.componentInstance.resolvedActiveId()).toBe('team');
  });

  /** No location: the key is set but the app never opted in. */
  it('touches no URL without a provided location', async () => {
    const f = await setup({ urlKey: 'tab' }, false);
    select(f, 'team');
    f.detectChanges();
    expect(window.location.search).toBe('');
    expect(f.componentInstance.resolvedActiveId()).toBe('team');
  });

  it('writes the active tab once both halves are in place', async () => {
    const f = await setup({ urlKey: 'tab' });
    select(f, 'security');
    f.detectChanges();
    expect(query().get('tab')).toBe('security');
  });

  /**
   * A tabbed panel inside a tabbed page is an ordinary layout, which is why the
   * key is an input rather than a constant — two strips cannot both own `?tab`.
   */
  it('lets two strips own different keys', async () => {
    const outer = await setup({ urlKey: 'tab' });
    select(outer, 'security');
    outer.detectChanges();

    TestBed.resetTestingModule();
    const { fixture: inner } = await render(SvTabsComponent, {
      inputs: { tabs: TABS, urlKey: 'section' } as ComponentInput<SvTabsComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    inner.componentInstance.selectTab(TABS[3]);
    inner.detectChanges();

    expect(query().get('tab')).toBe('security');
    expect(query().get('section')).toBe('team');
  });
});

describe('SvTabsComponent — component to URL', () => {
  /**
   * The first enabled tab is what this component renders with no `activeId` at
   * all, so it is absent rather than written. A URL carrying its own defaults
   * makes two identical pages look like two different ones to analytics and to a
   * cache.
   */
  it('omits the first enabled tab rather than writing ?tab=general', async () => {
    const f = await setup({ urlKey: 'tab' });
    expect(query().has('tab')).toBe(false);

    select(f, 'team');
    f.detectChanges();
    expect(query().get('tab')).toBe('team');

    select(f, 'general');
    f.detectChanges();
    expect(query().has('tab')).toBe(false);
  });

  /**
   * ★ The opposite of `sv-pagination`'s answer on the same seam, and deliberately
   * so. Paging forward is a step through a result set; switching tabs is choosing
   * a view of one thing, and a reader who pressed back after reading three tabs
   * means "leave this page", not "undo two of my clicks".
   */
  it('replaces rather than pushing, so back still leaves the page', async () => {
    const f = await setup({ urlKey: 'tab' });
    const before = window.history.length;

    select(f, 'security');
    f.detectChanges();
    select(f, 'team');
    f.detectChanges();

    expect(query().get('tab')).toBe('team');
    expect(window.history.length).toBe(before);
  });

  it('leaves the path and other query keys alone', async () => {
    at('/settings?org=acme&ref=email');
    const f = await setup({ urlKey: 'tab' });
    select(f, 'team');
    f.detectChanges();

    expect(window.location.pathname).toBe('/settings');
    expect(query().get('org')).toBe('acme');
    expect(query().get('ref')).toBe('email');
  });
});

describe('SvTabsComponent — URL to component', () => {
  it('opens the tab the URL named', async () => {
    at('/settings?tab=team');
    const f = await setup({ urlKey: 'tab' });

    expect(f.componentInstance.resolvedActiveId()).toBe('team');
    const selected = (f.nativeElement as HTMLElement).querySelector('[aria-selected="true"]');
    expect(selected?.textContent?.trim()).toBe('Team');
  });

  it('follows the address bar changing under it', async () => {
    at('/settings?tab=team');
    const f = await setup({ urlKey: 'tab' });
    expect(f.componentInstance.resolvedActiveId()).toBe('team');

    at('/settings?tab=security');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect(f.componentInstance.resolvedActiveId()).toBe('security');
  });

  /**
   * ★ The decision this file exists to protect. The obvious implementation
   * refuses an id absent from `tabs()` — and drops every deep link in an app whose
   * tab definitions arrive with a fetch, because `tabs()` is `[]` at first render
   * and *every* id is unknown at that moment. Same shape as `sv-pagination`
   * refusing to clamp against a total it does not have yet: validate the value's
   * form, never its membership of a collection that may not have arrived.
   */
  it('accepts a tab the definitions do not name yet', async () => {
    at('/settings?tab=team');
    const f = await setup({ urlKey: 'tab', tabs: [] });

    expect(f.componentInstance.activeId()).toBe('team');

    f.componentRef.setInput('tabs', TABS);
    f.detectChanges();
    expect(f.componentInstance.resolvedActiveId()).toBe('team');
  });

  /**
   * The other side of that line: a tab this component *can* see and would not let
   * a click reach. Refusing what is known to be refusable keeps a URL from walking
   * through a gate the UI closes, without guessing about what is merely not here
   * yet.
   */
  it('refuses a tab it can see is disabled', async () => {
    at('/settings?tab=billing');
    const f = await setup({ urlKey: 'tab' });

    expect(f.componentInstance.resolvedActiveId()).toBe('general');
  });

  /** A lazy panel arrived at by link is a first activation exactly as a click is. */
  it('mounts a lazy panel reached by deep link', async () => {
    at('/settings?tab=team');
    const f = await setup({
      urlKey: 'tab',
      tabs: TABS.map((t) => (t.id === 'team' ? { ...t, lazy: true } : t)),
    });

    expect(f.componentInstance.isPanelMounted({ id: 'team', label: 'Team', lazy: true })).toBe(
      true,
    );
  });

  it('ignores an empty value and keeps its own default', async () => {
    at('/settings?tab=');
    const f = await setup({ urlKey: 'tab' });
    expect(f.componentInstance.resolvedActiveId()).toBe('general');
  });
});
