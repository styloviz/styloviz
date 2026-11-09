import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { describeAsyncContract } from '@testing/async-contract';
import { SvStatusPageComponent } from './status-page.component';
import {
  svDayWindow,
  svFormatUptime,
  svGroupIncidentHistory,
  svOrderActiveIncidents,
  svOverallStatus,
  svStatusFromUptime,
  svUptimeSummary,
  type SvStatusComponent,
  type SvStatusIncident,
  type SvStatusMaintenance,
  type SvStatusUptimeDay,
} from './status-page.logic';

/**
 * `sv-status-page` — what is worth pinning is the arithmetic a visitor trusts
 * (the overall status and the uptime figure), the order incidents are read in,
 * and that every state says itself in words as well as colour.
 */

const UPDATED = '2026-10-26T12:00:00Z';
const WINDOW = svDayWindow('2026-10-26', 90);

/** 90 days ending 26 Oct 2026, every one at `pct`, with overrides by date. */
function days(pct: number, overrides: Readonly<Record<string, Partial<SvStatusUptimeDay>>> = {}): SvStatusUptimeDay[] {
  return WINDOW.map((date) => ({ date, percentage: pct, ...overrides[date] }));
}

const COMPONENTS: readonly SvStatusComponent[] = [
  { id: 'api', name: 'API', group: 'Core', status: 'operational', uptime: days(100, { '2026-10-20': { percentage: 98.2 } }) },
  { id: 'web', name: 'Dashboard', group: 'Core', status: 'operational', uptime: days(100) },
  { id: 'mail', name: 'Email delivery', status: 'operational', uptime: days(100) },
];

const INCIDENTS: readonly SvStatusIncident[] = [
  {
    id: 'inc-minor',
    title: 'Slow exports',
    status: 'monitoring',
    impact: 'minor',
    components: ['web'],
    updates: [
      { at: '2026-10-26T09:00:00Z', status: 'investigating', message: 'Exports are queueing.' },
      { at: '2026-10-26T10:30:00Z', status: 'monitoring', message: 'A fix is rolling out.' },
    ],
  },
  {
    id: 'inc-critical',
    title: 'API errors',
    status: 'identified',
    impact: 'critical',
    components: ['api'],
    updates: [{ at: '2026-10-26T08:00:00Z', status: 'identified', message: 'A bad deploy; rolling back.' }],
  },
  {
    id: 'inc-old',
    title: 'Webhook delays',
    status: 'resolved',
    impact: 'major',
    updates: [
      { at: '2026-10-20T23:30:00Z', status: 'investigating', message: 'Webhooks are late.' },
      { at: '2026-10-21T01:00:00Z', status: 'resolved', message: 'Caught up.' },
    ],
  },
];

async function mount(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvStatusPageComponent, {
    inputs: { components: COMPONENTS, lastUpdated: UPDATED, timeZone: 'UTC', locale: 'en-US', ...inputs } as never,
    providers: providers as never[],
  });
  result.fixture.detectChanges();
  await result.fixture.whenStable();
  return result.fixture;
}

type Fixture = Awaited<ReturnType<typeof mount>>;
const el = (f: Fixture) => f.nativeElement as HTMLElement;
const banner = (f: Fixture) => el(f).querySelector<HTMLElement>('[data-sv-status-banner]')!;
const row = (f: Fixture, id: string) => el(f).querySelector<HTMLElement>(`[data-sv-status-component="${id}"]`)!;

// ─── Pure logic ──────────────────────────────────────────────────────────────

describe('status page logic', () => {
  it('derives the overall status as the worst component, active incident or maintenance', () => {
    expect(svOverallStatus([{ status: 'operational' }, { status: 'operational' }])).toBe('operational');
    expect(svOverallStatus([{ status: 'operational' }, { status: 'degraded' }, { status: 'maintenance' }])).toBe('degraded');
    expect(svOverallStatus([{ status: 'partial-outage' }, { status: 'major-outage' }])).toBe('major-outage');
    // A critical incident on a component nobody listed still reads as an outage.
    expect(svOverallStatus([{ status: 'operational' }], [{ status: 'investigating', impact: 'critical' }])).toBe('major-outage');
    expect(svOverallStatus([{ status: 'operational' }], [{ status: 'monitoring', impact: 'major' }])).toBe('partial-outage');
    // Resolved incidents and no-impact notices change nothing.
    expect(svOverallStatus([{ status: 'operational' }], [{ status: 'resolved', impact: 'critical' }, { status: 'identified', impact: 'none' }])).toBe('operational');
    expect(svOverallStatus([{ status: 'operational' }], [], [{ status: 'in-progress' }])).toBe('maintenance');
    expect(svOverallStatus([{ status: 'operational' }], [], [{ status: 'scheduled' }])).toBe('operational');
  });

  it('reads a day status from its percentage at fixed thresholds', () => {
    expect(svStatusFromUptime(100)).toBe('operational');
    expect(svStatusFromUptime(99.9)).toBe('operational');
    expect(svStatusFromUptime(99.5)).toBe('degraded');
    expect(svStatusFromUptime(97)).toBe('partial-outage');
    expect(svStatusFromUptime(40)).toBe('major-outage');
    expect(svStatusFromUptime(Number.NaN)).toBeNull();
    expect(svStatusFromUptime(undefined)).toBeNull();
  });

  it('averages uptime over the days that carry a percentage, and prefers the component figure', () => {
    const one = svUptimeSummary({ uptime: days(100, { '2026-10-20': { percentage: 98.2 } }) }, WINDOW);
    expect(one.cells).toHaveLength(90);
    expect(one.measuredDays).toBe(90);
    expect(one.percent).toBeCloseTo((89 * 100 + 98.2) / 90, 6);

    const partial = svUptimeSummary({ uptime: [{ date: '2026-10-26', percentage: 99 }, { date: '2026-10-25', status: 'operational' }] }, WINDOW);
    expect(partial.measuredDays).toBe(1);
    expect(partial.percent).toBe(99);
    expect(partial.recordedDays).toBe(2);
    expect(partial.cells.filter((c) => c.status === null)).toHaveLength(88);

    expect(svUptimeSummary({ uptime: days(50), uptimePercent: 99.98 }, WINDOW).percent).toBe(99.98);

    const statusOnly = svUptimeSummary({ uptime: [{ date: '2026-10-26', status: 'major-outage' }, { date: '2026-10-25', status: 'degraded' }] }, WINDOW);
    expect(statusOnly.percent).toBeNull();
    expect(statusOnly.goodDays).toBe(1);
  });

  it('floors the shown percentage so it never overstates', () => {
    expect(svFormatUptime(99.996, 'en-US')).toBe('99.99');
    expect(svFormatUptime(100, 'en-US')).toBe('100');
    expect(svFormatUptime(99.5, 'de-DE')).toBe('99,50');
  });

  it('orders active incidents worst impact first, then most recently updated, and drops resolved ones', () => {
    expect(svOrderActiveIncidents(INCIDENTS).map((i) => i.id)).toEqual(['inc-critical', 'inc-minor']);
    const tie: SvStatusIncident[] = [
      { id: 'a', title: 'A', status: 'investigating', impact: 'minor', updates: [{ at: '2026-10-26T01:00:00Z', status: 'investigating', message: '' }] },
      { id: 'b', title: 'B', status: 'investigating', impact: 'minor', updates: [{ at: '2026-10-26T05:00:00Z', status: 'investigating', message: '' }] },
    ];
    expect(svOrderActiveIncidents(tie).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('groups resolved incidents by the day they began in the given zone', () => {
    expect(svGroupIncidentHistory(INCIDENTS, 'UTC').map((g) => g.day)).toEqual(['2026-10-20']);
    // 23:30 UTC on the 20th is already the 21st in Tokyo.
    expect(svGroupIncidentHistory(INCIDENTS, 'Asia/Tokyo').map((g) => g.day)).toEqual(['2026-10-21']);
  });
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('SvStatusPageComponent', () => {
  it('shows the derived overall status in words and with an icon, not colour alone', async () => {
    const f = await mount();
    expect(banner(f).textContent).toContain('All systems operational');
    expect(banner(f).querySelector('sv-icon')).toBeTruthy();
    expect(el(f).querySelector('[data-sv-status-page]')?.getAttribute('data-status')).toBe('operational');

    const withIncidents = await mount({ incidents: INCIDENTS });
    expect(banner(withIncidents).textContent).toContain('Major system outage');
  });

  it('uses a given status over the derived one', async () => {
    const f = await mount({ status: 'maintenance' });
    expect(banner(f).textContent).toContain('Maintenance in progress');
  });

  it('is a live region only when asked to be', async () => {
    expect(banner(await mount()).getAttribute('role')).toBeNull();
    expect(banner(await mount({ live: true })).getAttribute('role')).toBe('status');
  });

  it('shows "Last updated" in the page time zone', async () => {
    const f = await mount();
    const time = el(f).querySelector('[data-sv-status-updated]')!;
    expect(time.textContent).toContain('Last updated');
    expect(time.textContent).toContain('UTC');
    expect(time.getAttribute('datetime')).toBe('2026-10-26T12:00:00.000Z');
  });

  it('draws one cell per day and states the uptime in words', async () => {
    const f = await mount();
    const api = row(f, 'api');
    expect(api.querySelectorAll('[data-sv-status-bar] > span')).toHaveLength(90);
    expect(api.querySelector('[data-sv-status-uptime]')?.textContent?.trim()).toBe('99.98% uptime over 90 days');
    const bar = api.querySelector('[data-sv-status-bar]')!;
    expect(bar.getAttribute('role')).toBe('img');
    expect(bar.getAttribute('aria-label')).toContain('API: 99.98% uptime over 90 days');
    const bad = api.querySelector<HTMLElement>('[data-date="2026-10-20"]')!;
    expect(bad.getAttribute('title')).toBe('Oct 20, 2026: Partial outage, 98.20% uptime');
    // The non-operational day is listed for a screen reader too.
    expect(api.querySelector('[data-sv-status-issues]')?.textContent).toContain('Oct 20, 2026: Partial outage');
    expect(row(f, 'web').querySelector('[data-sv-status-issues]')).toBeNull();
  });

  it('says each component state in text', async () => {
    const f = await mount({ components: [{ id: 'x', name: 'Search', status: 'degraded', uptime: [] }] });
    expect(row(f, 'x').querySelector('[data-sv-status-state]')?.textContent?.trim()).toBe('Degraded performance');
    expect(row(f, 'x').querySelector('[data-sv-status-uptime]')?.textContent?.trim()).toBe('No uptime data yet');
  });

  it('lists active incidents on top, worst first, with their updates newest first', async () => {
    const f = await mount({ incidents: INCIDENTS });
    const active = [...el(f).querySelectorAll('[data-sv-status-active] [data-sv-status-incident]')].map((n) => n.getAttribute('data-sv-status-incident'));
    expect(active).toEqual(['inc-critical', 'inc-minor']);
    const minor = el(f).querySelector('[data-sv-status-incident="inc-minor"]')!;
    expect(minor.textContent).toContain('Affects Dashboard');
    const text = minor.querySelector('sv-timeline')?.textContent ?? '';
    expect(text.indexOf('A fix is rolling out.')).toBeLessThan(text.indexOf('Exports are queueing.'));
    const history = el(f).querySelector('[data-sv-status-history]')!;
    expect(history.querySelector('[data-sv-status-day="2026-10-20"] [data-sv-status-incident="inc-old"]')).toBeTruthy();
  });

  it('says there were no incidents rather than showing an empty state', async () => {
    const f = await mount();
    expect(el(f).querySelector('[data-sv-status-no-history]')?.textContent).toContain('No incidents reported.');
    expect(el(f).querySelector('[data-sv-state]')).toBeNull();
  });

  it('lists maintenance in progress first and leaves completed windows out', async () => {
    const maintenances: SvStatusMaintenance[] = [
      { id: 'later', title: 'Database upgrade', startsAt: '2026-11-02T02:00:00Z', endsAt: '2026-11-02T04:00:00Z' },
      { id: 'now', title: 'Network work', startsAt: '2026-10-26T11:00:00Z', endsAt: '2026-10-26T13:00:00Z', status: 'in-progress' },
      { id: 'done', title: 'Old work', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-01T01:00:00Z', status: 'completed' },
    ];
    const f = await mount({ maintenances });
    const ids = [...el(f).querySelectorAll('[data-sv-status-window]')].map((n) => n.getAttribute('data-sv-status-window'));
    expect(ids).toEqual(['now', 'later']);
    expect(banner(f).textContent).toContain('Maintenance in progress');
  });

  it('takes per-instance and registry labels', async () => {
    const own = await mount({ labels: { statusBannerOperational: 'Everything is fine' } });
    expect(banner(own).textContent).toContain('Everything is fine');
    const registry = await mount({}, [provideSvLabels({ display: { statusComponentsHeading: 'Services' } })]);
    expect(el(registry).querySelector('[data-sv-status-components]')?.textContent).toContain('Services');
  });

  it('is not empty while only incidents have been published', async () => {
    const f = await mount({ components: [], incidents: INCIDENTS });
    expect(el(f).querySelector('[data-sv-state="empty"]')).toBeNull();
    expect(el(f).querySelector('[data-sv-status-active]')).toBeTruthy();
  });

  it('renders the empty state when nothing at all was published', async () => {
    const f = await mount({ components: [], incidents: [], maintenances: [] });
    const empty = el(f).querySelector('[data-sv-state="empty"]');
    expect(empty?.textContent).toContain('Nothing published yet');
  });
});

describeAsyncContract({
  component: SvStatusPageComponent,
  collection: 'components',
  rows: COMPONENTS,
  inputs: { lastUpdated: UPDATED, timeZone: 'UTC', locale: 'en-US' },
  loadedSelector: '[data-sv-status-bar]',
  skip: {
    twoEmpties:
      'a status page shows everything the host published — it has no filter or search of its own, so every ' +
      'empty is `no-data`. A `filtered` input would be one no host could meaningfully set.',
  },
});
