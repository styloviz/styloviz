import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from './error-page.component';
import { ERROR_CATALOGUE } from '../errors.data';

/** 503 — temporarily unavailable (overloaded, deploying, etc.), not broken. */
@Component({
  selector: 'sv-errors-unavailable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPageComponent],
  templateUrl: './unavailable.component.html',
})
export class ErrorsUnavailableComponent {
  protected readonly error = ERROR_CATALOGUE['503'];
}
