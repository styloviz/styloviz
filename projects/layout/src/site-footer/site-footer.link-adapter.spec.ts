import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { provideSvLinkAdapter, type SvLinkTarget } from '@styloviz/core';
import { SvSiteFooterComponent, type FooterColumn, type FooterLink } from './site-footer.component';

/**
 * In-app column links go through `SV_LINK_ADAPTER` (1.0 release audit, M6).
 *
 * A column link with an href used to be followed by the browser — a full page
 * load — while the store template ALSO routed from `linkSelect`: two
 * navigations for one click. These pin the single-navigation contract.
 */

const COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Shop',
    links: [
      { label: 'Sale', href: '/shop/sale' },
      { label: 'Partner', href: 'https://partner.example/' },
      { label: 'Mail', href: 'mailto:help@shop.example' },
      { label: 'Pricing' },
    ],
  },
];

async function setup(handled = true) {
  const navigated: SvLinkTarget[] = [];
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSiteFooterComponent, {
    inputs: { columns: COLUMNS } as ComponentInput<SvSiteFooterComponent>,
    providers: [
      provideSvLinkAdapter({
        kind: 'test',
        href: (t) => (typeof t === 'string' ? t : t.join('/')),
        navigate: (t) => {
          navigated.push(t);
          return handled;
        },
      }),
    ],
  });
  const selected: FooterLink[] = [];
  fixture.componentInstance.linkSelect.subscribe((l) => selected.push(l));
  const root = fixture.nativeElement as HTMLElement;
  const click = (label: string, init: MouseEventInit = {}): MouseEvent => {
    const a = [...root.querySelectorAll('a')].find((x) => x.textContent?.trim().startsWith(label));
    if (!a) throw new Error(`no link "${label}"`);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    a.dispatchEvent(event);
    return event;
  };
  return { navigated, selected, click };
}

describe('SvSiteFooterComponent — in-app links and the link adapter', () => {
  it('a plain click on an in-app href is routed once, and the page load is cancelled', async () => {
    const { navigated, selected, click } = await setup();
    const event = click('Sale');
    expect(navigated).toEqual(['/shop/sale']);
    expect(event.defaultPrevented).toBe(true);
    expect(selected.map((l) => l.label)).toEqual(['Sale']);
  });

  it('an adapter that declines leaves the browser to follow the href', async () => {
    const { navigated, click } = await setup(false);
    expect(click('Sale').defaultPrevented).toBe(false);
    expect(navigated).toEqual(['/shop/sale']);
  });

  it('⌘-click and middle click keep "open in new tab"', async () => {
    const { navigated, click } = await setup();
    expect(click('Sale', { metaKey: true }).defaultPrevented).toBe(false);
    expect(click('Sale', { button: 1 }).defaultPrevented).toBe(false);
    expect(navigated).toEqual([]);
  });

  it('external, mailto and href-less links never reach the adapter', async () => {
    const { navigated, selected, click } = await setup();
    expect(click('Partner').defaultPrevented).toBe(false);
    expect(click('Mail').defaultPrevented).toBe(false);
    click('Pricing');
    expect(navigated).toEqual([]);
    expect(selected.map((l) => l.label)).toEqual(['Partner', 'Mail', 'Pricing']);
  });
});
