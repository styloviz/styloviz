import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  afterRenderEffect,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons/core';
import { type SvUnresolvedValue } from '@styloviz/core/data';
import { svWarnOnce } from '@styloviz/core/dev';
import { injectSvLabels } from '@styloviz/core/i18n';
import { svElementSize } from '@styloviz/core/layout';
import { svNavParam, type SvNavWriteMode, svIsModifiedClick, svFragmentHref } from '@styloviz/core/nav';
import { svRecoverFocus } from '@styloviz/core/overlay';
import { svAttrSelector } from '@styloviz/core/security';
import { SV_ANCHOR_LABELS, type SvAnchorLabels } from './anchor.labels';
import { createScrollSpy, type ScrollSpySection } from './scroll-spy';
import type { AnchorActivation } from './activation-strategy';

import { registerAnchorIcons } from './anchor.component.icons';
/** One entry in the nav — `id` must match the `id` attribute of the section it points to. */
export interface AnchorItem {
  readonly id: string;
  readonly label: string;
  /** Sub-sections, listed indented under this one and tracked too (`SR-29`). */
  readonly children?: readonly AnchorItem[];
  /**
   * Indent depth in a FLAT list — 1 for an `<h3>` under an `<h2>`. Ignored
   * inside `children`, where the nesting says it. A jump of more than one
   * level is clamped to one.
   */
  readonly level?: number;
  /** An `@styloviz/icons` name drawn before the label. */
  readonly icon?: string;
  /** Short trailing text — a reading time, a status. */
  readonly meta?: string;
}

export type AnchorOrientation = 'vertical' | 'horizontal';

/**
 * The vertical list's look (`SR-29`): `'rail'` a bordered side rail,
 * `'compact'` the same, tighter; `'minimal'` no rail, the active item in bold;
 * `'card'` a raised card with a filled active item.
 */
export type AnchorAppearance = 'rail' | 'minimal' | 'card' | 'compact';

/**
 * How the rail marks the active item: `'slide'` one marker that moves between
 * items on `transform`; `'border'` each item's own border, as before.
 */
export type AnchorMarker = 'slide' | 'border';

/** Reflect the section being read into `location.hash` with no app provider (`SR-29`). */
export type AnchorHashSync = 'off' | 'auto';

export { SV_ANCHOR_LABELS, type SvAnchorLabels } from './anchor.labels';

/** One item, flattened, with where it sits in the tree. */
export interface SvAnchorRow {
  readonly item: AnchorItem;
  readonly id: string;
  readonly depth: number;
  /** `'2.1'` — the item's outline number. */
  readonly number: string;
  readonly parentId: string | null;
  /** Ids of every ancestor, outermost first. */
  readonly ancestors: readonly string[];
  readonly hasChildren: boolean;
}

/**
 * Flatten nested `children` and flat `level`s into one document-order list
 * with depths, outline numbers and ancestors (`SR-29`).
 */
export function svFlattenAnchorItems(items: readonly AnchorItem[]): SvAnchorRow[] {
  const out: { -readonly [K in keyof SvAnchorRow]: SvAnchorRow[K] }[] = [];
  const counters: number[] = [];
  const stack: string[] = [];
  let prev = -1;
  const visit = (item: AnchorItem, wanted: number): void => {
    const depth = Math.max(0, Math.min(wanted, prev + 1));
    prev = depth;
    counters.length = depth + 1;
    counters[depth] = (counters[depth] ?? 0) + 1;
    stack.length = depth;
    if (out.length && out[out.length - 1].depth < depth) out[out.length - 1].hasChildren = true;
    out.push({
      item,
      id: item.id,
      depth,
      number: counters.join('.'),
      parentId: stack.at(-1) ?? null,
      ancestors: [...stack],
      hasChildren: false,
    });
    stack.push(item.id);
    for (const child of item.children ?? []) visit(child, depth + 1);
  };
  for (const item of items) visit(item, Number.isFinite(item.level) ? Math.trunc(item.level ?? 0) : 0);
  return out;
}

/** A row as the template draws it. */
interface AnchorViewRow extends SvAnchorRow {
  readonly active: boolean;
  /** An ancestor of the active item. */
  readonly trail: boolean;
  readonly open: boolean;
  /** Whether a toggle is drawn — never on the active trail, which stays open. */
  readonly toggleable: boolean;
  readonly linkClass: string;
  readonly toggleText: string;
  /** The page path + `#id` — see `svFragmentHref`. */
  readonly href: string;
}

const INDENT = ['', 'ps-6', 'ps-9', 'ps-12', 'ps-14'] as const;

/**
 * SvAnchorComponent — an "on this page" navigation list that highlights
 * whichever section is currently in view and smooth-scrolls to a section on
 * click.
 *
 * The scrollspy mechanic is `createScrollSpy` (this package) — the same
 * IntersectionObserver logic the showcase's own quick-nav floating menu
 * uses, generalized so both can share it. This component supplies the other
 * half quick-nav has bespoke: turning a plain `{ id, label }[]` into
 * resolved DOM sections (via `document.getElementById`) and rendering a
 * conventional nav list.
 *
 * ```html
 * <sv-anchor
 *   [items]="[
 *     { id: 'installation', label: 'Installation' },
 *     { id: 'usage', label: 'Usage' },
 *     { id: 'api', label: 'API reference' },
 *   ]" />
 * ```
 */
@Component({
  selector: 'sv-anchor',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anchor.component.html',
  // An inline host has no box of its own to lay out in a side rail (`SR-11`).
  host: { class: 'block' },
})
export class SvAnchorComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerAnchorIcons();

  /** The app's labels (`provideSvLabels({ anchor })`) over the English defaults; the `labels` input overrides per instance. */
  private readonly registryLabels = injectSvLabels('anchor', SV_ANCHOR_LABELS);

  /** The sections to list and track, in document order. */
  readonly items = input.required<readonly AnchorItem[]>();

  /** Scroll container the sections live in. `null` = the window/viewport. @default null */
  readonly root = input<HTMLElement | null>(null);

  /** Layout axis. @default 'vertical' */
  readonly orientation = input<AnchorOrientation>('vertical');

  /**
   * Accessible name of the `<nav>` landmark. Two rails on one page need two
   * names, or a screen reader's landmark list shows "On this page" twice.
   * @default 'On this page'
   */
  readonly ariaLabel = input<string>(this.registryLabels.onThisPage);

  /**
   * Extra pixels kept between a jumped-to section and the top of the
   * scroll container — room for a sticky header the section would
   * otherwise land underneath. @default 0
   */
  readonly offset = input<number>(0);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-02-I4`: a number cannot describe a header that changes height ───────
   * `offset` is supported and never observed. A sticky header that shrinks on
   * scroll — the standard pattern — invalidates it the moment the user scrolls,
   * so every jump after the first lands a little wrong, and the error changes as
   * they scroll. Passing the header element instead means the offset is whatever
   * the header currently is.
   *
   * ── ★ It feeds the ACTIVE BAND too, not just the jump ───────────────────────
   * The offset was only ever used by `jumpTo`. But the scrollspy's band is
   * measured from the top of the viewport, so a 64px header means the top 64px of
   * the "active" band is underneath it: a section is marked current while it is
   * still hidden behind the header. Fixing the jump and leaving the band is
   * fixing the half you can see.
   *
   * ── `NV-02-I8`: measured before the page settles ────────────────────────────
   * Sections are resolved once per `items` change. Fonts load, images arrive,
   * `@defer` blocks hydrate — and a section that appears after that first pass is
   * never tracked, while ones that moved were measured against a layout that no
   * longer exists. Watching SIZE catches all three, because every one of them
   * changes it.
   *
   * ★ Two sizes, not one. The scroll container's own box does not grow with its
   *   content — a fixed-height `root`, or an `<html>` pinned to the viewport by
   *   `h-full`, keeps its border box while `scrollHeight` climbs, and
   *   `ResizeObserver` reports boxes, not scroll extents. So the CONTENT is
   *   watched too: `root`'s first child, or `<body>` for the window.
   *
   * ⚠️ The container and the content, not the list. Re-resolving on a change to
   * something this component renders would be the `ResizeObserver` feedback loop
   * `svElementSize` warns about. `NV-02-M4`.
   */

  /**
   * A sticky header to measure instead of using a fixed `offset` — its current
   * height becomes the offset, and follows it as it changes.
   * @default null — use `offset`
   */
  readonly offsetFrom = input<HTMLElement | null>(null);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-02-I1`: the ambiguity was accidental, not chosen ────────────────────
   * "Which section is current" has no correct answer. A short section, two
   * overlapping ones, a section that resizes after paint and a section taller than
   * the viewport each break the intuition that exactly one is current, and the old
   * code answered all four the same way — `threshold: 0` plus "topmost intersecting
   * wins" — without anywhere to say so and no way to choose differently.
   *
   * ── `NV-02-M1`: and the default was the wrong one ───────────────────────────
   * ⚠️ **This changes behaviour.** The old rule activated the first section with a
   * pixel inside the top-third band, which is not "the section you are reading":
   * with the common docs setup, where the rail points at bare `<h2 id>` headings
   * rather than wrappers, the *next* heading entering the bottom of the band
   * activates it while it is still a third of a viewport below the fold, and
   * between two headings the rail holds a stale id because nothing intersects at
   * all. `'last-passed'` flips exactly when a heading crosses the line — the thing
   * a reader means by "I am in this section". Pass `'first-visible'` for the
   * previous answer.
   *
   * ── ★ The band was doing the strategy's job, badly ──────────────────────────
   * `-68%` is not a measurement, it is a guess that approximates "last heading
   * passed" using a rule that cannot express it. With a strategy that can, the band
   * goes back to being what it actually is: the thing that decides when the
   * observer wakes up. It is kept, because the wake-ups it produces land exactly on
   * the crossings `'last-passed'` cares about.
   *
   * ── ★ No second offset ──────────────────────────────────────────────────────
   * `'nearest-offset'` measures against `resolvedOffset()` — the same measured
   * sticky-header height the jump uses. A separate "scrollspy offset" input would
   * be two numbers describing one header, and they would disagree the first time
   * the header resized. `docs/anchor-activation-adr.md`.
   */

  /**
   * Which reading of "current" to highlight: `'last-passed'` (the last heading
   * scrolled past), `'first-visible'`, `'most-visible'`, or `'nearest-offset'`
   * (the heading closest to the sticky-header line).
   * @default 'last-passed'
   */
  readonly activation = input<AnchorActivation>('last-passed');

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   * `scripts/generate-component-docs.mjs` lifts an input's JSDoc verbatim into
   * one table cell, so the reasoning lives here and the consumer sentence stays
   * in the doc comment below. (Plain opener on purpose — a closing-delimiter
   * sequence inside a doc comment ends it early.)
   *
   * ── This family starts from a different place than the other four ───────────
   * `T0` confirmed there is no history pollution to fix: the links are real
   * `href="#id"` anchors, and `scroll-spy.ts` never writes `history`, `location`
   * or `hash`. So the browser already answers three of `X-9`'s four questions —
   * refresh, sharing, and working with no JavaScript at all. **Adopting the seam
   * is not a fix; it is an opt-in for reflecting the SCROLLED position back into
   * the URL**, which is the one thing a plain anchor cannot do.
   *
   * ── Why the hash, and why it is only one section ────────────────────────────
   * Pair this with `svHashNavLocation('section')` and the reader's position is
   * `#installation` — the string somebody pastes into a message. The hash holds
   * one slot, so an anchor rail and a deep-linkable accordion on the same page
   * cannot both take it; one owns it and the other moves to a query parameter.
   * `svQueryParamNavLocation()` works too and is the answer when something else
   * already owns the hash.
   *
   * ── ★ Why the write mode is per WRITE and not per component ─────────────────
   * `NV-02-I3` is the defect this family is named for: a scrollspy that pushes an
   * entry per section fills the back stack until back stops being a way out of
   * the page. So scrolling ALWAYS replaces, and `urlWriteMode` cannot change
   * that — it is not a knob, it is a constraint.
   *
   * But a *click* on "API reference" in this nav is a different event with the
   * same destination: the reader chose to go somewhere, and back meaning "where I
   * was reading" is reasonable. One key, two honest answers, decided by which
   * call site is writing. That is why `SvNavParam.set` grew a per-call mode —
   * nothing about the parameter can distinguish a gesture from a drift.
   *
   * `NV-02-I3`, `NV-02-M2`, `docs/navigation-routing-adr.md`.
   */

  /**
   * Reflect the section being read into the URL under this key — pair it with
   * `svHashNavLocation('section')` for `#installation`. Needs
   * `provideSvNavLocation()` at the app root.
   * @default null — no URL synchronisation
   */
  readonly urlKey = input<string | null>(null);

  /**
   * What a CLICK on a nav link does to history — `'push'` makes back return to
   * the section the reader came from. Scrolling always replaces, whatever this
   * says. @default 'replace'
   */
  readonly urlWriteMode = input<SvNavWriteMode>('replace');

  /**
   * The list's look. Vertical: `'rail'`, `'compact'`, `'minimal'`, `'card'`.
   * Horizontal: `'minimal'` draws plain text tabs instead of pills.
   * @default 'rail'
   */
  readonly appearance = input<AnchorAppearance>('rail');

  /** How the rail marks the active item. @default 'slide' */
  readonly marker = input<AnchorMarker>('slide');

  /** Prefix each item with its outline number — 1, 1.1, 1.2, 2. @default false */
  readonly numbered = input<boolean>(false);

  /**
   * Show sub-sections only under the section being read, plus any the reader
   * opened with the toggle. @default false — every level always shown
   */
  readonly collapsible = input<boolean>(false);

  /**
   * With `collapsible`, the parents the reader opened. The active trail is
   * always open on top of these. @default []
   */
  readonly expandedIds = model<readonly string[]>([]);

  /** A reading-progress bar above the list. @default false */
  readonly progress = input<boolean>(false);

  /**
   * Where a section counts as being read, in px from the top of the scroll
   * container — the activation line, set apart from the jump's `offset`. Null
   * uses the same number as the jump.
   * @default null
   */
  readonly activationOffset = input<number | null>(null);

  /**
   * `'auto'` reflects the section being read into `location.hash`, and jumps
   * to the hash on load, with no `provideSvNavLocation()` — `urlKey` wins when
   * both are set. @default 'off'
   */
  readonly hashSync = input<AnchorHashSync>('off');

  /**
   * Horizontal only: wrap the items onto more lines. `false` keeps one line,
   * for a bar that scrolls sideways (`SR-29`). @default true
   */
  readonly wrap = input<boolean>(true);

  /** Every string the anchor renders. */
  readonly labels = input<Partial<SvAnchorLabels>>({});

  /** How far the container has scrolled, 0–1, whenever it changes. */
  readonly progressChange = output<number>();

  /** Emits whenever the active section changes, including on click-to-jump. */
  readonly activeIdChange = output<string | null>();

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-02-I2`: the rail renders, the link does nothing, nothing reports it ──
   * `items` are resolved with `document.getElementById`, and an id with no
   * element was simply dropped from tracking. The nav still rendered the entry,
   * the `href="#id"` still looked like a link, clicking it did nothing, and the
   * section never lit up. Every symptom points at the scrollspy; the cause is a
   * typo three files away in the page's markup.
   *
   * ★ **Duplicates are the worse half, and the audit named only the missing
   * one.** `getElementById` returns the FIRST match, so a page with two
   * `id="usage"` elements gets a rail that works — it scrolls somewhere, it
   * highlights something — and is wrong. A silent failure is at least visibly
   * broken; a silent wrong answer is not.
   *
   * Two channels, because they answer to different people. `svWarnOnce` is for
   * whoever is looking at the console while building the page, which is where a
   * duplicate id gets fixed. `unresolved` is for the host, which may be
   * generating `items` from a CMS and wants to drop the entry rather than render
   * a dead one. `NV-02-M3` asked for the first; the second is what makes it
   * actionable in an app that did not author its own sections.
   */

  /**
   * Emitted when an item points at a section this page does not have exactly one
   * of — `NV-02-I2`, `NV-02-M3`. `'unknown'` for no element, `'blocked'` for
   * several with the same id.
   */
  readonly unresolved = output<SvUnresolvedValue<string>>();

  private readonly resolved = signal<readonly ScrollSpySection[]>([]);

  /** Every item, nested or not, in document order. */
  readonly rows = computed(() => svFlattenAnchorItems(this.items()));

  private readonly doc = inject(DOCUMENT);

  /** The browser's window; null on the server, where nothing scrolls. */
  private readonly view = isPlatformBrowser(inject(PLATFORM_ID)) ? this.doc.defaultView : null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly navEl = viewChild<ElementRef<HTMLElement>>('nav');

  /** Reading progress of the scroll container, 0–1. */
  readonly readingProgress = signal(0);

  /** Where the sliding marker sits, relative to the list. */
  protected readonly markerBox = signal({ top: 0, height: 0 });

  /** The section the hash named on load, until it has been jumped to. */
  private hashTarget: string | null = null;

  /** The sticky header's live height, or `{0,0}` when none was named. */
  private readonly headerSize = svElementSize(() => this.offsetFrom());

  /**
   * The offset actually applied — measured when a header was named, otherwise
   * the number the consumer gave.
   *
   * Public because a host that passes `offsetFrom` usually needs the same number
   * elsewhere: a matching `scroll-margin-top` on its sections, or a sticky
   * sub-header of its own. Asking it to measure the header a second time would
   * be two observers disagreeing about one value.
   */
  readonly resolvedOffset = computed<number>(() =>
    this.offsetFrom() ? this.headerSize().height : this.offset(),
  );

  /**
   * The scroll container's size, watched so a page that settles after first
   * paint is re-resolved. See the note on `offsetFrom`.
   */
  private readonly containerSize = svElementSize(() =>
    this.root() ?? (typeof document === 'undefined' ? null : document.documentElement),
  );

  /**
   * The size of what the container scrolls — see the note on `offsetFrom` for
   * why the container's own size is not enough.
   */
  private readonly contentSize = svElementSize(() => {
    const root = this.root();
    if (root) return root.firstElementChild;
    return typeof document === 'undefined' ? null : document.body;
  });

  private readonly appRef = inject(ApplicationRef);

  /**
   * Bumped once the app settles after a pass that found a section missing, so the
   * resolve pass runs again and only THEN reports it — see `noteUnresolved`.
   */
  private readonly recheck = signal(0);

  /** Ids the previous resolve pass found no element for. */
  private missing = new Set<string>();

  /**
   * The observed band, pushed below the sticky header.
   *
   * ★ The bottom stays at `-68%` — the classic scrollspy trick that biases
   * "current" toward the top of the viewport. Only the top edge moves, by exactly
   * the header's height, so the band begins where the reader can actually see.
   *
   * ★★ Since `NV-02-M1` this decides **when the observer fires**, not what the
   * answer is: every strategy but `'first-visible'` re-measures against the
   * activation line instead. The band is kept because its edges are crossed at
   * exactly the moments a heading crosses that line.
   */
  private readonly rootMargin = computed(
    () => `-${Math.round(this.activationLine())}px 0px -68% 0px`,
  );

  /**
   * The activation line: `activationOffset` when given, else the jump's
   * offset. ★ One number by default, as before — a second only for the host
   * that wants the highlight to change somewhere other than where a jump
   * lands (`SR-29`).
   */
  private readonly activationLine = computed(() => this.activationOffset() ?? this.resolvedOffset());

  protected readonly spy = createScrollSpy({
    sections: this.resolved,
    root: this.root,
    rootMargin: this.rootMargin,
    strategy: this.activation,
    // One offset, three consumers: the jump, the observer's band, and now the
    // activation line the strategies measure against.
    offset: this.activationLine,
  });

  protected readonly activeId = computed(() => this.spy.activeId());

  private readonly text = computed<SvAnchorLabels>(() => ({ ...this.registryLabels, ...this.labels() }));

  /** Ids of the active item's ancestors. */
  private readonly trailIds = computed<readonly string[]>(() => {
    const active = this.activeId();
    return this.rows().find(row => row.id === active)?.ancestors ?? [];
  });

  /** Whether the vertical list draws the sliding marker. */
  protected readonly showMarker = computed(
    () =>
      this.orientation() === 'vertical' &&
      this.marker() === 'slide' &&
      (this.appearance() === 'rail' || this.appearance() === 'compact'),
  );

  /**
   * The rows the template draws, with their classes — memoised here so the
   * `@for` block calls nothing.
   *
   * Horizontal lists show the top level only; a child being read lights its
   * top-level pill.
   */
  protected readonly viewRows = computed<readonly AnchorViewRow[]>(() => {
    const active = this.activeId();
    const trail = new Set(this.trailIds());
    const expanded = new Set(this.expandedIds());
    const collapsible = this.collapsible();
    const horizontal = this.orientation() === 'horizontal';
    const isOpen = (id: string): boolean => !collapsible || trail.has(id) || expanded.has(id);
    const out: AnchorViewRow[] = [];
    for (const row of this.rows()) {
      if (horizontal ? row.depth > 0 : !row.ancestors.every(isOpen)) continue;
      const lit = row.id === active || (horizontal && trail.has(row.id));
      out.push({
        ...row,
        active: lit,
        trail: trail.has(row.id),
        open: isOpen(row.id),
        toggleable: collapsible && !horizontal && row.hasChildren && !trail.has(row.id) && row.id !== active,
        linkClass: this.linkClass(row, lit, trail.has(row.id)),
        // The page's own path + `#id`, never a bare `#id`: under the app's
        // `<base href="/">` a bare fragment resolves to the root, so a reader
        // without JavaScript (a prerendered page before hydration) left the page.
        href: svFragmentHref(this.doc, row.id),
        toggleText: this.text().toggle.replace('{label}', row.item.label),
      });
    }
    return out;
  });

  protected readonly navClass = computed(() => {
    if (this.orientation() === 'horizontal') {
      if (this.appearance() === 'minimal') return this.wrap() ? 'flex flex-wrap' : 'flex';
      return this.wrap() ? 'flex flex-wrap gap-1.5' : 'flex gap-1.5';
    }
    switch (this.appearance()) {
      case 'minimal':
        return 'relative flex flex-col gap-0.5';
      case 'card':
        return 'relative flex flex-col gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900';
      case 'compact':
        return 'relative flex flex-col border-s border-gray-200 dark:border-gray-800';
      default:
        return 'relative flex flex-col gap-0.5 border-s border-gray-200 dark:border-gray-800';
    }
  });

  // ── URL synchronisation ─────────────────────────────────────────────────────

  /**
   * The read section's projection into the location. Inert until `urlKey` is set
   * *and* the app provided one — see {@link urlKey}.
   */
  private readonly sectionParam = svNavParam(() => this.urlKey());

  /**
   * The last value this component put in the location, so an incoming change can
   * be told apart from its own echo. Without it, writing on scroll and jumping on
   * read are a loop: write `#usage` → the location notifies → read `#usage` →
   * jump → scroll → write.
   */
  private lastWritten: string | null = null;

  /**
   * The location names a rail section this component has not jumped to yet, and
   * has not given up on. While that holds, the scrolled position is NOT
   * reflected: the page is still at the top, the spy reports the first section,
   * and writing that would replace a deep link to a late-rendering section
   * before the section exists. Ends with the jump (`lastWritten`), or once the
   * section is reported missing (`noted`).
   */
  private holdingDeepLink(): boolean {
    const incoming = this.sectionParam.value();
    return (
      incoming !== null &&
      incoming !== this.lastWritten &&
      !this.noted.has(incoming) &&
      this.rows().some(row => row.id === incoming)
    );
  }

  constructor() {
    // Resolve `items` to live DOM elements only after Angular has painted —
    // `document.getElementById` on a section that hasn't rendered yet (a
    // route just navigated, an `@defer` block still loading) would silently
    // drop it from tracking until the *next* unrelated change detection pass
    // happened to re-run this.
    afterRenderEffect(() => {
      const list = this.rows();
      // ★ `NV-02-I8`: a dependency with no other purpose. Fonts, images and
      //   `@defer` blocks all change the container's size when they settle, so
      //   reading it here is what makes a section that appeared late get tracked
      //   and ones that moved get re-measured.
      this.containerSize();
      this.contentSize();
      this.recheck();

      const next: ScrollSpySection[] = [];
      const missingNow = new Set<string>();

      for (const item of list) {
        // `querySelectorAll` rather than `getElementById`, because the count is
        // the whole point: `getElementById` returns the first of several and
        // hands back a rail that works and is wrong.
        //
        // ⚠️ Not `CSS.escape` — see `svAttrSelector`, which this file's own
        // comment used to argue for in longhand. It escapes IDENTIFIERS, this
        // is a quoted attribute VALUE, and `CSS` is a `window` property that
        // is simply absent in jsdom and on the server.
        const matches = document.querySelectorAll<HTMLElement>(
          svAttrSelector('id', item.id),
        );

        if (matches.length === 1) {
          // Resolved, so forgotten: if it disappears again that is news, and
          // is reported again.
          this.noted.delete(item.id);
          next.push({ id: item.id, el: matches[0] });
          continue;
        }

        if (matches.length > 1) {
          // Two elements are already on the page; waiting cannot make that right.
          this.noteUnresolved(item.id, matches.length);
          next.push({ id: item.id, el: matches[0] });
          continue;
        }

        // ★ A section that has not rendered YET is the ordinary case on first
        //   paint — a route that just navigated, an `@defer` block still
        //   loading. So a missing id is only reported when a LATER pass still
        //   cannot find it; the first sighting schedules that pass instead.
        missingNow.add(item.id);
        if (this.missing.has(item.id)) this.noteUnresolved(item.id, 0);
      }

      const firstSighting = [...missingNow].some(id => !this.missing.has(id));
      this.missing = missingNow;
      if (firstSighting) {
        void this.appRef.whenStable().then(() => this.recheck.update(n => n + 1));
      }

      this.resolved.set(next);
    });

    // ★ The sliding marker is measured after render, from the link the
    //   template just drew — never from a guess at row heights, which a
    //   wrapped label or a different font would make wrong.
    afterRenderEffect(() => {
      const active = this.activeId();
      this.viewRows();
      if (!this.showMarker()) return;
      untracked(() => {
        const nav = this.navEl()?.nativeElement;
        const link = active ? nav?.querySelector<HTMLElement>(`a${svAttrSelector('data-sv-anchor-id', active)}`) : null;
        const next = link && active ? { top: link.offsetTop, height: link.offsetHeight } : { top: 0, height: 0 };
        const box = this.markerBox();
        if (box.top !== next.top || box.height !== next.height) this.markerBox.set(next);
      });
    });

    // Reading progress (`SR-29`): one passive listener on the container,
    // read at most once a frame.
    effect(onCleanup => {
      const want = this.progress();
      const root = this.root();
      const view = this.view;
      if (!view) return;
      untracked(() => {
        let frame = 0;
        const read = (): void => {
          frame = 0;
          const el = root ?? this.doc.documentElement;
          const max = el.scrollHeight - el.clientHeight;
          const top = root ? root.scrollTop : view.scrollY;
          const value = max > 0 ? Math.round(Math.min(1, Math.max(0, top / max)) * 1000) / 1000 : 0;
          if (value !== this.readingProgress()) {
            this.readingProgress.set(value);
            this.progressChange.emit(value);
          }
        };
        const onScroll = (): void => {
          if (!frame) frame = view.requestAnimationFrame(read);
        };
        const target: EventTarget = root ?? view;
        target.addEventListener('scroll', onScroll, { passive: true });
        if (want) read();
        onCleanup(() => {
          target.removeEventListener('scroll', onScroll);
          if (frame) view.cancelAnimationFrame(frame);
        });
      });
    });

    // Hash sync without an app provider (`SR-29`): read once, then jump to it
    // once its section resolves — and write nothing until then, or the first
    // section's id would replace the link the reader arrived with.
    const view = this.view;
    if (view) {
      const raw = view.location.hash.slice(1);
      try {
        this.hashTarget = raw ? decodeURIComponent(raw) : null;
      } catch {
        this.hashTarget = raw || null;
      }
      const onHash = (): void => {
        if (this.hashSync() !== 'auto' || this.urlKey() !== null) return;
        const id = decodeURIComponent(view.location.hash.slice(1));
        if (id && id !== this.activeId() && this.rows().some(row => row.id === id)) this.jumpTo(id, 'replace', false);
      };
      view.addEventListener('hashchange', onHash);
      this.destroyRef.onDestroy(() => view.removeEventListener('hashchange', onHash));
      this.destroyRef.onDestroy(() => this.stopSettle?.());
    }
    afterRenderEffect(() => {
      const sections = this.resolved();
      const current = this.activeId();
      // Tracked: switching hash sync on writes where the reader is at once.
      const mode = this.hashSync();
      untracked(() => {
        if (mode !== 'auto' || this.urlKey() !== null || !view) return;
        const wanted = this.hashTarget;
        if (wanted !== null) {
          if (!this.rows().some(row => row.id === wanted)) {
            this.hashTarget = null;
          } else {
            if (sections.some(section => section.id === wanted)) {
              this.hashTarget = null;
              this.jumpTo(wanted, 'replace', false);
            }
            return;
          }
        }
        if (current !== null && view.location.hash !== `#${current}`) this.writeHash(current, 'replace');
      });
    });

    let previous: string | null = null;
    afterRenderEffect(() => {
      const current = this.activeId();
      if (current !== previous) {
        previous = current;
        this.activeIdChange.emit(current);
      }
    });

    /*
     * Component → location. Reflecting where the reader is, so always `replace` —
     * see the note on `urlKey`. A click that wants an undoable entry has already
     * pushed by the time the spy catches up, and the identity check below then
     * declines to write the same value twice.
     *
     * It also stands aside while a deep link is still waiting for its section —
     * see `holdingDeepLink`.
     */
    afterRenderEffect(() => {
      const current = this.activeId();
      untracked(() => {
        if (!this.sectionParam.addressable()) return;
        if (current === null || this.holdingDeepLink()) return;
        if (this.sectionParam.value() === current) return;
        this.lastWritten = current;
        this.sectionParam.set(current);
      });
    });

    /*
     * Location → component. The deep-link and back-button path.
     *
     * ★ The browser already scrolls to a real `#id` on load, so this exists for
     * the case the browser gets WRONG: `offset`. A page with a sticky header
     * lands the section underneath it, and `jumpTo` is the only code that knows
     * how tall the header is. That is also why the template's links
     * `preventDefault()` — the native jump is the one without the offset.
     *
     * The `lastWritten` check is what keeps this from being a loop with the
     * effect above.
     *
     * ★ `resolved()` is read TRACKED, and `lastWritten` is only recorded once the
     *   jump happens. A deep link to a section that renders late — an `@defer`
     *   block, a route's data arriving — finds nothing on the first pass; this
     *   effect then re-runs when resolution picks the section up and jumps then.
     *   Recording the target before the check, or reading `resolved()` untracked,
     *   made that first miss final (`NV-02-M2`).
     *
     * ★ No focus move: arriving from a link or the back button is not the reader
     *   choosing a rail item, and taking focus on load would strand a keyboard
     *   user somewhere they did not ask to be.
     */
    afterRenderEffect(() => {
      const target = this.sectionParam.value();
      const found = target !== null && this.resolved().some(section => section.id === target);
      untracked(() => {
        if (target === null || target === '') return;
        if (target === this.lastWritten) return;
        // Nothing to scroll to yet — the section has not rendered. `resolved()`
        // is a dependency, so this runs again once it has.
        if (!found) return;
        this.lastWritten = target;
        this.jumpTo(target, this.urlWriteMode(), false);
      });
    });
  }

  /**
   * A rail link was clicked. A plain click is taken over so the jump honours
   * `offset`; a ⌘/Ctrl/Shift/Alt or middle click is the browser's own gesture
   * (open in a new tab or window) and is left alone (`SR-11`).
   */
  protected onItemClick(event: MouseEvent, id: string): void {
    if (svIsModifiedClick(event)) return;
    event.preventDefault();
    this.jumpTo(id);
  }

  /**
   * Scroll `id` into view, honouring `offset` and `prefers-reduced-motion`.
   *
   * Called from a nav link's click handler and from the location reader. The
   * write here is what makes `urlWriteMode="push"` mean anything: the scroll that
   * follows will settle on the same section and the reflection effect will
   * decline to write it a second time, so the pushed entry is the only one the
   * gesture produced.
   *
   * `moveFocus` is for a jump the reader asked for — a click, or a host calling
   * this on their behalf. The location reader passes `false`: see `NV-02-M7`.
   */
  jumpTo(id: string, mode: SvNavWriteMode = this.urlWriteMode(), moveFocus = true): void {
    const el = document.getElementById(id);
    if (!el) {
      // A click on a dead entry is the most direct evidence there is, so it
      // reports even if the resolve pass has not run since the page changed.
      this.noteUnresolved(id, 0);
      return;
    }

    if (this.sectionParam.addressable() && this.sectionParam.value() !== id) {
      this.lastWritten = id;
      this.sectionParam.set(id, mode);
    } else if (this.hashSync() === 'auto' && this.urlKey() === null) {
      this.hashTarget = null;
      this.writeHash(id, mode);
    }

    const reduceMotion =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    const container = this.root();

    (container ?? window).scrollTo({ top: this.landingTop(el, container), behavior });
    this.settleJump(id);

    if (moveFocus) this.moveFocusTo(el);
  }

  /**
   * Where the scroller must be for `el` to sit on the line, below `offset`.
   *
   * ★ Rounded UP to the device pixel (FL-L5-01). The browser rounds a scroll
   *   position, and rounding it down left the heading a fraction of a pixel
   *   BELOW the line — WebKit landed 288.97 at 287, 1.97px under, past the
   *   spy's 1px tolerance, so the rail named the section before the one
   *   clicked. Rounding up puts it at most one device pixel above the line,
   *   which is "passed" and invisible.
   */
  private landingTop(el: HTMLElement, container: HTMLElement | null, offset = this.resolvedOffset()): number {
    const raw = container
      ? el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset
      : el.getBoundingClientRect().top + window.scrollY - offset;
    const dpr = this.view?.devicePixelRatio || 1;
    return Math.max(0, Math.ceil(raw * dpr) / dpr);
  }

  /** Stops watching the jump in flight, if there is one. */
  private stopSettle: (() => void) | null = null;

  /**
   * Finish a jump the browser did not (FL-L5-01).
   *
   * ★★ A SMOOTH SCROLL CAN STOP SHORT, AND NOTHING SAYS SO. With a sticky
   *    header that grows once the panel scrolls — the demo's, and a common
   *    pattern — WebKit ended the animated scroll early in about one jump in
   *    five under load (at 149, 225 of 289 px), with no other script scrolling;
   *    the rail then correctly named the section the panel had stopped on,
   *    which was not the one clicked. And a header that changes height after
   *    the scroll ends moves the line out from under a landing that was right.
   *
   *    So once scrolling has been idle for {@link SvAnchorComponent.SETTLE_MS},
   *    the landing is measured again, against the CURRENT offset, and an
   *    instant scroll closes any gap — re-checked the same way, up to
   *    {@link SvAnchorComponent.MAX_CORRECTIONS} times. The reader comes first: a wheel, touch,
   *    key or pointer press during the jump means they have taken over, and
   *    nothing is corrected.
   *
   * ★ THE HEADER IS WATCHED TOO, AND READ LIVE (FL-A8-06). A header that grows
   *   with a transition is still growing after the last scroll event, and
   *   `resolvedOffset` follows it a frame or more behind (`svElementSize`
   *   coalesces per frame). On a loaded CI runner WebKit's check ran inside
   *   that gap, found the landing right against the old height, and stopped —
   *   and the header then finished growing over the section, 25 px of it. So
   *   the header's own resizes re-arm the check like a scroll does, and the
   *   check measures the header itself rather than the signal.
   */
  private settleJump(id: string): void {
    this.stopSettle?.();
    const view = this.view;
    if (!view) return;
    const container = this.root();
    const scroller: HTMLElement | Window = container ?? view;
    const USER = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let corrections = 0;
    const header = this.offsetFrom();
    const headerWatch =
      header && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => arm()) : null;

    const stop = (): void => {
      if (timer !== null) clearTimeout(timer);
      headerWatch?.disconnect();
      scroller.removeEventListener('scroll', arm);
      for (const type of USER) view.removeEventListener(type, stop, true);
      if (this.stopSettle === stop) this.stopSettle = null;
    };
    const check = (): void => {
      timer = null;
      const el = this.doc.getElementById(id);
      const box = container ?? this.doc.scrollingElement;
      if (!el || !box) return stop();
      const max = box.scrollHeight - box.clientHeight;
      const offset = header ? header.getBoundingClientRect().height : this.resolvedOffset();
      const want = Math.min(this.landingTop(el, container, offset), Math.max(0, max));
      const now = container ? container.scrollTop : view.scrollY;
      if (corrections < SvAnchorComponent.MAX_CORRECTIONS && Math.abs(want - now) > 1) {
        corrections++;
        scroller.scrollTo({ top: want, behavior: 'auto' });
        return arm();
      }
      stop();
    };
    function arm(): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(check, SvAnchorComponent.SETTLE_MS);
    }

    scroller.addEventListener('scroll', arm, { passive: true });
    if (header) headerWatch?.observe(header);
    for (const type of USER) view.addEventListener(type, stop, { capture: true, passive: true });
    arm();
    this.stopSettle = stop;
  }

  /** How long scrolling must be idle before a jump's landing is checked. */
  private static readonly SETTLE_MS = 200;

  /**
   * How many times one jump may be finished. More than one, because the
   * correction itself can move the line: an instant scroll past a header's
   * trigger grows the header after it lands. A few, never unbounded — a page
   * that keeps moving must not hold the scroller.
   */
  private static readonly MAX_CORRECTIONS = 3;

  /*
   * ── `NV-02-M7`: the page moves and the keyboard does not ────────────────────
   * Following an anchor scrolls the section into view and leaves focus on the
   * rail. A sighted mouse user is now reading the section; a keyboard user is
   * still in the nav, so their next Tab goes to the NEXT RAIL ITEM rather than
   * into the content they just asked for. The two experiences have silently
   * diverged, and nothing on screen shows it.
   *
   * ★ This is the one case where the native behaviour was already right and the
   * component broke it. A real `href="#id"` moves focus to the target as well as
   * scrolling — that is what the browser does — and this component calls
   * `preventDefault()` on every rail click in order to apply `offset`. Taking
   * over the scroll means taking over the focus move too; keeping one and
   * dropping the other is how a component ends up less accessible than the
   * markup it replaced.
   *
   * ⚠️ Only for a jump the reader asked for. A deep link or the back button is
   * not a click on the rail, and moving focus on load steals it from wherever the
   * page — or the reader — had put it. `jumpTo`'s `moveFocus` carries that.
   *
   * The heading inside the section is preferred over the section itself, because
   * that is what a screen reader should read on arrival: `<section id="usage">`
   * announces nothing, `<h2>Usage</h2>` announces the thing the reader clicked.
   *
   * ⚠️ Both go in `fallback`, not `to`, and that is not a stylistic choice: **a
   * heading is not focusable.** `<h2>` matches no focusable selector and reports
   * `tabIndex === -1`, so passing it as a candidate means it is silently skipped
   * every time and focus quietly lands on the section instead — the preference
   * would read correctly and never once apply. `fallback` is the path that
   * BORROWS a `tabindex`, which is exactly what both of these need.
   */
  private moveFocusTo(section: HTMLElement): void {
    const heading = section.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
    svRecoverFocus({
      // Nothing is focusable on its own merits here; see above.
      to: [],
      // Made focusable for as long as it holds focus — `svRecoverFocus` borrows
      // and returns the `tabindex` rather than leaving it marked forever.
      fallback: heading ?? section,
      // ★★ `jumpTo` has already started a smooth scroll that honours `offset`.
      //    A scrolling `focus()` cancels it wherever it has got to — on a
      //    narrow screen that left the last section short of the line and the
      //    rail reporting the one before (`SR-11`).
      preventScroll: true,
    });
  }

  /**
   * Ids already reported, so a scroll does not re-report on every render pass.
   * An id leaves the set when it resolves, so a section that disappears AGAIN is
   * reported again.
   */
  private readonly noted = new Set<string>();

  /**
   * Report a target this page does not have exactly one of.
   *
   * `count` is 0 for missing and >1 for duplicated. Each is reported once per
   * id until it resolves: this runs inside `afterRenderEffect`, so anything
   * noisier would fire on every scroll. A missing id reaches here from the
   * resolve pass only on a pass AFTER the one that first missed it — see the
   * resolve effect — and from `jumpTo` at once, because a click on a dead entry
   * is the most direct evidence there is.
   */
  private noteUnresolved(id: string, count: number): void {
    if (this.noted.has(id)) return;
    this.noted.add(id);

    const duplicated = count > 1;
    svWarnOnce(
      `sv-anchor/${id}`,
      duplicated
        ? `<sv-anchor> found ${count} elements with id="${id}". Ids are unique by ` +
            'definition, so the browser and this rail both take the first one — the ' +
            'link works and points at the wrong section. Rename all but one.'
        : `<sv-anchor> has an item for id="${id}" but the page has no such element. ` +
            'The entry renders, the link does nothing, and the section never ' +
            'activates. Check the id on the section, or drop the item.',
    );

    this.unresolved.emit({
      requested: id,
      rendered: duplicated ? id : null,
      reason: duplicated ? 'blocked' : 'unknown',
      corrected: false,
    });
  }

  /** Open or close a parent's sub-sections (`collapsible`). */
  toggle(id: string): void {
    const now = this.expandedIds();
    this.expandedIds.set(now.includes(id) ? now.filter(x => x !== id) : [...now, id]);
  }

  /**
   * ★ Up/Down (Left/Right when horizontal, mirrored in RTL), Home and End
   *   move focus between the links (`SR-29`). Tab still walks them in order;
   *   this is the shortcut a long outline needs.
   */
  protected onNavKeydown(event: KeyboardEvent): void {
    const nav = (event.currentTarget as HTMLElement).closest('nav');
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll<HTMLElement>('a[data-sv-anchor-id]'));
    const at = links.indexOf(event.target as HTMLElement);
    if (at < 0) return;
    const horizontal = this.orientation() === 'horizontal';
    const rtl = horizontal && getComputedStyle(nav).direction === 'rtl';
    const next = horizontal ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
    const back = horizontal ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
    let to = -1;
    if (event.key === next) to = Math.min(links.length - 1, at + 1);
    else if (event.key === back) to = Math.max(0, at - 1);
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = links.length - 1;
    if (to < 0) return;
    event.preventDefault();
    links[to].focus();
  }

  private writeHash(id: string, mode: SvNavWriteMode): void {
    const view = this.view;
    if (!view) return;
    const url = `${view.location.pathname}${view.location.search}#${encodeURIComponent(id)}`;
    if (mode === 'push') view.history.pushState(view.history.state, '', url);
    else view.history.replaceState(view.history.state, '', url);
  }

  private linkClass(row: SvAnchorRow, active: boolean, trail: boolean): string {
    if (this.orientation() === 'horizontal' && this.appearance() === 'minimal') {
      const base = 'inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors';
      return active
        ? `${base} text-brand-700 dark:text-brand-400`
        : `${base} text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200`;
    }
    if (this.orientation() === 'horizontal') {
      const base = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors';
      return active
        ? `${base} bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400`
        : `${base} text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200`;
    }
    const appearance = this.appearance();
    const indent = INDENT[Math.min(row.depth, INDENT.length - 1)];
    const pad = appearance === 'compact' ? 'py-1 text-xs' : 'py-1.5 text-sm';
    const rail = appearance === 'rail' || appearance === 'compact';
    const base = `flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 ${indent} ${pad} font-medium transition-colors${rail ? ' border-s-2 -ms-px' : ''}`;
    const idle = trail
      ? 'text-gray-800 dark:text-gray-200'
      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200';
    if (appearance === 'card') {
      return active
        ? `${base} bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400`
        : `${base} ${idle} hover:bg-gray-50 dark:hover:bg-white/[0.04]`;
    }
    if (appearance === 'minimal') {
      return active ? `${base} font-semibold text-brand-700 dark:text-brand-400` : `${base} ${idle}`;
    }
    // Rail: the sliding marker draws the active edge, so every border is clear.
    const border = active && this.marker() === 'border' ? 'border-brand-500' : 'border-transparent';
    return active ? `${base} ${border} text-brand-700 dark:text-brand-400` : `${base} ${border} ${idle}`;
  }
}

