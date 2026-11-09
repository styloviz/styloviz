import { svFormatLabel } from '@styloviz/core/i18n';
import type { SvAiInsightCardsLabels } from './ai-insight-cards.labels';
import type { AiInsight } from './ai-insight-cards.types';

/**
 * ai-insight-cards.evidence.ts — an insight without a source is an assertion.
 *
 * ★★★ THIS COMPONENT RENDERS CLAIMS ABOUT SOMEBODY'S BUSINESS IN CONFIDENT
 *     PROSE, WITH A PERCENTAGE BESIDE THEM. "Checkout errors are up 40% since
 *     Tuesday, 87% confidence" is indistinguishable, on the page, from a
 *     sentence a model invented — and the reader acts on it either way. What
 *     separates the two is somewhere to go and check, and a note of what
 *     produced the number.
 *
 * ★★★ AND THE ITEM ASKED FOR A *REQUIRED* FIELD, WHICH WOULD BE WEAKER. A
 *     required `evidenceUrl` is satisfied by `''`, turns every existing host
 *     into a compile error, and buys nothing the reader can see. An insight with
 *     no evidence is rendered as what it is — an assertion — which is not
 *     satisfiable by typing quotes.
 */

export interface SvInsightEvidence {
  /** Safe to put in an `href`, or `null`. */
  readonly href: string | null;
  /** What to render about provenance. Never empty. */
  readonly label: string;
  /** True when a reader can actually go and check this claim. */
  readonly checkable: boolean;
}

/** Schemes an evidence link may use. A dashboard link is http(s) or it is not a link. */
const ALLOWED = Object.freeze(['http:', 'https:']);

/**
 * Where to go and check an insight, and what to say when there is nowhere.
 *
 * ★★ A NON-HTTP SCHEME IS REFUSED RATHER THAN RENDERED DEAD. Angular would turn
 *    `javascript:` into an `unsafe:` href — a link that does nothing, which
 *    teaches the reader that evidence links do not work rather than that this
 *    one is wrong.
 */
/** The words `svInsightEvidence` is written in. */
export type SvInsightEvidenceLabels = Pick<
  SvAiInsightCardsLabels,
  'evidenceNone' | 'evidenceInvalid' | 'evidenceScheme' | 'evidenceCheck'
>;

export function svInsightEvidence(insight: AiInsight, labels: SvInsightEvidenceLabels): SvInsightEvidence {
  const raw = (insight.evidenceUrl ?? '').trim();
  if (raw === '') {
    return {
      href: null,
      label: labels.evidenceNone,
      checkable: false,
    };
  }
  let protocol = '';
  try {
    protocol = new URL(raw).protocol.toLowerCase();
  } catch {
    return {
      href: null,
      label: labels.evidenceInvalid,
      checkable: false,
    };
  }
  if (!ALLOWED.includes(protocol)) {
    return {
      href: null,
      label: svFormatLabel(labels.evidenceScheme, { protocol }),
      checkable: false,
    };
  }
  return { href: raw, label: labels.evidenceCheck, checkable: true };
}

/**
 * What the confidence percentage actually is.
 *
 * ★★★ THE SAME PROBLEM AS EVERY OTHER CONFIDENCE IN THIS PACK, AND THE SAME
 * ANSWER. "87%" reads as calibrated; it is usually a model rating its own
 * certainty, which is not comparable across models, prompts or runs. With no
 * basis the figure still renders and says so — hiding a number the host already
 * shows would be a silent regression.
 */
/** The words `svInsightConfidenceLabel` is written in. */
export type SvInsightConfidenceLabels = Pick<
  SvAiInsightCardsLabels,
  'confidenceBasisModel' | 'confidenceBasisOnly' | 'confidenceModelOnly' | 'confidenceUnattributed'
>;

export function svInsightConfidenceLabel(insight: AiInsight, labels: SvInsightConfidenceLabels): string {
  const basis = (insight.confidenceBasis ?? '').trim();
  const model = [insight.model, insight.modelVersion].filter((p) => p?.trim()).join(' ');
  const params = { percent: String(insight.confidence), basis, model };
  if (basis && model) return svFormatLabel(labels.confidenceBasisModel, params);
  if (basis) return svFormatLabel(labels.confidenceBasisOnly, params);
  if (model) return svFormatLabel(labels.confidenceModelOnly, params);
  return svFormatLabel(labels.confidenceUnattributed, params);
}

/** True when the reader can tell what produced this number. */
export function svInsightIsAttributed(insight: AiInsight): boolean {
  return Boolean((insight.confidenceBasis ?? '').trim()) && Boolean((insight.model ?? '').trim());
}

/**
 * How many of these are the kit's own sample data.
 *
 * ★★★ A CARD RENDERING BELIEVABLE INSIGHTS WITH NO DATA WIRED IS
 *     INDISTINGUISHABLE FROM ONE RENDERING REAL ONES. `DEMO_INSIGHTS` exists so
 *     the showcase has something to draw, and it is one copy-paste from a host's
 *     fixture and one deploy from a board somebody trusts. Marking the sample
 *     data itself — rather than the component's mode — means the label survives
 *     that copy, which is the path it actually travels.
 */
export function svSampleCount(insights: readonly AiInsight[]): number {
  return insights.filter((i) => i.sample === true).length;
}

/** What to say about sample data on screen, or `''`. */
export function svSampleLabel(
  count: number,
  total: number,
  labels: Pick<SvAiInsightCardsLabels, 'sampleAll' | 'sampleSome'>,
): string {
  if (count <= 0) return '';
  if (count === total) return labels.sampleAll;
  return svFormatLabel(labels.sampleSome, { count: String(count), total: String(total) });
}
