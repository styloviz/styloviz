/**
 * @styloviz/layout — Public API
 *
 * The app-shell family plus the layout utilities that sit inside it. Two
 * footers ship deliberately: `SvFooterComponent` is the thin in-shell bar for a
 * dashboard, `SvSiteFooterComponent` is the full multi-column marketing footer.
 */

// ─── App shell ────────────────────────────────────────────────────────────────
export { SvSidebarComponent } from '@styloviz/layout/sidebar';
export { SvTopbarComponent } from '@styloviz/layout/topbar';
export { SvFooterComponent } from '@styloviz/layout/footer';
export {
  SvPageHeaderComponent,
  SvPageHeaderBreadcrumbDirective,
  SvPageHeaderBackDirective,
  SvPageHeaderMetaDirective,
  SvPageHeaderTabsDirective,
} from '@styloviz/layout/page-header';
export type { PageHeaderAction } from '@styloviz/layout/page-header';
export { SvDashboardShellComponent } from '@styloviz/layout/dashboard-shell';
export { SV_SHELL_CONTEXT, type SvShellContext } from '@styloviz/layout/sidebar';
// ─── Overlay ↔ router integration (X-13) ──────────────────────────────────────
export {
  provideSvOverlayRouteClose,
  svOverlayCanDeactivate,
  type SvOverlayRouteCloseOptions,
} from '@styloviz/layout/overlay-routing';

// ─── Site footer (marketing) ──────────────────────────────────────────────────
export { SvSiteFooterComponent } from '@styloviz/layout/site-footer';
export type {
  FooterLink,
  FooterColumn,
  FooterSocial,
  FooterLegalLink,
  FooterPayment,
  SiteFooterVariant,
  SiteFooterNewsletterStatus,
  SiteFooterLinkTarget,
  SiteFooterResolvedLink,
} from '@styloviz/layout/site-footer';
export { SvDividerComponent } from '@styloviz/layout/divider';
export type {
  DividerOrientation,
  DividerVariant,
  DividerAlign,
  DividerSemantics,
} from '@styloviz/layout/divider';
export { SvExpandComponent } from '@styloviz/layout/expand';
export { SvToolbarComponent } from '@styloviz/layout/toolbar';
export type {
  ToolbarSize,
  ToolbarVariant,
  ToolbarAction,
  ToolbarGroup,
  ToolbarOverflowMode,
} from '@styloviz/layout/toolbar';
// ─── Dock (app launcher) ──────────────────────────────────────────────────────
export { SvDockComponent } from '@styloviz/layout/dock';
export type {
  SvDockItem,
  SvDockPosition,
  SvDockSize,
  SvDockPlacement,
  SvDockSelection,
  SvDockSelectSource,
} from '@styloviz/layout/dock';
export {
  svDockLayout,
  svDockScale,
  svDockClampPeak,
  svDockPointerIndex,
  svDockRouteMatches,
  svDockCurrentIndex,
  svDockFit,
  SV_DOCK_MAX_PEAK,
  SV_DOCK_MIN_ITEM,
} from '@styloviz/layout/dock';
export type { SvDockLayout, SvDockLayoutOptions, SvDockFit, SvDockFitOptions } from '@styloviz/layout/dock';
// ─── Utilities ────────────────────────────────────────────────────────────────
export { SvCopyToClipboardComponent, SV_COPY_TIMEOUT_MS } from '@styloviz/layout/copy-to-clipboard';
export type { CopyVariant, CopySize, CopySensitiveReveal } from '@styloviz/layout/copy-to-clipboard';
export { SV_CLIPBOARD, SvClipboardError, svBrowserClipboard } from '@styloviz/layout/copy-to-clipboard';
export type { SvClipboardAdapter, SvClipboardFailureReason } from '@styloviz/layout/copy-to-clipboard';
export { SvScrollToTopComponent } from '@styloviz/layout/scroll-to-top';
export type {
  ScrollToTopVariant,
  ScrollToTopAppearance,
  ScrollToTopPosition,
} from '@styloviz/layout/scroll-to-top';
export { SvPullToRefreshComponent } from '@styloviz/layout/pull-to-refresh';
export type { SvPullToRefreshButton } from '@styloviz/layout/pull-to-refresh';
export { SvPullToRefreshDirective } from '@styloviz/layout/pull-to-refresh';
export type { SvPullState } from '@styloviz/layout/pull-to-refresh';
export { SV_LAYOUT_LABELS } from '@styloviz/layout/labels';
export type { SvLayoutLabels } from '@styloviz/layout/labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/layout/labels';
