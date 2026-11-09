import { Directive, ElementRef, inject, input, afterNextRender, Injector } from '@angular/core';

/**
 * Move focus to this element when it appears.
 *
 * The native `autofocus` attribute does not do this. It is specified to apply
 * when a *document* finishes loading, and browsers vary on what they do with it
 * on an element inserted later — which is exactly the case that matters here: a
 * cell editor opening on double-click, a picker's search box appearing inside a
 * popover, a reply box expanding under a comment. Those either worked by
 * accident or not at all, and `@angular-eslint`'s blanket `no-autofocus` was
 * flagging them for the wrong reason — the attribute is not merely bad practice
 * on dynamic content, it is inert.
 *
 * Focus is applied after the next render rather than in `ngOnInit`, because at
 * init the element may not be attached yet — and `.focus()` on a detached node
 * silently does nothing, which is the failure mode that makes people reach for
 * `setTimeout(…, 0)` and hope.
 *
 * Only use this where the user's own action caused the element to appear.
 * Stealing focus on page load is the accessibility problem `no-autofocus`
 * exists to prevent, and this directive does not make that acceptable.
 *
 * ```html
 * <input svAutofocus [svAutofocus]="isEditing()" />
 * ```
 */
@Directive({
  selector: '[svAutofocus]',
  standalone: true,
})
export class SvAutofocusDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /**
   * Set to `false` to render the element without taking focus. Bare
   * `svAutofocus` (no value) reads as an empty string, which is why this
   * accepts `'' | boolean` rather than `boolean` alone.
   * @default true
   */
  readonly svAutofocus = input<'' | boolean>(true);

  /** Select existing text as well, for an editor opening over a current value. */
  readonly selectOnFocus = input<boolean>(false);

  constructor() {
    afterNextRender(
      () => {
        if (this.svAutofocus() === false) return;
        const node = this.el.nativeElement;
        node.focus();
        if (
          this.selectOnFocus() &&
          (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
        ) {
          node.select();
        }
      },
      { injector: this.injector },
    );
  }
}
