import {
  Component,
  input,
  output,
  computed,
  linkedSignal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type AvatarShape = 'circle' | 'rounded' | 'square';
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy' | 'none';

/**
 * Palette used when rendering initials — cycles through 10 distinct hues
 * so adjacent avatars in a stack rarely share the same color.
 */
export type AvatarColor =
  | 'auto'   // derived from name (default)
  | 'primary'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'sky'
  | 'indigo'
  | 'fuchsia'
  | 'lime'
  | 'orange';

// ─── Internal constants ───────────────────────────────────────────────────────

const COLOR_PALETTE: Exclude<AvatarColor, 'auto'>[] = [
  'primary', 'violet', 'rose', 'amber', 'teal',
  'sky', 'indigo', 'fuchsia', 'lime', 'orange',
];

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Avatar — Represents a user or entity with an image, initials, or fallback icon.
 *
 * Features:
 * - Image with graceful fallback → initials → generic icon
 * - 6 sizes × 3 shapes × 10 auto-colored initials palettes
 * - Presence status indicator (online / offline / away / busy)
 * - Optional notification badge (count or dot)
 * - Verified / crown / custom indicator overlay
 * - Click interaction support
 */
@Component({
  selector: 'sv-avatar',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAvatarComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** URL of the avatar image. When blank or broken, falls back to initials/icon. */
  src = input<string>('');

  /** Full name — used to generate initials and auto-assign a palette color. */
  name = input<string>('');

  /** Alt text for the image; falls back to `name`. */
  alt = input<string>('');

  /** Avatar size. @default 'md' */
  size = input<AvatarSize>('md');

  /** Border-radius style. @default 'circle' */
  shape = input<AvatarShape>('circle');

  /**
   * Presence status indicator rendered as a small dot.
   * Set to `'none'` to hide it entirely. @default 'none'
   */
  status = input<AvatarStatus>('none');

  /**
   * Wording for the presence state — "In a meeting", "Back at 3pm", "Do not
   * disturb". Falls back to the capitalised `status`. @default ''
   */
  statusLabel = input<string>('');

  /**
   * Render the presence state in words beside the avatar. @default false
   *
   * ★ The dot alone is a colour code, and a colour code has to be learned. In a
   * member list or a header — anywhere there is room for three words — the
   * words are the answer, and the dot becomes the shorthand rather than the
   * only channel.
   */
  showStatusText = input<boolean>(false);

  /**
   * True when the status is written out beside the avatar. The dot then goes
   * `aria-hidden`: the visible word already says it, and labelling the dot as
   * well made a screen reader announce the status twice.
   */
  readonly statusTextVisible = computed(() => this.showStatusText() && !!this.statusText());

  /**
   * Color palette for the initials background.
   * `'auto'` derives a consistent hue from the name string. @default 'auto'
   */
  color = input<AvatarColor>('auto');



  /**
   * Show a verified checkmark badge in the bottom-right corner.
   * Overridden by `badgeCount` when that is > 0. @default false
   */
  verified = input<boolean>(false);

  /**
   * Notification count shown in the top-right corner.
   * Set to 0 to hide. @default 0
   */
  badgeCount = input<number>(0);

  /** Cap for the badge count display (e.g. 9 → shows "9+"). @default 9 */
  badgeMax = input<number>(9);

  /** Additional CSS classes merged onto the root wrapper. */
  customClass = input<string>('');

  /**
   * Makes the avatar interactive (adds cursor-pointer, hover/focus styles,
   * and emits `avatarClick`). @default false
   */
  clickable = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when the avatar is activated (click or keyboard) and `clickable` is true. */
  avatarClick = output<Event>();

  // ── Internal state ────────────────────────────────────────────────────────

  /**
   * Whether the current `src` has failed to load.
   *
   * ★ This used to be a plain `signal(false)`, set once on error and never
   * cleared — so an avatar that failed once was stuck on its initials for the
   * life of the component. A user replacing a broken profile picture never saw
   * the new one. Keyed on `src`, the flag resets when — and only when — there
   * is actually a different image to try. Kept identical to the Pro twin.
   */
  readonly imgError = linkedSignal<string, boolean>({
    source: this.src,
    computation: () => false,
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  /** The presence state in words. */
  statusText = computed<string>(() => {
    const custom = this.statusLabel().trim();
    if (custom) return custom;
    const map: Record<AvatarStatus, string> = {
      online: 'Online', offline: 'Offline', away: 'Away', busy: 'Busy', none: '',
    };
    return map[this.status()];
  });

  /**
   * The shape drawn inside the presence dot.
   *
   * ★★ FOUR STATES IN FOUR HUES AND NOTHING ELSE. Green, grey, amber and red at
   *    ten pixels across is a colour code with no second channel — deuteranopia
   *    alone makes the green and the amber the same mark, and *online* and
   *    *away* are precisely the two a reader needs to tell apart before sending
   *    a message. So each state now has a FORM as well: online is solid, busy
   *    carries a bar (the universal do-not-disturb mark), away is a crescent,
   *    and offline is a hollow ring — recognisable in greyscale, at size, and
   *    without knowing the palette.
   */
  statusShape = computed<'solid' | 'bar' | 'crescent' | 'hollow' | 'none'>(() => {
    switch (this.status()) {
      case 'online':  return 'solid';
      case 'busy':    return 'bar';
      case 'away':    return 'crescent';
      case 'offline': return 'hollow';
      default:        return 'none';
    }
  });

  /**
   * Whether the current `src` has finished decoding.
   *
   * ★ The fallback used to be a REPLACEMENT for the image: the shell dropped
   * its colour the moment `src` was set, so a slow image left an empty hole,
   * and a broken one snapped from that hole to initials — a flash on every
   * failure and a blank square on every slow connection. The initials are now
   * what the image sits ON TOP OF, so there is never nothing there. Keyed on
   * `src`, like `imgError`, so a new URL starts over.
   */
  readonly imgLoaded = linkedSignal<string, boolean>({
    source: this.src,
    computation: () => false,
  });

  onImageLoad(): void {
    this.imgLoaded.set(true);
  }

  /** Whether the initials/icon layer is doing any work right now. */
  fallbackVisible = computed(() => !this.showImage() || !this.imgLoaded());

  /** Whether to show the <img> element at all. */
  showImage = computed(() => !!this.src() && !this.imgError());

  /** Two-letter initials derived from `name`. */
  initials = computed<string>(() => {
    const n = this.name().trim();
    if (!n) return '';
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  /** Resolved palette color. */
  resolvedColor = computed<Exclude<AvatarColor, 'auto'>>(() => {
    const c = this.color();
    if (c !== 'auto') return c;
    const n = this.name();
    if (!n) return 'primary';
    // Simple, stable hash from the name string
    const hash = [...n].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return COLOR_PALETTE[hash % COLOR_PALETTE.length];
  });

  /**
   * Whether to show the generic icon (no name to make initials from).
   *
   * Keyed on `fallbackVisible`, not `showImage`: a nameless avatar with a slow
   * photo showed an empty square for the same reason a named one showed a hole
   * — the fallback was treated as a replacement rather than as the layer
   * underneath.
   */
  showIcon = computed(() => this.fallbackVisible() && !this.initials());

  /** Formatted badge count string. */
  displayBadge = computed<string>(() => {
    const n = this.badgeCount();
    const max = this.badgeMax();
    return n > max ? `${max}+` : `${n}`;
  });

  /**
   * What the badge is announced as — the true count, not the capped one, and
   * in the singular when there is one of them.
   *
   * ★ The template used to inline `badgeCount() + ' notifications'`, which
   * announced "1 notifications" and, once the count passed `badgeMax`, still
   * read the capped "9+" out of the visible text while claiming a different
   * number here. Kept identical to the Pro twin.
   */
  badgeAriaLabel = computed<string>(() => {
    const n = this.badgeCount();
    return `${n} notification${n === 1 ? '' : 's'}`;
  });

  showBadge = computed(() => this.badgeCount() > 0);

  // ── Root classes ──────────────────────────────────────────────────────────

  rootClasses = computed(() => [
    'inline-flex shrink-0 items-center gap-2',
    this.clickable()
      ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
      : '',
    this.customClass(),
  ].filter(Boolean).join(' '));

  /** Size classes for the avatar shell. */
  sizeClasses = computed<string>(() => {
    switch (this.size()) {
      case 'xs':  return 'h-6 w-6 text-[10px]';
      case 'sm':  return 'h-8 w-8 text-xs';
      case 'lg':  return 'h-12 w-12 text-base';
      case 'xl':  return 'h-16 w-16 text-xl';
      case '2xl': return 'h-20 w-20 text-2xl';
      default:    return 'h-10 w-10 text-sm'; // md
    }
  });

  /** Shape / border-radius classes. */
  shapeClasses = computed<string>(() => {
    switch (this.shape()) {
      case 'square':  return 'rounded-none';
      case 'rounded': return 'rounded-lg';
      default:        return 'rounded-full';
    }
  });


  /** Initials background + text color classes keyed to the resolved palette. */
  initialsColorClasses = computed<string>(() => {
    const map: Record<Exclude<AvatarColor, 'auto'>, string> = {
      primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
      violet:  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
      rose:    'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
      amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      teal:    'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
      sky:     'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
      indigo:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
      fuchsia: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-300',
      lime:    'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300',
      orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    };
    return map[this.resolvedColor()];
  });

  /** Status dot background color. */
  statusColorClass = computed<string>(() => {
    switch (this.status()) {
      case 'online':  return 'bg-accent-500';
      case 'offline': return 'bg-gray-400 dark:bg-gray-600';
      case 'away':    return 'bg-warning-400';
      case 'busy':    return 'bg-danger-500';
      default:        return '';
    }
  });

  /**
   * Border colour for the hollow (offline) dot.
   *
   * ★ Offline is drawn as a RING rather than a filled grey circle, because a
   * grey fill on a white card is nearly the card, and "no dot at all" and
   * "offline" then look the same. A ring is a mark either way.
   */
  statusBorderClass = computed<string>(() =>
    this.status() === 'offline' ? 'border-gray-400 dark:border-gray-500' : 'border-transparent',
  );

  /** Status dot size keyed to avatar size. */
  statusSizeClasses = computed<string>(() => {
    switch (this.size()) {
      case 'xs':
      case 'sm':  return 'h-2 w-2';
      case 'lg':
      case 'xl':
      case '2xl': return 'h-3.5 w-3.5';
      default:    return 'h-2.5 w-2.5';
    }
  });

  /** Badge size keyed to avatar size. */
  badgeSizeClasses = computed<string>(() => {
    switch (this.size()) {
      case 'xs':
      case 'sm':  return 'h-3.5 min-w-3.5 text-[9px] px-0.5';
      case 'lg':
      case 'xl':
      case '2xl': return 'h-5 min-w-5 text-[11px] px-1';
      default:    return 'h-4 min-w-4 text-[10px] px-0.5';
    }
  });

  // ── Events ────────────────────────────────────────────────────────────────

  onImageError(): void {
    this.imgError.set(true);
  }

  onClick(event: Event): void {
    if (this.clickable()) {
      this.avatarClick.emit(event);
    }
  }
}
