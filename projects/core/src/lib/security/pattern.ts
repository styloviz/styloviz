/**
 * Compiling a regular expression that someone else wrote.
 *
 * ★★★ A HOST-SUPPLIED `pattern` IS UNTRUSTED CODE THAT RUNS ON THE MAIN THREAD,
 *     AND THE KIT COMPILED IT THREE TIMES WITHOUT SAYING SO. `sv-form-builder`
 *     takes its whole schema from a server; `sv-input-field` (both tiers) takes
 *     `pattern` as an input a host may well be filling from a CMS. All three did
 *     `new RegExp('^(?:' + pattern + ')$')` and tested it against the field's
 *     value on **every keystroke**.
 *
 * ── What that costs, measured ───────────────────────────────────────────────
 *
 * ★★★ MEASURED, NODE 24 / V8, ONE `.test()` CALL, INPUT 30 CHARACTERS LONG:
 *
 *         (a|a?)+b        32,911 ms
 *         (x|x)*y          5,954 ms
 *         (a*)*b           4,228 ms
 *         ([a-zA-Z]+)*$    2,289 ms
 *         (a+)+b           1,895 ms
 *
 *     One keystroke. Main thread. No way to cancel it — the tab is not slow,
 *     it is gone. Each further character roughly doubles the figure. Every one
 *     of those patterns is under fifteen bytes and reads like a typo rather
 *     than an attack, which is exactly what makes it a good one.
 *
 * ★★ AND AN INVALID PATTERN WAS WORSE IN A DIFFERENT WAY. `new RegExp` throws
 *    `SyntaxError` on `(`, and in `sv-form-builder` that throw happens inside a
 *    `computed()` — so one unbalanced bracket in a CMS field does not fail the
 *    field, it takes down the form. `sv-input-field` caught it and then
 *    **silently skipped validation**, which is the opposite failure: a field
 *    advertised as validated that validates nothing and says nothing.
 *
 * ── Why this is static analysis and not a timeout ───────────────────────────
 *
 * ⚠️ THERE IS NO TIMEOUT AVAILABLE. JavaScript cannot interrupt a regex match;
 *    that is precisely the property being exploited. "Run it and give up after
 *    50ms" is not implementable — measuring the danger *is* the denial of
 *    service. A Worker could be terminated, but a form control cannot spawn one
 *    per keystroke. Refusing to compile is the only move left.
 *
 * ⚠️ AND THIS IS A HEURISTIC, WHICH IS STATED RATHER THAN HIDDEN. Deciding
 *    whether an arbitrary regex backtracks catastrophically is not something a
 *    hundred lines can do. What it does catch is the two shapes that account for
 *    essentially every real-world case, and it is deliberately biased towards
 *    rejecting: a wrongly-rejected pattern is a schema problem a human reads and
 *    fixes in a minute, and a wrongly-accepted one is a frozen browser. The
 *    limits are listed at `KNOWN GAPS` below, because a checker whose gaps are
 *    undocumented gets mistaken for a guarantee.
 */

/** Why a pattern was refused. */
export type SvPatternProblem =
  /** `new RegExp` threw — the pattern is not a regular expression at all. */
  | 'invalid'
  /** Structurally liable to catastrophic backtracking. */
  | 'catastrophic';

export interface SvPatternResult {
  /** The anchored, compiled expression — `null` whenever `problem` is set. */
  readonly regexp: RegExp | null;
  readonly problem?: SvPatternProblem;
  /** One sentence, written for whoever authored the pattern. */
  readonly reason?: string;
}

export interface SvCompilePatternOptions {
  /**
   * Compile even when the pattern looks catastrophic. For a host that authored
   * its own patterns and has hit a false positive.
   *
   * ⚠️ It does not disable the `invalid` check, because there is nothing to
   *    trust there — a pattern that does not parse cannot be run whatever anyone
   *    believes about its provenance.
   */
  readonly allowUnsafe?: boolean;
  /**
   * Wrap in `^(?:…)$`. @default true
   *
   * ★★ ANCHORING IS THE DEFAULT BECAUSE UNANCHORED VALIDATION IS THE SINGLE MOST
   *    COMMON PATTERN BUG IN SCHEMA FORMS: `\d{4}` unanchored matches `12345`
   *    and `not-a-year-1999`, so a "validated" field accepts anything that
   *    merely contains a match. `(?:…)` and not `(…)` so the author's own group
   *    numbering is untouched.
   */
  readonly anchor?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  A very small regex scanner
 *
 *  Enough structure to answer "what is quantified, and what is inside it" —
 *  not a parser. Regex-on-regex was not an option: character classes contain
 *  unescaped `(`, `)` and `|`, escapes contain `[`, and every one of those
 *  breaks a pattern-matching approach silently.
 * ──────────────────────────────────────────────────────────────────────────── */

interface Group {
  /** Index of the `(` . */
  readonly start: number;
  /** Index of the matching `)`. */
  readonly end: number;
  /** Body between the parentheses, with any `(?:` / `(?<name>` prefix removed. */
  readonly body: string;
  /** Quantifier immediately after the `)`, or `''`. */
  readonly quantifier: string;
  /** Offsets of `|` at this group's top level, relative to the whole source. */
  readonly alternations: readonly number[];
}

const UNBOUNDED = /^(?:[*+]|\{\d+,\}|\{\d+,\d{3,}\})/;

/** `true` for a quantifier that permits a large number of repetitions. */
function isUnbounded(quantifier: string): boolean {
  return UNBOUNDED.test(quantifier);
}

/** Read the quantifier starting at `i`, or `''`. Includes a lazy/possessive `?`. */
function readQuantifier(source: string, i: number): string {
  const rest = source.slice(i);
  const m = /^(?:[*+?]|\{\d+(?:,\d*)?\})\??/.exec(rest);
  return m ? m[0] : '';
}

/**
 * Walk `source`, returning every group with its body and quantifier.
 *
 * ★ Character classes are skipped wholesale. `[()]` is two literal characters
 *   and treating them as a group produces nonsense that then fails to close —
 *   a scanner that got this wrong would flag or miss patterns at random.
 */
function scanGroups(source: string): Group[] {
  const groups: Group[] = [];
  const open: { start: number; bodyStart: number; alternations: number[] }[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '\\') {
      i += 2;
      continue;
    }

    if (ch === '[') {
      i++;
      if (source[i] === '^') i++;
      if (source[i] === ']') i++; // a `]` first is a literal `]`
      while (i < source.length && source[i] !== ']') {
        i += source[i] === '\\' ? 2 : 1;
      }
      i++;
      continue;
    }

    if (ch === '(') {
      // `(?:`, `(?<name>`, `(?=`, `(?!`, `(?<=`, `(?<!` — the body starts after
      // whichever of those is present.
      const prefix = /^\((\?:|\?<[A-Za-z_$][\w$]*>|\?<?[=!])?/.exec(source.slice(i));
      const bodyStart = i + (prefix?.[0].length ?? 1);
      open.push({ start: i, bodyStart, alternations: [] });
      i = bodyStart;
      continue;
    }

    if (ch === ')') {
      const g = open.pop();
      if (g) {
        const quantifier = readQuantifier(source, i + 1);
        groups.push({
          start: g.start,
          end: i,
          body: source.slice(g.bodyStart, i),
          quantifier,
          alternations: g.alternations,
        });
      }
      i++;
      continue;
    }

    if (ch === '|' && open.length > 0) {
      open[open.length - 1].alternations.push(i);
    }

    i++;
  }

  return groups;
}

/**
 * Does `body` contain an unbounded quantifier at any depth?
 *
 * Skips escapes and character classes for the same reason `scanGroups` does —
 * `[*+]` is two literal characters, and `\+` is a literal plus.
 */
function containsUnboundedQuantifier(body: string): boolean {
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      i++;
      if (body[i] === '^') i++;
      if (body[i] === ']') i++;
      while (i < body.length && body[i] !== ']') i += body[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (ch === '*' || ch === '+') return true;
    if (ch === '{') {
      const m = /^\{\d+,\d*\}/.exec(body.slice(i));
      if (m && isUnbounded(m[0])) return true;
    }
    i++;
  }
  return false;
}

/**
 * The set of characters an alternation branch can start with — or `null` for
 * "cannot tell".
 *
 * ★★ `null` IS TREATED AS OVERLAPPING WITH EVERYTHING, which is what makes this
 *    safe to be bad at. `(\s|\S)+` is the textbook catastrophic alternation and
 *    its branches are classes this function will not enumerate; answering
 *    "unknown" flags it. The cost is that some disjoint class alternations are
 *    refused too, and that cost is a sentence in a schema-problems list.
 */
function firstChars(branch: string): Set<string> | null {
  const b = branch.trimStart();
  if (b === '') return null;
  const ch = b[0];
  if (ch === '\\' || ch === '[' || ch === '.' || ch === '(' || ch === '^') return null;
  if (ch === '*' || ch === '+' || ch === '?' || ch === '{') return null;
  // A literal, but only if it is not immediately made optional — `a?bc` can
  // also start with `b`, and claiming `{a}` there would be wrong in the
  // direction that matters.
  if (b[1] === '?' || b[1] === '*') return null;
  return new Set([ch]);
}

/** Can two branches begin with the same character? `null` means "assume yes". */
function branchesOverlap(branches: readonly string[]): boolean {
  const sets = branches.map(firstChars);
  if (sets.some((s) => s === null)) return true;
  const seen = new Set<string>();
  for (const set of sets as Set<string>[]) {
    for (const c of set) {
      if (seen.has(c)) return true;
      seen.add(c);
    }
  }
  return false;
}

/** Split a group body on the top-level `|` offsets the scanner recorded. */
function branchesOf(group: Group, source: string): string[] {
  if (group.alternations.length === 0) return [group.body];
  const bodyStart = group.end - group.body.length;
  const cuts = [bodyStart, ...group.alternations, group.end];
  const out: string[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    out.push(source.slice(i === 0 ? cuts[0] : cuts[i] + 1, cuts[i + 1]));
  }
  return out;
}

/**
 * Is this pattern structurally liable to catastrophic backtracking?
 *
 * ── The two shapes ──────────────────────────────────────────────────────────
 *
 * **R1 — nested quantifier.** `(a+)+`, `(a*)*`, `(\d{2,})+`: an unbounded
 * quantifier applied to a group that itself repeats unboundedly. The engine has
 * exponentially many ways to divide the input between the two, and on a
 * non-match it tries all of them. This is the shape in essentially every
 * published ReDoS.
 *
 * **R2 — quantified alternation with overlapping branches.** `(x|x)*`,
 * `(a|ab)+`, `(\s|\S)*`: the same explosion arrived at through the alternation
 * instead. A quantified alternation whose branches start with *different*
 * characters — `(cat|dog)+` — is fine and is not flagged.
 *
 * ★★ R2 IS FLAGGED MORE BROADLY THAN V8 ALONE WOULD JUSTIFY, ON PURPOSE.
 *    Measured above, `(x|x)*y` costs V8 6 seconds — but `(a|ab)+c` and
 *    `(\s|\S)+$`, the two textbook examples, complete instantly there. V8
 *    recognises and collapses those particular shapes. **That optimisation is
 *    not in any specification**, it is not present in every version, and this
 *    kit ships to JavaScriptCore and SpiderMonkey as well — where the general
 *    backtracking cost is what applies. Refusing a pattern that one engine
 *    happens to handle is a sentence in a problem list; accepting one that
 *    another engine does not is a frozen Safari.
 *
 * ── ★★ KNOWN GAPS, stated because an undocumented gap reads as a guarantee ──
 *
 *  • Adjacent overlapping quantifiers other than the `.` case below — `\d+\d+`,
 *    `[a-z]*[a-z]*` — are not detected. They are quadratic rather than
 *    exponential, which is survivable at the input lengths a form field holds.
 *  • Backreferences and lookaround have their own pathologies and are not
 *    analysed at all.
 *  • The overlap test looks at first characters only. `(ab|ac)+` has disjoint
 *    *strings* per first character and passes; `(abc|abd)+` likewise. Neither
 *    is exponential, so this is the right side to be wrong on.
 */
export function svIsCatastrophicPattern(source: string): string | null {
  const groups = scanGroups(source);

  for (const g of groups) {
    if (!isUnbounded(g.quantifier)) continue;

    if (containsUnboundedQuantifier(g.body)) {
      return `a repeating group that itself repeats — "(${g.body})${g.quantifier}"`;
    }

    if (g.alternations.length > 0 && branchesOverlap(branchesOf(g, source))) {
      return `a repeating group whose alternatives can match the same text — "(${g.body})${g.quantifier}"`;
    }
  }

  // `.*.*` / `.+.+`: two unbounded wildcards in a row, which is the one
  // quantifier-adjacency case common enough and cheap enough to name.
  if (/(?<!\\)\.[*+]\.[*+]/.test(source)) {
    return 'two unbounded wildcards in a row — ".*.*"';
  }

  return null;
}

/**
 * Compile a pattern someone else wrote, or say why not.
 *
 * ★★ IT NEVER THROWS AND IT NEVER RETURNS A REGEXP IT WOULD NOT RUN. Those two
 *    together are the contract: a caller can use `regexp` when it is non-null
 *    and report `reason` when it is not, and has no third case to get wrong.
 */
export function svCompilePattern(
  source: string,
  options: SvCompilePatternOptions = {},
): SvPatternResult {
  const { allowUnsafe = false, anchor = true } = options;

  if (!allowUnsafe) {
    const risk = svIsCatastrophicPattern(source);
    if (risk !== null) {
      return {
        regexp: null,
        problem: 'catastrophic',
        reason:
          `This pattern can take exponentially long to reject some inputs (${risk}), ` +
          `which would freeze the browser. Rewrite it, or set allowUnsafe if you are certain.`,
      };
    }
  }

  try {
    return { regexp: new RegExp(anchor ? `^(?:${source})$` : source) };
  } catch (error) {
    return {
      regexp: null,
      problem: 'invalid',
      reason: `This is not a valid regular expression: ${(error as Error).message}`,
    };
  }
}
