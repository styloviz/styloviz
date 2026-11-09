import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAnchorComponent, type AnchorItem } from './anchor.component';

/**
 * ============================================================================
 *  An anchor rail inside a scroll container — FL-J3-NV-02 (`X-18`, `NV-02-I5`)
 * ============================================================================
 *
 * A settings drawer or a docs pane scrolls on its own, and the rail lives INSIDE
 * it. `root` names that container; this pins that every part of the rail then
 * talks to the container and never the window — the observer, the jump, the
 * reading progress — while a second, page-level rail on the same page keeps the
 * window, and the two never share ids or keys.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed: Element[] = [];
  constructor(
    public readonly callback: IntersectionObserverCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void { this.observed.push(el); }
  disconnect(): void { /* the double records observe() only */ }
  unobserve(): void { /* the double records observe() only */ }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

const PANE: readonly AnchorItem[] = [
  { id: 'pane-general', label: 'General' },
  { id: 'pane-billing', label: 'Billing' },
  { id: 'pane-danger', label: 'Danger zone' },
];
const PAGE: readonly AnchorItem[] = [
  { id: 'page-intro', label: 'Intro' },
  { id: 'page-usage', label: 'Usage' },
];

@Component({
  imports: [SvAnchorComponent],
  template: `
    <sv-anchor data-rail="page" [items]="page" />
    <div #pane data-pane style="height: 200px; overflow: auto">
      <div>
        <sv-anchor data-rail="pane" [items]="paneItems" [root]="paneEl()" [progress]="true" [offset]="10" />
        @for (s of paneItems; track s.id) {
          <section [id]="s.id"><h2>{{ s.label }}</h2></section>
        }
      </div>
    </div>
    @for (s of page; track s.id) {
      <section [id]="s.id"><h2>{{ s.label }}</h2></section>
    }
  `,
})
class HostComponent {
  readonly paneItems = PANE;
  readonly page = PAGE;
  readonly paneEl = signal<HTMLElement | null>(null);
}

let originalIO: typeof IntersectionObserver | undefined;

beforeEach(() => {
  originalIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  FakeIntersectionObserver.instances = [];
});

afterEach(() => {
  globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
  vi.restoreAllMocks();
});

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  const root = fixture.nativeElement as HTMLElement;
  const pane = root.querySelector<HTMLElement>('[data-pane]')!;
  fixture.componentInstance.paneEl.set(pane);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const rail = (k: 'page' | 'pane') => root.querySelector<HTMLElement>(`[data-rail="${k}"]`)!;
  const links = (k: 'page' | 'pane') => [...rail(k).querySelectorAll<HTMLAnchorElement>('a[data-sv-anchor-id]')];
  const cmp = fixture.debugElement.query((d) => d.nativeElement === rail('pane')).componentInstance as SvAnchorComponent;
  return { fixture, root, pane, rail, links, cmp };
}

function press(el: HTMLElement, key: string): void {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('SvAnchorComponent — a rail inside a scroll container (FL-J3-NV-02)', () => {
  it('observes its sections against the container, while the page rail observes the viewport', async () => {
    const { pane } = await setup();
    const ids = (io: FakeIntersectionObserver) => io.observed.map((e) => e.id).join();
    const paneIO = FakeIntersectionObserver.instances.filter((io) => ids(io) === PANE.map((s) => s.id).join());
    const pageIO = FakeIntersectionObserver.instances.filter((io) => ids(io) === PAGE.map((s) => s.id).join());
    // The pane rail's live observer is rooted on the container…
    expect(paneIO.at(-1)!.options?.root).toBe(pane);
    // …and the page rail's on the viewport.
    expect(pageIO.length).toBeGreaterThan(0);
    expect(pageIO.every((io) => io.options?.root == null)).toBe(true);
  });

  it('a click scrolls the container (with the offset), never the window', async () => {
    const { pane, links, fixture } = await setup();
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const paneScroll = vi.fn();
    (pane as unknown as { scrollTo: typeof paneScroll }).scrollTo = paneScroll;
    pane.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    pane.scrollTop = 50;
    document.getElementById('pane-billing')!.getBoundingClientRect = () => ({ top: 400 }) as DOMRect;

    links('pane')[1].click();
    fixture.detectChanges();

    // 400 - 100 + 50 - offset 10
    expect(paneScroll).toHaveBeenCalledWith(expect.objectContaining({ top: 340 }));
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it('reading progress follows the container scroll, not the window', async () => {
    const { pane, cmp } = await setup();
    const emitted: number[] = [];
    cmp.progressChange.subscribe((v) => emitted.push(v));
    Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 200 });
    pane.scrollTop = 500;

    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(emitted).not.toContain(0.5);

    pane.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(emitted.at(-1)).toBe(0.5);
  });

  it('arrow keys stay inside each rail', async () => {
    const { links } = await setup();
    const pane = links('pane');
    press(pane[0], 'ArrowDown');
    expect(document.activeElement).toBe(pane[1]);
    press(pane[1], 'End');
    expect(document.activeElement).toBe(pane[2]);
    press(pane[2], 'ArrowDown');
    expect(document.activeElement).toBe(pane[2]);

    const page = links('page');
    press(page[1], 'Home');
    expect(document.activeElement).toBe(page[0]);
  });

  it('every id in the page is unique across the two rails', async () => {
    const { root } = await setup();
    const ids = [...root.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
