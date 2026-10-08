import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SvIconSvgComponent } from './icon-svg.component';
import { SV_ICON_REGISTRY } from './provide-icons';
import type { IconFlip, IconNode, IconSize, IconWeight } from './icon.types';
import { ICON_REGISTRY, ICON_SOLID_REGISTRY, type IconName } from '../generated/registry';

/**
 * SvIconComponent — resolve any icon by name.
 *
 * ```html
 * <sv-icon name="arrow-right" />
 * <sv-icon name="check-circle" size="lg" cssClass="text-emerald-500" />
 * ```
 *
 * Convenience over bytes: importing this component makes the whole built-in set
 * available by name. For bundle-critical apps, import individual icon components
 * (e.g. `SvArrowRightIcon`) instead — they tree-shake to just the glyphs used.
 * Custom names can be added with {@link provideSvIcons}.
 */
@Component({
  selector: 'sv-icon',
  standalone: true,
  imports: [SvIconSvgComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (nodes(); as resolved) {
      <sv-icon-svg
        [nodes]="resolved"
        [solidNodes]="solidNodes()"
        [size]="size()"
        [strokeWidth]="strokeWidth()"
        [weight]="weight()"
        [title]="title()"
        [flip]="flip()"
        [rotate]="rotate()"
        [cssClass]="cssClass()"
      />
    }
  `,
})
export class SvIconComponent {
  private readonly custom = inject(SV_ICON_REGISTRY, { optional: true });

  /** Icon name. Built-in names are type-checked; custom (provided) names are also accepted. */
  readonly name = input.required<IconName | (string & {})>();
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

  /** Resolved primitives — custom registry first, then built-in; `null` if the name is unknown. */
  protected readonly nodes = computed<readonly IconNode[] | null>(() => {
    const name = this.name();
    return this.custom?.[name] ?? ICON_REGISTRY[name as IconName] ?? null;
  });

  /**
   * Filled silhouette for the `solid` weight. A custom (provided) glyph shadows
   * the built-in one, so it must not borrow the built-in silhouette either.
   */
  protected readonly solidNodes = computed<readonly IconNode[] | null>(() => {
    const name = this.name();
    if (this.custom?.[name]) return null;
    return ICON_SOLID_REGISTRY[name] ?? null;
  });
}
