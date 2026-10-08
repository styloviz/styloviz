import { svFirstFocusableWithin } from './focusable';

/**
 * What `restore()` actually did. Returned rather than logged, because these are
 * the cases a test has to be able to tell apart — "focus went somewhere" is the
 * assertion that lets all three of X-6's defects through.
 */
export type SvFocusRestoreOutcome =
  /** The element that opened the overlay is still there and took focus back. */
  | 'opener'
  /** The opener is gone; focus landed in the nearest part of the page that survived it. */
  | 'neighbour'
  /** The opener's whole scope is gone; focus landed in the surface underneath. */
  | 'below'
  /** The page itself changed; focus landed on its main landmark. */
  | 'fallback'
  /** The user had already moved on. Nothing was touched — this is a success. */
  | 'moved'
  /** Nothing focusable survived. The caller should say so in dev mode. */
  | 'none';

export interface SvFocusScopeOptions {
  /**
   * The overlay's own root. Focus inside it still belongs to the overlay, so
   * restoring is correct; focus anywhere else means the user has already moved
   * and restoring would YANK THEM BACK.
   *
   * A getter, not an element: the panel is usually portalled a tick after the
   * scope is created.
   */
  readonly within?: () => Element | null | undefined;
  /** The surface this overlay was opened from, when it was opened from one. */
  readonly below?: () => Element | null | undefined;
  /**
   * The element to treat as the opener, when the surface knows it outright.
   *
   * ★ For a menu or a popover the trigger IS the opener, and it is a better
   *   answer than `document.activeElement` — Safari does not focus a button on
   *   click, so the capture would be `<body>` on one engine and the trigger on
   *   the other two, and the family would restore correctly only where the
   *   browser happened to cooperate.
   */
  readonly opener?: () => Element | null | undefined;
  /** Last resort when the page itself has changed. Defaults to the main landmark. */
  readonly fallback?: () => Element | null | undefined;
  /**
   * A region that is being emptied, and is therefore not somewhere to land.
   *
   * ★★ THE IN-PLACE CASE NEEDS THIS AND THE PORTALLED ONE DOES NOT. An overlay
   *    tears down its whole panel, so the ancestor walk starts outside it
   *    naturally. A banner that dismisses itself does not: its HOST ELEMENT
   *    survives — only the content inside it is removed — so the nearest
   *    "surviving ancestor" of the close button is an empty, invisible wrapper.
   *    Focusing that is barely better than `<body>`: nothing is announced and
   *    there is nothing there to read. Naming the region excludes it and its
   *    descendants from the walk, so focus continues outward to the part of
   *    the page that still has content.
   */
  readonly skip?: () => Element | null | undefined;
  /** Injectable for SSR and tests. */
  readonly document?: Document;
}

export interface SvFocusScope {
  /** Call as the overlay opens, BEFORE it moves focus into itself. */
  capture(): void;
  /** Call as the overlay closes. Safe to call twice; the second is a no-op. */
  restore(): SvFocusRestoreOutcome;
  /** The element captured at open time, if it is still in the document. */
  readonly opener: HTMLElement | null;
}

/**
 * ★★★ RESTORING FOCUS IS NOT "FOCUS THE ELEMENT I SAVED".
 *
 * Every family in this kit saved `document.activeElement` on open and called
 * `.focus()` on it on close, and every one of them was right about the case
 * they tested: open a dialog from a button, close it, the button gets focus
 * back. The three cases nobody tested all end the same way — `focus()` on a
 * detached element does NOTHING, silently, and focus falls to `<body>`, where
 * the next Tab starts again from the top of the document and a screen reader
 * says nothing at all. The user has no idea where they are.
 *
 *   1. **The trigger was removed while the overlay was open.** This is not an
 *      edge case, it is the SINGLE MOST COMMON DIALOG THERE IS: a confirm
 *      dialog whose whole purpose is to delete the row the trigger sits in.
 *      The better the dialog works, the more reliably it loses focus.
 *   2. **A route changed underneath it.** The opener's entire subtree is gone.
 *   3. **The overlay was nested inside another scope** that closed first, so
 *      the opener is in a portal that no longer exists.
 *
 * So this walks OUTWARD from where the user was until it finds something that
 * survived, and it is specific about what it found. The order is the order of
 * least surprise: the opener, then the nearest surviving ancestor of the
 * opener, then the surface underneath, then the page's main landmark.
 *
 * ★★ THE ANCESTOR CHAIN IS RECORDED AT OPEN TIME, AND IT HAS TO BE.
 *    The tempting version of this function records nothing and walks
 *    `parentElement` from the detached opener at close time. It is wrong, and
 *    it is wrong in the exact case it was written for: removing the row CUTS
 *    THE LINK AT THE ROW. The opener keeps its parent — the `<li>` — but that
 *    `<li>`'s own `parentElement` is `null` the moment it leaves the list, so
 *    the walk dead-ends one step above the opener and never reaches the
 *    container that survived. A detached subtree keeps its links INSIDE
 *    itself; it does not keep the one that was severed. The chain must
 *    therefore be captured while it is still whole — which is exactly when
 *    `capture()` runs.
 *
 * ★ `<body>` is never an answer. A walk that reaches it has found nothing —
 *   body is connected by definition, so accepting it would turn every failure
 *   back into the silent one this exists to prevent.
 */
function canTakeFocusAgain(el: HTMLElement | null): el is HTMLElement {
  return (
    !!el &&
    el.isConnected &&
    !el.hasAttribute('disabled') &&
    !el.hidden &&
    !el.closest('[inert]')
  );
}

export function createFocusScope(options: SvFocusScopeOptions = {}): SvFocusScope {
  const doc = options.document ?? (typeof document !== 'undefined' ? document : null);
  let opener: HTMLElement | null = null;
  /** The opener's ancestors, outermost last, as they stood when it had focus. */
  let ancestors: HTMLElement[] = [];

  const focusIn = (container: Element | null | undefined): HTMLElement | null => {
    const first = svFirstFocusableWithin(container);
    if (first) { first.focus(); return first; }
    return null;
  };

  /**
   * Focus a container that has nothing focusable inside it.
   *
   * `tabindex="-1"` is added and left: removing it on blur is a listener per
   * restore for no benefit, and `-1` changes nothing about tab order — it only
   * makes the element a legal `focus()` target.
   */
  const focusContainer = (el: Element | null | undefined): HTMLElement | null => {
    if (!(el instanceof HTMLElement) || !el.isConnected) return null;
    if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus();
    return el;
  };

  return {
    get opener() { return opener?.isConnected ? opener : null; },

    capture(): void {
      if (!doc) return;
      const explicit = options.opener?.();
      const active = explicit ?? doc.activeElement;
      opener = active instanceof HTMLElement && active !== doc.body ? active : null;
      ancestors = [];
      for (let n = opener?.parentElement ?? null; n; n = n.parentElement) ancestors.push(n);
    },

    restore(): SvFocusRestoreOutcome {
      if (!doc) return 'none';
      const saved = opener;
      const chain = ancestors;
      opener = null;
      ancestors = [];

      // 1. Has the user already moved on? Focus that is neither nowhere nor
      //    inside this overlay belongs to something the user chose — an
      //    outside click that landed on another control, most often. Taking it
      //    away is a bug of its own, and the one families "fixed" by restoring
      //    unconditionally.
      //    ★ The opener itself is not "somewhere else". Focus often never left
      //      it — a popover that never took focus, a dialog closed before it
      //      mounted — and calling that a user move would turn the commonest
      //      no-op into a reported failure.
      const active = doc.activeElement;
      const elsewhere =
        active instanceof HTMLElement &&
        active !== doc.body &&
        active !== doc.documentElement &&
        active !== saved &&
        !(options.within?.()?.contains(active) ?? false);
      if (elsewhere) return 'moved';

      // Nothing had focus when this opened, so there is nothing to put back.
      // Moving focus anyway would be an unsolicited jump the user did not ask
      // for — a different bug, not a smaller one.
      if (!saved) return 'none';

      // 2. The opener itself, if it is still there AND can still take focus. A
      //    button that survived but is now disabled is not an answer either —
      //    `focus()` on it is the same silent no-op.
      //
      //    ★ The test here is deliberately weaker than `svIsFocusable`: this
      //      element DID have focus, so a `tabindex="-1"` panel or any other
      //      programmatic target still qualifies. Only the things that make
      //      `focus()` a no-op disqualify it.
      if (canTakeFocusAgain(saved)) {
        // ★ Already there: report success without touching it. Re-focusing the
        //   element that already has focus is not free — it can interrupt an
        //   IME composition and reset a scroll position — and it is the case
        //   an auto-dismiss hits while the user is typing somewhere else.
        if (active !== saved) saved.focus();
        return 'opener';
      }

      // 3. Outward from where the opener was, to the first ancestor that
      //    outlived it. `<body>` and `<html>` do not count.
      const skip = options.skip?.();
      for (const node of chain) {
        if (!node.isConnected) continue;
        if (node === doc.body || node === doc.documentElement) break;
        // The region being emptied is not a landing place — see `skip`.
        if (skip && (node === skip || skip.contains(node))) continue;
        if (focusIn(node) ?? focusContainer(node)) return 'neighbour';
      }

      // 4. The surface underneath — the nested case, where the scope that
      //    contained the opener closed before this one did.
      const below = options.below?.();
      if (below && (focusIn(below) ?? focusContainer(below))) return 'below';

      // 5. The page changed. The main landmark is where a screen reader should
      //    resume, so focus the landmark ITSELF rather than its first control:
      //    the user needs to hear what page they are on, not to be dropped
      //    into a nav link three levels in.
      const fallback =
        options.fallback?.() ?? doc.querySelector('main, [role="main"]');
      if (focusContainer(fallback)) return 'fallback';

      return 'none';
    },
  };
}
