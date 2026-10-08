/**
 * ============================================================================
 *  Building a selector from a value somebody else chose
 * ============================================================================
 *
 * ★★★ `CSS.escape` IS THE WRONG TOOL HERE, AND IT IS ALSO NOT ALWAYS THERE.
 *     Both halves matter, and the repo had learned each one separately:
 *
 *   1. **It escapes IDENTIFIERS.** `CSS.escape` exists to make a string safe as
 *      a bare `#id` or `.class`, so it escapes everything illegal in an
 *      identifier — a leading digit, spaces, punctuation. Inside a **quoted
 *      attribute value** none of that can end the string: only `"` and `\` can.
 *      The result is not usually *broken* — CSS processes those escapes inside
 *      strings too, so `"\32 026-09-21"` still resolves to `2026-09-21` — it is
 *      **needless**, and being needless is what hid the second problem. Reaching
 *      for a capability probe at all implies the capability is needed.
 *
 *   2. ★★ **It is not defined in jsdom, and it is a `window` property, so
 *      `CSS?.escape` DOES NOT GUARD IT.** Optional chaining protects against a
 *      declared binding holding `null`/`undefined`; it does nothing for an
 *      identifier that was never declared, which throws `ReferenceError`
 *      before the `?.` is reached. `sv-ai-chat` had exactly that inside a
 *      `try`, so its clipboard fallback silently selected nothing while the UI
 *      told the reader their text *was* selected — an affordance that reports
 *      success and does not happen. `sv-sidebar` had the unguarded form inside
 *      a `requestAnimationFrame`, where the throw is not caught at all.
 *
 * So: two characters, no capability probe, no environment assumptions, and one
 * spelling instead of the four this repo had grown.
 */

/**
 * Escape a value for use inside a **double-quoted** attribute selector.
 *
 * Only `"` and `\` can end the string early, so only those are escaped. The
 * result is meaningless outside double quotes — use {@link svAttrSelector}
 * unless you are assembling something more complex by hand.
 */
export function svEscapeAttrValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * `[attribute="value"]`, with the value escaped.
 *
 * ```ts
 * root.querySelector(svAttrSelector('data-nav-item', item.id));
 * ```
 *
 * ★ Prefer this over interpolating by hand. The failure it prevents is silent
 *   in both directions: an unescaped `"` produces a selector that throws
 *   `SyntaxError`, and an over-escaped value produces one that matches nothing
 *   and returns `null` — which every call site here already treats as "not
 *   rendered yet" and skips.
 */
export function svAttrSelector(attribute: string, value: string): string {
  return `[${attribute}="${svEscapeAttrValue(value)}"]`;
}
