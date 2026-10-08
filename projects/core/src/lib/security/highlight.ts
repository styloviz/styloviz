/**
 * Marking the query inside a result label.
 *
 * ── Why this is in `security/` and not in a `text/` folder ──────────────────
 *
 * ★★★ THE ONLY INTERESTING THING ABOUT HIGHLIGHTING IS THAT THE OBVIOUS
 *     IMPLEMENTATION IS AN INJECTION. `label.replace(re, '<mark>$1</mark>')`
 *     bound to `[innerHTML]` is what everyone writes, it is four lines, and it
 *     takes a string the component did not author and hands it to the HTML
 *     parser. `sv-autocomplete` shipped exactly that (`FI-01-I3`).
 *
 *     Angular's `[innerHTML]` sanitiser stops script execution, so this was
 *     never a `<script>` hole — but it strips scripts, not markup. `<b>`, `<i>`,
 *     `<a href>` and `<img src>` all survive, which means a label from a
 *     suggestion API could restyle the row, insert a link, or point an `<img>`
 *     at a host of its choosing and collect every viewer's IP address and
 *     User-Agent as the list scrolls past. No click required.
 *
 * ★★★ SO THE FIX IS NOT TO ESCAPE HARDER — IT IS TO STOP BUILDING HTML.
 *     Returning runs of text lets the template write `<mark>` itself, through
 *     `@for` / `@if`, and the label travels as an interpolated string that
 *     Angular escapes for free. There is no HTML string anywhere for anything
 *     to be injected into. Escaping the label before the `replace` would also
 *     have worked and is worse: it leaves a hand-built HTML string one careless
 *     edit away from being wrong again, and it breaks the highlight the moment
 *     someone searches for `&` (which now sits inside `&amp;`).
 *
 * ── 🔺 THE KIT ALREADY HAD THIS, THREE TIMES ────────────────────────────────
 *
 * `sv-tree-view` and `sv-command-palette` had both independently written the
 * segment version, correctly, with near-identical code and a comment each
 * saying "Safe: no innerHTML". `sv-search-bar` had a third shape
 * (`{ pre, match, post }`). Only `sv-autocomplete` got it wrong — and the
 * reason it could is that the correct answer was sitting in two other packages
 * where nothing could import it. Same story as the sanitiser in this folder;
 * same fix.
 */

/** One run of characters in a label, flagged as matching the query or not. */
export interface SvHighlightSegment {
  readonly text: string;
  /** When true, this run is part of the current query and should be marked. */
  readonly match: boolean;
}

/** The whole label as one unmatched run — what an empty query produces. */
function whole(text: string): SvHighlightSegment[] {
  return [{ text, match: false }];
}

/**
 * Split `text` into runs matching `query` and runs that do not.
 *
 * Case-insensitive, and **every** occurrence is marked rather than the first.
 *
 * ★★ THE SLICES COME OUT OF `text`, NOT OUT OF `query`. Rejoining the segments
 *    has to reproduce the original label exactly, including its capitalisation —
 *    a search for `paris` must still render `Paris`. Taking the matched run from
 *    the query is the mistake that silently lower-cases half the results, and it
 *    is invisible until someone types in the wrong case.
 *
 * ⚠️ `indexOf` on a lower-cased copy, deliberately, rather than a `RegExp` built
 *    from the query. A query is user input: `(` is a `SyntaxError` and `(a+)+`
 *    is a frozen tab (see `pattern.ts` for the measured cost). Escaping the
 *    query for regex works and is what `sv-autocomplete` did; not building a
 *    regex at all is shorter and has nothing to get wrong.
 *
 * ⚠️ ALSO NOT LOCALE-AWARE. `toLowerCase()` matches what every other search in
 *    the kit does, and `localeCompare` has no substring-search equivalent to
 *    borrow. Turkish dotless ı and German ß do not fold the way a Turkish or
 *    German reader expects. Said plainly here rather than discovered later.
 */
export function svHighlightSegments(text: string, query: string): SvHighlightSegment[] {
  const q = query.trim();
  if (!q || !text) return whole(text);

  const haystack = text.toLowerCase();
  const needle = q.toLowerCase();
  const segments: SvHighlightSegment[] = [];

  let from = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, from)) {
    if (i > from) segments.push({ text: text.slice(from, i), match: false });
    segments.push({ text: text.slice(i, i + needle.length), match: true });
    from = i + needle.length;
  }
  if (from < text.length) segments.push({ text: text.slice(from), match: false });

  return segments.length > 0 ? segments : whole(text);
}

/**
 * Build segments from an explicit set of matched character indices.
 *
 * For a fuzzy matcher, which knows *which characters* it matched rather than a
 * substring — `sv-command-palette`'s subsequence mode is the caller.
 *
 * ★ Adjacent indices are coalesced into one run, so `Set` order does not
 *   matter and the caller does not have to sort. Three consecutive matched
 *   characters produce one `<mark>` rather than three, which is the difference
 *   between a highlight and a stutter.
 */
export function svHighlightPositions(
  text: string,
  positions: Iterable<number>,
): SvHighlightSegment[] {
  const hit = positions instanceof Set ? positions : new Set(positions);
  if (hit.size === 0 || !text) return whole(text);

  const segments: SvHighlightSegment[] = [];
  let buffer = '';
  let bufferMatch = hit.has(0);

  for (let i = 0; i < text.length; i++) {
    const isMatch = hit.has(i);
    if (isMatch !== bufferMatch && buffer) {
      segments.push({ text: buffer, match: bufferMatch });
      buffer = '';
    }
    bufferMatch = isMatch;
    buffer += text[i];
  }
  if (buffer) segments.push({ text: buffer, match: bufferMatch });

  return segments.length > 0 ? segments : whole(text);
}
