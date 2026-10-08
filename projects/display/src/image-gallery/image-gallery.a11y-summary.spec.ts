import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageGalleryComponent, type GalleryImage } from './image-gallery.component';

/**
 * ============================================================================
 *  The gallery, for someone who cannot see the arrangement (audit item X-9)
 * ============================================================================
 *
 * ★★★ A GALLERY NEEDS NO COMPANION SUMMARY TABLE — a table of alt texts is just
 *     the alt texts again, in a worse container. What it needed is the thing the
 *     arrangement was carrying alone: THAT THESE IMAGES ARE ONE SET, AND HOW MANY
 *     OF THEM THERE ARE. It shipped as a `<div>` of `<div>`s, so a listener
 *     walked N alt texts with no count, no boundaries, and no way to know they
 *     had reached the end of the gallery rather than the end of the page.
 *
 * `role="list"` is not redundant on the `<ul>`: Tailwind's preflight strips
 * `list-style`, and that alone is enough for Safari/VoiceOver to stop treating a
 * `<ul>` as a list.
 *
 * Two further holes closed here: the grid's controls were named "Select" and
 * "View full size" with no image, while masonry and strip named theirs; and the
 * overlay those controls live in was revealed on hover only, so keyboard focus
 * landed on buttons still at `opacity-0`.
 * ============================================================================
 */

const IMAGES: GalleryImage[] = [
  { id: '1', src: '/a.png', alt: 'Alpha', title: 'Alpha title', tags: ['x'] },
  { id: '2', src: '/b.png', alt: 'Beta', title: 'Beta title' },
  { id: '3', src: '/c.png', alt: 'Gamma' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageGalleryComponent, {
    inputs: { images: IMAGES, ...inputs },
  });
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const LIST_LAYOUTS = ['grid', 'masonry', 'strip'] as const;

describe('SvImageGalleryComponent — the gallery is one set of a known size', () => {
  /** ★★★ The whole reason this changed: a pile of divs has no count and no edges. */
  it.each(LIST_LAYOUTS)('renders the %s layout as a list of images', async (layout) => {
    const el = await setup({ layout });
    const list = el.querySelector('ul[role="list"]');
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll(':scope > li')).toHaveLength(IMAGES.length);
  });

  /**
   * ★★ `role="list"` on a `<ul>` looks redundant and is not: Tailwind's preflight
   *    removes `list-style`, which is enough for Safari/VoiceOver to drop the role.
   */
  it.each(LIST_LAYOUTS)('keeps the explicit list role in the %s layout', async (layout) => {
    const el = await setup({ layout });
    expect(el.querySelector('ul')?.getAttribute('role')).toBe('list');
  });

  it.each(LIST_LAYOUTS)('names the %s gallery when it is given a label', async (layout) => {
    const el = await setup({ layout, ariaLabel: 'Product photos' });
    expect(el.querySelector('ul')?.getAttribute('aria-label')).toBe('Product photos');
  });

  /** ★ And invents nothing when unset — the role and the count already say plenty. */
  it('adds no name of its own making', async () => {
    const el = await setup();
    expect(el.querySelector('ul')?.hasAttribute('aria-label')).toBe(false);
  });

  it('treats a whitespace label as no label', async () => {
    const el = await setup({ ariaLabel: '   ' });
    expect(el.querySelector('ul')?.hasAttribute('aria-label')).toBe(false);
  });

  /**
   * ★ The viewer layout is deliberately NOT a list: it is one main image plus a
   *   `role="tablist"` of thumbnails, which is already the right pattern for
   *   "pick which one is shown" and would be wrong as a list of peers.
   */
  it('leaves the viewer layout as a tablist, which is the honest pattern there', async () => {
    const el = await setup({ layout: 'viewer' });
    expect(el.querySelector('ul[role="list"]')).toBeNull();
    expect(el.querySelector('[role="tablist"]')).toBeTruthy();
  });
});

describe('SvImageGalleryComponent — every control says which image it acts on', () => {
  /**
   * ★★ Nine tiles in a grid meant nine buttons called "Select" and nine called
   *    "View full size". The masonry and strip layouts had always named theirs,
   *    which is what made this a grid-only defect rather than a missing feature.
   */
  it.each(LIST_LAYOUTS)('names each select control after its image in the %s layout', async (layout) => {
    const el = await setup({ layout, selectable: true });
    const names = [...el.querySelectorAll('button[aria-label^="Select "]')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Select Alpha title', 'Select Beta title', 'Select Gamma']);
  });

  it('names each lightbox control after its image in the grid', async () => {
    const el = await setup({ layout: 'grid' });
    const names = [...el.querySelectorAll('button[aria-label*="full size"]')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(names).toEqual([
      'View Alpha title full size',
      'View Beta title full size',
      'View Gamma full size',
    ]);
  });

  /** ★ An image with no title falls back to its alt text, never to a bare verb. */
  it('falls back to the alt text when an image has no title', async () => {
    const el = await setup({ selectable: true });
    expect(el.querySelector('button[aria-label="Select Gamma"]')).toBeTruthy();
  });
});

describe('SvImageGalleryComponent — focus reveals what hover reveals', () => {
  /**
   * ★★★ THE CONTROLS LIVED IN A HOVER-ONLY OVERLAY. Tabbing to a tile's Select
   *     button moved focus onto something still at `opacity-0` — a control the
   *     keyboard user is now on and cannot see. WCAG 2.4.7.
   */
  it.each(['grid', 'masonry'] as const)('reveals the %s overlay on focus as well as hover', async (layout) => {
    const el = await setup({ layout, selectable: true });
    const overlay = [...el.querySelectorAll('div')].find(
      (d) => d.className.includes('opacity-0') && d.querySelector('button'),
    );
    expect(overlay?.className).toContain('group-hover:opacity-100');
    expect(overlay?.className).toContain('group-focus-within:opacity-100');
  });

  /** ★ The tag chips hide behind the same reveal, so they follow the same rule. */
  it('reveals the tag chips on focus too', async () => {
    const el = await setup({ layout: 'grid' });
    const tags = [...el.querySelectorAll('div')].find((d) => d.className.includes('flex-wrap'));
    expect(tags?.className).toContain('group-focus-within:opacity-100');
  });
});
