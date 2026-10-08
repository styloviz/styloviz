import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  model,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  untracked,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  SvLiveAnnouncer,
  svNavParam,
  svNavRecorder,
  svAttrSelector,
  svRecoverFocus,
  svUniqueId,
  svWarnOnce,
  type SvNavIntent,
  type SvUnresolvedValue,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabsStyle  = 'underline' | 'pills' | 'boxed' | 'lifted' | 'border-card' | 'unstyled';
export type TabsSize   = 'sm' | 'md' | 'lg';
export type TabsLayout = 'horizontal' | 'vertical';

/**
 * What the arrow keys do — `NV-06-M1`.
 *
 * - `'automatic'` — arrowing to a tab selects it. Selection follows focus.
 * - `'manual'` — arrowing moves focus only; Enter or Space selects the focused
 *   tab. The WAI-ARIA tabs pattern's other half, and the one to use when a panel
 *   costs something to show.
 */
export type TabsActivation = 'automatic' | 'manual';

/**
 * What happens to a `lazy` panel when the user switches away from it —
 * `NV-06-I4`, `NV-06-M4`.
 *
 * - `'retain'` — it stays mounted, with its DOM and its state, for the lifetime
 *   of the strip. Visited once, never rebuilt.
 * - `'destroy'` — it is removed on switch and rebuilt from scratch on the next
 *   visit. Anything the user typed into it is gone.
 */
export type TabsLazyRetention = 'retain' | 'destroy';

/** A single tab definition. */
export interface TabItem {
  /** Unique key — used as the active-tab identifier. */
  id:        string;
  /** Display label. */
  label:     string;
  /**
   * ★ BREAKING (icon sweep): an icon-library NAME shown before the label —
   * `'star'`, `'settings'` — resolved through `@styloviz/icons`.
   *
   * It used to hold a raw SVG `<path d="…">` despite already being called
   * `icon`, and the type is `string` either way, so **the compiler cannot tell
   * the two apart**. A host still passing a path gets a silently blank slot.
   */
  icon?: string;
  /**
   * Keep this tab's content out of the DOM until the tab is first activated.
   *
   * **Once visited, the panel is retained** — it stays mounted, with its DOM and
   * its state, for the lifetime of the strip, so a half-filled form in a lazy
   * panel survives switching away and back. That is the default contract, not an
   * accident of the implementation; set `lazyRetention="destroy"` on `<sv-tabs>`
   * to unmount on switch instead. See {@link SvTabsComponent.lazyRetention}.
   *
   * ⚠️ With the default `activation="automatic"`, arrowing across the strip
   * activates each tab it passes, so a lazy panel that loads data loads it once
   * per keypress. `activation="manual"` is the fix — see
   * {@link SvTabsComponent.activation}. @default false
   */
  lazy?:     boolean;
  /** Prevent the user from switching to this tab. @default false */
  disabled?: boolean;
  /** Small badge text (e.g. count). */
  badge?:    string;
  /** Small unread/status dot rendered next to the label (independent of `badge`). @default false */
  dot?:      boolean;
  /**
   * Shows a close (×) affordance on the tab and emits `tabClose` when the user
   * clicks it — or presses Delete/Backspace with the tab focused, which is the
   * keyboard path, since ARIA leaves no valid placement for a focusable close
   * button inside a `tablist`. @default false
   */
  closable?: boolean;
}

// ─── Tab Panel Directive ──────────────────────────────────────────────────────

/**
 * TabPanelDirective — marks a `<ng-template>` as content for a specific tab.
 *
 * Usage:
 * ```html
 * <sv-tabs [tabs]="tabs" [(activeId)]="active">
 *   <ng-template svTabPanel="settings">Settings content…</ng-template>
 *   <ng-template svTabPanel="profile">Profile content…</ng-template>
 * </sv-tabs>
 * ```
 */
@Directive({
  selector: '[svTabPanel]',
  standalone: true,
})
export class SvTabPanelDirective {
  /** Must match a `TabItem.id`. */
  tabId = input.required<string>({ alias: 'svTabPanel' });

  readonly templateRef = inject(TemplateRef<unknown>);
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Tabs — A horizontal (or vertical) tab switcher with content projection.
 *
 * Features:
 * - 6 visual styles: underline · pills · boxed · lifted · border-card · unstyled
 * - `unstyled` strips all decorative classes for fully headless theming — pairs with the
 *   `data-active`/`data-disabled` attributes exposed on every tab button for custom CSS
 * - `border-card` wraps the tab row and panel in one cohesive bordered card
 * - Horizontal and vertical layout modes
 * - Keyboard navigation: ← → (horizontal) / ↑ ↓ (vertical), wrapping at both
 *   ends, plus Home and End. Disabled tabs are skipped, not landed on.
 * - Both WAI-ARIA activation modes: `automatic` (arrows select, the default) and
 *   `manual` (arrows move focus, Enter/Space selects) — `NV-06-M1`
 * - Optional icon, badge, unread dot, and closable (× / Delete) tab
 * - Optional horizontal scrolling for tab lists that overflow their container
 * - Disabled tab support
 * - Opt-in lazy rendering — a tab marked `lazy` keeps its panel out of the DOM
 *   until first activated; every other panel is mounted up front and hidden.
 *   A visited lazy panel is **retained** with its state (`NV-06-I4`) unless
 *   `lazyRetention="destroy"` asks for the opposite (`NV-06-M4`)
 * - Two-way `activeId` binding via `model()`
 * - Optional URL synchronisation via `urlKey` (`NV-06-I5`, `NV-06-M3`)
 * - Content projection via `svTabPanel` directive on `<ng-template>` tags
 * - Full dark-mode support
 * - Accessible: `role="tablist"`, `role="tab"`, `role="tabpanel"`,
 *   `aria-selected`, `aria-controls`, `aria-disabled`
 *
 * **Content projection:**
 * ```html
 * <sv-tabs [tabs]="myTabs" [(activeId)]="activeTab">
 *   <ng-template svTabPanel="general">General settings…</ng-template>
 *   <ng-template svTabPanel="security">Security settings…</ng-template>
 * </sv-tabs>
 * ```
 *
 * **No-projection (external panel control):**
 * Omit `<ng-template>` children and react to `(activeIdChange)` instead.
 */
@Component({
  selector: 'sv-tabs',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, SvIconComponent],
  templateUrl: './tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvTabsComponent implements OnDestroy {
  /**
   * Per-instance id prefix.
   *
   * ★ Every element id used to be a global literal built from the tab's own id
   * — `tab-general`, `panel-general`. Two strips on one page (a settings screen,
   * or a tabbed panel inside a tabbed page — the ordinary layout) both claimed
   * them, so `aria-controls` and `aria-labelledby` resolved to the wrong strip's
   * elements and the arrow keys threw focus into the other strip entirely.
   * Same defect as the two speed dials that shared their action ids.
   */
  /*
   * ★ `svUniqueId`, not a module-level counter — `X-10` / `T0-2`.
   *
   * The counter this replaced belonged to the MODULE, so a long-lived server
   * process shared it across requests: the second page it rendered emitted
   * `-2-` while the browser, loading the module for the first time, emitted
   * `-1-`. Server HTML and first client render disagreed, which is a hydration
   * mismatch. Reproduced in `core`'s `unique-id.spec.ts` before it was fixed.
   */
  private readonly uid = svUniqueId('sv-tabs');

  /** DOM id of a tab button. */
  tabDomId(tabId: string): string {
    return `${this.uid}-tab-${tabId}`;
  }

  /** DOM id of a tab panel. */
  panelDomId(tabId: string): string {
    return `${this.uid}-panel-${tabId}`;
  }

  /** DOM id of the sr-only sentence that tells AT how to close a tab. */
  readonly closeHintId = `${this.uid}-close-hint`;

  private readonly host = inject(ElementRef);
  private readonly announcer = inject(SvLiveAnnouncer);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Tab definitions in display order. */
  tabs = input<TabItem[]>([]);

  /** ID of the currently active tab. Use `[(activeId)]` for two-way binding. */
  activeId = model<string>('');

  /** Visual style variant. @default 'underline' */
  tabsStyle = input<TabsStyle>('underline');

  /** Size of the tab text and icons. @default 'md' */
  size = input<TabsSize>('md');

  /** Layout direction. @default 'horizontal' */
  layout = input<TabsLayout>('horizontal');

  /**
   * Whether tab buttons stretch to fill all available width.
   * Only applicable to the `'horizontal'` layout. @default false
   */
  fullWidth = input<boolean>(false);

  /**
   * Allows the tab list to scroll horizontally instead of wrapping/overflowing
   * when there are more tabs than fit the available width. @default false
   */
  scrollable = input<boolean>(false);

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  /*
   * ── Rationale, deliberately NOT a JSDoc (see the `urlKey` note) ─────────────
   *
   * ── ★ Why the default is `'automatic'`, and why the input is nullable ───────
   *
   * `NV-06-M1`'s position is that **manual is the correct default for anything
   * expensive**, and on the merits it is right: with `lazy` panels, automatic
   * activation fires a data load per arrow keypress, so a keyboard user crossing
   * a six-tab strip triggers five fetches nobody asked for.
   *
   * It is still not a default this component can take. Automatic is what every
   * existing consumer's keyboard flow does today, it is what the APG names first,
   * and it is right for the ordinary case — cheap, already-mounted panels, where
   * selection following focus is fewer keystrokes and the ARIA pattern's
   * preferred shape. Flipping it would silently change the behaviour of every
   * strip in every app on a package upgrade, and the symptom — "the arrow keys
   * stopped working" — points nowhere near the release note that caused it.
   *
   * ★ So the cost is answered where the cost actually is, and **not** by guessing
   * the mode from `lazy`: a strip with a lazy tab still gets `'automatic'`, and
   * gets a dev-only warning naming the fix. Inferring the mode instead would mean
   * adding `lazy: true` to one tab silently re-specifies the keyboard for the
   * whole strip — a second invisible behaviour change, bought to avoid the first.
   *
   * That warning is why the input is `TabsActivation | null` rather than plain
   * `TabsActivation`: `null` is *"the host has not chosen"*, which is the only
   * state worth warning about. Passing `activation="automatic"` explicitly means
   * the host has weighed it and is silent by design — a warning you cannot switch
   * off by answering it is a warning people switch off entirely.
   */

  /**
   * Whether the arrow keys select the tab they move to (`'automatic'`) or only
   * move focus, leaving Enter/Space to select (`'manual'`).
   *
   * Prefer `'manual'` when a panel costs something to show — `lazy` panels that
   * fetch, heavy charts, anything a keyboard user should not trigger five times
   * on the way past. Leaving it unset resolves to `'automatic'`, and logs a
   * dev-only warning if any tab is `lazy`.
   * @default null — resolves to `'automatic'`
   */
  activation = input<TabsActivation | null>(null);

  /**
   * What happens to a `lazy` panel the user switches away from: `'retain'` keeps
   * it mounted with its state (the long-standing behaviour), `'destroy'` unmounts
   * it and rebuilds it on the next visit.
   *
   * Only `lazy` tabs are affected — a panel that was never deferred is never
   * destroyed. Choose `'destroy'` for panels that must re-read their data on every
   * visit, or hold enough DOM that keeping several alive is the real cost; and
   * know that it discards whatever the user typed. `NV-06-M4`.
   * @default 'retain'
   */
  lazyRetention = input<TabsLazyRetention>('retain');

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   * `scripts/generate-component-docs.mjs` extracts an input's JSDoc verbatim into
   * the README's API table and into `/docs`, as ONE table cell — so the reasoning
   * lives in this plain block comment, where a reader of the code finds it and a
   * generator does not, and the consumer-facing sentence stays in the doc comment
   * below. (Note the plain opener: a closing-delimiter sequence written inside a
   * doc comment ends it early and silently swallows whatever follows.) Same split
   * as `sv-pagination`.
   *
   * Two opt-ins, both load-bearing. Nothing synchronises until the app provides a
   * location AND this instance names a key. The app-level opt-in exists so that
   * upgrading a package cannot start rewriting a consumer's address bar. The
   * instance-level one exists because a tabbed panel inside a tabbed page is an
   * ordinary layout, and **two strips cannot both own `?tab`** — give the inner
   * one `urlKey="section"`.
   *
   * ★ Writes REPLACE rather than push, which is the opposite of `sv-pagination`'s
   * answer on this same seam. Paging forward is a step through a result set, and
   * back means "the page I was on"; switching tabs is choosing a view of one
   * thing, and a reader who pressed back after reading three tabs means "leave
   * this page", not "undo two of my clicks". The ADR's table says the same in one
   * word: for Tabs, back leaves the page.
   *
   * The full contract, and the other six families' answers, are in
   * `docs/navigation-routing-adr.md`. `NV-06-I5`, `NV-06-M3`.
   */

  /**
   * Put the active tab in the URL under this key, so a tab can be shared and
   * survives a refresh. Needs `provideSvNavLocation()` at the app root; give a
   * nested tab strip a different key.
   * @default null — no URL synchronisation
   */
  urlKey = input<string | null>(null);

  /**
   * Names this tabset in the shared navigation-analytics stream (`X-15`), when
   * a page has more than one. Ignored unless `provideSvNavTelemetry()` is
   * wired up.
   * @default null
   */
  surfaceId = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when a closable tab's × is clicked or Delete/Backspace is pressed on it. The tab is NOT removed automatically — remove it from `tabs` yourself. */
  tabClose = output<TabItem>();

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── ★ `X-10`: an active tab id is NOMINAL, so this component reports ────────
   * and does not correct. `sv-pagination` does the opposite on the same question,
   * and the difference is the kind of value: page 7 of 3 has a nearest valid
   * value and it is obviously 3, but `activeId="xyz"` has no nearest tab.
   * Substituting the first one is a guess about what the host meant, and **a
   * guess that renders confidently is worse than rendering nothing** — nothing is
   * visibly wrong, and a wrong tab is not.
   *
   * So the tested contract stays exactly as it was: *"the host owns `activeId`;
   * the fallback only applies when it is empty"*, and an id naming no tab shows
   * no panel. `NV-06-I3` was never an oversight. What was missing is the second
   * half of that sentence — the host was never TOLD, which is why the audit
   * called it silent.
   *
   * ── And the report waits for `tabs` to arrive ───────────────────────────────
   * `tabs()` is `[]` until a fetch lands, and every id is unknown at that moment.
   * Reporting then would cry wolf on every async host on first paint, so an empty
   * list reports `'not-loaded'` — the same rule the URL reader follows, for the
   * same reason.
   */

  /**
   * Emitted when `activeId` names a tab this component cannot show — `X-10`,
   * `NV-06-I3`. Reports; never corrects, because there is no nearest tab to
   * correct to.
   */
  unresolved = output<SvUnresolvedValue<string>>();

  // ── Content children (panel templates) ───────────────────────────────────

  private panels = contentChildren(SvTabPanelDirective);

  /** Look up the TemplateRef for a given tab ID. Returns null when no panel registered. */
  panelFor(tabId: string): TemplateRef<unknown> | null {
    return this.panels().find(p => p.tabId() === tabId)?.templateRef ?? null;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /**
   * Tracks which tab IDs have been activated at least once.
   * Used for lazy-rendering: a panel is only projected into the DOM
   * after the user first visits that tab.
   */
  activatedIds = signal<Set<string>>(new Set());

  /**
   * The tab focus is on while it differs from the selected one — `null` whenever
   * focus is outside the strip, or on the selected tab.
   *
   * Only `'manual'` activation can produce a non-null value: under `'automatic'`
   * selection follows focus, so the two are never apart.
   */
  private readonly focusedId = signal<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Resolved activation mode — see the note above {@link activation}. */
  resolvedActivation = computed<TabsActivation>(() => this.activation() ?? 'automatic');

  /** Resolved active ID — falls back to first enabled tab when empty. */
  resolvedActiveId = computed<string>(() => {
    const id = this.activeId();
    if (id) return id;
    return this.tabs().find(t => !t.disabled)?.id ?? '';
  });

  navigableTabs = computed(() => this.tabs().filter(t => !t.disabled));

  /**
   * The one tab in the page's tab order — `tabindex="0"`, everything else `-1`.
   *
   * ★ Under `'manual'` activation this is **not** the selected tab: focus and
   * selection come apart, and the tab order has to follow *focus*, or Tab-ing out
   * and back would jump the user somewhere they did not leave from.
   * `aria-selected` stays on the selected tab regardless — the two attributes
   * answer different questions, and conflating them is the usual way a manual
   * tablist ends up announcing the wrong tab as current.
   *
   * The membership check is what handles a focused tab being removed or disabled
   * out from under the cursor: the fallback is the selected tab, so the strip is
   * never left with no tabbable stop.
   *
   * ★ `NV-06-I1` / `NV-06-M2`: **and the selected tab can be gone too.** Close
   * the active tab and a host that only filters `tabs` leaves `activeId` naming
   * the removed one. That is a claim this component reports and does not
   * correct (`unresolved`, `X-10`) — but the *tab order* is not the host's
   * model, it is this strip's reachability. Following a dead id put
   * `tabindex="0"` on no rendered tab, so after the recovered focus left the
   * strip, Tab could never reach it again. So when the selected id is not a
   * navigable tab (removed, unknown, or disabled), the stop falls back to the
   * first navigable one. `activeId`, `aria-selected` and the panel are left
   * exactly as the host has them.
   */
  rovingId = computed<string>(() => {
    const navigable = this.navigableTabs();
    const focused = this.focusedId();
    if (focused !== null && navigable.some(t => t.id === focused)) return focused;
    const selected = this.resolvedActiveId();
    if (navigable.some(t => t.id === selected)) return selected;
    return navigable[0]?.id ?? selected;
  });

  /** Whether any tab can be closed — gates the single shared keyboard hint. */
  hasClosableTab = computed<boolean>(() => this.tabs().some(t => t.closable));

  // ── Size maps ─────────────────────────────────────────────────────────────

  tabTextClass = computed<string>(() => ({
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  })[this.size()]);

  tabPadClass = computed<string>(() => {
    const s = this.size();
    const v = this.tabsStyle();
    if (this.layout() === 'vertical') {
      return { sm: 'px-3 py-1.5', md: 'px-4 py-2', lg: 'px-5 py-2.5' }[s];
    }
    if (v === 'boxed' || v === 'lifted' || v === 'border-card') {
      return { sm: 'px-3 py-1.5', md: 'px-4 py-2', lg: 'px-5 py-2.5' }[s];
    }
    return { sm: 'px-2.5 py-1.5', md: 'px-4 py-2.5', lg: 'px-5 py-3' }[s];
  });

  iconClass = computed<string>(() => ({
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  })[this.size()]);

  // ── Root + list classes ───────────────────────────────────────────────────

  rootClasses = computed<string>(() => {
    const base = this.layout() === 'vertical'
      ? 'flex gap-4'
      : 'flex flex-col';
    const cardWrap = this.tabsStyle() === 'border-card'
      ? 'overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      : '';
    return [base, cardWrap, this.customClass()].filter(Boolean).join(' ');
  });

  listClasses = computed<string>(() => {
    const v      = this.tabsStyle();
    const isV    = this.layout() === 'vertical';
    // Horizontal tab lists always allow horizontal scroll: `overflow-x-auto`
    // shows no scrollbar while the tabs fit, and scrolls instead of clipping /
    // forcing page overflow once they don't (e.g. many tabs on a phone). The
    // `scrollable` input still controls whether tabs keep their natural width
    // (`shrink-0`, below) or shrink to fit first.
    const scroll = !isV ? 'overflow-x-auto overflow-y-hidden' : '';

    if (v === 'unstyled') {
      return [
        isV ? 'flex flex-col gap-1 shrink-0' : 'flex gap-1',
        this.fullWidth() && !isV ? 'w-full' : '',
        scroll,
      ].filter(Boolean).join(' ');
    }

    if (v === 'border-card') {
      return [
        isV
          ? 'flex flex-col gap-0 shrink-0 border-r border-gray-200 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-800/30'
          : 'flex gap-0 border-b border-gray-200 bg-gray-50/60 px-2 pt-2 dark:border-gray-800 dark:bg-gray-800/30',
        this.fullWidth() && !isV ? 'w-full' : '',
        scroll,
      ].filter(Boolean).join(' ');
    }

    if (v === 'boxed') {
      return [
        isV ? 'flex flex-col gap-1 shrink-0' : 'flex gap-1',
        'rounded-xl bg-gray-100 p-1 dark:bg-gray-800/60',
        this.fullWidth() && !isV ? 'w-full' : '',
        scroll,
      ].filter(Boolean).join(' ');
    }

    if (v === 'lifted') {
      return [
        isV ? 'flex flex-col gap-0 shrink-0 border-r border-gray-200/80 dark:border-gray-800/60 pr-0'
            : 'flex gap-0 border-b border-gray-200/80 dark:border-gray-800/60',
        this.fullWidth() && !isV ? 'w-full' : '',
        scroll,
      ].filter(Boolean).join(' ');
    }

    if (v === 'pills') {
      return [
        isV ? 'flex flex-col gap-1 shrink-0' : 'flex gap-1',
        this.fullWidth() && !isV ? 'w-full' : '',
        scroll,
      ].filter(Boolean).join(' ');
    }

    // underline (default)
    return [
      isV ? 'flex flex-col gap-0 shrink-0 border-r border-gray-200/80 dark:border-gray-800/60'
          : 'flex gap-0 border-b border-gray-200/80 dark:border-gray-800/60',
      this.fullWidth() && !isV ? 'w-full' : '',
      scroll,
    ].filter(Boolean).join(' ');
  });

  // ── Per-tab classes ───────────────────────────────────────────────────────

  tabClasses(tab: TabItem): string {
    const isActive   = tab.id === this.resolvedActiveId();
    const isDisabled = !!tab.disabled;
    const v          = this.tabsStyle();
    const isV        = this.layout() === 'vertical';
    const fw         = this.fullWidth() && !isV;

    const base = [
      'inline-flex items-center gap-2 font-medium transition-colors duration-150',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      this.tabPadClass(),
      this.tabTextClass(),
      isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      fw ? 'flex-1 justify-center' : '',
      this.scrollable() && !isV ? 'shrink-0' : '',
    ].filter(Boolean);

    if (v === 'unstyled') {
      // No decorative classes — consumers theme via [data-active]/[data-disabled]
      // hooks (see template) and their own CSS/customClass.
    } else if (v === 'border-card') {
      if (isV) {
        base.push('-mr-px rounded-l-lg border border-r-0 border-transparent');
        base.push(isActive
          ? 'border-gray-200 bg-white font-semibold text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white'
          : isDisabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200');
      } else {
        base.push('-mb-px rounded-t-lg border border-b-0 border-transparent');
        base.push(isActive
          ? 'border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white'
          : isDisabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200');
      }
    } else if (v === 'pills') {
      base.push('rounded-lg');
      base.push(isActive
        ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-600'
        : isDisabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200');
    } else if (v === 'boxed') {
      base.push('rounded-lg');
      // gray-600, not the 500 every other variant uses for an inactive tab:
      // `boxed` is the one variant whose list is a filled track
      // (`bg-gray-100`, listClasses above), so its inactive tabs sit on the
      // tint rather than on the page. gray-500 reads 4.39:1 there and 6.87:1
      // once darkened. The other variants' lists are transparent or a hairline
      // border, so their 500 is on white and already clears at 4.84:1.
      base.push(isActive
        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700/80 dark:text-white'
        : isDisabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200');
    } else if (v === 'lifted') {
      if (isV) {
        base.push('border-r-2 -mr-px');
        base.push(isActive
          ? 'border-primary-600 text-gray-900 font-semibold dark:text-white dark:border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
          : isDisabled ? 'border-transparent text-gray-500 dark:text-gray-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600');
      } else {
        base.push('rounded-t-lg border border-b-0 -mb-px');
        base.push(isActive
          ? 'border-gray-200/80 bg-white text-gray-900 dark:border-gray-700/60 dark:bg-gray-900 dark:text-white'
          : isDisabled ? 'border-transparent text-gray-500 dark:text-gray-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-700');
      }
    } else {
      // underline
      if (isV) {
        base.push('border-r-2 -mr-px');
        base.push(isActive
          ? 'border-primary-600 text-gray-900 font-semibold dark:border-primary-500 dark:text-white'
          : isDisabled ? 'border-transparent text-gray-500 dark:text-gray-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600');
      } else {
        base.push('border-b-2 -mb-px');
        base.push(isActive
          ? 'border-primary-600 text-gray-900 font-semibold dark:border-primary-500 dark:text-white'
          : isDisabled ? 'border-transparent text-gray-500 dark:text-gray-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600');
      }
    }

    return base.join(' ');
  }

  // ── Panel visibility ──────────────────────────────────────────────────────

  isPanelVisible(tab: TabItem): boolean {
    return tab.id === this.resolvedActiveId();
  }

  /**
   * Whether a tab's panel belongs in the DOM at all.
   *
   * ★ `lazy` is documented per tab and defaults to false, and this used to
   * ignore it: EVERY panel was deferred until first activation, so the input was
   * published, documented, listed in the generated API reference — and read by
   * no code. A host that needed its content measurable on first paint had no way
   * to ask for it. Same defect class as Time Picker's `min`/`max`.
   *
   * ── The two halves of the lazy contract ─────────────────────────────────────
   *
   * `retain` (the default, and what this has always done): `activatedIds` is
   * additive and never pruned, so **a visited lazy panel stays mounted for the
   * lifetime of the strip** and keeps its DOM and its component state.
   * `NV-06-I4`'s premise — *"a form in a lazy panel loses its input either way"* —
   * is false once the panel has been visited; only the never-visited case has
   * nothing to lose.
   *
   * `destroy` (opt-in): the rule a `lazy` tab starts life under, applied on the
   * way out as well — only the active lazy panel exists, and coming back rebuilds
   * it. `NV-06-M4`.
   */
  isPanelMounted(tab: TabItem): boolean {
    if (!tab.lazy) return true;
    if (this.lazyRetention() === 'destroy') return tab.id === this.resolvedActiveId();
    return this.activatedIds().has(tab.id) || tab.id === this.resolvedActiveId();
  }

  // ── Controlled-value reconciliation (`X-10`) ──────────────────────────────

  /** The last state reported, so a re-render is not a new event. */
  private lastUnresolved: string | null = null;

  /**
   * Tell the host when `activeId` names nothing this component can show.
   *
   * ★ Reports only. See the note on {@link unresolved}: a tab id is a name, and
   * there is no nearest tab to correct to.
   */
  protected readonly reportUnresolved = effect(() => {
    const requested = this.activeId();
    const list = this.tabs();

    untracked(() => {
      if (requested === '') {
        // No claim to honour — `resolvedActiveId` falls back, as documented.
        this.lastUnresolved = null;
        return;
      }

      const match = list.find(t => t.id === requested);
      let reason: SvUnresolvedValue<string>['reason'] | null = null;

      if (!list.length) reason = 'not-loaded';
      else if (!match) reason = 'unknown';
      else if (match.disabled) reason = 'blocked';

      if (reason === null) {
        this.lastUnresolved = null;
        return;
      }

      const key = `${requested}|${reason}`;
      if (key === this.lastUnresolved) return;
      this.lastUnresolved = key;

      this.unresolved.emit({
        requested,
        // `'blocked'` is the one case where something IS rendered: the contract
        // honours a bound id even when it names a disabled tab, so the host is
        // told its rule was bypassed rather than that nothing is showing.
        rendered: reason === 'blocked' ? requested : null,
        reason,
        corrected: false,
      });
    });
  });

  // ── URL synchronisation ───────────────────────────────────────────────────

  /**
   * The active tab's projection into the URL. Inert until `urlKey` is set *and*
   * the app provided a location — see {@link urlKey}.
   *
   * `replace` is the mode, which is `svNavParam`'s default and the ADR's answer
   * for this family: back leaves the page.
   */
  private readonly tabParam = svNavParam(() => this.urlKey());

  /**
   * URL → component. The deep-link and address-bar path.
   *
   * ★ **A value that names no tab is still accepted.** The obvious version
   * refuses anything absent from `tabs()` — and breaks every deep link in an app
   * whose tab definitions arrive with a fetch, because `tabs()` is `[]` until the
   * response lands and *every* id is unknown at that moment. Same shape as
   * `sv-pagination` refusing to clamp against a total it does not have yet: what
   * gets validated is the value's **form**, never its membership of a collection
   * that may not have arrived.
   *
   * What *is* refused is a tab this component can see and would not let a click
   * reach: a present, `disabled` tab. Refusing what is known to be refusable
   * keeps a URL from walking through a gate the UI closes, without guessing
   * about what is merely not here yet. A tab that becomes disabled *after* a
   * deep link activated it is the same reconciliation question as every other
   * family's — `X-10`, still open, and deliberately not answered here.
   */
  protected readonly syncFromUrl = effect(() => {
    const raw = this.tabParam.value();
    if (raw === null || raw === '') return;

    const known = this.tabs().find(t => t.id === raw);
    if (known?.disabled) return;

    untracked(() => {
      if (raw === this.activeId()) return;
      // Marked activated so a `lazy` panel mounts: arriving by deep link is a
      // first activation exactly as a click is.
      this.activatedIds.update(ids => new Set([...ids, raw]));
      this.activeId.set(raw);

      // ★ `resume`, not `jump`. The reader did not press a tab; a deep link or
      //   the back button put them here, and counting those with gestures makes
      //   the browser look like the kit's busiest navigation surface (`X-15`).
      this.nav.record({
        intent: 'resume',
        key: raw,
        label: known?.label ?? null,
        index: this.tabIndexOf(raw),
      });
    });
  });

  /**
   * Component → URL.
   *
   * The first enabled tab writes `null` rather than its own id, because that is
   * what this component renders with no `activeId` at all — `resolvedActiveId`
   * falls back to it. A URL carrying its own default is noise that also makes two
   * identical pages look like two different ones to analytics and to a cache.
   *
   * It writes `resolvedActiveId`, not `activeId`: the resolved one is the tab a
   * reader is actually looking at, and a link has to reproduce what they see.
   */
  protected readonly syncToUrl = effect(() => {
    const active   = this.resolvedActiveId();
    const fallback = this.tabs().find(t => !t.disabled)?.id ?? '';

    untracked(() => {
      if (!this.tabParam.addressable()) return;
      const next = active === '' || active === fallback ? null : active;
      if (this.tabParam.value() !== next) this.tabParam.set(next);
    });
  });


  // ── The shared navigation stream (`X-15`) ──────────────────────────────────

  /**
   * One entry per tab change, in the vocabulary every navigation family shares.
   * Consent and identifier-stripping are the recorder's, not this component's.
   *
   * ★ A tabset is the family where `advance`/`retreat` versus `jump` says the
   *   most: arrowing along a strip and clicking the fifth tab are the same
   *   destination reached two ways, and only one of them means the reader was
   *   reading in order.
   */
  private readonly nav = svNavRecorder('tabs', () => this.surfaceId());

  /** Where `id` sits among the rendered tabs, or `-1`. */
  private tabIndexOf(id: string): number {
    return this.tabs().findIndex(t => t.id === id);
  }

  private moveIntent(previous: number, next: number): SvNavIntent {
    if (previous === -1 || next === -1) return 'jump';
    if (next === previous + 1) return 'advance';
    if (next === previous - 1) return 'retreat';
    return 'jump';
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  selectTab(tab: TabItem): void {
    if (tab.disabled) {
      // ★★ A refusal leaves no other trace. Nothing moved, no panel rendered,
      //    no URL changed — so a tabset whose gating is wrong is invisible to
      //    ordinary analytics and one row here (`X-15`).
      this.nav.record({
        intent: 'blocked',
        key: tab.id,
        label: tab.label,
        index: this.tabIndexOf(tab.id),
        reason: 'disabled',
      });
      return;
    }
    // Focus and selection are together again, so the roving tabindex goes back to
    // following the selection. Cleared even when the tab is already active: a
    // click on the selected tab is how a user ends a manual arrow excursion.
    this.focusedId.set(null);
    if (tab.id === this.resolvedActiveId()) return;

    const from = this.tabIndexOf(this.resolvedActiveId());
    const to = this.tabIndexOf(tab.id);

    this.activatedIds.update(s => new Set([...s, tab.id]));
    this.activeId.set(tab.id);

    this.nav.record({
      intent: this.moveIntent(from, to),
      key: tab.id,
      label: tab.label,
      index: to,
    });
  }

  /**
   * A tab taking focus takes the tab order with it.
   *
   * The arrow handler already sets this, so for keyboard movement the two agree;
   * what this covers is focus arriving any other way — a host calling `.focus()`,
   * the neighbour `svRecoverFocus` lands on after a close, a pointer press. The
   * invariant is worth keeping true for all of them: `tabindex="0"` is on the tab
   * focus is on, never on a tab it is not.
   */
  onTabFocus(tab: TabItem): void {
    this.focusedId.set(tab.id);
  }

  /**
   * Focus leaving the strip entirely returns the tab order to the selected tab.
   *
   * ★ Without this, a manual-activation user who arrows to a tab, changes their
   * mind and Tabs away leaves the strip's single tab stop parked on a tab that is
   * not selected — so Shift-Tab back lands somewhere they never chose, and the
   * next Enter activates it. `relatedTarget` inside the list is a move *within*
   * the strip, which is not leaving.
   */
  onListFocusOut(event: FocusEvent): void {
    const list = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (list && next && list.contains(next)) return;
    this.focusedId.set(null);
  }

  /** Close (×) affordance — emits `tabClose`; the consumer owns removing the tab. */
  onCloseTab(event: Event, tab: TabItem): void {
    event.stopPropagation();
    this.closeTab(tab);
  }

  /**
   * ★★ WHY THE × IS NOT A BUTTON.
   *
   * ARIA gives `tablist` exactly one permitted owned element — `tab` — and gives
   * `tab` "children presentational: true". A close control therefore has no
   * valid home: as a sibling of the tab it is an owned child the tablist may not
   * have, and inside the tab it is content the platform is told to flatten (and,
   * as a `<button>` inside the tab's `<button>`, invalid HTML the parser
   * reparents). Both placements are a real axe violation, and the second is
   * worse for users because a flattened close button may not be exposed at all.
   *
   * So the × is a non-focusable, `aria-hidden` glyph for pointer users, and the
   * keyboard/AT affordance moves onto the tab itself: Delete or Backspace, as
   * the ARIA authoring practices prescribe for deletable tabs, announced through
   * `aria-keyshortcuts` plus one shared `aria-describedby` sentence — the
   * description channel because folding the hint into the label would repeat it
   * inside every tab's accessible *name*.
   *
   * Closing from the keyboard also has to hand focus somewhere, or Delete drops
   * the user out of the strip entirely. The neighbour is chosen before the emit
   * (afterwards this tab is gone from `tabs()`) and focused after the consumer's
   * removal has rendered.
   */
  private closeTab(tab: TabItem): void {
    const all = this.tabs();
    const at  = all.findIndex(t => t.id === tab.id);

    // ★ Chosen BEFORE the emit, because afterwards this tab is gone from
    //   `tabs()` and its neighbours cannot be named.
    //
    //   Next, then previous, then the tablist — `NV-06-M2`'s policy. Next first
    //   because closing a tab is a forward gesture: the user is working through
    //   them, and landing on the one they already dealt with is a step back.
    //
    //   ★ Neighbours among NAVIGABLE tabs only. A disabled tab is `aria-disabled`,
    //   not `disabled`, so it is still focusable — and `svRecoverFocus` would
    //   happily land the user on a tab the arrow keys deliberately skip.
    const next     = all.slice(at + 1).find(t => !t.disabled)?.id ?? null;
    const previous = all.slice(0, Math.max(at, 0)).reverse().find(t => !t.disabled)?.id ?? null;

    this.tabClose.emit(tab);

    const root = this.host.nativeElement as HTMLElement;
    // `svAttrSelector`, not a hand-built `[id="…"]`: a tab id is host data, and
    // one containing `"` would make the selector throw.
    const button = (id: string | null) =>
      id === null ? null : root.querySelector<HTMLElement>(svAttrSelector('id', this.tabDomId(id)));

    // ⚠️ After the consumer's removal has rendered — see `svRecoverFocus`. Too
    //    early and the browser has already moved focus to `<body>`, which is
    //    the thing being avoided. This stays a task rather than
    //    `afterNextRender` because the re-render is the HOST's, not this
    //    component's, and nothing here can wait on it.
    this.schedule(() => {
      svRecoverFocus({
        to: [button(next), button(previous)],
        fallback: root.querySelector('[role="tablist"]'),
        announce: `${tab.label} tab closed.`,
        announcer: this.announcer,
      });
    });
  }

  /** Pending focus tasks, cancelled on destroy so none outlives the component. */
  private readonly pending = new Set<ReturnType<typeof setTimeout>>();

  private schedule(task: () => void): void {
    const id = setTimeout(() => {
      this.pending.delete(id);
      task();
    });
    this.pending.add(id);
  }

  ngOnDestroy(): void {
    for (const id of this.pending) clearTimeout(id);
    this.pending.clear();
  }

  /**
   * Arrows move, both ends wrap, Home/End jump, disabled tabs are skipped rather
   * than landed on — the same movement contract as `sv-radio-group`,
   * `sv-segmented-control` and `sv-speed-dial`. Stopping dead at the last tab
   * was this control quietly having different rules from its siblings.
   *
   * Whether moving also **selects** is {@link activation}'s question, and it is
   * the one thing the shared movement helper in `core` deliberately does not
   * answer. (The movement arithmetic here stays axis-scoped rather than adopting
   * `svRovingTarget`, which answers both axes on purpose for radio groups and
   * chips: a horizontal `tablist` must ignore Up/Down per the APG, and the
   * existing `ignores the wrong axis` test pins that.)
   */
  onTabKeydown(event: KeyboardEvent, tab: TabItem): void {
    if (tab.closable && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      this.closeTab(tab);
      return;
    }

    // Manual activation's commit keys, handled rather than left to the button's
    // native click: `preventDefault` on Space also stops the page scrolling
    // behind the strip, and prevented-then-handled is one activation where
    // handled-and-also-native would be two. Harmless under `'automatic'`, where
    // the focused tab is the selected one and `selectTab` is a no-op.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectTab(tab);
      return;
    }

    const navigable = this.navigableTabs();
    const len       = navigable.length;
    if (!len) return;

    const idx  = navigable.findIndex(t => t.id === tab.id);
    const isV  = this.layout() === 'vertical';
    const step = (delta: number) => navigable[(idx + delta + len) % len];

    let next: TabItem | undefined;

    if (isV) {
      if (event.key === 'ArrowDown') next = step(1);
      if (event.key === 'ArrowUp')   next = step(-1);
    } else {
      if (event.key === 'ArrowRight') next = step(1);
      if (event.key === 'ArrowLeft')  next = step(-1);
    }
    if (event.key === 'Home') next = navigable[0];
    if (event.key === 'End')  next = navigable[len - 1];

    if (next) {
      event.preventDefault();
      // ★ The `NV-06-M1` seam. This call used to be unconditional, which made
      //   automatic the only mode there was — and with `lazy` panels, one fetch
      //   per keypress on the way across the strip.
      if (this.resolvedActivation() === 'automatic') this.selectTab(next);
      else this.focusedId.set(next.id);

      // Scoped to this component's own element: `document.getElementById` finds
      // whichever strip comes first in the document, which is how arrowing in
      // the second strip used to move focus into the first.
      (this.host.nativeElement as HTMLElement)
        .querySelector<HTMLElement>(svAttrSelector('id', this.tabDomId(next.id)))
        ?.focus();
    }
  }

  // ── Dev diagnostics ───────────────────────────────────────────────────────

  /**
   * Automatic activation plus a `lazy` panel means one activation — and whatever
   * that panel does on mount — per arrow keypress. The component can see the
   * combination and cannot fix it, because the choice belongs to the host: that
   * is exactly what {@link svWarnOnce} is for.
   *
   * ★ Only when `activation` was never set. An explicit `'automatic'` is a host
   * that has already answered, and a warning that survives being answered is a
   * warning people mute wholesale.
   */
  protected readonly warnLazyActivation = effect(() => {
    if (this.activation() !== null) return;
    if (!this.tabs().some(t => t.lazy)) return;
    svWarnOnce(
      'sv-tabs:lazy-automatic-activation',
      '<sv-tabs> has lazy tabs and the default automatic activation, so the ' +
        'arrow keys activate every tab they pass — mounting each lazy panel in ' +
        'turn. Set activation="manual" so arrows move focus and Enter/Space ' +
        'selects, or activation="automatic" to say you meant it.',
    );
  });
}
