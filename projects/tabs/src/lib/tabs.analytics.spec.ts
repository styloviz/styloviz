import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SV_NAV_TELEMETRY,
  provideSvNavLocation,
  svQueryParamNavLocation,
  svResetWarnOnce,
  type SvNavEvent,
  type SvNavTelemetry,
} from '@styloviz/core';
import { SvTabsComponent, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  `X-15` — tabs on the shared navigation stream
 * ============================================================================
 *
 * ★ A tabset is where `advance`/`retreat` versus `jump` says the most:
 *   arrowing along a strip and clicking the fifth tab reach the same
 *   destination two different ways, and only one of them means somebody was
 *   reading in order. A rule that called every selection `jump` would throw
 *   that away, and nothing else in the event could recover it.
 */

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
  { id: 'billing', label: 'Billing', disabled: true },
];

function sink(retention = '30d', granted = true) {
  const seen: SvNavEvent[] = [];
  const provided: SvNavTelemetry = {
    kind: 'spec',
    retention,
    consent: () => granted,
    record: (e) => seen.push(e),
  };
  return { seen, provided };
}

async function setup(
  inputs: Partial<ComponentInput<SvTabsComponent>> = {},
  opts: { retention?: string; granted?: boolean; url?: boolean } = {},
) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { seen, provided } = sink(opts.retention ?? '30d', opts.granted ?? true);
  const { fixture } = await render(SvTabsComponent, {
    inputs: { tabs: TABS, ...inputs } as ComponentInput<SvTabsComponent>,
    providers: [
      { provide: SV_NAV_TELEMETRY, useValue: provided },
      ...(opts.url ? [provideSvNavLocation(svQueryParamNavLocation)] : []),
    ],
  });
  return { fixture, c: fixture.componentInstance, seen };
}

describe('SvTabsComponent — X-15 intents', () => {
  it('calls the tab to the right `advance` and the one to the left `retreat`', async () => {
    const forward = await setup({ activeId: 'overview' });
    forward.c.selectTab(TABS[1]);

    const back = await setup({ activeId: 'settings' });
    back.c.selectTab(TABS[1]);

    expect(forward.seen.map((e) => e.intent)).toEqual(['advance']);
    expect(back.seen.map((e) => e.intent)).toEqual(['retreat']);
  });

  it('calls a selection two or more away `jump`', async () => {
    const { c, seen } = await setup({ activeId: 'overview' });
    c.selectTab(TABS[2]);
    expect(seen.map((e) => e.intent)).toEqual(['jump']);
  });

  it('carries the surface, id, label and position', async () => {
    const { c, seen } = await setup({ activeId: 'overview', surfaceId: 'account-tabs' });
    c.selectTab(TABS[2]);
    expect(seen[0]).toMatchObject({
      surface: 'tabs',
      surfaceId: 'account-tabs',
      key: 'settings',
      label: 'Settings',
      index: 2,
    });
  });

  it('records nothing for a click on the tab already selected', async () => {
    const { c, seen } = await setup({ activeId: 'activity' });
    c.selectTab(TABS[1]);
    expect(seen).toEqual([]);
  });

  /**
   * ★★ The refusal leaves no other trace: no panel renders, no URL changes,
   *    nothing is emitted. A tabset whose gating is wrong is invisible to
   *    ordinary analytics and one row here.
   */
  it('records a disabled tab as blocked rather than silently doing nothing', async () => {
    const { c, seen } = await setup({ activeId: 'overview' });
    c.selectTab(TABS[3]);
    expect(seen).toEqual([
      expect.objectContaining({ intent: 'blocked', reason: 'disabled', key: 'billing' }),
    ]);
  });
});

describe('SvTabsComponent — X-15 arriving from the address', () => {
  /**
   * ★ `resume`, not `jump`. Nobody pressed a tab — a deep link or the back
   *   button put the reader here, and counting those together with gestures
   *   makes the browser look like the kit's busiest navigation surface.
   */
  it('calls a deep link `resume`', async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'settings');
    window.history.replaceState({}, '', url);

    const { seen } = await setup({ tabs: TABS, urlKey: 'tab' }, { url: true });

    expect(seen.map((e) => e.intent)).toEqual(['resume']);
    expect(seen[0]).toMatchObject({ key: 'settings', label: 'Settings', index: 2 });

    url.searchParams.delete('tab');
    window.history.replaceState({}, '', url);
  });
});

describe('SvTabsComponent — X-15 consent and retention', () => {
  it('records nothing while consent is withheld', async () => {
    const { c, seen } = await setup({ activeId: 'overview' }, { granted: false });
    c.selectTab(TABS[1]);
    c.selectTab(TABS[2]);
    expect(seen).toEqual([]);
  });

  /**
   * ⚠️ A tab id is very often a route segment, which is very often a record
   *    identifier. The component passes it unconditionally and the recorder
   *    strips it — the only arrangement where forgetting is impossible.
   */
  it('reports the move without the id for a sink that declares no retention', async () => {
    const { c, seen } = await setup({ activeId: 'overview' }, { retention: 'none' });
    c.selectTab(TABS[1]);
    expect(seen[0]).toMatchObject({ surface: 'tabs', intent: 'advance', index: 1 });
    expect(seen[0].key).toBeNull();
    expect(seen[0].label).toBeNull();
  });
});
