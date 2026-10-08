import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvTabsComponent, type TabItem, type TabsStyle } from './tabs.component';

/**
 * ============================================================================
 *  `sv-tabs` — the visual matrix
 * ============================================================================
 *
 * Six styles × two layouts × {active, inactive, disabled} × {fullWidth,
 * scrollable}. The class strings themselves are not the interesting part —
 * what each test asserts is the *decision*: which edge the rule sits on, that
 * the active tab is visually distinguishable from the inactive one, and that a
 * disabled tab never picks up a hover affordance it cannot honour.
 *
 * ★ Every one of these is checked through `tabClasses()` / `listClasses()`
 * rather than by measuring: jsdom has no layout, so `offsetWidth` is 0 for
 * every tab and nothing could be concluded from it.
 *
 * Behaviour — selection, the keyboard, panels, two strips on a page — lives in
 * `tabs.component.spec.ts`.
 */

const ALL_STYLES: TabsStyle[] = ['underline', 'pills', 'boxed', 'lifted', 'border-card', 'unstyled'];

const TABS: TabItem[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C', disabled: true },
];

async function setup(inputs: Partial<ComponentInput<SvTabsComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvTabsComponent, {
    inputs: { tabs: TABS, activeId: 'a', ...inputs } as ComponentInput<SvTabsComponent>,
  });
  fixture.detectChanges();
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

const ACTIVE = TABS[0];
const INACTIVE = TABS[1];
const DISABLED = TABS[2];

// ─────────────────────────────────────────────────────────────────────────────

describe('SvTabsComponent — what every style must guarantee', () => {
  it('gives the active tab a treatment the inactive one does not have', async () => {
    // The one invariant that has to hold for all six: "which tab am I on?" must
    // be answerable without reading `aria-selected`.
    for (const tabsStyle of ALL_STYLES) {
      const { c } = await setup({ tabsStyle });
      const active = c.tabClasses(ACTIVE);
      const inactive = c.tabClasses(INACTIVE);
      if (tabsStyle === 'unstyled') {
        // …except `unstyled`, which is explicitly headless: the hook is the
        // `data-active` attribute, asserted below.
        expect(active, tabsStyle).toBe(inactive);
      } else {
        expect(active, tabsStyle).not.toBe(inactive);
      }
    }
  });

  it('marks a disabled tab as not-clickable in every style', async () => {
    for (const tabsStyle of ALL_STYLES) {
      const { c } = await setup({ tabsStyle });
      expect(c.tabClasses(DISABLED), tabsStyle).toContain('cursor-not-allowed opacity-40');
      expect(c.tabClasses(INACTIVE), tabsStyle).toContain('cursor-pointer');
    }
  });

  it('never offers a hover affordance on a disabled tab', async () => {
    // A tab that lights up on hover and then refuses the click is worse than
    // one that never lit up.
    for (const tabsStyle of ALL_STYLES) {
      for (const layout of ['horizontal', 'vertical'] as const) {
        const { c } = await setup({ tabsStyle, layout });
        expect(c.tabClasses(DISABLED), `${tabsStyle}/${layout}`).not.toContain('hover:');
      }
    }
  });

  it('exposes data-active and data-disabled hooks so unstyled can be themed at all', async () => {
    const { el } = await setup({ tabsStyle: 'unstyled' });
    const wrappers = [...el.querySelectorAll<HTMLElement>('[role="tablist"] > span')];
    expect(wrappers.map((s) => s.hasAttribute('data-active'))).toEqual([true, false, false]);
    expect(wrappers.map((s) => s.hasAttribute('data-disabled'))).toEqual([false, false, true]);
  });

  it('unstyled strips every decorative class but keeps the structural ones', async () => {
    const { c } = await setup({ tabsStyle: 'unstyled' });
    const classes = c.tabClasses(ACTIVE);
    expect(classes).toContain('inline-flex items-center');
    expect(classes).toContain('px-4 py-2.5');   // padding is layout, not decoration
    expect(classes).not.toContain('border');
    expect(classes).not.toContain('rounded');
    expect(classes).not.toContain('bg-');
  });
});

describe('SvTabsComponent — where the rule sits', () => {
  it('underline: a bottom rule horizontally, a right rule vertically', async () => {
    const h = await setup({ tabsStyle: 'underline' });
    expect(h.c.tabClasses(ACTIVE)).toContain('border-b-2 -mb-px');
    expect(h.c.listClasses()).toContain('border-b border-gray-200/80');

    const v = await setup({ tabsStyle: 'underline', layout: 'vertical' });
    expect(v.c.tabClasses(ACTIVE)).toContain('border-r-2 -mr-px');
    expect(v.c.listClasses()).toContain('border-r border-gray-200/80');
  });

  it('lifted: a raised card horizontally, a left-side rule vertically', async () => {
    const h = await setup({ tabsStyle: 'lifted' });
    expect(h.c.tabClasses(ACTIVE)).toContain('rounded-t-lg border border-b-0 -mb-px');
    expect(h.c.listClasses()).toContain('border-b');

    const v = await setup({ tabsStyle: 'lifted', layout: 'vertical' });
    expect(v.c.tabClasses(ACTIVE)).toContain('border-r-2 -mr-px');
    expect(v.c.tabClasses(ACTIVE)).toContain('bg-primary-50/50');
    expect(v.c.listClasses()).toContain('border-r');
  });

  it('border-card: the tab joins the panel edge on the correct side', async () => {
    const h = await setup({ tabsStyle: 'border-card' });
    expect(h.c.tabClasses(ACTIVE)).toContain('-mb-px rounded-t-lg border border-b-0');
    expect(h.c.rootClasses()).toContain('overflow-hidden rounded-xl border');
    expect(h.c.listClasses()).toContain('border-b border-gray-200');

    const v = await setup({ tabsStyle: 'border-card', layout: 'vertical' });
    expect(v.c.tabClasses(ACTIVE)).toContain('-mr-px rounded-l-lg border border-r-0');
    expect(v.c.listClasses()).toContain('border-r border-gray-200');
  });

  it('pills and boxed round the tab in both layouts, and only boxed wraps the list', async () => {
    for (const layout of ['horizontal', 'vertical'] as const) {
      const pills = await setup({ tabsStyle: 'pills', layout });
      expect(pills.c.tabClasses(ACTIVE), layout).toContain('rounded-lg');
      expect(pills.c.tabClasses(ACTIVE), layout).toContain('bg-primary-600 text-white');
      expect(pills.c.listClasses(), layout).not.toContain('rounded-xl bg-gray-100');

      const boxed = await setup({ tabsStyle: 'boxed', layout });
      expect(boxed.c.tabClasses(ACTIVE), layout).toContain('rounded-lg');
      expect(boxed.c.listClasses(), layout).toContain('rounded-xl bg-gray-100 p-1');
    }
  });

  it('only border-card wraps the whole control in a card', async () => {
    for (const tabsStyle of ALL_STYLES) {
      const { c } = await setup({ tabsStyle });
      const wrapped = c.rootClasses().includes('rounded-xl border');
      expect(wrapped, tabsStyle).toBe(tabsStyle === 'border-card');
    }
  });

  it('lays the root out as a row for a vertical strip and a column for a horizontal one', async () => {
    const h = await setup();
    expect(h.c.rootClasses()).toContain('flex flex-col');
    const v = await setup({ layout: 'vertical' });
    expect(v.c.rootClasses()).toContain('flex gap-4');
  });

  it('appends customClass to the root', async () => {
    const { c } = await setup({ customClass: 'my-tabs' });
    expect(c.rootClasses().endsWith('my-tabs')).toBe(true);
    // …and leaves no empty segment behind when there is none.
    const bare = await setup();
    expect(bare.c.rootClasses().endsWith(' ')).toBe(false);
  });
});

describe('SvTabsComponent — fullWidth and scrollable', () => {
  it('stretches the tabs only in a horizontal strip, in every style', async () => {
    for (const tabsStyle of ALL_STYLES) {
      const h = await setup({ tabsStyle, fullWidth: true });
      expect(h.c.tabClasses(ACTIVE), tabsStyle).toContain('flex-1 justify-center');
      expect(h.c.listClasses(), tabsStyle).toContain('w-full');

      // `fullWidth` is documented as horizontal-only — a vertical strip is
      // already full width, and `flex-1` there would stretch the tabs
      // vertically instead, which is not what anyone asked for.
      const v = await setup({ tabsStyle, layout: 'vertical', fullWidth: true });
      expect(v.c.tabClasses(ACTIVE), tabsStyle).not.toContain('flex-1');
      expect(v.c.listClasses(), tabsStyle).not.toContain('w-full');
    }
  });

  it('keeps tabs at their natural width only when scrollable, and only horizontally', async () => {
    const off = await setup();
    expect(off.c.tabClasses(ACTIVE)).not.toContain('shrink-0');

    const on = await setup({ scrollable: true });
    expect(on.c.tabClasses(ACTIVE)).toContain('shrink-0');

    const vertical = await setup({ scrollable: true, layout: 'vertical' });
    expect(vertical.c.tabClasses(ACTIVE)).not.toContain('shrink-0');
  });

  it('always allows horizontal scroll on a horizontal list, and never on a vertical one', async () => {
    // `overflow-x-auto` shows no scrollbar while the tabs fit, so it costs
    // nothing — and without it a long strip on a phone forces page overflow.
    for (const tabsStyle of ALL_STYLES) {
      const h = await setup({ tabsStyle });
      expect(h.c.listClasses(), tabsStyle).toContain('overflow-x-auto overflow-y-hidden');
      const v = await setup({ tabsStyle, layout: 'vertical' });
      expect(v.c.listClasses(), tabsStyle).not.toContain('overflow-x-auto');
      expect(v.c.listClasses(), tabsStyle).toContain('shrink-0');
    }
  });
});

describe('SvTabsComponent — sizes', () => {
  it('scales text and icon together across the three sizes', async () => {
    const expected = {
      sm: ['text-xs', 'h-3.5 w-3.5'],
      md: ['text-sm', 'h-4 w-4'],
      lg: ['text-base', 'h-5 w-5'],
    } as const;
    for (const [size, [text, icon]] of Object.entries(expected)) {
      const { c } = await setup({ size: size as 'sm' | 'md' | 'lg' });
      expect(c.tabTextClass(), size).toBe(text);
      expect(c.iconClass(), size).toBe(icon);
    }
  });

  it('uses tighter horizontal padding for the flat styles than for the boxy ones', async () => {
    // underline / pills / unstyled sit flush; boxed / lifted / border-card have
    // a border of their own and need the extra breathing room.
    const flat = await setup({ tabsStyle: 'underline', size: 'md' });
    expect(flat.c.tabPadClass()).toBe('px-4 py-2.5');
    for (const tabsStyle of ['boxed', 'lifted', 'border-card'] as const) {
      const boxy = await setup({ tabsStyle, size: 'md' });
      expect(boxy.c.tabPadClass(), tabsStyle).toBe('px-4 py-2');
    }
  });

  it('uses the boxy padding for every style once the strip is vertical', async () => {
    // A vertical strip has no flush edge to sit against, so the distinction
    // above does not apply.
    for (const tabsStyle of ALL_STYLES) {
      const { c } = await setup({ tabsStyle, layout: 'vertical', size: 'lg' });
      expect(c.tabPadClass(), tabsStyle).toBe('px-5 py-2.5');
    }
  });

  it('scales the padding with the size in both padding families', async () => {
    const flatSm = await setup({ tabsStyle: 'underline', size: 'sm' });
    expect(flatSm.c.tabPadClass()).toBe('px-2.5 py-1.5');
    const flatLg = await setup({ tabsStyle: 'underline', size: 'lg' });
    expect(flatLg.c.tabPadClass()).toBe('px-5 py-3');
    const boxySm = await setup({ tabsStyle: 'boxed', size: 'sm' });
    expect(boxySm.c.tabPadClass()).toBe('px-3 py-1.5');
  });

  it('pads the panel only in the border-card style, where it sits inside the card', async () => {
    const card = await setup({ tabsStyle: 'border-card' });
    expect(card.el.querySelector('[role="tabpanel"]')!.parentElement!.className).toContain('p-4');
    const plain = await setup();
    expect(plain.el.querySelector('[role="tabpanel"]')!.parentElement!.className).not.toContain('p-4');
  });
});

describe('SvTabsComponent — badge, dot and close affordances', () => {
  const RICH: TabItem[] = [
    { id: 'a', label: 'Inbox', badge: '12', dot: true, closable: true },
    { id: 'b', label: 'Sent' },
  ];

  it('renders a badge, an announced unread dot and a close glyph only where asked', async () => {
    const { el } = await setup({ tabs: RICH, activeId: 'a' });
    const first = el.querySelectorAll<HTMLElement>('[role="tablist"] > span')[0];
    const second = el.querySelectorAll<HTMLElement>('[role="tablist"] > span')[1];

    expect(first.textContent).toContain('12');
    // The dot is decorative; the meaning is carried in text for a screen reader.
    expect(first.querySelector('.sr-only')!.textContent).toBe('(unread)');
    expect(first.querySelector('[data-close-tab]')).toBeTruthy();

    expect(second.textContent?.trim()).toBe('Sent');
    expect(second.querySelector('.sr-only')).toBeNull();
    expect(second.querySelector('[data-close-tab]')).toBeNull();
  });

  it('inverts the badge on an active pill, where a grey badge would disappear', async () => {
    // The unread dot is `rounded-full` too, so the badge is found by its text.
    const badge = (el: HTMLElement) =>
      [...el.querySelectorAll<HTMLElement>('[role="tab"] span.rounded-full')]
        .find((s) => s.textContent?.trim() === '12')!;

    const active = await setup({ tabs: RICH, activeId: 'a', tabsStyle: 'pills' });
    expect(badge(active.el).className).toContain('bg-white');
    expect(badge(active.el).className).toContain('text-primary-600');

    // Same badge on an inactive pill, and on an ACTIVE tab of another style,
    // keeps the default grey — both halves of the `&&` matter.
    const inactive = await setup({ tabs: RICH, activeId: 'b', tabsStyle: 'pills' });
    expect(badge(inactive.el).className).not.toContain('bg-white');
    const underline = await setup({ tabs: RICH, activeId: 'a', tabsStyle: 'underline' });
    expect(badge(underline.el).className).not.toContain('bg-white');
  });

  it('renders an icon only for a tab that declares a path', async () => {
    const tabs: TabItem[] = [{ id: 'a', label: 'A', icon: 'star' }, { id: 'b', label: 'B' }];
    const { el } = await setup({ tabs, activeId: 'a' });
    const buttons = [...el.querySelectorAll('[role="tab"]')];
    expect(buttons[0].querySelectorAll('svg')).toHaveLength(1);
    expect(buttons[1].querySelectorAll('svg')).toHaveLength(0);
  });
});

describe('SvTabsComponent — degenerate inputs', () => {
  it('renders an empty strip for no tabs at all, without throwing', async () => {
    const { el, c } = await setup({ tabs: [], activeId: '' });
    expect(el.querySelector('[role="tablist"]')).toBeTruthy();
    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(c.resolvedActiveId()).toBe('');
    expect(c.navigableTabs()).toEqual([]);
  });

  it('resolves to nothing when every tab is disabled', async () => {
    // `find` returns undefined and the `?? ''` is what stops `resolvedActiveId`
    // from being undefined in an `aria-controls`.
    const tabs: TabItem[] = [{ id: 'a', label: 'A', disabled: true }];
    const { c, el } = await setup({ tabs, activeId: '' });
    expect(c.resolvedActiveId()).toBe('');
    expect(el.querySelector('[role="tab"]')!.getAttribute('aria-selected')).toBe('false');
  });

  it('does nothing on an arrow key when every tab is disabled', async () => {
    const tabs: TabItem[] = [{ id: 'a', label: 'A', disabled: true }];
    const { c } = await setup({ tabs, activeId: '' });
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    c.onTabKeydown(e, tabs[0]);
    expect(e.defaultPrevented).toBe(false);
    expect(c.activeId()).toBe('');
  });

  it('honours an explicitly bound activeId even when it names a disabled tab', async () => {
    // The host owns `activeId`; the fallback only applies when it is empty.
    const { c } = await setup({ activeId: 'c' });
    expect(c.resolvedActiveId()).toBe('c');
    expect(c.isPanelVisible(DISABLED)).toBe(true);
  });

  it('shows no panel at all for an activeId that names no tab', async () => {
    const { c } = await setup({ activeId: 'ghost' });
    expect(TABS.every((t) => !c.isPanelVisible(t))).toBe(true);
  });

  it('has no template for a tab with no projected panel', async () => {
    const { c } = await setup();
    expect(c.panelFor('a')).toBeNull();
  });

  it('leaves a single-tab strip alone when arrowed, rather than wrapping onto itself', async () => {
    const tabs: TabItem[] = [{ id: 'only', label: 'Only' }];
    const { c } = await setup({ tabs, activeId: 'only' });
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    c.onTabKeydown(e, tabs[0]);
    // `step(1)` wraps to the same tab, and `selectTab` refuses the current one.
    expect(c.activeId()).toBe('only');
  });
});
