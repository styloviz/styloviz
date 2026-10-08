import {
  booleanAttribute,
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SV_LINK_ADAPTER, SvSpinnerArcComponent, svIsModifiedClick } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Colour role.
 *
 * ★★ EVERY VARIANT FOLLOWS THE THEME. Each one paints from a semantic token
 *    family declared in `src/styles.css`'s `@theme` block — `primary`, `accent`,
 *    `warning`, `danger`, `info`, `brand`, `brandaccent`, plus `gray` for the
 *    neutral roles. So a `.tpl-<id>` scope, a Theme Builder export, or an edit
 *    to `@theme` recolours the buttons along with everything else.
 *
 *    This used to be true of `brand` alone. The other variants were literal
 *    (`bg-blue-600`, `bg-emerald-600`) so that a button looked the same wherever
 *    it was dropped — which stopped being a feature inside a themed template,
 *    where the buttons stayed blue on an olive page with no way to fix it from
 *    CSS. `brand` survives as a distinct family rather than an alias for
 *    `primary`, because a kit can have a link/action colour and a brand colour
 *    that are deliberately different.
 *
 *    Where the hue itself carries the meaning, the literal stays: the `success`
 *    and `info` gradients keep their `teal`/`cyan` far stop, and `warning` keeps
 *    `orange`. Those are decoration, not roles, and folding them into a
 *    semantic family would make a buyer's one colour choice paint both ends of
 *    a gradient the same.
 */
export type ButtonVariant =
  | 'primary'
  | 'brand'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'ghost'
  | 'link';

export type ButtonStyle =
  | 'solid'
  | 'outline'
  | 'soft'
  | 'ghost'
  | 'link'
  | 'gradient';

export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonShape   = 'rounded' | 'pill' | 'square';
export type ButtonIconPos = 'leading' | 'trailing' | 'only';
export type ButtonLoader  = 'spinner' | 'dots' | 'pulse';
export type ButtonType    = 'button' | 'submit' | 'reset';

/** Template type for `iconTemplate` / `trailingIconTemplate` — any TemplateRef, or null when unset. */
export type ButtonIconTemplate = TemplateRef<unknown> | null;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvButtonComponent — Premium, accessible button for Styloviz dashboards.
 *
 * Install: npm install @styloviz/button
 * Import:  import { SvButtonComponent } from '@styloviz/button';
 *
 * Features:
 * - 9 variants × 6 styles × 5 sizes × 3 shapes
 * - 3 loading animations: spinner · dots · pulse
 * - Leading, trailing, and icon-only modes
 * - Dual-icon layout via trailingIcon
 * - Bring-your-own icon via `iconTemplate` / `trailingIconTemplate` — render
 *   any third-party icon component, <img>, icon font, or custom SVG instead
 *   of the built-in path-based icon
 * - Counter badge (top-right)
 * - Renders as <a> when href is provided
 * - Full dark-mode + OnPush
 */
@Component({
  selector: 'sv-button',
  standalone: true,
  imports: [NgTemplateOutlet, SvSpinnerArcComponent, SvIconComponent],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvButtonComponent {
  // ── Appearance ────────────────────────────────────────────────────────────

  /** Semantic color/intent: primary, secondary, success, danger, etc. @default 'primary' */
  variant      = input<ButtonVariant>('primary');
  /** Visual treatment: solid, soft, outline, ghost, link or gradient. @default 'solid' */
  btnStyle     = input<ButtonStyle>('solid');
  /** Button size from xs to xl. @default 'md' */
  size         = input<ButtonSize>('md');
  /** Corner style: rounded, pill or square. @default 'rounded' */
  shape        = input<ButtonShape>('rounded');
  /** Stretch to 100% width. @default false */
  block        = input<boolean>(false);
  /** Add drop shadow. @default false */
  elevated     = input<boolean>(false);

  // ── Content ───────────────────────────────────────────────────────────────

  /** Button text. Omit when projecting custom content. */
  label            = input<string>('');
  /**
   * Icon-library NAME for the built-in leading/trailing icon — e.g. `'plus'`.
   * Ignored when `iconTemplate` is set.
   *
   * ★ BREAKING (icon sweep): was `iconPath`, a raw SVG `d` string. A name
   * resolves through `@styloviz/icons`, so `check:icons` catches a typo that a
   * `d` string rendered as a blank button. ⚠️ The old attribute was usually
   * written STATICALLY (`iconPath="M12 4.5v15…"`), and Angular silently ignores
   * an unknown static attribute — so a missed call site renders no icon rather
   * than failing the build. All 157 in-repo sites were rewritten tag-scoped.
   */
  icon             = input<string>('');
  /**
   * Icon-library NAME for the secondary/dual trailing icon. Ignored when
   * `trailingIconTemplate` is set. Was `trailingIconPath`.
   */
  trailingIcon     = input<string>('');
  /**
   * Custom template for the primary icon — use this to render a third-party
   * icon component (e.g. lucide-angular, ngx-heroicons), an `<img>`, an icon
   * font `<i>`, or arbitrary custom SVG instead of the built-in `icon`.
   * Positioned per `iconPosition()`. Takes precedence over `icon` when set.
   *
   * @example
   * ```html
   * <ng-template #saveIcon>
   *   <img src="/assets/icons/save.svg" alt="" />
   * </ng-template>
   * <sv-button label="Save" [iconTemplate]="saveIcon" />
   * ```
   */
  iconTemplate         = input<ButtonIconTemplate>(null);
  /**
   * Custom template for the secondary/dual trailing icon. Takes precedence
   * over `trailingIcon` when set. See `iconTemplate` for usage.
   */
  trailingIconTemplate = input<ButtonIconTemplate>(null);
  /** Where the main icon sits relative to the label. @default 'leading' */
  iconPosition     = input<ButtonIconPos>('leading');
  /** Numeric counter badge. null = hidden. @default null */
  counter          = input<number | null>(null);
  /** Value above which the counter shows "{max}+". @default 99 */
  counterMax       = input<number>(99);
  /** Noun describing the counter for screen readers, e.g. "unread". */
  counterLabel     = input<string>('');

  // ── State ─────────────────────────────────────────────────────────────────

  /** Native button type when not in link mode. @default 'button' */
  type         = input<ButtonType>('button');
  /** Disable interaction and dim the button. @default false */
  disabled     = input<boolean>(false);
  /** Show a loading indicator and block activation. @default false */
  loading      = input<boolean>(false);
  /** Loading indicator style: spinner or dots. @default 'spinner' */
  loadingStyle = input<ButtonLoader>('spinner');
  /** Optional text shown beside the loading indicator. */
  loadingLabel = input<string>('');

  /**
   * Ignore a second activation that lands within `doubleSubmitWindowMs` of the
   * one before it. @default false
   *
   * ★★ `loading` CANNOT PREVENT THE DOUBLE-SUBMIT THAT MATTERS. The sequence
   *    that creates a duplicate order is: click → `clicked` emits → the host's
   *    handler starts a request and sets `loading` → **second click** → the
   *    host's signal write has not been rendered yet → `isDisabled()` is still
   *    false → `clicked` emits again. A user who double-clicks a submit button,
   *    or a trackpad that reports one press as two, lands both clicks inside
   *    that frame. `FI-02-I3`: the loading state is presentational, and by the
   *    time it is on screen the damage is done.
   *
   *    This closes exactly that gap and nothing more. `loading` still covers
   *    the rest of the request — the two are complements, not alternatives.
   *
   *    Off by default, because the guard is wrong for a button that is meant to
   *    be pressed repeatedly: a stepper's "+", a "next slide", an "add row".
   *    Turn it on for submits, payments, and anything else that creates a
   *    record.
   */
  preventDoubleSubmit = input(false, { transform: booleanAttribute });

  /**
   * How long a repeat activation is ignored for, in milliseconds. @default 400
   *
   * Long enough to cover a double-click (the OS threshold is ~500ms, but a
   * genuine second *intent* is much slower than that) and short enough that a
   * user who clicked once, saw nothing happen and clicked again is not ignored
   * a second time. `0` disables the window without having to unset
   * `preventDoubleSubmit`.
   */
  doubleSubmitWindowMs = input<number>(400);

  /**
   * Announce the loading state in a live region. @default true
   *
   * Turn it off where the page already says so — a form with its own
   * `role="status"` reporting "Saving…" does not need the button to say it too.
   */
  announceLoading = input(true, { transform: booleanAttribute });

  // ── Link mode ─────────────────────────────────────────────────────────────

  /** When set, renders an <a> anchor instead of a <button>. */
  href     = input<string>('');
  /** Anchor target (e.g. _blank) when href is set. @default '_self' */
  target   = input<string>('_self');
  /** Anchor rel. `noopener noreferrer` is auto-added for target="_blank". */
  rel      = input<string>('');
  /** Anchor download attribute (filename or empty string to use the URL). */
  download = input<string | null>(null);

  // ── Form integration (button mode) ─────────────────────────────────────────

  /** Native `name` for the button when submitted as part of a form. */
  name  = input<string>('');
  /** Native `value` submitted with `name` for multi-button forms. */
  value = input<string>('');

  // ── Accessibility ───────────────────────────────────────────────────────────

  /** Explicit accessible name. Required for icon-only buttons; overrides label. */
  ariaLabel = input<string>('');
  /**
   * Toggle state, published as `aria-pressed`.
   *
   * ★★ A BUTTON THAT STAYS ON IS A TOGGLE, AND A TOGGLE HAS TO SAY SO. Filter
   *    chips, "pin", "mute", "bold" — every one of them is a button whose
   *    variant changes to show it is active, and to a screen reader that change
   *    is invisible: the name is identical in both states, so the control reads
   *    as an ordinary button that does nothing. `aria-pressed` is the whole
   *    difference between "Filter" and "Filter, pressed".
   *
   *    `null` — the default — omits the attribute entirely, because a button
   *    that is not a toggle must NOT claim to be one. `aria-pressed="false"` on
   *    an ordinary button tells the reader there is a state to toggle.
   *
   * @default null
   */
  pressed   = input<boolean | null>(null);
  /** Native tooltip / title attribute. */
  title     = input<string>('');
  /** Autofocus the control on render. @default false */
  autofocus = input<boolean>(false);

  // ── Output ────────────────────────────────────────────────────────────────

  /** Emitted on click (suppressed while disabled or loading). */
  clicked = output<MouseEvent>();
  /** Emitted when the control receives focus. */
  focused = output<FocusEvent>();
  /** Emitted when the control loses focus. */
  blurred = output<FocusEvent>();

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly isDisabled   = computed(() => this.disabled() || this.loading());
  readonly displayLabel = computed(() =>
    this.loading() && this.loadingLabel() ? this.loadingLabel() : this.label()
  );

  /**
   * What the live region says while the control is busy — empty when it is not.
   *
   * ★★ THE OLD ANNOUNCEMENT WAS DEAD CODE IN THE CASE IT WAS WRITTEN FOR. It
   *    was an `sr-only` span *inside* the control, rendered when the button was
   *    icon-only. An icon-only button must carry `ariaLabel`, `ariaLabel` is
   *    bound to `aria-label`, and `aria-label` replaces the element's contents
   *    entirely when the name is computed — so the span was never part of the
   *    name, and never announced. The only configuration where it worked was a
   *    button with no accessible name at all, which is broken for other
   *    reasons. `FI-02-M3`.
   *
   *    A live region outside the control says the same string the same way in
   *    every configuration, and — unlike a change to the name — announces on
   *    the *transition* rather than only to someone who happens to arrive at
   *    the control afterwards. `aria-busy` is set as well, but support for it
   *    on a button is thin enough that it cannot be the only signal.
   */
  readonly busyAnnouncement = computed(() =>
    this.loading() && this.announceLoading() ? (this.loadingLabel() || 'Loading') : '',
  );

  /** True when a counter badge should be shown. */
  readonly hasCounter = computed(
    () => this.counter() !== null && this.counter()! >= 0
  );

  /** Text rendered inside the counter badge (e.g. "99+"). */
  readonly counterText = computed(() => {
    const n = this.counter();
    if (n === null) return '';
    const max = this.counterMax();
    return n > max ? `${max}+` : `${n}`;
  });

  /**
   * Accessible name. Uses ariaLabel, then label. Appends the counter
   * (e.g. "Inbox, 5 unread") so screen readers announce the badge.
   */
  readonly accessibleLabel = computed(() => {
    // `displayLabel()`, not `label()`: while `loadingLabel` is on screen the
    // visible text is "Saving…", and a name of "Save" fails WCAG 2.5.3 (Label
    // in Name) — speech-input users say what they see, and "click Saving"
    // would not match. An explicit `ariaLabel` still wins; that is the host
    // deliberately naming the control.
    const base = this.ariaLabel() || this.displayLabel();
    if (!this.hasCounter()) return base || null;
    const noun = this.counterLabel() ? ` ${this.counterLabel()}` : '';
    const count = `${this.counter()}${noun}`;
    return base ? `${base}, ${count}` : count;
  });

  /** Resolved rel for anchors; ensures safe defaults for new tabs. */
  readonly computedRel = computed(() => {
    const tokens = new Set(this.rel().split(/\s+/).filter(Boolean));
    if (this.target() === '_blank') {
      tokens.add('noopener');
      tokens.add('noreferrer');
    }
    return tokens.size ? [...tokens].join(' ') : null;
  });

  readonly classes = computed(() => {
    // `block` swaps the base display utility rather than appending one, because
    // `inline-flex` and `flex` are the same CSS property — appending `w-full`
    // alone would leave the element shrink-to-fit and the input a no-op.
    const displayClass = this.block() ? 'flex w-full' : 'inline-flex';
    const baseClasses = this._base.replace('inline-flex', displayClass);
    return [
      baseClasses,
      this._sizeClasses(this.size()),
      this._shapeClasses(this.shape()),
      this._variantStyleClasses(this.variant(), this.btnStyle()),
      this._stateClasses(),
      this.elevated() && !['link', 'ghost'].includes(this.btnStyle())
        ? 'shadow-md hover:shadow-lg active:shadow-sm'
        : '',
    ].filter(Boolean).join(' ');
  });

  readonly iconSizeClass = computed(() => {
    const map: Record<ButtonSize, string> = {
      xs: 'h-3.5 w-3.5', sm: 'h-4 w-4', md: 'h-[18px] w-[18px]',
      lg: 'h-5 w-5',     xl: 'h-6 w-6',
    };
    return map[this.size()];
  });

  readonly spinnerSizeClass = computed(() => {
    const map: Record<ButtonSize, string> = {
      xs: 'h-3 w-3', sm: 'h-3.5 w-3.5', md: 'h-4 w-4',
      lg: 'h-[18px] w-[18px]', xl: 'h-5 w-5',
    };
    return map[this.size()];
  });

  /**
   * Sizing wrapper for a projected `iconTemplate`. Constrains third-party
   * icon components, `<img>`, and custom SVG to the same box the built-in
   * icon would occupy, so custom icons line up regardless of their own
   * intrinsic markup or default size.
   */
  readonly customIconWrapperClass = computed(
    () =>
      `${this.iconSizeClass()} inline-flex shrink-0 items-center justify-center ` +
      '[&>svg]:h-full [&>svg]:w-full [&>img]:h-full [&>img]:w-full [&>img]:object-contain'
  );

  /** Same as `customIconWrapperClass`, dimmed to match `trailingIconPath`'s dual-icon treatment. */
  readonly trailingCustomIconWrapperClass = computed(
    () => `${this.customIconWrapperClass()} opacity-70`
  );

  // ── Event ─────────────────────────────────────────────────────────────────

  /**
   * Timestamp of the last activation that was allowed through, or `null` for
   * "none yet".
   *
   * `null` rather than `0`: a numeric sentinel of zero is a real point on the
   * clock, and `Date.now() - 0 < window` is true for anything the test clock —
   * or a fake one in a host's own tests — reports near the epoch, which
   * swallows the very first click.
   */
  private _lastAccepted: number | null = null;
  private readonly _links = inject(SV_LINK_ADAPTER);

  handleClick(event: MouseEvent): void {
    if (this.isDisabled() || this._isRepeatSubmit()) {
      // `preventDefault` matters as much as the suppressed output: in link mode
      // this is an `<a>`, and with `type="submit"` the browser submits the form
      // whether or not anybody listens to `clicked`.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.clicked.emit(event);
    this._followInApp(event);
  }

  /**
   * In link mode, hand an in-app path to the app's router instead of letting
   * the browser reload the page.
   *
   * ★★ WHY (1.0 release audit, M6). The templates wrapped buttons in a router
   *    link — `<a routerLink><sv-button/></a>` — to get SPA navigation, which
   *    nests a `<button>` inside an `<a>`: invalid HTML, two tab stops for one
   *    control, and a screen reader announcing "link, button". `[href]` renders
   *    one real anchor; this is the half `routerLink` used to supply. It goes
   *    through `SV_LINK_ADAPTER` like `sv-breadcrumb` does, so the button still
   *    has no router dependency, and with no adapter provided it is a plain link.
   *
   * Only for a plain left click on a same-tab, same-origin path: ⌘/Ctrl/Shift/
   * middle click, `target="_blank"`, `download`, an absolute URL, or a host
   * `(clicked)` handler that called `preventDefault()` all keep the browser's
   * behaviour. The browser's navigation is cancelled only when the adapter says
   * it took it.
   */
  private _followInApp(event: MouseEvent): void {
    const href = this.href();
    if (!href || event.defaultPrevented || svIsModifiedClick(event)) return;
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const target = this.target();
    if ((target && target !== '_self') || this.download() !== null) return;
    if (this._links.navigate(href)) event.preventDefault();
  }

  /**
   * Whether this activation is a repeat of one already accepted.
   *
   * Records the time only for activations it lets through, so a burst of five
   * clicks does not extend the window five times — the window is measured from
   * the click that did something, not from the last one that was ignored.
   */
  private _isRepeatSubmit(): boolean {
    if (!this.preventDoubleSubmit()) return false;
    const window = Math.max(0, this.doubleSubmitWindowMs());
    const now = Date.now();
    if (window > 0 && this._lastAccepted !== null && now - this._lastAccepted < window) return true;
    this._lastAccepted = now;
    return false;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private readonly _base =
    'relative inline-flex items-center justify-center font-medium ' +
    'transition-all duration-150 focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 ' +
    'select-none whitespace-nowrap leading-none';

  private _sizeClasses(sz: ButtonSize): string {
    const iconOnly = this.iconPosition() === 'only';
    const map: Record<ButtonSize, { text: string; icon: string }> = {
      xs: { text: 'h-7 px-2.5 text-xs gap-1.5',     icon: 'h-7 w-7 text-xs' },
      sm: { text: 'h-8 px-3 text-sm gap-1.5',        icon: 'h-8 w-8 text-sm' },
      md: { text: 'h-9 px-4 text-sm gap-2',          icon: 'h-9 w-9 text-sm' },
      lg: { text: 'h-10 px-5 text-[15px] gap-2',     icon: 'h-10 w-10 text-[15px]' },
      xl: { text: 'h-12 px-6 text-base gap-2.5',     icon: 'h-12 w-12 text-base' },
    };
    return iconOnly ? map[sz].icon : map[sz].text;
  }

  private _shapeClasses(sh: ButtonShape): string {
    const map: Record<ButtonShape, string> = {
      rounded: 'rounded-md', pill: 'rounded-full', square: 'rounded-none',
    };
    return map[sh];
  }

  private _variantStyleClasses(v: ButtonVariant, s: ButtonStyle): string {
    switch (s) {
      case 'solid':    return this._solid(v);
      case 'outline':  return this._outline(v);
      case 'soft':     return this._soft(v);
      case 'ghost':    return this._ghost(v);
      case 'link':     return this._link(v);
      case 'gradient': return this._gradient(v);
    }
  }

  /**
   * ★ Amber has a dead zone, and `warning` is the only variant that has to cross
   *   it. White text needs warning-700 or darker (5.05:1); near-black text needs
   *   warning-600 or lighter (5.56:1); nothing readable sits on warning-500 in
   *   white (2.15:1). Rather than lose the yellow to an ochre brown, this row
   *   keeps the warning-500 fill and takes `text-gray-900` — which means the fill
   *   LIGHTENS on hover and press, since going darker would walk straight into
   *   the gap. That is how a yellow button behaves everywhere; contrast only
   *   improves as it brightens (8.27 → 10.33 → 12.27).
   *
   * ★★ Those ratios describe the DEFAULT `warning`, which is amber. The row is
   *   now token-driven, so a buyer who picks a dark warning colour inverts the
   *   reasoning: `text-gray-900` needs a LIGHT fill, and on a dark fill it fails.
   *   That is why `theme-builder.audit.ts` carries a `warning-solid` pair — the
   *   Theme Builder says so at pick time, which is the only place it can be
   *   caught, since no static check can know what colour a buyer will choose.
   */
  private _solid(v: ButtonVariant): string {
    const map: Record<ButtonVariant, string> = {
      primary:   'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-500',
      brand:     'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
      success:   'bg-accent-700 text-white hover:bg-accent-800 active:bg-accent-900 focus-visible:ring-accent-500',
      warning:   'bg-warning-500 text-gray-900 hover:bg-warning-400 active:bg-warning-300 focus-visible:ring-warning-500',
      danger:    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus-visible:ring-danger-500',
      info:      'bg-info-700 text-white hover:bg-info-800 active:bg-info-900 focus-visible:ring-info-500',
      neutral:   'bg-gray-800 text-white hover:bg-gray-900 focus-visible:ring-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500',
      ghost:     'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-800',
      link:      'bg-transparent text-primary-600 hover:text-primary-700 hover:underline focus-visible:ring-primary-500 dark:text-primary-400',
    };
    return map[v];
  }

  private _outline(v: ButtonVariant): string {
    const map: Record<ButtonVariant, string> = {
      primary:   'border border-primary-600 text-primary-600 bg-transparent hover:bg-primary-50 focus-visible:ring-primary-500 dark:border-primary-500 dark:text-primary-400 dark:hover:bg-primary-900/20',
      brand:     'border border-brand-600 text-brand-700 bg-transparent hover:bg-brand-50 focus-visible:ring-brand-500 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-500/10',
      secondary: 'border border-gray-300 text-gray-700 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
      success:   'border border-accent-600 text-accent-700 bg-transparent hover:bg-accent-50 focus-visible:ring-accent-500 dark:border-accent-500 dark:text-accent-400 dark:hover:bg-accent-900/20',
      warning:   'border border-warning-500 text-warning-700 bg-transparent hover:bg-warning-50 focus-visible:ring-warning-400 dark:border-warning-400 dark:text-warning-400 dark:hover:bg-warning-900/20',
      danger:    'border border-danger-600 text-danger-600 bg-transparent hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500 dark:border-danger-500 dark:text-danger-400 dark:hover:bg-danger-900/20',
      info:      'border border-info-500 text-info-700 bg-transparent hover:bg-info-50 focus-visible:ring-info-400 dark:border-info-400 dark:text-info-400 dark:hover:bg-info-900/20',
      neutral:   'border border-gray-700 text-gray-800 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-600 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-gray-800',
      ghost:     'border border-transparent text-gray-600 bg-transparent hover:border-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800',
      link:      'border border-transparent text-primary-600 bg-transparent hover:border-primary-300 hover:bg-primary-50 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-900/20',
    };
    return map[v];
  }

  private _soft(v: ButtonVariant): string {
    const map: Record<ButtonVariant, string> = {
      primary:   'bg-primary-50 text-primary-700 hover:bg-primary-100 focus-visible:ring-primary-400 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50',
      brand:     'bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:ring-brand-400 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25',
      secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
      success:   'bg-accent-50 text-accent-700 hover:bg-accent-100 focus-visible:ring-accent-400 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50',
      warning:   'bg-warning-50 text-warning-700 hover:bg-warning-100 focus-visible:ring-warning-400 dark:bg-warning-900/30 dark:text-warning-300 dark:hover:bg-warning-900/50',
      danger:    'bg-danger-50 text-danger-700 hover:bg-danger-100 focus-visible:ring-danger-400 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50',
      info:      'bg-info-50 text-info-700 hover:bg-info-100 focus-visible:ring-info-400 dark:bg-info-900/30 dark:text-info-300 dark:hover:bg-info-900/50',
      neutral:   'bg-gray-200 text-gray-700 hover:bg-gray-300 focus-visible:ring-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
      ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:bg-gray-800',
      link:      'bg-transparent text-primary-600 hover:bg-primary-50 hover:underline focus-visible:ring-primary-400 dark:text-primary-400 dark:hover:bg-primary-900/20',
    };
    return map[v];
  }

  private _ghost(v: ButtonVariant): string {
    const map: Record<ButtonVariant, string> = {
      primary:   'bg-transparent text-primary-600 hover:bg-primary-50 focus-visible:ring-primary-400 dark:text-primary-400 dark:hover:bg-primary-900/20',
      brand:     'bg-transparent text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10',
      secondary: 'bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-800',
      success:   'bg-transparent text-accent-700 hover:bg-accent-50 focus-visible:ring-accent-400 dark:text-accent-400 dark:hover:bg-accent-900/20',
      warning:   'bg-transparent text-warning-700 hover:bg-warning-50 focus-visible:ring-warning-400 dark:text-warning-400 dark:hover:bg-warning-900/20',
      danger:    'bg-transparent text-danger-600 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-400 dark:text-danger-400 dark:hover:bg-danger-900/20',
      info:      'bg-transparent text-info-700 hover:bg-info-50 focus-visible:ring-info-400 dark:text-info-400 dark:hover:bg-info-900/20',
      neutral:   'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:bg-gray-800',
      ghost:     'bg-transparent text-gray-500 hover:bg-gray-100 focus-visible:ring-gray-300 dark:text-gray-400 dark:hover:bg-gray-800',
      link:      'bg-transparent text-primary-600 hover:text-primary-700 focus-visible:ring-primary-400 dark:text-primary-400 dark:hover:text-primary-300',
    };
    return map[v];
  }

  private _link(v: ButtonVariant): string {
    const map: Record<ButtonVariant, string> = {
      primary:   'bg-transparent text-primary-600 underline-offset-4 hover:underline hover:text-primary-700 focus-visible:ring-primary-400 dark:text-primary-400',
      brand:     'bg-transparent text-brand-700 underline-offset-4 hover:underline hover:text-brand-800 focus-visible:ring-brand-400 dark:text-brand-300',
      secondary: 'bg-transparent text-gray-600 underline-offset-4 hover:underline hover:text-gray-900 focus-visible:ring-gray-400 dark:text-gray-400',
      success:   'bg-transparent text-accent-700 underline-offset-4 hover:underline hover:text-accent-700 focus-visible:ring-accent-400 dark:text-accent-400',
      warning:   'bg-transparent text-warning-700 underline-offset-4 hover:underline focus-visible:ring-warning-400 dark:text-warning-400',
      danger:    'bg-transparent text-danger-600 underline-offset-4 hover:underline hover:text-danger-700 focus-visible:ring-danger-400 dark:text-danger-400',
      info:      'bg-transparent text-info-700 underline-offset-4 hover:underline hover:text-info-700 focus-visible:ring-info-400 dark:text-info-400',
      neutral:   'bg-transparent text-gray-600 underline-offset-4 hover:underline hover:text-gray-900 focus-visible:ring-gray-400 dark:text-gray-300',
      ghost:     'bg-transparent text-gray-500 underline-offset-4 hover:underline hover:text-gray-700 focus-visible:ring-gray-300 dark:text-gray-400',
      link:      'bg-transparent text-primary-600 underline underline-offset-4 hover:text-primary-800 focus-visible:ring-primary-400 dark:text-primary-400',
    };
    return map[v];
  }

  /**
   * ★ `danger` is the one row whose two stops collapsed into one family. It was
   *   `rose-500 → red-600`, which moved in hue as well as lightness; both hues
   *   belong to `danger`, so a literal substitution would have left
   *   `danger-500 → danger-600` — one step apart, a gradient with nothing in it.
   *   It spans two steps instead, so the movement survives a buyer's colour
   *   choice rather than depending on two Tailwind hues happening to differ.
   *
   * ★★ EVERY ROW STARTS AT THE STEP ITS SOLID ROW STARTS AT, AND THAT IS A
   *    CONTRAST FIX, NOT A STYLE PREFERENCE. These rows used to open two to
   *    three steps lighter than `_solid` — `from-accent-400`, `from-warning-400`,
   *    `from-info-400`, `from-primary-500` — under the same `text-white`. A
   *    gradient's leftmost pixel IS its `from` stop, so the leftmost glyphs sat
   *    on it: white measured 1.72:1 on the warning row, 1.94 on success, 2.18 on
   *    info, 3.76 on primary and link, 3.81 on danger, 4.40 on brand. Nine of the
   *    ten rows failed AA somewhere and six failed at every stop. The `to` stops
   *    moved with them, because a gradient needs two colours that differ and
   *    darkening only the near end flattens it.
   *
   * ★★ Except `warning`, which keeps its light fill and takes `text-gray-900` —
   *    the same answer, for the same reason, as the solid row documented above:
   *    amber has a dead zone no white text clears without turning the yellow to
   *    ochre. It also LIGHTENS on hover, again like solid, since with dark ink
   *    contrast improves as the fill brightens (10.30 → 12.26 at the near stop).
   *
   * ★ Why no tool caught this: an element painted with a gradient has no single
   *   background colour, so axe reports nothing and `check:contrast` has nothing
   *   to compare. Gradients are a third blind spot alongside inline styles and
   *   template/TS-split pairs, and the only way to check one is to compute every
   *   stop. Worst stop per row after this change: success 5.36, warning 6.15
   *   (dark ink), info 5.28, primary 5.25, link 5.25, brand 5.89, danger 6.42.
   */
  private _gradient(v: ButtonVariant): string {
    const map: Record<ButtonVariant, string> = {
      primary:   'bg-gradient-to-r from-primary-600 to-brandaccent-700 text-white hover:from-primary-700 hover:to-brandaccent-800 focus-visible:ring-brandaccent-500',
      brand:     'bg-gradient-to-r from-brand-600 to-brandaccent-700 text-white hover:from-brand-700 hover:to-brandaccent-800 focus-visible:ring-brand-500',
      secondary: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 hover:from-gray-200 hover:to-gray-300 focus-visible:ring-gray-400 dark:from-gray-700 dark:to-gray-800 dark:text-gray-100',
      success:   'bg-gradient-to-r from-accent-700 to-teal-800 text-white hover:from-accent-800 hover:to-teal-900 focus-visible:ring-teal-500',
      warning:   'bg-gradient-to-r from-warning-400 to-orange-500 text-gray-900 hover:from-warning-300 hover:to-orange-400 focus-visible:ring-orange-400',
      danger:    'bg-gradient-to-r from-danger-600 to-danger-800 text-white hover:from-danger-700 hover:to-danger-900 focus-visible:ring-danger-500',
      info:      'bg-gradient-to-r from-info-700 to-cyan-800 text-white hover:from-info-800 hover:to-cyan-900 focus-visible:ring-cyan-400',
      neutral:   'bg-gradient-to-r from-gray-700 to-gray-900 text-white hover:from-gray-800 hover:to-black focus-visible:ring-gray-600',
      ghost:     'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 focus-visible:ring-gray-400 dark:from-gray-800 dark:to-gray-900 dark:text-gray-200',
      link:      'bg-gradient-to-r from-primary-600 to-brand-700 text-white hover:from-primary-700 hover:to-brand-800 focus-visible:ring-brand-500',
    };
    return map[v];
  }

  private _stateClasses(): string {
    if (this.loading()) return 'opacity-75 cursor-wait pointer-events-none';
    if (this.disabled()) return 'opacity-50 cursor-not-allowed pointer-events-none';
    return 'cursor-pointer';
  }
}
