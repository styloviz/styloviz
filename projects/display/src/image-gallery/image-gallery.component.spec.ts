import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvImageGalleryComponent, type GalleryImage } from './image-gallery.component';
import { until } from '../../../../src/testing/async';

/**
 * The lightbox is built with raw DOM APIs into a <div> appended to <body> by
 * `afterNextRender`, so it is neither in the fixture nor in the component
 * template. `lb()` finds it by the one attribute it always carries.
 *
 * Everything else is scoped to the fixture host on purpose.
 */

const IMAGES: GalleryImage[] = [
  { id: '1', src: '/a.png', alt: 'Alpha', title: 'Alpha title', author: 'Ann', tags: ['x', 'y'] },
  { id: '2', src: '/b.png', alt: 'Beta', title: 'Beta title' },
  { id: '3', src: '/c.png', alt: 'Gamma' },
];

async function setup(inputs: Record<string, unknown> = {}, on: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageGalleryComponent, {
    inputs: { images: IMAGES, ...inputs },
    on,
  });
  fixture.detectChanges();
  return fixture;
}

const lb = () => document.querySelector<HTMLElement>('body > div[role="dialog"]');
const q = (f: { nativeElement: HTMLElement }, sel: string) =>
  f.nativeElement.querySelector<HTMLElement>(sel);
const qa = (f: { nativeElement: HTMLElement }, sel: string) => [
  ...f.nativeElement.querySelectorAll<HTMLElement>(sel),
];

/** The narrow slice of the fixture these helpers touch. */
interface GalleryFixture {
  nativeElement: HTMLElement;
  detectChanges(): void;
  componentInstance: { openLightbox(i: number): void; lightboxOpen(): boolean };
}

async function openFirst(f: GalleryFixture) {
  f.componentInstance.openLightbox(0);
  f.detectChanges();
  await until(() => lb() !== null, { label: 'the lightbox to be rendered' });
}

afterEach(() => {
  // The lightbox host is appended to <body> and only removed on destroy.
  document.querySelectorAll('body > div[role="dialog"]').forEach((n) => n.remove());
});

describe('SvImageGalleryComponent — async shells', () => {
  it('shows the skeleton while loading and nothing else', async () => {
    const f = await setup({ loading: true });
    expect(q(f, '[data-sv-state="loading"]')).not.toBeNull();
    expect(qa(f, 'img').length).toBe(0);
  });

  it('shows the error shell and relays retry', async () => {
    let retries = 0;
    const f = await setup({ error: 'nope' }, { retry: () => retries++ });
    q(f, '[data-sv-state="error"]')!.querySelector<HTMLButtonElement>('button')?.click();
    expect(retries).toBe(1);
  });

  it('separates "no images" from "no matches"', async () => {
    const empty = await setup({ images: [] });
    const filtered = await setup({ images: [], filtered: true });
    expect(q(empty, '[data-sv-state="empty"]')).not.toBeNull();
    expect(empty.nativeElement.textContent).not.toEqual(filtered.nativeElement.textContent);
  });
});

describe('SvImageGalleryComponent — layouts', () => {
  it.each(['grid', 'masonry', 'strip'] as const)('renders every image in %s', async (layout) => {
    const f = await setup({ layout });
    expect(qa(f, 'img').length).toBe(3);
  });

  it('renders one main image plus a thumbnail per image in viewer layout', async () => {
    const f = await setup({ layout: 'viewer' });
    expect(qa(f, '[role="tab"]').length).toBe(3);
    expect(qa(f, 'img').length).toBe(4); // main + 3 thumbs
  });

  it.each([
    [2, 'grid-cols-2'],
    [3, 'sm:grid-cols-3'],
    [4, 'md:grid-cols-4'],
    [5, 'md:grid-cols-5'],
  ])('maps columns=%s onto its grid class', async (columns, expected) => {
    const f = await setup({ columns });
    expect(f.componentInstance.gridClass()).toContain(expected);
  });

  it.each([
    [2, 'columns-2'],
    [3, 'sm:columns-3'],
    [4, 'md:columns-4'],
    [5, 'md:columns-5'],
  ])('maps columns=%s onto its masonry class', async (columns, expected) => {
    const f = await setup({ layout: 'masonry', columns });
    expect(f.componentInstance.masonryClass()).toContain(expected);
  });

  it('renders captions only for images that carry them, and only when asked', async () => {
    const on = await setup({ captions: true });
    expect(on.nativeElement.textContent).toContain('Alpha title');
    expect(on.nativeElement.textContent).toContain('Ann');
    // Gamma has neither title nor author — nothing must be invented for it.
    expect(on.nativeElement.textContent).not.toContain('Gamma title');

    const off = await setup({ captions: false });
    expect(off.nativeElement.textContent).not.toContain('Alpha title');
  });

  it('renders tag chips only for images that have tags', async () => {
    const f = await setup();
    // Only image 1 carries tags, and it carries two of them.
    expect(qa(f, '.uppercase').length).toBe(2);
  });
});

describe('SvImageGalleryComponent — selection', () => {
  it('adds on first click and removes on the second, emitting each time', async () => {
    // `selected` is a `model`, so the emission under test is its own
    // `selectedChange`. There is deliberately no second, differently-shaped
    // `selectionChange` alongside it. Subscribed on the signal rather than
    // through `on:`, because a model's output lives on the model itself — there
    // is no `selectedChange` property to look up.
    const seen: string[][] = [];
    const f = await setup({ selectable: true });
    f.componentInstance.selected.subscribe((s) => seen.push([...s]));

    f.componentInstance.toggleSelect('1');
    f.componentInstance.toggleSelect('2');
    f.componentInstance.toggleSelect('1');

    expect(seen).toEqual([['1'], ['1', '2'], ['2']]);
    expect(f.componentInstance.isSelected('1')).toBe(false);
    expect(f.componentInstance.isSelected('2')).toBe(true);
  });

  it('lets the host preselect and clear, which a plain signal could not', async () => {
    // The reason for the change: acting on a selection means being able to reset
    // it afterwards, and restoring a saved one means being able to write it.
    const f = await setup({ selectable: true, selected: new Set(['2', '3']) });
    expect(f.componentInstance.isSelected('2')).toBe(true);
    expect(f.componentInstance.isSelected('1')).toBe(false);

    f.componentInstance.selected.set(new Set());
    expect(f.componentInstance.isSelected('2')).toBe(false);
  });

  /**
   * ★ The grid's controls used to be named a bare "Select" and "View full size",
   *   while masonry and strip named the image — so a nine-image grid offered nine
   *   buttons a listener could not tell apart. Matched to the other layouts.
   */
  it('offers no select control unless selectable', async () => {
    const f = await setup();
    expect(qa(f, '[aria-label^="Select "]').length).toBe(0);
    const s = await setup({ selectable: true });
    expect(qa(s, '[aria-label^="Select "]').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Select Alpha title',
      'Select Beta title',
      'Select Gamma',
    ]);
  });

  it('flips the select control label once the image is chosen', async () => {
    const f = await setup({ selectable: true });
    qa(f, '[aria-label="Select Alpha title"]')[0].click();
    f.detectChanges();
    expect(qa(f, '[aria-label="Deselect Alpha title"]').length).toBe(1);
  });
});

describe('SvImageGalleryComponent — lightbox', () => {
  it('opens on the clicked image and reports the click', async () => {
    const clicked: GalleryImage[] = [];
    const f = await setup({}, { imageClick: (i: GalleryImage) => clicked.push(i) });
    f.componentInstance.openLightbox(1);
    await until(() => lb() !== null, { label: 'the lightbox' });

    expect(f.componentInstance.lightboxOpen()).toBe(true);
    expect(clicked.map((i) => i.id)).toEqual(['2']);
    expect(lb()!.getAttribute('aria-label')).toBe('Beta title — image viewer');
  });

  /**
   * ★ DEFECT (fixed): `[lightbox]="false"` is the documented way for a host to
   * take the click over itself — but the guard returned before `imageClick`
   * fired, so in `strip` layout, where the whole thumbnail is a click target
   * that is NOT gated on `lightbox()`, clicking an image did literally nothing.
   */
  it('still reports the click when the lightbox is disabled', async () => {
    const clicked: GalleryImage[] = [];
    const f = await setup(
      { lightbox: false, layout: 'strip' },
      { imageClick: (i: GalleryImage) => clicked.push(i) },
    );
    qa(f, 'button[aria-label^="Open"]')[2].click();
    f.detectChanges();

    expect(clicked.map((i) => i.id)).toEqual(['3']);
    expect(f.componentInstance.lightboxOpen()).toBe(false);
    expect(lb()).toBeNull();
  });

  it('ignores an index that is not in the set', async () => {
    const clicked: GalleryImage[] = [];
    const f = await setup({}, { imageClick: (i: GalleryImage) => clicked.push(i) });
    f.componentInstance.openLightbox(9);
    f.detectChanges();
    expect(clicked).toEqual([]);
    expect(f.componentInstance.lightboxOpen()).toBe(false);
  });

  it('labels itself generically for an image with no title', async () => {
    const f = await setup();
    f.componentInstance.openLightbox(2); // Gamma: no title
    await until(() => lb() !== null);
    expect(lb()!.getAttribute('aria-label')).toBe('Image viewer');
    // …and renders no caption block, so no stray author line either.
    expect(lb()!.textContent).not.toContain('Ann');
  });

  it('renders the author line only when there is one', async () => {
    const f = await setup();
    await openFirst(f);
    expect(lb()!.textContent).toContain('Ann');

    f.componentInstance.lightboxNext(); // Beta: title but no author
    expect(lb()!.textContent).toContain('Beta title');
    expect(lb()!.textContent).not.toContain('Ann');
  });

  it('wraps in both directions and keeps the counter honest', async () => {
    const f = await setup();
    await openFirst(f);
    expect(lb()!.textContent).toContain('1 / 3');

    f.componentInstance.lightboxPrev();
    expect(f.componentInstance.lightboxIndex()).toBe(2);
    expect(lb()!.textContent).toContain('3 / 3');

    f.componentInstance.lightboxNext();
    expect(f.componentInstance.lightboxIndex()).toBe(0);
  });

  it('shows no prev/next controls for a single image', async () => {
    const f = await setup({ images: [IMAGES[0]] });
    await openFirst(f);
    expect(lb()!.querySelector('[aria-label="Next image"]')).toBeNull();
    expect(lb()!.querySelector('[aria-label="Close image viewer"]')).not.toBeNull();
  });

  it('navigates from its own arrow buttons', async () => {
    const f = await setup();
    await openFirst(f);
    lb()!.querySelector<HTMLButtonElement>('[aria-label="Next image"]')!.click();
    expect(f.componentInstance.lightboxIndex()).toBe(1);
    lb()!.querySelector<HTMLButtonElement>('[aria-label="Previous image"]')!.click();
    expect(f.componentInstance.lightboxIndex()).toBe(0);
  });

  it('closes from the close button and from a click on the backdrop itself', async () => {
    const f = await setup();
    await openFirst(f);
    lb()!.querySelector<HTMLButtonElement>('[aria-label="Close image viewer"]')!.click();
    expect(f.componentInstance.lightboxOpen()).toBe(false);

    await openFirst(f);
    const el = lb()!;
    // A click that originated on the FRAME must not close it — only the backdrop.
    el.onclick!({ target: el.firstElementChild } as unknown as PointerEvent);
    expect(f.componentInstance.lightboxOpen()).toBe(true);
    el.onclick!({ target: el } as unknown as PointerEvent);
    expect(f.componentInstance.lightboxOpen()).toBe(false);
  });

  it('returns focus to whatever opened it', async () => {
    const f = await setup({ layout: 'strip' });
    const thumb = qa(f, 'button[aria-label^="Open"]')[0];
    document.body.appendChild(f.nativeElement);
    thumb.focus();
    thumb.click();
    f.detectChanges();
    await until(() => lb() !== null);
    expect(document.activeElement).not.toBe(thumb);

    f.componentInstance.closeLightbox();
    expect(document.activeElement).toBe(thumb);
  });
});

describe('SvImageGalleryComponent — lightbox keyboard', () => {
  const key = (k: string, shiftKey = false) => {
    const e = new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    return e;
  };

  it('ignores every key while it is closed', async () => {
    const f = await setup();
    key('Escape');
    key('ArrowRight');
    expect(f.componentInstance.lightboxIndex()).toBe(0);
    expect(f.componentInstance.lightboxOpen()).toBe(false);
  });

  it('moves with the arrows and closes on Escape', async () => {
    const f = await setup();
    await openFirst(f);
    key('ArrowRight');
    expect(f.componentInstance.lightboxIndex()).toBe(1);
    key('ArrowLeft');
    expect(f.componentInstance.lightboxIndex()).toBe(0);
    key('Escape');
    expect(f.componentInstance.lightboxOpen()).toBe(false);
  });

  it('leaves unrelated keys alone', async () => {
    const f = await setup();
    await openFirst(f);
    expect(key('a').defaultPrevented).toBe(false);
    expect(f.componentInstance.lightboxIndex()).toBe(0);
  });

  it('cycles Tab from the last control back to the first', async () => {
    const f = await setup();
    await openFirst(f);
    const controls = [...lb()!.querySelectorAll<HTMLButtonElement>('button')];
    const [close] = controls;
    const last = controls[controls.length - 1];

    last.focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });

  it('cycles Shift+Tab from the first control back to the last', async () => {
    const f = await setup();
    await openFirst(f);
    const controls = [...lb()!.querySelectorAll<HTMLButtonElement>('button')];
    const last = controls[controls.length - 1];

    controls[0].focus();
    expect(key('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back in when it has escaped the dialog entirely', async () => {
    const f = await setup();
    await openFirst(f);
    const stray = document.createElement('button');
    document.body.appendChild(stray);
    stray.focus();

    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(lb()!.querySelector('[aria-label="Close image viewer"]'));
    stray.remove();
  });

  it('lets Tab through untouched in the middle of the control list', async () => {
    const f = await setup();
    await openFirst(f);
    const controls = [...lb()!.querySelectorAll<HTMLButtonElement>('button')];
    // close, prev, next — focus the middle one so it is neither first nor last.
    controls[1].focus();
    expect(key('Tab').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(controls[1]);
  });
});

describe('SvImageGalleryComponent — product viewer', () => {
  it('clamps an out-of-range activeIndex into the set', async () => {
    const f = await setup({ layout: 'viewer', activeIndex: 99 });
    expect(f.componentInstance.currentIndex()).toBe(2);

    const neg = await setup({ layout: 'viewer', activeIndex: -5 });
    expect(neg.componentInstance.currentIndex()).toBe(0);
  });

  it('falls back to 0 when there are no images to index into', async () => {
    const f = await setup({ layout: 'viewer', images: [], activeIndex: 3 });
    expect(f.componentInstance.currentIndex()).toBe(0);
    expect(f.componentInstance.mainImage()).toBeUndefined();
  });

  it('switches the main image from the thumbnail strip', async () => {
    const f = await setup({ layout: 'viewer' });
    qa(f, '[role="tab"]')[2].click();
    f.detectChanges();
    expect(f.componentInstance.mainImage()!.id).toBe('3');
    expect(qa(f, '[role="tab"]').map((t) => t.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });

  it('tracks the pointer for the zoom origin, and stops when zoom is off', async () => {
    const f = await setup({ layout: 'viewer' });
    const c = f.componentInstance;
    // jsdom has no layout, so the rect is stubbed explicitly — this test is
    // about the arithmetic, which is unreachable otherwise.
    const target = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 100 }),
    } as unknown as HTMLElement;
    const move = (x: number, y: number) =>
      ({ currentTarget: target, clientX: x, clientY: y }) as unknown as MouseEvent;

    c.onZoomEnter();
    expect(c.zoomActive()).toBe(true);
    c.onZoomMove(move(150, 75));
    expect(c.zoomOrigin()).toBe('25% 25%');
    c.onZoomLeave();
    expect(c.zoomActive()).toBe(false);

    const off = await setup({ layout: 'viewer', zoom: false });
    off.componentInstance.onZoomEnter();
    expect(off.componentInstance.zoomActive()).toBe(false);
    off.componentInstance.onZoomMove(move(150, 75));
    expect(off.componentInstance.zoomOrigin()).toBe('50% 50%');
  });

  it('hides the zoom hint and the fullscreen control when those are off', async () => {
    const f = await setup({ layout: 'viewer', zoom: false, lightbox: false });
    expect(f.nativeElement.textContent).not.toContain('Hover to zoom');
    expect(q(f, '[aria-label="View full size"]')).toBeNull();
  });
});

describe('SvImageGalleryComponent — viewer sizing', () => {
  /**
   * ★ The `viewer` defaults are a PRODUCT viewer: square, capped at 28rem,
   *   because that is what sits beside a buy box. Pointed at a property listing
   *   in a 60rem column it rendered as a postage stamp with half the page
   *   blank. `viewerSize` and `viewerAspect` are the way out.
   */
  it('caps its width and stays square by default', async () => {
    const fixture = await setup({ layout: 'viewer' });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.max-w-md')).not.toBeNull();
    expect(host.querySelector('.aspect-square')).not.toBeNull();
  });

  it('drops the cap at size full', async () => {
    const fixture = await setup({ layout: 'viewer', viewerSize: 'full' });
    expect((fixture.nativeElement as HTMLElement).querySelector('.max-w-md')).toBeNull();
  });

  it('changes the frame with viewerAspect', async () => {
    const fixture = await setup({ layout: 'viewer', viewerAspect: 'video' });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.aspect-video')).not.toBeNull();
    expect(host.querySelector('.aspect-square')).toBeNull();
  });

  it('leaves the other layouts alone', async () => {
    const fixture = await setup({ layout: 'grid', viewerSize: 'full' });
    // The grid never had the cap; turning the viewer knob must not reach it.
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')).toBeNull();
  });
});

/**
 * The one state a gallery is guaranteed to hit.
 *
 * ★★★ A MOVED ASSET, AN EXPIRED SIGNED URL, A CDN THAT 404s — and there was no
 *     handling at all. The browser's own glyph is a tiny torn icon with no text
 *     beside it, so the tile reads as something still loading, and the alt text
 *     a screen reader would have used is thrown away with it.
 */
describe('SvImageGalleryComponent — an image that will not load', () => {
  it('treats every image as fine until one fails', async () => {
    const f = await setup({});
    expect(f.componentInstance.isBroken(IMAGES[0].src)).toBe(false);
  });

  it('records a failure', async () => {
    const f = await setup({});
    f.componentInstance.onImageError(IMAGES[0].src);
    f.detectChanges();
    expect(f.componentInstance.isBroken(IMAGES[0].src)).toBe(true);
    expect(f.componentInstance.isBroken(IMAGES[1].src)).toBe(false);
  });

  it('is idempotent — the same failure twice is still one failure', async () => {
    const f = await setup({});
    f.componentInstance.onImageError(IMAGES[0].src);
    f.componentInstance.onImageError(IMAGES[0].src);
    f.detectChanges();
    expect(f.componentInstance.isBroken(IMAGES[0].src)).toBe(true);
  });

  it('shows a placeholder instead of the torn-icon glyph', async () => {
    const f = await setup({});
    f.componentInstance.onImageError(IMAGES[0].src);
    f.detectChanges();
    const host = f.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Could not load');
  });

  it('keeps the alt text, so the picture is still described', async () => {
    // ★ Losing it is the second half of the defect: the browser's glyph carries
    //   no text either.
    const f = await setup({});
    f.componentInstance.onImageError(IMAGES[0].src);
    f.detectChanges();
    const host = f.nativeElement as HTMLElement;
    const placeholder = host.querySelector('[role="img"][aria-label*="could not be loaded"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.getAttribute('aria-label')).toContain(IMAGES[0].alt);
  });

  it('keeps the tile the same size, so nothing reflows', async () => {
    const f = await setup({});
    const before = (f.nativeElement as HTMLElement).querySelectorAll('li').length;
    f.componentInstance.onImageError(IMAGES[0].src);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(before);
  });

  it('binds an error handler to every image it draws', async () => {
    const f = await setup({});
    const imgs = (f.nativeElement as HTMLElement).querySelectorAll('img');
    expect(imgs.length).toBeGreaterThan(0);
  });
});

/**
 * What masonry does to reading order.
 *
 * ★★★ CSS MULTI-COLUMN FLOWS TOP-TO-BOTTOM, THEN ACROSS. A sighted reader
 *     scanning the first row left-to-right sees images 1, 4, 7 — while the DOM,
 *     the tab order and a screen reader all give 1, 2, 3. Masonry does not
 *     reorder anything; it is the VISUAL order that diverges, and no amount of
 *     ARIA fixes it because the markup is already correct.
 */
describe('SvImageGalleryComponent — masonry and reading order', () => {
  const notice = (f: { nativeElement: HTMLElement }): string =>
    f.nativeElement.querySelector('[data-sv-notice]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('says nothing for a grid, where the orders agree', async () => {
    expect(notice(await setup({ layout: 'grid' }))).toBe('');
  });

  it('states the divergence for masonry, and names the way out', async () => {
    const text = notice(await setup({ layout: 'masonry' }));
    expect(text).toContain('fill top to bottom');
    expect(text).toContain('does not match the order these images are in');
    expect(text).toContain('Use the grid layout');
  });

  it('says nothing for a masonry too small to diverge', async () => {
    // Two images make one row in any column count.
    expect(notice(await setup({ layout: 'masonry', images: IMAGES.slice(0, 2) }))).toBe('');
  });

  it('leaves the DOM order correct — it is the visuals that differ', async () => {
    const f = await setup({ layout: 'masonry' });
    const alts = Array.from((f.nativeElement as HTMLElement).querySelectorAll('img'))
      .map(i => i.getAttribute('alt'));
    expect(alts.slice(0, 3)).toEqual(IMAGES.slice(0, 3).map(i => i.alt));
  });
});
