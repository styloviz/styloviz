import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageGalleryComponent, type GalleryImage, type GalleryLayout } from './image-gallery.component';

/**
 * DD-17-I3 / M2 — a broken image gets the same honest placeholder in EVERY
 * layout, not only the grid: it keeps the alt text as the accessible name and
 * replaces the browser's unlabeled torn-image glyph.
 */
const IMAGES: GalleryImage[] = [
  { id: '1', src: '/a.png', alt: 'Alpha' },
  { id: '2', src: '/b.png', alt: 'Beta' },
  { id: '3', src: '/c.png', alt: 'Gamma' },
];

async function setup(layout: GalleryLayout) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageGalleryComponent, { inputs: { images: IMAGES, layout } });
  fixture.detectChanges();
  return fixture;
}

type F = Awaited<ReturnType<typeof setup>>;
const imgs = (f: F, src: string) =>
  [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLImageElement>('img')].filter(i => i.getAttribute('src') === src);
const broken = (f: F) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-sv-broken]')];

function fail(f: F, src: string): void {
  for (const img of imgs(f, src)) img.dispatchEvent(new Event('error'));
  f.detectChanges();
}

describe('SvImageGalleryComponent — broken-image placeholder in every layout', () => {
  it.each<GalleryLayout>(['grid', 'masonry', 'strip'])('%s: replaces the failed tile, keeps the alt', async (layout) => {
    const f = await setup(layout);
    expect(broken(f)).toHaveLength(0);
    fail(f, '/b.png');
    const ph = broken(f);
    expect(ph).toHaveLength(1);
    expect(ph[0].getAttribute('role')).toBe('img');
    expect(ph[0].getAttribute('aria-label')).toBe('Beta — could not be loaded');
    expect(imgs(f, '/b.png')).toHaveLength(0);
    expect(imgs(f, '/a.png').length).toBeGreaterThan(0);
  });

  it('viewer: the main image and its thumbnail both show the placeholder', async () => {
    const f = await setup('viewer');
    // The first image is the main one AND the first thumbnail.
    expect(imgs(f, '/a.png')).toHaveLength(2);
    fail(f, '/a.png');
    const ph = broken(f);
    expect(ph).toHaveLength(2);
    expect(ph.every(p => p.getAttribute('aria-label') === 'Alpha — could not be loaded')).toBe(true);
    expect(imgs(f, '/a.png')).toHaveLength(0);
  });

  it('viewer: a broken thumbnail alone leaves the working main image in place', async () => {
    const f = await setup('viewer');
    fail(f, '/c.png');
    expect(broken(f)).toHaveLength(1);
    expect(imgs(f, '/a.png')).toHaveLength(2);
  });
});
