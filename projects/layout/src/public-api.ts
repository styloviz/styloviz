/**
 * @styloviz/layout — Public API
 *
 * The app-shell family plus the layout utilities that sit inside it. Two
 * footers ship deliberately: `SvFooterComponent` is the thin in-shell bar for a
 * dashboard, `SvSiteFooterComponent` is the full multi-column marketing footer.
 */

// ─── App shell ────────────────────────────────────────────────────────────────
export { SvSidebarComponent } from './sidebar/sidebar.component';
export { SvTopbarComponent } from './topbar/topbar.component';
export { SvFooterComponent } from './footer/footer.component';
export {
  SvPageHeaderComponent,
  SvPageHeaderBreadcrumbDirective,
  SvPageHeaderBackDirective,
  SvPageHeaderMetaDirective,
  SvPageHeaderTabsDirective,
} from './page-header/page-header.component';
export type { PageHeaderAction } from './page-header/page-header.component';
export { SvDashboardShellComponent } from './dashboard-shell/dashboard-shell.component';
export { SV_SHELL_CONTEXT, type SvShellContext } from './dashboard-shell/shell-context';
// ─── Overlay ↔ router integration (X-13) ──────────────────────────────────────
export {
  provideSvOverlayRouteClose,
  svOverlayCanDeactivate,
  type SvOverlayRouteCloseOptions,
} from './overlay-routing/overlay-routing';

// ─── Site footer (marketing) ──────────────────────────────────────────────────
export { SvSiteFooterComponent } from './site-footer/site-footer.component';
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
} from './site-footer/site-footer.component';
export { SvDividerComponent } from './divider/divider.component';
export type {
  DividerOrientation,
  DividerVariant,
  DividerAlign,
  DividerSemantics,
} from './divider/divider.component';
export { SvExpandComponent } from './expand/expand.component';
export { SvToolbarComponent } from './toolbar/toolbar.component';
export type {
  ToolbarSize,
  ToolbarVariant,
  ToolbarAction,
  ToolbarGroup,
  ToolbarOverflowMode,
} from './toolbar/toolbar.component';
// ─── Dock (app launcher) ──────────────────────────────────────────────────────
export { SvDockComponent } from './dock/dock.component';
export type {
  SvDockItem,
  SvDockPosition,
  SvDockSize,
  SvDockPlacement,
  SvDockSelection,
  SvDockSelectSource,
} from './dock/dock.component';
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
} from './dock/dock.logic';
export type { SvDockLayout, SvDockLayoutOptions, SvDockFit, SvDockFitOptions } from './dock/dock.logic';
// ─── Utilities ────────────────────────────────────────────────────────────────
export { SvCopyToClipboardComponent, SV_COPY_TIMEOUT_MS } from './copy-to-clipboard/copy-to-clipboard.component';
export type { CopyVariant, CopySize, CopySensitiveReveal } from './copy-to-clipboard/copy-to-clipboard.component';
export { SV_CLIPBOARD, SvClipboardError, svBrowserClipboard } from './copy-to-clipboard/clipboard.adapter';
export type { SvClipboardAdapter, SvClipboardFailureReason } from './copy-to-clipboard/clipboard.adapter';
export { SvScrollToTopComponent } from './scroll-to-top/scroll-to-top.component';
export type {
  ScrollToTopVariant,
  ScrollToTopAppearance,
  ScrollToTopPosition,
} from './scroll-to-top/scroll-to-top.component';
export { SvPullToRefreshComponent } from './pull-to-refresh/pull-to-refresh.component';
export type { SvPullToRefreshButton } from './pull-to-refresh/pull-to-refresh.component';
export { SvPullToRefreshDirective } from './pull-to-refresh/pull-to-refresh.directive';
export type { SvPullState } from './pull-to-refresh/pull-to-refresh.directive';
export { SV_LAYOUT_LABELS } from './layout.labels';
export type { SvLayoutLabels } from './layout.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './layout.labels.packs';
