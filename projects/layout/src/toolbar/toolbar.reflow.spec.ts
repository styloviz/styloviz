import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvToolbarComponent, type ToolbarAction } from './toolbar.component';

/**
 * FL-J3-LU-07 — the toolbar can shrink inside a flex row in EVERY overflow mode.
 *
 * A flex parent blockifies `<sv-toolbar>` into a flex item whose automatic
 * minimum width is its content — the whole strip. In a `flex items-center`
 * row (a label + a toolbar, the gallery's Sizes and Variants demos) the
 * strip's own `max-w-full overflow-x-auto` then resolved against a host as
 * wide as the strip, so `overflow="scroll"` never scrolled: at 320 px the
 * trailing actions were pushed past the card and cut off. jsdom has no
 * layout, so what is pinned here is the host contract that fixes it.
 */

const ACTIONS: ToolbarAction[] = [
  { id: 'bold', label: 'Bold', icon: 'bold' },
  { id: 'italic', label: 'Italic', icon: 'italic' },
];

@Component({
  imports: [SvToolbarComponent],
  template: `
    <div class="flex items-center gap-3">
      <span class="w-20 shrink-0">md</span>
      <sv-toolbar label="Format" class="consumer-class" [actions]="actions" [overflow]="overflow()" />
    </div>
  `,
})
class Host {
  readonly actions = ACTIONS;
  readonly overflow = signal<'scroll' | 'menu'>('scroll');
}

async function setup(overflow: 'scroll' | 'menu') {
  TestBed.resetTestingModule();
  const { fixture } = await render(Host, { detectChangesOnRender: false });
  fixture.componentInstance.overflow.set(overflow);
  fixture.detectChanges();
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector('sv-toolbar') as HTMLElement;
}

describe('SvToolbarComponent — reflow (FL-J3-LU-07)', () => {
  it('lets the host shrink to its flex row in scroll mode, so the strip really scrolls', async () => {
    const host = await setup('scroll');
    expect(host.classList).toContain('min-w-0');
    expect(host.classList).toContain('max-w-full');
    // Scroll mode is otherwise unchanged: the host is not forced to block/flex-auto.
    expect(host.classList).not.toContain('block');
    expect(host.classList).not.toContain('flex-auto');
    // The strip still carries the scroll container.
    const strip = host.querySelector('[role="toolbar"]') as HTMLElement;
    expect(strip.classList).toContain('overflow-x-auto');
    expect(strip.classList).toContain('max-w-full');
  });

  it('keeps the menu-mode host measurable: block, flex-auto and shrinkable', async () => {
    const host = await setup('menu');
    for (const c of ['block', 'flex-auto', 'min-w-0', 'max-w-full']) expect(host.classList).toContain(c);
  });

  it("keeps the consumer's own classes alongside the host's", async () => {
    const host = await setup('scroll');
    expect(host.classList).toContain('consumer-class');
    expect(host.classList).toContain('min-w-0');
  });
});
