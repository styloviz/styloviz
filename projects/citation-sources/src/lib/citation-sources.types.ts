export type CitationVariant =
  /** Chips inline in the answer text, each resolving to its passage. */
  | 'inline'
  /** One expanded card per source, with the quoted span. */
  | 'cards'
  /** A side panel listing every source the answer leaned on. */
  | 'panel';

export type SourceKind = 'document' | 'web' | 'database' | 'api' | 'note';

/**
 * A source a claim can be attributed to.
 *
 * ★★ `id` IS THE DOCUMENT, NOT THE CITATION. Five citations of one page share
 * one `SourceRef`; see `CitationSpan` for the part that differs.
 */
export interface SourceRef {
  readonly id: string;
  readonly title: string;
  readonly kind: SourceKind;
  /** Where the reader can go and check. */
  readonly url?: string;
  /** Page, section, timestamp — whatever locates it inside the source. */
  readonly locator?: string;
  /** Retrieval score, when the source came from a retriever. */
  readonly score?: number;
  readonly retrievedAt?: string;
}

/**
 * One citation: a span of the ANSWER, and the passage of the SOURCE it rests on.
 *
 * ★★★ A CITATION THAT POINTS AT A DOCUMENT IS NOT A CITATION. "Source: Refunds
 * policy" names a forty-page PDF; the claim it supports is one sentence. A
 * reader who cannot get from the chip to the sentence cannot check the answer,
 * and an answer nobody can check is an answer nobody should act on — which is
 * the entire problem citations exist to solve.
 */
export interface CitationSpan {
  readonly id: string;
  readonly sourceId: string;
  /** Character offsets into the answer text this citation supports. */
  readonly start: number;
  readonly end: number;
  /** The exact words quoted from the source. */
  readonly quote: string;

  /**
   * The exact words of the ANSWER this citation covers.
   *
   * ★★★ CHARACTER OFFSETS ARE THE WRONG ANCHOR AND EVERY PIPELINE PROVES IT.
   * Trim the answer, collapse a double space, run it through a markdown pass,
   * prepend a greeting — and every offset after the edit is wrong by the same
   * amount, so the chips move off the claims they belong to and nothing fails
   * loudly. Supply this and the citation is placed by *finding its text*, which
   * survives anything that does not change the words.
   *
   * ★★ It is distinct from `quote`: that is what the SOURCE says, this is what
   *    the ANSWER says. They are usually paraphrases of each other, which is
   *    precisely why one cannot stand in for the other.
   */
  readonly anchorText?: string;

  /**
   * The id of the claim this citation supports — one of the `AnswerClaim`s the
   * host passes to `[claims]`.
   *
   * ★★★ THE FIRST ANCHOR, AHEAD OF `anchorText` AND THE OFFSETS. When the host
   *     supplies claims, a citation carrying an id is placed on that claim's
   *     words and nowhere else, and an id that is not among them is reported
   *     as unplaced rather than falling back to arithmetic: "this citation is
   *     about claim 7" is a positive statement, and claim 7 not being in the
   *     answer is news, not a cue to guess.
   *
   * ★★ It is also IDENTITY. The same claim re-worded keeps its id across
   *    re-generations, which is what `(claimsOpened)` hands back so a host can
   *    persist "the reader checked this claim".
   */
  readonly claimId?: string;
}

/**
 * One claim of the answer, as the host's pipeline structured it.
 *
 * ★★ A STRUCTURED SPAN, NOT A PAIR OF OFFSETS. The host produces these from the
 *    answer the reader will actually see — after the markdown pass, the trim and
 *    the greeting — so the claim is found by its words, and its id survives the
 *    next re-generation even when the words change.
 */
export interface AnswerClaim {
  readonly id: string;
  /** The claim's words, exactly as they appear in the rendered answer. */
  readonly text: string;
}
