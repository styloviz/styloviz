/**
 * Pasting a list of things into a control that takes one at a time.
 *
 * ── The defect this exists for (`FI-26-I3` / `FI-26-M3`) ────────────────────
 *
 * ★★★ NEITHER TAG INPUT HAD A PASTE HANDLER AT ALL. Grepped, in both twins:
 *     zero occurrences of `paste` or `clipboard`. So pasting two hundred email
 *     addresses put two hundred addresses in the query box as ONE STRING, and
 *     pressing Enter made a single tag whose label was the entire list — or,
 *     with `allowCreate` off, made nothing and cleared the box.
 *
 * ★★ THE ITEM ASKED "what happens when a paste of 200 emails hits a limit of
 *    50". The answer was that the limit never came into it, because the paste
 *    was never a list.
 *
 * ── ★★★ WHY SPLITTING AND DECIDING ARE TWO FUNCTIONS ───────────────────────
 *
 * Splitting is mechanical and belongs to the clipboard: commas, semicolons,
 * newlines, tabs. Deciding is policy and belongs to the control: which of these
 * already exist, how many fit, what counts as valid. A single function would
 * have to take every policy as a parameter and would still be wrong for the
 * next caller.
 */

/**
 * The delimiter set, written down rather than inferred.
 *
 * ⚠️ SPACE IS NOT A DELIMITER, and that is the decision worth defending.
 *    "Alex Chen" is one name, and a parser that split on whitespace would turn
 *    every pasted person into two broken tags. Mail clients, spreadsheets and
 *    CSV exports all emit one of the four below.
 *
 * ★ A NEWLINE IS A DELIMITER IN BOTH SPELLINGS. A list copied out of Windows
 *   Notepad arrives `\r\n`-separated, and treating `\r` as content leaves an
 *   invisible character on the end of every entry — which then fails an
 *   equality check against the identical-looking entry already in the list.
 */
const DELIMITERS = /[,;\t\r\n]+/;

/**
 * Split pasted text into candidate entries.
 *
 * ★★ QUOTED SEGMENTS SURVIVE THEIR COMMAS. `"Chen, Alex" <a@x.com>` is one
 *    entry in every mail client's clipboard format, and splitting inside the
 *    quotes produces two entries, neither of which is an address. This is the
 *    one piece of structure worth knowing about, because it is the one that
 *    silently produces plausible-looking garbage.
 */
export function svSplitPastedList(text: string): string[] {
  const src = String(text ?? '');
  if (!src.trim()) return [];

  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of Array.from(src)) {
    if (ch === '"') { inQuotes = !inQuotes; current += ch; continue; }
    if (!inQuotes && DELIMITERS.test(ch)) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Why an entry did not make it in.
 *
 * ★★ `ambiguous` IS NOT A KIND OF `invalid`. An entry that matched two options
 *    is one the user wrote correctly and the control cannot act on — "Alex Chen"
 *    when there are two people called Alex Chen. Telling them it was not
 *    recognised sends them to check their spelling; telling them it matched more
 *    than one sends them to disambiguate it, which is the thing that works.
 */
export type SvPasteRejection = 'duplicate' | 'limit' | 'invalid' | 'ambiguous';

export interface SvPasteListResult {
  /** Entries that were added, in the order they appeared. */
  readonly accepted: readonly string[];
  /** Entries that were not, each with the reason. */
  readonly rejected: readonly { readonly text: string; readonly reason: SvPasteRejection }[];
  /** How many entries the text contained. `accepted.length + rejected.length`. */
  readonly total: number;
}

export interface SvApplyPastedOptions {
  /** What is already in the control. */
  readonly existing?: readonly string[];
  /** Cap on the TOTAL, existing included. `0` means no cap. */
  readonly max?: number;
  /** What "already there" means. Defaults to strict equality. */
  readonly compare?: (a: string, b: string) => boolean;
  /** Host's verdict on a single entry. Return `false` to reject it as invalid. */
  readonly validate?: (entry: string) => boolean;
  /**
   * Entries the caller could not resolve to exactly one thing.
   *
   * ★★ Checked FIRST, before duplicate and limit, because an entry that cannot
   *    be resolved is not a candidate for either — reporting it as "already in
   *    the list" would be a claim about a tag that may not exist.
   */
  readonly ambiguous?: (entry: string) => boolean;
}

/**
 * Decide which pasted entries go in, and report every one that does not.
 *
 * ★★★ A PARTIAL ACCEPT IS THE ONLY HONEST ANSWER TO 200-INTO-50. Taking all
 *     200 breaks the host's cap. Taking none punishes the user for the 150 they
 *     could not have known about. Taking 50 silently is the worst of the three,
 *     because the list looks like it worked and 150 addresses are gone. So: 50
 *     in, 150 reported, and the caller says so out loud.
 *
 * ⚠️ ORDER IS PRESERVED AND THE FIRST N WIN. Not "the ones that fit best" —
 *    there is no such thing — and not the last N, which would silently prefer
 *    the bottom of a pasted column.
 *
 * ⚠️ A DUPLICATE INSIDE THE PASTE ITSELF IS A DUPLICATE. Pasting the same
 *    address twice adds it once and reports the second; the alternative is two
 *    identical entries, which is the `FI-26-I1` defect arriving by a different
 *    door.
 */
export function svApplyPastedList(
  entries: readonly string[],
  options: SvApplyPastedOptions = {},
): SvPasteListResult {
  const compare = options.compare ?? ((a, b) => a === b);
  const validate = options.validate;
  const max = options.max ?? 0;

  const accepted: string[] = [];
  const rejected: { text: string; reason: SvPasteRejection }[] = [];
  const taken = [...(options.existing ?? [])];

  const ambiguous = options.ambiguous;

  for (const entry of entries) {
    if (ambiguous?.(entry)) { rejected.push({ text: entry, reason: 'ambiguous' }); continue; }
    if (validate && !validate(entry)) { rejected.push({ text: entry, reason: 'invalid' }); continue; }
    if (taken.some((t) => compare(t, entry))) { rejected.push({ text: entry, reason: 'duplicate' }); continue; }
    // ★ The cap is checked LAST, so an entry that was going to be rejected as a
    //   duplicate is reported as a duplicate rather than as the thing that
    //   happened to be sitting on the boundary.
    if (max > 0 && taken.length >= max) { rejected.push({ text: entry, reason: 'limit' }); continue; }
    accepted.push(entry);
    taken.push(entry);
  }

  return { accepted, rejected, total: accepted.length + rejected.length };
}

/**
 * A sentence a person can act on, or `''` when everything went in.
 *
 * ⚠️ `svPasteListSummary`, NOT `svPasteSummary`. That name is already taken in
 *    this package by the HTML sanitiser's own paste report
 *    (`lib/security/html-sanitizer.ts`), which takes a different type entirely.
 *    The first draft of this file used it, and the duplicate `export { … }` in
 *    `public-api.ts` did not throw — the LATER export simply won, so every
 *    caller in `sv-tag-input` silently got the sanitiser's function and every
 *    summary came back `''`. A unit test cannot see that; the runtime just
 *    picks one. `typecheck:all` is what catches it (TS2308).
 *
 * ★★ IT NAMES THE REASONS SEPARATELY. "150 were not added" tells somebody
 *    nothing about what to do; "50 added, 120 over the limit of 50, 30 already
 *    in the list" tells them to remove some tags or split the paste.
 */
export function svPasteListSummary(result: SvPasteListResult, noun = 'item'): string {
  if (!result.rejected.length) return '';
  const plural = (n: number): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

  const counts = { duplicate: 0, limit: 0, invalid: 0, ambiguous: 0 };
  for (const r of result.rejected) counts[r.reason]++;

  const parts: string[] = [`${plural(result.accepted.length)} added`];
  if (counts.limit) parts.push(`${counts.limit} over the limit`);
  if (counts.duplicate) parts.push(`${counts.duplicate} already in the list`);
  if (counts.ambiguous) parts.push(`${counts.ambiguous} matched more than one option`);
  if (counts.invalid) parts.push(`${counts.invalid} not recognised`);
  return parts.join(', ') + '.';
}
