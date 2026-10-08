import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvScrollToTopComponent } from './scroll-to-top.component';

/**
 * The component can watch three different things: an explicit `scrollTarget`,
 * the nearest scrollable ancestor, or the window. The existing spec covers the
 * window case; these cover the other two, which is where the button ends up
 * either permanently invisible (watching a container that never scrolls) or
 * scrolling the page instead of the panel it is pinned inside.
 *
 * jsdom has no layout, so scroll geometry is *defined* on the elements rather
 * than measured — a real `scrollTop` here would always be 0 and could never
 * distinguish a working component from a broken one.
 */

function fakeScroll(el: Element, { top = 0, height = 3_000, viewport = 1_000 } = {}) {
  for (const [prop, value] of [['scrollTop', top], ['scrollHeight', height], ['clientHeight', viewport]] as const) {
    Object.defineProperty(el, prop, { value, configurable: true, writable: true });
  }
}

async function mountWithExplicitTarget() {
  TestBed.resetTestingModule();
  const pane = document.createElement('div');
  pane.setAttribute('data-explicit-pane', '');
  document.body.appendChild(pane);
  // Geometry must exist before ngAfterViewInit takes its first reading.
  fakeScroll(pane, { top: 0 });
  const { fixture } = await render(SvScrollToTopComponent, {
    inputs: { threshold: 200, scrollTarget: pane },
  });
  return { fixture, pane };
}

describe('SvScrollToTopComponent — an explicit scroll container', () => {
  afterEach(() => {
    document.querySelectorAll('[data-explicit-pane]').forEach((n) => n.remove());
  });

  it('reacts to the container it was handed, not to the window', async () => {
    const { fixture, pane } = await mountWithExplicitTarget();
    const c = fixture.componentInstance;
    expect(c.visible()).toBe(false);

    fakeScroll(pane, { top: 900 });
    pane.dispatchEvent(new Event('scroll'));
    expect(c.visible()).toBe(true);
    // 900 of (3000 − 1000) scrollable pixels.
    expect(c.progress()).toBe(45);
  });

  it('scrolls that container back to the top, leaving the page alone', async () => {
    const { fixture, pane } = await mountWithExplicitTarget();
    const paneScroll = vi.fn();
    Object.defineProperty(pane, 'scrollTo', { value: paneScroll, configurable: true });
    const windowScroll = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(window, 'scrollTo');
    Object.defineProperty(window, 'scrollTo', { value: windowScroll, configurable: true });
    try {
      let clicks = 0;
      fixture.componentInstance.clicked.subscribe(() => clicks++);
      fixture.componentInstance.scrollUp();
      expect(paneScroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      expect(windowScroll).not.toHaveBeenCalled();
      expect(clicks).toBe(1);
    } finally {
      if (previous) Object.defineProperty(window, 'scrollTo', previous);
      else delete (window as unknown as Record<string, unknown>)['scrollTo'];
    }
  });

  it('stops listening to that container once it is destroyed', async () => {
    const { fixture, pane } = await mountWithExplicitTarget();
    const c = fixture.componentInstance;
    fixture.destroy();

    fakeScroll(pane, { top: 2_000 });
    pane.dispatchEvent(new Event('scroll'));
    expect(c.visible()).toBe(false);
  });
});

@Component({
  standalone: true,
  imports: [SvScrollToTopComponent],
  template: `
    <div>
      <div #pane style="overflow-y: auto; height: 200px">
        <div>
          <sv-scroll-to-top [threshold]="200" />
        </div>
      </div>
    </div>
  `,
})
class PanelHost {
  readonly pane = viewChild.required<ElementRef<HTMLElement>>('pane');
  readonly button = viewChild.required(SvScrollToTopComponent);
}

describe('SvScrollToTopComponent — finding a scrollable ancestor', () => {
  /**
   * The walk has to step past a plain wrapper to reach the scrollable one —
   * stopping at the first parent would leave the button watching the window
   * while sitting inside a scrolling panel.
   */
  it('walks past non-scrolling ancestors to the pane that does scroll', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(PanelHost);
    const pane = fixture.componentInstance.pane().nativeElement;
    const c = fixture.componentInstance.button();

    fakeScroll(pane, { top: 800 });
    pane.dispatchEvent(new Event('scroll'));
    expect(c.visible()).toBe(true);
    expect(c.progress()).toBe(40);
  });

  /** Nothing scrollable above it: the document stays the container, as before. */
  it('falls back to the document when no ancestor scrolls', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvScrollToTopComponent, { inputs: { threshold: 200 } });
    const c = fixture.componentInstance;
    const doc = document.documentElement;
    const saved = ['scrollTop', 'scrollHeight', 'clientHeight'].map(
      (p) => [p, Object.getOwnPropertyDescriptor(doc, p)] as const,
    );
    try {
      fakeScroll(doc, { top: 600 });
      window.dispatchEvent(new Event('scroll'));
      expect(c.visible()).toBe(true);
      expect(c.progress()).toBe(30);
    } finally {
      for (const [p, d] of saved) {
        if (d) Object.defineProperty(doc, p, d);
        else delete (doc as unknown as Record<string, unknown>)[p];
      }
    }
  });
});
