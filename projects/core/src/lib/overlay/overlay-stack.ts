import { Injectable } from '@angular/core';
import { svWarnOnce } from '../dev/warn-once';

/**
 * Which band of the stacking order a surface belongs to.
 *
 * The band decides how surfaces of DIFFERENT kinds sit relative to each other;
 * push order decides how surfaces of the same kind do. The ordering is the one
 * users already expect: a tooltip describing a button inside a dialog has to
 * draw over that dialog, and a toast reporting the result of what you just did
 * has to draw over everything.
 */
export type SvOverlayLayer =
  | 'anchored'   // popover, popout, dropdown, menubar panel, context menu
  | 'sheet'      // drawer
  | 'modal'      // modal, confirm dialog, command palette, fullscreen spinner
  | 'toast'      // toast stack, alert banner
  | 'tooltip';   // tooltip — always on top, never dismissible

/**
 * ★★★ TWO KINDS OF SURFACE, AND ONLY ONE OF THEM STACKS BY PUSH ORDER.
 *
 * **Interactive** surfaces — anchored, sheet, modal — are things the user
 * navigates INTO, and they nest: a popover opened from a drawer, a select
 * opened from a dialog. Whatever was opened last must paint on top, exactly as
 * it must own Escape. Ranking them by band gets this backwards — a popover
 * (a band below the sheets) opened inside a drawer would RENDER BEHIND THE DRAWER
 * THAT OPENED IT. Measured, not reasoned: the first cut of this file did that
 * and a DOM probe caught it before it shipped. So they share ONE monotonic
 * counter and push order decides.
 *
 * **Ambient** surfaces — toast, tooltip — are not navigated into. They are
 * raised AT the user, and they must clear whatever is on screen whether they
 * arrived before it or after. Push order is wrong for them in the other
 * direction: a toast shown before a dialog opens would be buried by it. So they
 * sit in fixed high bands and do not participate in the counter at all.
 *
 * That is the whole model. Trying to serve both with one rule is what produced
 * two rounds of wrong answers.
 */
/**
 * The z-index of the first interactive surface (popover, dropdown, drawer,
 * dialog); each one opened after it goes higher.
 *
 * ★★★ IT IS 9999 BECAUSE THE KIT LIVES INSIDE SOMEBODY ELSE'S PAGE. The panels
 *     were `z-[9999]` before the stack existed, and their docs still say so
 *     (`SV_MODEL_OVERLAY_Z_INDEX`, the AI-04-I3 / AI-07-I3 browser tests). The
 *     stack's first cut started the band at 1000, which silently put every kit
 *     dropdown BELOW the overlay systems a host is likely to already have —
 *     Bootstrap's modal (1050–1070), MUI's (1300–1500), the CDK overlay
 *     container (1000) — so a select opened inside the host's own dialog
 *     rendered behind that dialog. 9999 clears them, and stays far below the
 *     ambient bands (toast 100,000, tooltip 200,000): ~9,000 nested surfaces'
 *     headroom. A host whose layers sit above 9999 sets the component's own
 *     z-index input, which wins.
 */
export const SV_OVERLAY_Z_FLOOR = 9999;

const INTERACTIVE_BASE = SV_OVERLAY_Z_FLOOR;

/** Fixed bands for surfaces that never take part in push order. */
const AMBIENT_BASE: Partial<Record<SvOverlayLayer, number>> = {
  toast:   100_000,
  tooltip: 200_000,
};

/**
 * z-indexes reserved for each surface, so one registration can paint more than
 * one element.
 *
 * ★ A drawer is a backdrop AND a panel, and the panel must sit above its own
 *   backdrop but below the next surface's backdrop. One number cannot express
 *   that. Each surface therefore owns `zIndex` … `zIndex + 9` and may use the
 *   spare values for its own internal layering.
 *
 * ★ The gap to the ambient bands is ~99,000 — about ten thousand interactive
 *   surfaces' worth. A page that exhausts it has a different problem.
 */
const PER_SURFACE = 10;

/**
 * Is this body child one of `SvLiveAnnouncer`'s shared regions?
 *
 * ★★★ AN INERT LIVE REGION IS A SILENT ONE. `inert` removes a subtree from the
 *     accessibility tree, and the announcer's two regions are body children
 *     created once and kept forever — so the first blocking surface to open
 *     used to mark them inert along with the page, and every announcement made
 *     while ANY dialog was open went nowhere: the toast confirming the dialog's
 *     own save, the form error summary's new count, the async confirm's
 *     failure. The regions contain no focusable content, so leaving them live
 *     costs the modal nothing.
 *
 * Matched by the announcer's own `data-sv-live-region` hook rather than by
 * `aria-live`, so a consumer's region is still theirs to manage.
 */
function isSharedLiveRegion(el: Element): boolean {
  return el.hasAttribute('data-sv-live-region');
}

export interface SvOverlayPushOptions {
  /**
   * The surface's own rendered root, for outside-click routing.
   *
   * ★★ A GETTER, NOT AN ELEMENT, because the panel usually does not exist yet
   *    at `push()` time — it is portalled into `<body>` a tick later, and for
   *    some families not until an animation frame has passed. Capturing the
   *    node here would capture `null` forever.
   *
   *    Omit it and the surface simply cannot be asked about; it still stacks
   *    and still owns Escape. That is the right default for anything with no
   *    panel of its own.
   */
  readonly element?: () => Element | null | undefined;

  /**
   * Does this surface block interaction with everything behind it?
   *
   * ★★★ INERTNESS IS THE ONE OVERLAY DUTY NO COMPONENT CAN DISCHARGE ALONE,
   *     and that is why it lives here rather than in seven `ngOnInit`s. "What
   *     must be inert" is a fact about every open surface AT ONCE: a modal
   *     needs the page behind it inert, AND the drawer it was opened from (that
   *     is background now too), but not the select it opens itself, and not a
   *     toast — and no single component can see that set. Two components each doing it locally do not converge on the
   *     right answer, they fight: the modal marks the drawer inert while the
   *     drawer marks the modal inert, and whichever ran last wins.
   *
   * ★ `aria-modal="true"` without this is a LIE THE KIT WAS TELLING. Four tour
   *   variants and several dialogs assert it over a page that is still fully
   *   focusable and still fully in the accessibility tree. `aria-modal` is a
   *   claim about the rest of the document; `inert` is what makes it true.
   *
   * @default false
   */
  readonly blocking?: boolean;

  /**
   * Whether this surface can be dismissed by Escape. @default true
   *
   * ★ A non-dismissible surface still gets a z-index and still participates in
   *   ordering — it is simply invisible to `isTopmost()`. Tooltips and toasts
   *   are the cases: both sit ABOVE a modal, and neither may take Escape from
   *   it. Without this distinction a toast arriving mid-dialog would silently
   *   become the thing Escape closes.
   */
  readonly dismissible?: boolean;
}

/** A surface's registration. Release it when the surface closes. */
export interface SvOverlayHandle {
  /**
   * The z-index this surface should render at. Stable for its lifetime.
   *
   * The surface also owns the nine values above it — see `PER_SURFACE`. A
   * drawer paints its backdrop at `zIndex` and its panel at `zIndex + 1`.
   */
  readonly zIndex: number;
  /**
   * True only when this is the topmost DISMISSIBLE surface on the stack.
   *
   * This is the Escape test. Call it in the Escape handler and return early
   * when it is false.
   */
  isTopmost(): boolean;
  /**
   * Did this click land inside a surface opened ABOVE this one?
   *
   * ★★★ THE BUG THIS ANSWERS. Every anchored family closes on an outside
   *     click, and each decides "outside" by asking whether the target is
   *     inside its own trigger or its own panel. But a nested overlay —
   *     a select inside a popover, a confirm dialog over a menu — is
   *     PORTALLED TO `<body>`, so it is inside neither. Clicking one of its
   *     options therefore reads as a click outside the parent, and the parent
   *     closes while the user is still using the thing it opened.
   *
   *     Local containment cannot see this, because the nesting is a fact about
   *     the stack rather than about the DOM. Call this before closing.
   */
  isInsideHigherSurface(target: Node): boolean;

  /**
   * The rendered root of the nearest surface pushed BEFORE this one, or `null`.
   *
   * ★★ THIS IS THE ONLY PLACE THAT CAN ANSWER IT. "What was I opened from?" is
   *    a fact about the stack, not about the DOM: both surfaces are portalled
   *    to `<body>` as siblings, so nothing in the tree records that one of them
   *    was opened from inside the other. Focus restoration needs it for the
   *    nested case — when the scope that contained the opener is torn down
   *    before this surface closes, the opener's parent chain leads nowhere and
   *    the surface underneath is the only sensible place left to land.
   */
  surfaceBelow(): Element | null;

  /** Remove this surface from the stack. Idempotent. */
  release(): void;
}

interface Entry {
  readonly id: number;
  readonly layer: SvOverlayLayer;
  readonly dismissible: boolean;
  readonly blocking: boolean;
  readonly zIndex: number;
  readonly element?: () => Element | null | undefined;
}

/**
 * The overlay stack — who is on top, and who owns Escape.
 *
 * ★★★ THE DEFECT THIS EXISTS TO FIX IS NOT THEORETICAL, AND IT SHIPPED.
 *     `sv-drawer` and `sv-popover` each carried an unconditioned
 *     `@HostListener('document:keydown.escape')` gated only on their OWN
 *     `open()`. The listener is on `document`, so it fires for every instance
 *     at once: with two drawers open, ONE ESCAPE CLOSED BOTH. Same for two
 *     popovers, and for a popover opened from inside a drawer. Every family
 *     answered "is this keystroke mine?" locally, and locally the answer is
 *     always yes.
 *
 * ★★★ WHY PUSH ORDER AND NOT THE LAYER DECIDES ESCAPE. It is tempting to say
 *     a modal outranks a popover, so the modal owns Escape. That is wrong, and
 *     it is wrong in the commonest nesting there is: a select dropdown opened
 *     inside a dialog. The user presses Escape expecting the dropdown to close
 *     and the dialog to stay — and a layer-ranked rule closes the dialog out
 *     from under a half-finished form. The surface the user opened LAST is the
 *     one they are interacting with, whatever band it belongs to. So push order
 *     decides ownership; the layer decides only how things paint.
 *
 * ★★ WHY `isTopmost()` IS A QUERY AND NOT AN EVENT. A pushed-based design —
 *    the service listening on `document` and calling the top entry — would
 *    have to own each surface's close semantics, which differ: the drawer
 *    refuses Escape while `loading`, the popover has `closeOnEsc`, the confirm
 *    dialog blocks mid-request. Asking rather than telling leaves those rules
 *    where they belong and makes this service a fact, not a controller.
 *
 * Root-scoped deliberately: one document, one stack. Two instances would each
 * believe they held the top.
 */
@Injectable({ providedIn: 'root' })
export class SvOverlayStackService {
  private readonly _entries: Entry[] = [];
  private _nextId = 0;

  /**
   * The highest z-index handed to an INTERACTIVE surface so far.
   *
   * ★ Monotonic, and never reset on release: restarting it would let a newly
   *   opened panel land on the value of one still on screen, and which of the
   *   two paints on top would then depend on DOM order — i.e. on nothing the
   *   component controls.
   */
  private _lastZ = INTERACTIVE_BASE - PER_SURFACE;

  /** Per-band ordinal for the ambient layers, which do not share the counter. */
  private readonly _ambient: Record<string, number> = {};

  /**
   * The elements this service marked `inert`, so it can unmark exactly those.
   */
  private readonly _inertedByUs = new Set<Element>();

  /** Register an opening surface. Call `release()` on the handle when it closes. */
  push(layer: SvOverlayLayer, options: SvOverlayPushOptions = {}): SvOverlayHandle {
    const entry: Entry = {
      id: this._nextId++,
      layer,
      dismissible: options.dismissible ?? true,
      blocking: options.blocking ?? false,
      element: options.element,
      zIndex: this._assignZ(layer),
    };
    this._entries.push(entry);
    this._syncInert();

    let released = false;
    return {
      zIndex: entry.zIndex,
      isTopmost: () => this._topDismissibleId() === entry.id,
      isInsideHigherSurface: (target: Node) => this._isInsideAbove(entry, target),
      surfaceBelow: () => this._surfaceBelow(entry),
      release: () => {
        if (released) return;
        released = true;
        const i = this._entries.indexOf(entry);
        if (i !== -1) this._entries.splice(i, 1);
        this._syncInert();
      },
    };
  }

  /** How many surfaces are currently registered. Tests and diagnostics. */
  get size(): number { return this._entries.length; }

  private _assignZ(layer: SvOverlayLayer): number {
    const ambient = AMBIENT_BASE[layer];
    if (ambient !== undefined) {
      const n = this._ambient[layer] ?? 0;
      this._ambient[layer] = n + 1;
      return ambient + n * PER_SURFACE;
    }
    // Interactive: strictly above everything already open.
    this._lastZ += PER_SURFACE;
    return this._lastZ;
  }

  /**
   * Walk only the entries pushed AFTER this one.
   *
   * ★ Push order, not z-index: an ambient toast painting at 100,000 is above
   *   everything, but a click on it is not a click "inside" the popover
   *   underneath and must not keep that popover open.
   */
  private _isInsideAbove(entry: Entry, target: Node): boolean {
    const from = this._entries.indexOf(entry);
    if (from === -1) return false;
    for (let i = from + 1; i < this._entries.length; i++) {
      const el = this._entries[i].element?.();
      if (el?.contains(target)) return true;
    }
    return false;
  }

  /**
   * The nearest surface below this one that actually has a rendered root.
   *
   * ★ Surfaces pushed without an `element` getter are skipped rather than
   *   terminating the search: they are invisible to every other stack query
   *   too, and stopping at one would report "nothing below" for a surface that
   *   plainly has something below it.
   */
  private _surfaceBelow(entry: Entry): Element | null {
    const from = this._entries.indexOf(entry);
    if (from <= 0) return null;
    for (let i = from - 1; i >= 0; i--) {
      const el = this._entries[i].element?.();
      if (el?.isConnected) return el;
    }
    return null;
  }

  /**
   * Make everything that is not part of an open surface `inert`, or undo it.
   *
   * ★★ MARKS BODY CHILDREN, AND THAT IS THE WHOLE TECHNIQUE. Every surface in
   *    this kit is portalled to `<body>`, so the page and the surfaces are
   *    SIBLINGS: one pass over `body.children`, excluding any child that holds
   *    a live surface, is the complete answer. Walking into the page to find
   *    "the focusable things behind the dialog" would be a much larger
   *    operation and a strictly worse one — it has to run again every time the
   *    page changes, and it cannot express "and the accessibility tree too",
   *    which `inert` gets for free.
   *
   * ★ Only attributes WE set are removed again. A consumer may have its own
   *   `inert` on a collapsed region, and taking that off when a dialog closes
   *   would hand them a bug they cannot explain.
   *
   * ★★ AND THE SNAPSHOT IS WHAT PROTECTS THE OVERLAY'S OWN PORTAL. `push()`
   *    runs a tick before the panel is portalled, so at pass time there is
   *    nothing of this surface's in `<body>` yet — and because the pass only
   *    ever marks children that ALREADY EXIST, the portal that arrives a tick
   *    later is never marked. I wrote a `syncInert()` hook for the handle
   *    first, to "catch up" after mounting, and then could not write a test
   *    that failed without it: every family's portal either predates the push
   *    or arrives after the pass. It is gone rather than kept as an API nobody
   *    can justify. If a `MutationObserver` is ever added here, the exclusion
   *    below is what will keep the overlay's own nodes interactive.
   *
   * ⚠️ A body child appended WHILE a blocking surface is open is not marked.
   *   Fixing that needs a `MutationObserver` on `<body>` for the lifetime of
   *   every modal, and the case it buys — a third-party widget injecting
   *   itself mid-dialog — is not worth that. Said plainly rather than left to
   *   be discovered.
   */
  private _syncInert(): void {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc?.body) return;

    if (!this._entries.some((e) => e.blocking)) {
      this._clearInert();
      return;
    }

    // ★★★ ONLY WHAT IS ABOVE THE TOPMOST BLOCKING SURFACE STAYS LIVE (`X-4`:
    //     "who is inert? Everything below the topmost modal surface, including
    //     other overlays"). A drawer with a confirm dialog over it is BACKGROUND
    //     to that dialog: its controls must not be tabbable, and a screen
    //     reader's virtual cursor must not wander into it while `aria-modal`
    //     says the dialog is all there is. The first cut kept EVERY open
    //     surface live, which made the drawer under the dialog exactly as
    //     reachable as if the dialog were not modal at all.
    //
    //     What stays live: the topmost blocking surface, everything opened
    //     after it (the select inside the dialog), and the AMBIENT bands at
    //     any depth — a toast or tooltip is raised at the user, not navigated
    //     into, and switching it off would silence the very thing that reports
    //     the outcome of what the dialog just did.
    let topBlocking = -1;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (this._entries[i].blocking) { topBlocking = i; break; }
    }
    const live = this._entries
      .filter((e, i) => i >= topBlocking || AMBIENT_BASE[e.layer] !== undefined)
      .map((e) => e.element?.())
      .filter((el): el is Element => !!el?.isConnected);

    let marked = 0;
    for (const child of Array.from(doc.body.children)) {
      const holdsSurface = live.some((el) => child === el || child.contains(el));
      if (holdsSurface || isSharedLiveRegion(child)) {
        if (this._inertedByUs.delete(child)) child.removeAttribute('inert');
        continue;
      }
      if (child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      this._inertedByUs.add(child);
      marked++;
    }

    // ★★ A BLOCKING SURFACE THAT IS NOT PORTALLED CANNOT MAKE ANYTHING INERT,
    //    because it lives inside the very page it is trying to switch off —
    //    excluding its body-level ancestor excludes the whole app. The pass
    //    then does nothing at all, silently, and `aria-modal` goes on lying.
    //    Saying so is the only useful thing this code can do about it.
    if (marked === 0 && this._inertedByUs.size === 0) {
      svWarnOnce(
        'overlay-stack:inert-noop',
        'a blocking overlay is open but nothing could be made inert — the surface is ' +
          'probably not portalled to <body>, so the page behind it is still focusable ' +
          'and still in the accessibility tree.',
      );
    }
  }

  private _clearInert(): void {
    for (const el of this._inertedByUs) el.removeAttribute('inert');
    this._inertedByUs.clear();
  }

  private _topDismissibleId(): number | null {
    for (let i = this._entries.length - 1; i >= 0; i--) {
      if (this._entries[i].dismissible) return this._entries[i].id;
    }
    return null;
  }
}
