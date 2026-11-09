import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * ============================================================
 *  svReveal — a section fades up as it comes into view
 * ============================================================
 *
 *  Promoted out of the portfolio template (2026-08-26) when a second template
 *  needed it. The transition itself is CSS on `[data-sv-reveal]` and lives in
 *  each template's own token block in `styles.css`, because a packed template
 *  ships only what is between its markers — a template without those rules
 *  gets no animation, which is the same graceful nothing every other failure
 *  path here produces.
 * ============================================================
 *
 *  ★★★ THE HIDDEN STATE IS APPLIED BY JAVASCRIPT, NEVER BY THE STYLESHEET.
 *
 *      The obvious build is `opacity-0` in the markup and a class that turns
 *      it on. That ships a page whose content is invisible to anyone the
 *      script never reaches — a crawler reading the prerendered HTML, a
 *      browser where the bundle failed, a reader who has asked their OS for
 *      less motion. The failure is total and silent: the page looks blank.
 *
 *      So the element starts visible, in the markup, and this directive hides
 *      it only once it has decided it can animate — which means it has a DOM,
 *      an IntersectionObserver, and permission to move. Every path that is not
 *      that one leaves the page exactly as the server rendered it.
 *
 *  ★★ `prefers-reduced-motion` IS CHECKED, NOT ASSUMED. A fade is still
 *     motion. Someone who has turned motion down gets the content, immediately
 *     and in place, rather than a shorter version of the animation.
 *
 *  ★ It disconnects after the first reveal. A section that has been seen does
 *    not need watching, and an observer left attached to every card on a long
 *    index is work the page does forever for nothing.
 *
 *  Usage — note the element is fully visible without any of this:
 *
 *    <section svReveal>…</section>
 *    <article svReveal [revealDelay]="80">…</article>
 * ============================================================
 */
@Directive({
  selector: '[svReveal]',
  standalone: true,
})
export class SvRevealDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Stagger, in milliseconds, for items revealed as a group.
   *
   * ★ Capped by the caller, not here — but keep it small. A stagger long
   *   enough to notice as a queue reads as the page being slow rather than as
   *   the page being considered.
   */
  readonly revealDelay = input<number>(0);

  constructor() {
    // ★ `afterNextRender` rather than a constructor body or `ngOnInit`: this
    //   touches `window` and the element's box, neither of which exists during
    //   the server render. `check:ssr-safety` enforces the same rule.
    afterNextRender(() => this.arm());
  }

  private arm(): void {
    const el = this.host.nativeElement;

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) return;

    // Already on screen when the page loads — above the fold, or a short page.
    // Animating it would mean hiding something the reader is looking at and
    // then showing it again.
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight * 0.9) return;

    el.dataset['svReveal'] = 'hidden';
    const delay = Math.max(0, this.revealDelay());
    if (delay) el.style.transitionDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset['svReveal'] = 'shown';
          observer.disconnect();
        }
      },
      // A little before the edge, so the movement finishes as the section
      // arrives rather than starting when it is already being read.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    observer.observe(el);
    // Left before it was ever seen — a route change mid-page. The observer would
    // otherwise keep watching a detached element for the life of the tab.
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
