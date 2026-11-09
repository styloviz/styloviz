/*
 * @styloviz/core/forms — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
/** FL-B3 — inputs Signal Forms' `[formField]` writes to by name accept anything and normalise it. */
export { svBoundOrNull, svNumberOr, svPatternAttr, svStringOr } from './form-field-inputs';
export { createCompositionGuard } from './composition';
export { createCreateFlow } from './create-flow';
export type {
  SvCreateFlow,
  SvCreateFlowOptions,
  SvCreateRequest,
  SvCreatedEntity,
  SvPendingCreate,
} from './create-flow';
export type { SvCompositionGuard } from './composition';
// Drop-point caret for drop handlers (`X-4`) — shared by sv-mention and sv-rich-text-editor.
export { svCaretRangeFromPoint } from './caret-from-point';
// …and the token the select's feature children (`svSelectSearch`,
// `svSelectVirtual`, `svSelectBulk`) register through. Shared by both tiers so
// a feature child from one works inside the other's component.
export { SV_SELECT_FEATURE, svMergeSelectFeatures } from './select-feature';
export type { SvSelectFeature, SvSelectFeatureConfig } from './select-feature';
// ── Forms ───────────────────────────────────────────────────────────────────
// One `aria-describedby` composer, with one order. The shape it replaces —
// `showError() ? errorId : null` — describes the field with the error INSTEAD
// of the hint, which is not what a list-valued attribute is for.
export { svDescribedBy } from './described-by';
export type { SvDescribedByParts } from './described-by';
// The browser filled the field and told nobody. `animationstart` on an empty
// keyframe is the only notification Chrome's page-load autofill gives.
export { SvAutofillDirective, SV_AUTOFILL_START, SV_AUTOFILL_END } from './autofill.directive';
export { createFieldError } from './field-error';
export type { SvFieldError, SvServerError } from './field-error';
export { SvFieldErrorComponent } from './field-error.component';
// ─── Mentions ─────────────────────────────────────────────────────────────────
// The trigger scan and the atomic token, shared by `sv-mention` (a single-line
// contenteditable) and `sv-rich-text-editor`. Extracted rather than copied: the
// second copy of a rule like "an email address must not open a people-search"
// always drifts from the first.
export {
  SV_MENTION_ATTRS,
  svMentionHtml,
  svMentionLabel,
  svMentionPlainText,
  svMentionRepairs,
  svParseMentions,
  svScanTrigger,
  svTokenIntegrity,
} from './mention-scan';
export type {
  SvMentionRepair,
  SvMentionToken,
  SvTokenIntegrity,
  SvTriggerMatch,
  SvTriggerOptions,
} from './mention-scan';
