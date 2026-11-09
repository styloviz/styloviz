import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTabsComponent, type TabItem } from './tabs.component';

/**
 * ============================================================================
 *  Left / Right follow the reading direction — FL-J3-NV-01 (`X-16`)
 * ============================================================================
 *
 * A horizontal strip is a flex row, so under `dir="rtl"` the first tab is on
 * the RIGHT. ArrowRight used to mean "next in DOM order" regardless, which in
 * RTL moves focus to the left-hand neighbour's opposite — backwards. The
 * direction is read from the host, so a `dir="rtl"` ANCESTOR is what flips it
 * (the component never needs its own input).
 */

const TABS: TabItem[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

@Component({
  imports: [SvTabsComponent],
  template: `<div [attr.dir]="dir()"><sv-tabs [tabs]="tabs" [layout]="layout()" /></div>`,
})
class HostComponent {
  readonly tabs = TABS;
  readonly dir = signal<'rtl' | 'ltr'>('rtl');
  readonly layout = signal<'horizontal' | 'vertical'>('horizontal');
}

async function setup(dir: 'rtl' | 'ltr' = 'rtl', layout: 'horizontal' | 'vertical' = 'horizontal') {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.componentInstance.dir.set(dir);
  fixture.componentInstance.layout.set(layout);
  fixture.detectChanges();
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const tabsOf = (f: Fixture) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];

function press(f: Fixture, from: number, key: string): boolean {
  const btn = tabsOf(f)[from];
  btn.focus();
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  btn.dispatchEvent(event);
  f.detectChanges();
  return event.defaultPrevented;
}

const focusedLabel = () => (document.activeElement as HTMLElement | null)?.textContent?.trim();
const selectedLabel = (f: Fixture) =>
  tabsOf(f).find((b) => b.getAttribute('aria-selected') === 'true')?.textContent?.trim();

describe('SvTabsComponent — RTL arrow keys (FL-J3-NV-01)', () => {
  it('ArrowLeft moves to the NEXT tab under a dir="rtl" ancestor', async () => {
    const f = await setup('rtl');
    expect(press(f, 0, 'ArrowLeft')).toBe(true);
    expect(focusedLabel()).toBe('Two');
    expect(selectedLabel(f)).toBe('Two');
  });

  it('ArrowRight moves to the PREVIOUS tab under dir="rtl", wrapping at the start', async () => {
    const f = await setup('rtl');
    press(f, 0, 'ArrowRight');
    expect(focusedLabel()).toBe('Three');
    press(f, 2, 'ArrowRight');
    expect(focusedLabel()).toBe('Two');
  });

  it('Home / End are logical and unchanged in RTL', async () => {
    const f = await setup('rtl');
    press(f, 1, 'End');
    expect(focusedLabel()).toBe('Three');
    press(f, 2, 'Home');
    expect(focusedLabel()).toBe('One');
  });

  it('keeps the LTR mapping when the ancestor is dir="ltr"', async () => {
    const f = await setup('ltr');
    press(f, 0, 'ArrowRight');
    expect(focusedLabel()).toBe('Two');
    press(f, 1, 'ArrowLeft');
    expect(focusedLabel()).toBe('One');
  });

  it('a vertical strip keeps Up/Down in RTL and ignores Left/Right', async () => {
    const f = await setup('rtl', 'vertical');
    expect(press(f, 0, 'ArrowLeft')).toBe(false);
    expect(press(f, 0, 'ArrowDown')).toBe(true);
    expect(focusedLabel()).toBe('Two');
  });
});
