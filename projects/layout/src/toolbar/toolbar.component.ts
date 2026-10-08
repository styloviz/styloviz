import {
  afterNextRender,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  inject,
  Injector,
  input,
  model,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  ViewChild,
  viewChild,
} from '@angular/core';
import {
  createPortalHost,
  SV_FLOATING_ORDER,
  SvErrorShellComponent,
  SvOverlayStackService,
  SvSkeletonShellComponent,
  svElementSize,
  svFloatingRegion,
  svRecoverFocus,
  svSuccessorIndex,
  svUniqueId,
  svWarnOnce,
  type SvDataError,
  type SvFloatingAnchor,
  type SvOverlayHandle,
  type SvPortalHost,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type ToolbarSize    = 'sm' | 'md' | 'lg';
export type ToolbarVariant = 'default' | 'glass' | 'bordered' | 'elevated' | 'ghost';

/**
 * What happens to actions that do not fit (`LU-11-M3`).
 *
 * - `scroll` — the strip scrolls horizontally. Every action stays inline; the
 *   ones past the edge are reachable by scrolling or by arrow keys.
 * - `menu` — actions that do not fit move, from the END of the list, into a
 *   "More" menu button. Order the list by importance.
 */
export type ToolbarOverflowMode = 'scroll' | 'menu';

/** One place the toolbar's single tab stop can rest. */
type ToolbarStop =
  | { readonly kind: 'action'; readonly action: ToolbarAction; readonly index: number }
  | { readonly kind: 'more' };

/** Where the tab stop was last put, remembered so it can be reconciled after the data changes. */
interface ToolbarRovingMark {
  /** The action id, or `null` for the More button. */
  readonly id: string | null;
  /** Flat index of the action — tells two actions sharing an id apart. */
  readonly index: number;
  /** Position among the tab stops when it was set — the anchor for the successor rule. */
  readonly pos: number;
}

// ─── Overflow geometry ────────────────────────────────────────────────────────
// The toolbar's own classes, as pixels. `menu` mode decides how many actions fit
// from these rather than from measuring each button, because a button moved into
// the menu is no longer in the DOM to be measured — and a decision that needed
// the thing it removes would oscillate.

/** Button edge per size: `h-7 w-7` / `h-8 w-8` / `h-10 w-10`. */
const BUTTON_PX: Readonly<Record<ToolbarSize, number>> = { sm: 28, md: 32, lg: 40 };
/** `gap-1` between children. */
const GAP_PX = 4;
/** `p-1` on each side, plus up to 2px of border (`bordered`) on each side. */
const CHROME_PX = 2 * (4 + 2);
/** A separator: `w-px` plus `mx-0.5` on each side. */
const SEPARATOR_PX = 1 + 2 * 2;

// ─── Overflow menu panel ──────────────────────────────────────────────────────
/** Estimated panel width, px — used for the flip decision only. */
const MENU_PANEL_W = 224;
/** Estimated height of one menu row, px. */
const MENU_ROW_H = 36;
/** Gap between the More button and the panel. */
const MENU_GAP = 6;
/** Minimum distance the panel keeps from any viewport edge. */
const MENU_MARGIN = 8;
/** Floor / ceiling for the clamped panel height. */
const MENU_MIN_H = 120;
const MENU_HARD_MAX_H = 320;

/**
 * `X-7` — a focus indicator that survives forced colors, on every button the
 * toolbar renders (actions, More, menu items).
 *
 * ★★ The ring is a `box-shadow` and the base is `outline-none`; forced colors
 *    removes every box shadow, so a keyboard user in Windows High Contrast saw
 *    NO focus at all. Only in that mode a real, system-coloured outline returns.
 * ⚠️ `outline-solid` is required: Tailwind 4's `outline-none` sets
 *    `--tw-outline-style: none`, which `outline-2` alone would inherit.
 */
const FORCED_FOCUS =
  'forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-offset-2';

export interface ToolbarAction {
  readonly id: string;
  readonly label: string;
  /** Name of an icon in `@styloviz/icons` (was a raw SVG path). */
  readonly icon: string;
  readonly variant?: 'default' | 'primary' | 'danger' | 'success';
  readonly disabled?: boolean;
  readonly dividerAfter?: boolean;
  readonly tooltip?: string;
  /** If true this button behaves as a toggle (stays active after click). */
  readonly toggle?: boolean;
}

export interface ToolbarGroup {
  readonly id: string;
  readonly actions: readonly ToolbarAction[];
}

@Component({
  imports: [
    SvIconComponent,
    SvErrorShellComponent,
    SvSkeletonShellComponent,
  ],
  selector: 'sv-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toolbar.component.html',
  // ★ In `menu` mode the host is what gets measured, so it must be able to
  //   shrink below its content: `min-w-0` + `flex-auto` let it do that as a
  //   flex item (a `flex justify-between` header) instead of pinning at the
  //   full strip width and never overflowing — and let it grow back.
  host: {
    '[class.block]': "overflow() === 'menu'",
    '[class.min-w-0]': "overflow() === 'menu'",
    '[class.flex-auto]': "overflow() === 'menu'",
  },
})
export class SvToolbarComponent implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stack = inject(SvOverlayStackService);

  /** Per-instance id prefix — SSR-stable, see `svUniqueId`. */
  private readonly uid = svUniqueId('sv-toolbar');
  /** Id of the overflow menu panel, for the More button's `aria-controls`. */
  readonly menuId = `${this.uid}-menu`;

  /** Grouped actions rendered with separators between groups. */
  groups   = input<readonly ToolbarGroup[]>([]);
  /** Flat action list (alternative to `groups`). */
  actions  = input<readonly ToolbarAction[]>([]);
  /** Toolbar size: sm, md or lg. @default 'md' */
  size     = input<ToolbarSize>('md');
  /** Visual variant: default, glass, bordered, elevated or ghost. @default 'default' */
  variant  = input<ToolbarVariant>('default');
  /** Accessible label for the toolbar region. @default 'Toolbar' */
  label    = input<string>('Toolbar');
  /** Stick the toolbar to the top while scrolling. @default false */
  sticky   = input<boolean>(false);

  /**
   * Opt in to the shared floating layer (`X-5`): register the toolbar strip as
   * an occupied region on this edge or corner, so kit controls there (Scroll
   * to Top, a floating Speed Dial) and host regions stack clear of it. For a
   * `sticky` toolbar, or one the host pins `position: fixed` — the component
   * cannot tell where the host's CSS puts it, so it never guesses. Registers
   * at `SV_FLOATING_ORDER.edge` (nearest the edge). `null` registers nothing
   * and the rendered output is unchanged.
   * @default null
   */
  floatingAnchor = input<SvFloatingAnchor | null>(null);

  /**
   * What happens to actions that do not fit: `scroll` keeps them inline in a
   * horizontally scrolling strip; `menu` measures the available width and moves
   * the trailing actions into a keyboard-accessible "More" menu (a body-portal
   * `role="menu"`). In `menu` mode the host element becomes `display: block` so
   * it can measure the width its parent allows.
   * @default 'scroll'
   */
  overflow = input<ToolbarOverflowMode>('scroll');

  /** Accessible name (and tooltip) of the "More" button and its menu. @default 'More actions' */
  overflowLabel = input<string>('More actions');

  // ── Loading the definition ──────────────────────────────────────────────────

  /**
   * True while the action set is being fetched. A toolbar whose actions depend on the user's permissions is fetched, not hard-coded.
   * @default false
   */
  loading = input<boolean>(false);

  /**
   * The definition fetch failed — the toolbar has no actions to show.
   *
   * Separate from `error`, which is a failure of an action the user just
   * TRIGGERED. The two need opposite affordances: a failed action is retried by
   * clicking that action again, while a failed load has nothing left to click.
   * Collapsing them into one input gave the action strip a "Try again" button
   * that could not know which action to re-run.
   * @default null
   */
  loadError = input<SvDataError | string | null>(null);

  /**
   * The host should re-run the failed definition fetch.
   *
   * Named `retryLoad`, matching `sv-agent-task-queue`: on a component where
   * `error` already means something else, the load states carry the `…Load`
   * spelling rather than stealing a name that is already taken.
   */
  retryLoad = output<void>();

  // ── Actions that hit the server ─────────────────────────────────────────────

  /**
   * Ids of actions with a request in flight. Those controls disable and show a
   * busy state, so a double-click cannot fire the same request twice — the most
   * common way an action button creates duplicate records.
   * @default []
   */
  busyIds  = input<readonly string[] | ReadonlySet<string>>([]);

  /**
   * Failure from the last action. Rendered above the control group; nothing is
   * removed from view, so the user can see what state things are in.
   * @default null
   */
  error    = input<SvDataError | string | null>(null);
  /** Pre-seeded set of active toggle IDs. Two-way bindable. */
  activeIds = model<ReadonlySet<string>>(new Set());

  /** Emitted with the id of the clicked action. */
  actionClick = output<string>();

  /** `busyIds` normalized to a Set. */
  private readonly _busy = computed<ReadonlySet<string>>(() => {
    const ids = this.busyIds();
    return ids instanceof Set ? ids : new Set(ids as readonly string[]);
  });

  /** Whether this action has a request in flight. */
  isBusy(id: string): boolean {
    return this._busy().has(id);
  }

  /** Whether anything at all is in flight. */
  readonly hasBusy = computed(() => this._busy().size > 0);

  /** The `role="toolbar"` strip — the region `floatingAnchor` registers. */
  private readonly _strip = viewChild<ElementRef<HTMLElement>>('strip');

  /** The floating-layer registration; inert while `floatingAnchor` is `null`. */
  private readonly _region = svFloatingRegion({
    anchor: () => this.floatingAnchor(),
    // Not measured at all unless opted in — no second observer by default.
    element: () => (this.floatingAnchor() ? this._strip()?.nativeElement : null),
    order: SV_FLOATING_ORDER.edge,
    label: 'toolbar',
  });

  /** Whether the toolbar is registered with the floating layer — for `data-sv-floating`. */
  readonly floatingRegistered = this._region.registered;

  /** Internal transient "pressed" state for non-toggle buttons (shows briefly). */
  private readonly _pressedId = signal<string | null>(null);

  click(action: ToolbarAction): void {
    // A second click while the first request is still running is the most
    // common way an action button creates duplicate records.
    if (action.disabled || this.isBusy(action.id)) return;
    if (action.toggle) {
      this.activeIds.update(s => {
        const n = new Set(s);
        if (n.has(action.id)) { n.delete(action.id); } else { n.add(action.id); }
        return n;
      });
    } else {
      // Brief pressed flash for non-toggle buttons
      this._pressedId.set(action.id);
      if (this._pressTimer) clearTimeout(this._pressTimer);
      this._pressTimer = setTimeout(() => this._pressedId.set(null), 150);
    }
    this.actionClick.emit(action.id);
  }

  private _pressTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    // Regression guard for PHASE3_LAYOUT_UTILITIES_AUDIT.md finding #1: the
    // pressed-flash timer must not outlive the component.
    if (this._pressTimer) clearTimeout(this._pressTimer);
    this.detachScroll();
    this.destroyPortal();
  }

  isActive(action: ToolbarAction): boolean {
    if (action.toggle) return this.activeIds().has(action.id);
    return this._pressedId() === action.id;
  }

  readonly allActions = computed(() => {
    const flat = this.actions();
    if (flat.length) return [{ id: 'default', actions: flat }];
    return this.groups();
  });

  /** Flat, ordered list of every action across all groups. */
  readonly flatActions = computed<readonly ToolbarAction[]>(() =>
    this.allActions().flatMap(g => g.actions as ToolbarAction[]),
  );

  /**
   * Each action's position in {@link flatActions}, by OBJECT identity.
   *
   * ★ Identity, not id, because ids are not guaranteed unique (`LU-11-I1`): two
   *   actions sharing an id used to share the tab stop and, on arrow keys, both
   *   received `focus()` — the later one in the DOM won.
   */
  private readonly _indexOf = computed<ReadonlyMap<ToolbarAction, number>>(() => {
    const map = new Map<ToolbarAction, number>();
    this.flatActions().forEach((a, i) => { if (!map.has(a)) map.set(a, i); });
    return map;
  });

  /** Flat index of an action, for the template's `data-sv-toolbar-index`. */
  indexOf(action: ToolbarAction): number {
    return this._indexOf().get(action) ?? -1;
  }

  // ── Overflow menu mode (`LU-11-M3`) ─────────────────────────────────────────

  /**
   * The host's border-box width — what the parent allows, not what the
   * buttons need, so observing it cannot feed back into itself. Only observed
   * in `menu` mode; `scroll` mode never measures anything.
   */
  private readonly _hostSize = svElementSize(() =>
    this.overflow() === 'menu' ? this.host.nativeElement : null,
  );

  /** Width of the first `count` actions laid out inline, plus the More button when `more`. */
  private _stripWidth(count: number, more: boolean): number {
    const flat = this.flatActions();
    const btn = BUTTON_PX[this.size()] ?? BUTTON_PX.md;
    let separators = 0;
    for (let i = 0; i < count - 1; i++) separators += this._separatorsAfter(i, flat);
    // A fully-visible strip also draws whatever the last action asks for.
    if (!more && count === flat.length && count > 0) separators += this._separatorsAfter(count - 1, flat);
    // Empty non-final groups still draw their separator, whatever `count` is.
    separators += this._emptyGroupSeparators();
    const children = count + separators + (more ? 1 : 0);
    return CHROME_PX + (count + (more ? 1 : 0)) * btn + separators * SEPARATOR_PX + Math.max(0, children - 1) * GAP_PX;
  }

  /** How many separators the template draws after the action at `index` (0, 1 or 2). */
  private _separatorsAfter(index: number, flat: readonly ToolbarAction[]): number {
    const groupEnds = this._groupEnds();
    return (flat[index]?.dividerAfter ? 1 : 0) + (groupEnds.has(index) ? 1 : 0);
  }

  /** Separators the template draws for empty groups that are not the last one. */
  private readonly _emptyGroupSeparators = computed(() => {
    const groups = this.allActions();
    return groups.filter((g, gi) => gi < groups.length - 1 && g.actions.length === 0).length;
  });

  /** Flat indices of the last action of every group except the final one. */
  private readonly _groupEnds = computed<ReadonlySet<number>>(() => {
    const ends = new Set<number>();
    const groups = this.allActions();
    let at = -1;
    groups.forEach((g, gi) => {
      at += g.actions.length;
      if (gi < groups.length - 1 && g.actions.length) ends.add(at);
    });
    return ends;
  });

  /**
   * How many leading actions render inline.
   *
   * ★ Unmeasured (width 0 — the server, a hidden-at-init container, the first
   *   frame) means SHOW EVERYTHING, not "nothing fits". Otherwise every
   *   prerendered page would ship its fully-collapsed form and expand on
   *   hydration.
   */
  readonly visibleCount = computed<number>(() => {
    const total = this.flatActions().length;
    if (this.overflow() !== 'menu') return total;
    const width = this._hostSize().width;
    if (width <= 0) return total;
    if (this._stripWidth(total, false) <= width) return total;
    for (let k = total - 1; k > 0; k--) {
      if (this._stripWidth(k, true) <= width) return k;
    }
    return 0;
  });

  /** Whether any action has moved into the More menu. */
  readonly hasOverflow = computed(() => this.visibleCount() < this.flatActions().length);

  /** The actions currently in the More menu, in order, with their flat index. */
  readonly overflowActions = computed(() =>
    this.flatActions().slice(this.visibleCount()).map((action, i) => ({ action, index: this.visibleCount() + i })),
  );

  /** Whether separators after the action at `index` render (none next to the More button). */
  showSeparatorsAfter(index: number): boolean {
    return !this.hasOverflow() || index < this.visibleCount() - 1;
  }

  // ── Roving tabindex (ARIA toolbar keyboard pattern) ─────────────────────────

  /**
   * Every place the single tab stop can rest, in order: inline enabled actions,
   * then the More button.
   */
  readonly stops = computed<readonly ToolbarStop[]>(() => {
    const visible = this.visibleCount();
    const list: ToolbarStop[] = [];
    this.flatActions().forEach((action, index) => {
      if (index < visible && !action.disabled) list.push({ kind: 'action', action, index });
    });
    if (this.hasOverflow()) list.push({ kind: 'more' });
    return list;
  });

  /** Where the tab stop was last put (null → the first stop). */
  private readonly _roving = signal<ToolbarRovingMark | null>(null);

  /**
   * The stop that owns `tabindex="0"` — reconciled against the CURRENT data
   * every time it is read (`LU-11-I3` / `LU-11-M2`).
   *
   * 1. The remembered action if it is still an enabled, inline stop — the
   *    duplicate-id case resolved by flat index.
   * 2. Otherwise its SUCCESSOR: the stop now at the position it held, else the
   *    one before it (`svSuccessorIndex`, the kit's one mutation rule) — so
   *    disabling or removing the active action hands the tab stop to its
   *    neighbour instead of leaving the toolbar with no tab stop at all.
   * 3. With no stops (everything disabled) nothing claims `tabindex="0"`.
   */
  readonly activeStop = computed<ToolbarStop | null>(() => {
    const stops = this.stops();
    if (!stops.length) return null;
    const mark = this._roving();
    if (!mark) return stops[0];
    const matches = stops.filter(s =>
      mark.id === null ? s.kind === 'more' : s.kind === 'action' && s.action.id === mark.id,
    );
    if (matches.length) {
      return matches.find(s => s.kind === 'action' && s.index === mark.index) ?? matches[0];
    }
    return stops[svSuccessorIndex(mark.pos, stops.length)] ?? null;
  });

  /** Roving tabindex for a given action: 0 for the active stop, -1 otherwise. */
  tabIndexFor(action: ToolbarAction): number {
    if (action.disabled) return -1;
    const stop = this.activeStop();
    if (!stop || stop.kind !== 'action') return -1;
    if (stop.action === action) return 0;
    // A host calling this with an equal-but-new object (it is public API):
    // identity is unknown, so fall back to the id.
    return !this._indexOf().has(action) && stop.action.id === action.id ? 0 : -1;
  }

  /** Roving tabindex of the More button. */
  readonly moreTabIndex = computed(() => (this.activeStop()?.kind === 'more' ? 0 : -1));

  /** Arrow-key / Home / End navigation between toolbar buttons. */
  onKeydown(event: KeyboardEvent, action: ToolbarAction): void {
    const stops = this.stops();
    let idx = stops.findIndex(s => s.kind === 'action' && s.action === action);
    if (idx === -1 && !this._indexOf().has(action)) {
      idx = stops.findIndex(s => s.kind === 'action' && s.action.id === action.id);
    }
    this._navigate(event, idx, stops);
  }

  /** Keys on the More button: Left/Right/Home/End rove, Down/Up open the menu. */
  onMoreKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
      return;
    }
    const stops = this.stops();
    this._navigate(event, stops.findIndex(s => s.kind === 'more'), stops);
  }

  /** Keep the tab stop on whatever was focused last — a click included. */
  onStopFocus(action: ToolbarAction | null): void {
    const stops = this.stops();
    const pos = action === null
      ? stops.findIndex(s => s.kind === 'more')
      : stops.findIndex(s => s.kind === 'action' && s.action === action);
    if (pos === -1) return;
    this._setRoving(stops[pos], pos);
  }

  private _navigate(event: KeyboardEvent, idx: number, stops: readonly ToolbarStop[]): void {
    if (stops.length < 2 || idx === -1) return;

    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (idx + 1) % stops.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (idx - 1 + stops.length) % stops.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = stops.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this._setRoving(stops[next], next);
    this._elementFor(stops[next])?.focus();
  }

  private _setRoving(stop: ToolbarStop, pos: number): void {
    this._roving.set(
      stop.kind === 'more'
        ? { id: null, index: -1, pos }
        : { id: stop.action.id, index: stop.index, pos },
    );
  }

  /**
   * The button for a stop, looked up inside THIS toolbar's host only.
   *
   * ★ Regression guard for PHASE3_LAYOUT_UTILITIES_AUDIT.md finding #1: never a
   *   document-wide lookup (`document.getElementById`, a global selector) — two
   *   toolbars on one page share action ids, and a global lookup focused the
   *   other toolbar's button.
   */
  private _elementFor(stop: ToolbarStop | null): HTMLElement | null {
    if (!stop) return null;
    const root = this.host.nativeElement;
    return stop.kind === 'more'
      ? root.querySelector<HTMLElement>('[data-sv-toolbar-more]')
      : root.querySelector<HTMLElement>(`[data-sv-toolbar-index="${stop.index}"]`);
  }

  // ── Focus recovery after data changes (`LU-11-I2`, `X-10`) ──────────────────

  /**
   * Whether keyboard focus is on one of this toolbar's own buttons.
   *
   * A plain field, not a signal: it is read inside the reconcile effect and
   * must not re-run it.
   */
  private _focusInside = false;

  /** `focusin` on the toolbar strip. */
  onStripFocusIn(): void {
    this._focusInside = true;
  }

  /**
   * `focusout` on the toolbar strip.
   *
   * ★ A `null` `relatedTarget` is ambiguous: focus went to a non-focusable
   *   spot on the page (it left — forget it), OR the focused button was just
   *   removed or disabled by a data change (it did not leave by choice — keep
   *   it, so the reconcile below puts it back). Which one is only knowable a
   *   tick later, from whether the button is still there and still enabled.
   */
  onStripFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    if (next) { this._focusInside = false; return; }
    const from = event.target as HTMLButtonElement | null;
    queueMicrotask(() => {
      if (from?.isConnected && !from.disabled) this._focusInside = false;
    });
  }

  /**
   * After the stops change, put focus back if the change took it away.
   *
   * The tab stop itself needs no help — `activeStop` is derived — but the
   * browser's FOCUS does: a focused button that is removed drops focus to
   * `<body>` (the next Tab restarts at the top of the page), and one that is
   * disabled keeps a focus that no key reaches. Both move to the active stop's
   * successor, else to the toolbar itself — never `<body>`.
   */
  protected readonly reconcileFocus = effect(() => {
    this.stops();
    // ★ `loading` replaces the whole strip, so the focused button leaves the DOM
    //   with no `relatedTarget`. That is not a data change the user is waiting
    //   on: by the time loading ends they may be anywhere, and pulling focus
    //   back into the toolbar then would steal it.
    if (this.loading()) { this._focusInside = false; return; }
    if (!this._focusInside) return;
    afterNextRender(() => this._restoreFocus(), { injector: this.injector });
  });

  private _restoreFocus(): void {
    if (typeof document === 'undefined') return;
    const root = this.host.nativeElement;
    const active = document.activeElement as HTMLElement | null;
    const lost = !active || active === document.body;
    const stranded = !!active && root.contains(active) && (active as HTMLButtonElement).disabled === true;
    if (!lost && !stranded) return;
    svRecoverFocus({
      to: [this._elementFor(this.activeStop())],
      fallback: root.querySelector('[role="toolbar"]'),
    });
  }

  // ── Duplicate ids (`LU-11-I1` / `LU-11-M1`) ─────────────────────────────────

  /**
   * Dev-mode assertion: every action id, and every group id, must be unique.
   * The component still renders — identity-based roving keeps keyboard focus
   * correct — but `actionClick` emits the id, so the host cannot tell two
   * actions with one id apart, and that is a bug on the host's side.
   */
  protected readonly assertUniqueIds = effect(() => {
    const seen = new Set<string>();
    for (const a of this.flatActions()) {
      if (seen.has(a.id)) {
        svWarnOnce(
          `sv-toolbar:duplicate-action-id:${a.id}`,
          `sv-toolbar: two actions share the id "${a.id}". actionClick emits the id, so the host cannot tell them apart — give every action a unique id.`,
        );
      }
      seen.add(a.id);
    }
    const groups = new Set<string>();
    for (const g of this.groups()) {
      if (groups.has(g.id)) {
        svWarnOnce(`sv-toolbar:duplicate-group-id:${g.id}`, `sv-toolbar: two groups share the id "${g.id}". Group ids must be unique.`);
      }
      groups.add(g.id);
    }
  });

  // ── Overflow menu (body portal — see the styloviz dropdown pattern) ─────────

  /** Whether the More menu is open. */
  readonly menuOpen = signal(false);

  /** Inline position of the portalled panel. */
  readonly panelStyle = signal<Record<string, string>>({});

  private portal: SvPortalHost | null = null;
  private portalView: EmbeddedViewRef<object> | null = null;
  /**
   * The menu's registration on the shared overlay stack while it is open: its
   * z-index, and whether it owns Escape. It was a hard-coded `9999`, which
   * painted over a dialog opened from a menu item and closed on an Escape
   * meant for that dialog.
   */
  private overlay: SvOverlayHandle | null = null;

  /** The ng-template holding the menu panel markup. */
  @ViewChild('menuTpl', { read: TemplateRef })
  private readonly menuTpl?: TemplateRef<object>;

  /**
   * Close the menu when nothing is left in it (the toolbar grew, or actions
   * were removed). If focus was in the menu, it moves to the toolbar's tab
   * stop — the More button went with the menu, so there is no opener to
   * return to, and `<body>` is never the answer (`X-10`).
   */
  protected readonly closeWhenEmpty = effect(() => {
    if (!this.hasOverflow() && this.menuOpen()) {
      const hadFocus = this._menuFocusIndex !== -1;
      this.closeMenu(false);
      if (hadFocus) {
        afterNextRender(() => {
          const active = typeof document === 'undefined' ? null : document.activeElement;
          if (active && active !== document.body) return;
          svRecoverFocus({
            to: [this._elementFor(this.activeStop())],
            fallback: this.host.nativeElement.querySelector('[role="toolbar"]'),
          });
        }, { injector: this.injector });
      }
    }
  });

  /**
   * Position (among the enabled items) of the menu item that last held focus;
   * `-1` when focus is not in the menu. The anchor for the successor rule.
   */
  private _menuFocusIndex = -1;

  /** `focusin` inside the menu panel. */
  onMenuFocusIn(event: FocusEvent): void {
    const at = this._menuItems().indexOf(event.target as HTMLElement);
    if (at !== -1) this._menuFocusIndex = at;
  }

  /** `focusout` of the menu panel: forget the item once focus has really left. */
  onMenuFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    // `null` is ambiguous — the focused item was just removed or disabled.
    // Keep the index for the reconcile below; a real exit names its target.
    if (next && !this.portal?.element.contains(next)) this._menuFocusIndex = -1;
  }

  /**
   * `X-10` / `LU-11-I2` for the open menu: a menu item holding focus that is
   * removed (it moved back inline, or the host dropped it) sends focus to
   * `<body>`, and one that becomes disabled (busy) keeps a focus no key
   * reaches. Either way focus moves to the item now at its place, else the
   * one before it, else the menu panel itself.
   */
  protected readonly reconcileMenuFocus = effect(() => {
    this.overflowActions();
    this._busy();
    if (!this.menuOpen()) return;
    afterNextRender(() => this._restoreMenuFocus(), { injector: this.injector });
  });

  private _restoreMenuFocus(): void {
    if (typeof document === 'undefined' || !this.menuOpen() || this._menuFocusIndex === -1) return;
    const panel = this.portal?.element.querySelector<HTMLElement>('[role="menu"]') ?? null;
    const active = document.activeElement as HTMLElement | null;
    const lost = !active || active === document.body;
    const stranded = !!active && !!panel?.contains(active) && (active as HTMLButtonElement).disabled === true;
    if (!lost && !stranded) return;
    const items = this._menuItems();
    const target = items[svSuccessorIndex(this._menuFocusIndex, items.length)] ?? null;
    svRecoverFocus({ to: [target], fallback: panel });
    this._menuFocusIndex = target ? items.indexOf(target) : -1;
  }

  toggleMenu(): void {
    if (this.menuOpen()) this.closeMenu(true);
    else this.openMenu('first');
  }

  /** Open the More menu and focus its first (or last) enabled item. */
  openMenu(focus: 'first' | 'last' = 'first'): void {
    if (this.menuOpen() || !this.menuTpl || !this.hasOverflow()) return;

    // The stack registration first — the panel's z-index is the registration's —
    // and handed back if the mount throws, so a dead entry never stays
    // "topmost" and swallows Escape for everything opened after it.
    this.overlay = this.stack.push('anchored', { element: () => this.portal?.element });
    const tpl = this.menuTpl;
    try {
      this._calcPos();
      this.portal = createPortalHost({
        origin: this.host.nativeElement,
        className: 'sv-toolbar-menu-portal',
        label: 'toolbar-menu',
        // Unregisters itself on destroy — see `SvPortalHost`.
        destroyRef: this.destroyRef,
      });
      this.portalView = tpl.createEmbeddedView({});
      this.appRef.attachView(this.portalView);
      this.menuOpen.set(true);
      // Render BEFORE the nodes reach the document — see
      // scripts/fix-portal-insertion-order.mjs.
      this.portalView.detectChanges();
      this.portalView.rootNodes.forEach((n: Node) => this.portal?.element.appendChild(n));
      this.portal.attach();
    } catch (err) {
      this.menuOpen.set(false);
      this.destroyPortal();
      throw err;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    }

    const items = this._menuItems();
    (focus === 'last' ? items[items.length - 1] : items[0])?.focus();
  }

  /** Close the menu; `returnFocus` hands focus back to the More button. */
  closeMenu(returnFocus: boolean): void {
    if (!this.menuOpen()) return;
    this.detachScroll();
    this.destroyPortal();
    this.menuOpen.set(false);
    if (returnFocus) this.host.nativeElement.querySelector<HTMLElement>('[data-sv-toolbar-more]')?.focus();
  }

  /** Activate an action from the menu, then close it. */
  onMenuSelect(action: ToolbarAction): void {
    if (action.disabled || this.isBusy(action.id)) return;
    this.click(action);
    this.closeMenu(true);
  }

  /** Arrow keys, Home and End inside the menu; Tab closes it. */
  onMenuKeydown(event: KeyboardEvent): void {
    const items = this._menuItems();
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    switch (event.key) {
      case 'ArrowDown': next = (at + 1) % items.length; break;
      case 'ArrowUp':   next = at <= 0 ? items.length - 1 : at - 1; break;
      case 'Home':      next = 0; break;
      case 'End':       next = items.length - 1; break;
      case 'Tab':
        // Focus goes back to the More button first, so the browser's own Tab
        // continues from the toolbar rather than from the end of <body>.
        this.closeMenu(true);
        return;
      default:
        return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  /** The enabled menu items, in order. */
  private _menuItems(): HTMLElement[] {
    const el = this.portal?.element;
    return el ? [...el.querySelectorAll<HTMLElement>('[data-sv-toolbar-menuitem]:not([disabled])')] : [];
  }

  /**
   * Click outside closes. The panel lives in `<body>`, so both the host AND the
   * portal must be checked.
   */
  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const target = event.target as Node;
    // A surface opened above the menu (a dialog from a menu item) is not "outside".
    if (this.overlay?.isInsideHigherSurface(target)) return;
    if (this.host.nativeElement.contains(target)) return;
    if (this.portal?.element.contains(target)) return;
    this.closeMenu(false);
  }

  /** A resize invalidates the coordinates, and usually the overflow split too. */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.menuOpen()) this.closeMenu(false);
  }

  /**
   * On the DOCUMENT, not the host: focus is inside the portalled panel while it
   * is open, so a host-bound Escape would never hear the key. And only while
   * the menu is the TOPMOST overlay (`SvOverlayStackService`): an Escape meant
   * for a dialog opened over it must not close the menu underneath too.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.menuOpen()) return;
    if (this.overlay && !this.overlay.isTopmost()) return;
    this.closeMenu(true);
  }

  private _rafId: number | null = null;

  /** Capture-phase, rAF-throttled: re-anchor to the More button on ANY ancestor scroll. */
  private readonly _scrollHandler = (): void => {
    if (!this.menuOpen() || this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.menuOpen()) {
        this._calcPos();
        this.portalView?.detectChanges();
      }
    });
  };

  private detachScroll(): void {
    if (typeof window !== 'undefined') window.removeEventListener('scroll', this._scrollHandler, true);
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  /** Position the panel against the More button, clamped to the viewport on both axes. */
  private _calcPos(): void {
    const trigger =
      this.host.nativeElement.querySelector<HTMLElement>('[data-sv-toolbar-more]') ?? this.host.nativeElement;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const panelH = this.overflowActions().length * MENU_ROW_H + 8;
    const spaceBelow = vh - rect.bottom - MENU_GAP - MENU_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - MENU_MARGIN;
    const above = spaceBelow < panelH && spaceAbove > spaceBelow;
    const maxH = Math.max(MENU_MIN_H, Math.min(MENU_HARD_MAX_H, above ? spaceAbove : spaceBelow));

    // The More button sits at the END of the strip, so prefer lining the
    // panel's right edge up with it; fall back to the left when that side is
    // too tight.
    const leftRoom = vw - rect.left - MENU_MARGIN;
    const rightRoom = rect.right - MENU_MARGIN;
    const right = rightRoom >= MENU_PANEL_W || rightRoom > leftRoom;

    const style: Record<string, string> = {
      position: 'fixed',
      // The overlay stack's z-index: above page chrome, and correctly ordered
      // against a drawer or dialog the toolbar lives in.
      zIndex: String(this.overlay?.zIndex ?? 1000),
      maxHeight: `${maxH}px`,
    };
    style[above ? 'bottom' : 'top'] = above
      ? `${vh - rect.top + MENU_GAP}px`
      : `${rect.bottom + MENU_GAP}px`;
    if (right) {
      style['right'] = `${Math.max(MENU_MARGIN, vw - rect.right)}px`;
      style['maxWidth'] = `${rightRoom}px`;
    } else {
      style['left'] = `${Math.max(MENU_MARGIN, rect.left)}px`;
      style['maxWidth'] = `${leftRoom}px`;
    }
    style['minWidth'] = `${Math.min(160, right ? rightRoom : leftRoom)}px`;
    this.panelStyle.set(style);
  }

  private destroyPortal(): void {
    this._menuFocusIndex = -1;
    this.overlay?.release();
    this.overlay = null;
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portal?.destroy();
    this.portal = null;
  }

  readonly btnSize = computed(() => ({
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }[this.size()]));

  readonly iconSize = computed(() => ({
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[this.size()]));

  readonly wrapperClass = computed(() => {
    const v = this.variant();
    // `max-w-full overflow-x-auto` lets a toolbar with many actions scroll
    // horizontally instead of overflowing the viewport on small screens, while
    // keeping the compact single-row pill on wider containers.
    const base = 'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1 transition-all duration-150';
    const s = this.sticky() ? ' sticky top-2 z-30' : '';
    if (v === 'default')  return base + s + ' bg-white border border-gray-200/80 shadow-sm dark:bg-gray-800 dark:border-gray-700/60';
    if (v === 'glass')    return base + s + ' bg-white/70 backdrop-blur-md border border-white/50 shadow-lg dark:bg-gray-900/70 dark:border-gray-700/30';
    if (v === 'bordered') return base + s + ' border-2 border-gray-300 dark:border-gray-600';
    if (v === 'elevated') return base + s + ' bg-white shadow-[0_4px_24px_-8px_color-mix(in_oklab,var(--color-gray-900)_18%,transparent)] dark:bg-gray-800 dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]';
    if (v === 'ghost')    return base + s + ' bg-transparent';
    return base + s;
  });

  /** The More button: a neutral action button, shown active while its menu is open. */
  readonly moreBtnClass = computed(() =>
    this.variantBtnClass({ id: '', label: '', icon: '' }, this.menuOpen()),
  );

  variantBtnClass(action: ToolbarAction, active: boolean): string {
    const base = `relative inline-flex items-center justify-center rounded-lg
      font-medium transition-all duration-150 outline-none
      focus-visible:ring-2 focus-visible:ring-primary-400/50
      disabled:cursor-not-allowed disabled:opacity-40
      ${this.btnSize()} ${FORCED_FOCUS}`;
    const v = action.variant ?? 'default';

    if (active) {
      // `X-7`: the active accent is a tint plus a box-shadow ring, and forced
      // colors removes both — an active tool would look exactly like an idle
      // one. A Highlight border survives the mode (author system colours are kept).
      const forced = ' forced-colors:border forced-colors:border-[Highlight]';
      if (v === 'primary') return base + ' bg-primary-100 text-primary-700 ring-1 ring-primary-300/50 dark:bg-primary-900/30 dark:text-primary-300' + forced;
      if (v === 'danger')  return base + ' bg-danger-100 text-danger-700 ring-1 ring-danger-300/50 dark:bg-danger-900/30 dark:text-danger-300' + forced;
      if (v === 'success') return base + ' bg-accent-100 text-accent-700 ring-1 ring-accent-300/50 dark:bg-accent-900/30 dark:text-accent-300' + forced;
      return base + ' bg-gray-200 text-gray-900 ring-1 ring-gray-300/60 dark:bg-gray-600 dark:text-white' + forced;
    }

    if (v === 'primary') return base + ' text-primary-600 hover:bg-primary-50 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-900/20';
    if (v === 'danger')  return base + ' text-danger-600 hover:bg-danger-50 hover:text-danger-700 dark:text-danger-400 dark:hover:bg-danger-900/20';
    if (v === 'success') return base + ' text-accent-700 hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-900/20';
    return base + ' text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200';
  }
}
