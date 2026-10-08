import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  type SvDataError,
  type SvSkeletonShellVariant,
} from '@styloviz/core';

/**
 * `<sv-account-async>` — this template's page-level loading and failure frame.
 *
 * Same pattern as the admin template's `<sv-admin-async>` (each template stays
 * copy-paste portable on its own, so this is a small, deliberate duplication
 * rather than a shared import). Content renders only in the resolved branch —
 * a form pre-filled from an empty record invites the user to save blanks over
 * a record that loaded fine a second later.
 */
@Component({
  selector: 'sv-account-async',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvSkeletonShellComponent, SvErrorShellComponent],
  templateUrl: './account-async.component.html',
})
export class SvAccountAsyncComponent {
  readonly loading = input<boolean>(false);
  readonly error = input<SvDataError | string | null>(null);
  readonly skeleton = input<SvSkeletonShellVariant>('table');
  readonly rows = input<number>(6);
  readonly errorTitle = input<string>('Could not load this page');
  readonly loadingLabel = input<string>('Loading');
  readonly retry = output<void>();
}
