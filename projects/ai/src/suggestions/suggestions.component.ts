import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  resolveItemKey,
  type SvDataError,
  type SvItemKey,
} from '@styloviz/core/data';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_AI_LABELS, type SvAiLabels } from '@styloviz/ai/labels';

import { registerSuggestionsIcons } from './suggestions.component.icons';
/** One prompt the user can start from. */
export interface SvSuggestion {
  /** Stable identity — tracked across refreshes. */
  readonly id: string;
  /** What the button says. */
  readonly label: string;
  /** The text to send when it is picked. Falls back to `label`. */
  readonly prompt?: string;
  /** A second line, shown in the `list` and `grid` layouts. */
  readonly description?: string;
  /**
   * A glyph name from the icon library. A name that arrives in your data is
   * yours to register (`provideSvIcons`), like any other data-driven glyph.
   */
  readonly icon?: string;
}

/** How the suggestions are laid out. */
export type SvSuggestionsLayout = 'list' | 'grid' | 'chips';

/** A suggestion as the template draws it. */
interface SuggestionRow {
  readonly key: string | number;
  readonly item: SvSuggestion;
}

/**
 * `sv-suggestions` — starter prompts for an empty conversation, or follow-ups
 * under an answer.
 *
 * ```html
 * <sv-suggestions [suggestions]="prompts" layout="chips" (selected)="send($event.prompt ?? $event.label)" />
 * ```
 */
@Component({
  selector: 'sv-suggestions',
  standalone: true,
  imports: [SvIconComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent],
  templateUrl: './suggestions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSuggestionsComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerSuggestionsIcons();

  private readonly registryText = injectSvLabels('ai', SV_AI_LABELS);

  /** The prompts to offer. @default [] */
  readonly suggestions = input<readonly SvSuggestion[]>([]);

  /** `list` (stacked rows), `grid` (two columns from `sm`) or `chips` (wrapping pills). @default 'list' */
  readonly layout = input<SvSuggestionsLayout>('list');

  /** Show at most this many; `0` shows them all. Negative or non-finite values count as `0`. @default 0 */
  readonly max = input<number>(0);

  /** Disable every suggestion — while a reply is in flight, for instance. @default false */
  readonly disabled = input<boolean>(false);

  /** True while the host is fetching suggestions. @default false */
  readonly loading = input<boolean>(false);

  /** The last failure fetching suggestions, or null. @default null */
  readonly error = input<SvDataError | string | null>(null);

  /** Stable identity for each suggestion. @default 'id' */
  readonly itemKey = input<SvItemKey<SvSuggestion>>('id');

  /** The list's accessible name; `null` uses the `suggestions` label. @default null */
  readonly ariaLabel = input<string | null>(null);

  /** Per-instance text, merged over the registry's `ai` labels. @default {} */
  readonly labels = input<Partial<SvAiLabels>>({});

  /** The user picked a suggestion. */
  readonly selected = output<SvSuggestion>();

  /** The host should re-run the failed fetch. */
  readonly retry = output<void>();

  /** @internal The labels in effect. */
  protected readonly text = computed<SvAiLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal The suggestions the template draws, keyed and capped. */
  protected readonly rows = computed<readonly SuggestionRow[]>(() => {
    const all = this.suggestions();
    const cap = this.max();
    const limit = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : all.length;
    const key = this.itemKey();
    return all.slice(0, limit).map((item, i) => ({ key: resolveItemKey(item, key, i), item }));
  });

  /** @internal The list element's classes for the current layout. */
  protected readonly listClass = computed(() => {
    switch (this.layout()) {
      case 'chips':
        return 'flex flex-wrap gap-2';
      case 'grid':
        return 'grid grid-cols-1 gap-2 sm:grid-cols-2';
      default:
        return 'grid grid-cols-1 gap-2';
    }
  });

  /** @internal Whether rows carry their description and icon tile. */
  protected readonly isChips = computed(() => this.layout() === 'chips');

  /** @internal */
  protected choose(item: SvSuggestion): void {
    if (this.disabled()) return;
    this.selected.emit(item);
  }
}
