import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_SIZE_PX, type IconFlip, type IconNode, type IconSize, type IconWeight } from './icon.types';

/**
 * SvIconSvgComponent — internal presentational renderer.
 *
 * Draws a list of {@link IconNode}s as a safe, declarative `<svg>` (no
 * `innerHTML`, no `bypassSecurityTrust*`). Both the registry component
 * (`<sv-icon>`) and every tree-shakable per-icon component delegate to this, so
 * the rendering logic lives in exactly one place.
 *
 * `solid` draws the glyph's filled silhouette (`solidNodes`) when one is given;
 * `line` always draws `nodes`.
 *
 * Exported for advanced use (rendering ad-hoc `IconNode[]`), but most consumers
 * should use `SvIconComponent` or an individual icon component instead.
 */
@Component({
  selector: 'sv-icon-svg',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="px()"
      [attr.height]="px()"
      viewBox="0 0 24 24"
      [attr.fill]="rootFill()"
      [attr.stroke]="rootStroke()"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [class]="cssClass()"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-hidden]="decorative() ? 'true' : null"
      [attr.aria-label]="decorative() ? null : title()"
    >
      @if (!decorative()) {
        <svg:title>{{ title() }}</svg:title>
      }
      <svg:g [attr.transform]="transform()">
        @for (n of renderNodes(); track $index) {
          @switch (n.tag) {
            @case ('path') {
              <svg:path [attr.d]="n.d" [attr.fill-rule]="n.fillRule" [attr.fill]="nodeFill(n)" [attr.stroke]="nodeStroke(n)" />
            }
            @case ('circle') {
              <svg:circle
                [attr.cx]="n.cx"
                [attr.cy]="n.cy"
                [attr.r]="n.r"
                [attr.fill]="nodeFill(n)"
                [attr.stroke]="nodeStroke(n)"
              />
            }
            @case ('line') {
              <svg:line
                [attr.x1]="n.x1"
                [attr.y1]="n.y1"
                [attr.x2]="n.x2"
                [attr.y2]="n.y2"
                [attr.fill]="nodeFill(n)"
                [attr.stroke]="nodeStroke(n)"
              />
            }
            @case ('polyline') {
              <svg:polyline [attr.points]="n.points" [attr.fill]="nodeFill(n)" [attr.stroke]="nodeStroke(n)" />
            }
            @case ('polygon') {
              <svg:polygon
                [attr.points]="n.points"
                [attr.fill-rule]="n.fillRule"
                [attr.fill]="nodeFill(n)"
                [attr.stroke]="nodeStroke(n)"
              />
            }
            @case ('rect') {
              <svg:rect
                [attr.x]="n.x"
                [attr.y]="n.y"
                [attr.width]="n.width"
                [attr.height]="n.height"
                [attr.rx]="n.rx"
                [attr.fill]="nodeFill(n)"
                [attr.stroke]="nodeStroke(n)"
              />
            }
          }
        }
      </svg:g>
    </svg>
  `,
})
export class SvIconSvgComponent {
  /** Primitives to draw. */
  readonly nodes = input.required<readonly IconNode[]>();
  /**
   * Filled silhouette drawn by the `solid` weight in place of `nodes`. Every
   * built-in glyph ships one (`ICON_SOLID_REGISTRY`). Without it, `solid`
   * falls back to filling `nodes` — fine for a glyph that is already a filled
   * shape, but an outline's interior detail vanishes under the fill.
   * @default null
   */
  readonly solidNodes = input<readonly IconNode[] | null>(null);
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

  protected readonly px = computed<number>(() => {
    const s = this.size();
    return typeof s === 'number' ? s : ICON_SIZE_PX[s];
  });

  /** Whether the `solid` weight is drawing the dedicated silhouette. */
  private readonly silhouette = computed<boolean>(() => this.weight() === 'solid' && (this.solidNodes()?.length ?? 0) > 0);

  /** The silhouette in `solid` weight when there is one, otherwise the line primitives. */
  protected readonly renderNodes = computed<readonly IconNode[]>(() => {
    const solid = this.solidNodes();
    return this.silhouette() && solid ? solid : this.nodes();
  });

  protected readonly rootFill = computed<string>(() => (this.weight() === 'solid' ? 'currentColor' : 'none'));
  protected readonly rootStroke = computed<string>(() => (this.weight() === 'solid' ? 'none' : 'currentColor'));

  protected readonly decorative = computed<boolean>(() => {
    const t = this.title();
    return t === null || t === '';
  });

  protected readonly transform = computed<string | null>(() => {
    const parts: string[] = [];
    if (this.rotate()) parts.push(`rotate(${this.rotate()} 12 12)`);
    const f = this.flip();
    if (f === 'horizontal') parts.push('translate(24 0) scale(-1 1)');
    else if (f === 'vertical') parts.push('translate(0 24) scale(1 -1)');
    return parts.length ? parts.join(' ') : null;
  });

  /**
   * Geometry that only ever exists as a stroke.
   *
   * A `<line>` has no interior, so there is nothing for a fill to paint; an
   * open `<polyline>` filled by its implied closing edge is a smear, not a
   * glyph — `check` becomes a wedge and `chevron-down` a triangle.
   *
   * ★ This is what `solid` weight used to miss. It swaps the ROOT from
   * `stroke: currentColor` to `stroke: none`, and these primitives inherited
   * that and stopped being drawn at all. **`close`, `menu`, `plus`, `minus`
   * and `loader` are made of nothing else and rendered as an empty box**;
   * thirty-five more silently lost a shaft, a stripe or a set of date rows.
   * Nothing threw, and nothing appeared.
   *
   * A silhouette is filled geometry by definition, so nothing in it is
   * stroke-only.
   */
  private strokeOnly(n: IconNode): boolean {
    if (this.silhouette()) return false;
    return n.tag === 'line' || (n.tag === 'polyline' && !n.fill);
  }

  /** Fill override for a node — filled nodes use `currentColor` in line weight; otherwise inherit the root. */
  protected nodeFill(n: IconNode): string | null {
    if (this.weight() === 'solid' && this.strokeOnly(n)) return 'none';
    return this.weight() === 'line' && n.fill ? 'currentColor' : null;
  }

  /** Stroke override — for a filled node in line weight, and for stroke-only geometry in solid. */
  protected nodeStroke(n: IconNode): string | null {
    if (this.weight() === 'solid' && this.strokeOnly(n)) return 'currentColor';
    return this.weight() === 'line' && n.fill ? 'none' : null;
  }
}
