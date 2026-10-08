import { HttpClient } from '@angular/common/http';
import { inject, Injector, runInInjectionContext } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_API,
  AUTH_PASSWORD_POLICY,
  AUTH_SSO_DOMAINS,
  type PasswordPolicy,
} from './auth.config';

/**
 * ============================================================
 *  Auth Template — the one place data comes from
 * ============================================================
 *  Two requests, one switch. Leave `AUTH_API.baseUrl` empty and both resolve
 *  from an artificial delay so the pages are fully click-through-able with no
 *  backend; point it at your API and they POST there instead. See
 *  `CUSTOMIZING.md`.
 * ============================================================
 */

function endpoint(path: string): string {
  const base = AUTH_API.baseUrl.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

/** Whether a real backend is configured. */
export function isAuthWired(): boolean {
  return AUTH_API.baseUrl !== '';
}

/**
 * Request a password-reset email.
 *
 * Deliberately does not reveal whether the address exists — the response is
 * identical either way, which is what the server should also do: an
 * enumerable "no account with that email" is how account lists leak.
 */
export async function authRequestReset(email: string, injector?: Injector): Promise<void> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('auth/forgot-password'), { email });
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

/**
 * Submit a new password against a reset token.
 *
 * Resolves with nothing on success; a real backend should reject an
 * expired/consumed token with a 4xx, which the page turns into the "invalid
 * or expired link" state.
 */
export async function authConfirmReset(
  token: string,
  password: string,
  injector?: Injector,
): Promise<void> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('auth/reset-password'), { token, password });
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

// ─── Password rules ──────────────────────────────────────────────────────────

/** One rule, and whether the current draft satisfies it. */
export interface PasswordRule {
  readonly id: string;
  readonly label: string;
  readonly met: boolean;
}

/**
 * The policy, evaluated against a password.
 *
 * ★★★ THE CHECKLIST AND THE SUBMIT BUTTON READ THE SAME FUNCTION.
 *
 * This is the whole reason it is a function over a policy object rather than a
 * regex in the component and a list of `<li>`s in the template. Written twice,
 * they drift — and the person who meets the drift is staring at a disabled
 * button while every line of the checklist shows a green tick. There is no way
 * to debug that from the outside, and no way for it to happen from here.
 *
 * ★ It returns the WHOLE list, met and unmet alike, so the UI can show what is
 * still outstanding rather than only what has been achieved. A checklist that
 * only renders satisfied rules teaches nothing about what is left.
 */
export function passwordRules(
  password: string,
  policy: PasswordPolicy = AUTH_PASSWORD_POLICY,
): readonly PasswordRule[] {
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: `At least ${policy.minLength} characters`,
      met: password.length >= policy.minLength,
    },
  ];
  if (policy.requireLetter) {
    rules.push({ id: 'letter', label: 'Contains a letter', met: /[a-z]/i.test(password) });
  }
  if (policy.requireNumber) {
    rules.push({ id: 'number', label: 'Contains a number', met: /\d/.test(password) });
  }
  if (policy.requireSymbol) {
    rules.push({
      id: 'symbol',
      label: 'Contains a symbol',
      met: /[^\w\s]/.test(password),
    });
  }
  return rules;
}

/** `true` when every rule in the policy is satisfied. */
export function passwordMeetsPolicy(
  password: string,
  policy: PasswordPolicy = AUTH_PASSWORD_POLICY,
): boolean {
  return passwordRules(password, policy).every((r) => r.met);
}

/**
 * "sophie@acme.com" → "so••••@acme.com".
 *
 * ★★ THE CONFIRMATION SHOWS A MASKED ADDRESS, NOT THE ONE THAT WAS TYPED.
 *
 * It looks like a nicety and is not. This screen is reachable by typing any
 * address at all, so echoing it back in full turns the page into a free
 * "render arbitrary text" surface for anyone sending a link to it — and on a
 * shared or shoulder-surfed screen it discloses the whole address of an
 * account somebody was only guessing at. Enough characters to recognise your
 * own address, not enough to learn someone else's.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return trimmed;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}${'\u2022'.repeat(Math.max(2, local.length - keep))}${domain}`;
}

// ─── Sign in, register, verify, unlock ───────────────────────────────────────

/** What a sign-in attempt resolved to. */
export interface AuthSignInResult {
  /** True when the account has a second factor and the code screen is next. */
  readonly requiresTwoFactor: boolean;
}

/**
 * Sign in with a password.
 *
 * ★★ THE DEMO REJECTS ONE SPECIFIC PASSWORD rather than accepting everything.
 * A mock that always succeeds means the failure path — the one with the error
 * copy, the one a buyer most wants to see — is unreachable without editing
 * code. `wrong` is the documented way to reach it.
 *
 * ★ A real backend must answer identically for "no such user" and "wrong
 * password". Distinguishing them turns the sign-in form into an account
 * enumerator, the same leak `authRequestReset` avoids.
 *
 * `remember` is the "Keep me signed in" box — sent so the server can choose a
 * persistent session over one that ends with the browser.
 */
export async function authSignIn(
  email: string,
  password: string,
  injector?: Injector,
  remember = false,
): Promise<AuthSignInResult> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    if (password === 'wrong') throw new Error('invalid-credentials');
    // Any address at an SSO-enrolled domain is treated as having 2FA on, so
    // the code screen is reachable in the demo without a special account.
    const domain = email.trim().toLowerCase().split('@')[1] ?? '';
    return { requiresTwoFactor: domain in AUTH_SSO_DOMAINS };
  }
  const post = () =>
    inject(HttpClient).post<AuthSignInResult>(endpoint('auth/sign-in'), { email, password, remember });
  return firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

/** A new account, as the register form collects it. */
export interface AuthRegistration {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/** Create an account. Resolves on success; a 4xx becomes the form's error. */
export async function authRegister(
  draft: AuthRegistration,
  injector?: Injector,
): Promise<void> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('auth/register'), draft);
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

/**
 * Check a verification code.
 *
 * ★ The demo rejects `000000` so the "that code is not right" state is
 * reachable. A real backend should also rate-limit: six digits is a million
 * guesses, which is nothing to a script.
 */
export async function authVerifyCode(code: string, injector?: Injector): Promise<void> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    if (code === '000000') throw new Error('invalid-code');
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('auth/verify'), { code });
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

/**
 * Send a fresh verification code.
 *
 * ★ The "Send a new code" button used to only start its countdown — wired to a
 * backend, it promised a code that nothing had asked the server for.
 */
export async function authResendCode(injector?: Injector): Promise<void> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('auth/verify/resend'), {});
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

/** Unlock a locked session. Same demo rule as sign-in: `wrong` fails. */
export async function authUnlock(password: string, injector?: Injector): Promise<void> {
  if (!AUTH_API.baseUrl) {
    await new Promise((r) => setTimeout(r, AUTH_API.demoLatencyMs));
    if (password === 'wrong') throw new Error('invalid-credentials');
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('auth/unlock'), { password });
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

/**
 * Which organisation, if any, owns this email domain for SSO.
 *
 * Returns the organisation name, or `null` when the domain is not enrolled —
 * which the enterprise screen turns into "we could not find an SSO
 * configuration for that domain" rather than a dead end.
 */
export function ssoOrganisationFor(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 0) return null;
  return AUTH_SSO_DOMAINS[email.trim().toLowerCase().slice(at + 1)] ?? null;
}
