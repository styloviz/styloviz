import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvOtpInputComponent } from '@styloviz/forms';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvIconComponent } from '@styloviz/icons';
import {
  AUTH_BASE,
  AUTH_OTP_LENGTH,
  AUTH_RESEND_COOLDOWN_SECONDS,
  AUTH_LOCKED_USER,
} from '../auth.config';
import { authResendCode, authVerifyCode, isAuthWired, maskEmail } from '../auth.data';

/**
 * AuthTwoFactorComponent
 *
 * The six digits between a correct password and a session — plus the way out
 * when the phone is not to hand.
 */
@Component({
  selector: 'sv-auth-two-factor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvOtpInputComponent,
    SvAlertBannerComponent,
    SvIconComponent,
  ],
  templateUrl: './two-factor.component.html',
})
export class AuthTwoFactorComponent {
  protected readonly base = AUTH_BASE;
  protected readonly length = AUTH_OTP_LENGTH;
  protected readonly isWired = isAuthWired();

  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  readonly code = signal('');
  readonly recoveryCode = signal('');
  /** Switched on by "Use a recovery code instead". */
  readonly useRecovery = signal(false);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly cooldown = signal(0);

  /** Where the code went. Masked, for the same reason the reset screen masks. */
  readonly maskedEmail = computed(() => maskEmail(AUTH_LOCKED_USER.email));

  readonly canSubmit = computed(() =>
    this.useRecovery()
      ? this.recoveryCode().trim().length >= 8
      : this.code().length === this.length,
  );

  /** `sv-otp-input` shows its own state; a wrong code turns every box red. */
  readonly otpStatus = computed<'idle' | 'error' | 'success'>(() =>
    this.error() ? 'error' : 'idle',
  );

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  /**
   * Fired by `sv-otp-input` when the last box is filled.
   *
   * ★ Auto-submitting on completion is the whole reason the component emits
   * this: the alternative is a person who has typed six digits reaching for a
   * button that has been the only remaining step for half a second.
   */
  onComplete(value: string): void {
    this.code.set(value);
    void this.verify();
  }

  /** Typing again after a rejection clears the rejection. */
  onCodeChange(value: string): void {
    this.code.set(value);
    if (this.error()) this.error.set('');
  }

  async verify(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const value = this.useRecovery() ? this.recoveryCode().trim() : this.code();
      await authVerifyCode(value, this.injector);
      await this.router.navigate([`${AUTH_BASE}/signed-in`]);
    } catch {
      this.error.set(
        this.useRecovery()
          ? 'That recovery code is not valid, or has already been used.'
          : 'That code is not right. Check the latest code and try again.',
      );
      // Clear the digits: leaving a rejected code in place invites a second
      // press of the same wrong answer.
      this.code.set('');
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * ★ The countdown starts before the request, so a second press is refused
   * while the first is still in flight; a failed send gives the button back.
   */
  async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.submitting()) return;
    this.error.set('');
    this.code.set('');
    this.startCooldown();
    try {
      await authResendCode(this.injector);
    } catch {
      this.stopTimer();
      this.cooldown.set(0);
      this.error.set('We could not send a new code. Please try again.');
    }
  }

  toggleRecovery(): void {
    this.useRecovery.update((v) => !v);
    this.error.set('');
    this.code.set('');
    this.recoveryCode.set('');
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown.set(AUTH_RESEND_COOLDOWN_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((n) => Math.max(0, n - 1));
      if (this.cooldown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
