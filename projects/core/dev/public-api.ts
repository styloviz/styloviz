/*
 * @styloviz/core/dev — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
export {
  svWarnOnce,
  svResetWarnOnce,
  svWarn,
  svError,
  svSetDiagnostics,
  provideSvDiagnostics,
  type SvDiagnosticLevel,
  type SvDiagnosticsConfig,
} from './warn-once';
// ── Development aids ────────────────────────────────────────────────────────
// Dev-mode-only diagnostics. No-ops in a production bundle.
export { svWarnSimulating } from './simulate-warning';
