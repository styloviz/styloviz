import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTabsComponent, SvTabPanelDirective, type TabItem, type TabsLazyRetention } from './tabs.component';

/**
 * ============================================================================
 *  Inactive panels and find-in-page — FL-J3-NV-04 (`X-20`, `NV-06-I13`)
 * ============================================================================
 *
 * An inactive mounted panel carries `hidden="until-found"` (where the browser
 * has it) instead of `display: none`, so `Ctrl+F` reaches it; the browser's
 * `beforematch` selects the tab. jsdom implements no find-in-page, so — as in
 * `accordion.findable.spec.ts` — what is pinned is what the component decides,
 * with the browser capability installed or removed explicitly.
 */

function swapProbe(descriptor: PropertyDescriptor | undefined): () => void {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(proto, 'onbeforematch');
  if (descriptor === undefined) delete proto['onbeforematch'];
  else Object.defineProperty(proto, 'onbeforematch', descriptor);
  return () => {
    delete proto['onbeforematch'];
    if (original) Object.defineProperty(proto, 'onbeforematch', original);
  };
}

const TABS: TabItem[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'lazy', label: 'Lazy', lazy: true },
  { id: 'off', label: 'Off', disabled: true },
];

@Component({
  imports: [SvTabsComponent, SvTabPanelDirective],
  template: `
    <sv-tabs [tabs]="tabs" [(activeId)]="active" [findInPage]="findable()" [lazyRetention]="retention()">
      <ng-template svTabPanel="one">First body</ng-template>
      <ng-template svTabPanel="two">Second body</ng-template>
      <ng-template svTabPanel="lazy">Lazy body</ng-template>
      <ng-template svTabPanel="off">Disabled body</ng-template>
    </sv-tabs>
  `,
})
class HostComponent {
  readonly tabs = TABS;
  active = 'one';
  readonly findable = signal(true);
  readonly retention = signal<TabsLazyRetention>('retain');
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.detectChanges();
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;
const panel = (f: Fixture, text: string) =>
  [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]')].find((p) =>
    p.textContent?.includes(text),
  );
const selected = (f: Fixture) =>
  (f.nativeElement as HTMLElement).querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim();

describe('SvTabsComponent — findable inactive panels (FL-J3-NV-04)', () => {
  let restore: () => void;
  beforeEach(() => (restore = swapProbe({ value: null, writable: true, configurable: true })));
  afterEach(() => restore());

  it('an inactive mounted panel is hidden="until-found", not display:none; the active one is neither', async () => {
    const f = await setup();
    const two = panel(f, 'Second body')!;
    expect(two.getAttribute('hidden')).toBe('until-found');
    expect(two.classList.contains('hidden')).toBe(false);
    const one = panel(f, 'First body')!;
    expect(one.hasAttribute('hidden')).toBe(false);
    expect(one.classList.contains('block')).toBe(true);
  });

  it('beforematch selects the tab whose panel the browser revealed', async () => {
    const f = await setup();
    const two = panel(f, 'Second body')!;
    two.removeAttribute('hidden'); // what the browser does
    two.dispatchEvent(new Event('beforematch'));
    f.detectChanges();
    expect(selected(f)).toBe('Two');
    expect(f.componentInstance.active).toBe('two');
    expect(panel(f, 'First body')!.getAttribute('hidden')).toBe('until-found');
  });

  it('a disabled tab\'s panel is never findable (still display:none)', async () => {
    const f = await setup();
    const off = panel(f, 'Disabled body')!;
    expect(off.hasAttribute('hidden')).toBe(false);
    expect(off.classList.contains('hidden')).toBe(true);
  });

  it('lazy modes are untouched: an unvisited lazy panel is not in the DOM; destroy drops it after a visit', async () => {
    const f = await setup();
    expect(panel(f, 'Lazy body')).toBeUndefined();
    const tab = (label: string) =>
      [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent?.trim() === label)!;
    tab('Lazy').click();
    f.detectChanges();
    tab('One').click();
    f.detectChanges();
    // retain: visited, mounted, findable
    expect(panel(f, 'Lazy body')!.getAttribute('hidden')).toBe('until-found');
    f.componentInstance.retention.set('destroy');
    f.detectChanges();
    expect(panel(f, 'Lazy body')).toBeUndefined();
  });

  it('findInPage=false falls back to display:none', async () => {
    const f = await setup();
    f.componentInstance.findable.set(false);
    f.detectChanges();
    const two = panel(f, 'Second body')!;
    expect(two.hasAttribute('hidden')).toBe(false);
    expect(two.classList.contains('hidden')).toBe(true);
  });
});

describe('SvTabsComponent — a browser without until-found (FL-J3-NV-04)', () => {
  let restore: () => void;
  beforeEach(() => (restore = swapProbe(undefined)));
  afterEach(() => restore());

  it('keeps inactive panels display:none, exactly as before', async () => {
    const f = await setup();
    const two = panel(f, 'Second body')!;
    expect(two.hasAttribute('hidden')).toBe(false);
    expect(two.classList.contains('hidden')).toBe(true);
  });
});
