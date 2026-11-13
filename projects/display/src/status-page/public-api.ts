// The @styloviz/display/status-page entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvStatusPageComponent } from './status-page.component';
export type { SvStatusPageHeadingLevel, SvStatusPageLabels } from './status-page.component';
export {
  svFormatUptime,
  svOverallStatus,
  svStatusFromUptime,
  svUptimeSummary,
  svWorstStatus,
} from './status-page.logic';
export type {
  SvIncidentImpact,
  SvIncidentStatus,
  SvIncidentUpdate,
  SvMaintenanceStatus,
  SvStatusComponent,
  SvStatusIncident,
  SvStatusInstant,
  SvStatusLevel,
  SvStatusMaintenance,
  SvStatusUptimeDay,
  SvUptimeCell,
  SvUptimeSummary,
} from './status-page.logic';
