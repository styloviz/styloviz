import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvImageGalleryComponent, type GalleryImage } from './image-gallery.component';

/**
 * A selection that outlives the page it was made on.
 *
 * ★★★ THE COMPONENT NEVER PRUNES IT, AND THAT IS THE FEATURE. A gallery that
 * "tidied up" the selection to match the images currently bound would silently
 * delete the user's choices on every page turn — which is exactly the
 * persistence this is supposed to provide, destroyed by the tidying.
 *
 * What comes with keeping them is the duty to show them.
 */

const page = (from: number, to: number): GalleryImage[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: `img-${from + i}`,
    src: `/demo/photo-card1.svg`,
    alt: `Photo ${from + i}`,
  }));

async function gallery(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvImageGalleryComponent, {
    inputs: { images: page(1, 4), selectable: true, ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const strip = (f: { nativeElement: unknown }) =>
  el(f).querySelector('[data-sv-selection-summary]');

describe('SvImageGalleryComponent — selection across pages', () => {
  it('shows nothing when nothing is selected', async () => {
    const f = await gallery();
    expect(strip(f)).toBeNull();
  });

  it('shows nothing when the gallery is not selectable', async () => {
    const f = await gallery({ selectable: false, selected: new Set(['img-1']) });
    expect(strip(f)).toBeNull();
  });

  it('counts the whole selection, not the visible part', async () => {
    const f = await gallery({ selected: new Set(['img-1', 'img-2']) });
    expect(strip(f)?.textContent).toContain('2 selected');
    // Everything selected is on screen, so there is nothing extra to disclose.
    expect(strip(f)?.textContent).not.toContain('not on this page');
  });

  it('keeps the selection when the page changes', async () => {
    const f = await gallery({ selected: new Set(['img-1', 'img-2']) });
    f.componentRef.setInput('images', page(5, 8));
    f.detectChanges();

    // ★ Not pruned. Pruning here is what would delete the user's choices on
    //   every page turn.
    expect(f.componentInstance.selectedCount()).toBe(2);
  });

  it('discloses the part of the selection that is off this page', async () => {
    const f = await gallery({ selected: new Set(['img-1', 'img-2']) });
    f.componentRef.setInput('images', page(2, 5));
    f.detectChanges();

    // ★★★ img-1 is selected and not on screen. Without this the gallery shows
    //     one tick while "Delete selected" acts on two.
    expect(f.componentInstance.selectedOffPage()).toBe(1);
    expect(strip(f)?.textContent).toContain('2 selected');
    expect(strip(f)?.textContent).toContain('1 not on this page');
  });

  it('counts every hidden one when none of the page is selected', async () => {
    const f = await gallery({ selected: new Set(['img-1', 'img-2', 'img-3']) });
    f.componentRef.setInput('images', page(9, 12));
    f.detectChanges();
    expect(strip(f)?.textContent).toContain('3 not on this page');
  });

  it('clears the hidden part too', async () => {
    const f = await gallery({ selected: new Set(['img-1', 'img-2']) });
    f.componentRef.setInput('images', page(9, 12));
    f.detectChanges();

    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    f.detectChanges();

    // A "Clear" that only cleared what was on screen would leave a selection
    // the user believes they just emptied.
    expect(f.componentInstance.selectedCount()).toBe(0);
    expect(strip(f)).toBeNull();
  });

  it('publishes the change, so a host holding the set across navigation sees it', async () => {
    const seen: number[] = [];
    const f = await gallery();
    // `selected` is a `model`, which is what makes the HOST the owner of the set
    // — and therefore what makes persistence across navigation possible at all.
    // ★ The ModelSignal itself is the OutputRef — there is no separate
    // `selectedChange` property on the instance, which is the whole reason a
    // `model` is one fact with one way to observe it.
    f.componentInstance.selected.subscribe((s: Set<string>) => seen.push(s.size));

    f.componentInstance.toggleSelect('img-1');
    f.detectChanges();
    f.componentInstance.clearSelection();
    f.detectChanges();

    expect(seen).toEqual([1, 0]);
  });

  it('does nothing on a clear with nothing to clear', async () => {
    const seen: number[] = [];
    const f = await gallery();
    // ★ The ModelSignal itself is the OutputRef — there is no separate
    // `selectedChange` property on the instance, which is the whole reason a
    // `model` is one fact with one way to observe it.
    f.componentInstance.selected.subscribe((s: Set<string>) => seen.push(s.size));

    f.componentInstance.clearSelection();
    f.detectChanges();
    // An empty write would still emit, telling a host its selection changed
    // when it did not.
    expect(seen).toEqual([]);
  });
});
