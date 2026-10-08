import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PhoneCountryCode } from './phone-countries';

/**
 * SvPhoneFlagComponent — simplified, stylized flag glyphs for the picker in
 * `sv-phone-input`. These are small hand-drawn approximations (banded
 * colors, not the official spec proportions/emblems) rendered as literal
 * inline `<svg>` markup in the template — a **local asset**, not an image:
 * nothing is fetched, there is no `<img>`, and nothing goes through
 * `[innerHTML]`/`bypassSecurityTrust*`, so there is no sanitization surface
 * at all. Unrecognized codes fall back to a neutral placeholder square
 * rather than rendering nothing.
 */
@Component({
  selector: 'sv-phone-flag',
  standalone: true,
  templateUrl: './phone-flag.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPhoneFlagComponent {
  /** ISO 3166-1 alpha-2 country code. Unrecognized values render a neutral placeholder. */
  code = input<PhoneCountryCode | string>('US');
}
