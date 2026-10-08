import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerVariant     = 'solid' | 'dashed' | 'dotted' | 'gradient' | 'text' | 'icon';
export type DividerAlign       = 'start' | 'center' | 'end';

/**
 * What a divider MEANS, as opposed to what it looks like (`LU-03-M1`).
 *
 * - `semantic` — a real thematic break between two groups of content. Exposed
 *   as `role="separator"` with `aria-orientation`, and named by its label.
 * - `decorative` — a visual flourish only. The line is removed from the
 *   accessibility tree; a label, if any, is still read as plain text in
 *   reading order, but no "separator" is announced.
 */
export type DividerSemantics = 'semantic' | 'decorative';

@Component({
  selector: 'sv-divider',
  imports: [SvIconComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './divider.component.html',
  host: { '[class]': 'hostClass()', '[style]': 'rootStyle()' },
})
export class SvDividerComponent {
  /** Layout direction: horizontal or vertical. @default 'horizontal' */
  orientation = input<DividerOrientation>('horizontal');
  /** Line style: solid, dashed, dotted, gradient, text or icon. @default 'solid' */
  variant     = input<DividerVariant>('solid');
  /** Label/icon alignment: start, center or end. @default 'center' */
  align       = input<DividerAlign>('center');
  /** Optional inline text shown on the divider. */
  label       = input<string>('');
  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'sparkles'`.
   *
   * This used to be a raw `<path d="…">` string, which put SVG geometry in
   * every consumer's config and skipped the library's sizing, stroke and
   * dark-mode handling. Pass a name.
   */
  icon        = input<string>('');
  /** Custom line color (any CSS color). */
  color       = input<string>('');
  /** Line thickness in pixels. @default 1 */
  thickness   = input<number>(1);
  /** Optional explicit width (any CSS length) — e.g. a short horizontal rule. */
  width       = input<string>('');
  /** Optional explicit height (any CSS length) — e.g. a fixed-height vertical rule
   *  that works without a stretched flex parent. */
  height      = input<string>('');
  /**
   * Margin classes around the divider — Tailwind utilities, not a CSS length
   * (e.g. `my-8`, or `mx-2` when vertical). Replaces the default `my-4` /
   * `mx-4`, so `''` keeps the default and `my-0` removes it.
   */
  spacing     = input<string>('');
  /** Extra CSS classes applied to the label. */
  labelClass  = input<string>('');
  /**
   * Whether this divider is a real thematic break (`semantic`) or a visual
   * flourish (`decorative`).
   *
   * ★ The default stays `semantic` because that is what every divider rendered
   *   before this input existed, and changing it would silently change what a
   *   screen reader announces on every page already using the component.
   *
   * ⚠️ A divider — semantic or not — is NOT a heading. A labelled rule that
   *   visually introduces a section ("Billing") gives assistive technology no
   *   heading to navigate by; use a real `<h2>`–`<h6>` for that and, if you want
   *   the line too, a `decorative` divider beside it.
   *
   * - `semantic` → `role="separator"` + `aria-orientation` (+ `aria-label` from `label`).
   * - `decorative` → `role="none"`; with no label the whole divider is also
   *   `aria-hidden`, so nothing at all is announced.
   * @default 'semantic'
   */
  semantics   = input<DividerSemantics>('semantic');

  readonly isDecorative = computed(() => this.semantics() === 'decorative');

  /** `role` on the rule: a separator, or nothing at all when decorative. */
  readonly ariaRole = computed(() => (this.isDecorative() ? 'none' : 'separator'));

  /**
   * `aria-hidden` for a decorative divider with nothing to read. A decorative
   * divider that carries a label keeps the text in the tree — "OR" between two
   * sign-in buttons still means something even when the line does not.
   */
  readonly ariaHidden = computed(() => (this.isDecorative() && !this.label() ? 'true' : null));

  readonly isHorizontal = computed(() => this.orientation() === 'horizontal');

  // Host element layout. For vertical, the host must stretch to the parent flex
  // row's height (align-self: stretch) so the inner line can fill it via h-full.
  // Without this the line collapses to its min-height and looks misaligned.
  readonly hostClass = computed(() =>
    this.isHorizontal() ? 'block w-full' : 'inline-flex self-stretch'
  );

  // Optional explicit dimensions. Inline styles win over the w-full / self-stretch
  // utilities, so `width` shortens a horizontal rule and `height` gives a vertical
  // rule a fixed size even without a stretched flex parent.
  readonly rootStyle = computed((): string => {
    const w = this.width();
    const h = this.height();
    return (w ? `width:${w};` : '') + (h ? `height:${h};` : '');
  });

  readonly lineStyle = computed((): string => {
    const color = this.color();
    const thick = this.thickness();
    const v = this.variant();
    if (v === 'gradient') return '';
    const style = v === 'dashed' ? 'dashed' : v === 'dotted' ? 'dotted' : 'solid';
    const colorPart = color ? `border-color:${color};` : '';
    if (this.isHorizontal()) {
      return `border-top-style:${style};border-top-width:${thick}px;${colorPart}`;
    }
    return `border-left-style:${style};border-left-width:${thick}px;min-height:1rem;${colorPart}`;
  });

  // Computed class for each line segment
  readonly lineClass = computed(() => {
    const v = this.variant();
    const horiz = this.isHorizontal();
    const colorClass = this.color() ? '' : 'border-gray-200 dark:border-gray-700';

    if (v === 'gradient' && horiz) {
      // `X-7`: forced colors drops a gradient background entirely — the rule
      // would vanish — so it falls back to a border, which the mode paints in
      // the user's CanvasText.
      return 'flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600 forced-colors:h-0 forced-colors:border-t forced-colors:border-[CanvasText]';
    }
    if (v === 'gradient' && !horiz) {
      return 'flex-1 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-600 forced-colors:w-0 forced-colors:border-l forced-colors:border-[CanvasText]';
    }
    if (horiz) {
      return `flex-1 border-t ${colorClass}`;
    }
    // Vertical: use a thin div with a left border; flex-1 fills the height
    return `flex-1 w-0 border-l ${colorClass}`;
  });

  readonly wrapperClass = computed(() => {
    const sp = this.spacing();
    if (this.isHorizontal()) {
      return `flex items-center ${sp || 'my-4'}`;
    }
    // Vertical: column flex filling the stretched host height; mx for spacing
    return `inline-flex h-full flex-col items-center ${sp || 'mx-4'}`;
  });

  readonly hasContent = computed(() => !!this.label() || !!this.icon());

  // Content spacing: horizontal → mx-3, vertical → my-3
  readonly contentSpacingClass = computed(() =>
    this.isHorizontal() ? 'mx-3' : 'my-3'
  );
}
