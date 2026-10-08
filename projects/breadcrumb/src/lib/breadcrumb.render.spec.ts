import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  `sv-breadcrumb` — what each crumb renders as
 * ============================================================================
 *
 * A breadcrumb is four different elements depending on one crumb's state:
 * a link, a disabled span, the current page, or a plain middle span. Getting
 * that wrong is not a cosmetic bug — `aria-current="page"` on the wrong crumb
 * tells a screen-reader user they are somewhere they are not, and a disabled
 * crumb rendered as a link offers navigation the host has forbidden.
 *
 * Collapse behaviour lives in `breadcrumb.collapse.spec.ts`; the sibling
 * dropdown in `breadcrumb.menu.spec.ts`.
 */

const CRUMBS: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  { label: 'Orders', routerLink: '/orders' },
  { label: 'Order 42' },
];

/** Resets TestBed first so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBreadcrumbComponent, {
    inputs: { items: CRUMBS, ...inputs },
    providers: [provideRouter([])],
  });
  fixture.detectChanges();
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

/** Every crumb's rendered element, in order — scoped to the host, never `screen`. */
function crumbEls(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('ol > li > a, ol > li > span:not([aria-hidden])')]
    .filter((e) => !e.classList.contains('select-none'));
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SvBreadcrumbComponent — the trail', () => {
  it('renders a navigation landmark with an ordered list of crumbs', async () => {
    const { el } = await setup();
    const nav = el.querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(el.querySelectorAll('ol > li')).toHaveLength(3);
  });

  it('takes a custom landmark name, so two trails on a page are distinguishable', async () => {
    const { el } = await setup({ ariaLabel: 'You are here' });
    expect(el.querySelector('nav')!.getAttribute('aria-label')).toBe('You are here');
  });

  it('renders nothing but an empty list for an empty trail', async () => {
    // The untaken branch: no crumbs at all. It must not throw on `all[all.length - 1]`.
    const { el, c } = await setup({ items: [] });
    expect(el.querySelectorAll('ol > li')).toHaveLength(0);
    expect(c.visibleItems()).toEqual([]);
    expect(c.hasEllipsis()).toBe(false);
  });

  it('marks a single crumb as the current page, with no separator after it', async () => {
    const { el } = await setup({ items: [{ label: 'Dashboard' }] });
    expect(el.querySelector('[aria-current="page"]')!.textContent?.trim()).toBe('Dashboard');
    expect(el.querySelectorAll('svg')).toHaveLength(0); // no separator glyph
  });

  it('links every crumb but the last, which is the current page', async () => {
    const { el } = await setup();
    const links = [...el.querySelectorAll('ol a')];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Home', 'Orders']);
    const current = el.querySelector('[aria-current="page"]')!;
    expect(current.textContent?.trim()).toBe('Order 42');
    expect(current.tagName).toBe('SPAN');
  });

  it('renders a last crumb that HAS a routerLink as the current page anyway', async () => {
    // The "last" branch is checked before the routerLink branch: a trail whose
    // final crumb carries a link must still not be a link, or the user can
    // navigate to the page they are already on.
    const items: BreadcrumbItem[] = [{ label: 'Home', routerLink: '/' }, { label: 'Here', routerLink: '/here' }];
    const { el } = await setup({ items });
    expect(el.querySelectorAll('ol a')).toHaveLength(1);
    expect(el.querySelector('[aria-current="page"]')!.textContent?.trim()).toBe('Here');
  });

  it('renders a middle crumb with no routerLink as plain, non-interactive text', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Archive' }, // no link, not last
      { label: 'Order 42' },
    ];
    const { el } = await setup({ items });
    expect(el.querySelectorAll('ol a')).toHaveLength(1);
    const middle = crumbEls(el)[1];
    expect(middle.tagName).toBe('SPAN');
    expect(middle.hasAttribute('aria-current')).toBe(false);
    expect(middle.hasAttribute('aria-disabled')).toBe(false);
  });

  it('renders a disabled crumb as aria-disabled text, never as a link', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Billing', routerLink: '/billing', disabled: true },
      { label: 'Invoice' },
    ];
    const { el } = await setup({ items });
    const disabled = el.querySelector('[aria-disabled="true"]')!;
    expect(disabled.tagName).toBe('SPAN');
    expect(disabled.textContent?.trim()).toBe('Billing');
    expect([...el.querySelectorAll('ol a')].map((a) => a.textContent?.trim())).toEqual(['Home']);
  });

  it('emits (crumbClick) only for a linked, enabled crumb', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Locked', routerLink: '/locked', disabled: true },
      { label: 'Bare' },
    ];
    const { c } = await setup({ items });
    const seen: BreadcrumbItem[] = [];
    c.crumbClick.subscribe((i) => seen.push(i));

    c.onCrumbClick(items[0]);
    c.onCrumbClick(items[1]); // disabled — must not emit
    c.onCrumbClick(items[2]); // no routerLink — must not emit
    expect(seen).toEqual([items[0]]);
  });
});

describe('SvBreadcrumbComponent — separators', () => {
  it('chevron (the default) is drawn as a library glyph', async () => {
    const { c, el } = await setup();
    expect(c.isSvgSeparator()).toBe(true);
    expect(c.separatorIcon()).toBe('chevron-right');
    // Every separator comes from the icon library, not a hand-drawn <path>.
    expect(el.querySelectorAll('ol sv-icon[aria-hidden="true"], ol sv-icon')).not.toHaveLength(0);
    expect(el.querySelectorAll('ol svg')).toHaveLength(2);
    expect([...el.querySelectorAll('ol svg')].every((n) => n.closest('sv-icon'))).toBe(true);
  });

  it('arrow is its own glyph, not the chevron', async () => {
    const { c } = await setup({ separator: 'arrow' });
    expect(c.separatorIcon()).toBe('arrow-right');
    expect(c.separatorChar()).toBe('');
  });

  it('slash and dot are text characters, not SVG', async () => {
    const slash = await setup({ separator: 'slash' });
    expect(slash.c.isSvgSeparator()).toBe(false);
    expect(slash.c.separatorChar()).toBe('/');
    expect(slash.el.querySelectorAll('ol svg')).toHaveLength(0);
    expect(slash.el.textContent).toContain('/');

    const dot = await setup({ separator: 'dot' });
    expect(dot.c.separatorChar()).toBe('·');
    expect(dot.el.textContent).toContain('·');
  });

  it('custom uses the supplied icon NAME', async () => {
    const { c } = await setup({ separator: 'custom', customSeparatorIcon: 'chevrons-right' });
    expect(c.separatorIcon()).toBe('chevrons-right');
  });

  it('custom with no icon falls back to the chevron rather than rendering nothing', async () => {
    const { c } = await setup({ separator: 'custom' });
    expect(c.separatorIcon()).toBe('chevron-right');
  });

  it('puts one separator between crumbs and none after the last', async () => {
    const { el } = await setup({ separator: 'slash' });
    expect(el.querySelectorAll('ol span[aria-hidden="true"]')).toHaveLength(2);
  });
});

describe('SvBreadcrumbComponent — variants and sizes', () => {
  it('plain leaves the nav and the crumbs undecorated', async () => {
    const { c } = await setup();
    expect(c.navWrapperClass()).toBe('');
    expect(c.linkClasses()).not.toContain('rounded-full');
    expect(c.currentClasses()).not.toContain('border-b-2');
    expect(c.middleClasses()).not.toContain('rounded-full');
    expect(c.disabledClasses()).not.toContain('rounded-full');
  });

  it('contained wraps the whole trail in a bordered chip', async () => {
    const { c } = await setup({ variant: 'contained' });
    expect(c.navWrapperClass()).toContain('rounded-lg border');
    // The crumbs themselves stay plain — only the wrapper changes.
    expect(c.linkClasses()).not.toContain('rounded-full');
  });

  it('pills rounds every kind of crumb, including the disabled one', async () => {
    const { c } = await setup({ variant: 'pills' });
    expect(c.linkClasses()).toContain('rounded-full');
    expect(c.currentClasses()).toContain('rounded-full');
    expect(c.middleClasses()).toContain('rounded-full');
    expect(c.disabledClasses()).toContain('rounded-full');
    expect(c.navWrapperClass()).toBe('');
  });

  it('underline gives the link a hover rule and the current crumb a solid one', async () => {
    const { c } = await setup({ variant: 'underline' });
    expect(c.linkClasses()).toContain('border-b-2 border-transparent');
    expect(c.currentClasses()).toContain('border-primary-600');
    // Only the two interactive-ish states get the rule; a middle span does not.
    expect(c.middleClasses()).not.toContain('border-b-2');
  });

  it('scales text, icon and separator together across the three sizes', async () => {
    const sm = await setup({ size: 'sm' });
    expect([sm.c.textClass(), sm.c.iconClass(), sm.c.separatorClass()])
      .toEqual(['text-xs', 'h-3 w-3', 'h-3 w-3']);

    const md = await setup({ size: 'md' });
    expect([md.c.textClass(), md.c.iconClass(), md.c.separatorClass()])
      .toEqual(['text-sm', 'h-3.5 w-3.5', 'h-3.5 w-3.5']);

    const lg = await setup({ size: 'lg' });
    expect([lg.c.textClass(), lg.c.iconClass(), lg.c.separatorClass()])
      .toEqual(['text-base', 'h-4 w-4', 'h-4 w-4']);
  });

  it('puts customClass on the root nav alongside the variant classes', async () => {
    const { el } = await setup({ variant: 'contained', customClass: 'my-trail' });
    const nav = el.querySelector('nav')!;
    expect(nav.className).toContain('my-trail');
    expect(nav.className).toContain('rounded-lg');
  });
});

describe('SvBreadcrumbComponent — icons, badges and labels', () => {
  it('renders a crumb icon only where one is declared', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/', icon: 'star' },
      { label: 'Orders' },
    ];
    const { el } = await setup({ items, separator: 'slash' });
    // separator is a text character here, so every svg is a crumb icon.
    expect(el.querySelectorAll('ol svg')).toHaveLength(1);
  });

  it('prepends the home glyph to the first crumb when asked, and only when it has none of its own', async () => {
    const { c } = await setup({ showHomeIcon: true });
    expect(c.iconNameFor(CRUMBS[0])).toBe('home');
    // Not the second crumb.
    expect(c.iconNameFor(CRUMBS[1])).toBeUndefined();
  });

  it('does not override a first crumb that brought its own icon', async () => {
    const items: BreadcrumbItem[] = [{ label: 'Home', routerLink: '/', icon: 'star' }, { label: 'X' }];
    const { c } = await setup({ items, showHomeIcon: true });
    expect(c.iconNameFor(items[0])).toBe('star');
  });

  it('adds no home glyph when the flag is off', async () => {
    const { c } = await setup();
    expect(c.iconNameFor(CRUMBS[0])).toBeUndefined();
  });

  it('renders a badge for a crumb that declares one, including the number zero', async () => {
    // `badge: 0` is a real count. A truthiness check would swallow it.
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/', badge: 0 },
      { label: 'Orders', routerLink: '/orders', badge: '12' },
      { label: 'Order 42' },
    ];
    const { el } = await setup({ items, separator: 'slash' });
    const badges = [...el.querySelectorAll('ol span.rounded-full')].map((s) => s.textContent?.trim());
    expect(badges).toEqual(['0', '12']);
  });

  it('clips long labels and offers the full text as a tooltip only when truncating', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'A very long section name', routerLink: '/a', title: 'The whole thing' },
      { label: 'Here' },
    ];
    const off = await setup({ items });
    expect(off.el.querySelector('ol [title]')).toBeNull();

    const on = await setup({ items, truncateLabels: true });
    const clipped = on.el.querySelector<HTMLElement>('ol .truncate')!;
    expect(clipped.getAttribute('title')).toBe('The whole thing');
  });

  it('falls back to the label itself when a truncated crumb declares no title', async () => {
    const items: BreadcrumbItem[] = [{ label: 'Section', routerLink: '/a' }, { label: 'Here' }];
    const { el } = await setup({ items, truncateLabels: true });
    expect(el.querySelector<HTMLElement>('ol .truncate')!.getAttribute('title')).toBe('Section');
  });

  it('hides only the middle crumbs on a phone, never the first or the last', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Orders', routerLink: '/orders' },
      { label: 'Order 42' },
    ];
    const { el, c } = await setup({ items, collapseOnMobile: true });
    const lis = [...el.querySelectorAll<HTMLElement>('ol > li')];
    expect(lis.map((li) => li.className.includes('hidden sm:flex'))).toEqual([false, true, false]);
    expect(c.isMiddleItem(items[0])).toBe(false);
    expect(c.isMiddleItem(items[1])).toBe(true);
    expect(c.isMiddleItem(items[2])).toBe(false);
  });

  it('never treats the ellipsis token itself as a middle crumb', async () => {
    // `isMiddleItem` drives a CSS-only mobile hide; hiding the ellipsis would
    // leave a trail that looks complete while three crumbs are missing.
    const { c } = await setup({ maxVisible: 2, collapseOnMobile: true });
    expect(c.isMiddleItem('__ellipsis__')).toBe(false);
  });

  it('leaves the li classes clean when mobile collapse is off', async () => {
    const { el } = await setup({ collapseOnMobile: false });
    expect([...el.querySelectorAll('ol > li')].some((li) => li.className.includes('hidden'))).toBe(false);
  });
});

/**
 * ============================================================================
 *  The loading skeleton — `NV-03-I8`
 * ============================================================================
 *
 * ★ **The skeleton reserves the trail's box; it does not invent one.** It used to
 * be three bars of 40 / 64 / 88px in a `gap-2` `<div>` with a hard-coded `/`,
 * while the trail is a `gap-1` `<ol>` of text with a *configurable* separator —
 * so every dimension was independently wrong, and the real crumbs arriving moved
 * the page under the reader's cursor.
 *
 * ⚠️ **jsdom has no layout**, so none of this can assert pixels. These tests pin
 * the two things that *cause* the shift and are observable here: the skeleton's
 * structure matches the trail's, and what fills each segment is the real label
 * whenever one is known. They do not prove the absence of a shift — that needs a
 * browser — and they say so rather than implying otherwise.
 */
describe('SvBreadcrumbComponent — loading skeleton', () => {
  it('replaces the trail with a busy status while loading', async () => {
    const { el } = await setup({ loading: true });
    const status = el.querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Loading breadcrumb…');
    // The trail's own crumbs are not rendered — only the reserved boxes. The
    // skeleton IS an `<ol>` now, so "no `ol`" is no longer the way to ask.
    expect(el.querySelector('[aria-current="page"]')).toBeNull();
    expect(el.querySelector('a')).toBeNull();
  });

  /**
   * ★ The structural half of the fix, and the half that mattered most: a `<div>`
   * of bars is a different HEIGHT from an `<ol>` of text, and a height change
   * moves the whole page rather than only the trail.
   */
  it('uses the same list structure and gap as the real trail', async () => {
    const loadingEl = (await setup({ loading: true })).el;
    const trailEl = (await setup()).el;

    const skeletonList = loadingEl.querySelector('ol')!;
    const trailList = trailEl.querySelector('ol')!;
    expect(skeletonList.className).toBe(trailList.className);

    const skeletonLi = skeletonList.querySelector('li')!;
    const trailLi = trailList.querySelector('li')!;
    expect(skeletonLi.className).toBe(trailLi.className);
  });

  /**
   * ★★ One separator, shared — and the old mismatch was the DEFAULT, not an edge
   * case. `separator` defaults to `'chevron'`, which the trail renders as an
   * icon; the skeleton hard-coded a `/` text character. So every consumer who
   * never touched the input got a skeleton whose separators were a different
   * element, of a different width, from the ones about to replace them.
   */
  it('renders the configured separator, not a hard-coded slash', async () => {
    // Default: chevron. No slashes anywhere, and a glyph per gap.
    const chevron = (await setup({ loading: true })).el;
    expect([...chevron.querySelectorAll('span')].some((s) => s.textContent?.trim() === '/'))
      .toBe(false);
    expect(chevron.querySelectorAll('sv-icon').length).toBe(2); // 3 crumbs → 2 separators

    // Opt into the text separator and the skeleton follows it.
    const slash = (await setup({ loading: true, separator: 'slash' })).el;
    expect([...slash.querySelectorAll('span')].filter((s) => s.textContent?.trim() === '/'))
      .toHaveLength(2);
  });

  /**
   * ★ **A label is an exact reservation; a count is a guess.** When the trail is
   * already known — a refresh rather than a cold load — the skeleton reserves
   * each crumb's own text, so the swap is pixel-identical and `skeletonCount`
   * is irrelevant.
   */
  it('reserves the real labels when the trail is already known', async () => {
    const { c, el } = await setup({ loading: true, skeletonCount: 9 });
    expect(c.skeletonCrumbs().map((s) => s.label)).toEqual(['Home', 'Orders', 'Order 42']);
    // Invisible, not absent: the box is occupied but nothing is legible, and it
    // is `aria-hidden` so the label is not announced as though it had arrived.
    const reserved = [...el.querySelectorAll('span.invisible')].map((s) => s.textContent);
    expect(reserved).toEqual(['Home', 'Orders', 'Order 42']);
    expect(el.querySelector('[role="status"]')!.textContent).toContain('Loading breadcrumb…');
  });

  it('falls back to skeletonCount segments only when there is no trail yet', async () => {
    const { c, el } = await setup({ items: [], loading: true, skeletonCount: 4 });
    expect(c.skeletonCrumbs().map((s) => s.label)).toEqual([null, null, null, null]);
    expect(c.skeletonCrumbs().map((s) => s.width)).toEqual([6, 10, 14, 6]);
    expect(el.querySelectorAll('span.animate-pulse')).toHaveLength(4);
  });

  /**
   * ★ The variant's BOX, not just the trail's: a pill's `px-2.5 py-1` makes the
   * row taller than bare text, an underline's `border-b-2 pb-0.5` does too, and
   * the current crumb's `font-medium` is wider. A skeleton without them shifted
   * the page when the trail arrived. Each segment must carry exactly the box
   * tokens the crumb replacing it will carry — and none of its colours.
   */
  describe('reserves each variant`s crumb box', () => {
    const BOX_TOKENS = ['rounded-full', 'px-2.5', 'py-1', 'border-b-2', 'pb-0.5', 'font-medium'];
    const boxOf = (e: Element) => BOX_TOKENS.filter((t) => e.classList.contains(t));
    const segments = (el: HTMLElement) =>
      [...el.querySelectorAll<HTMLElement>('[role="status"] ol > li > span[aria-hidden]')];

    for (const variant of ['plain', 'pills', 'underline'] as const) {
      it(`${variant}: every segment matches its crumb's box classes`, async () => {
        const skeleton = segments((await setup({ variant, loading: true })).el).map(boxOf);
        const trail = crumbEls((await setup({ variant })).el).map(boxOf);
        expect(skeleton).toEqual(trail);
      });
    }

    it('pills and underline reserve padding and the current crumb`s weight on a cold load too', async () => {
      const pills = segments((await setup({ items: [], variant: 'pills', loading: true })).el);
      expect(pills.map(boxOf)).toEqual([
        ['rounded-full', 'px-2.5', 'py-1'],
        ['rounded-full', 'px-2.5', 'py-1'],
        ['rounded-full', 'px-2.5', 'py-1', 'font-medium'],
      ]);
      const underline = segments((await setup({ items: [], variant: 'underline', loading: true })).el);
      expect(underline.map(boxOf)).toEqual([
        ['border-b-2', 'pb-0.5'],
        ['border-b-2', 'pb-0.5'],
        ['border-b-2', 'pb-0.5', 'font-medium'],
      ]);
      // The border is reserved, not drawn: its colour would announce a page
      // that has not loaded.
      expect(underline.every((s) => s.classList.contains('border-transparent'))).toBe(true);
    });

    it('reserves the home icon slot at the icon`s own size when showHomeIcon is on', async () => {
      const on = (await setup({ items: [], loading: true, showHomeIcon: true, size: 'lg' })).el;
      const slots = on.querySelectorAll('[data-sv-skeleton-icon]');
      expect(slots).toHaveLength(1);
      expect(segments(on)[0].contains(slots[0])).toBe(true);
      expect(slots[0].classList.contains('h-4')).toBe(true);
      expect(slots[0].classList.contains('w-4')).toBe(true);

      const off = (await setup({ items: [], loading: true })).el;
      expect(off.querySelector('[data-sv-skeleton-icon]')).toBeNull();
    });

    it('reserves a known crumb`s own icon on a refresh', async () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', routerLink: '/' },
        { label: 'Orders', routerLink: '/orders', icon: 'star' },
        { label: 'Order 42' },
      ];
      const { c } = await setup({ items, loading: true });
      expect(c.skeletonCrumbs().map((s) => s.icon)).toEqual([false, true, false]);
    });
  });

  it('never draws zero segments — an empty skeleton reads as a finished empty trail', async () => {
    const { c, el } = await setup({ items: [], loading: true, skeletonCount: 0 });
    expect(c.skeletonCrumbs()).toHaveLength(1);
    expect(el.querySelectorAll('span.animate-pulse')).toHaveLength(1);
  });
});

describe('SvBreadcrumbComponent — trackCrumb identity', () => {
  it('keys a linked crumb by route and label, and an unlinked one by position', async () => {
    const { c } = await setup();
    const t = (c as unknown as { trackCrumb(i: number, item: unknown): string }).trackCrumb.bind(c);
    expect(t(0, CRUMBS[0])).toBe('/|Home');
    expect(t(2, CRUMBS[2])).toBe('2|Order 42');
    expect(t(1, '__ellipsis__')).toBe('__ellipsis__');
  });

  it('joins an array routerLink into a single stable key', async () => {
    const { c } = await setup();
    const t = (c as unknown as { trackCrumb(i: number, item: unknown): string }).trackCrumb.bind(c);
    expect(t(0, { label: 'Order', routerLink: ['/orders', '42'] })).toBe('/orders/42|Order');
  });

  it('keeps two sections that share a route apart by folding in the label', async () => {
    const { c } = await setup();
    const t = (c as unknown as { trackCrumb(i: number, item: unknown): string }).trackCrumb.bind(c);
    expect(t(0, { label: 'A', routerLink: '/x' })).not.toBe(t(1, { label: 'B', routerLink: '/x' }));
  });
});
