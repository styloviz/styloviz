/**
 * Where the arrow keys should move inside a composite widget.
 *
 * ── Why this is a function and not a directive ───────────────────────────────
 *
 * It answers one question — "given this key and this position, which item is
 * next?" — and answers it with arithmetic. It does not touch the DOM, does not
 * know how a caller finds its elements, and above all does not decide whether
 * moving focus should also SELECT the thing focused.
 *
 * That last part is the reason the split matters. In a `radiogroup` selection
 * follows focus: arrowing to an option chooses it, and that is the APG pattern.
 * In a multi-select set of filter chips it must not — arrowing past a chip that
 * silently turns itself on is a data-loss bug wearing a keyboard shortcut. Both
 * want identical movement and opposite consequences, so the movement is what is
 * shared and the consequence stays with the caller.
 *
 * ── The duplication it replaces ──────────────────────────────────────────────
 *
 * `sv-segmented-control` and `sv-radio-group` had this switch written out
 * twice, character for character apart from the attribute each uses to find its
 * buttons — same modulo wrap, same Home/End, same enabled-only filtering. A
 * chip group would have been the third copy, and the third copy is where the
 * kit usually discovers the first two had quietly drifted.
 *
 * @example
 * ```ts
 * const next = svRovingTarget(event.key, enabledOptions.length, currentIndex);
 * if (next === null) return;          // not a navigation key — let it through
 * event.preventDefault();
 * this.focusOptionAt(next);           // and select, or not, as the role requires
 * ```
 */
export function svRovingTarget(
  key: string,
  count: number,
  current: number,
): number | null {
  if (count <= 0) return null;

  // A `current` that is not in the list — nothing focused yet, or an item that
  // has just been disabled out from under the cursor. Both arrow directions
  // should still land somewhere sensible rather than computing from -1.
  const from = current >= 0 && current < count ? current : 0;

  switch (key) {
    // Both axes, deliberately. A composite widget that is horizontal today is
    // vertical at 400px, and a user pressing Down on a wrapped row is not
    // making a mistake the widget should punish them for.
    case 'ArrowRight':
    case 'ArrowDown':
      return (from + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (from - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      // ★ `null`, not `current`. "No opinion" and "stay where you are" are
      //   different answers: the first lets Tab, Escape and typeahead reach the
      //   host untouched, and the second would have the caller call
      //   `preventDefault()` on every key it does not handle.
      return null;
  }
}
