import { describePortalContext } from '@testing/portal-context';
import { SvTagInputComponent } from './tag-input.component';

/** `FL-J3-FI-01` — the suggestion panel carries dir, lang and a scoped theme into its body portal. */
describePortalContext({
  name: 'sv-tag-input',
  component: SvTagInputComponent,
  selector: 'sv-tag-input',
  bindings: '[options]="options"',
  props: { options: [{ value: 'design', label: 'Design' }, { value: 'docs', label: 'Docs' }] },
  label: 'tag-input',
  open: (c) => c.open(),
});
