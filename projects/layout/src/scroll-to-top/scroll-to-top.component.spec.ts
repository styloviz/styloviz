import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { SvScrollToTopComponent } from './scroll-to-top.component';

/**
 * A button that is in the DOM the whole time and only sometimes usable. That is
 * the part worth pinning: while it is faded out it must also be out of the tab
 * order and out of the accessibility tree, or a keyboard user tabs into an
 * invisible control and a screen-reader user is offered one that does nothing.
 */

const restores: (() => void)[] = [];

/** Fake a scrolled document, since jsdom has no layout to scroll. */
function scrollTo(scrollTop: number, { height = 3_000, viewport = 1_000 } = {}) {
  const doc = document.documentElement;
  for (const [obj, prop, value] of [
    [window, 'scrollY', scrollTop],
    [doc, 'scrollTop', scrollTop],
    [doc, 'scrollHeight', height],
    [doc, 'clientHeight', viewport],
  ] as const) {
    const previous = Object.getOwnPropertyDescriptor(obj, prop);
    Object.defineProperty(obj, prop, { value, configurable: true, writable: true });
    restores.push(() => {
      if (previous) Object.defineProperty(obj, prop, previous);
      else delete (obj as unknown as Record<string, unknown>)[prop];
    });
  }
  window.dispatchEvent(new Event('scroll'));
}

afterEach(() => {
  while (restores.length) restores.pop()!();
  vi.restoreAllMocks();
});

async function setup(inputs: Partial<ComponentInput<SvScrollToTopComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvScrollToTopComponent, {
    inputs: inputs as ComponentInput<SvScrollToTopComponent>,
  });
}

const button = () => screen.getByRole('button', { hidden: true }) as HTMLButtonElement;
const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvScrollToTopComponent — appearing', () => {
  it('is out of reach until the page has scrolled far enough', async () => {
    const { fixture } = await setup({ threshold: 200 });
    expect(fixture.componentInstance.visible()).toBe(false);
    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-hidden')).toBe('true');
    expect(button().getAttribute('tabindex')).toBe('-1');
  });

  it('becomes usable once past the threshold', async () => {
    const { fixture } = await setup({ threshold: 200 });
    scrollTo(500);
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(true);
    expect(button().disabled).toBe(false);
    expect(button().getAttribute('aria-hidden')).toBeNull();
    expect(button().getAttribute('tabindex')).toBeNull();
  });

  it('goes away again on the way back up', async () => {
    const { fixture } = await setup({ threshold: 200 });
    scrollTo(500);
    fixture.detectChanges();
    scrollTo(50);
    fixture.detectChanges();
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('respects the threshold it was given', async () => {
    const { fixture } = await setup({ threshold: 1_000 });
    scrollTo(500);
    expect(fixture.componentInstance.visible()).toBe(false);

    scrollTo(1_500);
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('is always there in demo mode, whatever the page is doing', async () => {
    const { fixture } = await setup({ demo: true });
    expect(fixture.componentInstance.visible()).toBe(true);
    expect(fixture.componentInstance.progress()).toBe(65);

    scrollTo(0);
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('fades and lifts rather than unmounting', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.visibilityClass()).toContain('opacity-0');
    expect(fixture.componentInstance.visibilityClass()).toContain('pointer-events-none');

    scrollTo(500);
    expect(fixture.componentInstance.visibilityClass()).toContain('opacity-100');
  });
});

describe('SvScrollToTopComponent — the progress ring', () => {
  it('tracks how far down the page is', async () => {
    const { fixture } = await setup();
    scrollTo(1_000, { height: 3_000, viewport: 1_000 });
    // 1000 of a possible 2000 scrollable pixels.
    expect(fixture.componentInstance.progress()).toBe(50);
  });

  it('reports nothing rather than dividing by a page that does not scroll', async () => {
    const { fixture } = await setup();
    scrollTo(0, { height: 1_000, viewport: 1_000 });
    expect(fixture.componentInstance.progress()).toBe(0);
  });

  it('winds the ring back as progress grows', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    expect(c.dashOffset()).toBeCloseTo(c.circumference(), 6);

    scrollTo(2_000, { height: 3_000, viewport: 1_000 });
    expect(c.progress()).toBe(100);
    expect(c.dashOffset()).toBeCloseTo(0, 6);
  });

  it('draws the ring only where it fits', async () => {
    const { fixture: circle } = await setup({ demo: true, variant: 'circle' });
    expect(el(circle).querySelectorAll('circle').length).toBe(2);

    const { fixture: pill } = await setup({ demo: true, variant: 'pill' });
    expect(el(pill).querySelectorAll('circle').length).toBe(0);

    const { fixture: off } = await setup({ demo: true, showProgress: false });
    expect(el(off).querySelectorAll('circle').length).toBe(0);
  });
});

describe('SvScrollToTopComponent — going up', () => {
  it('scrolls the window to the top and says it did', async () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollSpy, configurable: true });
    restores.push(() => { delete (window as unknown as Record<string, unknown>)['scrollTo']; });

    let clicks = 0;
    const { fixture } = await setup({ demo: true });
    fixture.componentInstance.clicked.subscribe(() => { clicks += 1; });

    await userEvent.click(button());
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(clicks).toBe(1);
  });

  it('cannot be clicked while it is hidden', async () => {
    let clicks = 0;
    const { fixture } = await setup({ threshold: 200 });
    fixture.componentInstance.clicked.subscribe(() => { clicks += 1; });

    expect(button().disabled).toBe(true);
    button().click();
    expect(clicks).toBe(0);
  });
});

describe('SvScrollToTopComponent — placement and looks', () => {
  it('pins itself to the corner it was asked for', async () => {
    const { fixture: right } = await setup();
    expect(right.componentInstance.positionClass()).toContain('right-6');

    const { fixture: left } = await setup({ position: 'bottom-left' });
    expect(left.componentInstance.positionClass()).toContain('left-6');

    const { fixture: centre } = await setup({ position: 'bottom-center' });
    expect(centre.componentInstance.positionClass()).toContain('left-1/2');
  });

  it('fixes to the viewport by default and to its container on request', async () => {
    const { fixture: viewport } = await setup();
    expect(viewport.componentInstance.positionClass()).toContain('fixed');

    const { fixture: contained } = await setup({ contained: true });
    expect(contained.componentInstance.positionClass()).toContain('absolute');
    expect(contained.componentInstance.positionClass()).not.toContain('fixed');
  });

  it('sits in normal flow in demo mode so several can be shown side by side', async () => {
    const { fixture } = await setup({ demo: true });
    expect(fixture.componentInstance.positionClass()).toBe('inline-flex');
  });

  it.each(['circle', 'rounded', 'pill'] as const)('gives %s its own geometry', async (variant) => {
    const { fixture } = await setup({ variant });
    const cls = fixture.componentInstance.btnClass();
    expect(cls).toContain(variant === 'pill' ? 'px-4' : 'w-12');
  });

  it.each(['solid', 'glass', 'gradient', 'outline'] as const)('gives %s its own surface', async (appearance) => {
    const { fixture } = await setup({ appearance });
    expect(fixture.componentInstance.btnClass().length).toBeGreaterThan(0);
    expect(fixture.componentInstance.btnClass()).not.toContain('undefined');
  });

  it('shows a label only on the pill', async () => {
    const { fixture: pill } = await setup({ demo: true, variant: 'pill', label: 'Back to top' });
    expect(el(pill).textContent).toContain('Back to top');

    const { fixture: bare } = await setup({ demo: true, variant: 'pill' });
    expect(el(bare).textContent).toContain('Top');

    const { fixture: circle } = await setup({ demo: true, variant: 'circle', label: 'Back to top' });
    expect(el(circle).textContent).not.toContain('Back to top');
  });

  it('names itself, and takes a name from the host', async () => {
    const { fixture: base } = await setup({ demo: true });
    expect(button().getAttribute('aria-label')).toBe('Scroll to top');

    await setup({ demo: true, ariaLabel: 'Return to the start' });
    expect(button().getAttribute('aria-label')).toBe('Return to the start');
    expect(base).toBeTruthy();
  });
});

describe('SvScrollToTopComponent — cleaning up', () => {
  it('stops listening once it is gone', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { fixture } = await setup();
    fixture.destroy();
    // The window listener is the `window:scroll` host listener, which Angular
    // removes on destroy (with its own options argument).
    expect(remove.mock.calls.some(([type]) => type === 'scroll')).toBe(true);
  });

  it('does not react to a scroll after it is gone', async () => {
    const { fixture } = await setup({ threshold: 200 });
    const c = fixture.componentInstance;
    fixture.destroy();

    scrollTo(2_000);
    expect(c.visible()).toBe(false);
  });
});
