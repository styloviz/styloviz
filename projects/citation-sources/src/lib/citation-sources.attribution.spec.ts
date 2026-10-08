import {
  SV_UNCITED_MIN_CHARS,
  svResolveUncitedMinChars,
  svCitationCoverage,
  svCoverageLabel,
  svNumberSources,
  svRefLabel,
  svSegmentAnswer,
  svSourceLabel,
} from './citation-sources.attribution';
import type { CitationSpan, SourceRef } from './citation-sources.types';

const source = (id: string, extra: Partial<SourceRef> = {}): SourceRef => ({
  id,
  title: `Source ${id}`,
  kind: 'document',
  ...extra,
});

const cite = (id: string, sourceId: string, start: number, end: number, quote = 'quoted'): CitationSpan => ({
  id,
  sourceId,
  start,
  end,
  quote,
});

const ANSWER =
  'Refunds are available for thirty days. After that the account is credited instead. Escalations go to the billing lead.';

describe('numbering the sources', () => {
  /**
   * ★★★ ONE SOURCE, ONE NUMBER, HOWEVER OFTEN IT IS CITED.
   *
   * Numbering per OCCURRENCE — what you get from mapping over the citation list
   * — turns one page quoted five times into [1][2][3][4][5], and a reader
   * scanning the answer sees five sources agreeing where there is one. The whole
   * point of showing citations is to let somebody judge how well supported a
   * claim is, and this inflates the answer by whatever factor the retriever
   * happened to chunk the document into.
   */
  it('gives one source one number however many times it is cited', () => {
    const numbered = svNumberSources(
      ANSWER,
      [
        cite('c1', 'policy', 0, 36),
        cite('c2', 'policy', 38, 80),
        cite('c3', 'policy', 82, 118),
      ],
      [source('policy')],
    );

    expect(numbered).toHaveLength(1);
    expect(numbered[0].number).toBe(1);
    expect(numbered[0].spanCount).toBe(3);
  });

  /**
   * ★★ NUMBERED BY FIRST APPEARANCE IN THE ANSWER, not by retrieval score or by
   * the order the sources arrived. A reader who meets [3] before [1] assumes
   * they have missed something.
   */
  it('numbers in the order the reader meets them', () => {
    const numbered = svNumberSources(
      ANSWER,
      [cite('c2', 'second', 40, 80), cite('c1', 'first', 0, 36)],
      // Supplied in the other order, and 'second' scores higher.
      [source('second', { score: 0.9 }), source('first', { score: 0.2 })],
    );

    expect(numbered.map((n) => n.source.id)).toEqual(['first', 'second']);
    expect(numbered.map((n) => n.number)).toEqual([1, 2]);
  });

  /**
   * ★★ A CITATION OF A SOURCE NOBODY SUPPLIED IS DROPPED, NOT NUMBERED. A chip
   * that resolves to nothing is worse than no chip: the reader clicks it, gets
   * an empty card, and stops trusting the ones that do work.
   */
  it('drops a citation whose source was never supplied', () => {
    const numbered = svNumberSources(
      ANSWER,
      [cite('c1', 'missing', 0, 36), cite('c2', 'policy', 40, 80)],
      [source('policy')],
    );
    expect(numbered.map((n) => n.source.id)).toEqual(['policy']);
  });

  it('has nothing to number for an answer with no citations', () => {
    expect(svNumberSources(ANSWER, [], [source('policy')])).toEqual([]);
  });

  it('ignores a citation whose range is empty or inverted', () => {
    const numbered = svNumberSources(
      ANSWER,
      [cite('c1', 'policy', 10, 10), cite('c2', 'policy', 30, 5)],
      [source('policy')],
    );
    expect(numbered).toEqual([]);
  });
});

describe('segmenting the answer', () => {
  it('marks the cited run and leaves the rest plain', () => {
    const numbered = svNumberSources(ANSWER, [cite('c1', 'policy', 0, 38)], [source('policy')]);
    const segments = svSegmentAnswer(ANSWER, [cite('c1', 'policy', 0, 38)], numbered);

    expect(segments[0].refs).toEqual([1]);
    expect(segments[0].text).toBe('Refunds are available for thirty days.');
    expect(segments[1].refs).toEqual([]);
  });

  /**
   * ★★★ EVERY CHARACTER OF THE ANSWER APPEARS EXACTLY ONCE.
   *
   * Two citations covering overlapping clauses is ordinary — one retriever hit
   * per chunk, and chunks overlap. Emitting a segment per CITATION renders the
   * overlap twice, so the answer the reader sees is not the answer the model
   * wrote. Cutting on citation boundaries instead makes that impossible however
   * the citations are arranged.
   */
  it('never duplicates or drops text when citations overlap', () => {
    const citations = [cite('c1', 'a', 0, 50), cite('c2', 'b', 30, 80)];
    const numbered = svNumberSources(ANSWER, citations, [source('a'), source('b')]);
    const segments = svSegmentAnswer(ANSWER, citations, numbered);

    expect(segments.map((s) => s.text).join('')).toBe(ANSWER);
    // The overlapping middle carries BOTH references.
    const both = segments.find((s) => s.refs.length === 2);
    expect(both?.refs).toEqual([1, 2]);
  });

  it('reconstructs the answer exactly when citations nest', () => {
    const citations = [cite('c1', 'a', 0, 80), cite('c2', 'b', 20, 40)];
    const numbered = svNumberSources(ANSWER, citations, [source('a'), source('b')]);
    const segments = svSegmentAnswer(ANSWER, citations, numbered);

    expect(segments.map((s) => s.text).join('')).toBe(ANSWER);
    expect(segments.some((s) => s.refs.length === 2)).toBe(true);
  });

  it('returns the whole answer as one plain run when nothing is cited', () => {
    const segments = svSegmentAnswer(ANSWER, [], []);
    expect(segments).toHaveLength(1);
    expect(segments[0].refs).toEqual([]);
    expect(segments[0].text).toBe(ANSWER);
  });

  it('has nothing to segment for an empty answer', () => {
    expect(svSegmentAnswer('', [cite('c1', 'a', 0, 5)], [])).toEqual([]);
  });

  it('clips a citation that runs past the end of the answer', () => {
    const citations = [cite('c1', 'a', 100, 9_999)];
    const numbered = svNumberSources(ANSWER, citations, [source('a')]);
    const segments = svSegmentAnswer(ANSWER, citations, numbered);

    expect(segments.map((s) => s.text).join('')).toBe(ANSWER);
    expect(segments[segments.length - 1].end).toBe(ANSWER.length);
  });
});

describe('coverage', () => {
  /**
   * ★★★ THE UNCITED SENTENCE IN A CITED ANSWER IS THE DANGEROUS ONE.
   *
   * An answer carrying six chips looks thoroughly grounded, and the paragraph
   * between the third and fourth — the one that generalises, or hedges, or
   * invents a figure — carries no chip and is the only part that needed one.
   * Every citation UI draws the eye to what IS sourced.
   */
  it('names the passages that rest on nothing', () => {
    const answer =
      'The refund window is thirty days from the invoice date. ' +
      'We generally waive the fee for enterprise customers who ask nicely, at the agent discretion. ' +
      'Escalations go to the billing lead.';
    const citations = [cite('c1', 'policy', 0, 54), cite('c2', 'policy', 149, answer.length)];

    const coverage = svCitationCoverage(answer, citations, [source('policy')]);

    expect(coverage.uncited).toHaveLength(1);
    expect(coverage.uncited[0].text).toContain('waive the fee');
    expect(coverage.citedPct).toBeLessThan(70);
  });

  /**
   * ★★ A CONNECTIVE IS NOT AN UNSUPPORTED CLAIM. The space between two cited
   * clauses falls outside every span, and flagging it turns the coverage report
   * into a page of noise that hides the one paragraph nobody sourced.
   */
  it('does not report the gap between two adjacent citations as uncited', () => {
    const citations = [cite('c1', 'policy', 0, 36), cite('c2', 'policy', 38, 118)];
    const coverage = svCitationCoverage(ANSWER, citations, [source('policy')]);

    expect(coverage.uncited).toEqual([]);
    expect(coverage.citedPct).toBeGreaterThan(95);
  });

  /**
   * ★★★ LONGEST GAP FIRST, AND IT IS NOT A COSMETIC ORDERING.
   *
   * The coverage list is read from the top and abandoned partway down, like
   * every list. Ordered shortest-first the reader spends their attention on a
   * clause-length gap while the unattributed paragraph — the one that
   * generalises, or invents the figure — sits below the fold. There is no
   * ranking signal available here better than length: a longer unsupported run
   * is more claim, and more claim is more to be wrong about.
   */
  it('puts the longest unattributed passage first, not the earliest', () => {
    const short = 'A short gap that still clears the reporting floor here.';
    const long =
      'A far longer unattributed passage that generalises well beyond anything ' +
      'the retrieved sources actually say, and quotes a figure that appears in ' +
      'none of them, which is exactly the paragraph a reader needs to check first.';
    const answer = `Cited opening clause. ${short} Cited middle clause. ${long}`;

    const openingEnd = 'Cited opening clause.'.length;
    const middleStart = answer.indexOf('Cited middle clause.');
    const citations = [
      cite('c1', 'policy', 0, openingEnd),
      cite('c2', 'policy', middleStart, middleStart + 'Cited middle clause.'.length),
    ];

    const coverage = svCitationCoverage(answer, citations, [source('policy')]);

    expect(coverage.uncited).toHaveLength(2);
    // The long one appears LATER in the answer, so any ordering that survives
    // this is not "document order" wearing a disguise.
    expect(coverage.uncited[0].text).toContain('generalises well beyond');
    expect(coverage.uncited[1].text).toContain('short gap');
    expect(coverage.uncited[0].start).toBeGreaterThan(coverage.uncited[1].start);
  });

  it('starts reporting an uncited run at the length floor', () => {
    const filler = 'x'.repeat(SV_UNCITED_MIN_CHARS);
    const answer = `cited part. ${filler}`;
    const coverage = svCitationCoverage(answer, [cite('c1', 'a', 0, 12)], [source('a')]);

    expect(coverage.uncited).toHaveLength(1);
  });

  /**
   * ★★ DISTINCT SOURCES, NOT CITATION COUNT — the number a reader would
   * otherwise infer by counting chips, which is the inflated one.
   */
  it('reports how many sources there really are alongside how many citations', () => {
    const coverage = svCitationCoverage(
      ANSWER,
      [cite('c1', 'policy', 0, 36), cite('c2', 'policy', 40, 80), cite('c3', 'faq', 82, 118)],
      [source('policy'), source('faq')],
    );

    expect(coverage.citations).toBe(3);
    expect(coverage.sources).toBe(2);
  });

  it('reports an entirely unsourced answer as such', () => {
    const coverage = svCitationCoverage(ANSWER, [], []);
    expect(coverage.citedPct).toBe(0);
    expect(coverage.sources).toBe(0);
    expect(svCoverageLabel(coverage)).toContain('attributed to a source');
  });

  it('has nothing to say about an empty answer', () => {
    const coverage = svCitationCoverage('', [], []);
    expect(coverage.citedPct).toBe(0);
    expect(svCoverageLabel(coverage)).toBe('Nothing to attribute.');
  });

  /**
   * ★★ THE OVERLAP IS COUNTED ONCE. Two citations covering the same clause are
   * two citations and one supported clause; adding their lengths reports more
   * cited characters than the answer contains, and coverage climbs past 100 %.
   */
  it('never reports more than the whole answer as cited', () => {
    const citations = [cite('c1', 'a', 0, 80), cite('c2', 'b', 0, 80), cite('c3', 'a', 10, 60)];
    const coverage = svCitationCoverage(ANSWER, citations, [source('a'), source('b')]);

    expect(coverage.citedChars).toBeLessThanOrEqual(coverage.totalChars);
    expect(coverage.citedPct).toBeLessThanOrEqual(100);
  });
});

describe('labels', () => {
  /**
   * ★★ THE LOCATOR IS PART OF THE CITATION. "Refunds policy" sends the reader to
   * a document; "Refunds policy · p.4" sends them to the paragraph, which is the
   * only version that lets them check anything.
   */
  it('puts the locator in the source label', () => {
    expect(svSourceLabel(source('a', { title: 'Refunds policy', locator: 'p.4' }))).toBe(
      'Refunds policy · p.4',
    );
    expect(svSourceLabel(source('a', { title: 'Refunds policy' }))).toBe('Refunds policy');
  });

  it('collapses several references into one chip', () => {
    expect(svRefLabel([1, 3])).toBe('[1,3]');
    expect(svRefLabel([])).toBe('');
  });

  /**
   * ★★ A PERCENTAGE ALONE INVITES THE WRONG READING. 100 % coverage by ONE
   * source is not thorough grounding; 60 % with four uncited sentences is a
   * specific, actionable complaint.
   */
  it('says how many sources, not just how much coverage', () => {
    const coverage = svCitationCoverage(
      ANSWER,
      [cite('c1', 'policy', 0, ANSWER.length)],
      [source('policy')],
    );
    const label = svCoverageLabel(coverage);

    expect(label).toContain('1 source');
    expect(label).toContain('100%');
  });
});

/**
 * ============================================================================
 *  The uncited-gap floor a host can move (`X-3`)
 * ============================================================================
 *
 * ★★ FORTY CHARACTERS IS A SENTENCE IN ENGLISH PROSE. It is two or three
 *    sentences in Chinese, where a claim fits in a dozen characters, and most
 *    of a bullet in a summary-style answer — so one figure hides unsourced
 *    claims in one language and floods the report with connectives in another.
 *    A floor has to exist (a connective is not an unsupported claim); where it
 *    sits is not this component's to decide.
 */
describe('the uncited-gap floor', () => {
  const gapOf = (chars: number, options?: { uncitedMinChars?: number }) => {
    const answer = `cited part. ${'x'.repeat(chars)}`;
    return svCitationCoverage(answer, [cite('c1', 'a', 0, 12)], [source('a')], options).uncited;
  };

  it('keeps the documented default when the host says nothing', () => {
    expect(svResolveUncitedMinChars()).toBe(SV_UNCITED_MIN_CHARS);
    expect(gapOf(SV_UNCITED_MIN_CHARS - 1)).toHaveLength(0);
    expect(gapOf(SV_UNCITED_MIN_CHARS)).toHaveLength(1);
  });

  it('reports shorter gaps for a language where a claim is shorter', () => {
    expect(gapOf(12)).toHaveLength(0);
    expect(gapOf(12, { uncitedMinChars: 12 })).toHaveLength(1);
  });

  it('ignores longer runs when the host raises the floor', () => {
    expect(gapOf(60)).toHaveLength(1);
    expect(gapOf(60, { uncitedMinChars: 200 })).toHaveLength(0);
  });

  it('falls back to the default for anything that is not a positive length', () => {
    for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(svResolveUncitedMinChars(bad)).toBe(SV_UNCITED_MIN_CHARS);
    }
  });
});
