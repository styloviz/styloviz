import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';
import type { SkeletonPreset, SkeletonShape } from './skeleton-loader.component';

/**
 * The preset switch, the animation modes and the size scale.
 *
 * ★ Every query here is scoped to the fixture's own host. `screen` searches the
 * whole document, and this component's own root IS the `role="status"` region —
 * so a document-wide query for it finds the component under test and would keep
 * finding it after a change that broke the scoping.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSkeletonLoaderComponent, { inputs });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
/** Every bone in the tree — a bone is anything wearing the shared base class. */
const bones = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll<HTMLElement>('.bg-gray-200')];

const ALL_PRESETS: SkeletonPreset[] = [
  'text-block',
  'paragraph',
  'card',
  'stat-card',
  'table-row',
  'table',
  'list-item',
  'list',
  'profile-header',
  'form',
  'dashboard',
];

/**
 * `OF-17-I5` / `OF-17-M1` — the preset that stands in for a real component.
 *
 * ★★★ THIS PRESET USED TO BE A SECOND DRAWING OF `sv-stat-card`'S OWN LOADING
 *     STATE, and every bone was off by a step — the label 3.5 units tall
 *     against the card's 3, the icon 40px against 32px, the value h-8/w-36
 *     against h-7/w-28. Show the preset, then swap in the card, and every line
 *     moves: the second layout shift the audit names, arriving after the user
 *     has started reading.
 *
 * ★★ THE AUTHORITY IS THE CARD, not this file. `scripts/check-skeleton-presets.mjs`
 *    compares the two bone for bone, so a stat-card redesign fails there rather
 *    than shipping a shift — the assertions below are the same geometry stated
 *    where a reader of this component will see it.
 */
describe('SvSkeletonLoaderComponent — the stat-card preset stands in for sv-stat-card', () => {
  /** `sv-stat-card`'s own loading block, bone for bone. */
  const CARD_BONES = [
    'h-3 w-20 rounded-full',   // label
    'h-8 w-8 rounded-xl',      // icon
    'h-7 w-28 rounded-md',     // the big number
    'h-5 w-12 rounded-full',   // trend chip
    'h-3 w-16 rounded-full',   // trailing label
  ];

  const geometry = (b: HTMLElement) =>
    [...b.classList].filter((c) => /^(h-|w-|rounded)/.test(c)).join(' ');

  it('★ draws the card\u2019s five bones, in the card\u2019s geometry', async () => {
    const f = await setup({ preset: 'stat-card' });
    expect(bones(f).map(geometry)).toEqual(CARD_BONES);
  });

  it('★ pins the icon bone to the card\u2019s 2rem at the default size', async () => {
    // The generic icon bone is 2.5rem; this preset cannot use it, or the
    // stand-in hands the card back a different layout than it was holding.
    const f = await setup({ preset: 'stat-card' });
    const icon = bones(f)[1];
    expect(icon.style.width).toBe('2rem');
    expect(icon.style.height).toBe('2rem');
  });

  it('still scales with the size multiplier, around the pinned middle', async () => {
    const sm = await setup({ preset: 'stat-card', size: 'sm' });
    expect(bones(sm)[1].style.width).toBe('1.75rem');
    const lg = await setup({ preset: 'stat-card', size: 'lg' });
    expect(bones(lg)[1].style.width).toBe('2.5rem');
  });

  it('★ draws the same card inside the dashboard composition', async () => {
    // Three cards drifting together is still three cards in the wrong place.
    const f = await setup({ preset: 'dashboard' });
    expect(bones(f).slice(0, 5).map(geometry)).toEqual(CARD_BONES);
  });
});

describe('SvSkeletonLoaderComponent — the loading region', () => {
  it('★★★ names what is loading WITHOUT marking itself busy (T0-8)', async () => {
    // ★★★ `aria-busy="true"` used to sit on this very element, next to
    //     `role="status"`. It tells assistive technology to stop reporting
    //     changes from the subtree — so the live region announced NOTHING and
    //     the label below was never read. And it could never flip to false,
    //     because the skeleton is destroyed when content arrives rather than
    //     updated. The component suppressed the one thing it exists to do.
    const f = await setup({ ariaLabel: 'Loading invoices…' });
    const region = el(f).querySelector('[role="status"]')!;

    expect(region.getAttribute('aria-busy')).toBeNull();
    expect(region.getAttribute('aria-label')).toBe('Loading invoices…');
  });

  it('★★ cedes the announcement when the host owns it', async () => {
    // ★★ Two voices for one wait is worse than one. A host that marks its own
    //    region busy and announces the transition itself sets `announce` false,
    //    and the skeleton becomes decoration.
    const f = await setup({ announce: false, ariaLabel: 'Loading invoices…' });

    expect(el(f).querySelector('[role="status"]')).toBeNull();
    expect(el(f).firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    expect(el(f).firstElementChild!.getAttribute('aria-label')).toBeNull();
  });

  it('merges the host\'s own classes onto the region', async () => {
    const f = await setup({ customClass: 'my-4' });
    expect(el(f).querySelector('[role="status"]')!.className).toContain('my-4');
  });
});

describe('SvSkeletonLoaderComponent — presets', () => {
  it('renders each preset, and ignores the single-bone inputs while it does', async () => {
    // A marker width no preset uses: if it appears, the `custom` branch also
    // rendered and the two layouts are stacked on top of each other.
    for (const preset of ALL_PRESETS) {
      const f = await setup({ preset, width: '7.5rem', height: '9.5rem', shape: 'circle' });
      expect(bones(f).length).toBeGreaterThan(0);
      expect(bones(f).some((b) => b.style.width === '7.5rem')).toBe(false);
      expect(bones(f).some((b) => b.style.height === '9.5rem')).toBe(false);
    }
  });

  it('falls through to the single-bone layout for custom, and by default', async () => {
    const explicit = await setup({ preset: 'custom' });
    const implicit = await setup();
    expect(explicit.componentInstance.isPreset()).toBe(false);
    expect(implicit.componentInstance.isPreset()).toBe(false);
    expect(bones(implicit).length).toBe(1);
  });

  it('reports every preset except custom as a preset', async () => {
    for (const preset of ALL_PRESETS) {
      const f = await setup({ preset });
      expect(f.componentInstance.isPreset()).toBe(true);
    }
  });
});

describe('SvSkeletonLoaderComponent — animation', () => {
  it('sweeps by default', async () => {
    const f = await setup();
    expect(bones(f)[0].className).toContain('skeleton-wave');
    expect(bones(f)[0].className).not.toContain('animate-pulse');
  });

  it('pulses instead when asked, and honours reduced motion', async () => {
    const f = await setup({ animation: 'pulse' });
    expect(bones(f)[0].className).toContain('animate-pulse');
    expect(bones(f)[0].className).toContain('motion-reduce:animate-none');
    expect(bones(f)[0].className).not.toContain('skeleton-wave');
  });

  it('does neither when animation is off', async () => {
    const f = await setup({ animation: 'none' });
    expect(bones(f)[0].className).not.toContain('animate-pulse');
    expect(bones(f)[0].className).not.toContain('skeleton-wave');
    // The bone must still be visible — "no animation" is not "no skeleton".
    expect(bones(f).length).toBe(1);
  });

  it('applies the animation choice inside a preset too', async () => {
    const wave = await setup({ preset: 'card' });
    expect(wave.componentInstance.waveClass()).toBe('skeleton-wave');
    const none = await setup({ preset: 'card', animation: 'none' });
    expect(none.componentInstance.waveClass()).toBe('');
  });
});

describe('SvSkeletonLoaderComponent — the size scale', () => {
  it.each([
    ['sm', '0.75rem', '2rem'],
    ['md', '0.875rem', '2.5rem'],
    ['lg', '1.125rem', '3rem'],
  ])('scales text lines, avatars and icons together at %s', async (size, line, round) => {
    const f = await setup({ preset: 'paragraph', size });
    expect(f.componentInstance.lineH()).toBe(line);
    expect(f.componentInstance.avatarSz()).toBe(round);
    expect(f.componentInstance.iconSz()).toBe(round);
  });

  it('actually applies the scale to the rendered avatar', async () => {
    const sm = await setup({ preset: 'paragraph', size: 'sm' });
    const lg = await setup({ preset: 'paragraph', size: 'lg' });
    const avatar = (f: { nativeElement: unknown }) =>
      el(f).querySelector<HTMLElement>('.rounded-full')!.style.height;
    expect(avatar(sm)).toBe('2rem');
    expect(avatar(lg)).toBe('3rem');
  });
});

describe('SvSkeletonLoaderComponent — the single bone', () => {
  it.each([
    ['line', 'rounded-md'],
    ['circle', 'rounded-full'],
    ['badge', 'rounded-full'],
    ['button', 'rounded-lg'],
    ['rect', 'rounded-lg'],
  ])('rounds a %s bone as %s', async (shape, rounded) => {
    const f = await setup({ shape: shape as SkeletonShape });
    expect(f.componentInstance.roundedClass()).toBe(rounded);
    expect(bones(f)[0].className).toContain(rounded);
  });

  it('lets an explicit rounded value beat every shape default', async () => {
    for (const shape of ['line', 'circle', 'rect'] as SkeletonShape[]) {
      const f = await setup({ shape, rounded: 'none' });
      expect(f.componentInstance.roundedClass()).toBe('rounded-none');
    }
  });

  it('treats an empty rounded override as no override at all', async () => {
    // `rounded` defaults to '', which is falsy — the shape must still decide.
    const f = await setup({ shape: 'circle', rounded: '' });
    expect(f.componentInstance.roundedClass()).toBe('rounded-full');
  });

  it('applies width and height to the bone', async () => {
    const f = await setup({ width: '8rem', height: '3rem' });
    expect(bones(f)[0].style.width).toBe('8rem');
    expect(bones(f)[0].style.height).toBe('3rem');
  });

  it('gaps the stack only once there is more than one line', async () => {
    const one = await setup({ lines: 1 });
    expect(one.nativeElement.querySelector('.gap-2')).toBeNull();

    const many = await setup({ lines: 3 });
    expect(many.nativeElement.querySelector('.gap-2')).not.toBeNull();
  });

  it('shortens only the last of several lines', async () => {
    const f = await setup({ lines: 3, width: '100%' });
    expect(bones(f).map((b) => b.style.width)).toEqual(['100%', '100%', '65%']);
  });

  it('leaves a lone line at full width even with shortLastLine on', async () => {
    // A one-line paragraph has no "last line" to ragged — shortening it just
    // makes the placeholder look wrong.
    const f = await setup({ lines: 1, width: '100%', shortLastLine: true });
    expect(bones(f).map((b) => b.style.width)).toEqual(['100%']);
  });

  it('keeps every line full width when shortLastLine is off', async () => {
    const f = await setup({ lines: 3, width: '80%', shortLastLine: false });
    expect(bones(f).map((b) => b.style.width)).toEqual(['80%', '80%', '80%']);
  });

  it('clamps a zero or negative line count to one', async () => {
    for (const lines of [0, -3]) {
      const f = await setup({ lines });
      expect(bones(f).length).toBe(1);
    }
  });
});
