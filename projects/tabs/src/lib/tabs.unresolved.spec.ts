import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import type { SvUnresolvedValue } from '@styloviz/core';
import { SvTabsComponent, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  Controlled-value reconciliation — `X-10`, `NV-06-I3`
 * ============================================================================
 *
 * ★ **An active tab id is NOMINAL, so this family reports and never corrects.**
 * `sv-pagination` does the opposite on the same question, and the difference is
 * the kind of value: page 7 of 3 has a nearest valid value and it is obviously 3,
 * but `activeId="xyz"` has no nearest tab. Substituting the first one is a guess
 * about what the host meant, and **a guess that renders confidently is worse than
 * rendering nothing** — nothing is visibly wrong, and a wrong tab is not.
 *
 * So the tested contract is unchanged: *"the host owns `activeId`; the fallback
 * only applies when it is empty."* `NV-06-I3` was never an oversight. What was
 * missing is the second half — the host was never TOLD, which is what made it
 * silent.
 */

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'billing', label: 'Billing', disabled: true },
];

async function setup(inputs: Partial<ComponentInput<SvTabsComponent>> = {}) {
  TestBed.resetTestingModule();
  const seen: SvUnresolvedValue<string>[] = [];
  const { fixture } = await render(SvTabsComponent, {
    inputs: { tabs: TABS, ...inputs } as ComponentInput<SvTabsComponent>,
    on: { unresolved: (e: SvUnresolvedValue<string>) => seen.push(e) },
  });
  return { fixture, seen };
}

describe('SvTabsComponent — a tab that exists', () => {
  it('says nothing', async () => {
    const { seen } = await setup({ activeId: 'security' });
    expect(seen).toEqual([]);
  });

  /** No claim to honour — `resolvedActiveId` falls back, as documented. */
  it('says nothing for the empty default', async () => {
    const { seen } = await setup();
    expect(seen).toEqual([]);
  });
});

describe('SvTabsComponent — a tab that does not exist', () => {
  /**
   * ★ Still no panel, and still no substitution. What is new is that the host
   * finds out.
   */
  it('reports without correcting, and keeps showing nothing', async () => {
    const { fixture, seen } = await setup({ activeId: 'xyz' });

    expect(fixture.componentInstance.activeId()).toBe('xyz');
    expect(fixture.componentInstance.resolvedActiveId()).toBe('xyz');
    // Non-lazy panels are mounted and hidden, so the assertion is about
    // visibility rather than presence — the same one `tabs.styles.spec.ts` makes.
    expect(TABS.every((t) => !fixture.componentInstance.isPanelVisible(t))).toBe(true);

    expect(seen).toEqual([
      { requested: 'xyz', rendered: null, reason: 'unknown', corrected: false },
    ]);
  });

  it('does not re-report on every change detection pass', async () => {
    const { fixture, seen } = await setup({ activeId: 'xyz' });
    fixture.detectChanges();
    fixture.detectChanges();
    expect(seen).toHaveLength(1);
  });

  it('goes quiet once the tab appears', async () => {
    const { fixture, seen } = await setup({ activeId: 'archive' });
    expect(seen).toHaveLength(1);

    fixture.componentRef.setInput('tabs', [...TABS, { id: 'archive', label: 'Archive' }]);
    fixture.detectChanges();

    expect(seen).toHaveLength(1);
    expect(fixture.componentInstance.resolvedActiveId()).toBe('archive');
  });
});

describe('SvTabsComponent — before the tabs have arrived', () => {
  /**
   * ★ `tabs()` is `[]` until a fetch lands, and every id is unknown at that
   * moment. Calling that `'unknown'` would cry wolf on every async host on first
   * paint, so it is reported as what it is.
   */
  it('reports not-loaded rather than unknown', async () => {
    const { seen } = await setup({ tabs: [], activeId: 'security' });
    expect(seen).toEqual([
      { requested: 'security', rendered: null, reason: 'not-loaded', corrected: false },
    ]);
  });

  it('re-reports as unknown once the tabs arrive without it', async () => {
    const { fixture, seen } = await setup({ tabs: [], activeId: 'ghost' });
    expect(seen.at(-1)?.reason).toBe('not-loaded');

    fixture.componentRef.setInput('tabs', TABS);
    fixture.detectChanges();

    expect(seen.at(-1)?.reason).toBe('unknown');
  });
});

describe('SvTabsComponent — a tab the host is not letting anyone click', () => {
  /**
   * The contract honours a bound id even when it names a disabled tab — that is
   * asserted twice in `tabs.styles.spec.ts`. The host is now told its own rule was
   * bypassed, rather than the component quietly picking a side.
   */
  it('reports blocked, and still shows the tab', async () => {
    const { fixture, seen } = await setup({ activeId: 'billing' });

    expect(fixture.componentInstance.resolvedActiveId()).toBe('billing');
    expect(seen).toEqual([
      { requested: 'billing', rendered: 'billing', reason: 'blocked', corrected: false },
    ]);
  });
});
