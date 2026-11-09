/**
 * Accent- and case-folded text matching (`FI-01-I4`, `FI-01-M2`, `FL-J3-FI-08`).
 *
 * ★★★ `toLowerCase()` IS NOT A SEARCH. Typing `jose` never found `José`,
 *     `muller` never found `Müller`, and `ISTANBUL` lower-cased the English way
 *     never found `İstanbul` — so a picker over real names failed exactly the
 *     users whose names are not ASCII. Folding is: decompose (NFD), drop the
 *     combining marks, lower-case in the reader's locale.
 *
 * ★★ THE FOLD IS DONE PER CODE POINT WITH AN INDEX MAP. A folded string is
 *    not the same length as its source (`İ` lower-cases to two code units in
 *    English, `ﬁ` decomposes to `fi`), so a match found in the folded copy
 *    cannot be sliced out of the original at the same offsets. Each original
 *    code point records where its folded form starts; a hit is mapped back to
 *    whole original characters, and the highlight keeps the label's own
 *    spelling and capitals.
 */

/** Where a query may match inside a text. */
export type SvTextMatchMode = 'substring' | 'prefix';

/** Options for {@link svTextMatches} and the folded highlight. */
export interface SvTextMatchOptions {
  /**
   * `substring` — anywhere (the default); `prefix` — at the start of the text
   * or of any word in it, so `ada` finds "Lovelace, Ada" but not "Canada".
   */
  readonly mode?: SvTextMatchMode;
  /** BCP 47 locale for lower-casing (`İ`/`ı` in Turkish). @default the runtime's */
  readonly locale?: string;
}

const MARKS = /\p{M}/gu;

function foldOne(ch: string, locale: string | undefined): string {
  let lower: string;
  try {
    lower = locale ? ch.toLocaleLowerCase(locale) : ch.toLowerCase();
  } catch {
    lower = ch.toLowerCase();
  }
  return lower.normalize('NFD').replace(MARKS, '');
}

/** The folded form of `text`: decomposed, marks removed, locale lower-cased. */
export function svFoldText(text: string, locale?: string): string {
  return svFoldWithMap(text, locale).folded;
}

/** One original code point and the span it folded to. */
export interface SvFoldSpan {
  /** Original code-unit range. */
  readonly from: number;
  readonly to: number;
  /** Folded code-unit range (empty for a lone combining mark). */
  readonly foldedFrom: number;
  readonly foldedTo: number;
}

/** The folded text and, per original code point, where it went. */
export function svFoldWithMap(text: string, locale?: string): { folded: string; spans: SvFoldSpan[] } {
  const spans: SvFoldSpan[] = [];
  let folded = '';
  let i = 0;
  for (const ch of text) {
    const piece = foldOne(ch, locale);
    spans.push({ from: i, to: i + ch.length, foldedFrom: folded.length, foldedTo: folded.length + piece.length });
    folded += piece;
    i += ch.length;
  }
  return { folded, spans };
}

/**
 * Map a folded range back to whole original characters: from the character
 * whose fold contains `at`, to the last one the range reaches — plus any
 * combining marks that follow it, so an accent is never split from its letter.
 */
export function svUnfoldRange(spans: readonly SvFoldSpan[], at: number, length: number): { from: number; to: number } | null {
  const end = at + length;
  const first = spans.findIndex((s) => s.foldedTo > at && s.foldedFrom <= at);
  if (first < 0) return null;
  let last = first;
  while (last + 1 < spans.length && spans[last + 1].foldedFrom < end) last++;
  while (last + 1 < spans.length && spans[last + 1].foldedFrom === spans[last + 1].foldedTo) last++;
  return { from: spans[first].from, to: spans[last].to };
}

const WORD_START = /[\s\p{P}\p{S}]/u;

/** Folded offsets in `folded` where `needle` matches under `mode` (non-overlapping). */
export function svFoldedHits(folded: string, needle: string, mode: SvTextMatchMode): number[] {
  const hits: number[] = [];
  if (!needle) return hits;
  let from = 0;
  while (from <= folded.length - needle.length) {
    const at = folded.indexOf(needle, from);
    if (at === -1) break;
    if (mode === 'prefix' && at > 0 && !WORD_START.test(folded[at - 1])) {
      from = at + 1;
      continue;
    }
    hits.push(at);
    from = at + needle.length;
  }
  return hits;
}

/** Does `text` contain `query`, accent- and case-folded, under `mode`? */
export function svTextMatches(text: string | null | undefined, query: string, options: SvTextMatchOptions = {}): boolean {
  const needle = svFoldText(query.trim(), options.locale);
  if (!needle) return true;
  if (!text) return false;
  return svFoldedHits(svFoldText(text, options.locale), needle, options.mode ?? 'substring').length > 0;
}
