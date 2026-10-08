import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from './error-page.component';
import { ERROR_CATALOGUE } from '../errors.data';

/**
 * 404 — the page the app's own wildcard route can redirect to instead of `''`.
 *
 * ★ A named component for the one error that gets wired into a router, so the
 * `**` route stays readable. Everything it shows lives in `ERROR_CATALOGUE`.
 */
@Component({
  selector: 'sv-errors-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPageComponent],
  templateUrl: './not-found.component.html',
})
export class ErrorsNotFoundComponent {
  protected readonly error = ERROR_CATALOGUE['404'];
}
