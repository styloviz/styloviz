import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EmbeddedViewRef,
  Injector,
  OnDestroy,
  PLATFORM_ID,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT, NgClass, isPlatformBrowser } from '@angular/common';
import { prefersReducedMotion, svUniqueId } from '@styloviz/core/a11y';
import { svIsSwipePointer, svSwipeDismisses, svSwipeGesture } from '@styloviz/core/gestures';
import { injectSvLabels } from '@styloviz/core/i18n';
import {
  SV_SHEET_SAFE_AREA_PADDING,
  SvOverlayRouteService,
  SvOverlayStackService,
  createFocusScope,
  createPortalHost,
  svLockBodyScroll,
  svUnlockBodyScroll,
  type SvOverlayHandle,
  type SvPortalHost,
  type SvRouteAwareHandle,
} from '@styloviz/core/overlay';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_OVERLAYS_LABELS, type SvOverlaysLabels } from '@styloviz/overlays/labels';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One choice in the sheet. */
export interface SvActionSheetAction {
  /** Stable identity — what `actionSelect` hands back. */
  readonly id: string;
  /** The visible text, and the menu item's accessible name. */
  readonly label: string;
  /** A second line under the label. */
  readonly description?: string;
  /** Icon-library name (the app registers it), drawn before the label. */
  readonly icon?: string;
  /** Deletes, discards or otherwise cannot be undone: drawn in the danger tone and announced as destructive. */
  readonly destructive?: boolean;
  /** Shown but not choosable. Stays focusable, as the menu pattern asks, and is announced as unavailable. */
  readonly disabled?: boolean;
}

/** Why the sheet closed. */
export type SvActionSheetCloseReason = 'action' | 'cancel' | 'backdrop' | 'escape' | 'swipe' | 'programmatic';

/** What `actionSelect` emits. */
export interface SvActionSheetSelection {
  readonly action: SvActionSheetAction;
  /** Its position in `actions`. */
  readonly index: number;
}

/** The exit slide, in ms — the same 200 ms the panel takes to come up. */
const EXIT_MS = 200;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Action Sheet — the phone's "what do you want to do with this?" panel.
 *
 * ★★★ THE DRAWER'S BOTTOM SHEET, WITH A MENU IN IT. A drawer anchored to the
 *     bottom edge is the surface: portalled to `<body>`, modal (the page behind
 *     is made inert by the overlay stack), the body's scroll locked, padded
 *     clear of the home indicator, and closed by a swipe down through the same
 *     `svSwipeGesture` / `svSwipeDismisses` pair the drawer and the sidebar use.
 *     `sv-drawer` itself is a Pro component and a free package may not import
 *     one, so this is built on the drawer's own core primitives rather than on
 *     the component.
 *
 * ★★ A MENU, NOT A LIST OF BUTTONS. The choices are a WAI-ARIA `menu` of
 *    `menuitem`s with one tab stop: ↑/↓ move (and wrap), Home/End jump, a
 *    letter jumps to the next item starting with it, Enter or Space chooses.
 *    Focus lands on the first choice when the sheet opens. Cancel is a separate
 *    button below the menu, as on every phone, and Tab moves between the two —
 *    focus never leaves the sheet while it is open.
 *
 * ★ Every way out returns focus to whatever opened it — a choice, Cancel,
 *   Escape, a tap on the scrim, a swipe — through `createFocusScope`, which
 *   copes with an opener that the choice itself removed (Delete on a row).
 *
 * Features:
 * - Title and message, icons, a second line per choice
 * - Destructive choices in the danger tone (announced, not only coloured)
 * - Disabled choices that stay discoverable
 * - Cancel, Escape, scrim tap and swipe-down to dismiss — each can be turned off
 * - Slides up and down; under reduced motion it appears and goes without moving
 *
 * @example
 * ```html
 * <sv-action-sheet [(open)]="sheetOpen" title="Invoice INV-2041"
 *   [actions]="actions" (actionSelect)="run($event.action.id)" />
 * ```
 */
@Component({
  selector: 'sv-action-sheet',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './action-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvActionSheetComponent implements OnDestroy {
  private readonly registryLabels = injectSvLabels('overlays', SV_OVERLAYS_LABELS);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly appRef = inject(ApplicationRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stack = inject(SvOverlayStackService);
  private readonly overlayRoute = inject(SvOverlayRouteService);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Whether the sheet is up. Two-way: `[(open)]`. @default false */
  readonly open = model<boolean>(false);

  // ── Content ───────────────────────────────────────────────────────────────

  /** The heading — usually the thing the actions apply to ("Invoice INV-2041"). @default '' */
  readonly title = input<string>('');

  /** A line under the heading, read as the sheet's description. @default '' */
  readonly description = input<string>('');

  /** The choices, top to bottom. @default [] */
  readonly actions = input<readonly SvActionSheetAction[]>([]);

  /** The dismiss button's text. @default 'Cancel' (the `actionSheetCancel` label) */
  readonly cancelLabel = input<string>('');

  /** Show the separate Cancel button under the menu. @default true */
  readonly showCancel = input<boolean>(true);

  /** The sheet's accessible name when it has no `title`. @default 'Actions' (the `actionSheetName` label) */
  readonly ariaLabel = input<string>('');

  // ── Dismissal ─────────────────────────────────────────────────────────────

  /** A tap on the dimmed page closes it. @default true */
  readonly closeOnBackdrop = input<boolean>(true);

  /** Escape closes it. @default true */
  readonly closeOnEscape = input<boolean>(true);

  /** A swipe down on the sheet's handle or heading closes it (touch and pen). @default true */
  readonly swipeToClose = input<boolean>(true);

  /** A navigation closes it, once the app provides `provideSvOverlayRouteClose()`. @default true */
  readonly closeOnNavigation = input<boolean>(true);

  /** Per-instance overrides for the package labels. @default {} */
  readonly labels = input<Partial<SvOverlaysLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** A choice was made. The sheet closes with reason `'action'` right after. */
  readonly actionSelect = output<SvActionSheetSelection>();

  /** The sheet came up. */
  readonly opened = output<void>();

  /** The sheet went away, and why. */
  readonly closed = output<SvActionSheetCloseReason>();

  // ── Derived state ─────────────────────────────────────────────────────────

  protected readonly text = computed<SvOverlaysLabels>(() => ({ ...this.registryLabels, ...this.labels() }));
  protected readonly cancelText = computed(() => this.cancelLabel() || this.text().actionSheetCancel);

  private readonly uid = svUniqueId('sv-action-sheet');
  protected readonly titleId = `${this.uid}-title`; // sv-i18n-ignore: DOM id
  protected readonly descriptionId = `${this.uid}-desc`; // sv-i18n-ignore: DOM id

  /** The roving tab stop inside the menu. */
  protected readonly activeIndex = signal(0);

  /** False while mounted but not yet slid up — and again on the way out. */
  protected readonly shown = signal(false);

  /** True between a close and the portal's removal: the panel is inert, the slide plays. */
  protected readonly closing = signal(false);

  /** Pixels the sheet has been dragged down by a finger. */
  protected readonly dragY = signal(0);
  protected readonly dragging = signal(false);

  protected readonly z = signal(10000);

  /** Padding that keeps Cancel clear of the home indicator. */
  protected readonly safeArea = SV_SHEET_SAFE_AREA_PADDING;

  protected readonly panelTransform = computed<string | null>(() => {
    if (!this.shown()) return 'translateY(100%)';
    const y = this.dragY();
    return y > 0 ? `translateY(${y}px)` : null;
  });

  // ── Portal ────────────────────────────────────────────────────────────────

  private readonly sheetTpl = viewChild<TemplateRef<unknown>>('sheetTpl');
  private readonly injector = inject(Injector);
  private portal: SvPortalHost | null = null;
  private view: EmbeddedViewRef<unknown> | null = null;
  private handle: SvOverlayHandle | null = null;
  private routeHandle: SvRouteAwareHandle | null = null;
  private locked = false;
  private wasOpen = false;
  private reason: SvActionSheetCloseReason = 'programmatic';
  private belowAtClose: Element | null = null;
  private stopSwipe: (() => void) | null = null;
  private exitTimer: ReturnType<typeof setTimeout> | undefined;
  private frame = 0;
  private typeahead = '';
  private typeaheadAt = 0;
  /** Did the press that ended in this click start on the scrim? */
  private pressOnScrim = false;

  private readonly focusScope = createFocusScope({
    within: () => this.portal?.element ?? null,
    below: () => this.belowAtClose,
  });

  constructor() {
    // However `open` changed — `[(open)]`, `show()`, `close()` — this is where it takes effect.
    effect(() => {
      const open = this.open();
      untracked(() => this.sync(open));
    });
  }

  /**
   * Bring the DOM in line with `open`. Idempotent, so `close()` can call it at
   * once — the choice, the Escape and the scrim tap close the sheet in the same
   * task, without waiting for the next change detection — and the effect can
   * call it again for nothing.
   */
  private sync(open: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.wasOpen = open;
      return;
    }
    if (open && !this.wasOpen) {
      // ★ Opened before the first render (`[open]="true"` on creation): the
      //   template the sheet is stamped from does not exist yet.
      if (!this.sheetTpl()) {
        afterNextRender(() => this.sync(this.open()), { injector: this.injector });
        return;
      }
      this.wasOpen = true;
      this.mount();
    } else if (!open && this.wasOpen) {
      this.wasOpen = false;
      this.unmount();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.exitTimer);
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.stopSwipe?.();
    if (this.open() && isPlatformBrowser(this.platformId)) {
      this.belowAtClose = this.handle?.surfaceBelow() ?? null;
      queueMicrotask(() => {
        this.focusScope.restore();
        this.belowAtClose = null;
      });
    }
    this.release();
    this.destroyPortal();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Bring the sheet up. */
  show(): void {
    this.open.set(true);
    this.sync(true);
  }

  /** Close the sheet, reporting `reason` through `closed`. */
  close(reason: SvActionSheetCloseReason = 'programmatic'): void {
    if (!this.open()) return;
    this.reason = reason;
    this.open.set(false);
    this.sync(false);
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  protected choose(action: SvActionSheetAction, index: number): void {
    this.activeIndex.set(index);
    if (action.disabled || this.closing()) return;
    this.actionSelect.emit({ action, index });
    this.close('action');
  }

  protected onRootPointerDown(event: PointerEvent): void {
    this.pressOnScrim = event.target === event.currentTarget;
  }

  protected onRootClick(event: MouseEvent): void {
    const onScrim = this.pressOnScrim && event.target === event.currentTarget;
    this.pressOnScrim = false;
    if (!onScrim || !this.closeOnBackdrop()) return;
    if (this.handle && !this.handle.isTopmost()) return;
    this.close('backdrop');
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (!this.closeOnEscape() || (this.handle && !this.handle.isTopmost())) return;
      event.preventDefault();
      event.stopPropagation();
      this.close('escape');
      return;
    }
    if (event.key === 'Tab') this.trapTab(event);
  }

  /** The menu keyboard model: arrows, Home/End and type-to-jump over one tab stop. */
  protected onMenuKeydown(event: KeyboardEvent): void {
    const count = this.actions().length;
    if (!count) return;
    const current = this.activeIndex();
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowDown':
        next = (current + 1) % count;
        break;
      case 'ArrowUp':
        next = (current - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
          next = this.typeaheadMatch(event.key, current);
        }
    }
    if (next === null) return;
    event.preventDefault();
    this.focusItem(next);
  }

  /** Start a swipe-to-close from the handle or the heading. */
  protected onHandlePointerDown(event: PointerEvent): void {
    if (!this.swipeToClose() || !svIsSwipePointer(event) || this.closing()) return;
    const panel = this.panelEl();
    const height = panel?.getBoundingClientRect().height ?? 0;
    this.stopSwipe?.();
    this.stopSwipe = svSwipeGesture(event, {
      toward: 'down',
      onMove: (travel) => {
        this.dragging.set(true);
        this.dragY.set(Math.max(0, travel));
      },
      onEnd: (sample) => {
        this.stopSwipe = null;
        this.dragging.set(false);
        if (svSwipeDismisses(sample, height)) {
          this.close('swipe');
        } else {
          this.dragY.set(0);
        }
      },
    });
  }

  // ── Mount / unmount ───────────────────────────────────────────────────────

  private mount(): void {
    clearTimeout(this.exitTimer);
    // A reopen during the exit slide reuses the panel that is still there.
    if (this.view) {
      this.closing.set(false);
      this.shown.set(true);
      this.dragY.set(0);
    }
    this.handle = this.stack.push('sheet', { blocking: true, element: () => this.portal?.element ?? null });
    this.z.set(this.handle.zIndex);
    this.routeHandle = this.overlayRoute.register({
      label: 'action-sheet',
      close: () => this.close('programmatic'),
      closeOnNavigation: () => this.closeOnNavigation(),
    });
    this.focusScope.capture();
    if (!this.locked) {
      svLockBodyScroll(this.document);
      this.locked = true;
    }
    this.reason = 'programmatic';
    this.activeIndex.set(this.firstEnabled());
    this.dragY.set(0);

    if (!this.view) {
      this.shown.set(false);
      this.closing.set(false);
      this.portal = createPortalHost({
        origin: this.host.nativeElement,
        document: this.document,
        label: 'action-sheet',
        destroyRef: this.destroyRef,
      });
      this.view = this.sheetTpl()!.createEmbeddedView({});
      this.appRef.attachView(this.view);
      // Render before the nodes reach the document (scripts/fix-portal-insertion-order.mjs).
      this.view.detectChanges();
      for (const node of this.view.rootNodes as Node[]) this.portal.element.appendChild(node);
      this.portal.attach();
      // One frame at the off-screen position, so the slide up has somewhere to start from.
      const slideIn = (): void => {
        if (!this.open()) return;
        this.shown.set(true);
        this.focusItem(this.activeIndex());
      };
      if (typeof requestAnimationFrame === 'function') this.frame = requestAnimationFrame(slideIn);
      else queueMicrotask(slideIn);
    } else {
      this.focusItem(this.activeIndex());
    }
    this.opened.emit();
  }

  private unmount(): void {
    this.stopSwipe?.();
    this.stopSwipe = null;
    this.dragging.set(false);
    this.belowAtClose = this.handle?.surfaceBelow() ?? null;
    this.release();
    this.closing.set(true);
    this.shown.set(false);
    this.focusScope.restore();
    this.belowAtClose = null;
    this.closed.emit(this.reason);
    this.reason = 'programmatic';
    // ★ Reduced motion: no slide to wait for, so nothing lingers on screen.
    const delay = prefersReducedMotion() ? 0 : EXIT_MS;
    clearTimeout(this.exitTimer);
    this.exitTimer = setTimeout(() => {
      if (!this.open()) this.destroyPortal();
    }, delay);
  }

  private release(): void {
    this.routeHandle?.release();
    this.routeHandle = null;
    this.handle?.release();
    this.handle = null;
    if (this.locked) {
      svUnlockBodyScroll(this.document);
      this.locked = false;
    }
  }

  private destroyPortal(): void {
    if (this.view) {
      this.appRef.detachView(this.view);
      this.view.destroy();
      this.view = null;
    }
    this.portal?.destroy();
    this.portal = null;
    this.closing.set(false);
    this.shown.set(false);
    this.dragY.set(0);
  }

  // ── Focus ─────────────────────────────────────────────────────────────────

  private panelEl(): HTMLElement | null {
    return this.portal?.element.querySelector<HTMLElement>('[role="dialog"]') ?? null;
  }

  private items(): HTMLElement[] {
    return Array.from(this.portal?.element.querySelectorAll<HTMLElement>('[data-sv-action-sheet-item]') ?? []);
  }

  private focusItem(index: number): void {
    this.activeIndex.set(index);
    this.view?.detectChanges();
    const target = this.items()[index] ?? this.portal?.element.querySelector<HTMLElement>('[data-sv-action-sheet-cancel]');
    (target ?? this.panelEl())?.focus();
  }

  private firstEnabled(): number {
    const i = this.actions().findIndex((a) => !a.disabled);
    return i === -1 ? 0 : i;
  }

  private typeaheadMatch(key: string, from: number): number | null {
    const now = Date.now();
    this.typeahead = now - this.typeaheadAt > 700 ? key.toLowerCase() : this.typeahead + key.toLowerCase();
    this.typeaheadAt = now;
    const list = this.actions();
    for (let step = 1; step <= list.length; step++) {
      const i = (from + step) % list.length;
      if (list[i].label.toLowerCase().startsWith(this.typeahead)) return i;
    }
    return null;
  }

  /** Tab cycles between the menu's tab stop and Cancel — focus never leaves an open sheet. */
  private trapTab(event: KeyboardEvent): void {
    const panel = this.panelEl();
    if (!panel) return;
    const stops = Array.from(panel.querySelectorAll<HTMLElement>('[tabindex="0"], [data-sv-action-sheet-cancel]'));
    if (!stops.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
