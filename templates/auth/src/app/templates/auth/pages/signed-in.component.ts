import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SvButtonComponent } from '@styloviz/button';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_BASE, AUTH_BRAND, AUTH_LOCKED_USER } from '../auth.config';

/**
 * AuthSignedInComponent
 *
 * Where every successful path in this template lands.
 *
 * ★★ IT EXISTS SO THE FLOWS TERMINATE SOMEWHERE HONEST. A demo whose sign-in
 * button navigates to `/dashboard` is a demo with a broken link in it, and one
 * that navigates nowhere leaves the buyer unsure whether it worked. This says
 * plainly that the flow finished and that the destination is theirs to set —
 * and it is the one file to delete when you wire the template into an app.
 */
@Component({
  selector: 'sv-auth-signed-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvButtonComponent, SvIconComponent],
  templateUrl: './signed-in.component.html',
})
export class AuthSignedInComponent {
  protected readonly base = AUTH_BASE;
  /** @deprecated Not read by the template; kept so subclasses still compile. */
  protected readonly brand = AUTH_BRAND;
  protected readonly user = AUTH_LOCKED_USER;
}
