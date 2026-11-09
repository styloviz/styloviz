import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';

/**
 * A `<textarea>` that grows with its text (`FI-27-V2`, `FI-12-M5`).
 *
 * ★★★ `field-sizing: content` IS THE ANSWER AND IT IS NOT YET EVERYWHERE.
 *     Chromium sizes a textarea to its content with one declaration; WebKit
 *     and Firefox do not support it yet and ignore it — leaving a fixed box
 *     with a scrollbar, which is the thing being fixed. So the CSS is used
 *     where `CSS.supports` says it works, and everywhere else the height is
 *     MEASURED: collapse to `auto`, read `scrollHeight`, set it.
 *
 * ★★ THE MEASURED PATH NEEDS TO KNOW WHEN THE TEXT CHANGED. Typing fires
 *    `input`, but a value written by a form (`writeValue`, `[value]`) fires
 *    nothing — so the host binds `[svAutosizeValue]` to the same value and the
 *    directive re-measures after the render that wrote it.
 *
 * ★ `svAutosizeMaxRows` caps the growth; past it the box scrolls. The cap is
 *   computed from the element's own line-height and padding, so it holds in
 *   both paths.
 *
 * ```html
 * <textarea svAutosize [svAutosizeValue]="value()" [svAutosizeMaxRows]="8"></textarea>
 * ```
 */
@Directive({
  selector: 'textarea[svAutosize]',
  standalone: true,
  host: {
    '(input)': 'resize()', // sv-i18n-ignore: host binding
    '[attr.data-sv-autosize]': 'enabled() ? mode : null', // sv-i18n-ignore: host binding
  },
})
export class SvAutosizeDirective {
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  /**
   * Turn autosizing on. Bare `svAutosize` reads as `''`, which is on.
   * @default true
   */
  readonly svAutosize = input<'' | boolean>(true);
  /** The text, so a value written without an `input` event still resizes. */
  readonly svAutosizeValue = input<string | null | undefined>(undefined);
  /** Most rows before the box scrolls; `0` is no cap. @default 0 */
  readonly svAutosizeMaxRows = input<number>(0);

  /** `'css'` where `field-sizing: content` works, `'measure'` elsewhere. */
  readonly mode: 'css' | 'measure' =
    typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content')
      ? 'css'
      : 'measure';

  protected enabled(): boolean {
    return this.svAutosize() !== false;
  }

  constructor() {
    afterRenderEffect(() => {
      this.svAutosizeValue();
      this.svAutosizeMaxRows();
      const on = this.enabled();
      const node = this.el.nativeElement;
      if (!on) {
        node.style.removeProperty('field-sizing');
        node.style.removeProperty('min-height');
        node.style.removeProperty('max-height');
        node.style.removeProperty('height');
        node.style.removeProperty('overflow-y');
        return;
      }
      if (this.mode === 'css') {
        node.style.setProperty('field-sizing', 'content');
        // `field-sizing` ignores `rows`; keep it as the floor the measured path has.
        const floor = this.rowsPx(node.rows || 0);
        if (floor) node.style.minHeight = `${floor}px`;
        const cap = this.capPx();
        if (cap) node.style.maxHeight = `${cap}px`;
        else node.style.removeProperty('max-height');
        return;
      }
      this.resize();
    });
  }

  /** The height `svAutosizeMaxRows` allows, in px, or 0 for none. */
  private capPx(): number {
    return this.rowsPx(this.svAutosizeMaxRows());
  }

  /** The height of `count` rows of this textarea's text, padding (and border) included; 0 for none. */
  private rowsPx(count: number): number {
    const rows = Math.floor(count);
    if (!(rows > 0) || typeof getComputedStyle !== 'function') return 0;
    const style = getComputedStyle(this.el.nativeElement);
    const fontSize = parseFloat(style.fontSize) || 16;
    const line = parseFloat(style.lineHeight) || fontSize * 1.5;
    const chrome = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      + (style.boxSizing === 'border-box'
        ? (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
        : 0);
    return rows * line + chrome;
  }

  /** Measure and set the height (the fallback path; a no-op where CSS does it). */
  resize(): void {
    if (!this.enabled() || this.mode === 'css') return;
    const node = this.el.nativeElement;
    node.style.height = 'auto';
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
    const borders = style && style.boxSizing === 'border-box'
      ? (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
      : 0;
    const wanted = node.scrollHeight + borders;
    const cap = this.capPx();
    const height = cap ? Math.min(wanted, cap) : wanted;
    node.style.height = `${height}px`;
    node.style.overflowY = cap && wanted > cap ? 'auto' : 'hidden';
  }
}
