import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { untilRendered } from '../../../../src/testing/async';
import {
  provideSvNavLocation,
  svHashNavLocation,
  svNoopNavLocation,
  svQueryParamNavLocation,
} from '@styloviz/core';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

/**
 * ============================================================================
 *  URL synchronisation — `NV-01-I1`, `NV-01-M1`
 * ============================================================================
 *
 * "A link to a specific FAQ answer cannot open it" is the source item, and it is
 * the whole reason this adoption is worth doing: today a support reply can only
 * say *open the Shipping section*.
 *
 * Three decisions are pinned here and each one is a trap:
 *   · the open set is a LIST under one key, percent-encoded per id;
 *   · the default set is ABSENT from the URL, but "the user closed the default"
 *     is not the same thing and writes `?open=`;
 *   · an id `items()` does not name yet is KEPT, because `items()` is `[]` until
 *     a fetch lands.
 */

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Ships in 2 days.' },
  { id: 'returns', title: 'Returns', content: '30 days.' },
  { id: 'warranty', title: 'Warranty', content: 'One year.', disabled: true },
];

function at(url: string): void {
  window.history.replaceState(null, '', url);
}

beforeEach(() => at('/faq'));

async function setup(
  inputs: Partial<ComponentInput<SvAccordionComponent>> = {},
  addressable = true,
) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, expandMode: 'multi', ...inputs } as ComponentInput<SvAccordionComponent>,
    providers: [
      provideSvNavLocation(addressable ? svQueryParamNavLocation() : svNoopNavLocation()),
    ],
  });
  return fixture;
}

const query = () => new URLSearchParams(window.location.search);
const open = (f: { componentInstance: SvAccordionComponent }) =>
  [...f.componentInstance.openIds()].sort();
const toggle = (f: { componentInstance: SvAccordionComponent }, id: string) =>
  f.componentInstance.toggle(ITEMS.find((i) => i.id === id)!);

describe('SvAccordionComponent — opting in', () => {
  it('touches no URL without a urlKey', async () => {
    const f = await setup();
    toggle(f, 'returns');
    f.detectChanges();
    expect(window.location.search).toBe('');
    expect(open(f)).toEqual(['returns']);
  });

  it('touches no URL without a provided location', async () => {
    const f = await setup({ urlKey: 'open' }, false);
    toggle(f, 'returns');
    f.detectChanges();
    expect(window.location.search).toBe('');
    expect(open(f)).toEqual(['returns']);
  });

  it('writes the open section once both halves are in place', async () => {
    const f = await setup({ urlKey: 'open' });
    toggle(f, 'shipping');
    f.detectChanges();
    expect(query().get('open')).toBe('shipping');
  });
});

describe('SvAccordionComponent — component to URL', () => {
  /** `multi` means the state is a set, so one key carries a list. */
  it('joins several open sections with commas', async () => {
    const f = await setup({ urlKey: 'open' });
    toggle(f, 'shipping');
    f.detectChanges();
    toggle(f, 'returns');
    f.detectChanges();

    expect(query().get('open')).toBe('shipping,returns');
  });

  /**
   * ★ Each id is percent-encoded before joining. A comma inside a consumer's id
   * would otherwise come back as two ids — and SILENTLY, because
   * `URLSearchParams` decodes `%2C` for us before the separator is ever seen.
   */
  it('round-trips an id that contains the separator', async () => {
    const items: AccordionItem[] = [{ id: 'a,b', title: 'A', content: 'x' }];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAccordionComponent, {
      inputs: { items, expandMode: 'multi', urlKey: 'open' } as ComponentInput<SvAccordionComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    fixture.componentInstance.toggle(items[0]);
    fixture.detectChanges();

    expect(query().get('open')).toBe('a%2Cb');

    TestBed.resetTestingModule();
    const { fixture: reloaded } = await render(SvAccordionComponent, {
      inputs: { items, expandMode: 'multi', urlKey: 'open' } as ComponentInput<SvAccordionComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    expect([...reloaded.componentInstance.openIds()]).toEqual(['a,b']);
  });

  /** Nothing open and no defaults is this page's own default — no key. */
  it('omits the key entirely when nothing is open', async () => {
    const f = await setup({ urlKey: 'open' });
    expect(query().has('open')).toBe(false);

    toggle(f, 'shipping');
    f.detectChanges();
    toggle(f, 'shipping');
    f.detectChanges();

    expect(query().has('open')).toBe(false);
  });

  /**
   * ★ The outcome that is easy to miss. A page that opens a section by default
   * leaves the URL clean — but a user who CLOSED that section has to be able to
   * say so, or a refresh reopens it. That state is `?open=`, which is a different
   * URL from no key at all.
   */
  it('separates "the default" from "the user closed the default"', async () => {
    const withDefault = ITEMS.map((i) =>
      i.id === 'shipping' ? { ...i, defaultOpen: true } : i,
    );

    const f = await setup({ urlKey: 'open', items: withDefault });
    expect(open(f)).toEqual(['shipping']);
    expect(query().has('open')).toBe(false);

    toggle(f, 'shipping');
    f.detectChanges();

    expect(open(f)).toEqual([]);
    expect(query().get('open')).toBe('');

    // …and the empty value survives a reload as "nothing open".
    TestBed.resetTestingModule();
    const { fixture: reloaded } = await render(SvAccordionComponent, {
      inputs: {
        items: withDefault,
        expandMode: 'multi',
        urlKey: 'open',
      } as ComponentInput<SvAccordionComponent>,
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    expect([...reloaded.componentInstance.openIds()]).toEqual([]);
  });

  /**
   * Opening a section is reading, not navigating. A reader who skimmed six
   * answers and pressed back means "leave this page", not "close the sixth one".
   */
  it('replaces rather than pushing', async () => {
    const f = await setup({ urlKey: 'open' });
    const before = window.history.length;

    toggle(f, 'shipping');
    f.detectChanges();
    toggle(f, 'returns');
    f.detectChanges();

    expect(query().get('open')).toBe('shipping,returns');
    expect(window.history.length).toBe(before);
  });

  it('leaves the path and other query keys alone', async () => {
    at('/faq?lang=en');
    const f = await setup({ urlKey: 'open' });
    toggle(f, 'returns');
    f.detectChanges();

    expect(window.location.pathname).toBe('/faq');
    expect(query().get('lang')).toBe('en');
  });
});

describe('SvAccordionComponent — URL to component', () => {
  it('opens the section the URL named', async () => {
    at('/faq?open=returns');
    const f = await setup({ urlKey: 'open' });
    expect(open(f)).toEqual(['returns']);
  });

  it('opens several, and beats defaultOpen', async () => {
    at('/faq?open=shipping,returns');
    const f = await setup({
      urlKey: 'open',
      items: ITEMS.map((i) => (i.id === 'warranty' ? i : { ...i, defaultOpen: i.id === 'shipping' })),
    });
    expect(open(f)).toEqual(['returns', 'shipping']);
  });

  it('follows the address bar changing under it', async () => {
    at('/faq?open=returns');
    const f = await setup({ urlKey: 'open' });
    expect(open(f)).toEqual(['returns']);

    at('/faq?open=shipping');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect(open(f)).toEqual(['shipping']);
  });

  /**
   * ★ The decision this file exists to protect, and the third family to make it.
   * Validating membership loses every deep link in an accordion whose sections
   * arrive from a request, because `items()` is `[]` at first render and *every*
   * id is unknown at that moment.
   */
  it('keeps an id the items do not name yet', async () => {
    at('/faq?open=returns');
    const f = await setup({ urlKey: 'open', items: [] });

    expect(open(f)).toEqual(['returns']);

    f.componentRef.setInput('items', ITEMS);
    f.detectChanges();
    expect(open(f)).toEqual(['returns']);
  });

  /** The other side of that line: a panel this component can see is gated. */
  it('refuses a section it can see is disabled', async () => {
    at('/faq?open=warranty');
    const f = await setup({ urlKey: 'open' });
    expect(open(f)).toEqual([]);
  });

  /**
   * `single` mode means the open state is a value, not a set. A URL naming two
   * sections is claiming something this component's own mode forbids.
   */
  it('honours only the first id in single mode', async () => {
    at('/faq?open=returns,shipping');
    const f = await setup({ urlKey: 'open', expandMode: 'single' });
    expect(open(f)).toEqual(['returns']);
  });
});

describe('SvAccordionComponent — in the hash', () => {
  /**
   * ★ This is the one family whose location may honestly be either kind: a single
   * open section in the hash is `#shipping`, which is the thing a reader pastes
   * into a message.
   */
  it('puts one open section in the hash', async () => {
    at('/faq');
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAccordionComponent, {
      inputs: {
        items: ITEMS,
        expandMode: 'single',
        urlKey: 'open',
      } as ComponentInput<SvAccordionComponent>,
      providers: [provideSvNavLocation(svHashNavLocation('open'))],
    });

    fixture.componentInstance.toggle(ITEMS[0]);
    fixture.detectChanges();

    expect(window.location.hash).toBe('#shipping');
    expect(window.location.search).toBe('');
  });

  it('opens the section a hash link named', async () => {
    at('/faq#returns');
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAccordionComponent, {
      inputs: {
        items: ITEMS,
        expandMode: 'single',
        urlKey: 'open',
      } as ComponentInput<SvAccordionComponent>,
      providers: [provideSvNavLocation(svHashNavLocation('open'))],
    });

    expect([...fixture.componentInstance.openIds()]).toEqual(['returns']);
  });
});

/**
 * ★ `NV-01-M1`: a deep link has to bring its section ON SCREEN. The panel's DOM
 * id is `${uid}-panel-<id>`, so the browser's own `#fragment` scroll can never
 * find it — a link that opens a section below the fold without scrolling to it
 * looks exactly like a link that did nothing. jsdom has no `scrollIntoView`, so
 * it is stubbed on the prototype and the stub records which element asked.
 */
describe('SvAccordionComponent — a deep link scrolls its section into view', () => {
  let scrolled: Element[] = [];
  const original = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
  });
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  const header = (f: { nativeElement: unknown }, id: string) =>
    (f.nativeElement as HTMLElement).querySelector(`[id$="-header-${id}"]`);

  it('scrolls the opened section`s header into view on the first URL-driven open', async () => {
    at('/faq?open=returns');
    const f = await setup({ urlKey: 'open' });
    await untilRendered(f, () => scrolled.length > 0, { label: 'the deep-linked header scrolled' });

    expect(scrolled).toEqual([header(f, 'returns')]);
  });

  it('waits for sections that arrive after the URL was read', async () => {
    at('/faq?open=returns');
    const f = await setup({ urlKey: 'open', items: [] });
    f.detectChanges();
    expect(scrolled).toEqual([]);

    f.componentRef.setInput('items', ITEMS);
    await untilRendered(f, () => scrolled.length > 0, { label: 'the late header scrolled' });

    expect(scrolled).toEqual([header(f, 'returns')]);
  });

  it('does not scroll for a page with no deep link, nor for a user`s own toggle', async () => {
    const f = await setup({ urlKey: 'open' });
    toggle(f, 'returns');
    f.detectChanges();
    // A positive landmark first: the toggle reached the URL, so the render
    // that would have scrolled has happened.
    await untilRendered(f, () => query().get('open') === 'returns');

    expect(scrolled).toEqual([]);
  });

  it('does not scroll again when back/forward opens another section later', async () => {
    at('/faq?open=returns');
    const f = await setup({ urlKey: 'open' });
    await untilRendered(f, () => scrolled.length === 1);

    at('/faq?open=shipping');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await untilRendered(f, () => open(f).includes('shipping'));

    expect(scrolled).toEqual([header(f, 'returns')]);
  });
});

