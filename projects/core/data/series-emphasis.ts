import { computed, inject, signal, type Signal, type WritableSignal } from '@angular/core';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SV_CORE_LABELS } from '@styloviz/core/i18n';
import { injectSvLabels } from '@styloviz/core/i18n';
import { svFormatLabel } from '@styloviz/core/i18n';

/**
 * series-emphasis.ts — one model for "which series am I looking at" (FL-J3-CH-03).
 *
 * ★★★ MANY SERIES OVERLAP, AND NOTHING LET THE READER PULL ONE OUT. A radar
 *     with five polygons, or a line chart with six lines through the same
 *     band, is a tangle (CH-13-I3, CH-07-I5). Neither chart had any series
 *     highlight or hide, and the line chart's legend was static text. The two
 *     answers every charting tool converges on are the same two here:
 *
 *     - **Isolate** — hover or keyboard-focus a legend entry and every OTHER
 *       series fades (CH-13-M4). Nothing is removed, so the comparison the
 *       chart exists for is still there, one series in front.
 *     - **Toggle** — activate the entry and the series is hidden until it is
 *       activated again. The hidden set is the host's (`model()`), so a
 *       dashboard can persist it and restore it.
 *
 * ★★ THE LEGEND IS THE KEYBOARD PATH BETWEEN SERIES (CH-07-M5). It is a
 *    toolbar of `aria-pressed` buttons with ONE tab stop: the arrow keys move
 *    from series to series and each one is isolated as focus lands on it, so a
 *    keyboard reader steps through the series exactly as a mouse reader sweeps
 *    the legend.
 *
 * ★ The last visible series cannot be hidden. A chart with every series off
 *   draws empty axes that look like a failed load; the refusal is announced
 *   rather than silent.
 *
 * ★ Lives in core, like the gap primitives, because the free and Pro charts are
 *   separate components rather than a mirrored pair — two emphasis rules that
 *   disagree about what "dimmed" means would be the defect.
 */

/** Opacity of a series faded behind the emphasised one. */
export const SV_SERIES_DIMMED_OPACITY = 0.18;

/** What a chart hands the model. */
export interface SvSeriesEmphasisOptions {
  /** Series keys (names) in drawing order. */
  readonly keys: () => readonly string[];
  /** The host-bound hidden set — normally the component's `hiddenSeries` model. */
  readonly hidden: WritableSignal<readonly string[]>;
}

/** The emphasis state one chart reads in its template. */
export interface SvSeriesEmphasis {
  /** The series the reader is looking at (hovered or focused), or null. */
  readonly emphasized: Signal<string | null>;
  /** Keys still drawn, in drawing order. */
  readonly visibleKeys: Signal<readonly string[]>;
  /** The legend toolbar's accessible name ("Series"), from the core labels. */
  readonly legendLabel: string;
  /** The legend's off-screen keyboard hint, from the core labels. */
  readonly legendHint: string;
  /** The legend entry that owns the toolbar's single tab stop. */
  readonly activeIndex: Signal<number>;
  /** True when `key` is switched off. */
  isHidden(key: string): boolean;
  /** True when another series is emphasised and `key` is not it. */
  isDimmed(key: string): boolean;
  /** The opacity `key` is drawn at: 1, or `SV_SERIES_DIMMED_OPACITY` behind another. */
  opacity(key: string): number;
  /** Put `key` in front (null clears it). A hidden series is never emphasised. */
  emphasize(key: string | null): void;
  /** Show or hide `key`. Returns false when refused (the last visible series). */
  toggle(key: string): boolean;
  /** The legend button's tabindex — 0 for the active entry, -1 for the rest. */
  tabIndex(index: number): 0 | -1;
  /** Legend focus landed on entry `index`: it takes the tab stop and is emphasised. */
  focusEntry(index: number): void;
  /**
   * Toolbar roving: Arrow keys (both axes — the legend wraps), Home and End.
   * Bind it on each legend button; it moves DOM focus to the sibling
   * `[data-sv-series-index]` button inside the nearest `role="toolbar"`.
   */
  onLegendKeydown(event: KeyboardEvent): void;
}

/** Create the model. Call from an injection context (it injects the announcer and labels). */
export function createSeriesEmphasis(options: SvSeriesEmphasisOptions): SvSeriesEmphasis {
  const announcer = inject(SvLiveAnnouncer);
  const labels = injectSvLabels('core', SV_CORE_LABELS);
  const requested = signal<string | null>(null);
  const active = signal(0);

  const hiddenSet = computed(() => new Set(options.hidden()));
  const visibleKeys = computed(() => options.keys().filter((k) => !hiddenSet().has(k)));
  const emphasized = computed(() => {
    const key = requested();
    return key !== null && options.keys().includes(key) && !hiddenSet().has(key) ? key : null;
  });
  const activeIndex = computed(() => Math.min(active(), Math.max(0, options.keys().length - 1)));

  const isHidden = (key: string): boolean => hiddenSet().has(key);
  const isDimmed = (key: string): boolean => {
    const e = emphasized();
    return e !== null && e !== key;
  };

  function toggle(key: string): boolean {
    if (!options.keys().includes(key)) return false;
    if (hiddenSet().has(key)) {
      options.hidden.set(options.hidden().filter((k) => k !== key));
      announcer.announce(svFormatLabel(labels.seriesShown, { series: key }));
      return true;
    }
    if (visibleKeys().length <= 1) {
      announcer.announce(svFormatLabel(labels.seriesLastVisible, { series: key }));
      return false;
    }
    options.hidden.set([...options.hidden(), key]);
    // A series that leaves the plot cannot stay in front of it.
    if (requested() === key) requested.set(null);
    announcer.announce(svFormatLabel(labels.seriesHidden, { series: key }));
    return true;
  }

  function onLegendKeydown(event: KeyboardEvent): void {
    const count = options.keys().length;
    if (!count) return;
    const from = activeIndex();
    let to: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': to = (from + 1) % count; break;
      case 'ArrowLeft':
      case 'ArrowUp': to = (from - 1 + count) % count; break;
      case 'Home': to = 0; break;
      case 'End': to = count - 1; break;
      default: return;
    }
    event.preventDefault();
    active.set(to);
    // Bound on each legend button (a focusable element); the toolbar is the
    // nearest ancestor that holds its siblings.
    const from_el = event.currentTarget as HTMLElement | null;
    const toolbar = from_el?.closest<HTMLElement>('[role="toolbar"]') ?? from_el?.parentElement ?? null;
    toolbar?.querySelector<HTMLElement>(`[data-sv-series-index="${to}"]`)?.focus();
  }

  return {
    legendLabel: labels.seriesLegend,
    legendHint: labels.seriesLegendHint,
    emphasized,
    visibleKeys,
    activeIndex,
    isHidden,
    isDimmed,
    opacity: (key) => (isDimmed(key) ? SV_SERIES_DIMMED_OPACITY : 1),
    emphasize: (key) => requested.set(key),
    toggle,
    tabIndex: (index) => (index === activeIndex() ? 0 : -1),
    focusEntry: (index) => {
      active.set(index);
      requested.set(options.keys()[index] ?? null);
    },
    onLegendKeydown,
  };
}
