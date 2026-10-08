import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';

/**
 * The one-line validation-error slot every form control renders.
 *
 * `role="alert"` so a rejection that appears after the fact is announced rather
 * than sitting silently below a field the user has already left — the whole
 * point of a server error. The element is not rendered at all when there is no
 * message, so an empty alert region never lingers in the accessibility tree.
 *
 * Pair the `id` with the control's `aria-describedby`, and set `aria-invalid`
 * on the control itself — this component cannot do either for you, since it
 * does not own the input element.
 */
@Component({
  selector: 'sv-field-error',
  standalone: true,
  imports: [SvIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) {
      <p
        [attr.id]="id() || null"
        role="alert"
        class="flex items-center gap-1 text-xs font-medium text-danger-600 dark:text-danger-400"
      >
        <sv-icon name="alert-circle" cssClass="h-3.5 w-3.5 shrink-0" [strokeWidth]="2" />
        {{ message() }}
      </p>
    }
  `,
})
export class SvFieldErrorComponent {
  /** Message to show. Empty renders nothing. */
  message = input<string>('');
  /** Id for the control's `aria-describedby` to point at. */
  id = input<string>('');
}
