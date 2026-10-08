import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvCheckboxComponent } from '@styloviz/forms';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvPasswordStrengthComponent } from '@styloviz/password-strength';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_BASE, AUTH_PASSWORD_POLICY } from '../auth.config';
import { authRegister, passwordRules, passwordMeetsPolicy, maskEmail } from '../auth.data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * AuthRegisterComponent
 *
 * ★★★ THE CHECKLIST AND THE BUTTON READ THE SAME FUNCTION — `passwordRules`
 * from `auth.data.ts`, exactly as reset-password does. That is the reason the
 * policy lives in config rather than being restated per page: two pages that
 * each own their own regex is two pages that eventually disagree, and the
 * person who meets the disagreement is staring at a disabled button while
 * every line of the checklist shows a tick.
 */
@Component({
  selector: 'sv-auth-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvCheckboxComponent,
    SvAlertBannerComponent,
    SvPasswordStrengthComponent,
    SvIconComponent,
  ],
  templateUrl: './register.component.html',
})
export class AuthRegisterComponent {
  protected readonly base = AUTH_BASE;
  protected readonly policy = AUTH_PASSWORD_POLICY;

  private readonly injector = inject(Injector);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly accepted = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly created = signal(false);
  readonly error = signal('');

  readonly maskedEmail = computed(() => maskEmail(this.email()));
  readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));

  /** The whole policy, met and unmet alike — see `passwordRules`. */
  readonly rules = computed(() => passwordRules(this.password(), this.policy));
  readonly passwordOk = computed(() => passwordMeetsPolicy(this.password(), this.policy));

  readonly nameError = computed(() =>
    this.submitted() && !this.name().trim() ? 'Tell us what to call you.' : '',
  );

  readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.email().trim()) return 'Enter your email address.';
    return this.emailValid() ? '' : 'That does not look like an email address.';
  });

  /**
   * ★ The field says only that the password is short of the policy; WHICH rule
   * is unmet is the checklist's job. Repeating it in the error turns one
   * problem into two places to read.
   */
  readonly passwordError = computed(() => {
    if (!this.submitted() || this.passwordOk()) return '';
    return this.password() ? 'That password does not meet the rules below.' : 'Choose a password.';
  });

  readonly termsError = computed(() =>
    this.submitted() && !this.accepted() ? 'Please accept the terms to continue.' : '',
  );

  readonly canSubmit = computed(
    () => !!this.name().trim() && this.emailValid() && this.passwordOk() && this.accepted(),
  );

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.canSubmit() || this.submitting()) return;

    this.submitting.set(true);
    this.error.set('');
    try {
      await authRegister(
        { name: this.name().trim(), email: this.email().trim(), password: this.password() },
        this.injector,
      );
      this.created.set(true);
      // The password does not outlive the request that used it.
      this.password.set('');
    } catch {
      this.error.set('Something went wrong creating that account. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
