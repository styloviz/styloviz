import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvCheckboxComponent } from '@styloviz/forms';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_BASE, AUTH_SSO_PROVIDERS } from '../auth.config';
import { authSignIn, isAuthWired } from '../auth.data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * AuthLoginComponent
 *
 * Email and password, the providers beside them, and the one decision this
 * screen actually makes: whether the next screen is the app or a code.
 */
@Component({
  selector: 'sv-auth-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvCheckboxComponent,
    SvAlertBannerComponent,
    SvIconComponent,
  ],
  templateUrl: './login.component.html',
})
export class AuthLoginComponent {
  protected readonly base = AUTH_BASE;
  protected readonly providers = AUTH_SSO_PROVIDERS;
  protected readonly isWired = isAuthWired();

  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly remember = signal(true);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');
  /** Set while a provider hand-off is in flight, so only that button spins. */
  readonly ssoPending = signal('');

  readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));
  readonly canSubmit = computed(() => this.emailValid() && this.password().length > 0);

  readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.email().trim()) return 'Enter your email address.';
    return this.emailValid() ? '' : 'That does not look like an email address.';
  });

  readonly passwordError = computed(() =>
    this.submitted() && !this.password() ? 'Enter your password.' : '',
  );

  async signIn(): Promise<void> {
    this.submitted.set(true);
    if (!this.canSubmit() || this.submitting()) return;

    this.submitting.set(true);
    this.error.set('');
    try {
      const result = await authSignIn(
        this.email().trim(),
        this.password(),
        this.injector,
        this.remember(),
      );
      if (result.requiresTwoFactor) {
        await this.router.navigate([`${AUTH_BASE}/two-factor`]);
        return;
      }
      await this.router.navigate([`${AUTH_BASE}/signed-in`]);
    } catch {
      /**
       * ★★ ONE MESSAGE FOR BOTH FAILURES. "No account with that email" and
       * "wrong password" are separately useful to the person signing in and
       * separately useful to somebody testing a list of addresses. The second
       * matters more.
       */
      this.error.set('That email and password do not match an account.');
      this.password.set('');
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Hand off to an identity provider.
   *
   * In the demo there is nowhere to hand off TO, so it routes to the SSO screen
   * rather than pretending a round trip happened. Wire `AUTH_API.baseUrl` and
   * replace this with your redirect.
   */
  async useProvider(id: string): Promise<void> {
    if (this.ssoPending()) return;
    this.ssoPending.set(id);
    try {
      await this.router.navigate([`${AUTH_BASE}/sso`], { queryParams: { provider: id } });
    } finally {
      this.ssoPending.set('');
    }
  }
}
