import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  resolveItemKey,
  type SvDataError,
  type SvItemKey,
} from '@styloviz/core/data';
import { SV_MACHINE_LOCALE, injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons/core';
import { SvTimelineComponent, type TimelineItem, type TimelineVariant } from '@styloviz/timeline';
import { SV_DISPLAY_LABELS, type SvDisplayLabels } from '@styloviz/display/labels';
import {
  svDayInZone,
  svDayToUtc,
  svDayWindow,
  svFormatUptime,
  svGroupIncidentHistory,
  svInstantMs,
  svIsStatusLevel,
  svOrderActiveIncidents,
  svOverallStatus,
  svUptimeSummary,
  svUtcToDay,
  svValidTimeZone,
  type SvIncidentImpact,
  type SvIncidentStatus,
  type SvIncidentUpdate,
  type SvMaintenanceStatus,
  type SvStatusComponent,
  type SvStatusIncident,
  type SvStatusInstant,
  type SvStatusLevel,
  type SvStatusMaintenance,
} from './status-page.logic';

import { registerStatusPageIcons } from './status-page.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/** Heading level for the section headings; incident and window titles sit one below. */
export type SvStatusPageHeadingLevel = 2 | 3 | 4;

/** The labels this component reads — the `status*` subset of the `display` namespace. */
export type SvStatusPageLabels = Pick<
  SvDisplayLabels,
  | 'statusOperational'
  | 'statusDegraded'
  | 'statusPartialOutage'
  | 'statusMajorOutage'
  | 'statusMaintenance'
  | 'statusNoData'
  | 'statusBannerOperational'
  | 'statusBannerDegraded'
  | 'statusBannerPartialOutage'
  | 'statusBannerMajorOutage'
  | 'statusBannerMaintenance'
  | 'statusLastUpdated'
  | 'statusComponentsHeading'
  | 'statusActiveHeading'
  | 'statusMaintenanceHeading'
  | 'statusHistoryHeading'
  | 'statusUptimeSummary'
  | 'statusUptimeGoodDays'
  | 'statusUptimeNoData'
  | 'statusUptimeBarLabel'
  | 'statusDayTitle'
  | 'statusDayTitleUptime'
  | 'statusIssueDays'
  | 'statusNoPastIncidents'
  | 'statusInvestigating'
  | 'statusIdentified'
  | 'statusMonitoring'
  | 'statusResolved'
  | 'statusImpactNone'
  | 'statusImpactMinor'
  | 'statusImpactMajor'
  | 'statusImpactCritical'
  | 'statusAffects'
  | 'statusUpdatesLabel'
  | 'statusMaintenanceScheduled'
  | 'statusMaintenanceInProgress'
  | 'statusMaintenanceWindow'
  | 'statusEmptyTitle'
  | 'statusEmptyMessage'
  | 'statusLoading'
>;

interface CellView {
  readonly date: string;
  readonly cls: string;
  readonly title: string;
}

interface ComponentView {
  readonly key: string | number;
  readonly name: string;
  readonly level: SvStatusLevel;
  readonly statusLabel: string;
  readonly ink: string;
  readonly cells: readonly CellView[];
  readonly summary: string;
  readonly barLabel: string;
  readonly start: string;
  readonly end: string;
  /** Tooltips of the days that were not operational, for the screen-reader list. */
  readonly issues: readonly string[];
  readonly issueLead: string;
}

interface ComponentGroupView {
  readonly key: string;
  /** Null for components with no group. */
  readonly label: string | null;
  readonly rows: readonly ComponentView[];
}

interface IncidentView {
  readonly key: string | number;
  readonly title: string;
  readonly status: SvIncidentStatus;
  readonly statusLabel: string;
  readonly statusClass: string;
  readonly impact: SvIncidentImpact;
  readonly impactLabel: string;
  readonly affects: string;
  readonly updates: readonly TimelineItem[];
  readonly updatesLabel: string;
}

interface HistoryGroupView {
  readonly day: string;
  readonly label: string;
  readonly incidents: readonly IncidentView[];
}

interface MaintenanceView {
  readonly key: string | number;
  readonly title: string;
  readonly status: SvMaintenanceStatus;
  readonly statusLabel: string;
  readonly statusClass: string;
  readonly window: string;
  readonly startIso: string;
  readonly description: string;
  readonly affects: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * `sv-status-page` — a public status / uptime page: an overall banner, each
 * component's current state and 90-day uptime bar, active incidents with their
 * update timelines, scheduled maintenance and a day-grouped incident history.
 *
 * Read-only. Every state is text and an icon as well as a colour; dates and
 * times format with `Intl` in `locale` and `timeZone`.
 *
 * ```html
 * <sv-status-page [components]="components" [incidents]="incidents" [lastUpdated]="fetchedAt"
 *   [loading]="loading()" [error]="error()" (retry)="reload()" />
 * ```
 */
@Component({
  selector: 'sv-status-page',
  standalone: true,
  imports: [NgTemplateOutlet, SvIconComponent, SvTimelineComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent],
  templateUrl: './status-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvStatusPageComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerStatusPageIcons();

  private readonly registryText = injectSvLabels('display', SV_DISPLAY_LABELS);

  // ── Data ──────────────────────────────────────────────────────────────────

  /** The monitored services, in display order. Rows with no `name` are skipped. @default [] */
  readonly components = input<readonly SvStatusComponent[]>([]);

  /** Incidents, active and resolved, any order. Active ones are listed on top; resolved ones form the history. @default [] */
  readonly incidents = input<readonly SvStatusIncident[]>([]);

  /** Planned maintenance windows, any order — listed by start time. `completed` windows are left out. @default [] */
  readonly maintenances = input<readonly SvStatusMaintenance[]>([]);

  /**
   * The overall status, when your backend states it. Null derives it: the worst
   * of every component's status, every active incident's impact and any
   * in-progress maintenance. @default null
   */
  readonly status = input<SvStatusLevel | null>(null);

  /** How many days the uptime bars cover, ending on the day of `lastUpdated` (clamped to 1–365). @default 90 */
  readonly days = input<number>(90);

  /**
   * When the data was fetched — shown as "Last updated …" and the last day of
   * the uptime bars. Null ends the bars on the latest day any component reports. @default null
   */
  readonly lastUpdated = input<SvStatusInstant | null>(null);

  // ── Async contract ────────────────────────────────────────────────────────

  /** True while the first request is in flight — keep it false on a background refresh. @default false */
  readonly loading = input<boolean>(false);

  /** The load failed. A string or an `SvDataError`; a non-retryable error hides the retry button. @default null */
  readonly error = input<SvDataError | string | null>(null);

  /** Identity of a component row, a property name or a function. @default 'id' */
  readonly itemKey = input<SvItemKey<SvStatusComponent>>('id');

  /** Identity of an incident. @default 'id' */
  readonly incidentKey = input<SvItemKey<SvStatusIncident>>('id');

  /** Identity of a maintenance window. @default 'id' */
  readonly maintenanceKey = input<SvItemKey<SvStatusMaintenance>>('id');

  // ── Formatting & semantics ────────────────────────────────────────────────

  /** BCP-47 locale for dates, times and percentages. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /**
   * IANA time zone the times are shown in (and incident days are grouped by),
   * e.g. `'UTC'` or `'Europe/Berlin'`. Null, or a zone `Intl` rejects, uses the
   * viewer's own. @default null
   */
  readonly timeZone = input<string | null>(null);

  /**
   * Make the overall banner a polite live region (`role="status"`), so a screen
   * reader announces a change when the page refreshes in place. Leave it off for
   * a page that is rendered once — a live region that never changes is noise. @default false
   */
  readonly live = input<boolean>(false);

  /** Heading level of the section headings — match your page outline. @default 2 */
  readonly headingLevel = input<SvStatusPageHeadingLevel>(2);

  /** Per-instance text, merged over the registry's `display` labels. @default {} */
  readonly labels = input<Partial<SvStatusPageLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** The error state's retry button was pressed — re-run the request. */
  readonly retry = output<void>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** @internal The labels in effect. */
  protected readonly text = computed<SvStatusPageLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** @internal */
  private readonly zone = computed(() => svValidTimeZone(this.timeZone()));

  /** @internal Components with a usable name. */
  private readonly validComponents = computed<readonly SvStatusComponent[]>(() => {
    const given = this.components();
    return (Array.isArray(given) ? given : []).filter((c) => !!c && typeof c.name === 'string' && c.name.trim() !== '');
  });

  /** @internal Incidents with a usable title. */
  private readonly validIncidents = computed<readonly SvStatusIncident[]>(() => {
    const given = this.incidents();
    return (Array.isArray(given) ? given : []).filter((i) => !!i && typeof i.title === 'string' && i.title.trim() !== '');
  });

  /** @internal Windows still to come or under way. */
  private readonly validMaintenances = computed<readonly SvStatusMaintenance[]>(() => {
    const given = this.maintenances();
    return (Array.isArray(given) ? given : []).filter(
      (m) => !!m && typeof m.title === 'string' && m.title.trim() !== '' && m.status !== 'completed',
    );
  });

  /** @internal Nothing was published at all — the no-data empty state. */
  protected readonly isEmpty = computed(
    () => this.validComponents().length === 0 && this.validIncidents().length === 0 && this.validMaintenances().length === 0,
  );

  /** @internal The overall status in force. */
  protected readonly overall = computed<SvStatusLevel>(() => {
    const given = this.status();
    if (svIsStatusLevel(given)) return given;
    return svOverallStatus(this.validComponents(), this.validIncidents(), this.validMaintenances());
  });

  /** @internal The banner's headline. */
  protected readonly bannerText = computed(() => {
    const t = this.text();
    const map: Record<SvStatusLevel, string> = {
      operational: t.statusBannerOperational,
      degraded: t.statusBannerDegraded,
      'partial-outage': t.statusBannerPartialOutage,
      'major-outage': t.statusBannerMajorOutage,
      maintenance: t.statusBannerMaintenance,
    };
    return map[this.overall()];
  });

  /** @internal "Last updated …", or '' when no time was given. */
  protected readonly lastUpdatedText = computed(() => {
    const ms = svInstantMs(this.lastUpdated());
    if (ms === null) return '';
    return svFormatLabel(this.text().statusLastUpdated, { time: this.formatInstant(ms) }, this.locale());
  });

  /** @internal The machine-readable form of `lastUpdated`, for `<time datetime>`. */
  protected readonly lastUpdatedIso = computed(() => {
    const ms = svInstantMs(this.lastUpdated());
    return ms === null ? '' : new Date(ms).toISOString();
  });

  /** @internal The calendar days the bars cover, oldest first. */
  private readonly window = computed<readonly string[]>(() => {
    const count = Math.min(365, Math.max(1, Math.round(Number.isFinite(this.days()) ? this.days() : 90)));
    const updated = svInstantMs(this.lastUpdated());
    let end = updated !== null ? svDayInZone(updated, this.zone()) : null;
    if (end === null) {
      let latest: number | null = null;
      for (const c of this.validComponents()) {
        for (const day of Array.isArray(c.uptime) ? c.uptime : []) {
          const ms = svDayToUtc(day?.date ?? '');
          if (ms !== null && (latest === null || ms > latest)) latest = ms;
        }
      }
      end = latest !== null ? svUtcToDay(latest) : svDayInZone(Date.now(), this.zone());
    }
    return svDayWindow(end, count);
  });

  /** @internal Components grouped in first-seen order, each with its bar. */
  protected readonly groups = computed<readonly ComponentGroupView[]>(() => {
    const t = this.text();
    const locale = this.locale();
    const window = this.window();
    const key = this.itemKey();
    const start = window.length ? this.formatDay(window[0]) : '';
    const end = window.length ? this.formatDay(window[window.length - 1]) : '';
    const order: string[] = [];
    const byGroup = new Map<string, { label: string | null; rows: ComponentView[] }>();

    this.validComponents().forEach((component, index) => {
      const level: SvStatusLevel = svIsStatusLevel(component.status) ? component.status : 'operational';
      const uptime = svUptimeSummary(component, window);
      const cells = uptime.cells.map((cell): CellView => {
        const status = cell.status === null ? t.statusNoData : this.levelLabel(cell.status);
        const date = this.formatDay(cell.date);
        const title =
          cell.percentage === null
            ? svFormatLabel(t.statusDayTitle, { date, status }, locale)
            : svFormatLabel(t.statusDayTitleUptime, { date, status, pct: svFormatUptime(cell.percentage, locale) }, locale);
        return { date: cell.date, cls: cell.status === null ? NO_DATA_CELL : LEVEL_CELL[cell.status], title };
      });
      const summary =
        uptime.percent !== null
          ? svFormatLabel(t.statusUptimeSummary, { pct: svFormatUptime(uptime.percent, locale), days: uptime.measuredDays }, locale)
          : uptime.recordedDays > 0
            ? svFormatLabel(t.statusUptimeGoodDays, { good: uptime.goodDays, days: uptime.recordedDays }, locale)
            : t.statusUptimeNoData;
      const issues = cells.filter((_, i) => {
        const s = uptime.cells[i].status;
        return s !== null && s !== 'operational';
      });
      const label = typeof component.group === 'string' && component.group.trim() ? component.group.trim() : null;
      const groupKey = label ?? '';
      if (!byGroup.has(groupKey)) {
        byGroup.set(groupKey, { label, rows: [] });
        order.push(groupKey);
      }
      byGroup.get(groupKey)!.rows.push({
        key: resolveItemKey(component, key, index),
        name: component.name,
        level,
        statusLabel: this.levelLabel(level),
        ink: LEVEL_INK[level],
        cells,
        summary,
        barLabel: svFormatLabel(t.statusUptimeBarLabel, { name: component.name, summary, start, end }, locale),
        start,
        end,
        issues: issues.map((c) => c.title),
        issueLead: svFormatLabel(t.statusIssueDays, { count: issues.length }, locale),
      });
    });
    return order.map((k) => ({ key: k || '__ungrouped', ...byGroup.get(k)! }));
  });

  /** @internal Active incidents, worst impact first, then most recently updated. */
  protected readonly active = computed<readonly IncidentView[]>(() =>
    svOrderActiveIncidents(this.validIncidents()).map((incident) => this.incidentView(incident)),
  );

  /** @internal Resolved incidents grouped by the day they began, newest first. */
  protected readonly history = computed<readonly HistoryGroupView[]>(() =>
    svGroupIncidentHistory(this.validIncidents(), this.zone()).map((group) => ({
      day: group.day,
      label: this.formatDay(group.day, true),
      incidents: group.incidents.map((incident) => this.incidentView(incident)),
    })),
  );

  /** @internal Upcoming and in-progress windows, in progress first, then by start time. */
  protected readonly maintenanceViews = computed<readonly MaintenanceView[]>(() => {
    const t = this.text();
    const locale = this.locale();
    const key = this.maintenanceKey();
    return this.validMaintenances()
      .map((m, index) => ({ m, index, start: svInstantMs(m.startsAt) ?? Infinity }))
      .sort(
        (a, b) => Number(b.m.status === 'in-progress') - Number(a.m.status === 'in-progress') || a.start - b.start,
      )
      .map(({ m, index, start }): MaintenanceView => {
        const end = svInstantMs(m.endsAt);
        const status: SvMaintenanceStatus = m.status === 'in-progress' ? 'in-progress' : 'scheduled';
        return {
          key: resolveItemKey(m, key, index),
          title: m.title,
          status,
          statusLabel: status === 'in-progress' ? t.statusMaintenanceInProgress : t.statusMaintenanceScheduled,
          statusClass: MAINTENANCE_CHIP[status],
          window:
            Number.isFinite(start) && end !== null
              ? svFormatLabel(t.statusMaintenanceWindow, { start: this.formatInstant(start), end: this.formatInstant(end) }, locale)
              : '',
          startIso: Number.isFinite(start) ? new Date(start).toISOString() : '',
          description: typeof m.description === 'string' ? m.description : '',
          affects: this.affects(m.components),
        };
      });
  });

  /** @internal Component id → name, for "Affects …". */
  private readonly namesById = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.validComponents()) if (typeof c.id === 'string') map.set(c.id, c.name);
    return map;
  });

  /** @internal The section heading level, and the one below it. */
  protected readonly itemHeadingLevel = computed(() => Math.min(6, this.headingLevel() + 1));

  /** @internal The banner's surface. */
  protected readonly bannerClass = computed(() => BANNER[this.overall()]);

  /** @internal Prefix for the ids the section headings and regions point at. */
  protected readonly uid = svUniqueId('sv-status-page');

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** @internal A level as text. */
  private levelLabel(level: SvStatusLevel): string {
    const t = this.text();
    switch (level) {
      case 'operational':
        return t.statusOperational;
      case 'degraded':
        return t.statusDegraded;
      case 'partial-outage':
        return t.statusPartialOutage;
      case 'major-outage':
        return t.statusMajorOutage;
      case 'maintenance':
        return t.statusMaintenance;
    }
  }

  /** @internal An incident as drawn — its updates newest first, as timeline items. */
  private incidentView(incident: SvStatusIncident): IncidentView {
    const t = this.text();
    const locale = this.locale();
    const statusLabel: Record<SvIncidentStatus, string> = {
      investigating: t.statusInvestigating,
      identified: t.statusIdentified,
      monitoring: t.statusMonitoring,
      resolved: t.statusResolved,
    };
    const impactLabel: Record<SvIncidentImpact, string> = {
      none: t.statusImpactNone,
      minor: t.statusImpactMinor,
      major: t.statusImpactMajor,
      critical: t.statusImpactCritical,
    };
    const key = resolveItemKey(incident, this.incidentKey(), this.validIncidents().indexOf(incident));
    const posts: readonly SvIncidentUpdate[] = Array.isArray(incident.updates) ? incident.updates : [];
    const updates = posts
      .map((u, i) => ({ u, i, ms: svInstantMs(u?.at) }))
      .filter((x) => x.u && typeof x.u.message === 'string')
      .sort((a, b) => (b.ms ?? -Infinity) - (a.ms ?? -Infinity))
      .map(
        ({ u, i, ms }): TimelineItem => ({
          id: `${key}-${i}`,
          title: statusLabel[u.status] ?? u.status,
          description: u.message,
          timestamp: ms === null ? '' : this.formatInstant(ms),
          variant: UPDATE_VARIANT[u.status] ?? 'neutral',
        }),
      );
    const status: SvIncidentStatus = statusLabel[incident.status] ? incident.status : 'investigating';
    const impact: SvIncidentImpact = impactLabel[incident.impact] ? incident.impact : 'none';
    return {
      key,
      title: incident.title,
      status,
      statusLabel: statusLabel[status],
      statusClass: INCIDENT_CHIP[status],
      impact,
      impactLabel: impactLabel[impact],
      affects: this.affects(incident.components),
      updates,
      updatesLabel: svFormatLabel(t.statusUpdatesLabel, { title: incident.title }, locale),
    };
  }

  /** @internal "Affects API and Dashboard", or '' when nothing is named. */
  private affects(ids: readonly string[] | undefined): string {
    if (!Array.isArray(ids) || ids.length === 0) return '';
    const names = this.namesById();
    const list = ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => names.get(id) ?? id);
    if (list.length === 0) return '';
    return svFormatLabel(this.text().statusAffects, { names: this.joinList(list) }, this.locale());
  }

  /** @internal A list joined the locale's way ("A, B and C" / "A, B und C"). */
  private joinList(items: readonly string[]): string {
    try {
      return new Intl.ListFormat(this.locale() || SV_MACHINE_LOCALE, { type: 'conjunction' }).format(items);
    } catch {
      return items.join(', ');
    }
  }

  /** @internal An instant in the page's locale and zone, with the zone named. */
  private formatInstant(ms: number): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: this.zone() ?? undefined,
    };
    try {
      return new Intl.DateTimeFormat(this.locale() || SV_MACHINE_LOCALE, options).format(new Date(ms));
    } catch {
      return new Intl.DateTimeFormat(SV_MACHINE_LOCALE, options).format(new Date(ms));
    }
  }

  /** @internal A calendar day (`YYYY-MM-DD`) in the page's locale — never shifted by a zone. */
  private formatDay(day: string, long = false): string {
    const ms = svDayToUtc(day);
    if (ms === null) return day;
    const options: Intl.DateTimeFormatOptions = long
      ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
      : { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
    try {
      return new Intl.DateTimeFormat(this.locale() || SV_MACHINE_LOCALE, options).format(new Date(ms));
    } catch {
      return new Intl.DateTimeFormat(SV_MACHINE_LOCALE, options).format(new Date(ms));
    }
  }
}

// ─── Styling tables ──────────────────────────────────────────────────────────
// sv-i18n-ignore: CSS classes below, not language. Glyphs are chosen in the template (`levelGlyph`).

const LEVEL_CELL: Readonly<Record<SvStatusLevel, string>> = {
  operational: 'bg-accent-500',
  degraded: 'bg-warning-400',
  'partial-outage': 'bg-warning-600',
  'major-outage': 'bg-danger-600',
  maintenance: 'bg-info-500',
};

const NO_DATA_CELL = 'bg-gray-200 dark:bg-gray-700';

const LEVEL_INK: Readonly<Record<SvStatusLevel, string>> = {
  operational: 'text-accent-700 dark:text-accent-400',
  degraded: 'text-warning-800 dark:text-warning-300',
  'partial-outage': 'text-warning-800 dark:text-warning-300',
  'major-outage': 'text-danger-700 dark:text-danger-400',
  maintenance: 'text-info-700 dark:text-info-400',
};

const BANNER: Readonly<Record<SvStatusLevel, string>> = {
  operational: 'border-accent-200 bg-accent-50 text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100',
  degraded: 'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-100',
  'partial-outage': 'border-warning-300 bg-warning-100 text-warning-950 dark:border-warning-700 dark:bg-warning-950 dark:text-warning-100',
  'major-outage': 'border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-100',
  maintenance: 'border-info-200 bg-info-50 text-info-900 dark:border-info-800 dark:bg-info-950 dark:text-info-100',
};

const INCIDENT_CHIP: Readonly<Record<SvIncidentStatus, string>> = {
  investigating: 'bg-danger-50 text-danger-800 dark:bg-danger-950 dark:text-danger-200',
  identified: 'bg-warning-50 text-warning-900 dark:bg-warning-950 dark:text-warning-200',
  monitoring: 'bg-info-50 text-info-800 dark:bg-info-950 dark:text-info-200',
  resolved: 'bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200',
};

const MAINTENANCE_CHIP: Readonly<Record<SvMaintenanceStatus, string>> = {
  scheduled: 'bg-info-50 text-info-800 dark:bg-info-950 dark:text-info-200',
  'in-progress': 'bg-warning-50 text-warning-900 dark:bg-warning-950 dark:text-warning-200',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const UPDATE_VARIANT: Readonly<Record<SvIncidentStatus, TimelineVariant>> = {
  investigating: 'error',
  identified: 'warning',
  monitoring: 'info',
  resolved: 'success',
};
