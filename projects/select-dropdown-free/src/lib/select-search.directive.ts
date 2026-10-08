import { computed, Directive, forwardRef, input, output } from '@angular/core';
import {
  SV_SELECT_FEATURE,
  type SvSelectFeature,
  type SvSelectFeatureConfig,
} from '@styloviz/core';

/**
 * `svSelectSearch` — the search feature of a select, as a content child
 * (`FI-23-M1`).
 *
 * ```html
 * <sv-select-dropdown [options]="rows()" [(value)]="v">
 *   <ng-container svSelectSearch [minChars]="2" (searchChange)="query($event)" />
 * </sv-select-dropdown>
 * ```
 *
 * Its presence turns the search box on. Every other input is optional and,
 * left unbound, falls through to the select's own input of the same name — so
 * adopting the directive changes nothing you did not bind.
 *
 * It renders nothing. The search box lives in a panel the select owns, and a
 * directive cannot contribute template to it; it registers its settings
 * through `SV_SELECT_FEATURE` instead, and the select depends on that token,
 * not on this class.
 *
 * For a server-backed list, use `svSelectSource` from `@styloviz/core` on the
 * select's `[source]` input — it owns the debounce, `minChars`, paging and the
 * async state together.
 */
@Directive({
  selector: '[svSelectSearch]',
  standalone: true,
  providers: [{ provide: SV_SELECT_FEATURE, useExisting: forwardRef(() => SvSelectSearchDirective) }],
})
export class SvSelectSearchDirective implements SvSelectFeature {
  /** Show the search box. Present means on; bind `false` to hide it. @default true */
  readonly searchable = input<boolean | undefined>(undefined);
  /** Placeholder for the search box. @default the select's `searchPlaceholder` */
  readonly searchPlaceholder = input<string | undefined>(undefined);
  /** Text when a search matches nothing. @default the select's `noResultsText` */
  readonly noResultsText = input<string | undefined>(undefined);
  /** Panel copy while the first options load. @default the select's `loadingText` */
  readonly loadingText = input<string | undefined>(undefined);
  /** Characters required before a term is searched. @default the select's `minChars` */
  readonly minChars = input<number | undefined>(undefined);
  /** Delay before a term is emitted, in ms. @default the select's `debounceMs` */
  readonly debounceMs = input<number | undefined>(undefined);
  /** The host filters on the server; the select shows `options` as given. @default the select's `serverSide` */
  readonly serverSide = input<boolean | undefined>(undefined);

  /** Emitted with each settled search term — the select's `searchChange`, scoped to this feature. */
  readonly searchChange = output<string>();

  /** @internal Read by the select through `SV_SELECT_FEATURE`. */
  readonly config = computed<SvSelectFeatureConfig>(() => ({
    searchable: this.searchable() ?? true,
    searchPlaceholder: this.searchPlaceholder(),
    noResultsText: this.noResultsText(),
    loadingText: this.loadingText(),
    minChars: this.minChars(),
    debounceMs: this.debounceMs(),
    serverSide: this.serverSide(),
  }));

  /** @internal */
  searchChanged(term: string): void {
    this.searchChange.emit(term);
  }
}
