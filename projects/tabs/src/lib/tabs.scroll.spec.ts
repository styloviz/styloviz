import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvTabsComponent, type TabItem } from './tabs.component';

/**
 * ★ The previous / next arrows of a `scrollable` strip, and icon-only tabs (FL-G1).
 *
 * A strip with more tabs than room scrolled, but only for a trackpad or a
 * keyboard: a mouse had a hidden scrollbar and nothing to press. The arrows
 * appear while the tabs overflow, each one only while its end still hides
 * tabs, and they stay out of the tablist and the tab order — the arrow keys
 * already walk the strip.
 */

const MANY: TabItem[] = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}`, label: `Tab ${i + 1}` }));

@Component({
  imports: [SvTabsComponent],
  template: `<div [attr.dir]="dir()">
    <sv-tabs [tabs]="tabs()" [scrollable]="scrollable()" [scrollButtons]="buttons()" [layout]="layout()" />
  </div>`,
})
class HostComponent {
  readonly tabs = signal<TabItem[]>(MANY);
  readonly scrollable = signal(true);
  readonly buttons = signal(true);
  readonly layout = signal<'horizontal' | 'vertical'>('horizontal');
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const root = (f: Fixture) => f.nativeElement as HTMLElement;
const strip = (f: Fixture) => root(f).querySelector<HTMLElement>('[role="tablist"]')!;
const arrow = (f: Fixture, end: 'start' | 'end') =>
  root(f).querySelector<HTMLButtonElement>(`[data-sv-tabs-scroll="${end}"]`);

/** jsdom lays nothing out, so the strip's geometry is given, then a scroll re-measures it. */
function layOut(f: Fixture, { content, box, at = 0 }: { content: number; box: number; at?: number }) {
  const el = strip(f);
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => content });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => box });
  // jsdom clamps nothing and keeps no negative offsets; RTL needs one.
  let left = at;
  Object.defineProperty(el, 'scrollLeft', { configurable: true, get: () => left, set: (v: number) => (left = v) });
  el.dispatchEvent(new Event('scroll'));
  f.detectChanges();
}

describe('SvTabsComponent — scroll arrows (FL-G1)', () => {
  it('draws no arrows while the tabs fit', async () => {
    const f = await setup();
    layOut(f, { content: 300, box: 300 });
    expect(arrow(f, 'start')).toBeNull();
    expect(arrow(f, 'end')).toBeNull();
  });

  it('draws both once they overflow, each visible only while its end hides tabs', async () => {
    const f = await setup();
    layOut(f, { content: 900, box: 300 });
    expect(arrow(f, 'start')!.classList).toContain('invisible');
    expect(arrow(f, 'end')!.classList).not.toContain('invisible');

    layOut(f, { content: 900, box: 300, at: 300 });
    expect(arrow(f, 'start')!.classList).not.toContain('invisible');
    expect(arrow(f, 'end')!.classList).not.toContain('invisible');

    layOut(f, { content: 900, box: 300, at: 600 });
    expect(arrow(f, 'end')!.classList).toContain('invisible');
  });

  it('keeps the arrows out of the tablist and the tab order', async () => {
    const f = await setup();
    layOut(f, { content: 900, box: 300 });
    for (const end of ['start', 'end'] as const) {
      const button = arrow(f, end)!;
      expect(strip(f).contains(button)).toBe(false);
      expect(button.getAttribute('tabindex')).toBe('-1');
      expect(button.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('scrolls most of a width towards the end, and towards the start', async () => {
    const f = await setup();
    layOut(f, { content: 900, box: 300, at: 300 });
    const scrollBy = vi.fn();
    strip(f).scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
    arrow(f, 'end')!.click();
    arrow(f, 'start')!.click();
    expect(scrollBy.mock.calls.map(([o]) => (o as ScrollToOptions).left)).toEqual([240, -240]);
  });

  it('under dir="rtl" the end is to the left, so "next" scrolls left', async () => {
    const f = await setup();
    f.componentInstance.dir.set('rtl');
    f.detectChanges();
    // RTL scrollLeft runs from 0 towards -max.
    layOut(f, { content: 900, box: 300, at: -300 });
    expect(arrow(f, 'start')!.classList).not.toContain('invisible');
    const scrollBy = vi.fn();
    strip(f).scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
    arrow(f, 'end')!.click();
    expect((scrollBy.mock.calls[0][0] as ScrollToOptions).left).toBe(-240);
  });

  it('draws none when scrollButtons is off, the strip is not scrollable, or it is vertical', async () => {
    const f = await setup();
    f.componentInstance.buttons.set(false);
    f.detectChanges();
    layOut(f, { content: 900, box: 300 });
    expect(arrow(f, 'end')).toBeNull();

    f.componentInstance.buttons.set(true);
    f.componentInstance.scrollable.set(false);
    f.detectChanges();
    layOut(f, { content: 900, box: 300 });
    expect(arrow(f, 'end')).toBeNull();

    f.componentInstance.scrollable.set(true);
    f.componentInstance.layout.set('vertical');
    f.detectChanges();
    layOut(f, { content: 900, box: 300 });
    expect(arrow(f, 'end')).toBeNull();
  });
});

describe('SvTabsComponent — icon-only tabs (FL-G1)', () => {
  it('draws the icon, keeps the label as the name and the hover title', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvTabsComponent, {
      inputs: {
        tabs: [
          { id: 'grid', label: 'Grid view', icon: 'grid', iconOnly: true },
          { id: 'list', label: 'List view', iconOnly: true },
        ],
      },
    });
    const [grid, list] = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(grid.querySelector('sv-icon')).not.toBeNull();
    expect(grid.querySelector('.sr-only')?.textContent?.trim()).toBe('Grid view');
    expect(grid.getAttribute('title')).toBe('Grid view');
    // No icon to stand in for it: the label is drawn as usual.
    expect(list.querySelector('.sr-only')).toBeNull();
    expect(list.textContent?.trim()).toBe('List view');
    expect(list.hasAttribute('title')).toBe(false);
  });
});
