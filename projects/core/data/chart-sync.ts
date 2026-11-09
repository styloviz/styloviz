import { Directive, Injectable, computed, effect, input, inject, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';

/**
 * Chart synchronisation groups — one hover and one zoom shared by every chart
 * that names the same group.
 *
 * ```html
 * <sv-line-chart svChartSync="ops" [categories]="days" [series]="latency" />
 * <sv-line-chart svChartSync="ops" [categories]="days" [series]="errors" />
 * <sv-bar-chart  svChartSync="ops" [categories]="days" [datasets]="deploys" />
 * ```
 *
 * Hover one and every chart in "ops" shows the same day; brush one (a
 * `zoomable` line chart) and the others show the same window. This is the
 * dashboard pattern Highcharts calls synchronized charts.
 *
 * ★★ CATEGORIES, NOT INDICES. The group shares the category LABEL under the
 *    pointer and the labels at the window's ends. Index 7 is a different day in
 *    a chart that starts a week later; the label is the same day in both, and a
 *    chart that does not have that label simply shows nothing.
 *
 * ★★ A REMOTE CHANGE IS NEVER RE-PUBLISHED. Each state carries the id of the
 *    chart that set it; a chart reads only states that are not its own, and
 *    applying one does not publish. Without that, two zoomable charts would
 *    bounce a window between them for ever.
 *
 * Participating families read the directive from their own host element; the
 * docs list which ones (line and bar, pro and free). Any chart a buyer writes can
 * join the same way: `inject(SvChartSyncDirective, { self: true, optional: true })`.
 */
export interface SvChartSyncHover {
  /** The category label under the pointer or keyboard focus. */
  readonly key: string;
  readonly source: string;
}

export interface SvChartSyncZoom {
  /** First and last category label of the visible window; both `null` = the full range. */
  readonly start: string | null;
  readonly end: string | null;
  readonly source: string;
}

interface GroupState {
  readonly hover: WritableSignal<SvChartSyncHover | null>;
  readonly zoom: WritableSignal<SvChartSyncZoom | null>;
}

/** Root registry of groups. One per application, so SSR requests never share one. */
@Injectable({ providedIn: 'root' })
export class SvChartSyncHub {
  private readonly groups = new Map<string, GroupState>();

  group(name: string): GroupState {
    let g = this.groups.get(name);
    if (!g) {
      g = { hover: signal(null), zoom: signal(null) };
      this.groups.set(name, g);
    }
    return g;
  }
}

@Directive({ selector: '[svChartSync]', standalone: true })
export class SvChartSyncDirective {
  private readonly hub = inject(SvChartSyncHub);

  /** The group's name — every chart naming the same group shares hover and zoom. */
  readonly svChartSync = input.required<string>();

  /** Share the hovered category with the group. @default true */
  readonly syncHover = input<boolean>(true);

  /** Share the zoom window with the group (charts that zoom). @default true */
  readonly syncZoom = input<boolean>(true);

  /** This chart's id in the group, so its own state is never read back. */
  readonly id = svUniqueId('sv-chart-sync');

  private readonly group = computed(() => this.hub.group(this.svChartSync()));

  /** Another chart's hovered category, or `null`. */
  readonly remoteHover: Signal<string | null> = computed(() => {
    const h = this.syncHover() ? this.group().hover() : null;
    return h && h.source !== this.id ? h.key : null;
  });

  /**
   * Another chart's zoom window — `{ start: null, end: null }` when it went back
   * to the full range — or `null` when the last window set was this chart's own.
   */
  readonly remoteZoom: Signal<{ start: string | null; end: string | null } | null> = computed(() => {
    const z = this.syncZoom() ? this.group().zoom() : null;
    return z && z.source !== this.id ? { start: z.start, end: z.end } : null;
  });

  /** Publish this chart's hovered category; `null` when the pointer or focus leaves. */
  publishHover(key: string | null): void {
    if (!this.syncHover()) return;
    const hover = this.group().hover;
    if (key === null) {
      // Clear only what this chart set: a late leave must not wipe another chart's hover.
      if (hover()?.source === this.id) hover.set(null);
      return;
    }
    if (hover()?.key !== key || hover()?.source !== this.id) hover.set({ key, source: this.id });
  }

  /** Publish this chart's window; `null` for "showing everything", which resets the group too. */
  publishZoom(range: { start: string; end: string } | null): void {
    if (!this.syncZoom()) return;
    this.group().zoom.set({ start: range?.start ?? null, end: range?.end ?? null, source: this.id });
  }
}

/** What a chart hands `injectSvChartSync` — its categories, and how to show the group's state. */
export interface SvChartSyncFollower {
  /** The chart's category labels — the group's shared vocabulary. */
  readonly categories: () => readonly string[];
  /** Show another chart's hovered category, by this chart's index; `null` = it left, or this chart lacks it. */
  readonly hover: (index: number | null) => void;
  /** Show another chart's window by index (both `null` = the full range). Charts that do not zoom leave it out. */
  readonly zoom?: (start: number | null, end: number | null) => void;
}

/** What a chart gets back — how to tell the group, by this chart's own indices. */
export interface SvChartSyncHandle {
  publishHover(index: number | null): void;
  publishZoom(range: { start: number; end: number } | null): void;
}

/**
 * Join the `svChartSync` group on this chart's own element, if it has one —
 * call in a field initializer. Returns `null` when the chart is in no group,
 * so an unsynchronised chart pays for nothing. The helper turns indices into
 * category labels and back, so a chart never handles the group's vocabulary.
 *
 * ```ts
 * private readonly sync = injectSvChartSync({
 *   categories: () => this.categories(),
 *   hover: (i) => (i === null ? this.hideTip() : this.showTipAt(i)),
 * });
 * // on pointer move:  this.sync?.publishHover(index);
 * ```
 */
export function injectSvChartSync(follower: SvChartSyncFollower): SvChartSyncHandle | null {
  const dir = inject(SvChartSyncDirective, { self: true, optional: true });
  if (!dir) return null;
  const indexOf = (key: string | null): number => (key === null ? -1 : follower.categories().indexOf(key));
  effect(() => {
    const key = dir.remoteHover();
    untracked(() => {
      const i = indexOf(key);
      follower.hover(i < 0 ? null : i);
    });
  });
  const zoom = follower.zoom;
  if (zoom) {
    effect(() => {
      const z = dir.remoteZoom();
      if (!z) return;
      untracked(() => {
        if (z.start === null || z.end === null) return zoom(null, null);
        const start = indexOf(z.start);
        const end = indexOf(z.end);
        // A window this chart cannot show (a label it lacks) is left alone, not guessed.
        if (start >= 0 && end >= start) zoom(start, end);
      });
    });
  }
  const label = (i: number): string | null => follower.categories()[i] ?? null;
  return {
    publishHover: (i) => dir.publishHover(i === null ? null : label(i)),
    publishZoom: (range) => {
      const start = range ? label(range.start) : null;
      const end = range ? label(range.end) : null;
      dir.publishZoom(start !== null && end !== null ? { start, end } : null);
    },
  };
}
