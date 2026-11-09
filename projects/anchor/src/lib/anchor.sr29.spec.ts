import { TestBed } from '@angular/core/testing';
import { render, screen, fireEvent } from '@testing-library/angular';
import { vi } from 'vitest';
import { untilRendered } from '../../../../src/testing/async';
import { SvAnchorComponent, svFlattenAnchorItems, type AnchorItem } from './anchor.component';

/**
 * `SR-29` — the free anchor variants: nested and flat-level items, outline
 * numbers, collapsible trail, the sliding marker, appearances, reading
 * progress, a separate activation line, arrow keys and hash sync.
 */

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  constructor(
    public readonly callback: IntersectionObserverCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(): void { /* the double fires by hand */ }
  disconnect(): void { /* nothing to tear down */ }
  unobserve(): void { /* nothing to tear down */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(el: HTMLElement): void {
    this.callback([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const NESTED: readonly AnchorItem[] = [
  { id: 'start', label: 'Getting started', meta: '2 min' },
  {
    id: 'guides',
    label: 'Guides',
    icon: 'book-open',
    children: [
      { id: 'install', label: 'Install' },
      { id: 'theme', label: 'Theme', children: [{ id: 'tokens', label: 'Tokens' }] },
    ],
  },
  { id: 'api', label: 'API', children: [{ id: 'inputs', label: 'Inputs' }] },
];

function mount(ids: readonly string[]): void {
  for (const id of ids) {
    const el = document.createElement('section');
    el.id = id;
    document.body.appendChild(el);
  }
}
const ALL = ['start', 'guides', 'install', 'theme', 'tokens', 'api', 'inputs'];

async function activate(fixture: { detectChanges(): void }, id: string): Promise<void> {
  await untilRendered(fixture as never, () => FakeIntersectionObserver.instances.length > 0);
  FakeIntersectionObserver.instances.at(-1)!.fire(document.getElementById(id)!);
  await untilRendered(fixture as never, () => !!document.querySelector(`a[data-sv-anchor-id="${id}"][aria-current="true"], a[aria-current="true"]`));
}

let originalIO: typeof IntersectionObserver | undefined;
beforeEach(() => {
  TestBed.resetTestingModule();
  originalIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  FakeIntersectionObserver.instances = [];
});
afterEach(() => {
  globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

describe('svFlattenAnchorItems (SR-29)', () => {
  it('★ flattens children with depths, outline numbers and ancestors', () => {
    const rows = svFlattenAnchorItems(NESTED);
    expect(rows.map(r => `${r.number} ${r.id}@${r.depth}`)).toEqual([
      '1 start@0', '2 guides@0', '2.1 install@1', '2.2 theme@1', '2.2.1 tokens@2', '3 api@0', '3.1 inputs@1',
    ]);
    expect(rows.find(r => r.id === 'tokens')!.ancestors).toEqual(['guides', 'theme']);
    expect(rows.filter(r => r.hasChildren).map(r => r.id)).toEqual(['guides', 'theme', 'api']);
  });

  it('reads flat `level`s, and clamps a jump of more than one', () => {
    const rows = svFlattenAnchorItems([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', level: 2 },   // h4 straight under an h2 → one level
      { id: 'c', label: 'C', level: 1 },
      { id: 'd', label: 'D' },
    ]);
    expect(rows.map(r => `${r.number}@${r.depth}`)).toEqual(['1@0', '1.1@1', '1.2@1', '2@0']);
    expect(rows[2].parentId).toBe('a');
  });
});

describe('sv-anchor (SR-29) — nested and collapsible', () => {
  it('★ tracks every level and indents children', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED } });
    await activate(fixture, 'tokens');
    const tokens = screen.getByText('Tokens');
    expect(tokens.getAttribute('aria-current')).toBe('true');
    expect(tokens.getAttribute('data-sv-depth')).toBe('2');
    expect(tokens.className).toContain('ps-9');
    // The trail reads as the reader's place; only the item itself is current.
    expect(screen.getByText('Theme').getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Theme').className).toContain('text-gray-800');
  });

  it('★ collapsible shows sub-sections only on the active trail, plus what the reader opened', async () => {
    mount(ALL);
    const expanded: (readonly string[])[] = [];
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, collapsible: true } });
    fixture.componentInstance.expandedIds.subscribe(ids => expanded.push(ids));
    await activate(fixture, 'install');
    expect(screen.getByText('Install')).toBeTruthy();
    expect(screen.queryByText('Inputs')).toBeNull();
    expect(screen.queryByText('Tokens')).toBeNull();          // Theme is not on the trail

    // The trail stays open, so it has no toggle; API does.
    const toggles = fixture.nativeElement.querySelectorAll('[data-sv-anchor-toggle]') as NodeListOf<HTMLButtonElement>;
    const labels = [...toggles].map(t => t.getAttribute('aria-label'));
    expect(labels).toEqual(['Subsections of Theme', 'Subsections of API']);
    const api = toggles[1];
    expect(api.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(api);
    fixture.detectChanges();
    expect(expanded.at(-1)).toEqual(['api']);
    expect(screen.getByText('Inputs')).toBeTruthy();
    expect(api.getAttribute('aria-expanded')).toBe('true');
  });

  it('labels translate the toggle', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: NESTED, collapsible: true, labels: { toggle: 'Unterabschnitte von {label}' } },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-sv-anchor-toggle]')!.getAttribute('aria-label')).toBe('Unterabschnitte von Guides');
  });

  it('horizontal shows the top level and lights the parent of the child being read', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, orientation: 'horizontal' } });
    await activate(fixture, 'inputs');
    expect(screen.queryByText('Inputs')).toBeNull();
    expect(screen.getByText('API').getAttribute('aria-current')).toBe('true');
  });
});

describe('sv-anchor (SR-29) — numbers, icons, meta, appearance and marker', () => {
  it('numbered, icon and meta', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, numbered: true } });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect([...host.querySelectorAll('[data-sv-anchor-number]')].map(n => n.textContent!.trim()).slice(0, 4)).toEqual(['1', '2', '2.1', '2.2']);
    expect(host.querySelector('[data-sv-anchor-id="guides"] sv-icon')).not.toBeNull();
    expect(host.querySelector('[data-sv-anchor-meta]')!.textContent!.trim()).toBe('2 min');
  });

  it('★ the rail has one sliding marker; items keep a clear border', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED } });
    await activate(fixture, 'guides');
    const marker = fixture.nativeElement.querySelector('[data-sv-anchor-marker]') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.className).toContain('transition-[transform,height]');
    expect(screen.getByText('Guides').className).toContain('border-transparent');
  });

  it("marker='border' keeps each item's own border, as before", async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, marker: 'border' } });
    await activate(fixture, 'guides');
    expect(fixture.nativeElement.querySelector('[data-sv-anchor-marker]')).toBeNull();
    expect(screen.getByText('Guides').className).toContain('border-brand-500');
  });

  it('card and minimal draw no rail', async () => {
    mount(ALL);
    const card = await render(SvAnchorComponent, { inputs: { items: NESTED, appearance: 'card' } });
    await activate(card.fixture, 'start');
    const nav = card.fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.className).toContain('rounded-xl');
    expect(nav.className).not.toContain('border-s');
    expect(card.fixture.nativeElement.querySelector('[data-sv-anchor-marker]')).toBeNull();
    expect(screen.getByText('Getting started').className).toContain('bg-brand-50');
  });

  it('compact tightens the rows', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, appearance: 'compact' } });
    fixture.detectChanges();
    expect(screen.getByText('API').className).toContain('text-xs');
  });
});

describe('sv-anchor (SR-29) — keyboard, activation line, progress, hash', () => {
  it('★ Up/Down/Home/End move focus between the links', async () => {
    mount(ALL);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED } });
    fixture.detectChanges();
    const start = screen.getByText('Getting started');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByText('Guides'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByText('Inputs'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByText('API'));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(start);
  });

  it('★ activationOffset moves the band without moving the jump', async () => {
    mount(ALL);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, offset: 80, activationOffset: 24 } });
    await untilRendered(fixture, () => FakeIntersectionObserver.instances.length > 0);
    expect(FakeIntersectionObserver.instances.at(-1)!.options!.rootMargin).toBe('-24px 0px -68% 0px');
    fireEvent.click(screen.getByText('API'));
    expect(scrollTo.mock.calls.at(-1)![0]).toMatchObject({ top: 0 });   // max(0, 0 + 0 − 80): the jump still uses 80
    vi.spyOn(document.getElementById('api')!, 'getBoundingClientRect').mockReturnValue({ top: 500 } as DOMRect);
    fireEvent.click(screen.getByText('API'));
    expect(scrollTo.mock.calls.at(-1)![0]).toMatchObject({ top: 420 });
  });

  it('★ progress reads the container and emits 0–1', async () => {
    mount(ALL);
    const box = document.createElement('div');
    document.body.appendChild(box);
    Object.defineProperty(box, 'scrollHeight', { value: 1400, configurable: true });
    Object.defineProperty(box, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(box, 'scrollTop', { value: 0, writable: true, configurable: true });
    // Frames are queued and flushed by hand, outside any signal notification.
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => frames.push(cb));
    const seen: number[] = [];
    const { fixture } = await render(SvAnchorComponent, {
      inputs: { items: NESTED, root: box, progress: true },
      on: { progressChange: (v: number) => seen.push(v) },
    });
    fixture.detectChanges();
    box.scrollTop = 250;
    box.dispatchEvent(new Event('scroll'));
    frames.splice(0).forEach(cb => cb(0));
    fixture.detectChanges();
    expect(seen.at(-1)).toBe(0.25);
    const fill = fixture.nativeElement.querySelector('[data-sv-anchor-progress] span') as HTMLElement;
    expect(fill.style.transform).toBe('scaleX(0.25)');
  });

  it('★ hashSync="auto" jumps to the hash on load without taking focus, then reflects the scroll', async () => {
    mount(ALL);
    history.replaceState(null, '', '/docs#api');
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const replace = vi.spyOn(history, 'replaceState');
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED, hashSync: 'auto' } });
    await untilRendered(fixture, () => scrollTo.mock.calls.length > 0);
    expect(document.activeElement).toBe(document.body);
    // While the deep link was pending, nothing overwrote it.
    expect(replace.mock.calls.some(c => String(c[2]).endsWith('#start'))).toBe(false);

    await activate(fixture, 'install');
    await untilRendered(fixture, () => location.hash === '#install');
    expect(replace.mock.calls.at(-1)![2]).toBe('/docs#install');
  });

  it('★ switching hashSync on writes where the reader is at once', async () => {
    mount(ALL);
    const replace = vi.spyOn(history, 'replaceState');
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED } });
    await activate(fixture, 'theme');
    expect(replace).not.toHaveBeenCalled();
    fixture.componentRef.setInput('hashSync', 'auto');
    fixture.detectChanges();
    await untilRendered(fixture, () => location.hash === '#theme');
  });

  it('hashSync off (the default) never touches the URL', async () => {
    mount(ALL);
    const replace = vi.spyOn(history, 'replaceState');
    const { fixture } = await render(SvAnchorComponent, { inputs: { items: NESTED } });
    await activate(fixture, 'install');
    expect(replace).not.toHaveBeenCalled();
  });
});
