import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * ============================================================
 *  svPauseOffscreen — CSS animations stop while nobody can see them
 * ============================================================
 *  A spinner, a pulsing live dot, a skeleton shimmer: each runs forever, and
 *  each keeps the compositor producing frames — or, for anything that is not
 *  a transform/opacity animation, the main thread painting — for as long as
 *  it exists. On a long page most of them are off-screen. The component
 *  gallery's line-charts page ran 71 at once, data-tables 52
 *  (STYLOVIZ_SCROLL_FLICKER_TODO SF-12).
 *
 *  This marks its host `data-sv-offscreen` while it is out of view, and the
 *  kit stylesheet pauses every CSS animation under a marked element:
 *
 *      [data-sv-offscreen] … { animation-play-state: paused !important; }
 *
 *  ★★ PAUSED, NOT REMOVED. Play-state keeps each animation's place, so a
 *     spinner that scrolls back into view continues from where it stopped —
 *     no jump, no restart, nothing to reconcile.
 *  ★★ `!important` is on purpose and on one property only. Components declare
 *     the `animation` shorthand, which resets play-state to `running` with
 *     their own specificity; nothing else here needs to win.
 *  ★ It resumes a little BEFORE the element arrives (`margin`, 200px by
 *    default), so an animation is already moving when it comes into view.
 *  ★ CSS animations only. A requestAnimationFrame or timer loop in a
 *    component is that component's business — pause it from its own
 *    visibility, not from here.
 *  ★ Off the server, without an IntersectionObserver, or before the first
 *    callback, the host is never marked: everything simply animates, exactly
 *    as it did without the directive.
 *
 *  Usage:
 *    <div svPauseOffscreen>…a panel of live demos…</div>
 *    <section svPauseOffscreen pauseMargin="400px">…</section>
 * ============================================================
 */
@Directive({
  selector: '[svPauseOffscreen]',
  standalone: true,
})
export class SvPauseOffscreenDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * How far outside the viewport the host still counts as visible, as a CSS
   * margin. Larger resumes earlier; `0px` pauses the instant it leaves.
   * @default '200px'
   */
  readonly pauseMargin = input<string>('200px');

  constructor() {
    // `afterNextRender`: the observer needs a DOM, which the server render does not have.
    afterNextRender(() => this.arm());
  }

  private arm(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const el = this.host.nativeElement;

    const observer = new IntersectionObserver(
      (entries) => {
        // The last entry is the current state when several are batched.
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) delete el.dataset['svOffscreen'];
        else el.dataset['svOffscreen'] = '';
      },
      { rootMargin: this.pauseMargin() },
    );

    observer.observe(el);
    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      delete el.dataset['svOffscreen'];
    });
  }
}
