import { Directive, booleanAttribute, input } from '@angular/core';

/**
 * Marks a list, panel or region as **answered but out of date**: a newer
 * request is in flight, and what is on screen answers the previous one.
 *
 * ── Why this is a directive and not seven copies of two classes ──────────────
 * Six picker families in the kit independently need the same treatment, and
 * every hand-rolled version of it differs — one dims, one spins, one blanks,
 * one does nothing at all and simply lies. Worse, most of them reach for
 * `loading`, which cannot express this: `loading` is true both while the FIRST
 * results are being fetched (nothing on screen — show a skeleton) and while a
 * refinement of them is being fetched (results on screen — keep them, mark
 * them). Blanking the panel on the second is the most jarring thing a combobox
 * can do; showing the old list with no indication that it answers an older
 * query is a quiet lie. `stale` is the third state, and this is its treatment.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 * - `aria-busy="true"` — the ARIA-correct statement that this region is being
 *   updated, so a screen reader does not announce a changing list mid-change.
 * - `data-sv-state="stale"` — the same machine-readable hook the async shells
 *   publish, so a spec (and `check:ui`) can assert the state without selectors.
 * - Dims to 60% opacity, with a transition so it fades rather than flickers.
 *
 * It deliberately does **not** disable pointer events. The whole point of
 * keeping the previous results is that they stay usable: an option the user was
 * already reaching for is still the option they want.
 *
 * ```html
 * @if (error()) {
 *   <sv-error-shell [error]="error()" (retry)="retry.emit()" />
 * } @else if (options().length > 0) {
 *   <ul role="listbox" [svStale]="stale()"> … </ul>
 * } @else if (loading()) {
 *   <sv-skeleton-shell />
 * }
 * ```
 *
 * Pair it with `createRequestGuard().stale` from this package, or
 * `svSuggestController(...).stale` from `@styloviz/data`, which computes it.
 *
 * ⚠️ Do not put it on an element that already sets `data-sv-state` — the two
 * bindings would fight, and the state that element is in is not this one.
 */
@Directive({
  selector: '[svStale]',
  host: {
    '[attr.aria-busy]': "svStale() ? 'true' : null",
    '[attr.data-sv-state]': "svStale() ? 'stale' : null",
    '[class.opacity-60]': 'svStale()',
    '[class.transition-opacity]': 'true',
  },
})
export class SvStaleDirective {
  /**
   * True while a newer request is in flight and the content here answers an
   * older one. Accepts a bare attribute (`svStale`) as `true`.
   */
  readonly svStale = input(false, { transform: booleanAttribute });
}
