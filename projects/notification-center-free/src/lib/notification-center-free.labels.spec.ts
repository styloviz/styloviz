import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvNotificationCenterComponent } from './notification-center.component';
import { SV_NOTIFICATION_CENTER_LABELS } from './notification-center-free.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvNotificationCenterComponent, {
    inputs: {},
    providers: providers as never[],
  });
  return view;
}

describe('SvNotificationCenterComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_NOTIFICATION_CENTER_LABELS.openNotifications }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ notificationCenter: { openNotifications: 'Benachrichtigungen öffnen' } })]);
    expect(screen.getAllByRole('button', { name: 'Benachrichtigungen öffnen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Open notifications' })).toBeNull();
  });
});

describe('SvNotificationCenterComponent — visible text (FL-B1d)', () => {
  it('renders the empty state and heading an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvNotificationCenterComponent, {
      inputs: { variant: 'inline', notifications: [] },
      providers: [provideSvLabels({ notificationCenter: { emptyTitle: 'Alles erledigt', panelTitle: 'Benachrichtigungen' } })],
    });
    const empty = document.querySelector('[data-sv-state="empty"]');
    expect(empty?.textContent).toContain('Alles erledigt');
    expect(empty?.textContent).not.toContain(SV_NOTIFICATION_CENTER_LABELS.emptyTitle);
    expect(screen.getAllByText('Benachrichtigungen').length).toBeGreaterThan(0);
  });
});

describe('SvNotificationCenterComponent — text built in TypeScript (FL-B1e)', () => {
  it('renders the relative time and tab text an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvNotificationCenterComponent, {
      inputs: {
        variant: 'inline',
        notifications: [{ id: 'n1', type: 'comment', title: 'Hallo', timestamp: new Date().toISOString(), read: true }],
      },
      providers: [provideSvLabels({ notificationCenter: { timeJustNow: 'gerade eben', tabUnread: 'Ungelesen' } })],
    });
    expect(screen.getAllByText('gerade eben').length).toBeGreaterThan(0);
    expect(screen.queryByText('just now')).toBeNull();
    expect(screen.getAllByText('Ungelesen').length).toBeGreaterThan(0);
  });
});
