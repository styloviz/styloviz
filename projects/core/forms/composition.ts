import { signal, type Signal } from '@angular/core';

/**
 * IME composition: whose keystrokes these are.
 *
 * ── The defect this exists for (`FI-14-I2` / `FI-14-M1`) ────────────────────
 *
 * ★★★ `Enter` DURING COMPOSITION MEANS "ACCEPT THIS CANDIDATE", NOT "CHOOSE
 *     THIS MENU ITEM". A Japanese or Korean user typing a name presses `Enter`
 *     to confirm the kana→kanji conversion the IME is offering. A mention panel
 *     that treats `Enter` as its own inserts somebody — often the wrong somebody
 *     — into the document at the exact moment the user was committing a word.
 *     `ArrowUp`/`ArrowDown` are the same story: those move through the IME's
 *     candidate list, and a component that steals them makes the candidate list
 *     unusable while a panel is open.
 *
 * ★★ AND THE PANEL SHOULD NOT BE OPEN AT ALL. `input` fires throughout a
 *    composition, carrying phonetic text nobody has committed to — so a trigger
 *    scan runs against `ｔ`, then `て`, then `てす`, opening a panel and firing a
 *    server query per keystroke of a word that does not exist yet.
 *
 * ── Why a guard and not a boolean in each component ─────────────────────────
 *
 * Two components need exactly this — `sv-mention` and `sv-rich-text-editor` —
 * and the second copy of a rule like this drifts from the first. The same
 * argument as `svRovingTarget`, and the same shape: the guard answers "are these
 * keystrokes mine?" and each component decides what to do about the answer.
 */
export interface SvCompositionGuard {
  /** True between `compositionstart` and `compositionend`. */
  readonly composing: Signal<boolean>;
  /** Bind to `(compositionstart)`. */
  start(): void;
  /**
   * Bind to `(compositionend)`. Returns `true` so the caller can re-scan once,
   * now that there is a committed word to scan.
   */
  end(): boolean;
  /**
   * Whether this key event belongs to the IME rather than to the component.
   *
   * ★★ `keyCode === 229` IS NOT LEGACY CRUFT. It is the value browsers report
   *    for a key consumed by an IME, and on several of them it is the ONLY
   *    signal during the first keystroke of a composition — `isComposing` is
   *    still `false` because `compositionstart` has not fired yet. Checking one
   *    of the two catches most compositions and lets the first character
   *    through, which is the character that opens the panel.
   */
  blocks(event: KeyboardEvent): boolean;
}

export function createCompositionGuard(): SvCompositionGuard {
  const composing = signal(false);
  return {
    composing,
    start: () => composing.set(true),
    end: () => { composing.set(false); return true; },
    blocks: (event: KeyboardEvent) =>
      composing() || event.isComposing === true || event.keyCode === 229,
  };
}
