import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvAvatarComponent } from './avatar.component';

/**
 * The free avatar's twin is `@styloviz-pro/avatar`. Everything here is written
 * against the free component and cross-checked against the Pro spec; the two
 * places the twins genuinely diverge get their own test with the divergence
 * named, rather than being copied over and quietly passing.
 */

async function setup(inputs: Partial<ComponentInput<SvAvatarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvAvatarComponent, {
    inputs: inputs as ComponentInput<SvAvatarComponent>,
  });
}

const host = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const root = (f: { nativeElement: unknown }) =>
  host(f).firstElementChild as HTMLElement;
/**
 * The inner shell span that carries the size / shape / colour classes.
 *
 * ★ Two levels down, not one. The root now wraps an avatar BOX (which the
 * status dot and badge are positioned against) so that `showStatusText` can put
 * words beside it without the absolute children re-anchoring to a wider parent.
 */
const shell = (f: { nativeElement: unknown }) =>
  root(f).firstElementChild!.firstElementChild as HTMLElement;
const img = (f: { nativeElement: unknown }) =>
  host(f).querySelector('img') as HTMLImageElement | null;

describe('SvAvatarComponent — image failure', () => {
  /**
   * jsdom never loads (or decodes) an image, so the `error` event has to be
   * dispatched by hand. Nothing about the component is faked by doing so — this
   * is the same event the browser fires on a 404.
   */
  it('drops to initials when the image fails', async () => {
    const { fixture } = await setup({ src: '/gone.png', name: 'Ada Lovelace' });
    expect(fixture.componentInstance.showImage()).toBe(true);

    img(fixture)!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.componentInstance.showImage()).toBe(false);
    expect(img(fixture)).toBeNull();
    expect(host(fixture).textContent?.trim()).toBe('AL');
  });

  /**
   * ★ REGRESSION. `imgError` used to be a plain `signal(false)`: set once on
   * error and never cleared. An avatar whose picture 404'd was then stuck on
   * its initials for the life of the component, so a user who *replaced* a
   * broken profile picture never saw the new one — the component had already
   * decided images were broken. The Pro twin was fixed by keying the flag on
   * `src`; the free twin was not, and this is that fix.
   */
  it('retries the image when src changes after a failure', async () => {
    const { fixture } = await setup({ src: '/gone.png', name: 'Ada Lovelace' });
    img(fixture)!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.componentInstance.showImage()).toBe(false);

    fixture.componentRef.setInput('src', '/fixed.png');
    fixture.detectChanges();

    expect(fixture.componentInstance.showImage()).toBe(true);
    expect(img(fixture)?.getAttribute('src')).toBe('/fixed.png');
  });

  it('stays on initials while the same failed src is re-set', async () => {
    const { fixture } = await setup({ src: '/gone.png', name: 'Ada Lovelace' });
    img(fixture)!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    fixture.componentRef.setInput('src', '/gone.png');
    fixture.detectChanges();

    expect(fixture.componentInstance.showImage()).toBe(false);
  });

  it('falls through to the generic icon when the image fails and there is no name', async () => {
    const { fixture } = await setup({ src: '/gone.png' });
    img(fixture)!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.componentInstance.showIcon()).toBe(true);
    expect(host(fixture).querySelector('svg')).not.toBeNull();
  });
});

describe('SvAvatarComponent — palette', () => {
  it('uses an explicit colour verbatim, ignoring the name hash', async () => {
    const { fixture } = await setup({ name: 'Ada Lovelace', color: 'teal' });
    expect(fixture.componentInstance.resolvedColor()).toBe('teal');
    expect(shell(fixture).className).toContain('bg-teal-100');
  });

  it('falls back to primary on auto with no name', async () => {
    const { fixture } = await setup({ color: 'auto' });
    expect(fixture.componentInstance.resolvedColor()).toBe('primary');
  });

  it('derives a stable colour from the name on auto', async () => {
    const a = await setup({ name: 'Ada Lovelace' });
    const b = await setup({ name: 'Ada Lovelace' });
    expect(a.fixture.componentInstance.resolvedColor())
      .toBe(b.fixture.componentInstance.resolvedColor());
  });

  it('gives different names different colours', async () => {
    const a = await setup({ name: 'Ada Lovelace' });
    const b = await setup({ name: 'Grace Hopper' });
    expect(a.fixture.componentInstance.resolvedColor())
      .not.toBe(b.fixture.componentInstance.resolvedColor());
  });

  /** Every palette entry has to resolve to a class, not to `undefined`. */
  it('maps every palette entry to a background class', async () => {
    const palette = [
      'primary', 'violet', 'rose', 'amber', 'teal',
      'sky', 'indigo', 'fuchsia', 'lime', 'orange',
    ] as const;
    for (const color of palette) {
      const { fixture } = await setup({ color, name: 'X' });
      expect(fixture.componentInstance.initialsColorClasses()).toContain(`bg-${color}-100`);
    }
  });

  it('keeps the initials background until the image has actually loaded', async () => {
    const { fixture } = await setup({ src: '/me.png', name: 'Ada Lovelace', color: 'teal' });
    // ★ This used to assert the background was dropped the moment `src` was
    // set, which is the defect: the fallback was treated as a REPLACEMENT for
    // the image, so a slow one left an empty hole and a broken one snapped from
    // that hole to initials. The initials are what the image sits on top of.
    expect(shell(fixture).className).toContain('bg-teal-100');

    fixture.nativeElement.querySelector('img')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(shell(fixture).className).not.toContain('bg-teal-100');
  });
});

describe('SvAvatarComponent — size and shape maps', () => {
  const sizes = [
    ['xs', 'h-6 w-6'],
    ['sm', 'h-8 w-8'],
    ['md', 'h-10 w-10'],
    ['lg', 'h-12 w-12'],
    ['xl', 'h-16 w-16'],
    ['2xl', 'h-20 w-20'],
  ] as const;

  it('gives every size its own box', async () => {
    for (const [size, box] of sizes) {
      const { fixture } = await setup({ size });
      expect(fixture.componentInstance.sizeClasses()).toContain(box);
    }
  });

  it('maps each shape to its own radius', async () => {
    for (const [shape, radius] of [
      ['circle', 'rounded-full'],
      ['rounded', 'rounded-lg'],
      ['square', 'rounded-none'],
    ] as const) {
      const { fixture } = await setup({ shape });
      expect(fixture.componentInstance.shapeClasses()).toBe(radius);
    }
  });

  /** Status dot and badge scale in three steps, not six. */
  it('scales the status dot in three steps across the six sizes', async () => {
    const bySize = await Promise.all(
      sizes.map(async ([size]) => {
        const { fixture } = await setup({ size, status: 'online' });
        return fixture.componentInstance.statusSizeClasses();
      }),
    );
    expect(bySize).toEqual([
      'h-2 w-2', 'h-2 w-2', 'h-2.5 w-2.5', 'h-3.5 w-3.5', 'h-3.5 w-3.5', 'h-3.5 w-3.5',
    ]);
  });

  it('scales the notification badge in three steps across the six sizes', async () => {
    const bySize = await Promise.all(
      sizes.map(async ([size]) => {
        const { fixture } = await setup({ size, badgeCount: 2 });
        return fixture.componentInstance.badgeSizeClasses();
      }),
    );
    expect(bySize).toEqual([
      'h-3.5 min-w-3.5 text-[9px] px-0.5',
      'h-3.5 min-w-3.5 text-[9px] px-0.5',
      'h-4 min-w-4 text-[10px] px-0.5',
      'h-5 min-w-5 text-[11px] px-1',
      'h-5 min-w-5 text-[11px] px-1',
      'h-5 min-w-5 text-[11px] px-1',
    ]);
  });
});

describe('SvAvatarComponent — status dot', () => {
  it('gives each presence state its own colour', async () => {
    for (const [status, cls] of [
      ['online', 'bg-accent-500'],
      ['offline', 'bg-gray-400'],
      ['away', 'bg-warning-400'],
      ['busy', 'bg-danger-500'],
    ] as const) {
      const { fixture } = await setup({ status });
      expect(fixture.componentInstance.statusColorClass()).toContain(cls);
      const dot = root(fixture).querySelector('[role="img"]') as HTMLElement;
      // Announced in words, not the raw enum value: `statusLabel` can replace
      // it with the host's own wording ("In a meeting").
      const spoken = status[0].toUpperCase() + status.slice(1);
      expect(dot.getAttribute('aria-label')).toBe(`Status: ${spoken}`);
    }
  });

  it('renders no dot at all for status "none"', async () => {
    const { fixture } = await setup({ status: 'none' });
    expect(fixture.componentInstance.statusColorClass()).toBe('');
    expect(root(fixture).querySelector('[aria-label^="Status:"]')).toBeNull();
  });
});

describe('SvAvatarComponent — badge and verified mark', () => {
  it('shows the exact count when it is under the cap', async () => {
    const { fixture } = await setup({ badgeCount: 4, badgeMax: 9 });
    expect(fixture.componentInstance.displayBadge()).toBe('4');
  });

  it('shows the verified mark only when no badge is competing for the corner', async () => {
    const withMark = await setup({ verified: true, name: 'Ada' });
    expect(withMark.fixture.nativeElement.querySelector('[aria-label="Verified"]')).not.toBeNull();

    const withBadge = await setup({ verified: true, badgeCount: 3, name: 'Ada' });
    expect(withBadge.fixture.nativeElement.querySelector('[aria-label="Verified"]')).toBeNull();
  });

  /**
   * ★ DIVERGENCE from the Pro twin, deliberately pinned here rather than
   * assumed: the free avatar has no `ring` / `ringColor` inputs, so it never
   * emits a ring class of its own. Only `customClass` can add one.
   */
  it('has no ring of its own — only what customClass adds', async () => {
    const { fixture } = await setup({ name: 'Ada', customClass: 'ring-2' });
    expect(shell(fixture).className).not.toContain('ring-2');
    expect(root(fixture).className).toContain('ring-2');
  });
});

describe('SvAvatarComponent — interaction', () => {
  it('is a keyboard-reachable button only when clickable', async () => {
    const on = await setup({ clickable: true, name: 'Ada' });
    expect(root(on.fixture).getAttribute('role')).toBe('button');
    expect(root(on.fixture).getAttribute('tabindex')).toBe('0');

    const off = await setup({ name: 'Ada' });
    expect(root(off.fixture).getAttribute('role')).toBeNull();
    expect(root(off.fixture).getAttribute('tabindex')).toBeNull();
  });

  it('emits on Enter and Space when clickable', async () => {
    const spy = vi.fn();
    const { fixture } = await setup({ clickable: true, name: 'Ada' });
    fixture.componentInstance.avatarClick.subscribe(spy);

    root(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    root(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('stays silent on keyboard activation when not clickable', async () => {
    const spy = vi.fn();
    const { fixture } = await setup({ name: 'Ada' });
    fixture.componentInstance.avatarClick.subscribe(spy);

    root(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    root(fixture).click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('adds the hover affordance only when clickable', async () => {
    const on = await setup({ clickable: true });
    expect(shell(on.fixture).className).toContain('hover:opacity-90');
    expect(root(on.fixture).className).toContain('cursor-pointer');

    const off = await setup({});
    expect(shell(off.fixture).className).not.toContain('hover:opacity-90');
    expect(root(off.fixture).className).not.toContain('cursor-pointer');
  });
});

describe('SvAvatarComponent — how it is announced', () => {
  /**
   * ★ REGRESSION. The root used to carry `aria-label` unconditionally, on a
   * `<span>` with no role. `aria-label` on a roleless element is prohibited and
   * assistive tech is free to ignore it — several do — so the avatar was
   * announced by an attribute nothing had to read. The root is only labellable
   * once `clickable` gives it `role="button"`. Matches the Pro twin.
   */
  it('does not label a plain span that has no role to carry the label', async () => {
    const { fixture } = await setup({ src: '/me.png', name: 'Ada Lovelace' });
    expect(root(fixture).getAttribute('role')).toBeNull();
    expect(root(fixture).getAttribute('aria-label')).toBeNull();
  });

  it('labels the root once it is a button', async () => {
    const { fixture } = await setup({ name: 'Ada Lovelace', clickable: true });
    expect(root(fixture).getAttribute('aria-label')).toBe('Ada Lovelace');
  });

  it('falls back to alt, then to "Avatar", for a clickable avatar', async () => {
    const withAlt = await setup({ alt: 'Portrait', clickable: true });
    expect(root(withAlt.fixture).getAttribute('aria-label')).toBe('Portrait');

    const bare = await setup({ clickable: true });
    expect(root(bare.fixture).getAttribute('aria-label')).toBe('Avatar');
  });

  /**
   * ★ REGRESSION. With no image there is no `alt` to carry the name, and the
   * initials span was `aria-hidden`. An initials-only avatar therefore had no
   * accessible name at all — a table of them read as a row of blanks.
   */
  it('gives an initials-only avatar a name via role="img"', async () => {
    const { fixture } = await setup({ name: 'Ada Lovelace' });
    const initials = host(fixture).querySelector('[role="img"]') as HTMLElement;
    expect(initials.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(initials.textContent?.trim()).toBe('AL');
  });

  it('prefers an explicit alt over the name for the image', async () => {
    const { fixture } = await setup({ src: '/me.png', name: 'Ada', alt: 'Portrait of Ada' });
    expect(img(fixture)?.getAttribute('alt')).toBe('Portrait of Ada');
  });

  /**
   * ★ REGRESSION. The badge label was `badgeCount() + ' notifications'`, which
   * announced "1 notifications". Matches the Pro twin, which announces the true
   * count rather than the capped display string.
   */
  it('says "1 notification", not "1 notifications"', async () => {
    const { fixture } = await setup({ name: 'Ada', badgeCount: 1 });
    expect(host(fixture).querySelector('[role="status"]')!.getAttribute('aria-label'))
      .toBe('1 notification');
  });

  it('announces the true count even when the visible one is capped', async () => {
    const { fixture } = await setup({ name: 'Ada', badgeCount: 42, badgeMax: 9 });
    const badge = host(fixture).querySelector('[role="status"]') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('9+');
    expect(badge.getAttribute('aria-label')).toBe('42 notifications');
  });
});
