import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageGalleryComponent, type GalleryImage, type GalleryLayout } from './image-gallery.component';
import { until } from '../../../../src/testing/async';

/**
 * `X-12` — where focus goes when the lightbox closes: the control that opened
 * it, or — when the reader paged to another image — the thumbnail of the image
 * last VIEWED; if neither survives, the gallery. Never `<body>`.
 */

const IMAGES: GalleryImage[] = [
  { id: '1', src: '/a.png', alt: 'Alpha', title: 'Alpha title' },
  { id: '2', src: '/b.png', alt: 'Beta', title: 'Beta title' },
  { id: '3', src: '/c.png', alt: 'Gamma' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageGalleryComponent, { inputs: { images: IMAGES, ...inputs } });
  fixture.detectChanges();
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const lb = () => document.querySelector<HTMLElement>('body > div[role="dialog"]');
const trigger = (f: Fixture, id: string, layout: GalleryLayout) =>
  layout === 'viewer'
    ? (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label="View full size"]')!
    : (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-sv-lightbox-trigger="${id}"]`)!;
const thumb = (f: Fixture, id: string) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-sv-lightbox-trigger="${id}"]`)!;

async function openFrom(f: Fixture, el: HTMLElement) {
  el.focus();
  el.click();
  f.detectChanges();
  await until(() => lb() !== null && lb()!.style.display !== 'none', { label: 'the lightbox to open' });
}

function key(f: Fixture, k: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  f.detectChanges();
}

afterEach(() => {
  document.querySelectorAll('body > div[role="dialog"]').forEach((n) => n.remove());
});

const LAYOUTS: GalleryLayout[] = ['grid', 'masonry', 'strip', 'viewer'];

describe('SvImageGalleryComponent — X-12 focus after the lightbox closes', () => {
  it.each(LAYOUTS)('%s: Escape returns focus to the control that opened it', async (layout) => {
    const f = await setup({ layout });
    const opener = trigger(f, '1', layout);
    await openFrom(f, opener);
    expect(lb()!.contains(document.activeElement)).toBe(true);
    key(f, 'Escape');
    expect(document.activeElement).toBe(opener);
  });

  it.each(LAYOUTS)('%s: after paging to another image, focus lands on THAT image\'s thumbnail', async (layout) => {
    const f = await setup({ layout });
    await openFrom(f, trigger(f, '1', layout));
    key(f, 'ArrowRight');
    key(f, 'Escape');
    f.detectChanges();
    expect(document.activeElement).toBe(thumb(f, '2'));
    if (layout === 'viewer') expect(f.componentInstance.currentIndex()).toBe(1);
  });

  it('falls back into the gallery — not <body> — when the opener is gone', async () => {
    const f = await setup({ layout: 'grid' });
    await openFrom(f, trigger(f, '1', 'grid'));
    f.componentRef.setInput('images', IMAGES.slice(1));
    f.detectChanges();
    f.componentInstance.lightboxIndex.set(0);
    // Same index as opened: the scope restores the opener — which is gone.
    f.componentInstance.closeLightbox();
    expect(document.activeElement).not.toBe(document.body);
    expect((f.nativeElement as HTMLElement).contains(document.activeElement)).toBe(true);
  });
});
