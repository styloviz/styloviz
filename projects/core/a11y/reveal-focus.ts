import { Directive, ElementRef, inject } from '@angular/core';

/** Which edge of its scroller a sticky band holds. `start`/`end` follow the writing direction. */
export type SvStickySide = 'top' | 'bottom' | 'start' | 'end';

/** A box in viewport coordinates — the parts of a `DOMRect` this needs. */
export interface SvBox {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** One sticky band over the scroller, with the edge it holds. */
export interface SvStickyBand {
  readonly side: SvStickySide;
  readonly box: SvBox;
}

const SIDES: ReadonlySet<string> = new Set(['top', 'bottom', 'start', 'end']);

/**
 * How far to scroll so `target` clears every band that covers it (WCAG 2.2
 * SC 2.4.11, Focus Not Obscured).
 *
 * A band only counts when it actually overlaps the target on the other axis —
 * a pinned first column does not hide a cell three columns over. A negative
 * `dy` scrolls up (the target is under a top band), a positive one down; `dx`
 * likewise in physical pixels, so `start`/`end` are resolved with `rtl`.
 */
export function svUnobscuredDelta(target: SvBox, bands: readonly SvStickyBand[], rtl = false): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  for (const { side, box } of bands) {
    const crossesX = box.left < target.right && box.right > target.left;
    const crossesY = box.top < target.bottom && box.bottom > target.top;
    const physical = side === 'start' ? (rtl ? 'right' : 'left') : side === 'end' ? (rtl ? 'left' : 'right') : side;
    if (physical === 'top' && crossesX && target.top < box.bottom) dy = Math.min(dy, target.top - box.bottom);
    else if (physical === 'bottom' && crossesX && target.bottom > box.top) dy = Math.max(dy, target.bottom - box.top);
    else if (physical === 'left' && crossesY && target.left < box.right) dx = Math.min(dx, target.left - box.right);
    else if (physical === 'right' && crossesY && target.right > box.left) dx = Math.max(dx, target.right - box.left);
  }
  return { dx, dy };
}

/**
 * Keeps keyboard focus out from under the sticky bands of a scroll container
 * (WCAG 2.2 SC 2.4.11).
 *
 * ★★ A browser scrolls a focused element only as far as the scroller's edge —
 *    and a sticky header, footer or pinned column sits exactly there, so the
 *    row or cell that just took focus is drawn underneath it. `scroll-padding`
 *    fixes that only when the band's size is known in CSS; a table header's
 *    height depends on its content and a pinned column's width on its data.
 *    This measures the bands instead.
 *
 * Put it on the scroller and mark each band with `data-sv-sticky="top|bottom|
 * start|end"`. After every focus change inside, on the next frame (the
 * browser's own scroll-into-view runs after the focus events), it scrolls by
 * exactly the overlap. A band that contains the focused element is skipped —
 * focus inside the header is not hidden by the header. Nested scrollers each
 * handle only their own bands.
 *
 * ```html
 * <div class="overflow-auto" svRevealFocus>
 *   <table><thead class="sticky top-0" data-sv-sticky="top">…</thead>…</table>
 * </div>
 * ```
 */
@Directive({
  selector: '[svRevealFocus]',
  standalone: true,
  host: { '(focusin)': 'onFocusIn($event)' },
})
export class SvRevealFocusDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => this.reveal(target));
  }

  /** Scroll `target` clear of this scroller's bands. @internal — public for tests. */
  reveal(target: HTMLElement): void {
    if (!target.isConnected || !this.host.contains(target)) return;
    const bands: SvStickyBand[] = [];
    for (const el of this.host.querySelectorAll<HTMLElement>('[data-sv-sticky]')) {
      const side = el.dataset['svSticky'] ?? '';
      if (!SIDES.has(side) || el.contains(target) || el.closest('[svRevealFocus]') !== this.host) continue;
      bands.push({ side: side as SvStickySide, box: el.getBoundingClientRect() });
    }
    if (!bands.length) return;
    const rtl = getComputedStyle(this.host).direction === 'rtl';
    const { dx, dy } = svUnobscuredDelta(target.getBoundingClientRect(), bands, rtl);
    if (dx || dy) this.host.scrollBy({ left: dx, top: dy });
  }
}
