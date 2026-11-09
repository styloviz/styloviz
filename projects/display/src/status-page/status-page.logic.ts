import { SV_MACHINE_LOCALE } from '@styloviz/core/i18n';

/**
 * The arithmetic behind `sv-status-page`, kept free of Angular so a host can
 * quote the same figures elsewhere (an e-mail digest, a Slack summary) and a
 * spec can pin them without rendering anything.
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/** A service's state, worst last: `major-outage` outranks everything. */
export type SvStatusLevel = 'operational' | 'maintenance' | 'degraded' | 'partial-outage' | 'major-outage';

/** Where an incident is in its life. Everything but `resolved` is active. */
export type SvIncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

/** How badly an incident hurts. `none` is a notice that changes no status. */
export type SvIncidentImpact = 'none' | 'minor' | 'major' | 'critical';

/** Where a maintenance window is. `completed` windows are not listed. */
export type SvMaintenanceStatus = 'scheduled' | 'in-progress' | 'completed';

/** An instant — an ISO 8601 string, epoch milliseconds or a `Date`. */
export type SvStatusInstant = string | number | Date;

/** One day of a component's uptime record. Give `status`, `percentage`, or both. */
export interface SvStatusUptimeDay {
  /** The calendar day, `YYYY-MM-DD`, in the zone your monitoring reports in. */
  readonly date: string;
  /** The worst state the component was in that day. Derived from `percentage` when left out. */
  readonly status?: SvStatusLevel;
  /** Measured availability that day, `0`–`100`. */
  readonly percentage?: number;
}

/** One monitored service — a row with its current state and its uptime bar. */
export interface SvStatusComponent {
  /** Stable identity — what an incident's or a window's `components` name. */
  readonly id: string;
  /** What the service is called. */
  readonly name: string;
  /** Rows sharing a group are listed under one heading, in first-seen order. */
  readonly group?: string;
  /** Its state right now. */
  readonly status: SvStatusLevel;
  /** One entry per day, any order. Days with no entry draw as "No data". */
  readonly uptime?: readonly SvStatusUptimeDay[];
  /**
   * Your monitoring's own figure for the window, `0`–`100`. Wins over the one
   * averaged from `uptime`, which can only see the days it was given.
   */
  readonly uptimePercent?: number;
}

/** One post on an incident. */
export interface SvIncidentUpdate {
  /** When it was posted. */
  readonly at: SvStatusInstant;
  /** The incident's status as of this post. */
  readonly status: SvIncidentStatus;
  /** What the post says. Plain text. */
  readonly message: string;
}

/** An incident, active or resolved. */
export interface SvStatusIncident {
  /** Stable identity. */
  readonly id: string;
  /** The headline. */
  readonly title: string;
  /** Its status now. `resolved` moves it into the history. */
  readonly status: SvIncidentStatus;
  /** How badly it hurts — an active incident raises the overall status to match. */
  readonly impact: SvIncidentImpact;
  /** Its posts, any order; shown newest first. */
  readonly updates: readonly SvIncidentUpdate[];
  /** Ids of the components it affects. */
  readonly components?: readonly string[];
}

/** A planned maintenance window. */
export interface SvStatusMaintenance {
  /** Stable identity. */
  readonly id: string;
  /** What is being done. */
  readonly title: string;
  /** When the window opens. */
  readonly startsAt: SvStatusInstant;
  /** When it closes. */
  readonly endsAt: SvStatusInstant;
  /** Where it is. @default 'scheduled' */
  readonly status?: SvMaintenanceStatus;
  /** What customers should expect. Plain text. */
  readonly description?: string;
  /** Ids of the components it affects. */
  readonly components?: readonly string[];
}

// ─── Status ──────────────────────────────────────────────────────────────────

/** Severity order, mildest first. */
const RANK: Readonly<Record<SvStatusLevel, number>> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  'partial-outage': 3,
  'major-outage': 4,
};

/** What an active incident of each impact does to the overall status. */
const IMPACT_LEVEL: Readonly<Record<SvIncidentImpact, SvStatusLevel>> = {
  none: 'operational',
  minor: 'degraded',
  major: 'partial-outage',
  critical: 'major-outage',
};

/** True for one of the five status levels. */
export function svIsStatusLevel(value: unknown): value is SvStatusLevel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RANK, value);
}

/** The worse of the levels given; `operational` for none. Unknown values are ignored. */
export function svWorstStatus(levels: Iterable<unknown>): SvStatusLevel {
  let worst: SvStatusLevel = 'operational';
  for (const level of levels) {
    if (svIsStatusLevel(level) && RANK[level] > RANK[worst]) worst = level;
  }
  return worst;
}

/**
 * The page's overall status: the worst of every component's current status,
 * every active incident's impact (`minor` → degraded, `major` → partial outage,
 * `critical` → major outage) and `maintenance` while a window is in progress.
 * So a critical incident on a service nobody listed still reads as an outage.
 */
export function svOverallStatus(
  components: readonly Pick<SvStatusComponent, 'status'>[],
  incidents: readonly Pick<SvStatusIncident, 'status' | 'impact'>[] = [],
  maintenances: readonly Pick<SvStatusMaintenance, 'status'>[] = [],
): SvStatusLevel {
  const levels: unknown[] = components.map((c) => c?.status);
  for (const incident of incidents) {
    if (incident && incident.status !== 'resolved' && IMPACT_LEVEL[incident.impact]) levels.push(IMPACT_LEVEL[incident.impact]);
  }
  if (maintenances.some((m) => m?.status === 'in-progress')) levels.push('maintenance');
  return svWorstStatus(levels);
}

/**
 * A day's status from its availability: ≥ 99.9 % operational, ≥ 99 % degraded,
 * ≥ 95 % partial outage, below that a major outage. Null for no usable figure.
 */
export function svStatusFromUptime(percentage: number | null | undefined): SvStatusLevel | null {
  if (typeof percentage !== 'number' || !Number.isFinite(percentage)) return null;
  const pct = Math.min(100, Math.max(0, percentage));
  if (pct >= 99.9) return 'operational';
  if (pct >= 99) return 'degraded';
  if (pct >= 95) return 'partial-outage';
  return 'major-outage';
}

/** A usable percentage clamped to `0`–`100`, or null. */
export function svClampPercent(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

// ─── Calendar days ───────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` → UTC midnight in ms, or null. A calendar day, not an instant. */
export function svDayToUtc(day: string): number | null {
  const m = typeof day === 'string' ? ISO_DAY.exec(day.trim()) : null;
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const back = new Date(ms);
  // Rejects 2026-02-31 rather than rolling it into March.
  return back.getUTCDate() === Number(m[3]) && back.getUTCMonth() === Number(m[2]) - 1 ? ms : null;
}

/** UTC midnight in ms → `YYYY-MM-DD`. */
export function svUtcToDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The `count` calendar days ending on `end`, oldest first. */
export function svDayWindow(end: string, count: number): readonly string[] {
  const endMs = svDayToUtc(end);
  if (endMs === null || count < 1) return [];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(svUtcToDay(endMs - i * DAY_MS));
  return out;
}

/** An instant as epoch ms, or null when it does not parse. */
export function svInstantMs(value: SvStatusInstant | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The calendar day an instant falls on in `timeZone` (the viewer's own when
 * null) — 23:30 in Berlin is already tomorrow in Auckland.
 */
export function svDayInZone(ms: number, timeZone: string | null): string {
  const parts = new Intl.DateTimeFormat(SV_MACHINE_LOCALE, {
    timeZone: timeZone ?? undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** `timeZone` when `Intl` accepts it, otherwise null (the viewer's zone). */
export function svValidTimeZone(timeZone: string | null | undefined): string | null {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return null;
  try {
    new Intl.DateTimeFormat(SV_MACHINE_LOCALE, { timeZone: timeZone.trim() });
    return timeZone.trim();
  } catch {
    return null;
  }
}

// ─── Uptime ──────────────────────────────────────────────────────────────────

/** What one bar cell says. */
export interface SvUptimeCell {
  readonly date: string;
  /** `null` when the day has no record. */
  readonly status: SvStatusLevel | null;
  /** The measured figure, or null. */
  readonly percentage: number | null;
}

/** A component's uptime over a window. */
export interface SvUptimeSummary {
  readonly cells: readonly SvUptimeCell[];
  /**
   * The window's availability — the component's `uptimePercent`, else the mean
   * of the days that carry a `percentage`. Null when neither exists.
   */
  readonly percent: number | null;
  /** How many days `percent` is taken over. */
  readonly measuredDays: number;
  /** Days with a record and no outage (operational, degraded or maintenance). */
  readonly goodDays: number;
  /** Days with any record. */
  readonly recordedDays: number;
}

/** One cell per day of `window`, and the figures the summary line quotes. */
export function svUptimeSummary(component: Pick<SvStatusComponent, 'uptime' | 'uptimePercent'>, window: readonly string[]): SvUptimeSummary {
  const byDay = new Map<string, SvStatusUptimeDay>();
  for (const day of Array.isArray(component.uptime) ? component.uptime : []) {
    if (day && typeof day.date === 'string') byDay.set(day.date.trim(), day);
  }
  let sum = 0;
  let measured = 0;
  let good = 0;
  let recorded = 0;
  const cells = window.map((date): SvUptimeCell => {
    const day = byDay.get(date);
    const percentage = svClampPercent(day?.percentage);
    const status = svIsStatusLevel(day?.status) ? day.status : svStatusFromUptime(percentage);
    if (percentage !== null) {
      sum += percentage;
      measured++;
    }
    if (status !== null) {
      recorded++;
      if (status !== 'partial-outage' && status !== 'major-outage') good++;
    }
    return { date, status, percentage };
  });
  const own = svClampPercent(component.uptimePercent);
  return {
    cells,
    percent: own ?? (measured > 0 ? sum / measured : null),
    measuredDays: own !== null ? window.length : measured,
    goodDays: good,
    recordedDays: recorded,
  };
}

/**
 * A percentage for display, floored to two decimals so it never overstates:
 * 99.996 % reads "99.99", not "100.00". Whole numbers drop the decimals.
 */
export function svFormatUptime(percent: number, locale: string): string {
  // The epsilon absorbs float noise (99.98 * 100 = 9997.999…) without rounding a real 99.996 up.
  const floored = Math.floor(percent * 100 + 1e-7) / 100;
  const decimals = Number.isInteger(floored) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale || SV_MACHINE_LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(floored);
  } catch {
    return floored.toFixed(decimals);
  }
}

// ─── Incidents ───────────────────────────────────────────────────────────────

const IMPACT_RANK: Readonly<Record<SvIncidentImpact, number>> = { none: 0, minor: 1, major: 2, critical: 3 };

/** The earliest and latest post of an incident, in ms (null when none parses). */
export function svIncidentSpan(incident: Pick<SvStatusIncident, 'updates'>): { readonly start: number | null; readonly latest: number | null } {
  let start: number | null = null;
  let latest: number | null = null;
  for (const update of Array.isArray(incident.updates) ? incident.updates : []) {
    const ms = svInstantMs(update?.at);
    if (ms === null) continue;
    if (start === null || ms < start) start = ms;
    if (latest === null || ms > latest) latest = ms;
  }
  return { start, latest };
}

/**
 * Active incidents in the order they are listed: the worst impact first, then
 * the most recently updated. Resolved ones are left out.
 */
export function svOrderActiveIncidents<T extends Pick<SvStatusIncident, 'status' | 'impact' | 'updates'>>(incidents: readonly T[]): readonly T[] {
  return incidents
    .filter((i) => i && i.status !== 'resolved')
    .map((incident) => ({ incident, latest: svIncidentSpan(incident).latest ?? -Infinity }))
    .sort(
      (a, b) =>
        (IMPACT_RANK[b.incident.impact] ?? 0) - (IMPACT_RANK[a.incident.impact] ?? 0) || b.latest - a.latest,
    )
    .map((x) => x.incident);
}

/** Resolved incidents grouped by the day each began in `timeZone`, newest day first. */
export function svGroupIncidentHistory<T extends Pick<SvStatusIncident, 'status' | 'updates'>>(
  incidents: readonly T[],
  timeZone: string | null,
): readonly { readonly day: string; readonly incidents: readonly T[] }[] {
  const dated = incidents
    .filter((i) => i && i.status === 'resolved')
    .map((incident) => ({ incident, start: svIncidentSpan(incident).start }))
    .filter((x): x is { incident: T; start: number } => x.start !== null)
    .sort((a, b) => b.start - a.start);
  const groups: { day: string; incidents: T[] }[] = [];
  for (const { incident, start } of dated) {
    const day = svDayInZone(start, timeZone);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.incidents.push(incident);
    else groups.push({ day, incidents: [incident] });
  }
  return groups;
}
