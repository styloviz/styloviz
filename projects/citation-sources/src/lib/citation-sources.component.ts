import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import {
  SV_UNCITED_MIN_CHARS,
  svAnchoredCitations,
  svCitationCoverage,
  svCoverageLabel,
  svNumberSources,
  svPlaceCitations,
  svPlacementLabel,
  svSourceLink,
  SV_SOURCE_URL_PROTOCOLS,
  svRefLabel,
  svSegmentAnswer,
  svSourceLabel,
  type SvAnswerSegment,
  type SvCitationPlacement,
  type SvNumberedSource,
} from './citation-sources.attribution';
import type {
  AnswerClaim,
  CitationSpan,
  CitationVariant,
  SourceKind,
  SourceRef,
} from './citation-sources.types';

/**
 * Sample data, for showcases and tests.
 *
 * ★★ IT CONTAINS AN UNCITED PARAGRAPH ON PURPOSE. A demo where every sentence
 * carries a chip shows a tidy wall of blue and makes the opposite argument: the
 * point of the coverage figure is the passage nobody sourced, so the sample has
 * one — the sentence that generalises about enterprise customers, which is
 * exactly the kind of claim a model adds and nobody checks. The policy source is
 * also cited twice, so the numbering has something to deduplicate.
 */
export const DEMO_ANSWER =
  'A refund can be requested within thirty days of the invoice date. After that window the account is credited rather than refunded to the card. ' +
  'We generally waive the restocking fee for enterprise customers, at the agent’s discretion. ' +
  'Chargebacks opened with the card issuer suspend the account until they are resolved.';

export const DEMO_SOURCES: readonly SourceRef[] = [
  {
    id: 'policy',
    title: 'Refunds policy',
    kind: 'document',
    locator: 'p.4',
    url: 'https://example.internal/handbook/refunds#p4',
    score: 0.91,
    retrievedAt: '09:41',
  },
  {
    id: 'disputes',
    title: 'Chargebacks & disputes',
    kind: 'document',
    locator: 'p.6',
    url: 'https://example.internal/handbook/disputes#p6',
    score: 0.78,
    retrievedAt: '09:41',
  },
];

export const DEMO_CITATIONS: readonly CitationSpan[] = [
  {
    id: 'c1',
    sourceId: 'policy',
    start: 0,
    end: 65,
    quote: 'A refund may be requested within thirty days of the invoice date.',
  },
  {
    id: 'c2',
    sourceId: 'policy',
    start: 66,
    end: 141,
    quote: 'Requests after that window are handled as account credit rather than a card refund.',
  },
  {
    id: 'c3',
    sourceId: 'disputes',
    start: 234,
    end: DEMO_ANSWER.length,
    quote: 'A chargeback opened with the card issuer suspends the account until it is resolved.',
  },
];

/**
 * `<sv-citation-sources>` — an answer, and what it actually rests on.
 *
 * ★★★ CITATIONS EXIST TO MAKE AN ANSWER CHECKABLE, AND ALMOST EVERY
 * IMPLEMENTATION MAKES IT LESS SO. A chip that names a document rather than a
 * passage cannot be checked; one source cited five times and numbered
 * `[1][2][3][4][5]` shows corroboration that does not exist; and the sentence
 * with no chip beside it — the one that generalises, or hedges, or invents a
 * figure — is the only part that needed one.
 */
@Component({
  selector: 'sv-citation-sources',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, SvIconComponent, SvEmptyShellComponent, SvErrorShellComponent, SvSkeletonShellComponent],
  templateUrl: './citation-sources.component.html',
})
export class SvCitationSourcesComponent {
  private readonly uid = svUniqueId('sv-cite');

  // ── Async state ───────────────────────────────────────────────────────────

  /** True while the answer is being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalise an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Presentation: inline chips, source cards, or a sources panel. @default 'inline' */
  readonly variant = input<CitationVariant>('inline');

  /** The answer text the citations point into. @default '' */
  readonly answer = input<string>('');

  /**
   * The citations, each carrying the span of the ANSWER it supports and the
   * passage of the source it rests on.
   * @default []
   */
  readonly citations = input<readonly CitationSpan[]>([]);

  /** The sources those citations resolve to. @default [] */
  readonly sources = input<readonly SourceRef[]>([]);

  /**
   * The answer's claims, as the host's pipeline structured them — an id and the
   * claim's words as rendered.
   *
   * ★★★ SUPPLY THESE AND A CITATION'S `claimId` IS ITS ANCHOR, ahead of
   *     `anchorText` and the offsets. A claim id that is not in this list is
   *     reported in the placement notice as a claim the answer no longer
   *     contains — never quietly re-placed by arithmetic. Leave it empty and
   *     `claimId` is identity only, handed back through `(claimsOpened)`.
   * @default []
   */
  readonly claims = input<readonly AnswerClaim[]>([]);

  /**
   * Show the coverage strip.
   *
   * ★★ On by default, because the figure it carries — how much of the answer is
   * attributed, and which passages are not — is the one thing a citation UI
   * cannot show by drawing chips.
   * @default true
   */
  readonly showCoverage = input<boolean>(true);

  /**
   * URL schemes a source link may use.
   *
   * ★★★ A SOURCE URL IS MODEL OUTPUT, WHICH IS UNTRUSTED INPUT. A retriever
   *     returns what the index holds and a model returns what it generated, and
   *     either can hand this component a `javascript:` URL. Angular renders that
   *     as a dead `unsafe:` link, which is safe and also silent — the reader
   *     clicks, nothing happens, and nobody learns the citation was fabricated.
   *     A refused URL is shown as text instead, with the scheme named: that the
   *     answer cited something unreachable is evidence about the answer.
   * @default ['http:', 'https:', 'mailto:']
   */
  readonly allowedUrlProtocols = input<readonly string[]>(SV_SOURCE_URL_PROTOCOLS);

  /** The reader activated a citation chip or a source card. */
  readonly sourceSelect = output<SourceRef>();

  /**
   * The reader opened a source's passages; carries the distinct `claimId`s of
   * the citations now on screen. Emitted only on open, and only when at least
   * one of them carries an id.
   *
   * ★★ THIS IS HOW A HOST PERSISTS "THE READER CHECKED THIS". A claim id survives
   *    re-generation where offsets and wording do not, so the record still
   *    points at the right claim after the answer is rewritten.
   */
  readonly claimsOpened = output<readonly string[]>();

  // ── State ─────────────────────────────────────────────────────────────────

  /** Source id whose passage is expanded, or `null`. */
  readonly openSourceId = signal<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Where every citation actually landed.
   *
   * ★★★ RESOLVED ONCE, HERE. Numbering, segmentation and coverage are all
   *     arithmetic over ranges and they were never the bug — the bug was where
   *     the ranges came from. Anything with `anchorText` is placed by finding
   *     its words, which survives a trim, a markdown pass or a prepended
   *     greeting; anything without keeps the offsets it was given.
   */
  readonly placements = computed(() =>
    svPlaceCitations(this.answer(), this.citations(), this.claims()),
  );

  /**
   * How each placed citation was resolved, by citation id — `claim` when its
   * claim id placed it, otherwise its `SvCitationPlacement`.
   */
  private readonly placementById = computed(
    () =>
      new Map<string, SvCitationPlacement | 'claim'>(
        this.placements().placed.map((p) => [p.citation.id, p.claimId ? 'claim' : p.placement]),
      ),
  );

  /** Non-empty when a citation moved or vanished. Rendered, not swallowed. */
  readonly placementLabel = computed(() => svPlacementLabel(this.placements()));

  /** The citations with their resolved offsets, for everything downstream. */
  private readonly anchored = computed(() =>
    svAnchoredCitations(this.answer(), this.citations(), this.claims()),
  );

  readonly numbered = computed<readonly SvNumberedSource[]>(() =>
    svNumberSources(this.answer(), this.anchored(), this.sources()),
  );

  readonly segments = computed<readonly SvAnswerSegment[]>(() =>
    svSegmentAnswer(this.answer(), this.anchored(), this.numbered()),
  );

  readonly coverage = computed(() =>
    svCitationCoverage(this.answer(), this.anchored(), this.sources(), {
      uncitedMinChars: this.uncitedMinChars(),
    }),
  );

  /** A source's link, or the reason it is not one. */
  linkFor(source: SourceRef) {
    return svSourceLink(source.url, this.allowedUrlProtocols());
  }

  /**
   * ★★ THE SHELL IS FOR HAVING NO ANSWER, NOT FOR HAVING NO CITATIONS. An
   * answer with nothing attributed is not an empty state — it is the most
   * important thing this component has to say, and hiding it behind "nothing to
   * show" is how an unsourced answer passes for a missing one.
   */
  readonly isEmpty = computed(() => this.answer().trim().length === 0);

  /**
   * Shortest uncited stretch worth reporting, in characters (`X-3`).
   *
   * ★★ FORTY IS A SENTENCE IN ENGLISH PROSE — and two or three sentences in
   *    Chinese, where a claim fits in a dozen characters, and most of a bullet
   *    in a summary-style answer. A connective is not an unsupported claim, so
   *    a floor has to exist; where it sits is a fact about the language and the
   *    answer shape, which this component cannot see.
   *
   * @default 40 (`SV_UNCITED_MIN_CHARS`, still exported)
   */
  readonly uncitedMinChars = input<number>(SV_UNCITED_MIN_CHARS);

  // ── Interactions ──────────────────────────────────────────────────────────

  toggleSource(source: SourceRef): void {
    const opening = this.openSourceId() !== source.id;
    this.openSourceId.set(opening ? source.id : null);
    this.sourceSelect.emit(source);
    if (!opening) return;
    const entry = this.numbered().find((n) => n.source.id === source.id);
    const ids = [
      ...new Set(
        (entry?.citations ?? [])
          .map((c) => c.claimId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (ids.length > 0) this.claimsOpened.emit(ids);
  }

  /** How a citation was placed — `claim`, `anchor`, `offsets` or `drifted`. */
  placementOf(citation: CitationSpan): SvCitationPlacement | 'claim' | undefined {
    return this.placementById().get(citation.id);
  }

  isOpen(sourceId: string): boolean {
    return this.openSourceId() === sourceId;
  }

  /** Instance-scoped element id, so two of these never collide on one page. */
  citeId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }

  // ── Presentation ──────────────────────────────────────────────────────────

  refLabel(refs: readonly number[]): string {
    return svRefLabel(refs);
  }

  sourceLabel(source: SourceRef): string {
    return svSourceLabel(source);
  }

  coverageLabel(): string {
    return svCoverageLabel(this.coverage());
  }

  numberedFor(n: number): SvNumberedSource | undefined {
    return this.numbered().find((s) => s.number === n);
  }

  /**
   * ★ Every glyph here is in the FREE set. `globe` and `code` would read better
   * for `web` and `api`, and both are Pro-only — but this is a free component,
   * and moving two glyphs across the tier line to improve an icon choice would
   * change the free/Pro split for every other consumer of them. `external-link`
   * says "somewhere else on the internet" perfectly well.
   */
  kindIcon(kind: SourceKind): string {
    switch (kind) {
      case 'web':      return 'external-link';
      case 'database': return 'database';
      case 'api':      return 'database';
      case 'note':     return 'file-text';
      case 'document': return 'file-text';
    }
  }

  /**
   * ★★ THE COVERAGE BAR IS COLOURED BY HOW MUCH IS *NOT* ATTRIBUTED. A green bar
   * at 60 % reads as a pass mark; the reader's question is whether the missing
   * 40 % matters, and amber is the honest answer to that.
   */
  coverageClass(pct: number): string {
    if (pct >= 90) return 'bg-accent-500';
    if (pct >= 60) return 'bg-warning-500';
    return 'bg-danger-500';
  }

  /**
   * What a screen reader is told about a citation chip.
   *
   * ★★ A CHIP READS OUT AS "[1]" AND NOTHING ELSE. The number is an index into a
   * list the reader cannot see from here, so the label carries the source it
   * resolves to — otherwise the whole mechanism is decorative to anybody not
   * using their eyes.
   */
  chipAriaLabel(refs: readonly number[]): string {
    const names = refs
      .map((n) => this.numberedFor(n))
      .filter((s): s is SvNumberedSource => s !== undefined)
      .map((s) => svSourceLabel(s.source));
    return names.length === 0 ? '' : `Cited from ${names.join('; ')}`;
  }

  sourceAriaLabel(entry: SvNumberedSource): string {
    const parts = [
      `Source ${entry.number}`,
      svSourceLabel(entry.source),
      `cited ${entry.spanCount} time${entry.spanCount === 1 ? '' : 's'}`,
    ];
    return parts.join('. ');
  }
}
