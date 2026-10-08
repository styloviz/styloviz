export {
  SvModalComponent,
  ModalSize,
  ModalPosition,
  ModalVariant,
  ModalCloseReason,
} from './lib/modal.component';

// ─── Imperative API ───────────────────────────────────────────────────────────
export { SvModalService, SvModalRef, SV_MODAL_DATA } from './lib/modal.service';
export type {
  SvModalConfig,
  SvModalResult,
  SvModalDismissReason,
} from './lib/modal.service';

// ─── Resize geometry ──────────────────────────────────────────────────────────
// Exported so a host that positions its own panel gets the same clamping rather
// than re-deriving it — see modal-resize.ts on why an unclamped drag traps the
// user behind a dialog they can no longer reach the close button on.
export {
  svClampModalSize,
  svResizeModal,
  svMaximizedSize,
  svRestoredSize,
} from './lib/modal-resize';
export type { SvModalSizePx, SvModalResizeBounds } from './lib/modal-resize';

// ─── Body scroll lock ─────────────────────────────────────────────────────────
export {
  svLockBodyScroll,
  svUnlockBodyScroll,
  svBodyScrollLockDepth,
  svResetBodyScrollLock,
} from '@styloviz/core';
