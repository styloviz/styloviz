import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  onReducedMotionChange,
  prefersReducedMotion,
  svIsRtl,
  svLogicalArrowKey,
  svRovingTarget,
} from '@styloviz/core/a11y';
import { resolveItemKey, warnOnDuplicateItemKeys, type SvItemKey } from '@styloviz/core/data';
import { svWarnOnce } from '@styloviz/core/dev';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_LINK_ADAPTER, svIsModifiedClick, type SvLinkTarget } from '@styloviz/core/nav';
import { svIsSafeUrl } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_LAYOUT_LABELS, type SvLayoutLabels } from '@styloviz/layout/labels';
import { svDockClampPeak, svDockCurrentIndex, svDockFit, svDockLayout, svDockPointerIndex, type SvDockFit } from './dock.logic';

import { registerDockIcons } from './dock.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** The edge of its container the dock sits on. Physical — `left` stays left under `dir="rtl"`. */
export type SvDockPosition = 'bottom' | 'top' | 'left' | 'right';

/** Resting item size: `sm` 40 px, `md` 48 px, `lg` 56 px. */
export type SvDockSize = 'sm' | 'md' | 'lg';

/**
 * How the dock is placed.
 * - `absolute` — on `position`'s edge of the nearest positioned ancestor (give the container `relative`).
 * - `static` — in the flow, where the host puts it; `position` still sets the orientation and which way items grow.
 */
export type SvDockPlacement = 'absolute' | 'static';

/** One launcher in the dock. */
export interface SvDockItem {
  /** Stable identity (the default `itemKey`). */
  readonly id: string;
  /** The accessible name and the tooltip. Required — the items are icon-only. */
  readonly label: string;
  /** A glyph name registered with `@styloviz/icons`. */
  readonly icon?: string;
  /** An image instead of a glyph (an app icon). Only safe URLs are loaded; `data:` images are allowed. */
  readonly image?: string;
  /** An in-app destination, rendered through `SV_LINK_ADAPTER` (a router transition when the app provides one). */
  readonly route?: SvLinkTarget;
  /** A plain URL followed by the browser — another site, a download. `javascript:` and friends are refused. */
  readonly href?: string;
  /** Open `href` in a new tab (`target="_blank" rel="noopener noreferrer"`). */
  readonly external?: boolean;
  /** Shown, focusable and announced as unavailable, but never activates. */
  readonly disabled?: boolean;
  /** A count or short status on the item's corner — also read after the label. */
  readonly badge?: string | number;
}

/** How an item was activated. */
export type SvDockSelectSource = 'pointer' | 'keyboard';

/** What `itemSelect` reports. */
export interface SvDockSelection {
  /** The item activated. */
  readonly item: SvDockItem;
  /** Its position in `items`. */
  readonly index: number;
  /** A click or tap, or Enter / Space. */
  readonly source: SvDockSelectSource;
}

/** One rendered item. */
interface DockRow {
  readonly item: SvDockItem;
  readonly key: string | number;
  readonly index: number;
  /** `link` renders an `<a>`, `button` a `<button>`. */
  readonly kind: 'link' | 'button';
  readonly href: string | null;
  readonly image: string | null;
  readonly disabled: boolean;
  readonly current: boolean;
  readonly external: boolean;
  readonly badge: string | null;
  /** The label's first letter, for an item with neither a glyph nor a usable image. */
  readonly initial: string;
}

/** One item's motion — `null` transforms mean "at rest", so nothing is written to `style`. */
interface DockMotion {
  readonly item: string | null;
  readonly control: string | null;
  readonly tip: string | null;
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

/** Resting item size in px — must match `SIZE_CLASSES`. */
const SIZE_PX: Record<SvDockSize, number> = { sm: 40, md: 48, lg: 56 };
const SIZE_CLASSES: Record<SvDockSize, string> = { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-14 w-14' };
const ICON_PX: Record<SvDockSize, number> = { sm: 20, md: 24, lg: 28 };
/** The space between two items in px — must match the bar's `gap-2`. */
const GAP_PX = 8;
/** The bar's padding at each end in px — must match its `p-2`. */
const PAD_PX = 8;
/** How many items either side the swell reaches. */
const RANGE = 2.5;

/**
 * Edge classes. The dock's `position` is a PHYSICAL edge by design (like the
 * drawer's), so these are physical where they name a side.
 */
const HOST_ABSOLUTE: Record<SvDockPosition, string> = {
  bottom: 'absolute inset-x-0 bottom-3 z-30 mx-auto flex w-max max-w-full justify-center',
  top: 'absolute inset-x-0 top-3 z-30 mx-auto flex w-max max-w-full justify-center',
  // sv-physical: the dock's position input names a physical edge, and it stays there under dir="rtl"
  left: 'absolute inset-y-0 left-3 z-30 my-auto flex h-max max-h-full flex-col justify-center',
  // sv-physical: the dock's position input names a physical edge, and it stays there under dir="rtl"
  right: 'absolute inset-y-0 right-3 z-30 my-auto flex h-max max-h-full flex-col justify-center',
};
const HOST_STATIC: Record<SvDockPosition, string> = {
  bottom: 'relative flex w-max max-w-full',
  top: 'relative flex w-max max-w-full',
  left: 'relative inline-flex h-max flex-col',
  right: 'relative inline-flex h-max flex-col',
};

/** Where a control grows from: the centre of the dock's edge. */
const ORIGIN: Record<SvDockPosition, string> = {
  bottom: 'origin-bottom',
  top: 'origin-top',
  // sv-physical: the item grows away from the physical edge the dock sits on
  left: 'origin-left',
  // sv-physical: the item grows away from the physical edge the dock sits on
  right: 'origin-right',
};

/** The tooltip sits on the side away from the edge, centred on its item. */
const TIP: Record<SvDockPosition, string> = {
  bottom: 'bottom-full inset-x-0 mx-auto mb-2',
  top: 'top-full inset-x-0 mx-auto mt-2',
  // sv-physical: the tooltip opens away from the dock's physical edge
  left: 'left-full inset-y-0 my-auto ml-2',
  // sv-physical: the tooltip opens away from the dock's physical edge
  right: 'right-full inset-y-0 my-auto mr-2',
};

/** The current-page dot, between the item and the edge. */
const DOT: Record<SvDockPosition, string> = {
  bottom: '-bottom-1.5 inset-x-0 mx-auto',
  top: '-top-1.5 inset-x-0 mx-auto',
  // sv-physical: the dot sits between the item and the dock's physical edge
  left: '-left-1.5 inset-y-0 my-auto',
  // sv-physical: the dot sits between the item and the dock's physical edge
  right: '-right-1.5 inset-y-0 my-auto',
};

/**
 * `X-7` — the focus ring is a box-shadow, which `forced-colors: active`
 * removes; an outline comes back in that mode only. `outline-solid` is
 * required — Tailwind 4's `outline-2` reads the style `outline-none` set.
 */
const FORCED_FOCUS = // sv-i18n-ignore: Tailwind classes
  'forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-offset-2';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Dock — a bar of launchers on one edge of a container, where the item under
 * the pointer and its neighbours grow (macOS style).
 *
 * ★★★ A TOOLBAR, BY APG. One tab stop: Tab enters on the current (or last
 *     used) item and leaves; the arrow keys along the dock move between items
 *     (←/→ for a horizontal dock, in the order the eye sees under RTL; ↑/↓ for
 *     a vertical one), Home/End go to the ends, Enter and Space activate.
 *     Built in-house on core's `svRovingTarget` + `svLogicalArrowKey`; it moves
 *     to `@angular/aria`'s toolbar with the kit's other widgets when
 *     docs/ADR-aria.md applies (2.1).
 *
 * ★★ REAL LINKS AND BUTTONS. An item with a `route` or `href` is an `<a href>`
 *    (middle-click, "copy link", the status bar all work); one without is a
 *    `<button>`. Routes go through `SV_LINK_ADAPTER`, so there is no
 *    `@angular/router` import; an `href` must pass `svIsSafeUrl` or the item is
 *    rendered unavailable — `javascript:` never reaches an attribute.
 *
 * ★★ MAGNIFICATION IS TRANSFORM-ONLY. Each control is scaled about the centre
 *    of its edge and each item translated by the room its neighbours took
 *    (`svDockLayout`); nothing is laid out again, so the pointer stays over
 *    the item it is over. Scale never drops below 1, so a target only ever
 *    grows. It follows keyboard focus too, ignores touch, and is off under
 *    `prefers-reduced-motion` — no transform at all.
 *
 * ★ The label shows on hover AND on focus, and Escape hides it (WCAG 1.4.13).
 *
 * @example
 * ```html
 * <div class="relative h-[480px]">
 *   <sv-dock [items]="apps" [activeRoute]="router.url" (itemSelect)="open($event.item)" />
 * </div>
 * ```
 */
@Component({
  selector: 'sv-dock',
  standalone: true,
  imports: [NgTemplateOutlet, SvIconComponent],
  templateUrl: './dock.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    '[attr.data-sv-dock-position]': 'position()', // sv-i18n-ignore: host binding key
  },
})
export class SvDockComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerDockIcons();

  private readonly registryLabels = injectSvLabels('layout', SV_LAYOUT_LABELS);
  private readonly links = inject(SV_LINK_ADAPTER);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Data ──────────────────────────────────────────────────────────────────

  /** The launchers, in order along the dock. @default [] */
  readonly items = input<readonly SvDockItem[]>([]);

  /** What identifies an item — a property name or a function. @default 'id' */
  readonly itemKey = input<SvItemKey<SvDockItem>>('id');

  /**
   * The path the reader is on, so the item whose `route` matches (longest
   * match, on segment boundaries) is `aria-current="page"` and marked with a
   * dot. Controlled — a routed host writes `[activeRoute]="router.url"`. @default ''
   */
  readonly activeRoute = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** The container edge the dock sits on; also its orientation. @default 'bottom' */
  readonly position = input<SvDockPosition>('bottom');

  /** `absolute` pins it to `position`'s edge of the nearest positioned ancestor; `static` leaves it in the flow. @default 'absolute' */
  readonly placement = input<SvDockPlacement>('absolute');

  /** Resting item size. @default 'md' */
  readonly size = input<SvDockSize>('md');

  /** Grow the item under the pointer (or keyboard focus) and its neighbours. Off under reduced motion regardless. @default true */
  readonly magnification = input<boolean>(true);

  /** The scale of the item under the pointer, 1–2 (values outside are clamped). @default 1.6 */
  readonly magnificationScale = input<number>(1.6);

  /** The toolbar's accessible name. Empty uses the `dock` label ('Dock'). @default '' */
  readonly ariaLabel = input<string>('');

  /** Per-instance overrides for the package labels. @default {} */
  readonly labels = input<Partial<SvLayoutLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /**
   * An item was activated — by a click or tap, or by Enter / Space. Not
   * emitted for a disabled item, or for a modified click (a new tab or
   * window) on a link, which the browser handles.
   */
  readonly itemSelect = output<SvDockSelection>();

  // ── Derived state ─────────────────────────────────────────────────────────

  protected readonly text = computed<SvLayoutLabels>(() => ({ ...this.registryLabels, ...this.labels() }));
  protected readonly toolbarName = computed(() => this.ariaLabel().trim() || this.text().dock);
  protected readonly vertical = computed(() => this.position() === 'left' || this.position() === 'right');
  /** The resting item size for `size`. */
  private readonly restPx = computed(() => SIZE_PX[this.size()] ?? SIZE_PX.md);

  // ── Fitting the container (WCAG 1.4.10) ──────────────────────────────────

  /** The room the container gives the dock along its axis, in px — `null` until measured. */
  private readonly available = signal<{ readonly width: number; readonly height: number } | null>(null);

  /**
   * ★ A dock never runs off its container. When the natural row is longer than
   *   the room, the items shrink evenly (never below 32 px — a 24 px target with
   *   a legible glyph); when even that does not fit, the dock scrolls along its
   *   axis so every control stays reachable. Magnification is off while shrunk:
   *   a swell would spill past the very edge it was squeezed to fit.
   */
  protected readonly fit = computed<SvDockFit>(() => {
    const box = this.available();
    const room = box === null ? null : this.vertical() ? box.height : box.width;
    return svDockFit(this.items().length, room, { size: this.restPx(), gap: GAP_PX, padding: PAD_PX });
  });

  /** The item size actually rendered. */
  private readonly sizePx = computed(() => this.fit().itemSize);
  /** An explicit size only while shrunk — otherwise the size class decides. */
  protected readonly shrunkPx = computed(() => (this.fit().shrunk ? this.fit().itemSize : null));
  protected readonly iconPx = computed(() =>
    this.fit().shrunk ? Math.max(16, Math.round(this.fit().itemSize / 2)) : (ICON_PX[this.size()] ?? ICON_PX.md),
  );

  protected readonly rows = computed<readonly DockRow[]>(() => {
    const items = this.items();
    const key = this.itemKey();
    warnOnDuplicateItemKeys(items, key, 'sv-dock [items]');
    const routes = items.map((item) => (item.route !== undefined && !item.disabled ? routePath(item.route) : null));
    const current = svDockCurrentIndex(routes, this.activeRoute());
    return items.map((item, index) => {
      const { kind, href, refused } = this.resolveLink(item);
      return {
        item,
        key: resolveItemKey(item, key, index),
        index,
        kind,
        href: item.disabled ? null : href,
        image: item.image && svIsSafeUrl(item.image, true) ? item.image : null,
        disabled: !!item.disabled || refused,
        current: index === current,
        external: kind === 'link' && !!item.external && item.href !== undefined,
        badge: item.badge === undefined || item.badge === null || item.badge === '' ? null : String(item.badge),
        initial: (item.label ?? '').trim().charAt(0).toUpperCase(),
      };
    });
  });

  // ── Roving focus ──────────────────────────────────────────────────────────

  /** The one item in the tab order: the current page when there is one, else the first — until the reader moves. */
  private readonly tabStop = linkedSignal(() => Math.max(0, this.rows().findIndex((r) => r.current)));
  protected readonly stop = computed(() => Math.min(this.tabStop(), Math.max(0, this.rows().length - 1)));

  // ── Magnification ─────────────────────────────────────────────────────────

  private readonly reducedMotion = signal(prefersReducedMotion());
  /** The swell's centre from the pointer, as a continuous item index. */
  private readonly pointerCenter = signal<number | null>(null);
  /** The swell's centre from keyboard focus. */
  private readonly focusCenter = signal<number | null>(null);
  /** The bar's resting length along the dock, measured when the swell starts. */
  private readonly barLength = signal(0);
  /** Right-to-left, read when the pointer or a key needs it. */
  private readonly rtl = signal(false);
  /** Escape hides the labels until focus or the pointer moves on (WCAG 1.4.13). */
  protected readonly tipsHidden = signal(false);
  /** The last input in the bar was a key — for a runtime without `:focus-visible`. */
  private keyboardModality = false;

  /** Whether the swell runs at all. */
  protected readonly magnifies = computed(
    () =>
      this.magnification() && !this.reducedMotion() && !this.fit().shrunk && svDockClampPeak(this.magnificationScale()) > 1,
  );

  private readonly layout = computed(() =>
    svDockLayout(this.rows().length, this.magnifies() ? (this.pointerCenter() ?? this.focusCenter()) : null, {
      peak: this.magnificationScale(),
      range: RANGE,
      size: this.sizePx(),
    }),
  );

  protected readonly motion = computed<readonly DockMotion[]>(() => {
    const { scales, offsets } = this.layout();
    const size = this.sizePx();
    const position = this.position();
    const vertical = this.vertical();
    const sign = !vertical && this.rtl() ? -1 : 1;
    return scales.map((scale, i) => {
      const offset = offsets[i] * sign;
      const lift = (scale - 1) * size;
      return {
        item: Math.abs(offset) < 0.01 ? null : vertical ? `translate3d(0, ${round(offset)}px, 0)` : `translate3d(${round(offset)}px, 0, 0)`,
        control: scale === 1 ? null : `scale(${round(scale, 3)})`,
        tip: lift < 0.01 ? null : tipTransform(position, lift),
      };
    });
  });

  /** The bar's backdrop grows along the dock by the room the swell took, so it still frames every item. */
  protected readonly backdropTransform = computed(() => {
    const { extent } = this.layout();
    const length = this.barLength();
    if (extent < 0.01 || length <= 0) return null;
    const k = round((length + extent) / length, 4);
    return this.vertical() ? `scaleY(${k})` : `scaleX(${k})`;
  });

  // ── Classes ───────────────────────────────────────────────────────────────

  protected readonly hostClasses = computed(() =>
    (this.placement() === 'static' ? HOST_STATIC : HOST_ABSOLUTE)[this.position()] ?? HOST_ABSOLUTE.bottom,
  );

  protected readonly barClasses = computed(
    () => `relative isolate flex max-h-full min-h-0 min-w-0 max-w-full gap-2 p-2 ${this.vertical() ? 'flex-col' : 'flex-row'}`,
  );

  /** The list scrolls along the dock only when even the smallest items do not fit. */
  protected readonly listClasses = computed(() => {
    const axis = this.vertical() ? 'flex min-h-0 flex-col gap-2' : 'flex min-w-0 flex-row gap-2';
    if (!this.fit().scroll) return axis;
    return `${axis} ${this.vertical() ? 'overflow-y-auto overscroll-contain' : 'overflow-x-auto overscroll-contain'}`;
  });

  protected readonly controlClasses = computed(() =>
    [
      'relative flex shrink-0 items-center justify-center overflow-visible rounded-2xl',
      SIZE_CLASSES[this.size()] ?? SIZE_CLASSES.md,
      ORIGIN[this.position()] ?? ORIGIN.bottom,
      'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 transition-[transform,box-shadow] duration-100 ease-out',
      'hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      'aria-disabled:cursor-not-allowed aria-disabled:opacity-45 motion-reduce:transition-none',
      'dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:text-white',
      FORCED_FOCUS,
    ].join(' '),
  );

  protected readonly tipClasses = computed(() =>
    [
      'pointer-events-none absolute z-20 w-max max-w-48 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg',
      'opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100',
      'motion-reduce:transition-none dark:bg-gray-100 dark:text-gray-900 forced-colors:border forced-colors:border-[CanvasText]',
      TIP[this.position()] ?? TIP.bottom,
    ].join(' '),
  );

  protected readonly dotClasses = computed(
    () => `pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-primary-600 dark:bg-primary-400 forced-colors:bg-[CanvasText] ${DOT[this.position()] ?? DOT.bottom}`,
  );

  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const stop = onReducedMotionChange((reduced) => this.reducedMotion.set(reduced));
    destroyRef.onDestroy(stop);

    // Measure the container the dock has to fit, and follow it as it resizes.
    afterNextRender(() => {
      const frame = this.frame();
      if (!frame || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measureFrame());
      observer.observe(frame);
      this.measureFrame();
      destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      for (const item of this.items()) {
        if (!item.label?.trim()) {
          svWarnOnce(
            `sv-dock:label:${item.id}`,
            `sv-dock item "${item.id}" has an empty \`label\` — an icon-only control with no accessible name and no tooltip.`,
          );
        }
      }
    });
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  /** Where the pointer is along the dock drives the swell. Touch never magnifies — there is no hover to follow. */
  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !this.magnifies()) return;
    const list = this.list()?.nativeElement;
    if (!list) return;
    this.keyboardModality = false;
    const rect = list.getBoundingClientRect();
    const rtl = !this.vertical() && svIsRtl(list);
    const offset = this.vertical() ? event.clientY - rect.top : rtl ? rect.right - event.clientX : event.clientX - rect.left;
    this.rtl.set(rtl);
    this.measureBar();
    this.pointerCenter.set(svDockPointerIndex(offset, this.sizePx(), GAP_PX));
  }

  protected onPointerLeave(): void {
    this.pointerCenter.set(null);
    this.tipsHidden.set(false);
  }

  protected onFocusIn(event: FocusEvent): void {
    const index = indexOf(event.target);
    if (index === null) return;
    this.tabStop.set(index);
    this.tipsHidden.set(false);
    if (!this.magnifies() || !(this.keyboardModality || focusVisible(event.target as Element))) return;
    this.rtl.set(!this.vertical() && svIsRtl(event.target as Element));
    this.measureBar();
    this.focusCenter.set(index);
  }

  protected onFocusOut(event: FocusEvent): void {
    const bar = this.bar()?.nativeElement;
    const next = event.relatedTarget as Node | null;
    if (bar && next && bar.contains(next)) return;
    this.focusCenter.set(null);
  }

  /**
   * The toolbar's keys. Only the arrows along the dock move — the cross-axis
   * pair is left alone — and Space activates a link as it does a button.
   * Enter is never handled here: the browser already turns it into a click.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    this.keyboardModality = true;
    const target = event.target as HTMLElement;
    const index = indexOf(target);
    if (index === null) return;

    if (event.key === 'Escape') {
      if (!this.tipsHidden()) {
        this.tipsHidden.set(true);
        event.preventDefault();
      }
      return;
    }
    if (event.key === ' ' && target.tagName === 'A') {
      event.preventDefault();
      target.click();
      return;
    }

    const vertical = this.vertical();
    let key = event.key;
    if (vertical && (key === 'ArrowLeft' || key === 'ArrowRight')) return;
    if (!vertical && (key === 'ArrowUp' || key === 'ArrowDown')) return;
    if (!vertical) key = svLogicalArrowKey(key, svIsRtl(target));
    const next = svRovingTarget(key, this.rows().length, index);
    if (next === null) return;
    event.preventDefault();
    this.focusItem(next);
  }

  /**
   * ★ The browser's navigation is cancelled exactly when the adapter takes it,
   *   and a modified click on a link (new tab, new window) is the browser's.
   */
  protected onActivate(event: MouseEvent, row: DockRow): void {
    if (row.disabled) {
      event.preventDefault();
      return;
    }
    if (row.kind === 'link') {
      if (svIsModifiedClick(event)) return;
      if (row.item.route !== undefined && this.links.navigate(row.item.route)) event.preventDefault();
    }
    this.itemSelect.emit({ item: row.item, index: row.index, source: event.detail === 0 ? 'keyboard' : 'pointer' });
  }

  /** Move focus to an item — what the arrow keys do. */
  focusItem(index: number): void {
    const controls = this.bar()?.nativeElement.querySelectorAll<HTMLElement>('[data-sv-dock-control]');
    const el = controls?.[index];
    if (!el) return;
    this.tabStop.set(index);
    el.focus();
  }

  /** The element whose box the dock must fit: its containing block, or its parent when static. */
  private frame(): HTMLElement | null {
    const host = this.host.nativeElement;
    if (this.placement() === 'static') return host.parentElement;
    return (host.offsetParent as HTMLElement | null) ?? host.parentElement;
  }

  private measureFrame(): void {
    const frame = this.frame();
    if (!frame) return;
    // An absolutely placed dock spans the containing block's padding box; a static one sits in the content box.
    let width = frame.clientWidth;
    let height = frame.clientHeight;
    if (this.placement() === 'static') {
      const cs = getComputedStyle(frame);
      width -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      height -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    }
    // No layout (a server, a test DOM): leave the dock at its resting size.
    if (width <= 0 && height <= 0) {
      this.available.set(null);
      return;
    }
    const prev = this.available();
    if (prev && prev.width === width && prev.height === height) return;
    this.available.set({ width, height });
  }

  private measureBar(): void {
    const bar = this.bar()?.nativeElement;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    this.barLength.set(this.vertical() ? rect.height : rect.width);
  }

  /** Link or button, and the `href` — `null` when the target is not a safe one. */
  private resolveLink(item: SvDockItem): { kind: 'link' | 'button'; href: string | null; refused: boolean } {
    if (item.route !== undefined) {
      const href = this.links.href(item.route);
      return { kind: 'link', href, refused: href === null };
    }
    if (item.href !== undefined) {
      const safe = svIsSafeUrl(item.href, false);
      if (!safe) {
        svWarnOnce(
          `sv-dock:unsafe-href:${item.id}`,
          `sv-dock item "${item.id}" has an href with a scheme that is not allowed, so it is rendered unavailable. ` +
            'Only relative paths, http(s):, mailto: and tel: are linked.',
        );
      }
      return { kind: 'link', href: safe ? item.href.trim() : null, refused: !safe };
    }
    return { kind: 'button', href: null, refused: false };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function routePath(route: SvLinkTarget): string {
  if (typeof route === 'string') return route;
  return route
    .map((segment, i) => (i === 0 ? segment : segment.replace(/^\//, '')))
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function indexOf(target: EventTarget | null): number | null {
  const el = (target as Element | null)?.closest?.('[data-sv-dock-control]');
  const raw = el?.getAttribute('data-sv-dock-index');
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

/** `:focus-visible`, or `false` where the selector is not supported. */
function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

function tipTransform(position: SvDockPosition, lift: number): string {
  const px = round(lift);
  switch (position) {
    case 'top':
      return `translate3d(0, ${px}px, 0)`;
    case 'left':
      return `translate3d(${px}px, 0, 0)`;
    case 'right':
      return `translate3d(${-px}px, 0, 0)`;
    default:
      return `translate3d(0, ${-px}px, 0)`;
  }
}

function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
