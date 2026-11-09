declare const ngDevMode: boolean | undefined;

import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, input, isDevMode } from '@angular/core';
import { SvIconSvgComponent } from './icon-svg.component';
import { SvIconRegistry } from './provide-icons';
import type { IconFlip, IconNode, IconSize, IconWeight } from './icon.types';
import type { IconName } from '../generated/registry';
import { svIconWarn } from './warn-once';

/**
 * SvIconComponent — resolve any icon by name.
 *
 * ```html
 * <sv-icon name="arrow-right" />
 * <sv-icon name="check-circle" size="lg" cssClass="text-emerald-500" />
 * ```
 *
 * Names resolve against the glyphs registered in the app — by the kit's own
 * components, by `provideSvIcons([...])`, or all of them with
 * `provideSvIcons(svAllIcons)`. Nothing is bundled by name (FL-B4); an
 * unregistered name renders nothing and warns once in development.
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
  private readonly registry = inject(SvIconRegistry);

  /** Icon name. Built-in names are type-checked; registered custom names are also accepted. */
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

  /** Resolved primitives from the registry; `null` if the name is not registered. */
  protected readonly nodes = computed<readonly IconNode[] | null>(() => this.registry.nodes(this.name()));

  /** Filled silhouette for the `solid` weight, from the same registration. */
  protected readonly solidNodes = computed<readonly IconNode[] | null>(() => this.registry.solid(this.name()));

  constructor() {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      // After the first render, so a glyph a sibling registers in the same pass is not a false alarm.
      afterNextRender(() => svWarnUnregisteredIcon(this.name(), this.nodes(), 'sv-icon'));
    }
  }
}

const warned = new Set<string>();

/** One development warning per unregistered name. @internal */
export function svWarnUnregisteredIcon(name: string, nodes: readonly IconNode[] | null, selector: string): void {
  // A development aid, like Angular's own warnings: a production console is the
  // buyer's users', not the buyer's (FL-L1).
  if (nodes || !isDevMode() || warned.has(`${selector}:${name}`)) return;
  warned.add(`${selector}:${name}`);
  svIconWarn(
    `[styloviz] <${selector} name="${name}"> is not registered, so it renders nothing. ` +
      `Register the glyph — provideSvIcons([${name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())}Icon]) — ` +
      `or opt into the whole set with provideSvIcons(svAllIcons).`,
  );
}
