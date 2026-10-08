import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  SvLiveAnnouncer,
  svHighlightSegments,
  svNavParam,
  svRecoverFocus,
  svUniqueId,
  svWarnOnce,
  type SvHighlightSegment,
  type SvUnresolvedValue,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Visual presentation style. */
export type AccordionVariant  = 'default' | 'flush' | 'filled';

/** Header + content padding scale. */
export type AccordionSize     = 'sm' | 'md' | 'lg';

/** Whether one or many panels may be open simultaneously. */
export type AccordionExpand   = 'single' | 'multi';

/** Which side the expand/collapse chevron appears on. */
export type AccordionIconPos  = 'left' | 'right';

/** Badge color variant for panel headers. */
export type AccordionBadgeColor =
  | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** The heading element wrapped around each panel header — `h1`…`h6`. */
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Why a panel is open when the user did not open it — `NV-01-M5`.
 *
 * ★★ THIS TYPE IS THE SEAM, and it exists so "why a panel is open" is a
 *    different question from "is it open". A reveal is applied on top of the
 *    user's own open set and can be withdrawn again without touching it, so the
 *    three sections a reader had expanded are still expanded — and only those —
 *    once the search box is cleared.
 *
 * `'print'` is not wired here: the print contract is P2 (`X-20`, `NV-01-I7`,
 * `NV-06-I13`). It is named now so that half arrives as `reveal('print', …)` on
 * `beforeprint` and `withdrawReveal('print')` on `afterprint`, rather than as a
 * second mechanism that has to re-answer the same question.
 */
export type AccordionRevealSource = 'search' | 'print' | 'programmatic';

/** What opened or closed a panel. */
export type AccordionToggleSource = 'user' | 'find-in-page';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/** Describes a single accordion panel. */
export interface AccordionItem {
  /** Unique identifier — used as the open-state key. */
  id: string;
  /** Main header text. */
  title: string;
  /** Body text (plain text). Projected content can be added via template. */
  content: string;
  /** Secondary line beneath the title. */
  subtitle?: string;
  /**
   * Icon-library NAME rendered as a leading icon in the header — e.g.
   * `'settings'`. Was `iconPath`, a raw SVG `<path d="…">`.
   */
  icon?: string;
  /** Small badge label on the right side of the header (before the chevron). */
  badge?: string;
  /** Semantic color of the badge. @default 'neutral' */
  badgeColor?: AccordionBadgeColor;
  /** Prevents the panel from being toggled. @default false */
  disabled?: boolean;
  /** Opens this panel when the component initialises. @default false */
  defaultOpen?: boolean;
}

/** Emitted every time a panel is toggled. */
export interface AccordionToggleEvent {
  id:   string;
  open: boolean;
  /**
   * What performed the toggle. Always populated; optional only so a host's own
   * `AccordionToggleEvent` literals keep compiling.
   *
   * `'find-in-page'` means the BROWSER opened this panel to show a `Ctrl+F`
   * match — see {@link SvAccordionComponent.onBeforeMatch}. A host that
   * persists the open set wants both; a host counting deliberate interactions
   * wants only `'user'`.
   * @default 'user'
   */
  source?: AccordionToggleSource;
}

// ─── Badge palette ────────────────────────────────────────────────────────────

// 700, matching the `primary` and `neutral` rows that were already there: a `-600`
// label on a `-50` fill measures 3.07–4.41:1, so four of these six failed AA while
// their two siblings passed, at the same size, in the same badge.
const BADGE_CLASSES: Record<AccordionBadgeColor, string> = {
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  success: 'bg-accent-50  text-accent-700  dark:bg-accent-500/20  dark:text-accent-400',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400',
  danger:  'bg-danger-50  text-danger-700  dark:bg-danger-500/20  dark:text-danger-400',
  info:    'bg-info-50     text-info-700     dark:bg-info-500/20     dark:text-info-400',
  neutral: 'bg-gray-100   text-gray-600    dark:bg-gray-700       dark:text-gray-300',
};

// ─── Find-in-page capability ──────────────────────────────────────────────────

/** Used when `headingLevel` is not a heading level at all. */
const DEFAULT_HEADING_LEVEL: AccordionHeadingLevel = 3;

/** Nothing is revealed — one shared instance, so the fast paths can compare. */
const NO_IDS: ReadonlySet<string> = new Set<string>();

/**
 * Whether this browser implements `hidden="until-found"` — `NV-01-I8`.
 *
 * ★★ `onbeforematch` IS THE PROBE, and it has to be. `hidden` is an ancient
 *    attribute, so `'hidden' in el` is true in every browser ever shipped and
 *    says nothing about the `until-found` *value*; a browser that does not know
 *    the value treats it as plain `hidden`, i.e. `display: none` — which would
 *    take the panel out of the layout the grid animation depends on and hide the
 *    content from find-in-page anyway. Feature-detecting the event is the only
 *    way to tell those two worlds apart.
 *
 * ⚠️ Read per component INSTANCE, not once at module load. A module constant is
 *    evaluated before a test (or a polyfill) can install the property, and on the
 *    server it would bake `false` into a value the client never re-asks.
 */
function svSupportsUntilFound(): boolean {
  return typeof document !== 'undefined' && 'onbeforematch' in document.documentElement;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AccordionComponent — A fully-featured, accessible expand/collapse panel set.
 *
 * ## Variants
 * | variant    | Description                                                   |
 * |------------|---------------------------------------------------------------|
 * | `default`  | Outer border wrapping all panels with interior dividers       |
 * | `flush`    | No outer border — only horizontal dividers between panels     |
 * | `separated`| Each panel is an independent floating card with shadow        |
 * | `filled`   | Active panel header gets a tinted colour fill                 |
 *
 * ## Features
 * - Single or multi-expand mode
 * - Left or right chevron icon position
 * - Optional custom SVG icon path per panel (leading icon)
 * - Optional subtitle under the header title
 * - Optional badge with 6 semantic colour variants
 * - Disabled panel support
 * - `defaultOpen` per item to pre-open panels
 * - CSS-grid based height animation — no JavaScript height calculation
 * - Keyboard navigation: Enter/Space to toggle, ↑↓ to move focus
 * - ARIA: native `<button>` headers with `aria-expanded`, `aria-disabled`, `aria-controls`
 * - Configurable heading level (`h1`–`h6`) around each header
 * - Collapsed content reachable by browser find-in-page (`hidden="until-found"`)
 * - `searchQuery` reveals and highlights matching panels
 * - Full dark-mode support
 * - 3 sizes: `sm` / `md` / `lg`
 *
 * ## Usage
 * ```html
 * <sv-accordion
 *   [items]="faqItems"
 *   variant="separated"
 *   expandMode="multi"
 *   [size]="'md'"
 * />
 * ```
 */
@Component({
  selector: 'sv-accordion',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, SvIconComponent],
  templateUrl: './accordion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAccordionComponent {
  /**
   * Per-instance id prefix.
   *
   * ★ `acc-header-shipping` was a global literal built from the item's own id.
   * An FAQ page with two accordions — or the same one rendered twice —
   * duplicated every id, so `aria-controls` and `aria-labelledby` resolved into
   * the wrong list and the arrow keys moved focus there too.
   */
  /*
   * ★ `svUniqueId`, not a module-level counter — `X-10` / `T0-2`.
   *
   * The counter this replaced belonged to the MODULE, so a long-lived server
   * process shared it across requests: the second page it rendered emitted
   * `-2-` while the browser, loading the module for the first time, emitted
   * `-1-`. Server HTML and first client render disagreed, which is a hydration
   * mismatch. Reproduced in `core`'s `unique-id.spec.ts` before it was fixed.
   */
  private readonly uid = svUniqueId('sv-accordion');

  /** DOM id of an item's header button. */
  headerDomId(itemId: string): string {
    return `${this.uid}-header-${itemId}`;
  }

  /** DOM id of an item's panel. */
  panelDomId(itemId: string): string {
    return `${this.uid}-panel-${itemId}`;
  }

  private readonly host = inject(ElementRef);
  private readonly announcer = inject(SvLiveAnnouncer);

  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Array of panel definitions. */
  items = input<AccordionItem[]>([]);

  /** Visual style. @default 'default' */
  variant = input<AccordionVariant>('default');

  /** Whether one or many panels can be open at once. @default 'single' */
  expandMode = input<AccordionExpand>('single');

  /** Padding / font scale. @default 'md' */
  size = input<AccordionSize>('md');

  /** Which side the chevron appears on. @default 'right' */
  iconPosition = input<AccordionIconPos>('right');

  /**
   * Icon-library NAME used as the expand/collapse indicator instead of the
   * default chevron (e.g. `'plus'`). Leave empty to use the built-in chevron.
   * When only this is set the glyph rotates 180° on open (good for arrows).
   * Was `customIconPath`, which took a raw `<path d="…">`.
   */
  customIcon = input<string>('');

  /**
   * Optional alternate icon-library NAME shown when the panel is **open**.
   * Set this alongside `customIcon` for a true swap (e.g. plus → minus).
   * When set, rotation is disabled — the glyphs switch instead.
   * Was `customIconOpenPath`.
   */
  customIconOpen = input<string>('');

  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  /*
   * ── Rationale, deliberately NOT a JSDoc (see the note on `urlKey`) ──────────
   *
   * ── ★ Why the type is `number` and not `1 | 2 | 3 | 4 | 5 | 6` ──────────────
   * The level is almost never a literal at the call site. It is `depth + 1`, or
   * a value read from a CMS, or a page-section service's `level()` — all of
   * which are `number`. A union input turns every one of those into a cast, and
   * a cast is precisely how `0`, `7` and `NaN` get in without a diagnostic. So
   * the input takes the wide type and the component checks it, which is the only
   * arrangement where the check can actually run. `form-error-summary` took the
   * union because its heading is authored beside the component; this one is not.
   *
   * ── ★ The header was previously NOT a heading at all, and that is the defect ─
   * `NV-01-I2` names a hard-coded level; at `HEAD` the level was absent. Both
   * fail the same reader in the same way — a screen-reader user navigating by
   * heading (which is how a long FAQ is read) could not find the sections, and
   * the accordion contributed nothing to the document outline. The WAI-ARIA
   * accordion pattern is explicit that each header button is wrapped in a
   * heading element, so this ships ON, with no opt-out: the wrapper is a bare
   * `<h_ class="m-0">` that inherits everything, so nothing moves by a pixel.
   * `3` is the default because an accordion sits under a page title and a
   * section title far more often than it sits at the top of a document.
   */

  /**
   * Heading level of the element wrapped around each panel header — `1`–`6`, so
   * the panels sit correctly in the page outline and can be reached by
   * heading navigation. A value outside `1`–`6` is clamped, with one dev
   * warning. `NV-01-I2`, `NV-01-M6`.
   * @default 3
   */
  headingLevel = input<number>(DEFAULT_HEADING_LEVEL);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── ★★ `inert` WAS THE THING HIDING THE CONTENT FROM `Ctrl+F` ───────────────
   * A collapsed panel was a `0fr` grid row (visual only) plus `inert` on the
   * inner wrapper, and `inert` is specified to be skipped by find-in-page. So
   * the two attributes that made collapsed content safe — out of the tab order,
   * out of the a11y tree — also made it unfindable, and a reader searching for
   * text that is right there on the page concludes the page does not have it.
   *
   * `hidden="until-found"` does all three jobs at once: its content-visibility
   * is `hidden`, so the subtree is not rendered, not focusable and not in the
   * a11y tree — and the ONE exception the spec carves out is find-in-page, which
   * then fires `beforematch` and removes the attribute. That is why `inert` is
   * DROPPED where `until-found` is supported rather than kept alongside it:
   * keeping it would re-close the one door being opened. Where it is not
   * supported, `inert` stays and behaviour is exactly what it is today.
   *
   * ── ★ And a DISABLED panel is deliberately left unfindable ──────────────────
   * The browser reveals a match by deleting the attribute; the component cannot
   * refuse. A panel the user is not allowed to open must therefore not be
   * offered to find-in-page at all, or `Ctrl+F` becomes a way around `disabled`.
   * Same call `syncFromUrl` already makes when it refuses a disabled id.
   */

  /**
   * Let browser find-in-page (`Ctrl+F`) reach the text inside COLLAPSED panels,
   * by marking them `hidden="until-found"` where the browser supports it. The
   * browser expands the panel it matched and the open state follows.
   *
   * Turn it off for content that is meant to stay hidden until asked for — a
   * quiz answer, a spoiler. Disabled panels are never findable.
   * @default true
   */
  findInPage = input<boolean>(true);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── ★★ HIGHLIGHTING IS WHERE ACCORDIONS REACH FOR `innerHTML` ───────────────
   * `content.replace(re, '<mark>$1</mark>')` is the four-line version everyone
   * writes, and it hands a string the component did not author to the HTML
   * parser — `FI-01-I3` shipped exactly that in `sv-autocomplete`. Angular's
   * sanitiser strips scripts, not markup, so `<img src>` in an FAQ answer from a
   * CMS still becomes a request to a host of somebody else's choosing. The kit's
   * answer is `svHighlightSegments` from `@styloviz/core`: runs of text, marked
   * up by the TEMPLATE, with no HTML string anywhere to inject into. See
   * `docs/html-value-security.md` and `projects/core/src/lib/security/highlight.ts`.
   *
   * ── ★ The search does NOT close anything ────────────────────────────────────
   * A query reveals what matches and leaves everything else exactly as the
   * reader left it. Closing non-matching panels would make a keystroke destroy
   * state the user built, and the second keystroke could not put it back.
   *
   * ── ★ A reveal is NOT constrained by `expandMode="single"` ──────────────────
   * Four matches show four panels, the same way `Ctrl+F` highlights four hits.
   * `single` is a rule about what the USER can have open, and `openIds` still
   * holds at most one id throughout — clear the query and the single open panel
   * is the one it was. Revealing only the first match would answer "where is
   * this text" with one third of the answer.
   */

  /**
   * Reveal and highlight the panels whose title, subtitle or body contains this
   * text — `NV-01-M5`. The reveal is transient: clearing the query returns every
   * panel to the state the user left it in, and nothing is written to `openIds`
   * or to the URL. Matching is case-insensitive substring.
   * @default '' — no search
   */
  searchQuery = input<string>('');


  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   * `scripts/generate-component-docs.mjs` lifts an input's JSDoc verbatim into
   * the README's API table and into `/docs`, as ONE table cell, so the reasoning
   * lives in this plain block comment and the consumer-facing sentence stays in
   * the doc comment below. (Plain opener on purpose: a closing-delimiter sequence
   * inside a doc comment ends it early and silently swallows what follows.)
   *
   * A link to one FAQ answer is the whole point of this adoption. Today a support
   * reply can only say "open the Shipping section"; with a key it can link to it.
   *
   * ── Why one key holds a LIST ────────────────────────────────────────────────
   * `expandMode="multi"` means the open state is a set, not a value, so the
   * parameter is comma-separated: `?open=shipping,returns`. Each id is
   * percent-encoded before joining and decoded after splitting — a comma inside a
   * consumer's id would otherwise come back as two ids, and it would come back
   * that way SILENTLY, since `URLSearchParams` decodes `%2C` for us before we
   * ever see the separator. In `single` mode only the first id is honoured; the
   * rest are a URL claiming something the component's own mode forbids.
   *
   * ── The default set is absent, and "nothing open" is NOT the same as absent ──
   * The key is omitted when the open set matches what `defaultOpen` would have
   * produced, because a URL carrying its own defaults is noise that makes two
   * identical pages look like two different ones to analytics and to a cache. But
   * an accordion whose default opens a section, and whose user then closed it, has
   * to be able to say so — otherwise a refresh reopens it. That state writes an
   * EMPTY value, `?open=`, which is a different URL from no key at all and is read
   * back as "the user closed everything".
   *
   * ★ This is the one family whose location may honestly be either kind. Give it
   * `svQueryParamNavLocation()` and the set rides the query string; give it
   * `svHashNavLocation('open')` and a single open section becomes `#shipping` — the
   * thing a reader pastes into a message. The hash holds one slot, so an accordion
   * and an anchor rail on the same page cannot both take it; see the ADR.
   *
   * Writes REPLACE. Opening a section is reading, not navigating, and a reader who
   * skimmed six answers and pressed back means "leave this page" rather than
   * "close the sixth one". `NV-01-I1`, `NV-01-M1`,
   * `docs/navigation-routing-adr.md`.
   */

  /**
   * Put the open sections in the URL under this key, so one answer can be linked
   * to and survives a refresh. Needs `provideSvNavLocation()` at the app root;
   * multiple open sections are comma-separated.
   * @default null — no URL synchronisation
   */
  urlKey = input<string | null>(null);

  // ── Outputs ────────────────────────────────────────────────────────────────

  /**
   * Fires whenever a panel is opened or closed. `source` says what did it —
   * `'user'` for a click or key, `'find-in-page'` when the browser revealed the
   * panel itself. A transient reveal (a search query, `reveal()`) does not fire.
   */
  itemToggled = output<AccordionToggleEvent>();

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── ★ `X-10`: nominal state may be PRUNED, never SUBSTITUTED ────────────────
   * An open set is a set of NAMES, so `sv-pagination`'s correction — replace the
   * value with the nearest valid one — has no meaning here: there is no nearest
   * section. But dropping an id that is provably not in `items` is not a guess,
   * it is a deletion of something known to be absent. **Removing what is
   * certainly gone is knowledge; choosing a replacement is invention.** That is
   * the line, and it is why this family can reconcile while `sv-tabs` cannot.
   *
   * So `NV-01-I5`'s pruning stays, and what this output adds is the half that was
   * missing: the host is told which ids went, rather than watching its bound set
   * change under it for no stated reason.
   *
   * ── And pruning waits for `items` to arrive ─────────────────────────────────
   * An empty `items` is not evidence that an id is gone, it is evidence that
   * nothing has arrived — so the reconciler holds, and this output says
   * `'not-loaded'` rather than silently emptying a restored or deep-linked set.
   */

  /**
   * Emitted when the open set named sections this accordion cannot show —
   * `X-10`, `NV-01-I5`. Carries the set as bound, the set after pruning, and
   * whether `openIds` was written back.
   */
  unresolved = output<SvUnresolvedValue<readonly string[]>>();

  // ── Internal state ─────────────────────────────────────────────────────────

  /**
   * Ids of the currently-open panels (two-way).
   *
   * A `model` (audit item X-6) so the open set can be restored as well as
   * observed: `itemToggled` reports one gesture at a time, and rebuilding `items`
   * with `defaultOpen` only ever affects panels this accordion has not seen — so
   * a host could not reopen the three sections a user had left open before a
   * route change. A bound value wins over `defaultOpen`.
   *
   * ★ This used to be seeded once, in `ngOnInit`, from whatever `items` held at
   * that moment — which for anything fetched is an empty array, so `defaultOpen`
   * was dead API for every async host. `defaultOpen` is now applied only to ids
   * this component has not seen before, so a host that rebuilds its `items`
   * array each change-detection pass cannot reopen a section the user closed.
   */
  readonly openIds = model<Set<string>>(new Set());

  /**
   * Ids `defaultOpen` has already been offered to. "Default" means once — an id
   * that has been seen keeps whatever state the user left it in.
   */
  private readonly seenIds = new Set<string>();

  /**
   * Whether the first reconciliation pass has run; see `openIds`.
   *
   * ★ A **signal**, not a boolean, because `syncToUrl` reads it: the URL must not
   * be written before this component's own default state exists. Written eagerly
   * it publishes `?open=` — "the user closed everything" — for the one flush
   * before `defaultOpen` has been applied, and `syncFromUrl` then reads that back
   * as fact and closes the section the page meant to open. A plain boolean cannot
   * wake the effect when it flips, so the guard would be read once, as `false`,
   * and never again.
   */
  private readonly reconciled = signal(false);

  /**
   * Whether this browser can make collapsed content findable. Read once, at
   * construction — see {@link svSupportsUntilFound}.
   */
  private readonly untilFound = svSupportsUntilFound();

  // ── Heading level (`NV-01-I2`, `NV-01-M6`) ─────────────────────────────────

  /**
   * `headingLevel`, validated. An out-of-range value is a consumer bug the
   * component can see but cannot fix, which is exactly `svWarnOnce`'s job —
   * and it is clamped rather than rendered, because `<h7>` is not an element
   * and `<h0>` is not either: Angular would emit an unknown tag and the
   * accordion would silently stop being navigable by heading, which is the
   * failure this input exists to fix.
   */
  readonly resolvedHeadingLevel = computed<AccordionHeadingLevel>(() => {
    const raw = this.headingLevel();
    const level = Number.isFinite(raw) ? Math.trunc(raw) : Number.NaN;
    if (level >= 1 && level <= 6) return level as AccordionHeadingLevel;

    const clamped: AccordionHeadingLevel = Number.isNaN(level)
      ? DEFAULT_HEADING_LEVEL
      : (Math.min(6, Math.max(1, level)) as AccordionHeadingLevel);
    svWarnOnce(
      `sv-accordion-heading-level:${String(raw)}`,
      `<sv-accordion> headingLevel="${String(raw)}" is not a heading level — ` +
        `HTML has h1–h6. Rendering h${clamped}. Pick the level that follows the ` +
        `heading above the accordion, so the page outline stays valid.`,
    );
    return clamped;
  });

  // ── Reveal registry (`NV-01-M5`, and the seam the P2 print contract reuses) ─

  /**
   * Reveal sets applied by something other than the user, keyed by source.
   *
   * ★ A MAP, not one set. Two sources can hold the same panel open, and a print
   *   pass withdrawing its own reveal must not close the panel a live search is
   *   still holding. Withdrawing by source is the whole reason the key exists.
   */
  private readonly manualReveals =
    signal<ReadonlyMap<AccordionRevealSource, ReadonlySet<string>>>(new Map());

  /**
   * Ids whose reveal the user has explicitly collapsed again, tagged with the
   * reveal they were collapsed out of.
   *
   * ★ Without this a revealed header is a DEAD CONTROL: `openIds` never held the
   *   id, so clicking to close deletes nothing and the reveal reopens the panel
   *   on the next read.
   *
   * ★★ THE TAG, NOT AN EFFECT THAT CLEARS IT. A dismissal belongs to the reveal
   *    it dismissed — the next search is a new question and must not have its
   *    answer suppressed by something the reader did to the previous one. An
   *    effect watching `revealedIds` would do that too, but it would do it at
   *    whatever point in the change-detection pass the effect happens to flush,
   *    which is one frame of the wrong screen away from a visible bug. Comparing
   *    the tag is pure, so there is no ordering to get wrong.
   */
  private readonly dismissedReveals =
    signal<{ readonly forReveal: string; readonly ids: ReadonlySet<string> }>({
      forReveal: '',
      ids: NO_IDS,
    });

  /** The query, trimmed. Empty means "not searching" — not "matches nothing". */
  private readonly query = computed(() => this.searchQuery().trim());

  /** True while a search is active; the template only splits text when it is. */
  readonly searching = computed<boolean>(() => this.query().length > 0);

  /** Ids this component can see are disabled, so reveals can refuse them. */
  private readonly disabledIds = computed<ReadonlySet<string>>(
    () => new Set(this.items().filter(i => i.disabled).map(i => i.id)),
  );

  /** Ids whose title, subtitle or body contains the query. */
  private readonly searchMatches = computed<ReadonlySet<string>>(() => {
    const needle = this.query().toLowerCase();
    if (!needle) return NO_IDS;
    const hits = new Set<string>();
    for (const item of this.items()) {
      const haystack = `${item.title}\n${item.subtitle ?? ''}\n${item.content}`.toLowerCase();
      if (haystack.includes(needle)) hits.add(item.id);
    }
    return hits;
  });

  /**
   * Ids of the panels matching `searchQuery`, in `items` order — so a host can
   * render "3 of 12 sections match" beside its own search box.
   */
  readonly matchedIds = computed<readonly string[]>(() => {
    const hits = this.searchMatches();
    return this.items().filter(i => hits.has(i.id)).map(i => i.id);
  });

  /**
   * Every id currently held open by a reveal rather than by the user. Public so
   * a host can tell the two apart; `openIds` remains the user's own set.
   */
  readonly revealedIds = computed<ReadonlySet<string>>(() => {
    const manual = this.manualReveals();
    const matches = this.searchMatches();
    if (!manual.size) return matches;
    const all = new Set(matches);
    for (const ids of manual.values()) for (const id of ids) all.add(id);
    return all;
  });

  /** Identity of the current reveal, so a dismissal can be tagged with it. */
  private readonly revealKey = computed(() => [...this.revealedIds()].sort().join('\u0000'));

  /** Dismissals that belong to the reveal currently on screen — see the field. */
  private readonly liveDismissals = computed<ReadonlySet<string>>(() => {
    const dismissed = this.dismissedReveals();
    return dismissed.forReveal === this.revealKey() ? dismissed.ids : NO_IDS;
  });

  /**
   * The panels that are open ON SCREEN: the user's own set plus live reveals,
   * minus the reveals the user has collapsed and the panels that are disabled.
   */
  private readonly effectiveOpenIds = computed<ReadonlySet<string>>(() => {
    const own = this.openIds();
    const revealed = this.revealedIds();
    if (!revealed.size) return own;

    const dismissed = this.liveDismissals();
    const disabled = this.disabledIds();
    const all = new Set(own);
    for (const id of revealed) {
      if (!dismissed.has(id) && !disabled.has(id)) all.add(id);
    }
    return all;
  });

  /**
   * Hold `ids` open on behalf of `source`, on top of whatever the user has open.
   *
   * ★★ THIS IS THE SEAM THE P2 PRINT CONTRACT REUSES (`X-20`, `NV-01-I7`,
   *    `NV-06-I13`): `reveal('print', allIds)` on `beforeprint`,
   *    `withdrawReveal('print')` on `afterprint`, and the reader's own expansion
   *    state is intact afterwards because it was never touched. Nothing here
   *    writes `openIds`, emits `itemToggled` or touches the URL — a reveal is
   *    not a state change, it is a temporary view of one.
   */
  reveal(source: AccordionRevealSource, ids: Iterable<string>): void {
    const next = new Map(this.manualReveals());
    next.set(source, new Set(ids));
    this.manualReveals.set(next);
  }

  /** Drop `source`'s reveal. Panels another source still holds stay open. */
  withdrawReveal(source: AccordionRevealSource): void {
    if (!this.manualReveals().has(source)) return;
    const next = new Map(this.manualReveals());
    next.delete(source);
    this.manualReveals.set(next);
  }

  /** Split `text` into safe segments for the template to `<mark>`. */
  highlight(text: string): readonly SvHighlightSegment[] {
    return svHighlightSegments(text, this.query());
  }

  // ── The collapsed panel's two attributes (`NV-01-I8`) ──────────────────────

  /** True when a collapsed panel should be offered to find-in-page. */
  private findable(item: AccordionItem): boolean {
    return this.untilFound && this.findInPage() && !item.disabled;
  }

  /**
   * `'until-found'` on a collapsed, findable panel — otherwise no `hidden` at
   * all. Never `''`: plain `hidden` is `display: none`, which would remove the
   * element the grid animation animates.
   */
  panelHidden(item: AccordionItem): 'until-found' | null {
    return !this.isOpen(item.id) && this.findable(item) ? 'until-found' : null;
  }

  /**
   * `inert` on a collapsed panel — unless `hidden="until-found"` is doing the
   * job instead, in which case `inert` would re-hide the content from the one
   * feature it is being revealed to. Exactly one of the two is ever present.
   */
  panelInert(item: AccordionItem): '' | null {
    if (this.isOpen(item.id)) return null;
    return this.findable(item) ? null : '';
  }

  /**
   * The browser has opened this panel to show a find-in-page match.
   *
   * ★★ THE PANEL IS OPENING WHETHER OR NOT THIS AGREES. The HTML spec's
   *    ancestor-revealing algorithm fires `beforematch` and THEN removes the
   *    `hidden` attribute itself, in the same task — the event is a notice,
   *    not a request, and it cannot be cancelled. Refusing would leave
   *    revealed content under a header reading `aria-expanded="false"`, with
   *    the component's state and its own DOM permanently disagreeing. So the only coherent answer is to adopt it as a
   *    real expansion: `openIds` gains the id, `itemToggled` says who did it,
   *    and every downstream consumer — the URL, the chevron, the host's
   *    persistence — follows as if it had been clicked.
   *
   * `expandMode="single"` is honoured, because this *is* a user-driven
   * expansion: the previously open panel closes, as it would on a click.
   */
  protected onBeforeMatch(item: AccordionItem): void {
    if (this.isOpen(item.id)) return;

    const next = this.expandMode() === 'single'
      ? new Set([item.id])
      : new Set(this.openIds()).add(item.id);

    this.preservingFocus(() => this.openIds.set(next));
    this.itemToggled.emit({ id: item.id, open: true, source: 'find-in-page' });
  }

  constructor() {
    // A search silently expanding panels is a visual change a screen-reader
    // user gets no notice of, so the count is announced — keyed and throttled,
    // because this fires on every keystroke and a backlog of stale counts is
    // worse than none. `force` is on: two searches that both match three
    // sections are two different answers, and the second has to be heard.
    effect(() => {
      const q = this.query();
      const count = this.matchedIds().length;
      untracked(() => {
        if (!q) return;
        this.announcer.announce(
          count === 0
            ? `No sections match ${q}.`
            : `${count} section${count === 1 ? '' : 's'} match ${q}.`,
          { key: `${this.uid}-search`, throttleMs: 400, force: true },
        );
      });
    });


    // Reconcile the open set with each new `items` array: drop ids that have gone
    // and offer `defaultOpen` to ids not seen before. This was a `linkedSignal`
    // keyed on `items`, whose `previous.source` carried the "already seen" set;
    // an effect does the same work now that the open set is a `model` a host can
    // write to, which a `linkedSignal` cannot be.
    effect(() => {
      const items = this.items();
      untracked(() => {
        const open = new Set(this.openIds());
        const live = new Set(items.map(i => i.id));
        const fresh = items.filter(i => !this.seenIds.has(i.id));
        for (const item of items) this.seenIds.add(item.id);

        // On the very first pass a non-empty set can only have come from the
        // host, and a bound value outranks the data's own defaults — those are a
        // default for a fresh view, not an instruction to discard a restored one.
        //
        // ★ A URL holding the key outranks them the same way, and it has to be
        // asked about SEPARATELY: `?open=` — the user closed the section this page
        // opens by default — arrives as an EMPTY set, which is indistinguishable
        // from "no host value" by size alone. Without this the URL would say
        // nothing-open, `defaultOpen` would reopen the section, and the one state a
        // reader took an action to reach would be the one state unreachable by link.
        const urlHolds = this.openParam.value() !== null;
        const honourDefaults = !(!this.reconciled() && (open.size > 0 || urlHolds));
        this.reconciled.set(true);

        let changed = false;
        // ★ An EMPTY `items` is not evidence that an id has gone — it is evidence
        // that nothing has arrived. Pruning against it wipes a restored or
        // deep-linked open set before the data that justifies it exists, which is
        // the same trap `sv-pagination` avoids by not clamping against a total it
        // does not have yet. Reconciling a held id against a list that really did
        // shrink is still `NV-01-I5` / `X-10`, and is not decided here.
        if (items.length) {
          const dropped: string[] = [];
          for (const id of [...open]) {
            if (!live.has(id)) { open.delete(id); dropped.push(id); changed = true; }
          }
          // ★ Pruned AND reported. A bound set changing under the host with no
          //   stated reason is the silent half `X-10` objects to.
          if (dropped.length) {
            this.reportUnresolved([...this.openIds()], [...open], 'unknown', true);
          } else {
            this.clearUnresolved();
          }
        } else if (open.size) {
          // Held, not pruned — and said so. See the note on `unresolved`.
          const held = [...open];
          this.reportUnresolved(held, held, 'not-loaded', false);
        }

        if (honourDefaults) {
          for (const item of fresh) {
            if (!item.defaultOpen || item.disabled) continue;
            if (this.expandMode() === 'single') {
              open.clear();
              open.add(item.id);
              changed = true;
              break;
            }
            open.add(item.id);
            changed = true;
          }
        }

        if (changed) this.openIds.set(open);
      });
    });
  }


  // ── URL synchronisation ─────────────────────────────────────────────────────

  /**
   * The open set this accordion shows with no URL at all — what `defaultOpen`
   * produces. `syncToUrl` compares against it so the default state leaves the URL
   * untouched.
   */
  private readonly defaultOpenIds = computed<string[]>(() => {
    const openable = this.items().filter(i => i.defaultOpen && !i.disabled);
    const ids = openable.map(i => i.id);
    return this.expandMode() === 'single' ? ids.slice(0, 1) : ids;
  });

  /**
   * The open set's projection into the URL. Inert until `urlKey` is set *and* the
   * app provided a location — see {@link urlKey}.
   */
  private readonly openParam = svNavParam(() => this.urlKey());

  /**
   * URL → component. The deep-link and address-bar path.
   *
   * ★ **Ids absent from `items()` are kept, not dropped.** Validating membership
   * looks obviously right and loses every deep link in an accordion whose sections
   * arrive from a request: `items()` is `[]` at first render, so *every* id is
   * unknown at the moment the URL is read. Third adoption to make this call, after
   * `sv-pagination` refusing to clamp against a total it does not have yet and
   * `sv-tabs` accepting a tab id its definitions do not name — **validate the
   * value's form, never its membership of a collection that may not have arrived.**
   *
   * A section this component *can* see is disabled is refused, because refusing
   * what is known to be refusable keeps a URL out of a panel the UI has closed.
   */
  protected readonly syncFromUrl = effect(() => {
    const raw = this.openParam.value();
    if (raw === null) return;

    const items = this.items();
    const single = this.expandMode() === 'single';

    const decoded = raw
      .split(',')
      .map(part => { try { return decodeURIComponent(part.trim()); } catch { return part.trim(); } })
      .filter(Boolean)
      .filter(id => !items.find(i => i.id === id)?.disabled);

    const next = single ? decoded.slice(0, 1) : decoded;

    untracked(() => {
      const current = this.openIds();
      // The first URL read is the deep link, whether or not it changes anything.
      const deepLink = !this.deepLinkHandled;
      this.deepLinkHandled = true;
      if (next.length === current.size && next.every(id => current.has(id))) return;
      // ★ `NV-01-I4`: back/forward can collapse the panel the reader is in.
      this.preservingFocus(() => this.openIds.set(new Set(next)));

      // ★ `NV-01-M1`: the FIRST URL-driven open is a deep link, and a deep link
      //   that opens a section below the fold without bringing it on screen
      //   looks exactly like a link that did nothing — the id is
      //   `${uid}-panel-<id>`, so the browser's own `#fragment` scroll can never
      //   find it. Later URL changes (back/forward) are the reader moving
      //   through their own history, so they are left where they are.
      const opened = next.find(id => !current.has(id));
      if (deepLink && opened !== undefined) this.pendingScrollId.set(opened);
    });
  });

  /** Whether the first URL-driven open has been seen — see `syncFromUrl`. */
  private deepLinkHandled = false;

  /** The header a deep link asked to bring on screen, until it has rendered. */
  private readonly pendingScrollId = signal<string | null>(null);

  /**
   * Scroll the deep-linked section's header into view once it exists.
   *
   * ★ An after-render effect, not a one-shot: in an accordion whose sections
   *   arrive from a request, the URL is read while `items` is still `[]`, so
   *   the header does not exist on the first render and has to be waited for.
   *   It is also browser-only by construction — after-render hooks do not run
   *   during SSR, where there is no viewport to scroll.
   */
  protected readonly scrollToDeepLink = afterRenderEffect(() => {
    const id = this.pendingScrollId();
    this.items();
    if (id === null) return;

    const header = (this.host.nativeElement as HTMLElement)
      .querySelector<HTMLElement>(`[id="${this.headerDomId(id)}"]`);
    if (!header) return;

    this.pendingScrollId.set(null);
    // jsdom and some embedded engines have no `scrollIntoView`.
    if (typeof header.scrollIntoView === 'function') header.scrollIntoView({ block: 'start' });
  });

  /*
   * ── `NV-01-I4` / `NV-01-M3`: EVERY collapse can swallow focus ──────────────
   * The first fix only asked about the panel being toggled. In `single` mode
   * opening B closes A — and if focus was inside A, it dropped to `<body>` all
   * the same. A back button that rewrites `?open=`, and a host writing
   * `openIds`, collapse panels the same way without passing through `toggle`.
   *
   * So the question is asked of whichever open panel holds focus, before any
   * change, and answered after it: if that panel is no longer open, focus goes
   * to ITS header — `NV-01-M3`'s policy, the control that reopens it.
   *
   * ★ Two paths, one rule. The component's own writes (`toggle`, find-in-page,
   *   URL sync) wrap the write in `preservingFocus`, which is synchronous and
   *   so does not depend on when anything renders. A host's `openIds` binding
   *   arrives without passing through any of them, so `recoverFromCollapse`
   *   watches the effective open set; component effects run during change
   *   detection BEFORE this component's template is refreshed, so the panel is
   *   still un-`inert` and still holds focus when it is asked. When one of the
   *   wrapped writes has already moved focus to the header, the effect finds
   *   nothing inside the panel and does nothing.
   */

  /** The open panel that holds focus right now, if any. */
  private openPanelHoldingFocus(): AccordionItem | null {
    const hostEl = this.host.nativeElement as HTMLElement;
    // The HOST's document, not the global one — correct in an iframe, and
    // SSR-safe (the server document has no active element).
    const active = hostEl.ownerDocument?.activeElement;
    if (!active || !hostEl.contains(active)) return null;
    for (const item of this.items()) {
      if (!this.isOpen(item.id)) continue;
      const panel = hostEl.querySelector(`[id="${this.panelDomId(item.id)}"]`);
      if (panel?.contains(active)) return item;
    }
    return null;
  }

  /** Run `mutate`; if the panel that held focus is closed by it, rescue focus. */
  private preservingFocus(mutate: () => void): void {
    const holder = this.openPanelHoldingFocus();
    mutate();
    if (holder && !this.isOpen(holder.id)) this.returnFocusToHeader(holder);
  }

  /** `NV-01-M3`'s policy: the collapsed panel's OWN header, never `<body>`. */
  private returnFocusToHeader(item: AccordionItem): void {
    svRecoverFocus({
      to: [
        (this.host.nativeElement as HTMLElement)
          .querySelector<HTMLElement>(`[id="${this.headerDomId(item.id)}"]`),
      ],
      fallback: this.host.nativeElement as HTMLElement,
      announce: `${item.title} collapsed.`,
      announcer: this.announcer,
    });
  }

  /** The effective open set as of the last `recoverFromCollapse` run. */
  private previousOpenIds: ReadonlySet<string> = NO_IDS;

  /** Collapses nobody wrapped — a host's `openIds` write. See the note above. */
  protected readonly recoverFromCollapse = effect(() => {
    const open = this.effectiveOpenIds();
    untracked(() => {
      const before = this.previousOpenIds;
      this.previousOpenIds = open;
      const hostEl = this.host.nativeElement as HTMLElement;
      const active = hostEl.ownerDocument?.activeElement;
      if (!active || !hostEl.contains(active)) return;
      for (const id of before) {
        if (open.has(id)) continue;
        const panel = hostEl.querySelector(`[id="${this.panelDomId(id)}"]`);
        const item = this.items().find(i => i.id === id);
        if (item && panel?.contains(active)) {
          this.returnFocusToHeader(item);
          return;
        }
      }
    });
  });

  /**
   * Component → URL.
   *
   * Three outcomes, and the third is the one that is easy to miss: the default set
   * removes the key, any other set writes it, and an empty set that is *not* the
   * default writes an empty value — `?open=` — because "the user closed the
   * section this page opens by default" has to survive a refresh too.
   */
  protected readonly syncToUrl = effect(() => {
    const open = [...this.openIds()];
    const ready = this.reconciled();

    untracked(() => {
      // Nothing is published until `defaultOpen` has had its pass — otherwise the
      // one flush before it runs looks exactly like "the user closed everything".
      if (!ready) return;
      if (!this.openParam.addressable()) return;

      // ★ Read UNTRACKED. Tracked, a later `items` arrival that introduces a
      // `defaultOpen` would re-run this while the open set is still empty, and the
      // empty set would again be published as a deliberate choice — the same
      // defect as the unguarded first flush, arriving one request later.
      const defaults = this.defaultOpenIds();
      const isDefault =
        open.length === defaults.length && open.every(id => defaults.includes(id));
      const next = isDefault ? null : open.map(encodeURIComponent).join(',');

      if (this.openParam.value() !== next) this.openParam.set(next);
    });
  });


  // ── Controlled-value reconciliation (`X-10`) ──────────────────────────────

  /** The last state reported, so a re-render is not a new event. */
  private lastUnresolved: string | null = null;

  private reportUnresolved(
    requested: readonly string[],
    rendered: readonly string[],
    reason: SvUnresolvedValue<readonly string[]>['reason'],
    corrected: boolean,
  ): void {
    const key = `${[...requested].sort().join(',')}|${[...rendered].sort().join(',')}|${reason}`;
    if (key === this.lastUnresolved) return;
    this.lastUnresolved = key;
    this.unresolved.emit({ requested, rendered, reason, corrected });
  }

  private clearUnresolved(): void {
    this.lastUnresolved = null;
  }

  // ── Public queries ─────────────────────────────────────────────────────────

  /**
   * Whether the panel is open on screen — the user's own set OR a live reveal.
   *
   * ★ Deliberately the effective state and not `openIds`, because everything
   *   reading this is describing what is rendered: `aria-expanded`, the chevron
   *   rotation, the `inert`/`hidden` pair. A panel a search has revealed is
   *   open, and a header claiming otherwise is a lie to a screen reader.
   */
  isOpen(id: string): boolean {
    return this.effectiveOpenIds().has(id);
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  toggle(item: AccordionItem): void {
    if (item.disabled) return;

    const current = new Set(this.openIds());
    // The EFFECTIVE state, so a panel a reveal is holding open closes on the
    // first click rather than needing two — see `dismissedReveals`.
    const wasOpen = this.isOpen(item.id);
    const revealed = this.revealedIds().has(item.id);

    // ★ `NV-01-I4`: collapsing a panel that CONTAINS focus drops it to `<body>`,
    //   which is focus at the top of the document — so the next Tab goes to the
    //   site's first link and the reader is returned to the start of the page
    //   from a section they were reading. Captured before the state changes,
    //   because afterwards the panel is closed and the question cannot be asked.
    //   ANY open panel, not only this one: in `single` mode opening this panel
    //   closes another, which may be the one holding focus.
    const holder = this.openPanelHoldingFocus();

    if (this.expandMode() === 'single') {
      current.clear();
      if (!wasOpen) current.add(item.id);
    } else {
      if (wasOpen) { current.delete(item.id); } else { current.add(item.id); }
    }

    // ★ A reveal outranks `openIds`, so closing a revealed panel has to say so
    //   HERE as well: deleting an id `openIds` never held is a no-op, and the
    //   union would reopen the panel on the very next read. Reopening it by hand
    //   clears the dismissal again, so the pair cannot get stuck.
    if (revealed) {
      const ids = new Set(this.liveDismissals());
      if (wasOpen) ids.add(item.id); else ids.delete(item.id);
      this.dismissedReveals.set({ forReveal: this.revealKey(), ids });
    }

    this.openIds.set(current);
    this.itemToggled.emit({ id: item.id, open: !wasOpen, source: 'user' });

    // ★ `NV-01-M3`'s policy: the collapsed panel's OWN header. Not the next
    //   one, not the list — the header is the thing that just collapsed, it is
    //   adjacent to where the reader was, and it is the control that reopens it
    //   if collapsing was a mistake. Synchronous because this component owns the
    //   collapse; no host re-render has to land first.
    if (holder && !this.isOpen(holder.id)) this.returnFocusToHeader(holder);
  }

  onKeydown(event: KeyboardEvent, item: AccordionItem, _index: number): void {
    const items = this.items().filter(i => !i.disabled);
    // ★ EQUIVALENT MUTANT — deleting this early return changes no observable
    // behaviour, and no test can be written that catches it. `items` is empty
    // only when EVERY item is disabled, and in that state each arm below is
    // already inert: Enter/Space reach `toggle`, which returns on
    // `item.disabled`; ArrowDown/Up index an empty array and fail their own
    // `if (next)` / `if (prev)`; Home/End fail their own `if (items.length)`.
    // This guard and those four are mutually redundant belt-and-braces — which
    // is also why THEIR else-branches are unreachable while this line stands.
    // Both halves are kept; the pair is counted as unreachable, not uncovered.
    if (!items.length) return;
    const currentIndex = items.findIndex(i => i.id === item.id);

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggle(item);
        break;
      // Both ends wrap — the same contract as sv-tabs, sv-radio-group and
      // sv-speed-dial.
      // ★ FOUR UNREACHABLE ELSE-BRANCHES BELOW. `if (next)`, `if (prev)` and
      // both `if (items.length)` can never be false here, and no test can
      // cover their else side:
      //   • `items` is non-empty — the guard at the top of this method returns
      //     early otherwise.
      //   • the two modulo expressions always land inside a non-empty array,
      //     including when `currentIndex` is -1 (the focused header is the
      //     disabled one, which `items` filtered out): (-1+1)%n = 0, and
      //     (-1-1+n)%n = n-2 for n>=2 and -0 for n=1 — every one a valid index.
      // `noUncheckedIndexedAccess` is off, so TypeScript does not require them
      // either. They are kept as belt-and-braces rather than removed, and are
      // counted as unreachable rather than as missing coverage.
      case 'ArrowDown': {
        event.preventDefault();
        const next = items[(currentIndex + 1) % items.length];
        if (next) this.focusHeader(next.id);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        if (prev) this.focusHeader(prev.id);
        break;
      }
      case 'Home': {
        event.preventDefault();
        if (items.length) this.focusHeader(items[0].id);
        break;
      }
      case 'End': {
        event.preventDefault();
        if (items.length) this.focusHeader(items[items.length - 1].id);
        break;
      }
    }
  }

  /**
   * Scoped to this component's own element: `document.getElementById` finds
   * whichever accordion comes first in the document, which is how arrowing in
   * the second one used to move focus into the first.
   */
  private focusHeader(id: string): void {
    (this.host.nativeElement as HTMLElement)
      .querySelector<HTMLElement>(`[id="${this.headerDomId(id)}"]`)
      ?.focus();
  }

  // ── CSS class helpers ──────────────────────────────────────────────────────

  readonly rootClasses = computed(() => {
    const v = this.variant();
    const base = 'w-full';
    const separated = '';
    const bordered =
      v === 'default' || v === 'filled'
        ? 'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-200 dark:divide-gray-700'
        : v === 'flush'
        ? 'divide-y divide-gray-200 dark:divide-gray-700'
        : '';
    return [base, separated, bordered, this.customClass()].filter(Boolean).join(' ');
  });

  itemWrapperClass(_item: AccordionItem): string {
    return '';
  }

  headerClasses(item: AccordionItem): string {
    const v = this.variant();
    const s = this.size();
    const open = this.isOpen(item.id);

    const padding =
      s === 'sm' ? 'px-4 py-2.5' :
      s === 'lg' ? 'px-6 py-5'   :
                   'px-5 py-4';

    const base = [
      'w-full flex items-center gap-3 text-left select-none',
      'transition-colors duration-150 focus-visible:outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset',
      padding,
    ].join(' ');

    const cursor = item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';

    let bg = '';
    if (v === 'filled') {
      bg = open
        ? 'bg-primary-50 dark:bg-primary-900/30'
        : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800';
    } else {
      bg = item.disabled
        ? 'bg-white dark:bg-gray-900'
        : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60';
    }

    return [base, cursor, bg].join(' ');
  }

  titleClasses(item: AccordionItem): string {
    const s = this.size();
    const open = this.isOpen(item.id);
    const size =
      s === 'sm' ? 'text-sm'   :
      s === 'lg' ? 'text-base' :
                   'text-sm';

    return [
      size,
      'font-semibold leading-snug tracking-tight',
      open
        ? 'text-primary-600 dark:text-primary-400'
        : 'text-gray-900 dark:text-gray-100',
    ].join(' ');
  }

  subtitleClasses(): string {
    const s = this.size();
    return [
      s === 'sm' ? 'text-[11px]' : 'text-xs',
      // gray-600, not the 500 this kit uses for secondary ink on white: an
      // expanded header is `bg-primary-50` (`headerClasses`, the `filled`
      // branch), and gray-500 reads
      // 4.44:1 on it against 4.84:1 on white. gray-600 is 6.94:1 there.
      'mt-0.5 text-gray-600 dark:text-gray-400 leading-none',
    ].join(' ');
  }

  contentClasses(): string {
    const s = this.size();
    const padding =
      s === 'sm' ? 'px-4 pt-2 pb-4'  :
      s === 'lg' ? 'px-6 pt-4 pb-7'  :
                   'px-5 pt-3 pb-6';
    return [
      padding,
      'text-sm text-gray-600 dark:text-gray-400 leading-relaxed',
      'bg-white dark:bg-gray-900',
    ].join(' ');
  }

  badgeClass(color: AccordionBadgeColor = 'neutral'): string {
    return [
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none',
      BADGE_CLASSES[color],
    ].join(' ');
  }

  /**
   * Classes for the CUSTOM expand/collapse glyph.
   *
   * ★ The rotation lives here, not in the template's class string. Inlining it
   * during the icon sweep dropped `rotate-180` from this branch entirely, so a
   * host that set only `customIcon` got a glyph that never moved — the exact
   * case the `customIconOpen` docs contrast against. Rotation is suppressed
   * when an open glyph IS supplied, because a plus that becomes a minus should
   * not also spin.
   */
  customIconClasses(item: AccordionItem): string {
    return [
      'shrink-0 w-4 h-4 transition-transform duration-200',
      this.isOpen(item.id) && !this.customIconOpen() ? 'rotate-180' : 'rotate-0',
      this.isOpen(item.id)
        ? 'text-primary-500 dark:text-primary-400'
        : 'text-gray-500 dark:text-gray-400',
    ].join(' ');
  }

  chevronClasses(item: AccordionItem): string {
    return [
      'shrink-0 w-4 h-4 transition-transform duration-200',
      this.isOpen(item.id) ? 'rotate-180' : 'rotate-0',
      this.isOpen(item.id)
        ? 'text-primary-500 dark:text-primary-400'
        : 'text-gray-500 dark:text-gray-400',
    ].join(' ');
  }

  leadingIconClasses(item: AccordionItem): string {
    return [
      'shrink-0 w-4 h-4',
      this.isOpen(item.id)
        ? 'text-primary-500 dark:text-primary-400'
        : 'text-gray-500 dark:text-gray-400',
    ].join(' ');
  }

  panelClasses(): string {
    return 'grid transition-[grid-template-rows] duration-250 ease-in-out';
  }
}
