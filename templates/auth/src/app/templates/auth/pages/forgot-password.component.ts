import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SvButtonComponent } from '@styloviz/button';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvAlertBannerComponent } from '@styloviz/alert-banner';
import { SvIconComponent } from '@styloviz/icons';
import { AUTH_RESEND_COOLDOWN_SECONDS, AUTH_SUPPORT, AUTH_BASE } from '../auth.config';
import { authRequestReset, isAuthWired, maskEmail } from '../auth.data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A webmail provider we can deep-link to from the confirmation screen. */
interface MailProvider {
  readonly host: string;
  readonly label: string;
  readonly href: string;
}

/**
 * ★ Only the providers whose inbox has a stable URL. A "check your email"
 * screen that guesses wrong sends somebody to a login page for an account they
 * do not have, which is worse than not offering the shortcut at all.
 */
const MAIL_PROVIDERS: readonly MailProvider[] = [
  { host: 'gmail.com', label: 'Open Gmail', href: 'https://mail.google.com' },
  { host: 'googlemail.com', label: 'Open Gmail', href: 'https://mail.google.com' },
  { host: 'outlook.com', label: 'Open Outlook', href: 'https://outlook.live.com/mail' },
  { host: 'hotmail.com', label: 'Open Outlook', href: 'https://outlook.live.com/mail' },
  { host: 'live.com', label: 'Open Outlook', href: 'https://outlook.live.com/mail' },
  { host: 'yahoo.com', label: 'Open Yahoo Mail', href: 'https://mail.yahoo.com' },
  { host: 'proton.me', label: 'Open Proton Mail', href: 'https://mail.proton.me' },
  { host: 'protonmail.com', label: 'Open Proton Mail', href: 'https://mail.proton.me' },
  { host: 'icloud.com', label: 'Open iCloud Mail', href: 'https://www.icloud.com/mail' },
];

/**
 * AuthForgotPasswordComponent
 *
 * Ask for an email, request a reset link, and say so — without revealing
 * whether the address has an account (see `auth.data.ts`).
 */
@Component({
  selector: 'sv-auth-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    SvButtonComponent,
    SvInputFieldComponent,
    SvAlertBannerComponent,
    SvIconComponent,
  ],
  templateUrl: './forgot-password.component.html',
})
export class AuthForgotPasswordComponent {
  /** Where this template is mounted — see `AUTH_BASE` in the config. */
  protected readonly base = AUTH_BASE;

  private readonly injector = inject(Injector);

  readonly email = signal('');
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  /** Seconds left before Resend is allowed again. 0 = allowed. */
  readonly cooldown = signal(0);

  readonly support = AUTH_SUPPORT;
  readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));

  /**
   * ★★ THE CONFIRMATION SHOWS A MASKED ADDRESS. This screen renders whatever
   * was typed into it, so echoing the address in full is both a disclosure on
   * a shared screen and a free text-injection surface for a crafted link.
   */
  readonly maskedEmail = computed(() => maskEmail(this.email()));

  /** The webmail shortcut for this address, when we are confident of the URL. */
  readonly mailProvider = computed<MailProvider | null>(() => {
    const at = this.email().trim().toLowerCase().lastIndexOf('@');
    if (at < 0) return null;
    const host = this.email().trim().toLowerCase().slice(at + 1);
    return MAIL_PROVIDERS.find((p) => p.host === host) ?? null;
  });

  /**
   * The token for the demo-only continuation link into the second page — there
   * is no real inbox here to click through from. A live backend emails the real
   * link instead; this affordance disappears the moment `AUTH_API.baseUrl` is
   * set (see the template in `forgot-password.component.html`).
   */
  readonly demoResetToken = computed(() => `demo-${this.email().trim()}`);

  /**
   * The demo link as one URL — what the template's `sv-button [href]` renders.
   * The app's link adapter parses the string, so the query survives an in-app
   * navigation; the token is encoded here because nothing downstream does it.
   */
  readonly demoResetLink = computed(
    () => `${AUTH_BASE}/reset-password?token=${encodeURIComponent(this.demoResetToken())}`,
  );

  readonly isWired = isAuthWired();

  /**
   * ★★ THE TIMER IS STARTED FROM A CLICK, NEVER FROM A LIFECYCLE HOOK.
   *
   * Lifecycle hooks run during a prerender, where there is no `setInterval` and
   * no user to count down for. Event handlers do not run on a server — nothing
   * clicks there — so this is the one place the interval can safely live.
   */
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Not `ngOnDestroy`: the guard means the server, which never starts a
    // timer, never reaches `clearInterval` either.
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  async send(): Promise<void> {
    if (!this.emailValid() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      await authRequestReset(this.email().trim(), this.injector);
      this.sent.set(true);
      this.startCooldown();
    } catch {
      this.error.set('Something went wrong sending that link. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Send it again.
   *
   * ★ Refused while the cooldown runs. Four presses produce four links of which
   * only the newest works, and the person who clicks the oldest one gets an
   * "expired link" page they have no way to explain.
   */
  async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.submitting()) return;
    await this.send();
  }

  reset(): void {
    this.sent.set(false);
    this.error.set('');
    this.stopTimer();
    this.cooldown.set(0);
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
