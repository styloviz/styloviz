import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAccordionComponent, type AccordionItem } from './accordion.component';

const ITEMS: AccordionItem[] = [
  { id: 'shipping', title: 'Shipping', content: 'Ships in 2 days by courier.' },
  { id: 'returns', title: 'Returns', content: 'Thirty days, no courier needed.' },
];

describe('SvAccordionComponent — a sentence glued around data (FL-B1e)', () => {
  it('announces the search result from a translated plural template', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAccordionComponent, {
      inputs: { items: ITEMS },
      providers: [
        provideSvLabels({
          accordion: { searchMatches: '{count, plural, one {{n} Abschnitt passt zu {query}.} other {{n} Abschnitte passen zu {query}.}}' },
        }),
      ],
    });
    const spy = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
    fixture.componentRef.setInput('searchQuery', 'courier');
    fixture.detectChanges();
    expect(spy.mock.calls.at(-1)?.[0]).toBe('2 Abschnitte passen zu courier.');
    spy.mockRestore();
  });
});
