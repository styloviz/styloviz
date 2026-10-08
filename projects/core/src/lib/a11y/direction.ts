/**
 * Which way the text runs, for the code that has to care.
 *
 * ── The defect this exists for (`FI-24-I2`) ─────────────────────────────────
 *
 * ★★ THE BACKLOG ASKED A QUESTION — "in an RTL layout, does the right arrow
 *    increase or decrease?" — and the answer turned out to be the least
 *    interesting part. `sv-slider` is built on a native `<input type="range">`,
 *    and the browser already flips both the thumb and the arrow keys in an RTL
 *    context. **The keyboard was never broken.** What was broken is everything
 *    the component draws and measures AROUND that input:
 *
 *      • the fill bar is `left-0` + `width: N%` — a PHYSICAL left, so it grows
 *        left-to-right while the thumb it is supposed to follow grows
 *        right-to-left. They point at each other.
 *      • the range fill binds `[style.left]` and `[style.right]`, same problem.
 *      • `(clientX - rect.left) / rect.width` reads a fraction from the
 *        physical left edge, so in RTL it reports `0` where the value is `max`.
 *        That fraction picks WHICH HANDLE a click grabs, so the wrong one moves.
 *
 * ★★★ TWO OF THE THREE ARE FIXED BY CSS AND NOT BY THIS FILE.
 *     `inset-inline-start` already means "the edge text starts at", and the
 *     browser resolves it. A component that computes its own left/right from a
 *     direction flag is reimplementing something CSS does correctly, and it
 *     will disagree with CSS the moment a parent sets `direction` in a way the
 *     flag does not see.
 *
 *     This helper exists ONLY for the third case — arithmetic on a
 *     `clientX`, which is a physical coordinate with no logical equivalent.
 */

/**
 * `true` when `el` is laid out right-to-left.
 *
 * ★ `getComputedStyle().direction` FIRST, because that is the actual answer:
 *   `direction` inherits and can be set by a stylesheet with no `dir`
 *   attribute anywhere, which an attribute walk would miss entirely.
 *
 * ⚠️ AND THE `dir` ATTRIBUTE WALK AS A FALLBACK, because jsdom's
 *    `getComputedStyle` does not inherit `direction` — it reports `'ltr'` for
 *    an element inside `<div dir="rtl">`. Without the fallback every test of
 *    this is a test of jsdom rather than of the component, and the behaviour
 *    would only ever be exercised in a browser nobody runs in CI.
 *
 * ⚠️ Returns `false` with no element, on the server, and on anything it cannot
 *    read. LTR is the safer wrong answer: it is what the component did before.
 */
export function svIsRtl(el: Element | null | undefined): boolean {
  if (!el || typeof window === 'undefined') return false;

  try {
    const computed = window.getComputedStyle(el).direction;
    if (computed === 'rtl') return true;
  } catch {
    // A detached node, or a runtime without layout. Fall through to the walk.
  }

  // `closest` rather than a manual parent loop: it crosses shadow boundaries no
  // better, but it is the same traversal in one call and it handles the element
  // itself carrying the attribute.
  const marked = el.closest?.('[dir]');
  const dir = marked?.getAttribute('dir')?.toLowerCase();
  if (dir === 'rtl') return true;
  if (dir === 'ltr') return false;

  return (
    document?.documentElement?.getAttribute('dir')?.toLowerCase() === 'rtl' ||
    document?.dir?.toLowerCase() === 'rtl'
  );
}

/**
 * A pointer's position along an element, as `0`…`1` from the LOGICAL start.
 *
 * ★★★ THIS IS THE ONE THING CSS CANNOT DO FOR US. `clientX` is physical and
 *     `getBoundingClientRect().left` is physical; the fraction a slider needs
 *     is logical. In LTR they coincide, which is why `(clientX - rect.left) /
 *     rect.width` looks like it has no direction in it — it has, and the
 *     direction it has is LTR.
 *
 * ⚠️ RETURNS `0` FOR A ZERO-WIDTH ELEMENT rather than `NaN`. A slider measured
 *    before layout, or while `display: none`, would otherwise propagate `NaN`
 *    into a value and out through the form.
 */
export function svPointerFraction(clientX: number, el: Element): number {
  const rect = el.getBoundingClientRect();
  if (!rect.width) return 0;
  const fromLeft = (clientX - rect.left) / rect.width;
  const clamped = Math.max(0, Math.min(1, fromLeft));
  return svIsRtl(el) ? 1 - clamped : clamped;
}
