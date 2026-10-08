import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from './error-page.component';
import { ERROR_CATALOGUE } from '../errors.data';

/** 500 — something broke on the server, and reloading might just fix it. */
@Component({
  selector: 'sv-errors-server-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPageComponent],
  templateUrl: './server-error.component.html',
})
export class ErrorsServerErrorComponent {
  protected readonly error = ERROR_CATALOGUE['500'];
}
