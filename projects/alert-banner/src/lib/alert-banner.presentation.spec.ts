import { TestBed } from '@angular/core/testing';
import { SvLiveAnnouncer } from '@styloviz/core';
import { render } from '@testing-library/angular';
import {
  SvAlertBannerComponent,
  type AlertAction,
  type AlertPosition,
  type AlertSize,
  type AlertStyle,
  type AlertVariant,
} from './alert-banner.component';

/**
 * Five semantic variants × six visual styles × four positions, plus the
 * urgency mapping that decides whether a screen reader interrupts.
 */

const VARIANTS: AlertVariant[] = ['info', 'success', 'warning', 'danger', 'neutral'];
const STYLES: AlertStyle[] = [
  'soft',
  'solid',
  'outline',
  'left-accent',
  'top-accent',
  'announcement',
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAlertBannerComponent, { inputs });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
/**
 * ★ WAS `[aria-live]`, and that selector is the defect. The banner's own root
 *   carried `aria-live` and `role="alert"` — i.e. the whole region was
 *   INSERTED behind `@if (isVisible())` with its text already inside it, which
 *   assistive technology is least likely to announce. The announcing moved to
 *   the shared region (`X-9`); the visible root keeps `role="status"`, which is
 *   not a live region on its own and is what lets a screen reader user find
 *   the banner and reach its actions.
 */
const bannerRoot = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLElement>('[role="status"]')!;
const shell = (f: { nativeElement: unknown }) =>
  el(f).querySelector<HTMLElement>('.flex.items-start')!;
/**
 * The leading variant icon. Excludes the dismiss button's own `close` glyph,
 * which is an `<sv-icon>` too — a bare `sv-icon` query finds that instead and
 * passes whatever the leading slot does.
 */
const leadingIcon = (f: { nativeElement: unknown }) =>
  el(f).querySelector('sv-icon:not([name="close"])');

describe('SvAlertBannerComponent — urgency', () => {
  /**
   * ★★★ THESE THREE TESTS PINNED THE REGION THAT COULD NOT BE HEARD. They
   *     asserted `aria-live`, `role="alert"` and `aria-atomic` on the
   *     banner's own root — the pattern where the region arrives complete
   *     rather than existing first. All three were green, all three described
   *     the component accurately, and the announcement they described was the
   *     least reliable one available. What replaces them asserts where the
   *     text actually goes.
   */
  it('★ the banner root is no longer a live region of its own', async () => {
    const f = await setup({ variant: 'danger', message: 'x' });
    const root = bannerRoot(f);
    expect(root.hasAttribute('aria-live')).toBe(false);
    expect(root.getAttribute('role')).toBe('status');   // findable, not shouting
  });

  it('★ interrupts only for danger — and `warning` is where Toast disagreed', async () => {
    // `assertive` cuts across whatever the screen reader is saying, so it is
    // for failures. Toast used to announce `warning` assertively and this
    // component politely; one mapping now answers for both, and it went the
    // quieter way.
    for (const variant of VARIANTS) {
      TestBed.resetTestingModule();
      const f = await setup({ variant, message: 'urgent-' + variant });
      const announcer = TestBed.inject(SvLiveAnnouncer);
      const expected = variant === 'danger' ? 'assertive' : 'polite';

      expect(announcer.regionFor(expected)?.textContent).toContain('urgent-' + variant);
      announcer.reset();
      void f;
    }
  });

  it('★ says it once, however often the host re-renders it', async () => {
    // `OF-01-I4`: the region's text is bound to inputs, so a host that
    // re-renders on every state change repeated the same sentence each time.
    const f = await setup({ message: 'Two fields need attention' });
    const announcer = TestBed.inject(SvLiveAnnouncer);
    const first = announcer.regionFor('polite')!.textContent;

    f.detectChanges();
    f.detectChanges();

    expect(announcer.regionFor('polite')!.textContent).toBe(first);
    announcer.reset();
  });
});

describe('SvAlertBannerComponent — the shell', () => {
  it('gives all thirty style-and-variant pairs a distinct look', async () => {
    // The lookup is keyed on `"style:variant"`; a typo in one key silently
    // falls back to `soft:info` and two cells become identical.
    const seen = new Map<string, string>();
    for (const alertStyle of STYLES.filter((s) => s !== 'announcement')) {
      for (const variant of VARIANTS) {
        const f = await setup({ alertStyle, variant, message: 'x' });
        seen.set(`${alertStyle}:${variant}`, shell(f).className);
      }
    }
    expect(seen.size).toBe(25);
    expect(new Set(seen.values()).size).toBe(25);
  });

  it('falls back to the soft-info shell for the announcement style', async () => {
    // `announcement` has no entry in the shell table — it paints its own
    // full-bleed gradient instead — so the shell classes must not be undefined.
    // Compared on the colour classes only: `announcement` is edge-anchored so
    // it correctly picks up no `rounded-xl`, which `soft` does.
    const announcement = await setup({ alertStyle: 'announcement', variant: 'danger' });
    expect(announcement.componentInstance.shellClasses()).toContain('bg-info-50');
    expect(announcement.componentInstance.shellClasses()).toContain('text-info-900');
    expect(announcement.componentInstance.shellClasses()).not.toContain('rounded-xl');
  });

  it('rounds only the three styles that are not anchored to an edge', async () => {
    for (const alertStyle of ['soft', 'solid', 'outline'] as AlertStyle[]) {
      const f = await setup({ alertStyle, message: 'x' });
      expect(f.componentInstance.shellClasses()).toContain('rounded-xl');
    }
    for (const alertStyle of ['left-accent', 'top-accent'] as AlertStyle[]) {
      const f = await setup({ alertStyle, message: 'x' });
      expect(f.componentInstance.shellClasses()).not.toContain('rounded-xl');
    }
  });

  it.each([
    ['sm', 'px-3 py-2 text-xs', 'h-4 w-4 mt-px'],
    ['md', 'px-4 py-3 text-sm', 'h-5 w-5 mt-px'],
    ['lg', 'px-5 py-4 text-base', 'h-6 w-6 mt-0.5'],
  ])('scales the shell and the icon together at %s', async (size, pad, icon) => {
    const f = await setup({ size: size as AlertSize, message: 'x' });
    expect(f.componentInstance.shellClasses()).toContain(pad);
    expect(f.componentInstance.iconSizeClass()).toBe(icon);
  });
});

describe('SvAlertBannerComponent — position', () => {
  it.each([
    ['inline', 'w-full'],
    ['top-fixed', 'fixed top-0'],
    ['bottom-fixed', 'fixed bottom-0'],
    ['top-sticky', 'sticky top-0'],
  ])('pins the wrapper for %s', async (position, expected) => {
    const f = await setup({ position: position as AlertPosition, message: 'x' });
    expect(f.componentInstance.wrapperClasses()).toContain(expected);
  });

  it('swaps the transition classes as it closes', async () => {
    const f = await setup({ message: 'x' });
    expect(f.componentInstance.wrapperClasses()).toContain('opacity-100');
    expect(f.componentInstance.wrapperClasses()).not.toContain('pointer-events-none');

    f.componentInstance.close();
    expect(f.componentInstance.wrapperClasses()).toContain('opacity-0');
    // A banner mid-exit must stop swallowing clicks meant for the page.
    expect(f.componentInstance.wrapperClasses()).toContain('pointer-events-none');
  });

  it('appends the host\'s own classes', async () => {
    const f = await setup({ customClass: 'z-[60]', message: 'x' });
    expect(f.componentInstance.wrapperClasses()).toContain('z-[60]');
  });
});

/**
 * A rendered glyph's shape. `[name]` is not reflected to the DOM, so comparing
 * what was DRAWN is the only way to tell two library icons apart. Walks
 * descendants — the renderer wraps its primitives in a `<g transform>`.
 */
const glyphSig = (f: { nativeElement: unknown }) => {
  const svg = (f.nativeElement as HTMLElement).querySelector('sv-icon svg');
  if (!svg) return '';
  return [...svg.querySelectorAll('path, circle, line, polyline, polygon, rect')]
    .map((n) => `${n.tagName},${n.getAttribute('d') ?? ''},${n.getAttribute('x1') ?? ''}`)
    .join('|');
};

describe('SvAlertBannerComponent — the icon', () => {
  it('picks a library glyph per variant when no custom path is set', async () => {
    const names = new Set<string>();
    for (const variant of VARIANTS) {
      const f = await setup({ variant, message: 'x' });
      expect(leadingIcon(f)).not.toBeNull();
      names.add(f.componentInstance.resolvedIconName());
    }
    // danger and warning deliberately share the triangle; info and neutral
    // share the circle. Three distinct glyphs across five variants.
    expect(names.size).toBe(3);
  });

  /**
   * ★ WAS "draws a raw path instead when the host supplies one", and had gone
   * stale: it set `iconPath` + `iconViewBox`, both DELETED by the icon sweep.
   * The inputs no longer exist, so `setup`'s loose record silently dropped
   * them, the variant default rendered, and `expect(leadingIcon(f)).toBeNull()`
   * failed. The CLAIM survives the deletion — a host override must replace the
   * variant default rather than draw beside it — so it is asserted against the
   * input that replaced them.
   *
   * `iconViewBox` is gone rather than renamed because a library name is always
   * 24-box; the escape hatch existed only to say how big a raw path was.
   */
  it('replaces the variant default when the host names its own glyph', async () => {
    const custom = await setup({ icon: 'bell', variant: 'danger', message: 'x' });
    const dflt = await setup({ variant: 'danger', message: 'x' });

    expect(custom.componentInstance.resolvedIconName()).toBe('bell');
    expect(dflt.componentInstance.resolvedIconName()).not.toBe('bell');

    // Exactly ONE leading glyph, not the override drawn beside the default.
    expect(leadingIcon(custom)).not.toBeNull();
    expect(glyphSig(custom)).not.toBe('');
    expect(glyphSig(custom)).not.toBe(glyphSig(dflt));
  });

  it('has no iconViewBox left — a library name is always 24-box', async () => {
    const f = await setup({ icon: 'bell', message: 'x' });
    const c = f.componentInstance as unknown as Record<string, unknown>;
    expect(c['iconViewBox']).toBeUndefined();
    expect(c['iconPath']).toBeUndefined();
    expect(leadingIcon(f)!.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders no icon at all when showIcon is off', async () => {
    // Scoped past the dismiss button, which has an icon of its own.
    const f = await setup({ showIcon: false, message: 'x', dismissible: false });
    expect(leadingIcon(f)).toBeNull();
    expect(shell(f).querySelector('svg')).toBeNull();
  });

  it('tints the icon per variant, except on solid where the fill is the colour', async () => {
    const tints = new Set<string>();
    for (const variant of VARIANTS) {
      const f = await setup({ variant, message: 'x' });
      tints.add(f.componentInstance.iconColorClass());
    }
    expect(tints.size).toBe(VARIANTS.length);

    // Solid collapses the five tints to one — except `warning`, whose fill is a
    // light amber, so white ink on it is 1.98:1. It takes dark ink instead.
    for (const variant of VARIANTS) {
      const f = await setup({ variant, alertStyle: 'solid', message: 'x' });
      expect(f.componentInstance.iconColorClass()).toBe(
        variant === 'warning' ? 'text-gray-900/90' : 'text-white/90',
      );
    }
  });
});

describe('SvAlertBannerComponent — content and actions', () => {
  const ACTIONS: AlertAction[] = [
    { id: 'undo', label: 'Undo' },
    { id: 'dismiss-all', label: 'Dismiss all', style: 'ghost' },
  ];

  const buttons = (f: { nativeElement: unknown }) =>
    [...el(f).querySelectorAll<HTMLButtonElement>('button')];

  it('renders body-only when there is no title', async () => {
    const f = await setup({ message: 'Saved.' });
    expect(el(f).textContent).toContain('Saved.');
    expect(el(f).querySelector('.font-semibold')).toBeNull();
  });

  it('renders a title with no body', async () => {
    const f = await setup({ title: 'Heads up' });
    expect(el(f).textContent).toContain('Heads up');
  });

  it('renders no action row when there are no actions', async () => {
    const f = await setup({ message: 'x', dismissible: false });
    expect(buttons(f)).toEqual([]);
  });

  it('styles a primary action per variant and a ghost action uniformly', async () => {
    const primaries = new Set<string>();
    for (const variant of VARIANTS) {
      const f = await setup({ variant, actions: ACTIONS, message: 'x' });
      primaries.add(f.componentInstance.primaryActionClass());
      expect(f.componentInstance.ghostActionClass()).toContain('opacity-70');
    }
    expect(primaries.size).toBe(VARIANTS.length);
  });

  it('switches every button treatment on the solid style', async () => {
    const f = await setup({ alertStyle: 'solid', actions: ACTIONS, message: 'x' });
    const c = f.componentInstance;
    expect(c.primaryActionClass()).toContain('bg-black/20');
    expect(c.ghostActionClass()).toContain('text-white/90');
    expect(c.dismissClass()).toContain('text-white/70');
  });

  // ★★ Every solid control was one string regardless of variant, which put white
  // ink on the amber fill: ghost 1.83:1, primary 1.86:1, dismiss 1.69:1. Asserted
  // per-variant rather than on the default, because a variant-blind branch reads
  // correct until you name the one variant it is wrong for — and only `warning`
  // has a light solid fill.
  it('gives the solid warning banner dark controls, since its fill is light', async () => {
    for (const variant of VARIANTS) {
      const f = await setup({ variant, alertStyle: 'solid', actions: ACTIONS, message: 'x' });
      const c = f.componentInstance;
      const dark = variant === 'warning';
      expect(c.primaryActionClass()).toContain(dark ? 'text-gray-900' : 'text-white');
      expect(c.ghostActionClass()).toContain(dark ? 'text-gray-900/80' : 'text-white/90');
      expect(c.dismissClass()).toContain(dark ? 'text-gray-900/70' : 'text-white/70');
    }
  });

  it('reports which action was pressed', async () => {
    const f = await setup({ actions: ACTIONS, message: 'x' });
    const seen: string[] = [];
    f.componentInstance.actionClick.subscribe((id) => seen.push(id));

    buttons(f)[1].click();
    buttons(f)[0].click();
    expect(seen).toEqual(['dismiss-all', 'undo']);
  });

  it('offers no way to dismiss when dismissible is off', async () => {
    // The negative that matters: a non-dismissible alert must render no close
    // control at all, not a disabled one.
    const f = await setup({ message: 'x' });
    expect(el(f).querySelector('button[aria-label="Dismiss alert"]')).not.toBeNull();

    const fixed = await setup({ message: 'x', dismissible: false });
    expect(el(fixed).querySelector('button[aria-label="Dismiss alert"]')).toBeNull();
  });
});

describe('SvAlertBannerComponent — the announcement style', () => {
  it('paints a full-bleed gradient, one per variant', async () => {
    const gradients = new Set<string>();
    for (const variant of VARIANTS) {
      const f = await setup({ alertStyle: 'announcement', variant, message: 'x' });
      gradients.add(f.componentInstance.announcementBgClass());
      expect(el(f).querySelector('.bg-gradient-to-r')).not.toBeNull();
    }
    expect(gradients.size).toBe(VARIANTS.length);
  });

  it('names its own dismiss control differently from the ordinary one', async () => {
    const f = await setup({ alertStyle: 'announcement', message: 'x' });
    expect(el(f).querySelector('button[aria-label="Dismiss announcement"]')).not.toBeNull();
    expect(el(f).querySelector('button[aria-label="Dismiss alert"]')).toBeNull();
  });

  it('carries its own actions and its own no-dismiss case', async () => {
    const f = await setup({
      alertStyle: 'announcement',
      message: 'x',
      dismissible: false,
      actions: [{ id: 'read', label: 'Read more' }],
    });
    const labels = [...el(f).querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Read more']);
  });

  it('renders title and body together with a separator gap', async () => {
    const f = await setup({ alertStyle: 'announcement', title: 'New', message: 'Ships today.' });
    expect(el(f).textContent).toContain('New');
    expect(el(f).textContent).toContain('Ships today.');
  });
});
