import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { svIsRtl } from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  warnOnDuplicateItemKeys,
  type SvDataError,
} from '@styloviz/core/data';
import { injectSvLabels, SvLabelPipe, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { svStackedPopup, createFocusScope } from '@styloviz/core/overlay';
import { svAttrSelector } from '@styloviz/core/security';
import { SV_DISPLAY_LABELS } from '../display.labels';
import { SvIconComponent } from '@styloviz/icons';

import { registerImageGalleryIcons } from './image-gallery.component.icons';
export type GalleryLayout  = 'grid' | 'masonry' | 'strip' | 'viewer';

/**
 * How much room the `viewer` layout takes, and what shape its main image is.
 *
 * ★★ THE DEFAULTS ARE A PRODUCT VIEWER: a square image capped at `max-w-md`,
 *    because that is what sits beside a buy box. A property, a car, a room or a
 *    landscape is none of those things — capped at 28rem inside a 60rem column
 *    it renders as a postage stamp with half the page blank, which is exactly
 *    what happened the first time this layout was pointed at a listing page.
 *    `size: 'full'` drops the cap; `aspect` picks the frame.
 */
export type GalleryViewerSize   = 'compact' | 'full';
export type GalleryViewerAspect = 'square' | 'video' | 'wide' | 'portrait';
export type GalleryColumns = 2 | 3 | 4 | 5;

export interface GalleryImage {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly title?: string;
  readonly author?: string;
  readonly tags?: string[];
  readonly aspectRatio?: string; // e.g. '16/9' | '4/3' | '3/4'
  /**
   * Responsive candidates, e.g. `'/p/1-400.jpg 400w, /p/1-1600.jpg 1600w'`.
   * Without it every thumbnail downloads the full-size `src`; with it the
   * browser picks a candidate for the tile's rendered width (see `sizes`).
   */
  readonly srcset?: string;
  /**
   * The rendered width hint that goes with `srcset`. Unset, the gallery
   * derives one from its layout and `columns` — e.g. `(min-width: 768px) 25vw,
   * (min-width: 640px) 33vw, 50vw` for a four-column grid.
   */
  readonly sizes?: string;
}

/**
 * The sample set this component used to default to.
 *
 * Exported and bound by the showcase rather than baked in: an unbound
 * component that renders convincing content is indistinguishable from a wired
 * one that is silently receiving nothing — and the fixture shipped in every
 * buyer's bundle.
 */
export const DEMO_IMAGES: GalleryImage[] = [ // sv-i18n-ignore: demo sample data the host replaces
  { id: '1', src: '/demo/photo-a1.svg',   alt: 'Mountain landscape',    title: 'Mountain at Dusk',   author: 'Alex P.',  tags: ['nature'],  aspectRatio: '16/9' }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '2', src: '/demo/photo-b2.svg',   alt: 'City skyline portrait', title: 'Urban Skyline',      author: 'Maria S.', tags: ['city'],    aspectRatio: '2/3'  }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '3', src: '/demo/photo-c3.svg',   alt: 'Ocean waves',           title: 'Pacific Waves',      author: 'James K.', tags: ['ocean'],   aspectRatio: '3/2'  }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '4', src: '/demo/photo-d4.svg',   alt: 'Forest path portrait',  title: 'Deep Forest',        author: 'Leila N.', tags: ['nature'],  aspectRatio: '3/4'  }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '5', src: '/demo/photo-e5.svg',   alt: 'Desert dunes',          title: 'Sahara Dunes',       author: 'Omar R.',  tags: ['desert'],  aspectRatio: '16/9' }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '6', src: '/demo/photo-f6.svg',   alt: 'Autumn leaves',         title: 'Fall Colours',       author: 'Yuki T.',  tags: ['nature'],  aspectRatio: '4/3'  }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '7', src: '/demo/photo-g7.svg',   alt: 'Snowy peaks',           title: 'Alpine Winter',      author: 'Nico B.',  tags: ['winter'],  aspectRatio: '4/3'  }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '8', src: '/demo/photo-h8.svg',   alt: 'Jungle canopy portrait',title: 'Jungle Canopy',      author: 'Aisha M.', tags: ['nature'],  aspectRatio: '2/3'  },
];

@Component({
  selector: 'sv-image-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent, SvIconComponent, SvLabelPipe],
  templateUrl: './image-gallery.component.html',
})
export class SvImageGalleryComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerImageGalleryIcons();

  /** @internal Accessible names — English unless `provideSvLabels({ display })` says otherwise. */
  protected readonly labels = injectSvLabels('display', SV_DISPLAY_LABELS);
  /** The kit's locale — fills the selection strip's sentence. */
  private readonly locale = svLocale();

  // ── Async state ───────────────────────────────────────────────────────────

  /** True while the images are being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Copy for the no-data state. @default 'No images yet' */
  readonly emptyMessage = input<string>(this.labels.noImages);

  /** True when the emptiness is caused by a filter rather than an empty set. */
  readonly filtered = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  /** Nothing to show. Distinct from `loading`, which is not yet knowing. */
  protected readonly isEmpty = computed(() => this.images().length === 0);

  private readonly doc     = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);

  /** Images to display (src, alt, optional caption). */
  images     = input<readonly GalleryImage[]>([]);
  /** Layout: grid, masonry or strip. @default 'grid' */
  layout     = input<GalleryLayout>('grid');
  /**
   * What this gallery is, e.g. `'Product photos'` — names the list of images.
   *
   * ★ Two galleries on one product page (the shots and the customer uploads) both
   *   announce as an unnamed list of N items without this. Left unset, no name is
   *   invented: `<ul role="list">` already gives a listener the count and the
   *   boundaries.
   *
   * @default ''
   */
  ariaLabel  = input<string>('');
  /** Number of columns (2–5). @default 3 */
  columns    = input<GalleryColumns>(3);
  /** Open images in a full-screen lightbox on click. @default true */
  lightbox   = input<boolean>(true);
  /** Show captions under images. @default true */
  captions   = input<boolean>(true);
  /** Enable multi-select mode. @default false */
  selectable = input<boolean>(false);
  /** Product-viewer: enable hover-zoom on the main image. @default true */
  zoom       = input<boolean>(true);

  /**
   * Which images failed to load, by `src`.
   *
   * ★★★ A BROKEN IMAGE IS THE ONE STATE A GALLERY IS GUARANTEED TO HIT — a moved
   *     asset, an expired signed URL, a CDN that 404s — and it had no handling at
   *     all. The browser's own broken-image glyph is a tiny torn icon with no
   *     text beside it, so the tile reads as an image that has not loaded yet and
   *     never will, and the alt text a screen reader would have used is thrown
   *     away with it.
   */
  private readonly failed = signal<ReadonlySet<string>>(new Set());

  /** True when this image could not be loaded. */
  isBroken(src: string): boolean {
    return this.failed().has(src);
  }

  /** Record a load failure so the tile can show something honest instead. */
  onImageError(src: string): void {
    this.failed.update(prev => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }

  /**
   * What the layout does to reading order, in words.
   *
   * ★★★ CSS MULTI-COLUMN FLOWS TOP-TO-BOTTOM, THEN ACROSS. So a sighted reader
   *     scanning left-to-right across the first row sees images 1, 4, 7 — while
   *     the DOM, the tab order and a screen reader all give 1, 2, 3. Masonry
   *     does not reorder anything; it is the VISUAL order that diverges, and no
   *     amount of ARIA fixes it because the markup is already correct.
   *
   *     The honest options were to preserve order (impossible with CSS columns),
   *     to reimplement masonry as absolutely-positioned JS layout (a large cost
   *     for a look), or to say so and offer `grid`. This says so.
   */
  readonly layoutNote = computed<string | null>(() =>
    this.layout() === 'masonry' && this.images().length > 2
      ? this.labels.masonryOrderNote
      : null,
  );
  /** Product-viewer: magnification factor for the hover-zoom. @default 2 */
  zoomLevel  = input<number>(2);

  /** Width of the `viewer` layout. `compact` caps it at 28rem. @default 'compact' */
  viewerSize = input<GalleryViewerSize>('compact');

  /** Frame of the `viewer` layout's main image. @default 'square' */
  viewerAspect = input<GalleryViewerAspect>('square');

  /**
   * Literal class strings, looked up rather than assembled.
   *
   * Tailwind's compiler scans source text for whole class names; a class built
   * at runtime from a token never reaches the stylesheet, so `aspect-[21/9]`
   * has to appear here in full to exist at all.
   */
  readonly viewerWidthClass = computed(() =>
    this.viewerSize() === 'full' ? 'w-full' : 'w-full max-w-md',
  );

  readonly viewerAspectClass = computed(
    () =>
      ({
        square: 'aspect-square',
        video: 'aspect-video',
        wide: 'aspect-[21/9]',
        portrait: 'aspect-[3/4]',
      })[this.viewerAspect()],
  );

  /** Emitted with the clicked image. */
  imageClick      = output<GalleryImage>();

  /**
   * Which images are selected (two-way).
   *
   * Bind it to preselect a saved set or clear the selection after acting on it;
   * `(selectedChange)` emits on every change.
   */
  readonly selected = model<Set<string>>(new Set());

  /**
   * How many images are selected in total — across every page, not just this one.
   *
   * ★★★ AND THE COMPONENT DELIBERATELY NEVER PRUNES IT. A gallery that "tidied
   * up" the selection to match the images currently bound would silently delete
   * the user's choices on every page turn — which is precisely the persistence
   * the audit asked for, destroyed by the tidying. Not pruning is the feature.
   *
   * The obligation that comes with it is disclosure: see {@link selectedOffPage}.
   */
  readonly selectedCount = computed(() => this.selected().size);

  /**
   * Selected images that are not on this page.
   *
   * ★★★ THE HAZARD, AND IT IS THE SAME SHAPE AS THE TRANSFER PANE'S. Select
   * twelve on page one, turn to page two, and the gallery shows none of them
   * ticked while "Delete selected" still acts on all twelve. The selection
   * surviving the page turn is correct; the user not being able to see that it
   * did is the bug.
   */
  readonly selectedOffPage = computed(() => {
    const onPage = new Set(this.renderImages().map((i) => i.id));
    let n = 0;
    for (const id of this.selected()) if (!onPage.has(id)) n++;
    return n;
  });

  /** One sentence for the selection strip, or `''` when nothing is selected. */
  readonly selectionSummary = computed(() => {
    const total = this.selectedCount();
    if (total === 0) return '';
    const off = this.selectedOffPage();
    return off > 0
      ? svFormatLabel(this.labels.gallerySelectedOffPage, { n: String(total), off: String(off) }, this.locale)
      : svFormatLabel(this.labels.gallerySelected, { n: String(total) }, this.locale);
  });

  /** Drop the whole selection, including the part that is off this page. */
  clearSelection(): void {
    if (this.selected().size === 0) return;
    this.selected.set(new Set());
  }

  readonly lightboxOpen  = signal(false);
  readonly lightboxIndex = signal(0);

  readonly lightboxImage = computed(() => this.images()[this.lightboxIndex()]);
  readonly total         = computed(() => this.images().length);

  /**
   * `images()` on its way to the template, with a dev-mode duplicate-key check.
   *
   * `GalleryImage.id` is required by the type but cannot be required to be UNIQUE,
   * and here a collision costs twice: `track img.id` empties the gallery with
   * NG0955, and `selected` is a set of ids, so two images sharing one would tick
   * and untick together. In production this is a passthrough.
   */
  readonly renderImages = computed<readonly GalleryImage[]>(() => {
    const images = this.images();
    warnOnDuplicateItemKeys(images, 'id', 'sv-image-gallery [images]');
    return images;
  });

  // ── Product-viewer (main image + thumbnail strip + zoom) ────────────────────
  /** Optional externally-controlled active image (viewer layout). Clamps to range; resets on image change. */
  readonly activeIndex = input<number>(0);

  /** Editable local copy, seeded from the `activeIndex` input. */
  readonly currentIndex = linkedSignal<{ images: readonly GalleryImage[]; seed: number }, number>({
    source: () => ({ images: this.images(), seed: this.activeIndex() }),
    computation: ({ images, seed }) => (images.length ? Math.min(Math.max(seed, 0), images.length - 1) : 0),
  });
  readonly mainImage   = computed(() => this.images()[this.currentIndex()] ?? this.images()[0]);
  readonly zoomActive  = signal(false);
  readonly zoomOrigin  = signal('50% 50%');

  setActive(i: number): void { this.currentIndex.set(i); }
  onZoomEnter(): void { if (this.zoom()) this.zoomActive.set(true); }
  onZoomLeave(): void { this.zoomActive.set(false); }
  onZoomMove(e: MouseEvent): void {
    if (!this.zoom()) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    this.zoomOrigin.set(`${x}% ${y}%`);
  }

  // ── Lightbox rendered into document.body to escape any ancestor containment.
  //    Built with safe DOM APIs (createElement / textContent / setAttribute) —
  //    never innerHTML — so image-supplied alt/title/author can't inject markup.
  private _lbEl: HTMLDivElement | null = null;
  /** Focusable controls inside the lightbox, for the Tab focus-trap. */
  private _lbFocusables: HTMLElement[] = [];
  /** The image the lightbox was opened on — compared with the last one viewed at close. */
  private _openedIndex = -1;
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * `X-12`: where focus goes when the lightbox closes. The control that opened
   * it; if that control has gone, the nearest part of the gallery that
   * survived; else the gallery root — never `<body>`. `close` overrides the
   * opener with the thumbnail of the image last VIEWED when the reader paged
   * away from the one they opened.
   */
  private readonly _lbScope = createFocusScope({
    within: () => this._lbEl,
    fallback: () => this._host.nativeElement,
    document: this.doc,
  });

  constructor() {
    // The imperative lightbox node follows the stack's z-index while open (`X-4`).
    effect(() => {
      const z = this._stackedPopup.zIndex();
      if (z !== null && this._lbEl) this._lbEl.style.zIndex = String(z);
    });
    afterNextRender(() => {
      const el = this.doc.createElement('div');
      el.style.display = 'none';
      this.doc.body.appendChild(el);
      this._lbEl = el;
      this.destroy.onDestroy(() => el.remove());
    });
  }

  openLightbox(i: number): void {
    // An index that is not in the set is not a click on anything — a stale
    // handler after the list shrank would otherwise emit `undefined`.
    const img = this.images()[i];
    if (!img) return;

    // ★ `[lightbox]="false"` is how a host takes the click over itself, and in
    // the `strip` layout the whole thumbnail is a click target that is NOT
    // gated on `lightbox()`. Returning before the emit meant that clicking an
    // image in that configuration did nothing at all — no viewer, and no event
    // for the host to act on either.
    if (!this.lightbox()) {
      this.imageClick.emit(img);
      return;
    }

    this._lbScope.capture();
    this._openedIndex = i;
    this.lightboxIndex.set(i);
    this.lightboxOpen.set(true);
    this.imageClick.emit(img);
    this._renderLightbox();
  }

  closeLightbox(): void {
    if (!this.lightboxOpen()) return;
    this.lightboxOpen.set(false);
    if (this._lbEl) this._lbEl.style.display = 'none';
    this._lbFocusables = [];

    // The reader paged to another image: return to THAT image's thumbnail, so
    // the gallery shows them where they are. The viewer layout also makes it
    // the active image. Otherwise the scope restores the opener.
    const viewed = this.lightboxIndex();
    const img = this.images()[viewed];
    if (img && viewed !== this._openedIndex) {
      if (this.layout() === 'viewer') this.currentIndex.set(viewed);
      const thumb = this._host.nativeElement.querySelector<HTMLElement>(
        svAttrSelector('data-sv-lightbox-trigger', img.id),
      );
      thumb?.focus();
    }
    this._openedIndex = -1;
    this._lbScope.restore();
  }

  lightboxPrev(): void {
    this.lightboxIndex.update(i => (i - 1 + this.total()) % this.total());
    this._renderLightbox();
  }

  lightboxNext(): void {
    this.lightboxIndex.update(i => (i + 1) % this.total());
    this._renderLightbox();
  }

  /**
   * On the overlay stack while open (`X-4`): Escape belongs to the topmost
   * surface only, so a dialog opened over this one takes it first.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.lightboxOpen(),
    layer: 'modal',
  });

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.lightboxOpen()) return;
    // Only the topmost surface acts on keys (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (e.key === 'Escape')     { this.closeLightbox(); return; }
    // Left/Right follow what the user sees: under dir="rtl" the next image's
    // button sits on the left, so ArrowLeft is "next" there.
    const rtl = svIsRtl(this._host.nativeElement);
    if (e.key === 'ArrowRight') { if (rtl) this.lightboxPrev(); else this.lightboxNext(); return; }
    if (e.key === 'ArrowLeft')  { if (rtl) this.lightboxNext(); else this.lightboxPrev(); return; }
    if (e.key === 'Tab')        this._trapFocus(e);
  }

  /** Keep Tab focus cycling within the modal lightbox. */
  private _trapFocus(e: KeyboardEvent): void {
    const items = this._lbFocusables;
    if (!items.length) return;
    const first = items[0];
    const last  = items[items.length - 1];
    const active = this.doc.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    else if (!items.includes(active as HTMLElement)) { e.preventDefault(); first.focus(); }
  }

  /** Build the lightbox via safe DOM nodes (no HTML string interpolation). */
  private _renderLightbox(): void {
    const el = this._lbEl;
    if (!el) return;
    const img = this.images()[this.lightboxIndex()];
    if (!img) return;

    const idx   = this.lightboxIndex();
    const total = this.total();
    const d     = this.doc;

    el.replaceChildren();
    el.style.cssText =
      `position:fixed;inset:0;z-index:${this._stackedPopup.zIndex() ?? 9999};display:flex;align-items:center;` +
      'justify-content:center;background:rgba(0,0,0,0.92);backdrop-filter:blur(6px);padding:1.5rem';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    // The lightbox lives on <body>, outside any `dir` the gallery sits in: carry
    // the gallery's direction so the inline-start/end controls mirror with it.
    el.setAttribute('dir', svIsRtl(this._host.nativeElement) ? 'rtl' : 'ltr');
    el.setAttribute('aria-label', img.title ? svFormatLabel(this.labels.imageViewerTitled, { title: img.title }) : this.labels.imageViewer);

    const frame = d.createElement('div');
    frame.style.cssText =
      'position:relative;max-width:900px;max-height:90vh;width:100%;display:flex;flex-direction:column;gap:1rem';

    const picture = d.createElement('img');
    if (img.srcset) {
      // The lightbox frame is at most 900px wide, so ask for that much and no more.
      picture.srcset = img.srcset;
      picture.sizes = img.sizes ?? '(min-width: 948px) 900px, calc(100vw - 3rem)';
    }
    picture.src = img.src;                 // property assignment — not parsed as HTML
    picture.alt = img.alt;                 // safe: set as text attribute
    picture.style.cssText =
      'max-height:80vh;max-width:100%;object-fit:contain;border-radius:12px;' +
      'box-shadow:0 32px 80px rgba(0,0,0,0.6);margin:auto;display:block';
    frame.appendChild(picture);

    if (img.title) {
      const cap = d.createElement('div');
      cap.style.textAlign = 'center';
      const t = d.createElement('p');
      t.textContent = img.title;           // safe text
      t.style.cssText = 'font-size:14px;font-weight:600;color:white;margin:0';
      cap.appendChild(t);
      if (img.author) {
        const a = d.createElement('p');
        a.textContent = img.author;        // safe text
        a.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);margin:4px 0 0';
        cap.appendChild(a);
      }
      frame.appendChild(cap);
    }

    const closeBtn = this._makeLbButton('✕', this.labels.closeImageViewer,
      'top:-16px;inset-inline-end:-16px;width:36px;height:36px;font-size:18px');
    closeBtn.addEventListener('click', () => this.closeLightbox());
    frame.appendChild(closeBtn);

    this._lbFocusables = [closeBtn];

    if (total > 1) {
      // ★★ THE ARROWS SAT AT A FIXED -56px OUTSIDE THE FRAME, and below ~480px
      //    the frame fills the viewport, so both were off-screen — on exactly
      //    the phones where a swipe-less lightbox needs them most. The offset is
      //    now the free space beside the frame (half of what the viewport has
      //    left over) less an 8px margin, capped at the old 56px: outside the
      //    frame on a desktop, over the picture's edge on a phone, on-screen
      //    always.
      const offset = 'calc(-1 * min(56px, (100vw - 100%) / 2 - 8px))';
      const prevBtn = this._makeLbButton('‹', this.labels.previousImage,
        `inset-inline-start:${offset};top:50%;transform:translateY(-50%);width:44px;height:44px;font-size:20px`);
      prevBtn.setAttribute('data-sv-lightbox-prev', '');
      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.lightboxPrev(); });
      const nextBtn = this._makeLbButton('›', this.labels.nextImage,
        `inset-inline-end:${offset};top:50%;transform:translateY(-50%);width:44px;height:44px;font-size:20px`);
      nextBtn.setAttribute('data-sv-lightbox-next', '');
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.lightboxNext(); });
      frame.appendChild(prevBtn);
      frame.appendChild(nextBtn);
      this._lbFocusables.push(prevBtn, nextBtn);
    }

    const counter = d.createElement('div');
    counter.textContent = `${idx + 1} / ${total}`;
    counter.setAttribute('aria-hidden', 'true');
    counter.style.cssText =
      // sv-physical: centring — left:50% with translateX(-50%) is direction-neutral
      'position:absolute;bottom:-36px;left:50%;transform:translateX(-50%);' +
      'background:rgba(255,255,255,0.1);border-radius:999px;padding:3px 12px;' +
      'font-size:11px;color:rgba(255,255,255,0.7);white-space:nowrap';
    frame.appendChild(counter);

    el.appendChild(frame);
    el.onclick = (e) => { if (e.target === el) this.closeLightbox(); };

    // Move focus into the dialog so keyboard users land on a control.
    closeBtn.focus();
  }

  /** Create a styled, labelled lightbox control button. */
  private _makeLbButton(glyph: string, label: string, extra: string): HTMLButtonElement {
    const b = this.doc.createElement('button');
    b.type = 'button';
    b.textContent = glyph;
    b.setAttribute('aria-label', label);
    // The attribute, not `style.cssText`: the offsets use CSS math (`min()`),
    // and the attribute is the declaration exactly as written.
    b.setAttribute(
      'style',
      'position:absolute;z-index:1;border-radius:50%;background:rgba(0,0,0,0.45);border:none;' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;color:white;' + extra,
    );
    return b;
  }

  toggleSelect(id: string): void {
    this.selected.update(s => {
      const n = new Set(s);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  }

  isSelected(id: string): boolean { return this.selected().has(id); }

  // ── Grid layout classes ───────────────────────────────────────────────────────

  readonly gridClass = computed(() => {
    const cols: Record<GalleryColumns, string> = {
      2: 'grid-cols-2',
      3: 'grid-cols-2 sm:grid-cols-3',
      4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
      5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
    };
    return `grid gap-2.5 ${cols[this.columns()]}`;
  });

  /**
   * The `sizes` a tile reports when its image has a `srcset` and no `sizes`
   * of its own — the column fractions the grid and masonry classes lay out,
   * so the browser fetches a thumbnail-sized candidate, not the full image.
   */
  readonly tileSizes = computed(() => {
    const byColumns: Record<GalleryColumns, string> = {
      2: '50vw',
      3: '(min-width: 640px) 33vw, 50vw',
      4: '(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw',
      5: '(min-width: 768px) 20vw, (min-width: 640px) 33vw, 50vw',
    };
    return byColumns[this.columns()];
  });

  /** `sizes` for a strip tile, the viewer's main image and a viewer thumbnail (used when an image has `srcset` and no `sizes`). */
  readonly stripSizes = '20rem';
  readonly mainSizes = '(min-width: 1024px) 50vw, 100vw';
  readonly thumbSizes = '6rem';

  readonly masonryClass = computed(() => {
    const cols: Record<GalleryColumns, string> = {
      2: 'columns-2',
      3: 'columns-2 sm:columns-3', // sv-i18n-ignore: Tailwind classes
      4: 'columns-2 sm:columns-3 md:columns-4', // sv-i18n-ignore: Tailwind classes
      5: 'columns-2 sm:columns-3 md:columns-5', // sv-i18n-ignore: Tailwind classes
    };
    return cols[this.columns()];
  });
}
