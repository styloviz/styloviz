import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { type MenuItem } from '@styloviz/core/models';
import {
  SV_LINK_ADAPTER,
  SV_NAV_TELEMETRY,
  type SvLinkAdapter,
  type SvLinkTarget,
  type SvNavEvent,
  type SvNavTelemetry,
} from '@styloviz/core/nav';
import { SvBottomNavComponent, type BottomNavSelection } from './bottom-nav.component';

/**
 * FL-F8 — `sv-bottom-nav`, the phone renderer of the navigation model.
 *
 * ★★★ The row's Aria note is the test that matters most: bottom navigation is
 *     LINKS, not tabs. Real `<a href>`, `aria-current="page"`, no tablist.
 */

const ITEMS: MenuItem[] = [
  { label: 'Home', route: '/app', icon: 'home' },
  { label: 'Inbox', route: '/app/inbox', icon: 'inbox', badge: '3' },
  { label: 'Search', route: '/app/search', icon: 'search' },
  { label: 'Alerts', route: '/app/alerts', icon: 'bell', dot: true },
  { label: 'Help', route: 'https://help.example.com', icon: 'info', external: true },
];

function adapter() {
  const went: SvLinkTarget[] = [];
  const value: SvLinkAdapter = {
    kind: 'spec',
    href: (target) => (typeof target === 'string' ? target : target.join('/')),
    navigate: (target) => {
      went.push(target);
      return true;
    },
  };
  return { went, value };
}

async function setup(inputs: Partial<ComponentInput<SvBottomNavComponent>> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const links = adapter();
  const seen: SvNavEvent[] = [];
  const sink: SvNavTelemetry = { kind: 'spec', retention: '30d', consent: () => true, record: (e) => seen.push(e) };
  const picked: BottomNavSelection[] = [];
  const { fixture } = await render(SvBottomNavComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvBottomNavComponent>,
    providers: [
      { provide: SV_LINK_ADAPTER, useValue: links.value },
      { provide: SV_NAV_TELEMETRY, useValue: sink },
    ],
  });
  fixture.componentInstance.itemSelected.subscribe((e) => picked.push(e));
  fixture.detectChanges();
  return { fixture, went: links.went, seen, picked };
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const links = (f: { nativeElement: unknown }) => [...el(f).querySelectorAll<HTMLAnchorElement>('a[data-sv-bottom-nav-item]')];
const labelOf = (a: HTMLAnchorElement) => a.querySelector('[data-sv-bottom-nav-label]');
const current = (f: { nativeElement: unknown }) =>
  links(f).filter((a) => a.getAttribute('aria-current') === 'page').map((a) => labelOf(a)?.textContent?.trim());

describe('SvBottomNavComponent — links, not tabs', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('★ renders a named <nav> of real links — no tablist, no tabs', async () => {
    const { fixture } = await setup();
    const nav = el(fixture).querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Main navigation');
    expect(links(fixture).map((a) => a.getAttribute('href'))).toEqual([
      '/app', '/app/inbox', '/app/search', '/app/alerts', 'https://help.example.com',
    ]);
    expect(el(fixture).querySelector('[role="tablist"], [role="tab"]')).toBeNull();
    expect(el(fixture).querySelector('ul')?.getAttribute('role')).toBe('list');
  });

  it('★ marks the longest matching route current with aria-current="page"', async () => {
    const { fixture } = await setup({ activeRoute: '/app/inbox/8814?tab=all' });
    expect(current(fixture)).toEqual(['Inbox']);
    fixture.componentRef.setInput('activeRoute', '/app');
    fixture.detectChanges();
    expect(current(fixture)).toEqual(['Home']);
    fixture.componentRef.setInput('activeRoute', '/elsewhere');
    fixture.detectChanges();
    expect(current(fixture)).toEqual([]);
  });

  it('reads a badge after the label, and a dot as words', async () => {
    const { fixture } = await setup();
    const [, inbox, , alerts] = links(fixture);
    expect(inbox.querySelector('[data-sv-bottom-nav-badge]')?.getAttribute('aria-hidden')).toBe('true');
    // The label first, then the badge as words — "Inbox, 3", never "3 Inbox".
    const srOnly = inbox.querySelectorAll('.sr-only');
    expect(labelOf(inbox)!.compareDocumentPosition(srOnly[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(srOnly[0].textContent?.trim()).toBe(', 3');
    expect(alerts.querySelector('[data-sv-bottom-nav-dot]')).toBeTruthy();
    expect(alerts.querySelector('.sr-only')?.textContent).toContain('new activity');
  });

  it('opens an external destination in a new tab, and says so', async () => {
    const { fixture } = await setup();
    const help = links(fixture)[4];
    expect(help.getAttribute('target')).toBe('_blank');
    expect(help.getAttribute('rel')).toBe('noopener noreferrer');
    expect(help.textContent).toContain('(opens in a new tab)');
  });

  it('gives every destination a 48px target', async () => {
    const { fixture } = await setup();
    for (const a of links(fixture)) expect(a.className).toContain('min-h-12');
  });

  it('a click navigates through the adapter, records the move and emits itemSelected', async () => {
    const { fixture, went, seen, picked } = await setup();
    links(fixture)[2].click();
    expect(went).toEqual(['/app/search']);
    expect(picked.map((p) => [p.item.label, p.index])).toEqual([['Search', 2]]);
    expect(seen.at(-1)).toMatchObject({ surface: 'bottom-nav', intent: 'jump' });
  });

  it('★ never intercepts a modified click, and leaves an external link to the browser', async () => {
    const { fixture, went, picked } = await setup();
    links(fixture)[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(went).toEqual([]);
    expect(picked).toEqual([]);
    const external = new MouseEvent('click', { bubbles: true, cancelable: true });
    links(fixture)[4].dispatchEvent(external);
    expect(went).toEqual([]);
    expect(external.defaultPrevented).toBe(false);
  });

  it('shows only the current label when labelVisibility="active" — the others stay as names', async () => {
    const { fixture } = await setup({ activeRoute: '/app/search', labelVisibility: 'active' });
    expect(labelOf(links(fixture)[2])?.className).not.toContain('sr-only');
    expect(labelOf(links(fixture)[0])?.className).toContain('sr-only');
    expect(links(fixture)[0].textContent).toContain('Home');
  });

  it('★ fixed: pinned to the bottom, padded clear of the home indicator, its height reserved in the flow', async () => {
    const { fixture } = await setup();
    const nav = el(fixture).querySelector('nav')!;
    expect(nav.className).toContain('fixed');
    // jsdom's CSSOM does not parse `env()`, so the bound value is asserted.
    expect((fixture.componentInstance as unknown as { safeArea: string }).safeArea).toBe('env(safe-area-inset-bottom, 0px)');
    expect(nav.getAttribute('data-sv-sticky')).toBe('page-bottom');
    expect(el(fixture).querySelector('[data-sv-bottom-nav-spacer]')).toBeTruthy();
  });

  it('static and sticky positions reserve nothing; sticky marks its band', async () => {
    const { fixture } = await setup({ position: 'static' });
    expect(el(fixture).querySelector('[data-sv-bottom-nav-spacer]')).toBeNull();
    expect(el(fixture).querySelector('nav')?.getAttribute('data-sv-sticky')).toBeNull();
    fixture.componentRef.setInput('position', 'sticky');
    fixture.detectChanges();
    expect(el(fixture).className).toContain('sticky');
    expect(el(fixture).querySelector('nav')?.getAttribute('data-sv-sticky')).toBe('bottom');
  });

  it('hideFrom hides the bar from a breakpoint up', async () => {
    const { fixture } = await setup({ hideFrom: 'md' });
    expect(el(fixture).className).toContain('md:hidden');
  });

  it('takes its landmark name and labels from inputs', async () => {
    const { fixture } = await setup({ ariaLabel: 'App sections', labels: { newActivity: 'neu' } });
    expect(el(fixture).querySelector('nav')?.getAttribute('aria-label')).toBe('App sections');
    expect(links(fixture)[3].textContent).toContain('neu');
  });

  it('warns once in dev mode past five destinations', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ items: [...ITEMS, { label: 'More', route: '/more', icon: 'menu' }] });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('sv-bottom-nav'))).toBe(true);
    warn.mockRestore();
  });
});
