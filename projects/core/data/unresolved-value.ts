/**
 * ============================================================================
 *  When a controlled value names something that is not there — `X-10`
 * ============================================================================
 *
 * Four navigation families hold their state in a two-way `model()` the host
 * owns, and each had its own answer to *"what if the host's value is one I
 * cannot honour?"* — Tabs, Pagination and Accordion honoured it verbatim and
 * rendered nothing; Stepper clamped, but only for display, so the host's state
 * and the DOM quietly disagreed.
 *
 * `X-10` asked for one answer instead of four fixes. It is three rules, and the
 * first one is the reason the kit ended up with two behaviours that both looked
 * defensible.
 *
 * ── ★ Rule 1 · Ordinal state is corrected. Nominal state is reported ────────
 * A page number has a **nearest valid value**; page 7 of 3 obviously means 3. A
 * tab id does not: `activeId="xyz"` has no nearest tab, and picking the first one
 * is a guess about what the host meant. **A guess that renders confidently is
 * worse than rendering nothing**, because nothing is visibly wrong and a wrong
 * tab is not.
 *
 * So Pagination and Stepper — ordinal — correct. Tabs — nominal — reports.
 * The two behaviours already in the tree were not inconsistent; they were
 * answering different questions, and nobody had written down which was which.
 *
 * ── ★ Rule 2 · Nominal state may be PRUNED, never SUBSTITUTED ───────────────
 * Accordion's open set is nominal, and dropping an id that is provably not in
 * `items` is not a guess — it is a deletion of something known to be absent.
 * Removing what is certainly gone is knowledge; choosing a replacement is
 * invention. That is the line, and it is why an open set can be reconciled while
 * an active tab id cannot.
 *
 * ── ★ Rule 3 · Correct only against data that has ARRIVED ───────────────────
 * The rule T1 learned three times before it was named. `totalItems` is `0` until
 * the first response lands, `items` is `[]` until the fetch returns — and
 * "correcting" against those turns every deep link into page 1 **before the data
 * that justified page 4 exists**. The link appears to work and lands on the wrong
 * thing, which is the worst available outcome.
 *
 * **An empty collection is not evidence that a value is wrong. It is an absence.**
 * So while the data is missing the value is held verbatim, and the host is told
 * that it is being held — {@link SvUnresolvedReason} `'not-loaded'`.
 *
 * ── Rule 4 · Report in every case, including the ones that were corrected ───
 * The complaint `X-10` opens with is *"silently render nothing"*, and the word
 * that matters is **silently**. A component that corrects without telling the
 * host has changed the host's state behind its back; one that holds without
 * telling leaves a value nobody can debug. Either way the host gets an
 * {@link SvUnresolvedValue}.
 */

/** Why a controlled value could not be honoured as given. */
export type SvUnresolvedReason =
  /**
   * The collection that would settle it has not arrived. The value is held
   * verbatim and nothing is corrected — see rule 3.
   */
  | 'not-loaded'
  /** Loaded, and the value names nothing in it. */
  | 'unknown'
  /** Ordinal, and outside the bounds the loaded data defines. */
  | 'out-of-range'
  /** It exists, but the component would not let a click reach it. */
  | 'blocked';

/**
 * What a component did with a controlled value it could not honour.
 *
 * Emitted from a `model()`-holding component's `unresolved` output. Uniform
 * across the families on purpose: a host that handles one handles all of them,
 * and a reader comparing two components is comparing the same shape.
 */
export interface SvUnresolvedValue<T> {
  /** Exactly what the host asked for. */
  readonly requested: T;
  /**
   * What the component is showing instead, or `null` when it is showing nothing.
   *
   * For an ordinal value this is the corrected one; for a nominal value it is
   * whatever the component fell back to, which may well be `null`.
   */
  readonly rendered: T | null;
  /** Why {@link requested} could not be used as given. */
  readonly reason: SvUnresolvedReason;
  /**
   * Whether the `model()` was written back, so the host's state now matches the
   * DOM.
   *
   * `false` means the host still holds {@link requested} and the two disagree —
   * deliberately, under rules 1 and 3. A host that wants them to agree should
   * set the value itself from {@link rendered}, which is a decision only it can
   * make: it may prefer to refetch, redirect, or show an error instead.
   */
  readonly corrected: boolean;
}
