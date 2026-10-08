import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SV_LINK_ADAPTER,
  svCloseOnNavigation,
  svIsModifiedClick,
  svNavRecorder,
  svWarnOnce,
  type SvLinkTarget,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which promise this control makes. See the class note — they are not the same. */
export type BackUpMode = 'back' | 'up';

/** Visual treatment. */
export type BackUpVariant = 'ghost' | 'outline' | 'link';

/** Control size. */
export type BackUpSize = 'sm' | 'md' | 'lg';

/**
 * What the control actually did, which is not always what it was asked to do.
 *
 * ★★ `reason` IS THE OUTPUT'S REASON FOR EXISTING. A `mode="back"` control that
 *    found nothing behind it goes **up** instead, and from outside that is
 *    indistinguishable from a back button that worked — the user asked to go
 *    back and a page appeared. A host that logs navigations, or that wants to
 *    tell the user *"returned to Orders"* rather than *"went back"*, has no
 *    other way to know.
 */
export interface BackUpNavigation {
  /** What happened: history, or a move up the hierarchy. */
  readonly action: 'back' | 'up';
  /** `requested` when it did what `mode` asked; `fallback` when it could not. */
  readonly reason: 'requested' | 'fallback';
  /** The up target, when one was used. `null` for a history move. */
  readonly target: SvLinkTarget | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Back / Up Navigation — `N-4`.
 *
 * ## ★★★ The distinction IS the component
 *
 * **Back is history. Up is hierarchy.** They look identical — an arrow and a
 * word — and they are different promises:
 *
 * | | Back | Up |
 * |---|---|---|
 * | Destination | wherever the user came from | the parent of this page |
 * | Known in advance? | no | yes, always |
 * | May leave the site? | yes | never |
 * | Has a URL? | no | yes |
 * | Element | `<button>` | `<a href>` |
 *
 * The last row falls out of the fourth and is not a style choice. **Up renders a
 * real anchor** — middle-clickable, ⌘-clickable, "copy link address", visible in
 * the status bar — because it has a destination. **Back renders a button**,
 * because "wherever you came from" is not an address: offering *open in new tab*
 * for it would advertise something the browser cannot do.
 *
 * ## ★★ History safety, which is the part to get right
 *
 * A back control on a **deep-linked** page — opened from an email, a chat, a
 * bookmark — has nothing behind it. `history.back()` there does **nothing at
 * all**: no error, no navigation, no feedback. The user presses a visible
 * control and the page sits still, which reads as a broken app rather than as a
 * boundary.
 *
 * So `mode="back"` **falls back to `up`** when the history stack is empty, and
 * says so through {@link navigated}. That is the whole of `N-4`'s "must fall
 * back, not dead-end".
 *
 * ★ **`history.length` is the only honest signal, and it is one-directional.**
 * It counts the whole tab's session history — including pages from other sites —
 * and is never below 1. So `=== 1` genuinely proves there is nothing behind us,
 * and `> 1` proves only that *something* is, which may be a search engine.
 * `stayInSite` is for hosts that need the stronger guarantee; see its note.
 *
 * ## ⚠️ What this deliberately does NOT do
 *
 * **The element does not follow the destination.** A `mode="back"` control that
 * already knows it will fall back is, in every sense that matters, a link to the
 * parent — and rendering it as one would give it the right context menu. It is
 * still a `<button>`, because `history.length` is unreadable on the server: the
 * server would render the anchor, the client would replace it with a button, and
 * hydration would report a mismatch on a control whose whole job is to be
 * dependable. The fallback therefore happens at click time, where it costs
 * nothing.
 *
 * ## Features
 * - Two modes with two elements, chosen by what the control can actually promise
 * - Falls back to the up target rather than dead-ending on an empty history
 * - Routes the up target through `SvLinkAdapter` — no router dependency
 * - Records to the shared navigation stream (`X-15`), including the fallback
 * - 3 variants × 3 sizes, dark-mode ready, no inline SVG
 *
 * @example
 * ```html
 * <!-- The common case: back, with somewhere safe to land. -->
 * <sv-back-up [up]="'/orders'" upLabel="Orders" (navigated)="log($event)" />
 *
 * <!-- A breadcrumb's mobile form: always up, always a real link. -->
 * <sv-back-up mode="up" [up]="['/orders', order.id]" upLabel="Order details" />
 * ```
 */
@Component({
  selector: 'sv-back-up',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './back-up.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvBackUpComponent {
  private readonly links = inject(SV_LINK_ADAPTER);

  /**
   * ★ Navigations seen since this control was created. Zero means every entry
   *   behind us in the session belongs to somebody else — see `stayInSite`.
   */
  private readonly ownNavigations = signal(0);

  /*
   * ── ⚠️ The SPA caveat on `stayInSite`, deliberately NOT a JSDoc ─────────────
   * (The input's JSDoc is lifted verbatim into one docs-table cell.)
   *
   * Both of its "provably ours" signals are weaker in a single-page app than
   * they look:
   *
   *   · `ownNavigations` counts only what THIS INSTANCE has seen, and only what
   *     `svCloseOnNavigation` can see — `popstate`, `hashchange`, and the
   *     `SvNavLocation` seam. A router's `pushState` fires nothing. So a control
   *     that lives inside a routed page (the usual place) is created fresh on
   *     each route and starts at zero, even though the reader arrived by an
   *     in-app navigation.
   *   · `document.referrer` is set by the browser on a full document load and
   *     never changes afterwards. In an SPA it describes how the reader ENTERED
   *     the app — a search engine, an email — not the entry immediately behind
   *     the current one.
   *
   * The consequence is one-directional, and it is the safe direction: in an SPA
   * entered from outside, `stayInSite` goes UP in cases where back would have
   * stayed in the app. It never goes back off-site when it promised not to. A
   * host that wants back to win there can place this control in the persistent
   * shell (so the counter outlives routes) and provide an `SvNavLocation`
   * whose `subscribe` reports the router's navigations.
   */

  constructor() {
    svCloseOnNavigation(() => this.ownNavigations.update((n) => n + 1));
  }

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * What this control promises. `back` returns through history and falls back to
   * {@link up}; `up` always goes to {@link up}. @default 'back'
   */
  mode = input<BackUpMode>('back');

  /**
   * The hierarchical parent — where "up" goes, and where "back" lands when there
   * is no history. **Required in practice**: without it a `back` control has no
   * fallback and can still dead-end, which is the defect this component exists
   * to prevent. Warns once in dev when it is missing. @default null
   */
  up = input<SvLinkTarget | null>(null);

  /**
   * Name of the up destination, used in the visible text and the accessible
   * name — "Back to Orders", "Up to Orders". Without it the control reads as a
   * bare "Back", which tells a screen-reader user nothing about where they will
   * end up. @default ''
   */
  upLabel = input<string>('');

  /**
   * Override the whole visible text. Leave unset to compose it from {@link mode}
   * and {@link upLabel}. @default ''
   */
  label = input<string>('');

  /**
   * Only use history when the previous entry is provably this app's — otherwise
   * go up.
   *
   * ★★ OFF BY DEFAULT, AND THAT IS THE RIGHT DEFAULT FOR A *BACK* CONTROL. Back
   *    meaning "the browser's back", including off the site, is what the word
   *    has always meant and what the hardware button does. Turn this on for a
   *    control that is really *"return to where you were in this app"* — a
   *    wizard's escape hatch, a detail page's return-to-list — where leaving the
   *    site is never the intended answer.
   *
   * ★ "Provably ours" means: this control has observed at least one in-app
   *   navigation since it was created, **or** `document.referrer` is same-origin.
   *   Anything else is treated as not ours, because the failure modes are not
   *   symmetric — going up when back would have worked is a mild surprise;
   *   leaving the site when the user expected to stay is a lost session.
   *
   * ⚠️ In a single-page app both signals are weaker: a router's `pushState` is
   *   not observed, a control inside a routed page starts counting from zero on
   *   each route, and `document.referrer` describes how the reader entered the
   *   app, not the entry behind this one. So it errs towards going up.
   * @default false
   */
  stayInSite = input<boolean>(false);

  /** Visual treatment. @default 'ghost' */
  variant = input<BackUpVariant>('ghost');

  /** Control size. @default 'md' */
  size = input<BackUpSize>('md');

  /** Prevents the control from being used. @default false */
  disabled = input<boolean>(false);

  /**
   * Show only the arrow, keeping the text as the accessible name. Useful in a
   * dense toolbar. @default false
   */
  iconOnly = input<boolean>(false);

  /**
   * Names this control in the shared navigation-analytics stream (`X-15`), when
   * a page has more than one. Ignored unless `provideSvNavTelemetry()` is wired
   * up. @default null
   */
  surfaceId = input<string | null>(null);

  /** Additional CSS classes on the control. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * What the control did. Always emitted, including when the fallback fired —
   * see {@link BackUpNavigation.reason}.
   */
  navigated = output<BackUpNavigation>();

  // ── Analytics (`X-15`) ────────────────────────────────────────────────────

  /**
   * ★★ THE FALLBACK IS THE REASON THIS COMPONENT IS ON THE SHARED STREAM. A
   *    back control that quietly goes somewhere else still produces a page view,
   *    so conventional analytics cannot tell "our back button works" from "our
   *    back button sends people somewhere they did not ask for". Here they are
   *    two different intents: `retreat` when history was used, `jump` when it
   *    was not.
   */
  private readonly nav = svNavRecorder('back-up', () => this.surfaceId());

  // ── Computed ──────────────────────────────────────────────────────────────

  /** The up target as an `href`, or `null` when there is nothing to point at. */
  protected readonly upHref = computed<string | null>(() => {
    const target = this.up();
    return target === null ? null : this.links.href(target);
  });

  /** Visible text. */
  protected readonly text = computed<string>(() => {
    const explicit = this.label();
    if (explicit) return explicit;

    const name = this.upLabel();
    const verb = this.mode() === 'back' ? 'Back' : 'Up';
    return name ? `${verb} to ${name}` : verb;
  });

  /**
   * The glyph. `arrow-left` for back and `arrow-up` for up — the same distinction
   * the modes make, so the two controls are not confusable at a glance in a
   * toolbar that holds both.
   */
  protected readonly iconName = computed<string>(() =>
    this.mode() === 'back' ? 'arrow-left' : 'arrow-up',
  );

  protected readonly controlClasses = computed<string>(() => {
    const sizing = {
      sm: this.iconOnly() ? 'h-7 w-7' : 'h-7 gap-1 px-2 text-xs',
      md: this.iconOnly() ? 'h-9 w-9' : 'h-9 gap-1.5 px-3 text-sm',
      lg: this.iconOnly() ? 'h-11 w-11' : 'h-11 gap-2 px-4 text-base',
    }[this.size()];

    const look = {
      ghost:
        'text-gray-700 hover:bg-gray-100 hover:text-gray-900 ' +
        'dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
      outline:
        'border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900 ' +
        'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-white',
      link:
        'text-primary-600 underline-offset-4 hover:underline ' +
        'dark:text-primary-400',
    }[this.variant()];

    return [
      'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      this.variant() === 'link' ? 'px-0' : '',
      sizing,
      look,
      this.customClass(),
    ]
      .filter(Boolean)
      .join(' ');
  });

  protected readonly iconClasses = computed<string>(() =>
    ({ sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' })[this.size()],
  );

  // ── Interaction ───────────────────────────────────────────────────────────

  /**
   * Is there a history entry this control is willing to return to?
   *
   * ⚠️ NOT A COMPUTED, and not reactive. `history.length` is not observable and
   *    reading it during change detection would make the render depend on
   *    something no signal tracks. It is asked at click time, which is the only
   *    moment the answer has to be right.
   */
  private canGoBack(): boolean {
    if (typeof history === 'undefined') return false;

    // ★ The one reliable reading: a session with a single entry has nothing
    //   behind it, whatever else is true. `> 1` proves only that SOMETHING is.
    if (history.length <= 1) return false;
    if (!this.stayInSite()) return true;

    // We navigated since this control mounted, so the previous entry is ours.
    if (this.ownNavigations() > 0) return true;

    return this.sameOriginReferrer();
  }

  /** Whether the page that linked here was this one's own origin. */
  private sameOriginReferrer(): boolean {
    if (typeof document === 'undefined' || typeof location === 'undefined') return false;
    const referrer = document.referrer;
    if (!referrer) return false;
    try {
      return new URL(referrer).origin === location.origin;
    } catch {
      // A referrer we cannot parse is a referrer we cannot vouch for.
      return false;
    }
  }

  /** The `<button>`'s handler — `mode="back"`. */
  protected onBack(): void {
    if (this.disabled()) return;

    if (this.canGoBack()) {
      this.nav.record({ intent: 'retreat', label: this.text() });
      this.navigated.emit({ action: 'back', reason: 'requested', target: null });
      history.back();
      return;
    }

    this.goUp('fallback');
  }

  /**
   * The `<a>`'s handler — `mode="up"`.
   *
   * ★ **The browser's navigation is cancelled exactly when the adapter says it
   *   took it**, which is the rule `NV-07-I12` made a principle: one event, one
   *   navigation. With no adapter wired up the anchor is simply followed, and a
   *   modified click (⌘, middle, Shift) is never intercepted — that gesture
   *   means "open this somewhere else", and the only correct answer is to let
   *   the browser do it.
   */
  protected onUpClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      return;
    }
    if (svIsModifiedClick(event)) return;

    const target = this.up();
    if (target === null) return;

    if (this.links.navigate(target)) event.preventDefault();
    this.report('up', 'requested', target);
  }

  /** Go to the up target, by whichever route got us here. */
  private goUp(reason: BackUpNavigation['reason']): void {
    const target = this.up();
    if (target === null) {
      svWarnOnce(
        'sv-back-up/no-up-target',
        '<sv-back-up> was asked to go back with an empty history stack and has no [up] ' +
          'target to fall back to, so nothing happened — which is the dead end N-4 exists ' +
          'to prevent. Give it the page one level up in the hierarchy; a back control on a ' +
          'deep-linkable page always needs one.',
      );
      return;
    }

    this.follow(target);
    this.report('up', reason, target);
  }

  /**
   * Navigate through the adapter, and when it declines, load the adapter's own
   * `href`.
   *
   * ★ The fallback is a `<button>`, not an anchor, so there is no browser
   *   navigation to fall back on. Under the default `svHrefLinkAdapter` —
   *   which renders hrefs and navigates nothing — `navigate` returns `false`,
   *   and the fallback that exists to prevent a dead end WAS one: nothing
   *   happened, and `navigated` still reported a move up. Assigning the href is
   *   the full page load an anchor would have made. SSR-safe: a server has no
   *   `location` to assign.
   */
  private follow(target: SvLinkTarget): void {
    if (this.links.navigate(target)) return;
    const url = this.links.href(target);
    if (url === null || typeof window === 'undefined') return;
    window.location.assign(url);
  }

  /** One place where both streams are told, so they cannot disagree. */
  private report(
    action: BackUpNavigation['action'],
    reason: BackUpNavigation['reason'],
    target: SvLinkTarget | null,
  ): void {
    this.nav.record({
      intent: 'jump',
      key: target === null ? null : this.links.href(target),
      label: this.text(),
      reason: reason === 'fallback' ? 'history-empty' : null,
    });
    this.navigated.emit({ action, reason, target });
  }
}
