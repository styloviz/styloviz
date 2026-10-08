import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  svElementSize,
  svNavParam,
  svRecoverFocus,
  svWarnOnce,
  type SvNavWriteMode,
  type SvUnresolvedValue,
  svAttrSelector,
} from '@styloviz/core';
import { createScrollSpy, type ScrollSpySection } from './scroll-spy';
import type { AnchorActivation } from './activation-strategy';

/** One entry in the nav — `id` must match the `id` attribute of the section it points to. */
export interface AnchorItem {
  readonly id: string;
  readonly label: string;
}

export type AnchorOrientation = 'vertical' | 'horizontal';

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
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anchor.component.html',
})
export class SvAnchorComponent {
  /** The sections to list and track, in document order. */
  readonly items = input.required<readonly AnchorItem[]>();

  /** Scroll container the sections live in. `null` = the window/viewport. @default null */
  readonly root = input<HTMLElement | null>(null);

  /** Layout axis. @default 'vertical' */
  readonly orientation = input<AnchorOrientation>('vertical');

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
    () => `-${Math.round(this.resolvedOffset())}px 0px -68% 0px`,
  );

  protected readonly spy = createScrollSpy({
    sections: this.resolved,
    root: this.root,
    rootMargin: this.rootMargin,
    strategy: this.activation,
    // One offset, three consumers: the jump, the observer's band, and now the
    // activation line the strategies measure against.
    offset: this.resolvedOffset,
  });

  protected readonly activeId = computed(() => this.spy.activeId());

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
      this.items().some(item => item.id === incoming)
    );
  }

  constructor() {
    // Resolve `items` to live DOM elements only after Angular has painted —
    // `document.getElementById` on a section that hasn't rendered yet (a
    // route just navigated, an `@defer` block still loading) would silently
    // drop it from tracking until the *next* unrelated change detection pass
    // happened to re-run this.
    afterRenderEffect(() => {
      const list = this.items();
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
    }

    const reduceMotion =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    const container = this.root();

    if (container) {
      const top =
        el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - this.resolvedOffset();
      container.scrollTo({ top: Math.max(0, top), behavior });
    } else {
      const top = el.getBoundingClientRect().top + window.scrollY - this.resolvedOffset();
      window.scrollTo({ top: Math.max(0, top), behavior });
    }

    if (moveFocus) this.moveFocusTo(el);
  }

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

  protected itemClass(id: string): string {
    const base =
      this.orientation() === 'vertical'
        ? 'block rounded-md px-3 py-1.5 text-sm font-medium border-l-2 -ml-px transition-colors'
        : 'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors';

    if (id === this.activeId()) {
      return this.orientation() === 'vertical'
        ? `${base} border-brand-500 text-brand-700 dark:text-brand-400`
        : `${base} bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400`;
    }

    return this.orientation() === 'vertical'
      ? `${base} border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200`
      : `${base} text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200`;
  }
}
