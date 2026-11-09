import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { provideSvLabels } from '@styloviz/core/i18n';
import { untilRendered } from '../../../../src/testing/async';
import { SvTabsComponent, type TabItem } from './tabs.component';
import { SV_TABS_LABELS } from './tabs.labels';

const TABS: TabItem[] = [
  { id: 'inbox', label: 'Inbox', dot: true, closable: true },
  { id: 'sent', label: 'Sent' },
];

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvTabsComponent, { inputs: { tabs: TABS }, providers: providers as never[] });
}

describe('SvTabsComponent — labels (FL-B1d)', () => {
  it('reads the English defaults', async () => {
    await setup();
    expect(screen.getByText(SV_TABS_LABELS.closeHint)).toBeTruthy();
  });

  it('renders the text an app provides', async () => {
    await setup([provideSvLabels({ tabs: { unread: '(ungelesen)', closeHint: 'Entf drücken, um den Tab zu schließen.' } })]);
    expect(screen.getByText('(ungelesen)')).toBeTruthy();
    expect(screen.getByText('Entf drücken, um den Tab zu schließen.')).toBeTruthy();
    expect(screen.queryByText('(unread)')).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [SvTabsComponent],
  template: `<sv-tabs [tabs]="tabs()" [(activeId)]="active" (tabClose)="remove($event)" />`,
})
class ClosingHost {
  readonly tabs = signal<TabItem[]>([
    { id: 'a', label: 'Alpha', closable: true },
    { id: 'b', label: 'Bravo', closable: true },
  ]);
  readonly active = signal('a');
  remove(tab: TabItem): void {
    this.tabs.update((list) => list.filter((t) => t.id !== tab.id));
  }
}

describe('SvTabsComponent — a sentence glued around data (FL-B1e)', () => {
  it('announces a closed tab from a translated template', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ClosingHost, {
      providers: [provideSvLabels({ tabs: { tabClosed: 'Tab {label} geschlossen.' } })],
    });
    const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
    const alpha = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[role="tab"]')!;
    alpha.focus();
    alpha.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    fixture.detectChanges();
    await untilRendered(fixture, () => announce.mock.calls.length > 0);
    expect(announce).toHaveBeenCalledWith('Tab Alpha geschlossen.');
  });
});
