import { Directive, input } from '@angular/core';
import type { IconFlip, IconNode, IconSize, IconWeight } from './icon.types';

/**
 * SvIconBase — shared input surface for every per-icon component.
 *
 * The generated icon components extend this and only override `nodes`, so the
 * public API (size, weight, title, flip, rotate…) is declared once and stays
 * identical across all icons. Abstract, no selector — never used directly.
 */
@Directive()
export abstract class SvIconBase {
  /** The glyph's primitives — provided by each concrete icon component. */
  abstract readonly nodes: readonly IconNode[];

  /**
   * Filled silhouette for the `solid` weight. Overridden by every generated
   * icon component that ships one (all built-in glyphs except brand marks,
   * which are already filled shapes).
   */
  readonly solidNodes: readonly IconNode[] | null = null;

  /** Rendered size in px, or a named token (`sm`/`md`/`lg`). @default 'md' */
  readonly size = input<IconSize>('md');
  /** Stroke width in viewBox units (line weight only). @default 1.75 */
  readonly strokeWidth = input<number>(1.75);
  /** Visual weight. @default 'line' */
  readonly weight = input<IconWeight>('line');
  /** Accessible label. When set the icon is exposed as `role="img"`; otherwise it is `aria-hidden`. @default null */
  readonly title = input<string | null>(null);
  /** Mirror the icon horizontally or vertically. @default null */
  readonly flip = input<IconFlip>(null);
  /** Rotate the icon clockwise, in degrees, around its centre. @default 0 */
  readonly rotate = input<number>(0);
  /** Extra CSS classes applied to the root `<svg>` (e.g. Tailwind `text-*`). @default '' */
  readonly cssClass = input<string>('');
}
