import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_BASE, AUTH_SSO_DOMAINS, AUTH_SSO_PROVIDERS, type AuthSsoProvider } from '../auth.config';
import { authSignIn, isAuthWired, ssoOrganisationFor } from '../auth.data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * AuthSsoComponent
 *
 * ★★ IT ASKS FOR AN EMAIL AND ROUTES ON THE DOMAIN. Nobody signing in knows —
 * or should have to know — whether their employer bought SSO. Asking "what is
 * your organisation's SSO identifier?" is asking the user to do the lookup,
 * and most of them cannot.
 *
 * ★ A domain that is not enrolled gets an answer, not a dead end: it says so
 * and offers the password route, because "we could not find a configuration"
 * with no way forward is where support tickets come from.
 */
@Component({
  selector: 'sv-auth-sso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvAlertBannerComponent,
    SvIconComponent,
  ],
  templateUrl: './sso.component.html',
})
export class AuthSsoComponent {
  protected readonly base = AUTH_BASE;
  protected readonly isWired = isAuthWired();
  /** Shown in demo mode so the enrolled domains are discoverable. */
  protected readonly knownDomains = Object.keys(AUTH_SSO_DOMAINS);

  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly checking = signal(false);
  readonly redirecting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');

  /** The organisation found for the current address, once looked up. */
  readonly organisation = signal<string | null>(null);
  /** True once a lookup has run for the address currently in the box. */
  readonly resolved = signal(false);

  readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));

  /**
   * The provider the sign-in screen sent us here for, from `?provider=`.
   *
   * ★ Looked up in `AUTH_SSO_PROVIDERS`, never echoed: an unknown value is
   *   ignored rather than rendered, so a crafted link cannot put its own words
   *   on this page.
   */
  private readonly providerParam = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('provider') ?? '')),
    { initialValue: '' },
  );
  readonly provider = computed<AuthSsoProvider | null>(
    () => AUTH_SSO_PROVIDERS.find((p) => p.id === this.providerParam()) ?? null,
  );

  readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.email().trim()) return 'Enter your work email address.';
    return this.emailValid() ? '' : 'That does not look like an email address.';
  });

  readonly domain = computed(() => {
    const at = this.email().trim().toLowerCase().lastIndexOf('@');
    return at < 0 ? '' : this.email().trim().toLowerCase().slice(at + 1);
  });

  /** Editing the address invalidates the answer that was found for the old one. */
  onEmailChange(value: string): void {
    this.email.set(value);
    if (this.resolved()) {
      this.resolved.set(false);
      this.organisation.set(null);
      this.error.set('');
    }
  }

  async findOrganisation(): Promise<void> {
    this.submitted.set(true);
    if (!this.emailValid() || this.checking()) return;

    this.checking.set(true);
    this.error.set('');
    try {
      const org = ssoOrganisationFor(this.email());
      this.organisation.set(org);
      this.resolved.set(true);
      if (!org) {
        this.error.set(
          `We could not find an SSO configuration for ${this.domain()}. You can sign in with a password instead.`,
        );
      }
    } finally {
      this.checking.set(false);
    }
  }

  /**
   * Hand off to the identity provider.
   *
   * In the demo there is no provider to redirect to, so it completes the
   * sign-in locally and lands on the code screen or the app — which is what
   * the real round trip would have done.
   */
  async continueToProvider(): Promise<void> {
    if (!this.organisation() || this.redirecting()) return;
    this.redirecting.set(true);
    this.error.set('');
    try {
      const result = await authSignIn(this.email().trim(), 'sso', this.injector);
      await this.router.navigate([
        `${AUTH_BASE}/${result.requiresTwoFactor ? 'two-factor' : 'signed-in'}`,
      ]);
    } catch {
      this.error.set('That hand-off did not complete. Please try again.');
    } finally {
      this.redirecting.set(false);
    }
  }
}
