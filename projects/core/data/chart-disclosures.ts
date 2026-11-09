/**
 * The wording a chart's data disclosures are written from — the value-policy
 * notice, the long-tail fold and its summary rows, and the gap notice.
 *
 * ★ Core writes the sentences, but a chart package OWNS their translation: its
 *   labels interface extends {@link SvChartDisclosureLabels} and its English
 *   spreads {@link SV_CHART_DISCLOSURE_LABELS}, so `provideSvLabels({ chartsPro:
 *   { valueClamped: '…' } })` reaches the notice under that package's charts,
 *   and the component passes its own `labels` to the helpers.
 */
import { SV_CORE_LABELS, type SvCoreLabels } from '@styloviz/core/i18n';

/** Every `core` key the chart disclosure helpers read. */
export type SvChartDisclosureLabels = Pick<
  SvCoreLabels,
  | 'valueMissing' | 'valueUnbounded' | 'valueNegativelyUnbounded' | 'valueForExample' | 'valueRendered'
  | 'valueRejected' | 'valueOmitted' | 'valueOmitShare' | 'valueClamped' | 'valueAllZero'
  | 'smallSharesNotice' | 'smallSharesNames' | 'smallSharesNamesMore' | 'smallSharesOther' | 'smallSharesOtherTaken'
  | 'smallSharesCombinedRow' | 'smallSharesFoldedRow'
  | 'gapAllMissing' | 'gapStacked' | 'gapLine'
>;

/** The English of {@link SvChartDisclosureLabels}, for a chart package's labels to spread. */
export const SV_CHART_DISCLOSURE_LABELS: SvChartDisclosureLabels = {
  valueMissing: SV_CORE_LABELS.valueMissing,
  valueUnbounded: SV_CORE_LABELS.valueUnbounded,
  valueNegativelyUnbounded: SV_CORE_LABELS.valueNegativelyUnbounded,
  valueForExample: SV_CORE_LABELS.valueForExample,
  valueRendered: SV_CORE_LABELS.valueRendered,
  valueRejected: SV_CORE_LABELS.valueRejected,
  valueOmitted: SV_CORE_LABELS.valueOmitted,
  valueOmitShare: SV_CORE_LABELS.valueOmitShare,
  valueClamped: SV_CORE_LABELS.valueClamped,
  valueAllZero: SV_CORE_LABELS.valueAllZero,
  smallSharesNotice: SV_CORE_LABELS.smallSharesNotice,
  smallSharesNames: SV_CORE_LABELS.smallSharesNames,
  smallSharesNamesMore: SV_CORE_LABELS.smallSharesNamesMore,
  smallSharesOther: SV_CORE_LABELS.smallSharesOther,
  smallSharesOtherTaken: SV_CORE_LABELS.smallSharesOtherTaken,
  smallSharesCombinedRow: SV_CORE_LABELS.smallSharesCombinedRow,
  smallSharesFoldedRow: SV_CORE_LABELS.smallSharesFoldedRow,
  gapAllMissing: SV_CORE_LABELS.gapAllMissing,
  gapStacked: SV_CORE_LABELS.gapStacked,
  gapLine: SV_CORE_LABELS.gapLine,
};
