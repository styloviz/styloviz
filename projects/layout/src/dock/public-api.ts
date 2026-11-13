// The @styloviz/layout/dock entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvDockComponent } from './dock.component';
export type {
  SvDockItem,
  SvDockPosition,
  SvDockSize,
  SvDockPlacement,
  SvDockSelection,
  SvDockSelectSource,
} from './dock.component';
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
} from './dock.logic';
export type { SvDockLayout, SvDockLayoutOptions, SvDockFit, SvDockFitOptions } from './dock.logic';
