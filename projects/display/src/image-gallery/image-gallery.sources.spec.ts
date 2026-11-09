import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageGalleryComponent, type GalleryImage, type GalleryLayout } from './image-gallery.component';
import { until } from '../../../../src/testing/async';

/**
 * FL-J3-DD-14 — `srcset` / `sizes` on `GalleryImage`, so a thumbnail does not
 * download the full-size `src`. FL-J3-DD-35 — the lightbox's prev/next stay on
 * screen at phone width.
 */
const SRCSET = '/p/a-400.jpg 400w, /p/a-1600.jpg 1600w';
const IMAGES: GalleryImage[] = [
  { id: '1', src: '/p/a-1600.jpg', srcset: SRCSET, alt: 'Alpha' },
  { id: '2', src: '/p/b.jpg', alt: 'Beta' },
  { id: '3', src: '/p/c.jpg', srcset: '/p/c-300.jpg 300w', sizes: '10vw', alt: 'Gamma' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageGalleryComponent, { inputs: { images: IMAGES, ...inputs } });
  fixture.detectChanges();
  return fixture;
}
const imgs = (f: { nativeElement: HTMLElement }) => [...f.nativeElement.querySelectorAll<HTMLImageElement>('img')];
const lb = () => document.querySelector<HTMLElement>('body > div[role="dialog"]');

describe('SvImageGalleryComponent — responsive sources (DD-17-M3 / I4)', () => {
  it.each<[GalleryLayout, string]>([
    ['grid', '(min-width: 640px) 33vw, 50vw'],
    ['masonry', '(min-width: 640px) 33vw, 50vw'],
    ['strip', '20rem'],
  ])('%s: passes srcset through and derives sizes from the layout', async (layout, sizes) => {
    const f = await setup({ layout, columns: 3 });
    const [a, b, c] = imgs(f);
    expect(a.getAttribute('srcset')).toBe(SRCSET);
    expect(a.getAttribute('sizes')).toBe(sizes);
    expect(b.hasAttribute('srcset')).toBe(false);
    expect(b.hasAttribute('sizes')).toBe(false);
    expect(c.getAttribute('sizes')).toBe('10vw'); // the image's own sizes wins
  });

  it('follows the column count', async () => {
    const f = await setup({ layout: 'grid', columns: 4 });
    expect(imgs(f)[0].getAttribute('sizes')).toBe('(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw');
  });

  it('viewer: the main image and the thumbnails each get a sizes for their slot', async () => {
    const f = await setup({ layout: 'viewer' });
    const all = imgs(f);
    const main = all[0];
    expect(main.getAttribute('srcset')).toBe(SRCSET);
    expect(main.getAttribute('sizes')).toBe('(min-width: 1024px) 50vw, 100vw');
    expect(all.some((i) => i.getAttribute('sizes') === '6rem')).toBe(true);
  });

  it('the lightbox asks for at most the frame width', async () => {
    const f = await setup({ layout: 'grid' });
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-sv-lightbox-trigger="1"]')!.click();
    f.detectChanges();
    await until(() => lb() !== null && lb()!.style.display !== 'none', { label: 'the lightbox' });
    const picture = lb()!.querySelector('img')!;
    expect(picture.getAttribute('srcset')).toBe(SRCSET);
    expect(picture.getAttribute('sizes')).toBe('(min-width: 948px) 900px, calc(100vw - 3rem)');
    f.componentInstance.closeLightbox();
  });
});

describe('SvImageGalleryComponent — lightbox arrows on a phone (FL-J3-DD-35)', () => {
  it('positions prev/next by the free space beside the frame, capped at 56px, never a fixed -56px', async () => {
    const f = await setup({ layout: 'grid' });
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-sv-lightbox-trigger="1"]')!.click();
    f.detectChanges();
    await until(() => lb()?.querySelector('[data-sv-lightbox-prev]') != null, { label: 'the arrows' });
    const prev = lb()!.querySelector<HTMLElement>('[data-sv-lightbox-prev]')!;
    const next = lb()!.querySelector<HTMLElement>('[data-sv-lightbox-next]')!;
    const style = (el: HTMLElement) => el.getAttribute('style') ?? '';
    for (const [el, side] of [[prev, 'inset-inline-start'], [next, 'inset-inline-end']] as const) {
      expect(style(el)).not.toMatch(new RegExp(`${side}:\\s*-56px`));
      expect(style(el)).toContain(`${side}:calc(-1 * min(56px, (100vw - 100%) / 2 - 8px))`);
      expect(style(el)).toContain('width:44px');
    }
    f.componentInstance.closeLightbox();
  });
});
