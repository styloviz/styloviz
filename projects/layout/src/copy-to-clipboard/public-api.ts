// The @styloviz/layout/copy-to-clipboard entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvCopyToClipboardComponent, SV_COPY_TIMEOUT_MS } from './copy-to-clipboard.component';
export type { CopyVariant, CopySize, CopySensitiveReveal } from './copy-to-clipboard.component';
export { SV_CLIPBOARD, SvClipboardError, svBrowserClipboard } from './clipboard.adapter';
export type { SvClipboardAdapter, SvClipboardFailureReason } from './clipboard.adapter';
