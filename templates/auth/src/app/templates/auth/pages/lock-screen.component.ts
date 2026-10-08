import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_BASE, AUTH_LOCKED_USER } from '../auth.config';
import { authUnlock, isAuthWired } from '../auth.data';

/**
 * AuthLockScreenComponent
 *
 * ★★ A LOCK SCREEN KNOWS WHO IT LOCKED. Asking for an email again would make
 * it a sign-in page wearing the wrong title — the affordance is "it is still
 * you, just prove it", and that is communicated by naming the person before
 * asking for anything. The way out to a different account is present, but
 * secondary.
 */
@Component({
  selector: 'sv-auth-lock-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvAlertBannerComponent,
    SvIconComponent,
  ],
  templateUrl: './lock-screen.component.html',
})
export class AuthLockScreenComponent {
  protected readonly base = AUTH_BASE;
  protected readonly user = AUTH_LOCKED_USER;
  protected readonly isWired = isAuthWired();

  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  readonly password = signal('');
  readonly submitting = signal(false);
  readonly error = signal('');
  /** Consecutive failures, so the copy can escalate rather than just repeat. */
  readonly attempts = signal(0);

  readonly canSubmit = computed(() => this.password().length > 0);

  /**
   * ★ After three failures the screen stops repeating itself and offers the
   * reset flow. A form that says "wrong password" five times in identical
   * words is a form that has stopped helping.
   */
  readonly showResetHint = computed(() => this.attempts() >= 3);

  async unlock(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      await authUnlock(this.password(), this.injector);
      this.attempts.set(0);
      await this.router.navigate([`${AUTH_BASE}/signed-in`]);
    } catch {
      this.attempts.update((n) => n + 1);
      this.error.set('That password is not right.');
      this.password.set('');
    } finally {
      this.submitting.set(false);
    }
  }
}
