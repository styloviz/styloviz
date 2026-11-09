import { describePortalContext } from '@testing/portal-context';
import { SvSelectDropdownComponent } from './select-dropdown.component';

/** `FL-J3-FI-01` — the listbox carries dir, lang and a scoped theme into its body portal. */
describePortalContext({
  name: 'sv-select-dropdown',
  component: SvSelectDropdownComponent,
  selector: 'sv-select-dropdown',
  bindings: '[options]="options"',
  props: { options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
  label: 'select-dropdown',
  open: (c) => c.openDropdown(),
});
