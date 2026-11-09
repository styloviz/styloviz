import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvTimelineComponent, type TimelineItem } from './timeline.component';
import { SV_TIMELINE_LABELS } from './timeline-free.labels';

const STEPS: TimelineItem[] = [
  { id: 'a', title: 'Ordered' },
  { id: 'b', title: 'Shipped' },
];

/** FL-B1c: a composed name is one template, so a translation can move the slot. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvTimelineComponent, {
    inputs: { items: STEPS, layout: 'horizontal', ariaLabel: 'Lieferung' },
    providers: providers as never[],
  });
}

describe('SvTimelineComponent — accessible names', () => {
  it('names the scrolling region in English by default', async () => {
    await setup();
    expect(SV_TIMELINE_LABELS.scrollableList).toBe('{name}, scrollable');
    expect(screen.getByRole('region', { name: 'Lieferung, scrollable' })).toBeTruthy();
  });

  it('fills a translated template whose slot sits in a different position', async () => {
    await setup([provideSvLabels({ timeline: { scrollableList: 'Scrollbar: {name}' } })]);
    expect(screen.getByRole('region', { name: 'Scrollbar: Lieferung' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Lieferung, scrollable' })).toBeNull();
  });
});

describe('SvTimelineComponent — visible labels (FL-B1d)', () => {
  it('renders the empty-state heading an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvTimelineComponent, {
      inputs: { items: [] },
      providers: [provideSvLabels({ timeline: { emptyMessage: 'Keine Ereignisse vorhanden' } })],
    });
    expect(screen.getByText('Keine Ereignisse vorhanden')).toBeTruthy();
    expect(screen.queryByText(SV_TIMELINE_LABELS.emptyMessage)).toBeNull();
  });
});

describe('SvTimelineComponent — composed text (FL-B1e)', () => {
  it('builds the expand control from the label an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvTimelineComponent, {
      inputs: { items: [...STEPS, { id: 'c', title: 'Delivered' }], collapseAfter: 1 },
      providers: [
        provideSvLabels({
          timeline: { showMoreEntries: '{count, plural, one {{n} weiteren Eintrag zeigen} other {{n} weitere Einträge zeigen}}' },
        }),
      ],
    });
    expect(screen.getByRole('button', { name: '2 weitere Einträge zeigen' })).toBeTruthy();
  });
});

describe('SvTimelineComponent — one-word UI text (FL-B1e)', () => {
  it('names a dot colour in the words an app provides', async () => {
    TestBed.resetTestingModule();
    const items: TimelineItem[] = [{ id: 'b', title: 'Deploy failed', variant: 'error' }];
    const { fixture } = await render(SvTimelineComponent, {
      inputs: { items },
      providers: [provideSvLabels({ timeline: { variantError: 'Fehler' } })],
    });
    const names = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="img"]')].map((n) =>
      n.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Fehler']);
  });
});
