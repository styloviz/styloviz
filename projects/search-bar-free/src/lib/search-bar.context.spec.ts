import { describePortalContext } from '@testing/portal-context';
import { SvSearchBarComponent } from './search-bar.component';

/** `FL-J3-FI-01` — the suggestion panel carries dir, lang and a scoped theme into its body portal. */
describePortalContext({
  name: 'sv-search-bar',
  component: SvSearchBarComponent,
  selector: 'sv-search-bar',
  bindings: '[suggestions]="suggestions"',
  props: { suggestions: [{ id: '1', label: 'Invoices' }, { id: '2', label: 'Inventory' }] },
  label: 'search-bar',
  open: (c) => c.onFocus(),
});
