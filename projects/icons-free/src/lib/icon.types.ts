/**
 * @styloviz/icons — core types
 *
 * A Styloviz icon is a small list of SVG primitives ({@link IconNode}) drawn on
 * a 24×24 grid using `currentColor`. Rendering is fully declarative (no
 * `innerHTML`), so icons are safe to use anywhere and inherit the surrounding
 * text color in both light and dark mode.
 */

/** SVG primitive element a glyph may be composed of. */
export type IconNodeTag = 'path' | 'circle' | 'line' | 'polyline' | 'polygon' | 'rect';

/**
 * A single renderable SVG primitive.
 *
 * Only the geometry fields relevant to `tag` are populated. This deliberately
 * flat shape (instead of a discriminated union) lets Angular's strict template
 * checker render the nodes with `@for` / `@switch` without needing per-branch
 * narrowing — unused fields simply bind to `undefined` and are omitted.
 */
export interface IconNode {
  readonly tag: IconNodeTag;
  /** `path` data. */
  readonly d?: string;
  /** `circle` centre-x. */
  readonly cx?: number;
  /** `circle` centre-y. */
  readonly cy?: number;
  /** `circle` radius. */
  readonly r?: number;
  /** `line` start-x. */
  readonly x1?: number;
  /** `line` start-y. */
  readonly y1?: number;
  /** `line` end-x. */
  readonly x2?: number;
  /** `line` end-y. */
  readonly y2?: number;
  /** `polyline` / `polygon` points. */
  readonly points?: string;
  /** `rect` x. */
  readonly x?: number;
  /** `rect` y. */
  readonly y?: number;
  /** `rect` width. */
  readonly width?: number;
  /** `rect` height. */
  readonly height?: number;
  /** `rect` corner radius. */
  readonly rx?: number;
  /** When true this node is filled with `currentColor` instead of stroked. */
  readonly fill?: boolean;
  /** SVG fill-rule — `evenodd` enables interior knockouts in solid silhouettes. */
  readonly fillRule?: 'evenodd' | 'nonzero';
}

/**
 * Visual weight. `line` strokes the glyph; `solid` draws its dedicated filled
 * silhouette (`ICON_SOLID_REGISTRY`) — interior detail is knocked out of the
 * fill, so an outline glyph stays readable instead of becoming a blob.
 */
export type IconWeight = 'line' | 'solid';

/** Named size tokens mapped to pixels by {@link ICON_SIZE_PX}. */
export type IconSizeToken = 'sm' | 'md' | 'lg';

/** Icon size: an explicit pixel number, or a named token. */
export type IconSize = number | IconSizeToken;

/** Mirror/flip axis for an icon. */
export type IconFlip = 'horizontal' | 'vertical' | null;

/** Pixel value for each named size token. */
export const ICON_SIZE_PX: Readonly<Record<IconSizeToken, number>> = {
  sm: 16,
  md: 20,
  lg: 24,
};
