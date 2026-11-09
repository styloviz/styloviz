/*
 * @styloviz/core/layout — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
export { svElementSize, SV_SIZE_ZERO } from './element-size';
export type { SvSize, SvElementSizeOptions } from './element-size';
// `X-5` / `N-7` — one owner for the screen's corners: occupied-region
// registration (kit controls AND the host's chat widget / cookie banner / bottom
// nav), shared offsets, safe-area tokens and the floating z-bands.
export {
  SvFloatingLayerService,
  svFloatingRegion,
  svFloatingInset,
  SV_FLOATING_ORDER,
  SV_FLOATING_Z,
  SV_SAFE_AREA,
} from './floating-layer';
export type {
  SvFloatingAnchor,
  SvFloatingRegion,
  SvFloatingRegionState,
  SvFloatingRegionHandle,
  SvFloatingRegionOptions,
  SvFloatingRegionRef,
  SvSafeAreaSide,
} from './floating-layer';
