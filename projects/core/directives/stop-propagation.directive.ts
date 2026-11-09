import { Directive } from '@angular/core';

/**
 * Stops a click reaching an outside-click listener, without putting a
 * behaviour-free handler in the template.
 *
 * Panels that close on an outside click need their own clicks to not count as
 * "outside". The usual spelling is `(click)="$event.stopPropagation()"` on the
 * panel — which reads to both a reviewer and `@angular-eslint`'s
 * `click-events-have-key-events` / `interactive-supports-focus` rules as an
 * interactive element, because it has a click handler. It is not one. There is
 * nothing to reach by keyboard because there is no behaviour: the handler exists
 * to *prevent* an effect, not to cause one.
 *
 * That accounted for 31 elements — roughly 62 of the 147 keyboard-accessibility
 * warnings in this repo, none of them a real defect, all of them crowding out
 * the ones that are.
 *
 * Naming the intent fixes both problems: the template says what it means, and
 * the rules stop reporting an interaction that does not exist.
 *
 * @example <div class="panel" svStopPropagation> … </div>
 */
@Directive({
  selector: '[svStopPropagation]',
  standalone: true,
  host: { '(click)': '$event.stopPropagation()' },
})
export class SvStopPropagationDirective {}
