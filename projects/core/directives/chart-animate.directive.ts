import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';

/**
 * SvChartAnimDirective — Viewport-aware chart animation trigger.
 *
 * Attach `svChartAnim` to the root wrapper of any Styloviz chart.
 * Uses IntersectionObserver to add `.sv-animate` once the chart
 * enters the viewport (threshold 10%), triggering CSS bar-grow animations.
 *
 * @example
 * ```html
 * <div svChartAnim class="flex flex-col gap-3">
 *   <!-- chart content -->
 * </div>
 * ```
 */
@Directive({
  selector: '[svChartAnim]',
  standalone: true,
})
export class SvChartAnimDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    // `IntersectionObserver` does not exist under SSR or in a DOM shim such as
    // jsdom, and this used to throw there — taking every chart in the kit down
    // with it. The animation is decorative, so its absence just means the
    // chart renders in its final state immediately.
    if (typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.classList.add('sv-animate');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            requestAnimationFrame(() => {
              (entry.target as HTMLElement).classList.add('sv-animate');
            });
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
