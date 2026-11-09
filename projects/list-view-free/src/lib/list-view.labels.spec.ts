import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels, svFormatLabel } from '@styloviz/core/i18n';
import { SvListViewComponent, type ListViewItem } from './list-view.component';
import { SV_LIST_VIEW_LABELS } from './list-view.labels';

/** FL-B1c: a composed accessible name is one template whose slots a translation may reorder. */
const ITEMS: ListViewItem[] = [
  { id: 1, title: 'Alpha' },
  { id: 2, title: 'Beta' },
];

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvListViewComponent, {
    inputs: { items: ITEMS, mode: 'checklist' },
    providers: providers as never[],
  });
}

describe('SvListViewComponent — accessible names', () => {
  it('names each checkbox in English by default', async () => {
    await setup();
    expect(screen.getByRole('checkbox', { name: svFormatLabel(SV_LIST_VIEW_LABELS.checkItem, { title: 'Alpha' }, 'en-US') })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Check Alpha' })).toBeTruthy();
  });

  it('fills a composed name from a template whose slot moves', async () => {
    await setup([provideSvLabels({ listView: { checkItem: '{title} abhaken' } })]);
    expect(screen.getByRole('checkbox', { name: 'Alpha abhaken' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Check Alpha' })).toBeNull();
  });
});

describe('SvListViewComponent — visible text (FL-B1d)', () => {
  it('renders the empty-state title an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvListViewComponent, {
      inputs: { items: [] as ListViewItem[] },
      providers: [provideSvLabels({ listView: { emptyTitle: 'Noch nichts hier' } })],
    });
    const empty = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-state="empty"]');
    expect(empty?.textContent).toContain('Noch nichts hier');
    expect(empty?.textContent).not.toContain(SV_LIST_VIEW_LABELS.emptyTitle);
  });
});

describe('SvListViewComponent — text built in TypeScript (FL-B1e)', () => {
  it('announces a call type in the language an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvListViewComponent, {
      inputs: { mode: 'call-history', items: [{ id: 1, title: 'Ada Lovelace', callType: 'missed' }] as ListViewItem[] },
      providers: [provideSvLabels({ listView: { callMissed: 'Verpasster Anruf' } })],
    });
    const sr = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.sr-only')].find((n) => n.textContent?.trim());
    expect(sr?.textContent?.trim()).toBe('Verpasster Anruf');
  });
});
