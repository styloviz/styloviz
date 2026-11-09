/**
 * The visible text `sv-citation-sources` renders, in English. Override any of
 * them with `provideSvLabels({ citationSources: { … } })` from `@styloviz/core`.
 */
export interface SvCitationSourcesLabels {
  readonly loading: string;
  readonly emptyTitle: string;
  readonly emptyMessage: string;
  readonly sourceCount: string;
  readonly spanCountHint: string;
  readonly openSource: string;
  /** `svCoverageLabel()` — also when no passage is attributed. */
  readonly unsourced: string;
  /** `svCoverageLabel()` — an empty answer. */
  readonly coverageEmpty: string;
  /** `svCoverageLabel()` — every passage cited. `{pct}` is a whole percentage, `{sources}` the source count. */
  readonly coverageFull: string;
  /** `svCoverageLabel()` — `{uncited}` passages rest on nothing. */
  readonly coveragePartial: string;
  /** `svPlacementLabel()` — `{count}` citations name claims missing from the answer. */
  readonly placementMissingClaims: string;
  /** `svPlacementLabel()` — `{count}` citations could not be located. */
  readonly placementLost: string;
  /** `svPlacementLabel()` — `{count}` citations were re-anchored to their quote. */
  readonly placementDrifted: string;
  /** Joins the `svPlacementLabel()` findings. */
  readonly placementJoin: string;
  /** `svPlacementLabel()` — the whole sentence; `{findings}` are the joined findings. */
  readonly placementSummary: string;
  /** `svSourceLink()` — the URL did not parse. */
  readonly linkIncomplete: string;
  /** `svSourceLink()` — the URL's `{protocol}` is not in the allowed list. */
  readonly linkSchemeRefused: string;
  /** A citation chip's spoken name — `{sources}` is the cited sources' names, joined. */
  readonly chipCitedFrom: string;
  /** A source entry's spoken name, part by part — `{number}` its number, `{count}` how often it is cited. */
  readonly sourceNumber: string;
  readonly sourceCitedTimes: string;
  /**
   * Under the coverage figure (`AI-16-I4`): attribution is not support. A fully attributed
   * answer can still say something its sources do not.
   */
  readonly coverageAttributionCaveat: string;
  /** Source freshness (`AI-16-M3`) — `{when}` is a relative age ("3 days ago") or the host's own text. */
  readonly retrieved: string;
  /** Source access states (`AI-16-M4`) — the chip beside the source name. */
  readonly accessPaywalled: string;
  readonly accessDead: string;
  readonly accessDenied: string;
  /** Rendered in the passage instead of a link, with the address as text. */
  readonly accessPaywalledNote: string;
  readonly accessDeadNote: string;
  readonly accessDeniedNote: string;
}

/** The templates the attribution helpers read. */
export type SvCitationAttributionLabels = Pick<
  SvCitationSourcesLabels,
  | 'unsourced'
  | 'coverageEmpty'
  | 'coverageFull'
  | 'coveragePartial'
  | 'placementMissingClaims'
  | 'placementLost'
  | 'placementDrifted'
  | 'placementJoin'
  | 'placementSummary'
  | 'linkIncomplete'
  | 'linkSchemeRefused'
>;

export const SV_CITATION_SOURCES_LABELS: SvCitationSourcesLabels = {
  loading: 'Loading',
  emptyTitle: 'No answer yet',
  emptyMessage: 'Citations appear alongside an answer once one has been generated.',
  sourceCount: '{count, plural, one {# source} other {# sources}}',
  spanCountHint: 'How many separate passages of the answer rest on this one source. It is one source, whatever that number says.',
  openSource: 'Open the source',
  unsourced: 'Nothing in this answer is attributed to a source.',
  coverageEmpty: 'Nothing to attribute.',
  coverageFull: '{pct}% of this answer is attributed, across {sources, plural, one {# source} other {# sources}}.',
  coveragePartial: '{pct}% of this answer is attributed, across {sources, plural, one {# source} other {# sources}}. {uncited, plural, one {# passage rests} other {# passages rest}} on nothing — those are the ones to read.',
  placementMissingClaims: '{count, plural, one {# citation names a claim that is not in this answer} other {# citations name claims that are not in this answer}}',
  placementLost: '{count, plural, one {# citation could not be located in this answer} other {# citations could not be located in this answer}}',
  placementDrifted: '{count, plural, one {# was re-anchored to its quoted text} other {# were re-anchored to their quoted text}}',
  placementJoin: ', and ',
  placementSummary: '{findings} — the answer was changed after the citations were computed.',
  linkIncomplete: 'This source has no usable address — the link was not a complete URL.',
  linkSchemeRefused: 'This source\'s address uses "{protocol}", which is not linked here. Read it below and check it yourself.',
  chipCitedFrom: 'Cited from {sources}',
  sourceNumber: 'Source {number}',
  sourceCitedTimes: '{count, plural, one {cited # time} other {cited # times}}',
  coverageAttributionCaveat:
    'Attributed is not verified as supported: a chip says which source a passage was attributed to, not that the source actually says it. Read the quotes.',
  retrieved: 'Retrieved {when}',
  accessPaywalled: 'Paywalled',
  accessDead: 'Link dead',
  accessDenied: 'No access',
  accessPaywalledNote:
    'This source is behind a paywall, so it is not linked. The quoted passage is what was retrieved; reading the original may need a subscription.',
  accessDeadNote:
    'This source no longer resolves, so it is not linked. The quoted passage is what was retrieved before it went away.',
  accessDeniedNote:
    'You do not have permission to open this source, so it is not linked. The quoted passage is what the retriever could see.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    citationSources: SvCitationSourcesLabels;
  }
}
