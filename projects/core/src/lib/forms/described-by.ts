/**
 * The parts of a form control's description, in the order a reader wants them.
 *
 * Every field is `false`/`null`/`''` when that part is not rendered — pass the
 * same condition the template uses to render it, so an id can never name an
 * element that is not there. `aria-describedby` pointing at a missing id is not
 * an error anyone sees; the description is simply, silently, not announced.
 */
export interface SvDescribedByParts {
  /**
   * The standing instruction under the field — "We'll only use this to send
   * your receipt."
   *
   * First, because it is the only part that is true before the user does
   * anything, and the one that stops them making the mistake the other two
   * report.
   */
  readonly hint?: string | false | null;
  /**
   * What is wrong with the value right now.
   *
   * Second. It is the most urgent part, but a reader who hears it before the
   * instruction has to hold it in mind while the instruction arrives — and the
   * instruction is usually what makes the error make sense. This is also the
   * order GOV.UK's Design System settled on, and matching a widely-used
   * convention is worth more here than a marginally different opinion.
   */
  readonly error?: string | false | null;
  /**
   * A live constraint that changes as the user types — "35 characters
   * remaining".
   *
   * Last, deliberately. It is a `aria-live` region in its own right, so it will
   * announce itself when it changes; its place here is only so that someone
   * ARRIVING at the field is told a limit exists at all. Putting it first would
   * mean every visit begins with a number.
   */
  readonly count?: string | false | null;
  /**
   * Anything else this control describes itself with, appended in the order
   * given — a lock reason, a format example, a failed-write message.
   */
  readonly extra?: readonly (string | false | null | undefined)[];
}

/**
 * Compose one `aria-describedby` from every part of a field's description.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * `aria-describedby` takes a **list**, and almost nothing in this kit was
 * treating it as one. The overwhelmingly common shape was
 *
 * ```html
 * [attr.aria-describedby]="fieldError.showError() ? errorId() : null"
 * ```
 *
 * which is not "describe this field" — it is "describe this field with the
 * error INSTEAD of the hint". A field with both a standing instruction and a
 * live rejection announced one of them, and which one depended on which
 * condition the author happened to write first. The counter had the same
 * problem from the other side: rendered, styled, given `aria-live` so it
 * announced every keystroke, and never mentioned to someone arriving at the
 * field, so they were told a limit existed only by exceeding it.
 *
 * Both are invisible to every gate and to every test that asserts a single id,
 * which is why this is a shared function rather than a review note.
 *
 * ── The order, and why it is fixed here ─────────────────────────────────────
 * **hint → error → count.** Each call site choosing its own order is how a kit
 * ends up with fields that read differently for no reason a user could name, so
 * the order is a property of this function and not of its callers. `extra`
 * exists for the parts only one component has.
 *
 * @example
 * ```ts
 * protected readonly describedBy = computed(() =>
 *   svDescribedBy({
 *     hint: this.hasDescription() && this.descId(),
 *     error: this.fieldError.showError() && this.errorId(),
 *     count: this.showCounter() && this.counterId(),
 *   }),
 * );
 * ```
 * ```html
 * <input [attr.aria-describedby]="describedBy()" />
 * ```
 *
 * @returns The ids joined by a space, or `null` when there are none — never an
 *   empty string, because `aria-describedby=""` is a present attribute naming
 *   nothing, and some assistive tech treats that differently from an absent one.
 */
export function svDescribedBy(parts: SvDescribedByParts): string | null {
  const ids = [parts.hint, parts.error, parts.count, ...(parts.extra ?? [])]
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

  // De-duplicated because a control that describes itself with one id twice
  // makes some readers announce it twice, and the caller cannot always tell:
  // `extra` is often built from a list the host supplies.
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique.join(' ') : null;
}
