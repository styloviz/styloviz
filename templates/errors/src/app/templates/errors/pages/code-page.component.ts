import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ErrorPageComponent } from './error-page.component';
import { ERROR_CATALOGUE, type ErrorDefinition, type ErrorKey } from '../errors.data';

/**
 * Every other error page, resolved from the route.
 *
 * ★★ ONE COMPONENT FOR NINE ROUTES. `data: { errorKey: '403' }` is the whole
 * difference between them, so a new status code is a route entry and a
 * catalogue row — not another file that has to be kept in step with this one.
 *
 * ★ An unknown key falls back to 404 rather than rendering an empty page. A
 * broken error route must still produce something a visitor can leave from.
 */
@Component({
  selector: 'sv-errors-code-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPageComponent],
  templateUrl: './code-page.component.html',
})
export class ErrorsCodePageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  protected readonly error = computed<ErrorDefinition>(() => {
    const key = this.data()['errorKey'] as ErrorKey | undefined;
    return (key && ERROR_CATALOGUE[key]) || ERROR_CATALOGUE['404'];
  });
}
