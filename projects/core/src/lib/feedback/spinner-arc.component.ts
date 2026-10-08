import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The kit's one spinning-arc indicator.
 *
 * ★ WHY THIS EXISTS
 *
 * The same twelve lines of SVG — a faint ring plus a quarter-arc wedge, spun by
 * `animate-spin` — were hand-copied into **21 places** across 19 packages and 2
 * app components. They had drifted, in every way a copy can:
 *
 *   • four spellings of one curve (`5.373` vs `5.4`, `018-8` vs `0 0 1 8-8`,
 *     `z` vs `Z`) — the same shape, four times, none of them wrong
 *   • three opacity pairs: 25/75 (×13), 25/90 (×4), 20/90 (×2)
 *   • **six copies with no `aria-hidden` and no label at all** — silent to a
 *     screen reader in a way nobody chose
 *   • and the two data-table copies were not this shape at all: a stroked
 *     quarter-circle with no ring behind it
 *
 * None of that drift is visible in review, because no reviewer sees two copies
 * at once. It is only visible from up here.
 *
 * ★ It lives in `@styloviz/core`, not `@styloviz/overlays`, for two reasons.
 * `<sv-spinner>` in overlays draws a **border ring** — `border`/`dots`/`pulse`/
 * `bars`, no arc — so routing these through it would have restyled every
 * spinner in the kit. And core is already a dependency of 15 of the 17 affected
 * packages, where overlays is a dependency of none; core already exports
 * `SvSkeletonShellComponent` and `SvFieldErrorComponent`, so a shared indicator
 * is at home here.
 *
 * ★ ACCESSIBILITY: decorative by default. A spinner beside its own visible
 * "Loading…" text must not be announced twice, so with no `label` this renders
 * `aria-hidden="true"`. Pass `label` only when the spinner is the *only* thing
 * conveying that something is happening — then it becomes `role="img"` with an
 * accessible name.
 *
 * @example Static size and colour
 * ```html
 * <sv-spinner-arc cssClass="h-7 w-7 text-primary-500" />
 * ```
 *
 * @example Driven by a computed size, and the only loading affordance present
 * ```html
 * <sv-spinner-arc [cssClass]="iconSize()" label="Loading suggestions" />
 * ```
 */
@Component({
  selector: 'sv-spinner-arc',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [class]="svgClass()"
      viewBox="0 0 24 24"
      fill="none"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  `,
})
export class SvSpinnerArcComponent {
  /**
   * Classes for the `<svg>` itself — size and colour. `animate-spin` is always
   * applied and must not be passed here.
   *
   * Named `cssClass` rather than `class` to match `sv-loader-icon`, the kit's
   * existing precedent for the same job.
   */
  readonly cssClass = input('');

  /**
   * An accessible name. Leave empty (the default) whenever the surrounding UI
   * already says that something is loading — see the note above.
   */
  readonly label = input('');

  protected readonly svgClass = computed(() =>
    ('animate-spin shrink-0 ' + this.cssClass()).trim(),
  );
}
