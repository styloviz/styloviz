/*
 * @styloviz/core/services — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// Services
export { ThemeService } from './theme.service';
export type { Theme } from './theme.service';
export { ToastService } from './toast.service';
export type {
  Toast,
  ToastVariant,
  ToastPosition,
  ToastAction,
  ToastOptions,
  ToastPromiseMessages,
  ToastScope,
} from './toast.service';
