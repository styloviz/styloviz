import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * ★★ EVERY VARIANT FOLLOWS THE THEME. This note used to say `brand` was the one
 *    that did, because the rest were painted with literal palettes so a badge
 *    would look the same wherever it was dropped. That was the defect, not the
 *    feature: a themed template remaps its tokens and every token-driven
 *    component follows, so the badges stayed blue on a rose page and the only
 *    escape was asking the caller to pass `variant="brand"`.
 *
 * ★ `brand` survives as its own family rather than folding into `primary`,
 *   because a kit can legitimately have a highlight colour and a brand colour
 *   that differ — dropping it would also silently recolour every call site that
 *   passes it today.
 */
export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'brand';
export type BadgeSize    = 'sm' | 'md' | 'lg';
export type BadgeStyle   = 'filled' | 'soft' | 'outline';
export type BadgeShape   = 'rounded' | 'pill' | 'square';

/**
 * What `announceTone` says for each toned variant. Variants without a tone
 * (`primary`, `secondary`, `neutral`, `brand`) are decorative colour, not status.
 */
export const SV_BADGE_TONE_WORDS: Readonly<Partial<Record<BadgeVariant, string>>> = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'information',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvBadgeComponent — Compact, accessible label for statuses, counts, and tags.
 *
 * Install: npm install @styloviz/badge
 * Import:  import { SvBadgeComponent } from '@styloviz/badge';
 *
 * Features:
 * - 8 variants × 3 styles × 3 shapes × 3 sizes
 * - Optional status dot with pulse animation (stilled under prefers-reduced-motion)
 * - Optional spoken tone word (`announceTone`) so status is not colour-only
 * - Count mode (notification badge)
 * - Leading icon slot
 * - Dismiss button
 * - Full dark mode + OnPush
 */
@Component({
  selector: 'sv-badge',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './badge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvBadgeComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Semantic color/intent (primary, success, warning, danger…). @default 'primary' */
  variant      = input<BadgeVariant>('primary');
  /** Visual treatment: solid, soft or outline. @default 'soft' */
  badgeStyle   = input<BadgeStyle>('soft');
  /** Corner style: pill, rounded or square. @default 'pill' */
  shape        = input<BadgeShape>('pill');
  /** Badge size: sm, md or lg. @default 'md' */
  size         = input<BadgeSize>('md');
  /** Badge text. Omit when using count mode or projecting content. */
  label        = input<string>('');
  /** Show status dot. @default false */
  dot          = input<boolean>(false);
  /** Animate dot with ping. @default false */
  pulseDot     = input<boolean>(false);
  /**
   * When > 0, renders count mode (overrides label).
   * @default 0
   */
  count        = input<number>(0);
  /** Cap for count display (shows "N+"). @default 99 */
  maxCount     = input<number>(99);
  /** Icon-library NAME for the leading icon — e.g. `'star'`. Was a raw `d`. */
  icon     = input<string>('');
  /** Show dismiss button. @default false */
  dismissible  = input<boolean>(false);
  /** Extra CSS classes merged on root. */
  customClass  = input<string>('');
  /** aria-label override — replaces the visible text as the accessible name. */
  ariaLabel    = input<string>('');
  /**
   * Announce the badge as a polite ARIA live region (`role="status"`).
   * Enable for dynamic notification counts/statuses that update in place so
   * assistive tech is notified of changes. Leave `false` for static labels
   * and tags to avoid noisy announcements. @default false
   */
  live         = input<boolean>(false);
  /**
   * Append the tone as a visually hidden word — "Paid, success",
   * "Overdue, error" — for the `success`, `warning`, `danger` and `info`
   * variants, so the status is not carried by colour alone (WCAG 1.4.1).
   * Other variants have no tone and add nothing. @default false
   */
  announceTone = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when the dismiss button is clicked. */
  dismissed = output<void>();

  // ── Computed ──────────────────────────────────────────────────────────────

  resolvedAriaLabel = computed(() => this.ariaLabel() || this.label());

  /** The spoken tone word, or `''` when `announceTone` is off or the variant has no tone. */
  readonly toneWord = computed<string>(() => {
    if (!this.announceTone()) return '';
    return SV_BADGE_TONE_WORDS[this.variant()] ?? '';
  });

  /** The host `aria-label`: the override, with the tone word appended when announced. */
  readonly hostAriaLabel = computed<string | null>(() => {
    const label = this.ariaLabel();
    if (!label) return null;
    const tone = this.toneWord();
    return tone ? `${label}, ${tone}` : label;
  });
  /**
   * Host ARIA role. A live badge is a polite status region; an aria-label
   * override exposes the badge as a single labelled image; otherwise the
   * visible text is the accessible name and no role is needed.
   */
  hostRole = computed<'status' | 'img' | null>(() => {
    if (this.live()) return 'status';
    if (this.ariaLabel()) return 'img';
    return null;
  });
  isCountMode       = computed(() => this.count() > 0);
  displayCount      = computed(() => {
    const n = this.count(), max = this.maxCount();
    return n > max ? `${max}+` : `${n}`;
  });

  rootClasses = computed(() => [
    'inline-flex items-center font-medium select-none transition-colors duration-150',
    this._sizeClasses(),
    this._shapeClasses(),
    this._colorClasses(),
    this.customClass(),
  ].filter(Boolean).join(' '));

  private _sizeClasses = computed<string>(() => {
    const cm = this.isCountMode();
    switch (this.size()) {
      case 'sm': return cm ? 'h-5 min-w-5 px-1 text-[10px] justify-center gap-1'  : 'px-2.5 py-1 text-[11px] gap-1';
      case 'lg': return cm ? 'h-7 min-w-7 px-2 text-sm justify-center gap-2'      : 'px-4 py-1.5 text-sm gap-2';
      default:   return cm ? 'h-6 min-w-6 px-1.5 text-xs justify-center gap-1.5'  : 'px-3 py-1 text-xs gap-1.5';
    }
  });

  private _shapeClasses = computed<string>(() => {
    switch (this.shape()) {
      case 'square':  return 'rounded-none';
      case 'rounded': return 'rounded-md';
      default:        return 'rounded-full';
    }
  });

  private _colorClasses = computed<string>(() => {
    const map: Record<BadgeVariant, Record<BadgeStyle, string>> = {
      primary: {
        filled:  'bg-primary-600 text-white dark:bg-primary-600',
        soft:    'bg-primary-50 text-primary-700 ring-1 ring-primary-100 dark:bg-primary-950/60 dark:text-primary-300 dark:ring-primary-900/50',
        outline: 'bg-transparent text-primary-700 ring-1 ring-inset ring-primary-400 dark:text-primary-400 dark:ring-primary-700',
      },
      secondary: {
        filled:  'bg-gray-700 text-white dark:bg-gray-500',
        soft:    'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800/70 dark:text-gray-300 dark:ring-gray-700/60',
        outline: 'bg-transparent text-gray-600 ring-1 ring-inset ring-gray-300 dark:text-gray-400 dark:ring-gray-600',
      },
      success: {
        filled:  'bg-accent-700 text-white',
        soft:    'bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-950/60 dark:text-accent-300 dark:ring-accent-900/50',
        outline: 'bg-transparent text-accent-700 ring-1 ring-inset ring-accent-400 dark:text-accent-400 dark:ring-accent-700',
      },
      warning: {
        filled:  'bg-warning-500 text-gray-900',
        soft:    'bg-warning-50 text-warning-700 ring-1 ring-warning-100 dark:bg-warning-950/60 dark:text-warning-300 dark:ring-warning-900/50',
        outline: 'bg-transparent text-warning-700 ring-1 ring-inset ring-warning-400 dark:text-warning-400 dark:ring-warning-700',
      },
      danger: {
        filled:  'bg-danger-600 text-white dark:bg-danger-600',
        soft:    'bg-danger-50 text-danger-700 ring-1 ring-danger-100 dark:bg-danger-950/60 dark:text-danger-300 dark:ring-danger-900/50',
        outline: 'bg-transparent text-danger-700 ring-1 ring-inset ring-danger-400 dark:text-danger-400 dark:ring-danger-700',
      },
      info: {
        filled:  'bg-info-700 text-white',
        soft:    'bg-info-50 text-info-700 ring-1 ring-info-100 dark:bg-info-950/60 dark:text-info-300 dark:ring-info-900/50',
        outline: 'bg-transparent text-info-700 ring-1 ring-inset ring-info-400 dark:text-info-400 dark:ring-info-700',
      },
      neutral: {
        filled:  'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900',
        soft:    'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800/80 dark:text-gray-400 dark:ring-gray-700/60',
        outline: 'bg-transparent text-gray-600 ring-1 ring-inset ring-gray-300 dark:text-gray-400 dark:ring-gray-600',
      },
      brand: {
        filled:  'bg-brand-600 text-white',
        soft:    'bg-brand-50 text-brand-800 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25',
        outline: 'bg-transparent text-brand-700 ring-1 ring-inset ring-brand-400 dark:text-brand-300 dark:ring-brand-600',
      },
    };
    return map[this.variant()][this.badgeStyle()];
  });

  dotColorClass = computed<string>(() => {
    const map: Record<BadgeVariant, string> = {
      primary:   'bg-primary-500 dark:bg-primary-400',
      secondary: 'bg-gray-500 dark:bg-gray-400',
      success:   'bg-accent-500 dark:bg-accent-400',
      warning:   'bg-warning-500 dark:bg-warning-400',
      danger:    'bg-danger-500 dark:bg-danger-400',
      info:      'bg-info-500 dark:bg-info-400',
      neutral:   'bg-gray-500 dark:bg-gray-400',
      brand:     'bg-brand-500 dark:bg-brand-400',
    };
    return map[this.variant()];
  });

  dismissColorClass = computed<string>(() => {
    if (this.badgeStyle() === 'filled') {
      return 'text-white/70 hover:text-white hover:bg-white/20';
    }
    const map: Record<BadgeVariant, string> = {
      primary:   'text-primary-500 hover:text-primary-700 hover:bg-primary-100 dark:text-primary-400 dark:hover:text-primary-200 dark:hover:bg-primary-800/40',
      secondary: 'text-gray-500 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700',
      success:   'text-accent-500 hover:text-accent-700 hover:bg-accent-100 dark:text-accent-400 dark:hover:text-accent-200 dark:hover:bg-accent-800/40',
      warning:   'text-warning-500 hover:text-warning-700 hover:bg-warning-100 dark:text-warning-400 dark:hover:text-warning-200 dark:hover:bg-warning-800/40',
      danger:    'text-danger-500 hover:text-danger-700 hover:bg-danger-100 dark:text-danger-400 dark:hover:text-danger-200 dark:hover:bg-danger-800/40',
      info:      'text-info-500 hover:text-info-700 hover:bg-info-100 dark:text-info-400 dark:hover:text-info-200 dark:hover:bg-info-800/40',
      neutral:   'text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700',
      brand:     'text-brand-500 hover:text-brand-700 hover:bg-brand-100 dark:text-brand-400 dark:hover:text-brand-200 dark:hover:bg-brand-800/40',
    };
    return map[this.variant()];
  });

  onDismiss(event: MouseEvent): void {
    event.stopPropagation();
    this.dismissed.emit();
  }
}
