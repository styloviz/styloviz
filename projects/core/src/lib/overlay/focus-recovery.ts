import { svFocusableWithin, svIsFocusable } from './focusable';
import type { SvLiveAnnouncer } from '../a11y/live-announcer';

/**
 * ============================================================================
 *  Where focus goes when the thing holding it disappears — `X-14`
 * ============================================================================
 *
 * Five navigation families drop focus to `<body>` in the same situation and each
 * described it as its own bug: close the active tab (`NV-06-I1`), collapse a
 * panel containing focus (`NV-01-I4`), replace a page of results
 * (`NV-04-I6`), follow an anchor (`NV-02-M7`), dismiss a menu.
 *
 * ── ★ Why `<body>` is the specific failure, and not just untidy ─────────────
 * Focus on `<body>` is not "focus nowhere". It is focus at the **top of the
 * document**, so the next Tab goes to the first link on the page — the skip
 * link, the logo — and a keyboard user who deleted one tab out of six is
 * returned to the start of the site with no announcement. They have to find
 * their way back through everything to reach the tab strip they were in. A
 * sighted mouse user sees none of it, which is why it survives review.
 *
 * ── The rule, implemented once ──────────────────────────────────────────────
 * **Move focus to the nearest stable equivalent, announce what happened, and
 * never drop to `<body>`.** Callers supply the equivalents in priority order —
 * for a closed tab that is *next tab, then previous, then the tablist* — and a
 * `fallback` container that will take focus when none of them can.
 *
 * ── ★ Announce WHAT HAPPENED, not WHERE YOU ARE ─────────────────────────────
 * Assistive technology already announces a newly focused element; repeating it
 * is noise, and noise is what gets a live region switched off. The message is
 * for the thing the AT cannot know — *"Tab closed"*, *"Page 3 of 12 loaded"* —
 * and it is optional, because sometimes the focus move alone says everything.
 */

/**
 * ── The mutation rule — `X-12` ───────────────────────────────────────────────
 * One rule for every collection whose item holding focus is removed by a
 * mutation — a comment posts, a file is removed, a card moves, a tree node is
 * deleted, a lightbox closes, a row is filtered away:
 *
 * 1. **The successor at the same index** — the item that slid into the removed
 *    one's place, so a reader deleting three rows in a row keeps pressing the
 *    same key;
 * 2. else **the predecessor** — the removed item was the last one;
 * 3. else **the container** — the list is now empty (passed as `fallback`);
 * 4. **never `<body>`.**
 *
 * A dialog-like surface that closes (a lightbox) follows the same rule through
 * `createFocusScope`: back to the control that opened it — or, if that control
 * no longer represents what was last shown, to its equivalent (the thumbnail of
 * the image last viewed) — then the component root.
 *
 * {@link svSuccessorIndex} computes step 1–2 on the post-mutation list;
 * {@link svRecoverFocus} applies steps 1–4 to elements.
 *
 * @param removedIndex where the removed item sat in the list BEFORE the mutation.
 * @param remaining how many items the list holds AFTER it.
 * @returns the index to focus in the post-mutation list, or `-1` when the list
 * is empty and focus belongs to the container.
 */
export function svSuccessorIndex(removedIndex: number, remaining: number): number {
  if (remaining <= 0) return -1;
  if (removedIndex < 0) return 0;
  return Math.min(removedIndex, remaining - 1);
}

/** How {@link svRecoverFocus} chooses where focus lands. */
export interface SvFocusRecoveryOptions {
  /**
   * Candidates in priority order. The first one still in the document and
   * actually focusable wins.
   *
   * Nulls are allowed and skipped, so a caller can write its preference list
   * without guarding each entry — `[next, previous, list]` reads as the policy
   * it is.
   */
  readonly to: readonly (Element | null | undefined)[];

  /**
   * Where focus goes when nothing in {@link to} can take it — a container that
   * still exists, such as the tablist or the nav landmark.
   *
   * ★ **This is what "never drop to `<body>`" actually means.** It is made
   * programmatically focusable (`tabindex="-1"`) if it is not already, and the
   * attribute is removed again when focus leaves, so a container does not stay
   * marked as a focus target for the rest of the session.
   */
  readonly fallback?: Element | null;

  /** What to tell a screen reader about the EVENT. See the note above. */
  readonly announce?: string;

  /** The announcer to say it through. Injected by the caller; omit for silence. */
  readonly announcer?: SvLiveAnnouncer | null;
}

/**
 * Move focus somewhere sensible after the element holding it has gone.
 *
 * ⚠️ **Call this AFTER the removal has rendered.** Focus cannot move to an
 * element that is not in the document yet, and it cannot be taken from one the
 * browser has already discarded — call it too early and the browser moves focus
 * to `<body>` first, which is the thing being avoided. In a component that means
 * `afterNextRender`, or a task scheduled after the host has re-rendered.
 *
 * @returns the element that received focus, or `null` if nothing could.
 */
export function svRecoverFocus(options: SvFocusRecoveryOptions): HTMLElement | null {
  // ★ `typeof` first: on the server `HTMLElement` is not a global at all, and
  //   `x instanceof HTMLElement` throws a ReferenceError even when `x` is null.
  //   Under SSR there is no focus to recover, so this is a no-op returning null.
  if (typeof HTMLElement === 'undefined') return null;

  const { to, fallback, announce, announcer } = options;

  const say = (): void => {
    if (announce && announcer) announcer.announce(announce);
  };

  for (const candidate of to) {
    if (!svIsFocusable(candidate)) continue;
    candidate.focus();
    say();
    return candidate;
  }

  if (fallback instanceof HTMLElement && fallback.isConnected) {
    // Not `svIsFocusable`: the whole point of a fallback is that it is a plain
    // container which is not focusable yet, and is about to be made so.
    const borrowed = !fallback.hasAttribute('tabindex');
    if (borrowed) fallback.setAttribute('tabindex', '-1');

    fallback.focus();

    if (borrowed) {
      // Given back when focus leaves. `tabindex="-1"` keeps it out of the tab
      // order either way, so this is tidiness rather than a fix — but a
      // container that silently accumulates attributes over a session is how a
      // later reader concludes it was always meant to be focusable.
      fallback.addEventListener(
        'blur',
        () => fallback.removeAttribute('tabindex'),
        { once: true },
      );
    }

    say();
    return fallback;
  }

  return null;
}

/** Where focus sat inside a keyed collection, taken BEFORE a mutation renders. */
export interface SvFocusedItemSnapshot {
  /** The focused item's key (the value of its key attribute). */
  readonly key: string;
  /** The item's position among the rendered items. */
  readonly index: number;
  /** Which focusable inside the item held focus (`-1`: the item itself). */
  readonly control: number;
}

/**
 * Record which rendered item of a keyed collection holds focus.
 *
 * `items` are the rendered item elements in order; each carries `keyAttr`.
 * Returns `null` when focus is not inside any of them.
 */
export function svSnapshotFocusedItem(
  items: readonly Element[],
  keyAttr: string,
): SvFocusedItemSnapshot | null {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (!active) return null;
  const index = items.findIndex(item => item === active || item.contains(active));
  if (index < 0) return null;
  const item = items[index];
  const key = item.getAttribute(keyAttr);
  if (key === null) return null;
  const control = item === active ? -1 : svFocusableWithin(item).indexOf(active as HTMLElement);
  return { key, index, control };
}

/**
 * Apply the mutation rule to a keyed collection after it re-rendered: if the
 * item in `snapshot` is gone, focus the same control in the item now at its
 * index (then its predecessor), else `fallback` — never `<body>`.
 *
 * An item that is itself the focus target (a roving row) is given
 * `tabindex="0"` first, so it owns the collection's tab stop.
 *
 * @returns the element focused, or `null` when the item is still there (no
 * recovery needed) or nothing could take focus.
 */
export function svRestoreFocusedItem(
  items: readonly Element[],
  keyAttr: string,
  snapshot: SvFocusedItemSnapshot,
  options: Omit<SvFocusRecoveryOptions, 'to'> = {},
): HTMLElement | null {
  if (items.some(item => item.getAttribute(keyAttr) === snapshot.key)) return null;
  const successor = items[svSuccessorIndex(snapshot.index, items.length)] as HTMLElement | undefined;
  let target: Element | null = null;
  if (successor) {
    if (snapshot.control < 0) {
      successor.tabIndex = 0;
      target = successor;
    } else {
      const controls = svFocusableWithin(successor);
      target = controls[Math.min(snapshot.control, controls.length - 1)] ?? null;
    }
  }
  return svRecoverFocus({ ...options, to: [target] });
}
