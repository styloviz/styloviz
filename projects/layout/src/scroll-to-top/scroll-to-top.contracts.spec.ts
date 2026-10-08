import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { SV_FLOATING_ORDER, SvFloatingLayerService, svResetWarnOnce } from '@styloviz/core';
import { SvScrollToTopComponent } from './scroll-to-top.component';

/**
 * The Layout & Utilities P1 contracts for Scroll to Top:
 *
 * - `LU-07-I1` / `M1` — the shared floating layer (`X-5`)
 * - `LU-07-I2` / `M2` — where focus goes after the scroll (`X-10`)
 * - `LU-07-I3` / `M3` — smooth scroll honours reduced motion (`X-7`)
 * - `X-7` forced colors — every appearance keeps a system-colour edge
 */

const restores: (() => void)[] = [];

function define<T extends object>(obj: T, prop: string, value: unknown): void {
  const previous = Object.getOwnPropertyDescriptor(obj, prop);
  Object.defineProperty(obj, prop, { value, configurable: true, writable: true });
  restores.push(() => {
    if (previous) Object.defineProperty(obj, prop, previous);
    else delete (obj as unknown as Record<string, unknown>)[prop];
  });
}

/** Fake a scrolled document, since jsdom has no layout to scroll. */
function scrolled(scrollTop: number): void {
  const doc = document.documentElement;
  define(window, 'scrollY', scrollTop);
  define(doc, 'scrollTop', scrollTop);
  define(doc, 'scrollHeight', 3_000);
  define(doc, 'clientHeight', 1_000);
  window.dispatchEvent(new Event('scroll'));
}

/** jsdom has no `matchMedia`; answer the reduced-motion query as told. */
function reducedMotion(reduce: boolean): void {
  define(window, 'matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

let scrollSpy: ReturnType<typeof vi.fn>;
let page: HTMLElement | null = null;

beforeEach(() => {
  scrollSpy = vi.fn();
  define(window, 'scrollTo', scrollSpy);
});

afterEach(() => {
  while (restores.length) restores.pop()!();
  page?.remove();
  page = null;
  vi.restoreAllMocks();
});

async function setup(inputs: Partial<ComponentInput<SvScrollToTopComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvScrollToTopComponent, {
    inputs: inputs as ComponentInput<SvScrollToTopComponent>,
  });
}

const button = () => screen.getByRole('button', { name: 'Scroll to top', hidden: true }) as HTMLButtonElement;

function mountPage(html: string): void {
  page = document.createElement('div');
  page.innerHTML = html;
  document.body.prepend(page);
}

describe('SvScrollToTopComponent — reduced motion (LU-07-I3 / M3)', () => {
  it('scrolls smoothly when the user has not asked for less motion', async () => {
    reducedMotion(false);
    await setup({ demo: true });
    await userEvent.click(button());
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps instantly under prefers-reduced-motion: reduce', async () => {
    reducedMotion(true);
    await setup({ demo: true });
    await userEvent.click(button());
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it("jumps instantly when the host asks for scrollBehavior 'auto'", async () => {
    reducedMotion(false);
    await setup({ demo: true, scrollBehavior: 'auto' });
    await userEvent.click(button());
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it.each(['circle', 'rounded', 'pill'] as const)('stills the show/hide transition for %s under reduced motion', async (variant) => {
    for (const appearance of ['solid', 'glass', 'gradient', 'outline'] as const) {
      const { fixture } = await setup({ demo: true, variant, appearance });
      expect(fixture.componentInstance.btnClass()).toContain('motion-reduce:transition-none');
      // The old inline `transition` could not be overridden by any utility.
      expect(button().getAttribute('style') ?? '').not.toContain('transition');
    }
  });

  it('stills the progress ring', async () => {
    const { fixture } = await setup({ demo: true });
    const ring = (fixture.nativeElement as HTMLElement).querySelectorAll('circle')[1];
    expect(ring.getAttribute('class')).toContain('motion-reduce:transition-none');
    expect(ring.getAttribute('style')).toBeNull();
  });
});

describe('SvScrollToTopComponent — forced colors (X-7)', () => {
  it.each(['solid', 'glass', 'gradient', 'outline'] as const)('%s keeps a system-colour edge', async (appearance) => {
    const { fixture } = await setup({ demo: true, appearance });
    expect(fixture.componentInstance.btnClass()).toContain('forced-colors:border-[ButtonText]');
  });
});

describe('SvScrollToTopComponent — focus after scrolling (LU-07-I2 / M2)', () => {
  /** A shown, fixed-mode button holding keyboard focus. */
  async function focusedShownButton() {
    const view = await setup({ threshold: 0 });
    scrolled(500);
    view.fixture.detectChanges();
    button().focus();
    expect(document.activeElement).toBe(button());
    return view;
  }

  /**
   * ★ The default used to leave a keyboard user on a button that then became
   *   `aria-hidden` + `tabindex="-1"` — axe `aria-hidden-focus`, and the next
   *   Tab starting from a control assistive technology is told is not there.
   */
  it('by default, keyboard activation does not strand focus: it moves to the main heading', async () => {
    mountPage('<aside><h2>Sidebar</h2></aside><main><h1>Title</h1></main>');
    await focusedShownButton();
    await userEvent.keyboard('{Enter}');
    expect(scrollSpy).toHaveBeenCalled();
    const h1 = page!.querySelector('h1')!;
    expect(document.activeElement).toBe(h1);
    expect(h1.getAttribute('tabindex')).toBe('-1');
  });

  it('by default, falls back to the main landmark when there is no heading', async () => {
    mountPage('<main id="content"><p>Body copy</p></main>');
    await focusedShownButton();
    await userEvent.keyboard('{Enter}');
    const main = page!.querySelector('main')!;
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('by default, releases focus to the document when there is nothing to move it to', async () => {
    await focusedShownButton();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).not.toBe(button());
    expect(document.activeElement).toBe(document.body);
  });

  it('by default, a focused button hidden by a scroll it did not start hands focus on too', async () => {
    mountPage('<main><h1>Title</h1></main>');
    const { fixture } = await focusedShownButton();
    const btn = button();
    scrolled(0);
    fixture.detectChanges();
    // (Held from before: an aria-hidden button has no accessible name to query by.)
    expect(btn.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(page!.querySelector('h1'));
  });

  it('by default, leaves focus alone when it is elsewhere (a mouse click in Safari never focuses the button)', async () => {
    mountPage('<main><h1>Title</h1><input id="search" aria-label="Search" /></main>');
    const { fixture } = await setup({ threshold: 0 });
    scrolled(500);
    fixture.detectChanges();
    const search = page!.querySelector<HTMLInputElement>('#search')!;
    search.focus();

    // A DOM click: activates without moving focus, as Safari does for a mouse.
    button().click();
    expect(scrollSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(search);
    expect(page!.querySelector('h1')!.hasAttribute('tabindex')).toBe(false);

    scrolled(0);
    fixture.detectChanges();
    expect(document.activeElement).toBe(search);
  });

  it('by default, leaves a demo button focused — it never hides', async () => {
    mountPage('<main><h1>Title</h1></main>');
    await setup({ demo: true });
    button().focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(button());
    expect(page!.querySelector('h1')!.hasAttribute('tabindex')).toBe(false);
  });

  it('an explicit focusTarget still wins over the default rescue', async () => {
    mountPage('<main><h1>Title</h1></main><div id="intro">Intro</div>');
    const { fixture } = await setup({ threshold: 0, focusTarget: '#intro' });
    scrolled(500);
    fixture.detectChanges();
    button().focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement?.id).toBe('intro');
  });

  it('focusTarget: true moves focus to the main heading, making it focusable', async () => {
    mountPage('<aside><h2>Sidebar</h2></aside><main><h1>Title</h1></main>');
    await setup({ demo: true, focusTarget: true });
    await userEvent.click(button());
    const h1 = page!.querySelector('h1')!;
    expect(document.activeElement).toBe(h1);
    expect(h1.getAttribute('tabindex')).toBe('-1');
  });

  it('falls back to the first heading of any level when there is no h1', async () => {
    mountPage('<section><h2>Overview</h2><h3>Details</h3></section>');
    await setup({ demo: true, focusTarget: true });
    await userEvent.click(button());
    expect(document.activeElement?.textContent).toBe('Overview');
  });

  it('a selector focuses that element, and keeps an author tabindex', async () => {
    mountPage('<div id="intro" tabindex="0">Intro</div><a id="skip" href="#x">Skip</a>');
    await setup({ demo: true, focusTarget: '#intro' });
    await userEvent.click(button());
    expect(document.activeElement?.id).toBe('intro');
    expect(page!.querySelector('#intro')!.getAttribute('tabindex')).toBe('0');
  });

  it('does not add tabindex to something already focusable', async () => {
    mountPage('<a id="skip" href="#x">Skip</a>');
    await setup({ demo: true, focusTarget: '#skip' });
    await userEvent.click(button());
    expect(document.activeElement?.id).toBe('skip');
    expect(page!.querySelector('#skip')!.hasAttribute('tabindex')).toBe(false);
  });

  it('an invalid selector warns and does not break the scroll', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({ demo: true, focusTarget: '[[nope' });
    let clicks = 0;
    fixture.componentInstance.clicked.subscribe(() => { clicks += 1; });
    await userEvent.click(button());
    expect(scrollSpy).toHaveBeenCalled();
    expect(clicks).toBe(1);
    expect(warn.mock.calls.some((c: unknown[]) => String(c[0]).includes('not a valid CSS selector'))).toBe(true);
  });
});

describe('SvScrollToTopComponent — floating layer (LU-07-I1 / M1)', () => {
  it('registers only while shown, and stacks above a Speed Dial in its corner', async () => {
    const { fixture } = await setup({ threshold: 200 });
    const layer = TestBed.inject(SvFloatingLayerService);
    const fab = layer.register({ anchor: 'bottom-right', height: 56, order: SV_FLOATING_ORDER.fab });

    // Hidden: nothing reserved, base inset only.
    expect(layer.regions().some((r) => r.label === 'scroll-to-top')).toBe(false);
    expect(fixture.componentInstance.bottomInset()).toBe('calc(24px + env(safe-area-inset-bottom, 0px))');

    scrolled(500);
    fixture.detectChanges();
    expect(layer.regions().some((r) => r.label === 'scroll-to-top' && r.order === SV_FLOATING_ORDER.scrollToTop)).toBe(true);
    expect(fixture.componentInstance.bottomInset()).toBe('calc(92px + env(safe-area-inset-bottom, 0px))');
    expect(fixture.componentInstance.sideInset().right).toBe('calc(24px + env(safe-area-inset-right, 0px))');

    fab.release();
    fixture.detectChanges();
    expect(fixture.componentInstance.bottomInset()).toBe('calc(24px + env(safe-area-inset-bottom, 0px))');
  });

  it("clears a host's cookie banner on the bottom edge", async () => {
    const { fixture } = await setup({ threshold: 0, position: 'bottom-left' });
    const layer = TestBed.inject(SvFloatingLayerService);
    layer.register({ anchor: 'bottom', height: 80, label: 'cookie banner' });
    scrolled(10);
    fixture.detectChanges();
    expect(fixture.componentInstance.bottomInset()).toBe('calc(116px + env(safe-area-inset-bottom, 0px))');
    expect(fixture.componentInstance.sideInset().left).toBe('calc(24px + env(safe-area-inset-left, 0px))');
  });

  it('stays out of the layer when contained or in demo mode', async () => {
    for (const inputs of [{ contained: true }, { demo: true }]) {
      const { fixture } = await setup({ threshold: 0, ...inputs });
      scrolled(500);
      fixture.detectChanges();
      expect(TestBed.inject(SvFloatingLayerService).regions()).toEqual([]);
      expect(fixture.componentInstance.bottomInset()).toBeNull();
    }
  });

  it('leaves the layer when destroyed', async () => {
    const { fixture } = await setup({ threshold: 0 });
    scrolled(500);
    fixture.detectChanges();
    const layer = TestBed.inject(SvFloatingLayerService);
    expect(layer.regions().length).toBe(1);
    fixture.destroy();
    expect(layer.regions()).toEqual([]);
  });
});
