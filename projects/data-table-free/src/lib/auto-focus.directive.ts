import { afterNextRender, booleanAttribute, Directive, ElementRef, inject, input } from '@angular/core';

// ─── Auto-focus directive ─────────────────────────────────────────────────────

@Directive({ selector: '[svDtAutoFocus]', standalone: true })
export class DtAutoFocusDirective {
  /**
   * Focus the host element once it has rendered. A bare `svDtAutoFocus`
   * attribute counts as on (it used to bind `''` and switch focusing off).
   * @default true
   */
  readonly enabled = input(true, { alias: 'svDtAutoFocus', transform: booleanAttribute });
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // After the first render rather than a 0 ms timer: the element is attached
    // by then, nothing runs on the server, and nothing is left pending when the
    // editor closes before the timer would have fired.
    afterNextRender(() => {
      if (this.enabled()) this.el.nativeElement.focus();
    });
  }
}
