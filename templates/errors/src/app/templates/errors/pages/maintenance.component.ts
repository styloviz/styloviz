import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from './error-page.component';
import { ERROR_CATALOGUE } from '../errors.data';

/** Scheduled maintenance — down on purpose, with an optional "notify me". */
@Component({
  selector: 'sv-errors-maintenance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPageComponent],
  templateUrl: './maintenance.component.html',
})
export class ErrorsMaintenanceComponent {
  protected readonly error = ERROR_CATALOGUE['maintenance'];
}
