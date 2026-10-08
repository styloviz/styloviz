import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvAccordionComponent,
  type AccordionBadgeColor,
  type AccordionItem,
} from './accordion.component';

/**
 * How the FREE accordion looks. Adapted from
 * `projects/accordion/src/lib/accordion.presentation.spec.ts`; the divergences
 * from the Pro twin were read out of both files rather than assumed, and each
 * has its own test marked ▲:
 *
 *   ▲ free has three variants, not four — there is no `separated`, so
 *     `itemWrapperClass` is always empty and the root never gets `space-y-2`.
 *   ▲ free renders `<sv-icon>`, Pro renders `<sv-icon-pro>`.
 *
 * (Free's header used to carry a redundant `role="button"` on a real
 * `<button>`; it no longer does, and the twins agree — asserted below.)
 *
 * Everything else — sizes, badge palette, chevron positions, custom icon
 * swap/rotate, the open/closed colouring — is identical, and is asserted
 * identically so the twins cannot drift apart quietly.
 */

const ITEMS: AccordionItem[] = [
  { id: 'a', title: 'First', content: 'One', subtitle: 'sub one' },
  { id: 'b', title: 'Second', content: 'Two' },
];

async function setup(inputs: Partial<ComponentInput<SvAccordionComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAccordionComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvAccordionComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const root = (f: { nativeElement: unknown }) => el(f).querySelector('[role="list"], div')!;
const headers = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLButtonElement>('button[aria-expanded]')];
const wrappers = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="listitem"]')];
const panels = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('[role="region"]')];

describe('SvAccordionComponent — variants', () => {
  it('wraps the whole set in one bordered box for default and filled', async () => {
    for (const variant of ['default', 'filled'] as const) {
      const f = await setup({ variant });
      expect(root(f).className).toContain('border');
      expect(root(f).className).toContain('divide-y');
    }
  });

  it('keeps the dividers but drops the outer border for flush', async () => {
    const f = await setup({ variant: 'flush' });
    expect(root(f).className).toContain('divide-y');
    expect(root(f).className).not.toContain('rounded-xl');
  });

  it('▲ never stacks the items as separate cards — that variant is Pro-only', async () => {
    for (const variant of ['default', 'flush', 'filled'] as const) {
      const f = await setup({ variant });
      expect(root(f).className).not.toContain('space-y-2');
      expect(wrappers(f)[0].className).toBe('');
    }
  });

  it('▲ degrades to an unadorned list if handed the Pro-only "separated" name', async () => {
    // `AccordionVariant` here has three members, so this cannot be reached from
    // TypeScript — but a plain-JS host, or one downgrading from Pro, can bind
    // the string. It must render a plain list rather than an untouched
    // `default` box that silently contradicts what was asked for.
    const f = await setup({ variant: 'separated' as unknown as 'default' });
    expect(root(f).className).not.toContain('border');
    expect(root(f).className).not.toContain('divide-y');
    expect(root(f).className).not.toContain('space-y-2');
    expect(headers(f).length).toBe(2);
  });

  it('tints only the open header in the filled variant', async () => {
    const f = await setup({ variant: 'filled' });
    expect(headers(f)[0].className).toContain('bg-gray-50');

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(headers(f)[0].className).toContain('bg-primary-50');
    expect(headers(f)[1].className).toContain('bg-gray-50');
  });

  it('appends the host\'s own classes to the root', async () => {
    const f = await setup({ customClass: 'my-shadow' });
    expect(root(f).className).toContain('my-shadow');
  });
});

describe('SvAccordionComponent — sizes', () => {
  it.each([
    ['sm', 'px-4 py-2.5', 'text-sm', 'text-[11px]', 'px-4 pt-2 pb-4'],
    ['md', 'px-5 py-4', 'text-sm', 'text-xs', 'px-5 pt-3 pb-6'],
    ['lg', 'px-6 py-5', 'text-base', 'text-xs', 'px-6 pt-4 pb-7'],
  ])('scales header, title, subtitle and body together at %s', async (size, pad, title, sub, body) => {
    const f = await setup({ size: size as 'sm' | 'md' | 'lg' });
    expect(headers(f)[0].className).toContain(pad);
    expect(el(f).querySelector('.truncate')!.className).toContain(title);
    expect(el(f).querySelector('.leading-none')!.className).toContain(sub);
    expect(panels(f)[0].querySelector('.leading-relaxed')!.className).toContain(body);
  });

  it('renders no subtitle line for an item that has none', async () => {
    const f = await setup();
    expect(el(f).querySelectorAll('.leading-none').length).toBe(1);
  });
});

describe('SvAccordionComponent — header semantics', () => {
  /** A native `<button>` already IS a button; restating the role is noise. */
  it('renders native button headers with no redundant role attribute', async () => {
    const f = await setup();
    for (const header of headers(f)) {
      expect(header.tagName).toBe('BUTTON');
      expect(header.hasAttribute('role')).toBe(false);
    }
  });
});

describe('SvAccordionComponent — open and closed styling', () => {
  it('recolours the title and rotates the chevron on open', async () => {
    const f = await setup();
    const title = () => el(f).querySelector('.truncate')!.className;
    // ▲ `<sv-icon>`, not `<sv-icon-pro>`; the classes land on its own <svg>.
    const chevron = () => el(f).querySelector('sv-icon svg')!.getAttribute('class') ?? '';

    expect(title()).toContain('text-gray-900');
    expect(chevron()).toContain('rotate-0');

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(title()).toContain('text-primary-600');
    expect(chevron()).toContain('rotate-180');
    expect(chevron()).toContain('text-primary-500');
  });

  it('recolours a leading icon with the panel it belongs to', async () => {
    // `AccordionItem.icon` was `iconPath`, a raw `<path d="…">`, so this used
    // to identify the icon by its own path data. It is now a library glyph,
    // and the chevron in the same header is another one — so the leading icon
    // is taken as the FIRST sv-icon in the header, which is where the
    // template puts it (the chevron is last unless iconPosition is 'left').
    const f = await setup({ items: [{ ...ITEMS[0], icon: 'settings' }, ITEMS[1]] });
    // `cssClass` lands on the icon's own <svg>, not on the host element.
    const icon = () =>
      headers(f)[0].querySelector('sv-icon svg')!.getAttribute('class') ?? '';
    expect(icon()).toContain('text-gray-500');
    // ...and it really is the LEADING icon, not the chevron: the chevron is the
    // only glyph in this header that carries a rotation. Both are grey when
    // closed and primary when open, so colour alone cannot tell them apart.
    expect(icon()).not.toContain('rotate-');
    expect(headers(f)[0].querySelectorAll('sv-icon').length).toBe(2);

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(icon()).toContain('text-primary-500');
  });

  it('renders no leading icon for an item with no icon name', async () => {
    const f = await setup();
    // Exactly one glyph per header — the chevron. A leading icon would be a
    // second one in the same header.
    for (const h of headers(f)) {
      expect(h.querySelectorAll('sv-icon').length).toBe(1);
    }
  });

  it('dims a disabled header without hiding it', async () => {
    const f = await setup({ items: [{ ...ITEMS[0], disabled: true }, ITEMS[1]] });
    expect(headers(f)[0].className).toContain('cursor-not-allowed');
    expect(headers(f)[0].className).toContain('opacity-50');
    expect(headers(f)[0].className).not.toContain('hover:bg-gray-50');
    expect(headers(f)[1].className).toContain('cursor-pointer');
  });
});

describe('SvAccordionComponent — badges', () => {
  const badge = (f: { nativeElement: unknown }) =>
    el(f).querySelector('.rounded-full')!.className;

  it('renders no badge for an item that has none', async () => {
    const f = await setup();
    expect(el(f).querySelector('.rounded-full')).toBeNull();
  });

  it('gives each colour its own palette', async () => {
    const colours: AccordionBadgeColor[] = [
      'primary',
      'success',
      'warning',
      'danger',
      'info',
      'neutral',
    ];
    const seen = new Set<string>();
    for (const badgeColor of colours) {
      const f = await setup({ items: [{ ...ITEMS[0], badge: '3', badgeColor }] });
      seen.add(badge(f));
    }
    expect(seen.size).toBe(colours.length);
  });

  it('falls back to neutral for a badge with no colour set', async () => {
    const withColour = await setup({ items: [{ ...ITEMS[0], badge: '3', badgeColor: 'neutral' }] });
    const without = await setup({ items: [{ ...ITEMS[0], badge: '3' }] });
    expect(badge(without)).toBe(badge(withColour));
  });

  it('defaults the colour argument for a host calling badgeClass directly', async () => {
    const f = await setup();
    expect(f.componentInstance.badgeClass()).toBe(f.componentInstance.badgeClass('neutral'));
  });
});

describe('SvAccordionComponent — the chevron', () => {
  /**
   * A rendered glyph's shape, as a signature over every primitive it draws.
   *
   * `[name]` is NOT reflected to the DOM (no `ng-reflect-name`), so a test
   * cannot read back which icon was asked for — it has to compare what was
   * actually drawn. Two different library names give two different signatures;
   * the same name twice gives the same one.
   *
   * ★ This walks DESCENDANTS, not direct children. The renderer wraps every
   * primitive in a `<g [transform]>` (for `rotate`/`flip`), so `svg.children`
   * is the single `<g>` and the signature was the constant `"g:"` for every
   * icon in the library — this block's discriminating assertions were comparing
   * `"g:"` to `"g:"`, and `not.toBe('')` passed on a glyph that drew nothing.
   * Caught when the same helper was copied into empty-state's spec and all
   * twelve presets collapsed to one signature.
   *
   * A glyph with no primitives signs as `''`, so `not.toBe('')` still means
   * "something was actually drawn".
   */
  const glyphSig = (f: { nativeElement: unknown }) => {
    const svg = el(f).querySelector('sv-icon svg');
    if (!svg) return '';
    return [...svg.querySelectorAll('path, circle, line, polyline, polygon, rect')]
      .map((n) =>
        [
          n.tagName,
          n.getAttribute('d') ?? '',
          n.getAttribute('points') ?? '',
          n.getAttribute('cx') ?? '',
          n.getAttribute('x1') ?? '',
          n.getAttribute('x') ?? '',
        ].join(','),
      )
      .join('|');
  };

  it('sits after the title by default and before it on request', async () => {
    const right = await setup();
    const rightKids = [...headers(right)[0].children];
    expect(rightKids[rightKids.length - 1].className).toContain('ml-auto');

    const left = await setup({ iconPosition: 'left' });
    expect([...headers(left)[0].children][0].className).not.toContain('ml-auto');
    expect(left.nativeElement.querySelector('sv-icon')).not.toBeNull();
  });

  it('replaces the built-in chevron with a custom named glyph', async () => {
    const custom = await setup({ customIcon: 'plus' });
    const builtin = await setup({});
    expect(glyphSig(custom)).not.toBe('');
    // Same claim as before the sweep — the default chevron is gone — but the
    // discriminator is the drawn shape rather than "is there an icon at all",
    // because BOTH the default and the override now come from the library.
    expect(glyphSig(custom)).not.toBe(glyphSig(builtin));
  });

  it('rotates a single custom glyph on open, since there is nothing to swap to', async () => {
    const f = await setup({ customIcon: 'plus' });
    expect(el(f).querySelector('svg')!.getAttribute('class')).not.toContain('rotate-180');

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(el(f).querySelector('svg')!.getAttribute('class')).toContain('rotate-180');
  });

  it('swaps glyphs instead of rotating when an open glyph is supplied', async () => {
    const f = await setup({ customIcon: 'plus', customIconOpen: 'minus' });
    const closed = glyphSig(f);
    expect(closed).not.toBe('');

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(glyphSig(f)).not.toBe(closed);
    expect(el(f).querySelector('svg')!.getAttribute('class')).not.toContain('rotate-180');
  });

  it('applies the same rules to a left-positioned custom icon', async () => {
    const f = await setup({
      iconPosition: 'left',
      customIcon: 'plus',
      customIconOpen: 'minus',
    });
    const shut = glyphSig(f);
    expect(shut).not.toBe('');
    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(glyphSig(f)).not.toBe(shut);
    expect(el(f).querySelector('svg')!.getAttribute('class')).not.toContain('rotate-90');
  });
});

describe('SvAccordionComponent — the collapsed panel', () => {
  /*
   * ⚠️ `inert` is only HALF the contract now, and which half applies is the
   * browser's call (`NV-01-I8`). Where `hidden="until-found"` is supported the
   * component drops `inert` deliberately, because an inert subtree is skipped
   * by find-in-page — `content-visibility: hidden` keeps the panel out of the
   * accessibility tree and the tab order without keeping it out of `Ctrl+F`.
   *
   * ★ So this block has to say which browser it is. **jsdom 26 defines
   *   `onbeforematch` on `HTMLElement.prototype`** and implements none of the
   *   behaviour, which makes the environment a false positive for the only
   *   honest probe — the supported path is what runs here unless it is removed.
   *   `accordion.findable.spec.ts` owns the other world.
   */
  let restore: () => void;
  beforeEach(() => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const original = Object.getOwnPropertyDescriptor(proto, 'onbeforematch');
    delete proto['onbeforematch'];
    restore = () => {
      if (original) Object.defineProperty(proto, 'onbeforematch', original);
    };
  });
  afterEach(() => restore());

  it('takes a collapsed panel out of the accessibility tree', async () => {
    // ★ DEFECT — the free accordion left every collapsed panel fully present in
    // the accessibility tree. The panel is hidden only by a `0fr` grid row and
    // `overflow: hidden`, which clips it VISUALLY and does nothing else: a
    // screen-reader user browsing an all-collapsed FAQ heard the body of every
    // answer, so the accordion read as permanently expanded and the headers'
    // `aria-expanded="false"` contradicted what was being announced. Anything
    // focusable a host projects in there stayed in the tab order too.
    //
    // The Pro twin has carried `inert` since it was written, with a comment
    // explaining exactly this — which is what makes it a free-only regression
    // rather than a missing premium feature.
    //
    // jsdom does not implement inert's SEMANTICS, so the attribute's presence
    // is what is asserted; the behaviour it triggers is the browser's.
    const f = await setup();
    const inert = () =>
      panels(f).map((p) => p.querySelector('.overflow-hidden')!.hasAttribute('inert'));

    expect(inert()).toEqual([true, true]);

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(inert()).toEqual([false, true]);
  });

  it('shuts an already-open panel in multi mode, leaving its neighbour open', async () => {
    // Single mode closes by clearing the whole set; multi mode has to remove
    // one id and keep the others, which is a different line.
    const f = await setup({ expandMode: 'multi' });
    const expanded = () => headers(f).map((h) => h.getAttribute('aria-expanded'));
    const seen: { id: string; open: boolean }[] = [];
    f.componentInstance.itemToggled.subscribe((e) => seen.push(e));

    await userEvent.click(headers(f)[0]);
    await userEvent.click(headers(f)[1]);
    f.detectChanges();
    expect(expanded()).toEqual(['true', 'true']);

    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(expanded()).toEqual(['false', 'true']);
    expect(seen).toEqual([
      { id: 'a', open: true, source: 'user' },
      { id: 'b', open: true, source: 'user' },
      { id: 'a', open: false, source: 'user' },
    ]);
  });

  it('collapses the grid row of every shut panel', async () => {
    const f = await setup();
    const rows = () => panels(f).map((p) => p.style.gridTemplateRows);
    expect(rows()).toEqual(['0fr', '0fr']);

    await userEvent.click(headers(f)[1]);
    f.detectChanges();
    expect(rows()).toEqual(['0fr', '1fr']);
  });
});

describe('SvAccordionComponent — degenerate item sets', () => {
  it('renders nothing but survives an empty item list', async () => {
    const f = await setup({ items: [] });
    expect(headers(f)).toEqual([]);
  });

  it('ignores the keyboard when every item is disabled', async () => {
    const f = await setup({ items: ITEMS.map((i) => ({ ...i, disabled: true })) });
    headers(f)[0].focus();
    await userEvent.keyboard('{ArrowDown}');
    f.detectChanges();
    expect(document.activeElement).toBe(headers(f)[0]);
    expect(headers(f).map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false']);
  });
});

describe('SvAccordionComponent — items that go away', () => {
  @Component({
    standalone: true,
    imports: [SvAccordionComponent],
    template: `<sv-accordion [items]="items()" expandMode="multi" />`,
  })
  class Host {
    readonly items = signal<AccordionItem[]>([
      { id: 'a', title: 'A', content: 'a' },
      { id: 'b', title: 'B', content: 'b' },
    ]);
  }

  it('forgets an open section that is no longer in the list, and keeps the rest', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    await userEvent.click(headers(fixture)[0]);
    await userEvent.click(headers(fixture)[1]);
    fixture.detectChanges();
    expect(headers(fixture).map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'true']);

    fixture.componentInstance.items.set([{ id: 'a', title: 'A', content: 'a' }]);
    fixture.detectChanges();
    expect(headers(fixture).map((h) => h.getAttribute('aria-expanded'))).toEqual(['true']);

    fixture.componentInstance.items.set([
      { id: 'a', title: 'A', content: 'a' },
      { id: 'b', title: 'B', content: 'b' },
    ]);
    fixture.detectChanges();
    expect(headers(fixture).map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
  });
});

// ─── Icons come from the library ──────────────────────────────────────────────

/**
 * The LEADING item icon was an inline `<svg>` bound to `AccordionItem.iconPath`
 * (a raw `<path d="…">`).
 *
 * ★ `check:ui` could not see it: its only size lived in
 * `[ngClass]="leadingIconClasses(item)"`, and both halves of the rule's
 * "is it sized like an icon" test read literal classes off the open tag. It had
 * therefore never appeared in the ledger — so "the ledger is empty" read as
 * "the sweep is finished" when eight glyphs kit-wide were still hand-drawn.
 *
 * One render only guards one branch, so this sweeps every branch that draws:
 * both chevron positions, the custom-glyph override, the two-glyph swap, and
 * the open state — the chevron's classes differ per state, and a revert would
 * only show up in the branch that was actually rendered.
 */
describe('SvAccordionComponent — icons come from the library', () => {
  const byHand = (f: { nativeElement: unknown }) =>
    [...el(f).querySelectorAll('svg')].filter((n) => !n.closest('sv-icon'));

  it.each([
    ['default chevron, closed', {}],
    ['default chevron, left', { iconPosition: 'left' as const }],
    ['a leading item icon', { items: [{ ...ITEMS[0], icon: 'settings' }, ITEMS[1]] }],
    ['a custom chevron', { customIcon: 'plus' }],
    ['a custom chevron pair', { customIcon: 'plus', customIconOpen: 'minus' }],
  ])('draws no glyph by hand — %s', async (_label, inputs) => {
    const f = await setup(inputs);
    // Assert something WAS drawn: "no hand-drawn glyphs" is satisfied by a
    // branch that renders nothing at all.
    expect(el(f).querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(byHand(f)).toEqual([]);

    // ...and again with the first panel open, which repaints every glyph.
    await userEvent.click(headers(f)[0]);
    f.detectChanges();
    expect(el(f).querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(byHand(f)).toEqual([]);
  });
});
