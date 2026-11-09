import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTabsComponent, SvTabPanelDirective, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  A tabset inside a tabset — FL-J3-NV-02 (`X-18`, `NV-06-I12`)
 * ============================================================================
 *
 * The code already scopes ids (`svUniqueId`) and binds keydown per tab button;
 * this pins the combination. Both strips deliberately use the SAME tab ids, the
 * realistic worst case (a "General" tab at each level).
 */

const OUTER: TabItem[] = [
  { id: 'general', label: 'Outer general' },
  { id: 'advanced', label: 'Outer advanced' },
  { id: 'billing', label: 'Outer billing' },
];
const INNER: TabItem[] = [
  { id: 'general', label: 'Inner general' },
  { id: 'advanced', label: 'Inner advanced' },
];

@Component({
  imports: [SvTabsComponent, SvTabPanelDirective],
  template: `
    <sv-tabs data-level="outer" [tabs]="outer">
      <ng-template svTabPanel="general">
        <sv-tabs data-level="inner" [tabs]="inner">
          <ng-template svTabPanel="general">Inner general body</ng-template>
          <ng-template svTabPanel="advanced">Inner advanced body</ng-template>
        </sv-tabs>
      </ng-template>
      <ng-template svTabPanel="advanced">Outer advanced body</ng-template>
      <ng-template svTabPanel="billing">Outer billing body</ng-template>
    </sv-tabs>
  `,
})
class HostComponent {
  readonly outer = OUTER;
  readonly inner = INNER;
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const outer = root.querySelector<HTMLElement>('[data-level="outer"]')!;
  const inner = root.querySelector<HTMLElement>('[data-level="inner"]')!;
  return { fixture, root, outer, inner };
}

/** The tabs a strip OWNS — its own tablist, not the nested one. */
const ownTabs = (host: HTMLElement) => {
  // Its own: the tablist whose nearest <sv-tabs> is this one — not a fixed DOM path,
  // which a wrapper (FL-G1's scroll arrows) would change.
  const list = [...host.querySelectorAll<HTMLElement>('[role="tablist"]')].find((t) => t.closest('sv-tabs') === host)!;
  return [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')].filter((t) => t.closest('sv-tabs') === host);
};

function press(el: HTMLElement, key: string): KeyboardEvent {
  el.focus();
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('SvTabsComponent — a tabset in a tabset (FL-J3-NV-02)', () => {
  it('renders both levels with every id unique, though the tab ids repeat', async () => {
    const { root } = await setup();
    const ids = [...root.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('wires aria-controls / aria-labelledby inside each level', async () => {
    const { outer, inner, root } = await setup();
    for (const host of [outer, inner]) {
      for (const tab of ownTabs(host)) {
        const panel = root.querySelector(`[id="${tab.getAttribute('aria-controls')}"]`);
        // An unmounted (never-visited) panel may be absent; a mounted one must point back.
        if (panel) expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
      }
    }
    const innerPanel = root.querySelector(`[id="${ownTabs(inner)[0].getAttribute('aria-controls')}"]`)!;
    expect(innerPanel.textContent).toContain('Inner general body');
    expect(outer.contains(innerPanel)).toBe(true);
  });

  it('arrow keys in the inner strip move within the inner strip only', async () => {
    const { fixture, outer, inner } = await setup();
    const [innerGeneral, innerAdvanced] = ownTabs(inner);
    press(innerGeneral, 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement).toBe(innerAdvanced);
    expect(innerAdvanced.getAttribute('aria-selected')).toBe('true');
    // The outer selection is untouched.
    expect(ownTabs(outer)[0].getAttribute('aria-selected')).toBe('true');
    press(innerAdvanced, 'End');
    fixture.detectChanges();
    expect(document.activeElement).toBe(innerAdvanced);
  });

  it('arrow keys in the outer strip move within the outer strip only', async () => {
    const { fixture, outer, inner } = await setup();
    const outerTabs = ownTabs(outer);
    press(outerTabs[0], 'ArrowLeft');
    fixture.detectChanges();
    expect(document.activeElement).toBe(outerTabs[2]);
    expect(inner.contains(document.activeElement)).toBe(false);
  });

  it('switching the outer tab away and back keeps the inner strip coherent', async () => {
    const { fixture, root } = await setup();
    const outer = root.querySelector<HTMLElement>('[data-level="outer"]')!;
    ownTabs(outer)[1].click();
    fixture.detectChanges();
    ownTabs(outer)[0].click();
    fixture.detectChanges();
    const inner = root.querySelector<HTMLElement>('[data-level="inner"]')!;
    expect(ownTabs(inner).filter((t) => t.tabIndex === 0)).toHaveLength(1);
    const ids = [...root.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
