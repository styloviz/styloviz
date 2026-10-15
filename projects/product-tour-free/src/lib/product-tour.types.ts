/**
 * Visual variant of the product tour.
 *
 * The **free** tier ships the `modal` variant only. The full set of eight
 * variants — slideshow, tooltip, spotlight, beacon, checklist, progress-steps
 * and announcement — is available in `@styloviz-pro/product-tour`.
 *
 * | Variant | Description                                                 |
 * |---------|-------------------------------------------------------------|
 * | modal   | Centered lightbox dialog — image, rich text, dot pagination |
 *
 * @deprecated A single-value type that selects nothing. Kept so 1.x code
 * compiles; removed in 2.0 together with the free `variant` input.
 */
export type TourVariant = 'modal';

/** Preferred tooltip / popover placement relative to the target element. */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/**
 * A single step in a tour.
 *
 * The free `modal` variant uses `title`, `content`, `imageUrl`, `icon`, `tag`,
 * `tagColor`, `actionLabel` and `actionUrl`. The positioning fields
 * (`targetSelector`, `placement`) and behaviour flags (`completable`,
 * `initiallyCompleted`, `accentColor`) are consumed by the Pro-only variants
 * and are kept here so step data stays interchangeable when upgrading.
 */
export interface TourStep {
  /** Unique identifier — used as a key and for checklist completion tracking. */
  readonly id: string;
  /** Short heading shown in all variants. */
  readonly title: string;
  /** Body copy — HTML is NOT supported (XSS safe). Use `\n` for line breaks. */
  readonly content: string;

  // ── Positioned variants (Pro) ────────────────────────────────────────────

  /** CSS selector (`#id`, `.class`, `[data-attr]`) that identifies the target element. */
  readonly targetSelector?: string;

  /**
   * What to do when this step's `targetSelector` never arrives
   * (`OF-13-I1`, `OF-13-M1`). @default 'center'
   *
   * ★★★ THE TWO ANSWERS ARE NOT INTERCHANGEABLE, WHICH IS WHY IT IS PER STEP.
   *     `'center'` keeps the step and shows it centred with no cutout — right
   *     when the copy still makes sense on its own ("Your reports live under
   *     Analytics"), and the reason it is the default: dropping a step silently
   *     shortens a tour the host wrote. `'skip'` moves straight on — right
   *     when the step is ABOUT the missing control ("Click Export to download
   *     it"), where a centred card explaining a button that is not there is
   *     worse than no step at all.
   *
   * ★★ `(targetMissing)` FIRES EITHER WAY. The host is the only one that can
   *    tell a feature-flagged control from a broken selector, and that is true
   *    whichever way the tour continues.
   */
  readonly onMissingTarget?: 'center' | 'skip';

  /**
   * How long to wait for THIS step's target, overriding `awaitTargetMs`.
   *
   * ★ One budget cannot fit both: a step behind a route change and a lazy
   *   chunk may need seconds, and a step on the page you are already looking
   *   at should not spend three of them before admitting the control is gone.
   *   `0` means "do not wait at all".
   */
  readonly awaitMs?: number;
  /** Preferred tooltip placement. `'auto'` picks the side with the most space. */
  readonly placement?: TourPlacement;

  // ── Route (`X-13`, `OF-13-I2`) ───────────────────────────────────────────

  /**
   * The route this step's target or subject lives on.
   *
   * The tour never navigates itself: it emits `(routeRequest)` and the host
   * calls its own router. Kept in the free tier because step data must stay
   * interchangeable on upgrade — the WAIT-AND-RE-ANCHOR half that goes with it
   * (`awaitTargetMs`, `(targetMissing)`) belongs to the anchored Pro variants,
   * which the free `modal` tour does not have.
   */
  readonly route?: string;

  // ── Visual enrichment ────────────────────────────────────────────────────

  /** URL of an illustration or screenshot — shown in the `modal` variant. */
  readonly imageUrl?: string;
  /**
   * An emoji (or a short text glyph) shown as the step's icon. Rendered as
   * text, so SVG path data is not supported — it would print as characters.
   * Used in `modal` steps without images.
   */
  readonly icon?: string;
  /**
   * Accent badge text, e.g. `"New"`, `"Pro"`, `"Step 1"`.
   * Shown in the `modal` variant.
   */
  readonly tag?: string;
  /** Tag colour. Defaults to `'blue'`. */
  readonly tagColor?: 'blue' | 'green' | 'purple' | 'amber' | 'rose';

  // ── Behaviour (Pro) ──────────────────────────────────────────────────────

  /** Checklist: whether this item can be manually checked off by the user. */
  readonly completable?: boolean;
  /** Checklist: pre-populate as already completed. */
  readonly initiallyCompleted?: boolean;
  /** `announcement` variant: accent colour of the banner strip. */
  readonly accentColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose';

  // ── CTA ──────────────────────────────────────────────────────────────────

  /** Optional primary CTA button label in the `modal` variant. */
  readonly actionLabel?: string;
  /** Optional URL the CTA opens (blank tab). */
  readonly actionUrl?: string;
}

/**
 * A step wants to be shown on another route (`X-13`, `OF-13-I2`).
 *
 * Emitted by `(routeRequest)` the moment a step with a `route` becomes the
 * current one — including the step the tour opens on. The host navigates; the
 * tour then waits for `step.targetSelector` to appear and anchors to it.
 */
export interface TourRouteRequest {
  /** Index of the step asking. */
  readonly index: number;
  /** The step itself, so a host can branch on its id without an index lookup. */
  readonly step: TourStep;
  /** The step's `route`, non-empty — the event does not fire without one. */
  readonly route: string;
}
