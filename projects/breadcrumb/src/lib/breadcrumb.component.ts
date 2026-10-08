import {
  afterRenderEffect,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import {
  svStackedPopup,
  SV_LINK_ADAPTER,
  SvErrorShellComponent,
  createPortalHost,
  svCloseOnNavigation,
  svElementSize,
  svIsModifiedClick,
  svRecoverFocus,
  svUniqueId,
  svWarnOnce,
  type SvDataError,
  type SvLinkTarget,
  type SvPortalHost,
} from '@styloviz/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A sibling page offered from a crumb's dropdown switcher. */
export interface BreadcrumbMenuItem {
  /** Display label. */
  label: string;
  /** Router link (string or array). */
  routerLink?: string | string[];
  /** Icon-library name shown before the label. Was `iconPath` (a raw `d`). */
  icon?: string;
}

/** A single crumb in the breadcrumb trail. */
export interface BreadcrumbItem {
  /** Display label. */
  label: string;
  /**
   * Router link (string or array).
   * Omit for the current / last crumb (renders as plain text).
   */
  routerLink?: string | string[];
  /** Icon-library name shown before the label. Was `iconPath` (a raw `d`). */
  icon?: string;
  /** Renders the crumb as non-interactive (e.g. permission-gated section). @default false */
  disabled?: boolean;
  /** Small count/status pill rendered after the label. */
  badge?: string | number;
  /** Sibling pages at this level — renders a dropdown-switcher trigger next to the crumb. */
  menu?: BreadcrumbMenuItem[];
  /** Full label shown as a tooltip when `truncateLabels` clips the visible text. */
  title?: string;
}

/**
 * One segment of the loading skeleton — `NV-03-I8`.
 *
 * Exactly one of the two is set: `label` reserves a crumb's real text box,
 * `width` (in `ch`) is the fallback when no trail has arrived yet.
 */
export interface BreadcrumbSkeletonCrumb {
  /**
   * Identity for `track`, mirroring the trail's own `trackCrumb` so a refresh
   * that reorders the trail reuses each reserved box by identity rather than by
   * position — the same reason the trail does not track by index.
   */
  readonly key: string;
  /** The crumb's label, reserved invisibly. `null` when the trail is not known yet. */
  readonly label: string | null;
  /** Guessed width in `ch`, used only when `label` is `null`. */
  readonly width: number | null;
  /**
   * The box classes — padding, border, weight — of the crumb this segment
   * stands in for, WITHOUT its colours: a pill's `px-2.5 py-1`, an underline's
   * `border-b-2 pb-0.5`, the current page's `font-medium`.
   */
  readonly boxClass: string;
  /** Whether the crumb will draw a leading icon, so its slot is reserved too. */
  readonly icon: boolean;
}

export type BreadcrumbSeparator = 'slash' | 'chevron' | 'dot' | 'arrow' | 'custom';
export type BreadcrumbVariant   = 'plain' | 'contained' | 'pills' | 'underline';
export type BreadcrumbSize      = 'sm' | 'md' | 'lg';

// ─── Separator SVG paths ──────────────────────────────────────────────────────

const SEPARATOR_ICONS: Record<Exclude<BreadcrumbSeparator, 'custom'>, string | null> = {
  slash:   null,   // rendered as a text character
  chevron: 'chevron-right',
  dot:     null,   // rendered as a text character
  arrow:   'arrow-right',
};

/** Default "home" glyph used by `showHomeIcon` on the first crumb. */
const HOME_ICON = 'home';

/** Chevron-down glyph used by the sibling-menu trigger button. */
const MENU_CARET_ICON = 'chevron-down';

/** Fixed sibling-menu panel width in px — matches the panel's CSS min-width. */
const MENU_PANEL_W = 192;
/** Approximate max panel height (px) — used only for the vertical flip decision. */
const MENU_PANEL_H = 240;
/** Gap between trigger edge and panel (px). */
const GAP = 4;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Breadcrumb — A navigation trail showing the user's location within the app.
 *
 * Features:
 * - Accepts a flat `items` array, or derives one from the current path with
 *   `svTrailFromPath` — the breadcrumb IS the route, and a hand-passed array is
 *   a second source of truth for the same fact (`NV-03-M1`)
 * - **No dependency on `@angular/router`.** Links render through `SvLinkAdapter`
 *   from `@styloviz/core`, so the component drops into an app that routes any
 *   way at all; provide an adapter and clicks become router transitions
 * - 5 separator styles: slash · chevron · dot · arrow · custom (bring your own SVG path)
 * - 4 visual variants: plain · contained · pills · underline
 * - Optional icon before each crumb label, plus an automatic home icon on the first crumb
 * - Per-crumb badge, disabled state, and a sibling-page dropdown switcher (ARIA menu-button)
 * - Sibling-menu panel is rendered in a true `document.body` portal so it always escapes
 *   ancestor `overflow:hidden`/scroll/transform containment (see dropdown-instruction.md)
 * - Automatic "current page" ARIA on the last crumb
 * - Collapsible middle crumbs when more than `maxVisible` items — the ellipsis is a real
 *   open/close toggle (`toggleCollapse`), not a one-way reveal, with `expand`/`collapse` outputs
 * - Optional label truncation with a tooltip, and CSS-only mobile collapse
 * - Loading skeleton state for async breadcrumb sources
 * - 3 sizes: sm · md · lg
 * - Full dark-mode support
 * - Accessible: `<nav aria-label>`, `<ol>`, `aria-current="page"`, `aria-disabled`,
 *   full keyboard support (Tab, Enter, Escape, ↑ ↓ Home End inside the sibling menu)
 */
@Component({
  selector: 'sv-breadcrumb',
  standalone: true,
  imports: [SvErrorShellComponent, NgClass, NgTemplateOutlet, SvIconComponent],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvBreadcrumbComponent implements OnInit, OnDestroy {
  // ── Async state ───────────────────────────────────────────────────────────

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  /*
   * ★ `svUniqueId`, not a module-level counter — `X-10` / `T0-2`.
   *
   * The counter this replaced belonged to the MODULE, so a long-lived server
   * process shared it across requests: the second page it rendered emitted
   * `-2-` while the browser, loading the module for the first time, emitted
   * `-1-`. Server HTML and first client render disagreed, which is a hydration
   * mismatch. Reproduced in `core`'s `unique-id.spec.ts` before it was fixed.
   */
  private readonly uid = svUniqueId('sv-breadcrumb');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Ordered list of crumbs. The last item is treated as the current page. */
  items = input<BreadcrumbItem[]>([]);

  /** Separator style between crumbs. Use `custom` with `customSeparatorIcon`. @default 'chevron' */
  separator = input<BreadcrumbSeparator>('chevron');

  /**
   * Icon-library NAME used when `separator="custom"` — e.g. `'chevron-right'`.
   * Was `customSeparatorPath`, a raw `<path d="…">`, and it was written as a
   * STATIC attribute at every call site, so the rename could not error: the
   * custom-separator demo silently fell back to the default chevron until the
   * sites were rewritten by hand.
   */
  customSeparatorIcon = input<string>('');

  /** Visual style of the crumb trail. @default 'plain' */
  variant = input<BreadcrumbVariant>('plain');

  /** Size of the breadcrumb text and icons. @default 'md' */
  size = input<BreadcrumbSize>('md');

  /**
   * Maximum number of crumbs to show before collapsing the middle ones.
   * Set to `0` to always show all. @default 0
   */
  maxVisible = input<number>(0);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-03-M4`: `maxVisible` is a guess about a width nobody measured ───────
   * A trail that fits on a laptop overflows on a phone and looks sparse on a wide
   * monitor, and the consumer has to pick one number for all three. `responsive`
   * measures instead: show as many crumbs as actually fit.
   *
   * ── ★ How this avoids the ResizeObserver feedback loop ──────────────────────
   * The naive version observes the TRAIL, and collapsing the trail changes the
   * trail's width, which re-fires the observer, which re-decides — the classic
   * `ResizeObserver loop completed with undelivered notifications`, and
   * throttling does not fix it. So:
   *
   *   · the observed element is the **host**, which is block-level and therefore
   *     as wide as its parent allows *regardless of how many crumbs are inside*;
   *   · the per-crumb widths are only ever read from a render that shows **all**
   *     of them, so collapsing cannot change the measurement that decided to
   *     collapse.
   *
   * ⚠️ **Three checks enforce that second point, and none of them is individually
   * observable** — each masks the others, so removing any one, or even two,
   * breaks no test. Stated rather than hidden, because a later reader will
   * otherwise delete one as dead code:
   *
   *   1. `measuredFor === items` — this trail has already been measured;
   *   2. `lis.length !== items.length` — this render is not the full trail;
   *   3. `widths.length !== count` in `fittedMaxVisible` — a cache that does not
   *      match the current trail is discarded rather than misused, which is what
   *      makes a wrong measurement self-correct instead of settling.
   *
   * ⚠️ A fourth IS observable, because the three above miss one case: a
   * same-length `items` replacement while the trail is collapsed to
   * `count - 1` crumbs, where the ellipsis `<li>` makes the count match and
   * check 2 passes on a collapsed render. `measureCrumbs` therefore refuses
   * any render showing the ellipsis and drops the stale widths so the next one
   * is full — pinned by "re-measures a same-length trail replaced while
   * collapsed" in `breadcrumb.responsive.spec.ts`.
   *
   * Together they are the guard. Individually they are belt-and-braces, in the
   * same way `onKeydown`'s empty-list check is in `sv-stepper`.
   *
   * The cost is one frame showing the whole trail before the first collapse, and
   * it is the right cost: the alternative is measuring a hidden copy of the trail,
   * which is a second DOM that can disagree with the first.
   *
   * ⚠️ Widths are re-measured when `items` changes, because the labels did.
   */

  /**
   * Collapse to fit the available width instead of to a fixed count. Overrides
   * `maxVisible` when on.
   * @default false
   */
  responsive = input<boolean>(false);

  /**
   * Allow the collapsed ellipsis to be clicked to reveal the hidden middle
   * crumbs. When `false` the ellipsis is purely decorative. @default true
   */
  expandable = input<boolean>(true);

  /** Prepends a home icon to the first crumb when it has no explicit `icon`. @default false */
  showHomeIcon = input<boolean>(false);

  /** Clips long labels to a fixed width with an ellipsis and a title tooltip. @default false */
  truncateLabels = input<boolean>(false);

  /** Hides middle crumbs below the `sm` breakpoint (pure CSS) to keep long trails compact on phones. @default false */
  collapseOnMobile = input<boolean>(false);

  /** Shows an animated skeleton in place of the crumb trail while data is loading. @default false */
  loading = input<boolean>(false);

  /** Number of skeleton segments rendered when `loading` is `true`. @default 3 */
  skeletonCount = input<number>(3);

  /** Accessible label for the breadcrumb navigation landmark. @default 'Breadcrumb' */
  ariaLabel = input<string>('Breadcrumb');

  /** Additional CSS classes on the root `<nav>` element. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when a crumb with a `routerLink` is clicked. */
  crumbClick = output<BreadcrumbItem>();

  /** Emitted when the collapsed ellipsis is expanded to reveal hidden crumbs. */
  expand = output<void>();

  /** Emitted when an expanded trail is collapsed back via the toggle. */
  collapse = output<void>();

  /** Emitted when a sibling page is chosen from a crumb's dropdown switcher. */
  menuItemSelect = output<BreadcrumbMenuItem>();

  // ── Internal state ──────────────────────────────────────────────────────────

  /** Whether the user has expanded the collapsed middle crumbs. */
  readonly isExpanded = signal(false);

  /** Index (within `visibleItems`) of the crumb whose sibling menu is open, or `null`. */
  readonly openMenuIndex = signal<number | null>(null);

  /** Roving-tabindex focus position inside the currently open sibling menu. */
  private readonly activeMenuItemIndex = signal(0);

  /** Anchor to restore focus to when the sibling menu closes. */
  private triggerEl: HTMLElement | null = null;

  private readonly menuItemRefs = viewChildren<ElementRef<HTMLAnchorElement>>('menuItemEl');

  /** Whether the open sibling menu should render above (vs. below) its trigger. */
  readonly menuAbove = signal(false);

  /**
   * Inline style object applied to the portaled menu panel. Uses
   * `position: fixed` with exact viewport coordinates so the panel escapes
   * all parent `overflow`/transform containment (dropdown-instruction.md §1–2).
   */
  readonly menuPanelStyle = signal<Record<string, string>>({});

  // ── Body-portal state (dropdown-instruction.md §1) ────────────────────────

  /*
   * ── `X-13` / `NV-03-I4`: a body portal leaves its own context behind ────────
   * The panel is appended to `document.body`, so every ancestor of this
   * component is gone — including the `class="dark"` on a themed section and the
   * `dir="rtl"` on a localised one. A menu opened from a dark sidebar rendered
   * light; a menu in an Arabic page rendered its chevrons pointing the wrong way.
   * Both look like styling bugs and neither is: the panel is simply somewhere
   * else in the tree.
   *
   * `createPortalHost` carries that context across and re-reads it on `sync()`,
   * which matters because a theme toggle while the menu is open changes the
   * marker underneath it and nothing about a copied attribute updates itself.
   * `sync()` is called from the scroll reposition (`_scrollHandler`), so the
   * panel picks up a scoped theme or `dir` change on the next frame it moves —
   * there is no observer on the ancestors' attributes, deliberately: a
   * MutationObserver per open menu for a toggle that is rare while one is open
   * is more machinery than the case is worth. (A viewport resize closes the
   * menu instead, so it never repositions with stale context either.)
   *
   * ★ It also makes the insertion order explicit — render into the host, THEN
   * attach — which this component already did by hand for the reason in the
   * comment below. Having the API enforce it is the point of adopting it.
   */
  private portal: SvPortalHost | null = null;

  /**
   * `NV-03-I5`: the menu lives in `document.body`, outside whatever the router
   * swaps, so a navigation leaves it open over the new page. Doubly odd here,
   * because the menu's own items ARE links — following one closes it, and any
   * other navigation used not to.
   *
   * ★ A navigation close is not a user close, so it does not steal focus —
   * see `closeMenuForNavigation`.
   */
  // `protected`, not `private`: it is held only for its side effect, and TS
  // reports an unused private member. Same shape as the `effect()` fields.
  protected readonly closeOnNav = svCloseOnNavigation(() => this.closeMenuForNavigation());
  private portalView: EmbeddedViewRef<object> | null = null;

  /** The ng-template holding the sibling-menu panel markup. */
  @ViewChild('menuPanelTpl', { read: TemplateRef })
  private readonly menuPanelTpl!: TemplateRef<object>;

  /**
   * Capture-phase scroll listener — fires for ANY scrollable ancestor, not
   * just the window, so the panel tracks its trigger through nested
   * scroll containers (dropdown-instruction.md §6).
   */
  private _rafId: number | null = null;
  private readonly _scrollHandler = (): void => {
    if (this.openMenuIndex() === null) return;
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.openMenuIndex() !== null) {
        this._calcMenuPos();
        // Re-read the origin's theme / `dir` — `NV-03-I4`, see the note on `portal`.
        this.portal?.sync();
        this.portalView?.detectChanges();
      }
    });
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Whether `maxVisible` would collapse this trail at all, regardless of
   * expanded state.
   *
   * ★ The `> 2` matters. Collapsing keeps the first and the last crumb, so a
   * trail of two or fewer has no middle to hide. Without this, `maxVisible=1`
   * on a two-crumb trail counted as collapsible and `visibleItems` rendered
   * `[first, '…', last]` — both crumbs PLUS an ellipsis standing for nothing,
   * with the toggle labelled "Show 0 hidden pages" and clicking it changing
   * nothing on screen while still emitting `expand`.
   */
  isCollapsible = computed<boolean>(() => {
    const max = this.effectiveMaxVisible();
    const count = this.items().length;
    return max > 0 && count > max && count > 2;
  });

  // ── Responsive collapse (`NV-03-M4`) ───────────────────────────────────────

  /**
   * The host's width. Block-level, so it is what the parent allows and **not**
   * what the crumbs inside need — which is the whole reason observing it cannot
   * feed back. See the note on `responsive`.
   */
  private readonly availableWidth = svElementSize(() => this.host.nativeElement as Element);

  /**
   * Natural width of each crumb, measured once from a full render and cached.
   * `null` until that measurement has happened.
   */
  private readonly naturalWidths = signal<readonly number[] | null>(null);

  /** Natural width of the ellipsis token, which is always on screen when collapsed. */
  private readonly ellipsisWidth = signal(0);

  /**
   * How many crumbs fit, or `0` for "no collapse" — either because they all fit
   * or because nothing has been measured yet.
   *
   * ★ Unmeasured means **show everything**, not "collapse to the minimum". Zero
   * width is what the server reports and what the first frame reports, and a
   * component that read it as "nothing fits" would ship every prerendered page in
   * its most collapsed form and expand on hydration.
   */
  private readonly fittedMaxVisible = computed<number>(() => {
    const widths = this.naturalWidths();
    const available = this.availableWidth().width;
    const count = this.items().length;

    if (!widths || widths.length !== count || available <= 0) return 0;

    const total = widths.reduce((sum, w) => sum + w, 0);
    if (total <= available) return 0;

    const budgetFor = (keep: number): number => {
      // Same priority as `keptIndices`: root, current, then back from the parent.
      let used = this.ellipsisWidth() + (widths[0] ?? 0) + (widths[count - 1] ?? 0);
      for (let i = count - 2, taken = 2; i >= 1 && taken < keep; i -= 1, taken += 1) {
        used += widths[i] ?? 0;
      }
      return used;
    };

    for (let keep = count - 1; keep > 2; keep -= 1) {
      if (budgetFor(keep) <= available) return keep;
    }
    return 2;
  });

  /** `responsive` wins over `maxVisible` when it is on — see its note. */
  private readonly effectiveMaxVisible = computed<number>(() =>
    this.responsive() ? this.fittedMaxVisible() : this.maxVisible(),
  );

  /** The `items` array the cached widths belong to, so a new trail re-measures. */
  private measuredFor: readonly BreadcrumbItem[] | null = null;

  /**
   * Measure each crumb once, from a render that shows all of them.
   *
   * ★ Runs only while the trail is uncollapsed, which is guaranteed on the first
   * pass because `fittedMaxVisible` returns 0 — "no collapse" — until widths
   * exist. That is the one frame of full trail the note on `responsive`
   * describes, and it is what makes the cached widths natural rather than
   * measured from an already-collapsed layout.
   */
  protected readonly measureCrumbs = afterRenderEffect(() => {
    if (!this.responsive()) return;

    const items = this.items();
    if (this.measuredFor === items) return;

    /*
     * ★ A NEW trail arriving while the ellipsis is on screen — `NV-03-M4`.
     *
     * The `<li>` count alone cannot tell a full render from a collapsed one:
     * collapsed to `count - 1` crumbs, the ellipsis `<li>` makes up the
     * difference and the count matches exactly. A same-length `items`
     * replacement then measured the COLLAPSED render — the ellipsis recorded as
     * a crumb, one real crumb missing — `fittedMaxVisible` concluded everything
     * fit, and `measuredFor` stopped it ever looking again.
     *
     * So the ellipsis being present is itself a refusal, and the stale widths
     * are dropped: with no widths `fittedMaxVisible` is 0, the next render is
     * the full trail, and the ellipsis leaving re-runs this effect to measure
     * that. The same one frame of full trail the first render spends.
     */
    if (this.hasEllipsis()) {
      if (this.naturalWidths() !== null) this.naturalWidths.set(null);
      return;
    }

    const root = this.host.nativeElement as HTMLElement;
    const lis = [...root.querySelectorAll<HTMLElement>('ol > li')];

    // Once collapsed there are fewer `<li>`s than `items`, so this declines and
    // the cache keeps the widths measured from the full trail.
    if (lis.length !== items.length) return;

    this.measuredFor = items;
    // `getBoundingClientRect` rather than `offsetWidth`: the latter rounds to an
    // integer, and a trail of eight crumbs accumulates up to eight pixels of
    // error — which is exactly the margin a fit decision turns on.
    this.naturalWidths.set(lis.map((li) => li.getBoundingClientRect().width));
  });

  /**
   * Measure the ellipsis separately, because it is present when collapsed and
   * absent when the trail fits — so it can never be one of the cached crumb
   * widths.
   */
  protected readonly measureEllipsis = afterRenderEffect(() => {
    if (!this.responsive() || this.ellipsisWidth() > 0) return;

    const root = this.host.nativeElement as HTMLElement;
    const token = root.querySelector<HTMLElement>('[data-sv-crumb-ellipsis]');
    if (token) this.ellipsisWidth.set(token.getBoundingClientRect().width);
  });

  /*
   * ── `NV-03-M3`: which crumbs survive was incidental ─────────────────────────
   * Collapsing kept the first and the last, and nothing else, whatever
   * `maxVisible` said — so `maxVisible` was a THRESHOLD rather than a maximum,
   * and the one crumb a reader most often wants was the one always thrown away.
   *
   * ★ The parent is the "up one level" target. On `/admin/orders/1042/items`,
   * "go back to the order" is the overwhelmingly common move, and it was behind
   * the ellipsis every time while the site root — which the logo already links to
   * — was always on screen.
   *
   * The priority, in order: **root, current, then backwards from the parent.**
   * Root because it orients; current because it is where you are; parent next
   * because it is where you are most likely going.
   */

  /** Indices kept when collapsed, in document order — `NV-03-M3`. */
  private readonly keptIndices = computed<readonly number[]>(() => {
    const count = this.items().length;
    if (!this.isCollapsible()) return [...Array(count).keys()];

    // ★ Never fewer than root + current. A breadcrumb showing only the page you
    //   are on is not a breadcrumb, so `maxVisible={{1}}` gets two rather than
    //   being taken literally into uselessness.
    const budget = Math.max(2, Math.min(this.effectiveMaxVisible(), count));

    const kept = new Set<number>([0, count - 1]);
    for (let i = count - 2; i >= 1 && kept.size < budget; i -= 1) kept.add(i);

    return [...kept].sort((a, b) => a - b);
  });

  /** Number of crumbs currently hidden behind the ellipsis (0 when expanded or not collapsible). */
  hiddenCount = computed<number>(() => {
    if (!this.isCollapsible() || this.isExpanded()) return 0;
    return this.items().length - this.keptIndices().length;
  });

  /** How many crumbs the toggle would hide/reveal, regardless of its current state. */
  toggleCount = computed<number>(() =>
    this.isCollapsible() ? this.items().length - this.keptIndices().length : 0,
  );

  /**
   * Crumbs actually rendered. When collapsible, a `'__ellipsis__'` toggle
   * token always sits right after the first crumb — collapsed it hides the
   * middle crumbs, expanded it re-collapses them, so the trail can be
   * toggled open and closed rather than only ever revealed once.
   */
  visibleItems = computed<(BreadcrumbItem | '__ellipsis__')[]>(() => {
    const all = this.items();
    if (!this.isCollapsible()) return all;

    const first = all[0];
    if (this.isExpanded()) return [first, '__ellipsis__', ...all.slice(1)];

    // The ellipsis sits directly after the root and stands for the gap between
    // it and whatever survived — see `keptIndices`.
    return [first, '__ellipsis__', ...this.keptIndices().slice(1).map((i) => all[i])];
  });

  /** Whether there are collapsed crumbs. */
  hasEllipsis = computed(() => this.visibleItems().includes('__ellipsis__'));

  /**
   * Stable identity for `@for`, so a trail that changes shape does not hand a
   * crumb's DOM to a different crumb.
   *
   * This matters more than it looks: the sibling menu tracks which crumb is
   * open by index (`openMenuIndex`), so reusing an element by position while a
   * menu is open would leave the menu attached to the wrong label. The label
   * is folded in because two sections can legitimately share a route.
   */
  protected trackCrumb(index: number, item: BreadcrumbItem | '__ellipsis__'): string {
    if (item === '__ellipsis__') return '__ellipsis__';
    const link = Array.isArray(item.routerLink) ? item.routerLink.join('/') : item.routerLink;
    return link ? `${link}|${item.label}` : `${index}|${item.label}`;
  }

  /** Icon-library name for the current separator (null means text character). */
  separatorIcon = computed<string | null>(() => {
    const sep = this.separator();
    if (sep === 'custom') return this.customSeparatorIcon() || SEPARATOR_ICONS.chevron;
    return SEPARATOR_ICONS[sep];
  });

  /** Text character used as separator (only for slash / dot). */
  separatorChar = computed<string>(() => {
    switch (this.separator()) {
      case 'slash': return '/';
      case 'dot':   return '·';
      default:      return '';
    }
  });

  /** Whether the separator is a GLYPH (true) or a text character (false). */
  isSvgSeparator = computed(() => this.separatorIcon() !== null);

  /**
   * The skeleton's segments — `NV-03-I8`.
   *
   * ── The skeleton RESERVES the trail's box, it does not invent one ───────────
   * It used to be three bars of 40 / 64 / 88px in a `gap-2` `<div>` with a
   * hard-coded `/`, while the real trail is a `gap-1` `<ol>` of text with a
   * *configurable* separator. So every dimension was independently wrong, and
   * the trail arriving moved the page under the reader's cursor.
   *
   * ★ **A label is an exact reservation; a count is a guess.** When `items` is
   * already known — a refresh rather than a cold load — each segment reserves
   * the crumb's own label, so the swap is pixel-identical. Only when there is no
   * trail yet does a width have to be invented, and then it is invented in `ch`
   * so it at least tracks the font size `size` selected.
   *
   * ⚠️ The height, the gaps and the separators are reserved in **both** cases:
   * those are properties of the trail's structure, which is known even when its
   * content is not. So is the VARIANT's box: a pill's `px-2.5 py-1` is taller
   * than a line of text and an underline's `border-b-2 pb-0.5` is too, and the
   * current crumb's `font-medium` is wider — each a shift the skeleton used to
   * leave in. The home icon is structural as well (`showHomeIcon` says the
   * first crumb has one before any data arrives), and a known crumb's own
   * `icon` is reserved on a refresh.
   *
   * Badges are not reserved — they are per-crumb data a cold load does not
   * have, and a cold load cannot know about per-crumb icons either. A consumer
   * showing those will still see a small horizontal shift, which is why the
   * structural parity matters more than the width: a vertical shift moves the
   * whole page, a horizontal one moves the trail.
   */
  skeletonCrumbs = computed<readonly BreadcrumbSkeletonCrumb[]>(() => {
    const known = this.items();
    if (known.length > 0) {
      // Keyed through the trail's own `trackCrumb`, so the reserved boxes have
      // exactly the identity the crumbs replacing them will have.
      const lastIndex = known.length - 1;
      return known.map((item, i) => ({
        key: this.trackCrumb(i, item),
        label: item.label,
        width: null,
        boxClass: this.skeletonBoxClass(this.crumbKind(item, i === lastIndex)),
        icon: !!item.icon || (i === 0 && this.showHomeIcon()),
      }));
    }
    // Never zero: an empty skeleton reads as a finished empty trail.
    const count = Math.max(1, this.skeletonCount());
    // 6 / 10 / 14ch — the old 40 / 64 / 88px, expressed relative to the text.
    // With no data, every crumb but the last is assumed to be a link — the
    // common case, and the one whose box is largest in the underline variant.
    return Array.from({ length: count }, (_, i) => ({
      key: `__skeleton__${i}`,
      label: null,
      width: 6 + (i % 3) * 4,
      boxClass: this.skeletonBoxClass(i === count - 1 ? 'current' : 'link'),
      icon: i === 0 && this.showHomeIcon(),
    }));
  });

  /** Which of the four crumb renderings `item` gets — same order as the template. */
  private crumbKind(item: BreadcrumbItem, last: boolean): 'disabled' | 'current' | 'link' | 'middle' {
    if (item.disabled) return 'disabled';
    if (last) return 'current';
    return item.routerLink ? 'link' : 'middle';
  }

  /**
   * The box half of `linkClasses` / `currentClasses` / `middleClasses` /
   * `disabledClasses` — the half that decides size. Kept beside them so a
   * change to a variant's padding is one screen away from the skeleton's.
   * The underline's border is reserved `border-transparent`: its width is what
   * shifts the layout, its colour would announce a page that has not loaded.
   */
  private skeletonBoxClass(kind: 'disabled' | 'current' | 'link' | 'middle'): string {
    const weight = kind === 'current' ? 'font-medium' : '';
    switch (this.variant()) {
      case 'pills':
        return `rounded-full px-2.5 py-1 ${weight}`.trim();
      case 'underline':
        return kind === 'link' || kind === 'current'
          ? `border-b-2 border-transparent pb-0.5 ${weight}`.trim()
          : weight;
      default:
        return weight;
    }
  }

  /** The crumb whose sibling menu is currently open, or `null`. Drives the portaled panel. */
  openMenuItem = computed<BreadcrumbItem | null>(() => {
    const index = this.openMenuIndex();
    if (index === null) return null;
    const item = this.visibleItems()[index];
    return item && this.isBreadcrumbItem(item) ? item : null;
  });

  // ── Size maps ─────────────────────────────────────────────────────────────

  textClass = computed<string>(() => ({
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  })[this.size()]);

  iconClass = computed<string>(() => ({
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  })[this.size()]);

  separatorClass = computed<string>(() => ({
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  })[this.size()]);

  // ── Variant class maps ────────────────────────────────────────────────────

  /** Extra classes applied to the root `<nav>` for container-style variants. */
  navWrapperClass = computed<string>(() =>
    this.variant() === 'contained'
      ? 'inline-flex items-center rounded-lg border border-gray-200/80 bg-gray-50/70 px-3 py-1.5 dark:border-gray-800 dark:bg-gray-800/40'
      : '',
  );

  /** Classes for a clickable (routerLink) crumb. */
  linkClasses = computed<string>(() => {
    const base = 'flex items-center gap-1 text-gray-500 transition-colors hover:text-gray-700 ' +
      'dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus-visible:rounded ' +
      'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';
    switch (this.variant()) {
      case 'pills':     return `${base} rounded-full px-2.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800/70`;
      case 'underline': return `${base} border-b-2 border-transparent pb-0.5 hover:border-gray-300 dark:hover:border-gray-600`;
      default:          return base;
    }
  });

  /** Classes for the current-page (last) crumb. */
  currentClasses = computed<string>(() => {
    const base = 'flex items-center gap-1 font-medium text-gray-900 dark:text-white';
    switch (this.variant()) {
      case 'pills':     return `${base} rounded-full bg-primary-50 px-2.5 py-1 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400`;
      case 'underline': return `${base} border-b-2 border-primary-600 pb-0.5 text-primary-700 dark:border-primary-400 dark:text-primary-400`;
      default:          return base;
    }
  });

  /** Classes for a non-linked middle crumb (no routerLink, not disabled). */
  middleClasses = computed<string>(() => {
    const base = 'flex items-center gap-1 text-gray-500 dark:text-gray-400';
    return this.variant() === 'pills' ? `${base} rounded-full px-2.5 py-1` : base;
  });

  /** Classes for a disabled crumb. */
  disabledClasses = computed<string>(() => {
    const base = 'flex items-center gap-1 cursor-not-allowed text-gray-300 opacity-60 dark:text-gray-600';
    return this.variant() === 'pills' ? `${base} rounded-full px-2.5 py-1` : base;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  isLastItem(item: BreadcrumbItem | '__ellipsis__'): boolean {
    const all = this.visibleItems();
    return all[all.length - 1] === item;
  }

  isFirstItem(item: BreadcrumbItem | '__ellipsis__'): boolean {
    return this.visibleItems()[0] === item;
  }

  isBreadcrumbItem(item: BreadcrumbItem | '__ellipsis__'): item is BreadcrumbItem {
    return item !== '__ellipsis__';
  }

  /** True for crumbs strictly between the first and last — used to CSS-hide on mobile. */
  isMiddleItem(item: BreadcrumbItem | '__ellipsis__'): boolean {
    if (!this.isBreadcrumbItem(item)) return false;
    return !this.isFirstItem(item) && !this.isLastItem(item);
  }

  /**
   * Icon-library name shown before a crumb's label, falling back to the home
   * icon for the first crumb. `undefined` means "draw no icon".
   */
  iconNameFor(item: BreadcrumbItem): string | undefined {
    if (item.icon) return item.icon;
    if (this.showHomeIcon() && this.isFirstItem(item)) return HOME_ICON;
    return undefined;
  }

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── ★ Why this component no longer imports `RouterLink` (`NV-03-M1`) ────────
   * It used to, and that single import is why `@styloviz/breadcrumb` could not be
   * dropped into a hybrid app, a non-routed widget, or another framework's
   * shell — the exact case `docs/navigation-routing-adr.md` names, with this
   * component as the proof.
   *
   * `RouterLink` did two separable things, and separating them is the whole fix:
   *   1. put an `href` on the anchor — plain string work, no router needed, and
   *      the thing that makes middle-click, ⌘-click and "copy link address" work;
   *   2. intercept the click so the app transitions instead of reloading — which
   *      genuinely needs a router, and is therefore the consumer's ten lines.
   *
   * With no adapter provided the crumbs are still real, shareable, right-clickable
   * links; they just reload the page when followed, and `svHrefLinkAdapter` says
   * so once in a dev build rather than letting that be a silent regression.
   *
   * ── The rule, shared with `sv-mega-menu` ────────────────────────────────────
   * **The click is cancelled exactly when the adapter says it took the
   * navigation.** One event, one navigation. And a modified click is never
   * intercepted, through the same `svIsModifiedClick` both families use, so the
   * answer cannot drift between them.
   */
  private readonly links = inject(SV_LINK_ADAPTER);

  /** The `href` to render for a crumb or menu target, or `null` for "not a link". */
  hrefFor(target: SvLinkTarget | undefined): string | null {
    return target === undefined ? null : this.links.href(target);
  }

  /**
   * ── `NV-03-I3`: the current page is not a link, and now says so ─────────────
   *
   * The rendering was already right — the last crumb has always been a
   * `<span aria-current="page">`, never an `<a>`. The item asks for *enforcement*,
   * and what was missing is that a `routerLink` on that crumb was **silently
   * dropped**. A consumer who writes one has stated an intent the component then
   * ignores without a word, so the two readings — "linking the current page is
   * wrong" and "my link is broken" — are indistinguishable from the outside.
   *
   * ⚠️ **The sibling-page menu is deliberately NOT checked here.** Deciding
   * whether a menu entry points at the page you are on means knowing the current
   * URL, and this component has no location *by design*: T1 gave the Breadcrumb
   * `SvLinkAdapter` rather than `SvNavLocation` precisely because a breadcrumb
   * owns no key — it answers "who navigates", not "where does my state live".
   * Adding a location to police a consumer's own menu data would undo that
   * decision for a warning. It stays the consumer's call, and is documented as
   * such rather than half-enforced here.
   */
  protected readonly warnOnCurrentPageLink = effect(() => {
    const trail = this.items();
    const current = trail[trail.length - 1];
    if (current === undefined || current.routerLink === undefined) return;
    svWarnOnce(
      `sv-breadcrumb:current-page-link:${current.label}`,
      `sv-breadcrumb: the last crumb ("${current.label}") has a routerLink, which is ` +
        `ignored — the current page renders as plain text with aria-current="page". ` +
        `Drop the routerLink to make that intent explicit.`,
    );
  });

  /**
   * Hand `target` to the adapter and report whether the browser should be stopped.
   * `false` for a modified click — that gesture belongs to the browser.
   */
  private followLink(target: SvLinkTarget, event: Event): boolean {
    if (svIsModifiedClick(event)) return false;
    if (!this.links.navigate(target)) return false;
    event.preventDefault();
    return true;
  }

  onCrumbClick(item: BreadcrumbItem, event?: Event): void {
    if (item.disabled) {
      event?.preventDefault();
      return;
    }
    if (!item.routerLink) return;

    if (event) this.followLink(item.routerLink, event);
    this.crumbClick.emit(item);
  }

  /**
   * Toggle the collapsed middle crumbs open or closed. Unlike a one-way
   * "reveal", calling this again while expanded collapses the trail back —
   * the ellipsis token stays clickable in both states (see `visibleItems`).
   */
  toggleCollapse(): void {
    if (!this.expandable() || !this.isCollapsible()) return;
    const next = !this.isExpanded();
    this.isExpanded.set(next);
    if (next) this.expand.emit();
    else this.collapse.emit();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Capture phase catches scroll from any scrollable ancestor, not just window
    // (dropdown-instruction.md §6).
    // ★ SSR: this hook runs during a prerender, where there is no `window`
    // or `document`. A scroll listener is a browser-only affordance, so
    // skipping it server-side loses nothing.
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    }
  }

  ngOnDestroy(): void {
    // ★ `ngOnDestroy` runs on the server too — a prerender destroys the
    // application after every route.
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._destroyMenuPortal();
  }

  // ── Sibling dropdown menu (ARIA menu-button + body-portal pattern) ───────

  /** Stable DOM id for the (single, reused) sibling-menu panel. */
  readonly menuPanelId = `${this.uid}-menu`;

  toggleMenu(index: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuIndex() === index) {
      this.closeMenu();
      return;
    }
    if (this.openMenuIndex() !== null) this._destroyMenuPortal();

    this.triggerEl = event.currentTarget as HTMLElement;
    this._calcMenuPos();

    // Mount the panel into document.body via a true portal so it always
    // escapes ancestor overflow/transform clipping (dropdown-instruction.md §1).
    this.portal = createPortalHost({
      origin: this.host.nativeElement as Element,
      className: 'sv-breadcrumb-menu-portal',
      label: 'breadcrumb-menu',
      // A teardown path that throws still takes the `<div>` out of `<body>`.
      destroyRef: this.destroyRef,
    });

    this.portalView = this.menuPanelTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);

    this.openMenuIndex.set(index);
    this.activeMenuItemIndex.set(0);
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portal!.element.appendChild(n));
    this.portal.attach();

    queueMicrotask(() => this.menuItemRefs()[0]?.nativeElement.focus());
  }

  /**
   * Close the sibling menu and return focus to its trigger. For user-initiated
   * closes — Escape, Tab, a selection, the trigger again — where the reader was
   * in the menu and expects to land back where they opened it.
   */
  closeMenu(): void {
    if (this.openMenuIndex() === null) return;
    this._destroyMenuPortal();
    this.openMenuIndex.set(null);
    this.triggerEl?.focus();
    this.triggerEl = null;
  }

  /*
   * ── `NV-03-I5` / `X-14`: a navigation close is not a user close ─────────────
   * `closeMenu` always focused the trigger, which is right when the reader
   * pressed Escape and wrong when the URL changed underneath them: a reader
   * typing in a search box on the page had focus yanked to a breadcrumb because
   * a back button fired somewhere else.
   *
   * ★ So focus moves ONLY if it was inside the menu — which, with the menu
   * gone, would otherwise drop to `<body>`. And it goes through
   * `svRecoverFocus`, because the navigation that closed the menu may also have
   * re-rendered the trail: the trigger is preferred while it is still in the
   * document, and the `<nav>` landmark takes focus when it is not, rather than
   * `<body>`.
   *
   * ⚠️ `activeElement` is read BEFORE the portal is destroyed. Afterwards the
   * focused menu item is detached and the browser has already moved focus to
   * `<body>`, so "was focus in the menu?" can no longer be asked.
   */
  private closeMenuForNavigation(): void {
    if (this.openMenuIndex() === null) return;

    const hostEl = this.host.nativeElement as HTMLElement;
    const active = hostEl.ownerDocument.activeElement;
    const focusWasInMenu = !!active && !!this.portal?.element?.contains(active);
    const trigger = this.triggerEl;

    this._destroyMenuPortal();
    this.openMenuIndex.set(null);
    this.triggerEl = null;

    if (!focusWasInMenu) return;
    svRecoverFocus({
      to: [trigger?.isConnected ? trigger : null],
      fallback: hostEl.querySelector('nav') ?? hostEl,
    });
  }

  selectMenuItem(item: BreadcrumbMenuItem, event?: Event): void {
    if (event && item.routerLink) this.followLink(item.routerLink, event);
    this.menuItemSelect.emit(item);
    this.closeMenu();
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const refs = this.menuItemRefs();
    if (!refs.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeMenuItemIndex.update(i => Math.min(i + 1, refs.length - 1));
        refs[this.activeMenuItemIndex()].nativeElement.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeMenuItemIndex.update(i => Math.max(i - 1, 0));
        refs[this.activeMenuItemIndex()].nativeElement.focus();
        break;
      case 'Home':
        event.preventDefault();
        this.activeMenuItemIndex.set(0);
        refs[0].nativeElement.focus();
        break;
      case 'End':
        event.preventDefault();
        this.activeMenuItemIndex.set(refs.length - 1);
        refs[refs.length - 1].nativeElement.focus();
        break;
      case 'Escape':
        event.preventDefault();
        this.closeMenu();
        break;
      case 'Tab':
        this.closeMenu();
        break;
    }
  }

  /** Position the portaled panel against `triggerEl`, flipping to fit the viewport. */
  private _calcMenuPos(): void {
    const trigger = this.triggerEl ?? this.host.nativeElement;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const above = spaceBelow < MENU_PANEL_H && spaceAbove > spaceBelow;
    const right = rect.left + MENU_PANEL_W > vw;

    this.menuAbove.set(above);

    const style: Record<string, string> = {
      position: 'fixed',
      zIndex: '9999',
      minWidth: `${MENU_PANEL_W}px`,
    };
    style[above ? 'bottom' : 'top'] = above
      ? `${vh - rect.top + GAP}px`
      : `${rect.bottom + GAP}px`;
    style[right ? 'right' : 'left'] = right
      ? `${vw - rect.right}px`
      : `${rect.left}px`;

    this.menuPanelStyle.set(style);
  }

  private _destroyMenuPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portal?.destroy();
    this.portal = null;
  }

  // ── Global listeners ──────────────────────────────────────────────────────

  /**
   * Click-outside close. The panel lives in `document.body`, not inside this
   * component's DOM subtree, so both the host AND the portal element must be
   * checked (dropdown-instruction.md §7).
   */
  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.openMenuIndex() !== null,
    element: () => this.portal?.element,
  });

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent): void {
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(event.target)) return;
    if (this.openMenuIndex() === null) return;
    const target = event.target as Node;
    if (this.host.nativeElement.contains(target)) return;
    if (this.portal?.element.contains(target)) return;
    this.closeMenu();
  }

  /** Viewport resize invalidates the computed coordinates — close rather than reposition
   *  with stale numbers (dropdown-instruction.md §8). */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.openMenuIndex() !== null) this.closeMenu();
  }

  /** Scoped to the host so it only fires while focus/interaction is on the trigger;
   *  focus inside the portaled panel is handled by `onMenuKeydown` (dropdown-instruction.md §9). */
  // On the DOCUMENT, not the host: this component renders its panel into
  // <body> and moves focus into it, so a key pressed while the panel is open
  // never passes through this element. Gated by `portal-host-escape`.
  @HostListener('document:keydown.escape')
  onHostEscape(): void {
    // Only the topmost surface acts on Escape (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (this.openMenuIndex() !== null) this.closeMenu();
  }

  readonly menuCaretIcon = MENU_CARET_ICON;
}
