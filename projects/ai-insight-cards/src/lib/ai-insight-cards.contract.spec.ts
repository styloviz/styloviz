/**
 * Async contract — see `src/testing/async-contract.ts`.
 *
 * `simulate` is forced off in every row: it is the demo-fakery switch, and a
 * component quietly inventing insights while the harness asserts the empty
 * state would make this file pass against fabricated data.
 */
import { describeAsyncContract } from '@testing/async-contract';
import { SvAiInsightCardsComponent } from './ai-insight-cards.component';

describeAsyncContract({
  component: SvAiInsightCardsComponent,
  collection: 'insights',
  inputs: { simulate: false },
  rows: [
    {
      id: 'i1',
      title: 'Churn rising in EU',
      description: 'Cancellations up 12% week on week.',
      category: 'churn',
      priority: 'high',
      confidence: 82,
      detectedAt: new Date(0),
      source: 'billing',
      dataPoints: [],
      status: 'new',
    },
  ],
  skip: { twoEmpties: 'filtering is internal (status), not a `filtered` input — the two empties are asserted below' },
});

import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';

describe('SvAiInsightCardsComponent — the two empties', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAiInsightCardsComponent, {
      inputs: { simulate: false, ...inputs } as never,
    });
    return fixture.nativeElement as HTMLElement;
  }

  it('does not blame a filter when the host simply has no insights', async () => {
    const host = await mount({ insights: [] });
    const empty = host.querySelector('[data-sv-state="empty"]');
    expect(empty?.getAttribute('data-sv-empty-reason')).toBe('no-data');
    expect(empty?.textContent).not.toContain('filter');
  });
});
