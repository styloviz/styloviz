import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  type SvDataError,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'primary'
  /**
   * Follows the host's `--color-brand-*` tokens.
   *
   * ★★ EVERY VARIANT FOLLOWS THE THEME NOW. This used to be the only one that
   *    did: the rest were painted with literal palettes so a timeline looked the
   *    same wherever it was dropped, which meant `primary` rendered indigo on a
   *    page whose whole palette was rose, and one indigo dot is exactly what
   *    makes a themed template look unfinished.
   *
   * ★ It survives as its own family rather than folding into `primary`, which
   *   reads `brandaccent`: a kit can legitimately have a highlight colour and a
   *   brand colour that differ, and every call site passing `brand` today would
   *   otherwise be silently recoloured.
   */
  | 'brand';

export type TimelineLayout          = 'left' | 'right' | 'alternate' | 'horizontal';
export type TimelineSize            = 'sm' | 'md' | 'lg';
export type TimelineDotStyle        = 'dot' | 'number' | 'check';
export type TimelineDisplayMode     = 'default' | 'feed' | 'status' | 'rich' | 'interactive';

/**
 * What the list MEANS, as opposed to what it looks like.
 *
 * ★★★ THESE WERE THE SAME INPUT, AND THEY ARE NOT THE SAME QUESTION.
 * `displayMode` is documented as a *content display* mode — an appearance
 * choice — and it was silently deciding the semantics too. Worse, in the
 * default branch "is this a stepper?" was inferred from `dotStyle`: pick a
 * numbered or ticked dot and the active item announced as a **step**; pick a
 * plain circle and it announced as nothing at all. Whether a screen reader is
 * told where the reader is in a process depended on **the shape of the dot**.
 *
 * - `chronology` — things that happened, in order. The active item is "current".
 * - `process`    — steps toward a goal. The active item is the current STEP,
 *                  which is what `aria-current="step"` exists to say.
 * - `feed`       — a log of events. Nothing is "current"; a feed has no
 *                  position to be at, and claiming one is a lie a stepper's
 *                  semantics would tell.
 */
export type TimelineIntent = 'chronology' | 'process' | 'feed';
export type TimelineItemStatus      = 'complete' | 'active' | 'pending';
export type TimelineHorizontalAlign = 'top' | 'bottom' | 'alternate';

export interface TimelineItem {
  /** Unique identifier. */
  id: string | number;
  /** Main heading for this event. */
  title: string;
  /** Optional supporting text or description. */
  description?: string;
  /** ISO date string or human-readable timestamp label. */
  timestamp?: string;
  /** Color/status variant for the connector dot. @default 'neutral' */
  variant?: TimelineVariant;
  /**
   * Icon-library name for a glyph inside the dot — e.g. `'check-circle'`.
   * Omit for a solid circle.
   *
   * Was `iconPath`, a raw SVG `d` attribute. A name resolves through
   * `@styloviz/icons`, so `check:icons` catches a typo that a `d` string would
   * have rendered as an empty dot.
   */
  icon?: string;
  /** Badge chip label rendered next to the timestamp. */
  badge?: string;
  /**
   * Step status for `displayMode='status'` or `dotStyle='check'`.
   * Also driven automatically when `activeIndex` is set on the component.
   */
  itemStatus?: TimelineItemStatus;
  /** Avatar image URL — used in `displayMode='feed'`. */
  avatarUrl?: string;
  /** Actor/author name — used in `displayMode='feed'`. */
  actorName?: string;
  /** Optional card image URL — used in `displayMode='rich'`. */
  imageUrl?: string;
  /** Tag chips — used in `displayMode='rich'`. */
  tags?: string[];
  /** CTA button label — used in `displayMode='rich'`. */
  actionLabel?: string;
  /** CTA href — used in `displayMode='rich'`. */
  actionUrl?: string;
  /**
   * Date group header for `groupByDate=true`.
   * Consecutive items sharing the same value are grouped under one header.
   *
   * ★★ A LABEL, NOT A DATE. The component never parses it and never derives a
   *    day from `timestamp`: "Tuesday" depends on the reader's zone (23:30 in
   *    Berlin is Wednesday in Auckland), so resolve the day in the zone you want
   *    displayed and pass the finished label — e.g. `'Tue 14 May'`.
   */
  groupDate?: string;
}

export interface TimelineGroup {
  date: string;
  items: TimelineItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIANT_DOT: Record<TimelineVariant, string> = {
  success: 'bg-accent-500 ring-accent-100 dark:ring-accent-900/40',
  error:   'bg-danger-500   ring-danger-100   dark:ring-danger-900/40',
  warning: 'bg-warning-400 ring-warning-100 dark:ring-warning-900/40',
  info:    'bg-info-500   ring-info-100   dark:ring-info-900/40',
  neutral: 'bg-gray-400  ring-gray-100  dark:ring-gray-800',
  primary: 'bg-brandaccent-600 ring-brandaccent-100 dark:ring-brandaccent-900/40',
  brand:   'bg-brand-600 ring-brand-100 dark:ring-brand-900/40',
};

const VARIANT_PULSE: Record<TimelineVariant, string> = {
  success: 'bg-accent-400',
  error:   'bg-danger-400',
  warning: 'bg-warning-300',
  info:    'bg-info-400',
  neutral: 'bg-gray-300',
  primary: 'bg-brandaccent-400',
  brand:   'bg-brand-400',
};

/** Status glyphs for `showVariantIcon` — free-tier icon names only. */
const VARIANT_GLYPH: Partial<Record<TimelineVariant, string>> = {
  success: 'check',
  error:   'close',
  warning: 'alert-triangle',
  info:    'info',
};

const TAG_COLORS = [
  'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300',
  'bg-pink-100   text-pink-700   dark:bg-pink-900/30   dark:text-pink-300',
  'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/30   dark:text-cyan-300',
];

/**
 * Avatar-fallback fills, drawn behind `text-white text-xs font-bold`.
 *
 * ★★ STEP 700, NOT 500, AND THE STEP IS THE WHOLE POINT. White on these hues at
 *    500 fails AA in SEVEN of the eight arms — amber 2.13:1, cyan 2.37:1,
 *    emerald 2.47:1, pink 3.58:1, rose 3.75:1, blue 3.76:1, violet 4.40:1 — and
 *    only indigo (4.58:1) cleared. 700 is the first step where all eight pass:
 *    worst is amber at 5.03:1.
 *
 * ★ An axe sweep reported only TWO of those seven, because `avatarBg()` hashes
 *   the actor's name and the demo data only ever landed on emerald and amber.
 *   Which arms a scan can see depends on the fixture, so the palette has to be
 *   checked by computing every arm, not by rendering some of them. Keep that in
 *   mind before adding a hue here: the tool will not catch it.
 *
 * The eight stay literal on purpose — this is a deterministic identity cycle, so
 * two adjacent people must read as visibly different, which a semantic family
 * cannot promise. See scripts/theme-literal.allow.json.
 */
const AVATAR_COLORS = [
  'bg-blue-700', 'bg-violet-700', 'bg-emerald-700', 'bg-amber-700',
  'bg-pink-700',  'bg-cyan-700',  'bg-indigo-700',  'bg-rose-700',
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TimelineComponent — A versatile, multi-mode event sequence visualizer.
 *
 * ## Layouts
 * - `left` (default): vertical, connector column on the left
 * - `right`: vertical, connector column on the right, content on left
 * - `alternate`: true zigzag — items alternate sides of a center line
 * - `horizontal`: items along a horizontal connector; content alternates top/bottom
 *
 * ## Display Modes
 * - `default`: standard dot / icon content card
 * - `feed`: compact activity feed with actor avatars
 * - `status`: order/progress tracker with complete / active / pending states
 * - `rich`: card-based content with optional image, tags, and CTA button
 *
 * ## Dot Styles
 * - `dot` (default): filled circle with optional icon
 * - `number`: numbered step badges (1, 2, 3…)
 * - `check`: checkmark for complete, pulsing ring for active, hollow for pending
 *
 * ## Other Features
 * - `groupByDate=true`: groups items under date header separators
 * - `activeIndex`: drives step state for `check` / `number` modes
 * - Full dark-mode, 3 sizes (sm / md / lg), accessible ordered-list markup
 *
 * @example
 * ```html
 * <sv-timeline [items]="events" />
 * <sv-timeline [items]="steps" dotStyle="number" [activeIndex]="2" />
 * <sv-timeline [items]="steps" dotStyle="check" [activeIndex]="2" />
 * <sv-timeline [items]="feedItems" displayMode="feed" />
 * <sv-timeline [items]="statusItems" displayMode="status" />
 * <sv-timeline [items]="richItems" displayMode="rich" />
 * <sv-timeline [items]="events" layout="alternate" />
 * <sv-timeline [items]="events" layout="right" />
 * <sv-timeline [items]="events" layout="horizontal" horizontalAlign="alternate" />
 * <sv-timeline [items]="groupedItems" [groupByDate]="true" />
 * ```
 */
/** Which end of the timeline is being extended. */
export type TimelineLoadDirection = 'older' | 'newer';

/** Asking for another page of events. */
export interface TimelineLoadMoreEvent {
  readonly direction: TimelineLoadDirection;
  /** Events currently rendered — the offset to page from. */
  readonly loaded: number;
}

@Component({
  selector: 'sv-timeline',
  standalone: true,
  imports: [
    NgClass,
    SvIconComponent,
    SvSkeletonShellComponent,
    SvErrorShellComponent,
    SvEmptyShellComponent,
  ],
  templateUrl: './timeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvTimelineComponent {

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Array of timeline events to render. */
  items = input<readonly TimelineItem[]>([]);

  /** Structural layout direction. @default 'left' */
  layout = input<TimelineLayout>('left');

  /** Component size preset. @default 'md' */
  size = input<TimelineSize>('md');

  /** Show connector lines between dots. @default true */
  showConnector = input<boolean>(true);

  /** Additional CSS classes on the root element. */
  customClass = input<string>('');

  /**
   * What this timeline is, e.g. `'Deployment history'` — names the list and, in
   * the horizontal layout, the scrollable region a keyboard user tabs into.
   *
   * ★ Every list here used to be hardcoded `aria-label="Timeline"`. A release
   *   page with a deploy log beside an audit trail announced both as "Timeline",
   *   which is the role restated and no help in telling them apart. Left unset,
   *   the layout's own generic name is kept. Matches `sv-timeline-pro`.
   *
   * @default ''
   */
  ariaLabel = input<string>('');

  /** Dot rendering style. @default 'dot' */
  dotStyle = input<TimelineDotStyle>('dot');

  /** Content display mode. @default 'default' */
  displayMode = input<TimelineDisplayMode>('default');

  /**
   * What the list means. `'auto'` infers it from `displayMode`. @default 'auto'
   *
   * ★★ Separate from `displayMode` on purpose: one is appearance and one is
   * meaning, and a host that picks `rich` because it reads better should not
   * thereby change what a screen reader is told. `'auto'` keeps the old
   * INFERENCE — `feed` from `displayMode='feed'`, `process` from `'status'` or a
   * ticked/numbered `dotStyle`, `chronology` otherwise — but not every old
   * announcement: an inferred chronology with an active item now says
   * `aria-current="true"` where it used to say nothing, and each list is named
   * after its intent. Set `intent` explicitly to pin the semantics.
   */
  intent = input<TimelineIntent | 'auto'>('auto');

  /**
   * Zero-based index of the currently active step.
   * Items before → `complete`; this item → `active`; after → `pending`.
   * Defaults to `-1` (uses each item's own `itemStatus`).
   */
  activeIndex = input<number>(-1);

  /**
   * Group consecutive items under the `groupDate` header they share.
   *
   * ★★★ THE COMPONENT NEVER DERIVES A DAY FROM A TIMESTAMP, AND THAT IS THE ZONE
   *     POLICY. "Tuesday" depends on who is reading — an event at 23:30 in
   *     Berlin is Wednesday in Auckland and still Tuesday in New York — so a
   *     component that grouped by parsing a timestamp would have to pick
   *     somebody's Tuesday, and any choice is wrong for the others. `groupDate`
   *     is a LABEL the host supplies, already resolved in the zone it wants
   *     displayed, and consecutive items sharing it are grouped. That makes the
   *     zone the host's decision, which is the only place it can correctly be
   *     made. Same policy as `sv-timeline-pro`.
   * @default false
   */
  groupByDate = input<boolean>(false);

  /**
   * Show only this many items until the reader asks for the rest. `0` shows all.
   *
   * ★★ A LONG HISTORY IS NOT A LIST, IT IS A WALL. Five hundred entries push
   *    everything else off the page and cost a screen-reader user five hundred
   *    stops to get past.
   *
   * ★ This is in the FREE tier deliberately. A timeline that becomes unusable at
   *   scale is the defect, not a smaller version of one — and without it a free
   *   host can only mitigate a long history by not receiving it.
   * @default 0
   */
  collapseAfter = input<number>(0);

  /**
   * Whether the collapsed remainder is currently shown (two-way).
   *
   * A `model` so a host can persist it: a reader who expanded a history and
   * navigated away should not have to expand it again.
   * @default false
   */
  expanded = model<boolean>(false);

  /** Content placement for `layout='horizontal'`. @default 'alternate' */
  horizontalAlign = input<TimelineHorizontalAlign>('alternate');

  /**
   * Draw a status glyph inside `success` / `error` / `warning` / `info` dots
   * that have no `item.icon` of their own — a tick, a cross, a triangle, an "i".
   *
   * ★ The dot's meaning is already announced (see `variantLabel`), but for a
   *   sighted reader it was still a hue alone. A shape survives colour-vision
   *   deficiency, greyscale printing and a theme that happens to put two tones
   *   close together. Opt-in so existing plain dots are unchanged.
   * @default false
   */
  showVariantIcon = input<boolean>(false);

  // ── Async state ─────────────────────────────────────────────────────────────

  /**
   * True while the first page of events is being fetched. Replaces the
   * timeline with a placeholder. For an additional page use `loadingOlder` or
   * `loadingNewer`, which keep the events already on screen.
   * @default false
   */
  loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  /** Copy for the empty state. @default 'No events to show' */
  emptyMessage = input<string>('No events to show');

  // ── Paging, in both directions ──────────────────────────────────────────────
  //
  // A timeline is the one collection that genuinely pages *backwards*: the
  // newest events are at one end and history runs off the other, so "older"
  // and "newer" are separate cursors and either can run out first.

  /** Older events exist further back in history. @default false */
  hasOlder = input<boolean>(false);

  /** True while the previous page of history is being fetched. @default false */
  loadingOlder = input<boolean>(false);

  /** Newer events exist — for a feed that is still being written to. @default false */
  hasNewer = input<boolean>(false);

  /** True while newer events are being fetched. @default false */
  loadingNewer = input<boolean>(false);

  // ── Interaction (displayMode='interactive' / 'rich') ───────────────────────

  /**
   * Currently selected item id (two-way). Use `[(selectedId)]` with
   * `displayMode="interactive"` for a selectable timeline. @default null
   */
  selectedId = model<string | number | null>(null);

  /**
   * Emitted when an interactive row is activated (click / Enter / Space).
   * Only fires when `displayMode='interactive'`.
   */
  itemClick = output<TimelineItem>();

  /**
   * Emitted when a `rich`-card CTA button is activated. Fires alongside any
   * `actionUrl` navigation so you can handle the action in code.
   */
  actionClick = output<TimelineItem>();

  /**
   * The user asked for another page.
   *
   * `direction` says which end: `'older'` for history below, `'newer'` for a
   * feed that has moved on above.
   */
  loadMore = output<TimelineLoadMoreEvent>();

  /** The host should re-run the failed load. */
  retry = output<void>();

  /** Whether the timeline has nothing to show. */
  readonly isEmpty = computed(() => this.items().length === 0);

  /** Ask the host for another page at one end. */
  onLoadMore(direction: TimelineLoadDirection): void {
    this.loadMore.emit({ direction, loaded: this.items().length });
  }


  /** True when the given item is the selected one (interactive mode). */
  isSelected(item: TimelineItem): boolean {
    return this.selectedId() !== null && this.selectedId() === item.id;
  }

  /** Activate an interactive row: toggle selection + emit `itemClick`. */
  onItemActivate(item: TimelineItem): void {
    if (this.displayMode() !== 'interactive') return;
    this.selectedId.set(item.id);
    this.itemClick.emit(item);
  }

  /** Enter/Space activates an interactive row (keyboard parity with click). */
  onItemKeydown(event: KeyboardEvent, item: TimelineItem): void {
    if (this.displayMode() !== 'interactive') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onItemActivate(item);
    }
  }

  /**
   * Human-readable status label used for screen-reader step announcements.
   *
   * ★ Without this the completed / current / pending state of a step was
   * carried by the dot's COLOUR AND SHAPE ALONE, so a screen-reader user
   * following an order tracker heard three indistinguishable list items and
   * could not tell what had already happened. WCAG 1.4.1 and 1.3.1. The Pro
   * twin has always had it; this is the same method, verbatim.
   */
  stepStatusLabel(status: TimelineItemStatus): string {
    switch (status) {
      case 'complete': return 'Completed';
      case 'active':   return 'Current step';
      default:         return 'Pending';
    }
  }

  /** Rich-card CTA handler: emit `actionClick`; suppress the '#' jump when no `actionUrl`. */
  onActionClick(item: TimelineItem, event: MouseEvent): void {
    if (!item.actionUrl) event.preventDefault();
    this.actionClick.emit(item);
  }

  // ── Computed size tokens ──────────────────────────────────────────────────

  dotSize = computed<string>(() => ({
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  })[this.size()]);

  iconSize = computed<string>(() => ({
    sm: 'h-3.5 w-3.5',
    md: 'h-4   w-4',
    lg: 'h-5   w-5',
  })[this.size()]);

  numberSize = computed<string>(() => ({
    sm: 'text-xs  font-bold',
    md: 'text-sm  font-bold',
    lg: 'text-base font-bold',
  })[this.size()]);

  titleClass = computed<string>(() => ({
    sm: 'text-sm   font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-lg   font-semibold',
  })[this.size()]);

  descClass = computed<string>(() => ({
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm',
  })[this.size()]);

  timeClass = computed<string>(() => ({
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  })[this.size()]);

  // ── Grouped items ─────────────────────────────────────────────────────────

  groupedItems = computed<TimelineGroup[]>(() => {
    const result: TimelineGroup[] = [];
    let currentDate: string | null = null;
    // ★ From the VISIBLE items, so `collapseAfter` truncates the grouped layout
    //   too — grouping `items()` rendered every entry and left "Show N more"
    //   promising a remainder that was already on screen.
    for (const item of this.visibleItems()) {
      const date = item.groupDate ?? '';
      if (date !== currentDate) {
        result.push({ date, items: [] });
        currentDate = date;
      }
      result[result.length - 1].items.push(item);
    }
    return result;
  });

  // ── Per-item helpers ──────────────────────────────────────────────────────

  dotClass(item: TimelineItem): string {
    return VARIANT_DOT[item.variant ?? 'neutral'];
  }

  /**
   * The dot's meaning in words, or `null` where its colour has none.
   *
   * ★★★ `item.variant` REACHED THE PAGE AS A HUE AND NOTHING ELSE. A red dot on a
   *     deploy log is the failed deploy — the one row the reader is looking for —
   *     and outside the two stepper display modes (which already announce their
   *     step status) no text anywhere carried it. WCAG 1.4.1: colour cannot be
   *     the sole means of conveying information.
   *
   * `neutral`, `primary` and `brand` return `null` on purpose: they are the
   * theming defaults, not a state, and announcing "Primary" before every title
   * would be noise a listener has to wade through on every single item.
   */
  variantLabel(item: TimelineItem): string | null {
    switch (item.variant) {
      case 'success': return 'Success';
      case 'error':   return 'Error';
      case 'warning': return 'Warning';
      case 'info':    return 'Information';
      default:        return null;
    }
  }

  /**
   * The intent actually in force.
   *
   * ★ The `dotStyle` arm is backwards compatibility, not design: it is the
   * inference the default branch was already making, kept so no existing usage
   * changes what it announces. A host that means "process" should say so.
   */
  readonly resolvedIntent = computed<TimelineIntent>(() => {
    const explicit = this.intent();
    if (explicit !== 'auto') return explicit;
    if (this.displayMode() === 'feed') return 'feed';
    if (this.displayMode() === 'status') return 'process';
    if (this.dotStyle() === 'check' || this.dotStyle() === 'number') return 'process';
    return 'chronology';
  });

  /** The default accessible name, which is the intent said out loud. */
  readonly intentLabel = computed<string>(() => {
    switch (this.resolvedIntent()) {
      case 'process': return 'Progress tracker';
      case 'feed':    return 'Activity feed';
      default:        return 'Timeline';
    }
  });

  /**
   * What `aria-current` should say for the item the reader is on.
   *
   * ★★ `'step'` is a claim about a PROCESS — it means "this is the step you are
   * at, out of a sequence you are working through". A chronology has a current
   * item but no steps, so it says `'true'`; a feed has no position at all, so it
   * says nothing rather than inventing one.
   */
  currentValue(isActive: boolean): string | null {
    if (!isActive) return null;
    switch (this.resolvedIntent()) {
      case 'process': return 'step';
      case 'feed':    return null;
      default:        return 'true';
    }
  }

  /** The list's accessible name: the host's, or the one its intent implies. */
  listLabel(fallback: string): string {
    return this.ariaLabel().trim() || fallback;
  }

  /**
   * A date group's accessible name: the list's own name plus the group label,
   * so `ariaLabel` and `intent` reach the grouped layout as well.
   */
  groupListLabel(date: string): string {
    const base = this.listLabel(this.intentLabel());
    return date ? `${base}, ${date}` : base;
  }

  /**
   * The glyph drawn inside a variant dot: the item's own `icon`, else — with
   * `showVariantIcon` — the status glyph for its variant, else none.
   */
  dotIcon(item: TimelineItem): string | null {
    if (item.icon) return item.icon;
    if (!this.showVariantIcon()) return null;
    return VARIANT_GLYPH[item.variant ?? 'neutral'] ?? null;
  }

  pulseClass(item: TimelineItem): string {
    return VARIANT_PULSE[item.variant ?? 'primary'];
  }

  isLast(index: number): boolean {
    // ★ Against the VISIBLE list. The template loops `visibleItems()`, so
    //   measuring against `items()` leaves the connector drawing past the last
    //   rendered row whenever a collapse is active.
    return index === this.visibleItems().length - 1;
  }

  /**
   * The items actually rendered — the host's order, truncated at the tail.
   *
   * ★ Which end is "recent" depends on whether the host sorted newest-first or
   *   oldest-first, and the component cannot know.
   */
  readonly visibleItems = computed<readonly TimelineItem[]>(() => {
    const limit = this.collapseAfter();
    const all = this.items();
    if (this.expanded() || !Number.isFinite(limit) || limit <= 0 || all.length <= limit) {
      return all;
    }
    return all.slice(0, limit);
  });

  /** How many items the collapse is holding back. */
  readonly hiddenCount = computed(() => this.items().length - this.visibleItems().length);

  /** The expand control's label, stating the count rather than "show more". */
  readonly expandLabel = computed(() => {
    const hidden = this.hiddenCount();
    return hidden === 1 ? 'Show 1 more entry' : `Show ${hidden} more entries`;
  });

  /** Toggle the collapsed remainder. */
  toggleExpanded(): void {
    this.expanded.update(v => !v);
  }

  isFirst(index: number): boolean {
    return index === 0;
  }

  isLastInGroup(groupIndex: number, itemIndex: number): boolean {
    return itemIndex === this.groupedItems()[groupIndex].items.length - 1;
  }

  isLastGroup(groupIndex: number): boolean {
    return groupIndex === this.groupedItems().length - 1;
  }

  trackById(_: number, item: TimelineItem): string | number {
    return item.id;
  }

  trackByDate(_: number, group: TimelineGroup): string {
    return group.date;
  }

  // ── Stepper helpers ───────────────────────────────────────────────────────

  stepStatus(index: number, item: TimelineItem): TimelineItemStatus {
    const active = this.activeIndex();
    if (active >= 0) {
      if (index < active)   return 'complete';
      if (index === active) return 'active';
      return 'pending';
    }
    return item.itemStatus ?? 'pending';
  }

  stepConnectorClass(status: TimelineItemStatus): string {
    if (status === 'complete') return 'bg-accent-400 dark:bg-accent-700';
    if (status === 'active')   return 'bg-brandaccent-300 dark:bg-brandaccent-700';
    return 'bg-gray-200 dark:bg-gray-700 opacity-50';
  }

  // ── Horizontal layout helpers ─────────────────────────────────────────────

  showTopContent(index: number): boolean {
    const align = this.horizontalAlign();
    if (align === 'top')    return true;
    if (align === 'bottom') return false;
    return index % 2 === 0;
  }

  showBottomContent(index: number): boolean {
    return !this.showTopContent(index);
  }

  // ── Tag / avatar color helpers ────────────────────────────────────────────

  tagColor(tag: string): string {
    const hash = tag.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return TAG_COLORS[hash % TAG_COLORS.length];
  }

  avatarBg(name?: string): string {
    if (!name) return AVATAR_COLORS[0];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  avatarInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
}
