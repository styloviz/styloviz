import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvIconComponent } from '@styloviz/icons';
import { SvPasswordStrengthComponent } from '@styloviz/password-strength';
import { AUTH_PASSWORD_POLICY, AUTH_SUPPORT, AUTH_BASE } from '../auth.config';
import {
  authConfirmReset,
  passwordMeetsPolicy,
  passwordRules,
  type PasswordRule,
} from '../auth.data';

/**
 * AuthResetPasswordComponent
 *
 * The page a reset-link email points at. Reads `?token=` from the URL:
 * missing/blank means the link was mistyped or already used, and the page
 * says so instead of rendering a form with nothing to submit against.
 */
@Component({
  selector: 'sv-auth-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvAlertBannerComponent,
    SvIconComponent,
    SvPasswordStrengthComponent,
  ],
  templateUrl: './reset-password.component.html',
})
export class AuthResetPasswordComponent {
  /** Where this template is mounted — see `AUTH_BASE` in the config. */
  protected readonly base = AUTH_BASE;

  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly token = computed(() => this.queryParams().get('token') ?? '');
  readonly hasToken = computed(() => this.token().trim().length > 0);

  readonly password = signal('');
  readonly confirm = signal('');
  readonly submitting = signal(false);
  readonly done = signal(false);
  readonly error = signal('');

  /** True while the browser reports Caps Lock on, from a key event. */
  readonly capsLock = signal(false);

  readonly support = AUTH_SUPPORT;
  readonly policy = AUTH_PASSWORD_POLICY;

  /**
   * ★★★ THE CHECKLIST AND THE SUBMIT BUTTON READ ONE FUNCTION.
   *
   * `passwordRules()` returns every rule with its met/unmet flag, and
   * `passwordValid` is "all of them". Written as a regex here and a list of
   * `<li>`s in the template, the two drift — and the person who meets the drift
   * is looking at a disabled button above a checklist of green ticks, with no
   * way to work out which one is lying.
   */
  readonly rules = computed<readonly PasswordRule[]>(() => passwordRules(this.password()));

  readonly passwordValid = computed(() => passwordMeetsPolicy(this.password()));
  readonly matches = computed(() => this.password() === this.confirm());

  /** Shown only once there is something to compare — an empty box is not a mismatch. */
  readonly confirmError = computed(() =>
    this.confirm().length > 0 && !this.matches() ? 'Passwords do not match.' : '',
  );

  readonly canSubmit = computed(() => this.passwordValid() && this.matches() && !this.submitting());

  /**
   * ★★ CAPS LOCK IS THE MOST COMMON CAUSE OF A PASSWORD THAT "DOES NOT WORK",
   * and the one thing a masked field guarantees you cannot see. `getModifierState`
   * is read from a keyboard event — never in a lifecycle hook, because there is
   * no keyboard on a server.
   */
  protected onPasswordKey(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      await authConfirmReset(this.token(), this.password(), this.injector);
      this.done.set(true);
    } catch {
      this.error.set('That link has expired or was already used. Request a new one.');
    } finally {
      this.submitting.set(false);
    }
  }
}
