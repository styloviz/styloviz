import { DestroyRef, effect, inject, signal, untracked, type Signal } from '@angular/core';
import { SvOverlayStackService, type SvOverlayHandle, type SvOverlayLayer } from './overlay-stack';

export interface SvStackedPopupOptions {
  /** Whether the popup is open. Read inside an effect, so pass a signal read. */
  readonly open: () => boolean;
  /**
   * The popup's rendered panel, for outside-click routing and inertness.
   * A getter, because a portalled panel usually does not exist yet when the
   * popup opens — see `SvOverlayPushOptions.element`.
   */
  readonly element?: () => Element | null | undefined;
  /** @default 'anchored' */
  readonly layer?: SvOverlayLayer;
}

export interface SvStackedPopup {
  /**
   * Does this popup own Escape right now?
   *
   * `true` when it is the topmost dismissible surface — and ALSO when it is
   * not registered at all (closed, or SSR), so a handler can gate on it
   * unconditionally: `if (!popup.ownsEscape()) return;`.
   */
  ownsEscape(): boolean;
  /**
   * Did this pointer event land inside a surface opened ABOVE this popup (a
   * dialog opened from one of its options, a nested menu)? Such a click is
   * not "outside", and must not close the popup.
   */
  isInsideHigherSurface(target: EventTarget | null): boolean;
  /** z-index from the stack while open, `null` while closed. */
  readonly zIndex: Signal<number | null>;
}

/**
 * Put a small popup (a picker, a suggestion list, a select panel) on the
 * overlay stack for exactly as long as it is open (`X-4`, `OF-09-I1`).
 *
 * ★★★ THE DEFECT THIS CLOSES. The form popups each closed on their own
 *     `document:keydown.escape` and `document:mousedown`, and none of them was
 *     on the stack. So the stack's answer to "who owns Escape?" skipped them:
 *     a time picker opened inside a modal left the MODAL topmost, the modal's
 *     own keydown (which runs before any document listener) closed the modal,
 *     and one Escape took the picker and the half-filled dialog with it. The
 *     popup was open and the stack did not know.
 *
 * ★★ WHY A HELPER AND NOT FOUR LINES IN EACH COMPONENT. Register on open,
 *    release on close, release on destroy while open — every popup needs the
 *    same three, and the destroy case is the one a hand-written copy forgets
 *    (a picker removed by an `@if` while open would hold Escape forever).
 *
 * Call in an injection context (a field initializer or the constructor).
 */
export function svStackedPopup(options: SvStackedPopupOptions): SvStackedPopup {
  const stack = inject(SvOverlayStackService);
  const zIndex = signal<number | null>(null);
  let handle: SvOverlayHandle | null = null;

  const release = (): void => {
    handle?.release();
    handle = null;
    zIndex.set(null);
  };

  effect(() => {
    const open = options.open();
    untracked(() => {
      if (typeof document === 'undefined') return;
      if (open && !handle) {
        handle = stack.push(options.layer ?? 'anchored', { element: options.element });
        zIndex.set(handle.zIndex);
      } else if (!open && handle) {
        release();
      }
    });
  });

  inject(DestroyRef).onDestroy(release);

  return {
    ownsEscape: () => !handle || handle.isTopmost(),
    isInsideHigherSurface: (target) =>
      !!handle && target instanceof Node && handle.isInsideHigherSurface(target),
    zIndex: zIndex.asReadonly(),
  };
}
