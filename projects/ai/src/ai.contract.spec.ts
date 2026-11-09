/**
 * Async contract — see `src/testing/async-contract.ts`.
 */
import { describeAsyncContract } from '@testing/async-contract';
import { SvSuggestionsComponent } from './suggestions/suggestions.component';

describeAsyncContract({
  component: SvSuggestionsComponent,
  collection: 'suggestions',
  rows: [{ id: 's1', label: 'Summarise this week' }],
  loadedSelector: '[data-sv-suggestions]',
  skip: { twoEmpties: 'there is no filter here, so every empty is no-data' },
});
