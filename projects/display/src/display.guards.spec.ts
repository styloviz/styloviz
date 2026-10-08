import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { quietFor, until } from '@testing/async';
import { SvDndListComponent, type DndItem, type DndReorderEvent } from './dnd-list/dnd-list.component';
import { SvImageGalleryComponent, type GalleryImage } from './image-gallery/image-gallery.component';

/**
 * Guards that only fire when the world moves under the component: a lightbox
 * closed before it was ever opened, a Tab pressed while there is nothing
 * focusable in it, a drop whose drag index no longer exists because the list
 * shrank mid-gesture, and a rollback handed back after a newer move.
 */

// ── sv-image-gallery ─────────────────────────────────────────────────────────

const IMAGES: GalleryImage[] = [
  { id: '1', src: '/a.png', alt: 'Alpha' },
  { id: '2', src: '/b.png', alt: 'Beta' },
];

describe('SvImageGalleryComponent — lightbox guards', () => {
  async function setup(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvImageGalleryComponent, {
      inputs: { images: IMAGES, ...inputs },
    });
    fixture.detectChanges();
    return fixture;
  }

  it('is safe to close a lightbox that was never opened', async () => {
    const f = await setup();
    expect(() => f.componentInstance.closeLightbox()).not.toThrow();
    expect(f.componentInstance.lightboxOpen()).toBe(false);
  });

  it('ignores an index that is no longer in the set', async () => {
    // A stale click handler after the list shrank. Opening on it would emit
    // `undefined` to the host and render a lightbox around nothing.
    const f = await setup();
    const seen: GalleryImage[] = [];
    f.componentInstance.imageClick.subscribe((i) => seen.push(i));
    f.componentInstance.openLightbox(99);
    f.detectChanges();
    expect(f.componentInstance.lightboxOpen()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('ignores an empty gallery', async () => {
    const f = await setup({ images: [] });
    f.componentInstance.openLightbox(0);
    f.detectChanges();
    expect(f.componentInstance.lightboxOpen()).toBe(false);
  });

  it('does not trap Tab when the lightbox is shut', async () => {
    await setup();
    const before = document.activeElement;
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    // Assert the negative: the page's own tab order must be untouched.
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  it('moves between images and wraps at both ends', async () => {
    const f = await setup();
    f.componentInstance.openLightbox(0);
    f.detectChanges();
    expect(f.componentInstance.lightboxIndex()).toBe(0);

    f.componentInstance.lightboxPrev();
    expect(f.componentInstance.lightboxIndex()).toBe(IMAGES.length - 1);
    f.componentInstance.lightboxNext();
    expect(f.componentInstance.lightboxIndex()).toBe(0);
  });
});

// ── sv-dnd-list ──────────────────────────────────────────────────────────────

const ITEMS: DndItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

const dragEvent = (type: string) =>
  new Event(type, { bubbles: true, cancelable: true }) as unknown as DragEvent;

describe('SvDndListComponent — a drop whose source row is gone', () => {
  async function setup(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDndListComponent, {
      inputs: { items: ITEMS, ...inputs },
    });
    return fixture;
  }

  it('reorders nothing and announces nothing when the dragged index no longer exists', async () => {
    // The list can shrink under a drag — another user's delete arriving over a
    // socket, a filter narrowing. `splice(from, 1)` then removes nothing, and
    // re-inserting `undefined` would put a hole in the list.
    const f = await setup();
    const c = f.componentInstance;
    const events: DndReorderEvent[] = [];
    c.reordered.subscribe((e) => events.push(e));

    c.onDragStart(99); // an index that is not in the list
    c.onDrop(dragEvent('drop'), 0);
    await quietFor();
    f.detectChanges();

    expect(c.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
    // Assert the negative, after a window in which an announcement would have
    // landed: there is nothing to announce, so nothing may be announced.
    expect(c.liveMessage()).toBe('');
    // The reorder still reports (the list object is new), but nothing moved.
    expect(events[0]?.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('still reorders and announces for a drag that is in range', async () => {
    const f = await setup();
    const c = f.componentInstance;
    c.onDragStart(0);
    c.onDrop(dragEvent('drop'), 2);
    // The announcement is cleared and re-set in a microtask, so that a repeat
    // of the same sentence is still read out; wait for it rather than for a
    // fixed delay.
    await until(() => c.liveMessage() !== '', { label: 'the move announcement' });
    f.detectChanges();
    expect(c.items().map((i) => i.id)).toEqual(['b', 'c', 'a']);
    const live = (f.nativeElement as HTMLElement).querySelector('[aria-live]');
    expect(live?.textContent).toContain('Alpha moved to position 3 of 3');
  });
});

describe('SvDndListComponent — a stale rollback in production', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDndListComponent, { inputs: { items: ITEMS } });
    return fixture;
  }

  it('refuses the rollback and says why in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const f = await setup();
      const c = f.componentInstance;
      const events: DndReorderEvent[] = [];
      c.reordered.subscribe((e) => events.push(e));

      c.onDragStart(0);
      c.onDrop(dragEvent('drop'), 1); // move #1
      c.onDragStart(0);
      c.onDrop(dragEvent('drop'), 2); // move #2, supersedes it
      const afterSecond = c.items().map((i) => i.id);

      events[0].rollback(); // the first save failed, too late
      f.detectChanges();

      // Restoring the first order would silently undo the second move too.
      expect(c.items().map((i) => i.id)).toEqual(afterSecond);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('rollback() ignored');
    } finally {
      warn.mockRestore();
    }
  });

  it('refuses it just as firmly in a production build, but silently', async () => {
    // `ngDevMode` is false in a production bundle. The behaviour must not
    // change with the build mode; only the console message goes away.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', false);
    try {
      const f = await setup();
      const c = f.componentInstance;
      const events: DndReorderEvent[] = [];
      c.reordered.subscribe((e) => events.push(e));

      c.onDragStart(0);
      c.onDrop(dragEvent('drop'), 1);
      const afterFirst = c.items().map((i) => i.id);
      c.onDragStart(0);
      c.onDrop(dragEvent('drop'), 2);
      const afterSecond = c.items().map((i) => i.id);
      expect(afterSecond).not.toEqual(afterFirst);

      events[0].rollback();
      f.detectChanges();

      expect(c.items().map((i) => i.id)).toEqual(afterSecond);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('accepts the rollback while it is still the newest move', async () => {
    const f = await setup();
    const c = f.componentInstance;
    const events: DndReorderEvent[] = [];
    c.reordered.subscribe((e) => events.push(e));

    c.onDragStart(0);
    c.onDrop(dragEvent('drop'), 2);
    expect(c.items().map((i) => i.id)).toEqual(['b', 'c', 'a']);

    events[0].rollback();
    f.detectChanges();
    expect(c.items().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
