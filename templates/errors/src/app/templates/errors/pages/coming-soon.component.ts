import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorPageComponent } from './error-page.component';
import { ERROR_CATALOGUE } from '../errors.data';

/** Pre-launch placeholder — the positive framing of `maintenance`. */
@Component({
  selector: 'sv-errors-coming-soon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPageComponent],
  templateUrl: './coming-soon.component.html',
})
export class ErrorsComingSoonComponent {
  protected readonly error = ERROR_CATALOGUE['coming-soon'];
}
