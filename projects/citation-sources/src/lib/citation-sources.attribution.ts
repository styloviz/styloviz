import type { AnswerClaim, CitationSpan, SourceRef } from './citation-sources.types';

/**
 * `sv-citation-sources` — what an answer is actually resting on.
 *
 * ★★★ CITATIONS ARE SHOWN TO MAKE AN ANSWER CHECKABLE, AND ALMOST EVERY
 * IMPLEMENTATION MAKES IT LESS SO.
 *
 * Three failures, all of them arithmetic:
 *
 *   A chip that names a document rather than a passage cannot be checked at all
 *   — "Refunds policy" is forty pages and the claim is one sentence.
 *
 *   The same source cited five times, numbered [1][2][3][4][5], reads as five
 *   independent sources agreeing. It is one page, quoted five times, and the
 *   reader has been shown corroboration that does not exist.
 *
 *   And the sentence with NO chip beside it is the one worth reading, which is
 *   precisely the one every citation UI draws no attention to.
 */

/** A run of the answer text, either supported by citations or not. */
export interface SvAnswerSegment {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  /** Reference NUMBERS (1-based) attached to this run, in ascending order. */
  readonly refs: readonly number[];
}

/** A source, numbered for display, with everything cited from it. */
export interface SvNumberedSource {
  /** 1-based, assigned in order of first appearance in the answer. */
  readonly number: number;
  readonly source: SourceRef;
  readonly citations: readonly CitationSpan[];
  /** How many distinct spans of the answer rest on this source. */
  readonly spanCount: number;
}

export interface SvCitationCoverage {
  /** Characters of the answer inside at least one citation span. */
  readonly citedChars: number;
  readonly totalChars: number;
  readonly citedPct: number;
  /** Runs of the answer with nothing behind them, longest first. */
  readonly uncited: readonly SvAnswerSegment[];
  /** Distinct sources — NOT the citation count. */
  readonly sources: number;
  readonly citations: number;
}

/**
 * Stretches shorter than this are not reported as uncited.
 *
 * ★★ A CONNECTIVE IS NOT AN UNSUPPORTED CLAIM. "and", ". However, " and the
 * space between two cited clauses all fall outside every span, and flagging
 * them turns a coverage report into a page of noise that hides the one
 * paragraph nobody sourced. Whole sentences are the unit worth reporting.
 */
export const SV_UNCITED_MIN_CHARS = 40;

/**
 * Host override for the line above (`X-3`).
 *
 * ★★ FORTY CHARACTERS IS A SENTENCE IN ENGLISH PROSE. It is two or three
 *    sentences in Chinese, where a claim fits in a dozen characters, and it is
 *    most of a bullet in a summary-style answer — so the same figure hides
 *    unsourced claims in one language and floods the report with connectives
 *    in another. The default is reasoned for English paragraphs; it is not a
 *    fact about text.
 */
export interface SvCitationCoverageOptions {
  /** Shortest uncited stretch worth reporting. @default 40 */
  readonly uncitedMinChars?: number;
}

/** The uncited-gap floor, resolved. */
export function svResolveUncitedMinChars(minChars?: number): number {
  return typeof minChars === 'number' && Number.isFinite(minChars) && minChars > 0
    ? minChars
    : SV_UNCITED_MIN_CHARS;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * How a citation ended up where it is.
 *
 * - `anchor` — its `anchorText` was found in the answer. The reliable one.
 *   A citation placed on its claim's words (see `SvPlacedCitation.claimId`)
 *   is also `anchor`: it is anchored to text, the claim's.
 * - `offsets` — no anchor text, so the supplied offsets were used as given.
 * - `drifted` — it has anchor text, the text was found, and the offsets said
 *   somewhere else. The pipeline transformed the answer after the citations were
 *   computed, and the anchor won.
 * - `unplaced` — anchor text supplied and NOT found, or a claim id that is not
 *   among the host's claims. The citation is dropped, and that is said out loud.
 */
export type SvCitationPlacement = 'anchor' | 'offsets' | 'drifted' | 'unplaced';

export interface SvPlacedCitation {
  readonly citation: CitationSpan;
  readonly start: number;
  readonly end: number;
  readonly placement: SvCitationPlacement;
  /**
   * Set only when the citation was placed by its claim id — the id of the
   * `AnswerClaim` whose words it now sits on. Its `placement` is then `anchor`.
   */
  readonly claimId?: string;
}

export interface SvCitationPlacements {
  /** Citations that landed somewhere, clipped to the answer. */
  readonly placed: readonly SvPlacedCitation[];
  /** Citations whose claim or anchor text is not in this answer. */
  readonly unplaced: readonly CitationSpan[];
  /**
   * Of `unplaced`, how many named a claim the answer no longer contains.
   * Absent is read as 0.
   */
  readonly missingClaims?: number;
  /** How many anchor-placed citations disagreed with their own offsets. */
  readonly drifted: number;
}

/**
 * Place every citation, preferring its text over its arithmetic.
 *
 * ★★★ THE FAILURE THIS EXISTS TO MAKE LOUD. Any markdown pass, trim or
 *     normalisation after the citations were computed shifts every offset by the
 *     same amount, so the chips slide off the claims they belong to — and the
 *     old code clipped them silently, which means an answer whose citations had
 *     all moved one sentence to the left looked exactly like a correctly cited
 *     one. `anchorText` survives anything that does not change the words, and a
 *     citation whose words are gone is reported rather than quietly dropped.
 *
 * ★★ THE FIRST OCCURRENCE WINS when the anchor text appears more than once. A
 *    repeated sentence is genuinely ambiguous and any choice is a guess; the
 *    first is at least the same guess every render, so the chip does not move
 *    around between paints.
 *
 * ★★★ A CLAIM ID IS TRIED FIRST — before the anchor text, before the offsets —
 *     whenever the host supplied `claims`. An id that is not among them makes
 *     the citation unplaced; it does NOT fall through to the arithmetic, because
 *     "this supports claim 7" is a positive statement and claim 7 being gone
 *     from the answer is exactly what the reader needs to hear. With no claims
 *     supplied the id is identity only, so hosts that have not adopted
 *     structured claims keep the anchor-then-offsets behaviour unchanged.
 *     Offsets that disagree with a resolved claim are not counted as drift:
 *     the host moved to claims so the offsets could stop mattering.
 */
export function svPlaceCitations(
  answer: string,
  citations: readonly CitationSpan[],
  claims: readonly AnswerClaim[] = [],
): SvCitationPlacements {
  const length = answer.length;
  const placed: SvPlacedCitation[] = [];
  const unplaced: CitationSpan[] = [];
  const claimText = new Map(claims.map((cl) => [cl.id, cl.text]));
  let drifted = 0;
  let missingClaims = 0;

  for (const c of citations) {
    if (c.claimId && claimText.size > 0) {
      const words = claimText.get(c.claimId) ?? '';
      const at = words ? answer.indexOf(words) : -1;
      if (at === -1) {
        unplaced.push(c);
        missingClaims++;
      } else {
        placed.push({
          citation: c,
          start: at,
          end: at + words.length,
          placement: 'anchor',
          claimId: c.claimId,
        });
      }
      continue;
    }
    const anchor = c.anchorText;
    if (anchor) {
      const at = answer.indexOf(anchor);
      if (at === -1) {
        unplaced.push(c);
        continue;
      }
      const end = at + anchor.length;
      // ★ Compared against the RAW offsets, not the clipped ones: clipping can
      //   make a wildly wrong offset look adjacent to the anchor by accident.
      const agrees = c.start === at && c.end === end;
      if (!agrees) drifted++;
      if (end > at) {
        placed.push({ citation: c, start: at, end, placement: agrees ? 'anchor' : 'drifted' });
      }
      continue;
    }
    const start = clamp(c.start, 0, length);
    const end = clamp(c.end, 0, length);
    if (end > start) placed.push({ citation: c, start, end, placement: 'offsets' });
  }

  return { placed, unplaced, missingClaims, drifted };
}

/**
 * What to tell the reader when the citations did not all land.
 *
 * ★★★ AN ANSWER WHOSE CITATIONS MOVED IS WORSE THAN AN UNCITED ONE, because it
 * looks checked. Silence here is the bug this component was written to expose,
 * so the sentence names the count and says the answer was changed after the
 * citations were computed — which is the actual fault, and the only thing that
 * points an integrator at their own pipeline.
 */
export function svPlacementLabel(placements: SvCitationPlacements): string {
  const { unplaced, drifted } = placements;
  const missingClaims = Math.min(Math.max(placements.missingClaims ?? 0, 0), unplaced.length);
  if (unplaced.length === 0 && drifted === 0) return '';
  const parts: string[] = [];
  if (missingClaims > 0) {
    parts.push(
      `${missingClaims} citation${missingClaims === 1 ? '' : 's'} ${missingClaims === 1 ? 'names a claim' : 'name claims'} that ${missingClaims === 1 ? 'is' : 'are'} not in this answer`,
    );
  }
  const lost = unplaced.length - missingClaims;
  if (lost > 0) {
    parts.push(`${lost} citation${lost === 1 ? '' : 's'} could not be located in this answer`);
  }
  if (drifted > 0) {
    parts.push(
      `${drifted} ${drifted === 1 ? 'was' : 'were'} re-anchored to ${drifted === 1 ? 'its' : 'their'} quoted text`,
    );
  }
  return `${parts.join(', and ')} — the answer was changed after the citations were computed.`;
}

/** Citations with impossible or empty ranges dropped, clipped to the answer. */
function usable(citations: readonly CitationSpan[], length: number): readonly CitationSpan[] {
  return citations
    .map((c) => ({ ...c, start: clamp(c.start, 0, length), end: clamp(c.end, 0, length) }))
    .filter((c) => c.end > c.start);
}

/**
 * Citations as the rest of this module wants them: placed, with the resolved
 * offsets written back onto the span.
 *
 * ★★ THE REST OF THE MODULE STAYS OFFSET-BASED ON PURPOSE. Numbering,
 *    segmentation and coverage are all arithmetic over ranges, and they are
 *    correct arithmetic; the bug was never in them, it was in where the ranges
 *    came from. Resolving once, here, keeps one definition of "where this
 *    citation is" instead of teaching four functions about anchors.
 */
export function svAnchoredCitations(
  answer: string,
  citations: readonly CitationSpan[],
  claims: readonly AnswerClaim[] = [],
): readonly CitationSpan[] {
  return svPlaceCitations(answer, citations, claims).placed.map((p) => ({
    ...p.citation,
    start: p.start,
    end: p.end,
  }));
}

/**
 * Number the sources, in order of first appearance.
 *
 * ★★★ ONE SOURCE, ONE NUMBER, HOWEVER OFTEN IT IS CITED. Numbering per
 * OCCURRENCE — which is what you get from mapping over the citation list — turns
 * one page quoted five times into `[1][2][3][4][5]`, and a reader scanning the
 * answer sees five sources agreeing where there is one. That is not a cosmetic
 * difference: the whole reason to show citations is to let somebody judge how
 * well supported a claim is, and this inflates the answer to that question by
 * whatever factor the retriever happened to chunk the document into.
 *
 * ★★ Ordered by first appearance in the ANSWER, not by retrieval score or by
 * the order the sources arrived. A reader meeting `[3]` before `[1]` assumes
 * they have missed something.
 */
export function svNumberSources(
  answer: string,
  citations: readonly CitationSpan[],
  sources: readonly SourceRef[],
): readonly SvNumberedSource[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const live = [...usable(citations, answer.length)].sort((a, b) => a.start - b.start);

  const order: string[] = [];
  const grouped = new Map<string, CitationSpan[]>();
  for (const c of live) {
    if (!byId.has(c.sourceId)) continue; // a citation of a source nobody supplied
    if (!grouped.has(c.sourceId)) {
      grouped.set(c.sourceId, []);
      order.push(c.sourceId);
    }
    grouped.get(c.sourceId)!.push(c);
  }

  return order.map((id, i) => ({
    number: i + 1,
    source: byId.get(id)!,
    citations: grouped.get(id)!,
    spanCount: grouped.get(id)!.length,
  }));
}

/**
 * Split the answer into cited and uncited runs.
 *
 * ★★★ OVERLAPPING CITATIONS MUST NOT SPLIT A SENTENCE INTO CONFETTI. Two
 * citations covering "the refund window is thirty days" and "thirty days of the
 * invoice date" overlap, and the naive implementation — emit a segment per
 * citation — renders the overlap twice, so the answer the reader sees is not the
 * answer the model wrote. Segmenting on citation BOUNDARIES instead means every
 * character of the answer appears exactly once, whatever the citations do.
 */
export function svSegmentAnswer(
  answer: string,
  citations: readonly CitationSpan[],
  numbered: readonly SvNumberedSource[],
): readonly SvAnswerSegment[] {
  if (answer.length === 0) return [];

  const numberOf = new Map<string, number>();
  for (const n of numbered) for (const c of n.citations) numberOf.set(c.id, n.number);

  const live = usable(citations, answer.length).filter((c) => numberOf.has(c.id));
  if (live.length === 0) {
    return [{ text: answer, start: 0, end: answer.length, refs: [] }];
  }

  // Every boundary any citation introduces, plus the two ends of the answer.
  const cuts = new Set<number>([0, answer.length]);
  for (const c of live) {
    cuts.add(c.start);
    cuts.add(c.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: SvAnswerSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const refs = [
      ...new Set(
        live.filter((c) => c.start <= start && c.end >= end).map((c) => numberOf.get(c.id)!),
      ),
    ].sort((a, b) => a - b);
    segments.push({ text: answer.slice(start, end), start, end, refs });
  }
  return segments;
}

/**
 * How much of the answer is actually supported.
 *
 * ★★★ THE UNCITED SENTENCE IN A CITED ANSWER IS THE DANGEROUS ONE. An answer
 * carrying six chips looks thoroughly grounded, and the paragraph between the
 * third and fourth chip — the one that generalises, or hedges, or invents a
 * figure — carries no chip at all and is the only part that needed one. Every
 * citation UI draws the eye to the parts that ARE sourced; this is the number
 * that points at the rest.
 */
export function svCitationCoverage(
  answer: string,
  citations: readonly CitationSpan[],
  sources: readonly SourceRef[],
  options?: SvCitationCoverageOptions,
): SvCitationCoverage {
  const uncitedMinChars = svResolveUncitedMinChars(options?.uncitedMinChars);
  const numbered = svNumberSources(answer, citations, sources);
  const segments = svSegmentAnswer(answer, citations, numbered);

  const citedChars = segments.filter((s) => s.refs.length > 0).reduce((n, s) => n + s.text.length, 0);
  const total = answer.length;

  const uncited = segments
    .filter((s) => s.refs.length === 0 && s.text.trim().length >= uncitedMinChars)
    .sort((a, b) => b.text.length - a.text.length);

  return {
    citedChars,
    totalChars: total,
    citedPct: total > 0 ? (citedChars / total) * 100 : 0,
    uncited,
    // ★★ DISTINCT SOURCES, not citation count — the number the reader would
    // otherwise infer from counting chips, which is the inflated one.
    sources: numbered.length,
    citations: usable(citations, answer.length).length,
  };
}

/**
 * A short, checkable label for a source.
 *
 * ★★ THE LOCATOR IS PART OF THE CITATION, not a nicety. "Refunds policy" sends
 * the reader to a document; "Refunds policy · p.4" sends them to the paragraph.
 */
export function svSourceLabel(source: SourceRef): string {
  return source.locator ? `${source.title} · ${source.locator}` : source.title;
}

/** `[1]`, `[1,3]` — the chip text for a run of the answer. */
export function svRefLabel(refs: readonly number[]): string {
  return refs.length === 0 ? '' : `[${refs.join(',')}]`;
}

/**
 * Coverage, described.
 *
 * ★★ A PERCENTAGE ALONE INVITES THE WRONG READING. 100 % coverage of a
 * three-sentence answer by one source is not thorough grounding, it is one
 * source; and 60 % with four uncited sentences is a specific, actionable
 * complaint. The words carry what the number cannot.
 */
export function svCoverageLabel(coverage: SvCitationCoverage): string {
  if (coverage.totalChars === 0) return 'Nothing to attribute.';
  if (coverage.sources === 0) {
    return 'Nothing in this answer is attributed to a source.';
  }
  const pct = Math.round(coverage.citedPct);
  const src = `${coverage.sources} source${coverage.sources === 1 ? '' : 's'}`;
  if (coverage.uncited.length === 0) {
    return `${pct}% of this answer is attributed, across ${src}.`;
  }
  const n = coverage.uncited.length;
  return `${pct}% of this answer is attributed, across ${src}. ${n} passage${n === 1 ? '' : 's'} rest${n === 1 ? 's' : ''} on nothing — those are the ones to read.`;
}

// ── Link safety ──────────────────────────────────────────────────────────────

/**
 * Schemes a source link may use.
 *
 * ★★★ A SOURCE URL IS MODEL OUTPUT, WHICH IS UNTRUSTED INPUT. A retriever
 *     returns what the index holds and a model returns what it generated, and
 *     either can hand this component `javascript:fetch('/api/keys')…`. Angular
 *     renders that as `unsafe:javascript:…` — a dead link, which is safe and
 *     also silent: the reader clicks, nothing happens, and nobody learns that
 *     the citation was fabricated.
 *
 * ★★ `mailto:` IS IN THE LIST AND `tel:`, `file:` AND `data:` ARE NOT. A source
 *    is a thing you can go and read; a phone number is not, a `file:` path is
 *    the reader's own disk, and a `data:` URL is content pretending to be a
 *    citation — it cannot be checked against anything, which is the one thing a
 *    citation has to allow.
 */
export const SV_SOURCE_URL_PROTOCOLS: readonly string[] = Object.freeze([
  'http:',
  'https:',
  'mailto:',
]);

export interface SvSourceLink {
  /** Safe to put in an `href`, or `null` when it is not. */
  readonly href: string | null;
  /** The scheme as parsed, lowercased, or `''` when it could not be parsed. */
  readonly protocol: string;
  /** Why the link was withheld, or `''` when it was not. */
  readonly reason: string;
}

/**
 * Decide whether a source's URL may be linked.
 *
 * ★★ A REFUSED URL IS STILL SHOWN, AS TEXT. The reader needs to know the answer
 *    cited something unreachable — that is evidence about the answer — and text
 *    cannot be clicked. Hiding it would leave a source that silently has no way
 *    to check it, which is indistinguishable from a source with no URL at all.
 *
 * ★ Protocol-relative and relative URLs are refused rather than resolved. This
 *   component does not know the host's base URL, and guessing it is how a
 *   citation ends up pointing at the app's own routes.
 */
export function svSourceLink(
  url: string | undefined,
  allowed: readonly string[] = SV_SOURCE_URL_PROTOCOLS,
): SvSourceLink {
  const raw = (url ?? '').trim();
  if (raw === '') return { href: null, protocol: '', reason: '' };

  let protocol = '';
  try {
    protocol = new URL(raw).protocol.toLowerCase();
  } catch {
    return {
      href: null,
      protocol: '',
      reason: 'This source has no usable address — the link was not a complete URL.',
    };
  }

  const list = allowed.length > 0 ? allowed : SV_SOURCE_URL_PROTOCOLS;
  const permitted = list.map((p) => (p.endsWith(':') ? p : `${p}:`).toLowerCase());
  if (!permitted.includes(protocol)) {
    return {
      href: null,
      protocol,
      reason: `This source's address uses "${protocol}", which is not linked here. Read it below and check it yourself.`,
    };
  }
  return { href: raw, protocol, reason: '' };
}
