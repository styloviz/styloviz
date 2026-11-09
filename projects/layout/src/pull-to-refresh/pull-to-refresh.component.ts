import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons';
import { SV_LAYOUT_LABELS, type SvLayoutLabels } from '../layout.labels';
import { SvPullToRefreshDirective, type SvPullState } from './pull-to-refresh.directive';

import { registerPullToRefreshIcons } from './pull-to-refresh.component.icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The non-gesture way to refresh.
 * - `focus` — a Refresh button that is visually hidden until it takes keyboard focus (a skip-link). Screen readers always find it.
 * - `always` — the button is always visible, top end.
 * - `none` — no button; the host provides its own refresh control (and must — a pull is touch-only).
 */
export type SvPullToRefreshButton = 'focus' | 'always' | 'none';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Pull to Refresh — a scrolling region that refreshes when pulled down from the top.
 *
 * The gesture is `svPullToRefresh` (exported on its own for a custom indicator);
 * this component adds the indicator, the keyboard and screen-reader path, and
 * the announcements:
 *
 * - **Indicator** — a disc that follows the pull, its arrow turning as the pull
 *   arms, then a spinner while `refreshing`. It moves by `transform` and fades
 *   by `opacity` only; the content does not move, so a long list never reflows.
 *   Under reduced motion it settles without a slide and shows no spin.
 * - **A real button** — a pull is touch-only, so a Refresh button sits first in
 *   the region (`refreshButton`: shown on focus, always, or not at all when the
 *   host has its own), and `trigger()` is public.
 * - **Announcements** — "Refreshing…" and then "Updated" in a polite status
 *   region, whichever way the refresh was started.
 *
 * Size the host (`class="h-[480px]"`, or a flex child with `min-h-0`): the
 * component is the scroll container.
 *
 * @example
 * ```html
 * <sv-pull-to-refresh class="h-full" [refreshing]="inbox.isLoading()" (refresh)="inbox.reload()">
 *   <ul>…</ul>
 * </sv-pull-to-refresh>
 * ```
 */
@Component({
  selector: 'sv-pull-to-refresh',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvPullToRefreshDirective],
  templateUrl: './pull-to-refresh.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block overflow-hidden' },
})
export class SvPullToRefreshComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerPullToRefreshIcons();

  private readonly registryLabels = injectSvLabels('layout', SV_LAYOUT_LABELS);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** True while your refresh runs: the indicator holds and spins, and "Updated" is announced when it goes false. @default false */
  readonly refreshing = input<boolean>(false);

  /** Indicator travel (px) that arms a refresh. @default 72 */
  readonly threshold = input<number>(72);

  /** Indicator travel per pixel of finger travel, 0.1–1. @default 0.5 */
  readonly resistance = input<number>(0.5);

  /** Turn the pull and the button off. @default false */
  readonly disabled = input<boolean>(false);

  /** How the non-gesture Refresh button shows. @default 'focus' */
  readonly refreshButton = input<SvPullToRefreshButton>('focus');

  /** The scrolling region's accessible name. @default 'Refreshable content' (the `pullRegion` label) */
  readonly ariaLabel = input<string>('');

  /** Per-instance overrides for the package labels. @default {} */
  readonly labels = input<Partial<SvLayoutLabels>>({});

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Fetch again — from a pull, the button, or `trigger()`. Never while `refreshing`. */
  readonly refresh = output<void>();

  // ── State ─────────────────────────────────────────────────────────────────

  private readonly gesture = viewChild(SvPullToRefreshDirective);

  protected readonly text = computed<SvLayoutLabels>(() => ({ ...this.registryLabels, ...this.labels() }));

  /** Where the pull is — for a host that wants to mirror it (`data-sv-pull-state` on the scroller says the same). */
  readonly state = computed<SvPullState>(() => this.gesture()?.state() ?? 'idle');

  /** A finger is moving the disc — draw it without a transition. */
  protected readonly tracking = computed(() => this.gesture()?.tracking() ?? false);
  private readonly distance = computed(() => this.gesture()?.distance() ?? 0);
  private readonly progress = computed(() => this.gesture()?.progress() ?? 0);

  /** What the polite status region says. */
  protected readonly announcement = signal('');
  private sawRefresh = false;

  /** The disc's position: hidden above the top at rest, `distance` px down while pulled. */
  protected readonly indicatorTransform = computed(() => `translate3d(0, ${this.distance() - 44}px, 0)`);
  protected readonly indicatorOpacity = computed(() => Math.min(1, this.progress() * 1.25));
  protected readonly arrowRotation = computed(() =>
    this.state() === 'armed' ? 'rotate(180deg)' : `rotate(${Math.round(this.progress() * 150)}deg)`,
  );

  protected readonly buttonClasses = computed(() => {
    const base =
      'absolute end-2 top-2 z-20 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 ' +
      'text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 ' +
      'focus-visible:ring-primary-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ' +
      'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';
    return this.refreshButton() === 'focus' ? `${base} sr-only focus:not-sr-only focus:absolute` : base;
  });

  constructor() {
    effect(() => {
      const state = this.state();
      untracked(() => {
        if (state === 'refreshing') {
          this.sawRefresh = true;
          this.announcement.set(this.text().pullRefreshing);
        } else if (this.sawRefresh) {
          this.sawRefresh = false;
          this.announcement.set(this.text().pullUpdated);
        }
      });
    });
  }

  /** Refresh without a pull — what the button does. */
  trigger(): void {
    this.gesture()?.trigger();
  }

  protected onRefresh(): void {
    this.refresh.emit();
  }
}
