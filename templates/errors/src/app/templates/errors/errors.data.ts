import { HttpClient } from '@angular/common/http';
import { inject, Injector, runInInjectionContext } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ERRORS_API, ERRORS_BRAND, ERRORS_STATUS_URL } from './errors.config';

function endpoint(path: string): string {
  const base = ERRORS_API.baseUrl.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

/**
 * Subscribe an email to be notified (maintenance is over / launch is live).
 *
 * The only "data" this template has — everything else is static copy — so
 * it gets the same live-API switch as every other template, on
 * `ERRORS_API.baseUrl`, rather than being a dead button.
 */
export async function notifySubscribe(email: string, injector?: Injector): Promise<void> {
  if (!ERRORS_API.baseUrl) {
    await new Promise((r) => setTimeout(r, ERRORS_API.demoLatencyMs));
    return;
  }
  const post = () => inject(HttpClient).post(endpoint('notify'), { email });
  await firstValueFrom(injector ? runInInjectionContext(injector, post) : post());
}

// ═══════════════════════════════════════════════════════════════════════════
//  The error catalogue
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ★★★ EVERY ERROR PAGE IS AN ENTRY IN THIS TABLE, NOT A COMPONENT.
 *
 * The template shipped five near-identical components, and the sixth error
 * anybody needed meant a sixth copy of the same markup — which is how a kit
 * ends up with a 403 that words its actions differently from its 401 and a 502
 * nobody remembered to give a retry button. One presenter renders whatever it
 * is handed; adding a type is adding a row here.
 */

/** How severe this is, which decides the colour and nothing else. */
export type ErrorTone = 'neutral' | 'info' | 'warning' | 'danger';

/** The buttons an error page offers. `id` is handled by the presenter. */
export type ErrorActionId = 'home' | 'back' | 'retry' | 'signin' | 'support' | 'status';

export interface ErrorAction {
  readonly id: ErrorActionId;
  readonly label: string;
  readonly style: 'primary' | 'secondary' | 'ghost';
}

export type ErrorKey =
  | '400' | '401' | '403' | '404' | '408' | '410' | '429'
  | '500' | '502' | '503' | '504'
  | 'offline' | 'maintenance' | 'coming-soon';

export interface ErrorDefinition {
  readonly key: ErrorKey;
  /** The big numeral. Empty for the pages that are not HTTP statuses. */
  readonly code: string;
  /** Short name beside the code — "Not found", "Rate limited". */
  readonly label: string;
  readonly title: string;
  readonly message: string;
  /** Icon-library name. FREE registry only — this template ships free. */
  readonly icon: string;
  readonly tone: ErrorTone;
  /**
   * What the visitor can actually do, in order of likelihood.
   *
   * ★★ THE MOST VALUABLE PART OF AN ERROR PAGE. "Something went wrong" tells
   * somebody they already knew something went wrong; "your session expired,
   * sign in again" ends the visit successfully.
   */
  readonly tips: readonly string[];
  readonly actions: readonly ErrorAction[];
  /**
   * Show a support reference. 5xx only — a reference for a 404 is noise, and
   * it teaches people to quote a number that means nothing to your support team.
   */
  readonly showReference?: boolean;
  /** Show the search box and the suggested destinations. 404/410 only. */
  readonly showSearch?: boolean;
  /** Seconds to count down before retrying by itself. */
  readonly autoRetrySeconds?: number;
  /** Offer the status page — for the failures that might not be just them. */
  readonly showStatus?: boolean;
  /** Show the notify-me capture. */
  readonly showNotify?: boolean;
  /** What the notify form says once it has succeeded. */
  readonly notifyDone?: string;
  /** Watch `navigator.onLine` and recover by itself when it returns. */
  readonly watchConnection?: boolean;
}

/**
 * ★★ EXACTLY ONE PRIMARY PER PAGE.
 *
 * Two solid buttons side by side is two things claiming to be the obvious next
 * step, which is the same as none — the visitor reads both, picks neither, and
 * the page has spent its one chance to end the visit well. `HOME` is the
 * primary when going home IS the answer; `HOME_ALT` is the same action wearing
 * a quieter style beside a retry or a sign-in. A spec asserts the rule.
 */
const GO_HOME: ErrorAction = { id: 'home', label: 'Go home', style: 'primary' };
const GO_HOME_ALT: ErrorAction = { id: 'home', label: 'Go home', style: 'secondary' };
const GO_BACK: ErrorAction = { id: 'back', label: 'Go back', style: 'ghost' };
const GO_BACK_PRIMARY: ErrorAction = { id: 'back', label: 'Go back', style: 'primary' };
const TRY_AGAIN: ErrorAction = { id: 'retry', label: 'Try again', style: 'primary' };

export const ERROR_CATALOGUE: Record<ErrorKey, ErrorDefinition> = {
  '400': {
    key: '400', code: '400', label: 'Bad request', tone: 'warning', icon: 'alert-circle',
    title: 'That request could not be read',
    message: 'Something in the address or the data sent with it was malformed, so the server stopped before doing anything.',
    tips: [
      'Check the address for a stray character or a truncated copy-paste.',
      'If you followed a link from somewhere else, the link itself may be broken.',
    ],
    actions: [GO_BACK, GO_HOME],
  },

  '401': {
    key: '401', code: '401', label: 'Not signed in', tone: 'warning', icon: 'log-out',
    title: 'Your session has ended',
    message: 'You are signed out — either the session expired, or it was ended from another device.',
    tips: [
      'Sign in again to pick up where you left off.',
      'If you did not sign yourself out everywhere, change your password.',
    ],
    actions: [{ id: 'signin', label: 'Sign in', style: 'primary' }, GO_HOME_ALT],
  },

  '403': {
    key: '403', code: '403', label: 'Forbidden', tone: 'warning', icon: 'lock',
    title: 'You do not have access to this',
    // ★ It says "your account cannot", not "this does not exist". Pretending a
    // page is missing to hide it is a 404, and a deliberate choice — but a 403
    // that lies leaves the person with no idea who to ask.
    message: 'Your account is signed in, but it does not have permission to view this page.',
    tips: [
      'Ask a workspace admin to grant you access.',
      'If you have more than one account, you may be signed in as the wrong one.',
    ],
    actions: [GO_BACK_PRIMARY, { id: 'support', label: 'Request access', style: 'secondary' }],
  },

  '404': {
    key: '404', code: '404', label: 'Not found', tone: 'neutral', icon: 'search',
    title: 'Page not found',
    message: "The page you're looking for doesn't exist or may have moved.",
    tips: [
      'Check the address for a typo.',
      'The page may have been renamed or removed.',
    ],
    actions: [GO_HOME, GO_BACK],
    showSearch: true,
  },

  '408': {
    key: '408', code: '408', label: 'Timed out', tone: 'warning', icon: 'clock',
    title: 'That took too long',
    message: 'The request timed out before the server finished. Nothing was saved.',
    tips: [
      'Try again — timeouts are usually momentary.',
      'On a slow or metered connection, a smaller request may get through.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT],
    autoRetrySeconds: 15,
  },

  '410': {
    key: '410', code: '410', label: 'Gone', tone: 'neutral', icon: 'trash',
    title: 'This page is gone for good',
    // ★ 410 is not 404. "Gone" is a promise that looking again will not help,
    // which is the one thing that stops somebody retrying the same dead link.
    message: 'This page was removed deliberately and is not coming back. This is not a mistake, and refreshing will not help.',
    tips: [
      'If something replaced it, search will find the replacement.',
      'Update any bookmark or link that brought you here.',
    ],
    actions: [GO_HOME, GO_BACK],
    showSearch: true,
  },

  '429': {
    key: '429', code: '429', label: 'Rate limited', tone: 'warning', icon: 'bolt',
    title: 'Too many requests',
    message: 'You have made a lot of requests in a short time, so we have paused them briefly. Nothing is broken and nothing was lost.',
    tips: [
      'Wait for the countdown, then try once more.',
      'If a script or integration is calling on your behalf, slow its retry rate.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT],
    autoRetrySeconds: 30,
  },

  '500': {
    key: '500', code: '500', label: 'Server error', tone: 'danger', icon: 'alert-triangle',
    title: 'Something went wrong',
    message: 'An unexpected error occurred on our end. It has been logged, and reloading often clears it.',
    tips: [
      'Try again — many 500s are transient.',
      'If it keeps happening, send us the reference below.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT, { id: 'support', label: 'Report it', style: 'ghost' }],
    showReference: true,
    showStatus: true,
  },

  '502': {
    key: '502', code: '502', label: 'Bad gateway', tone: 'danger', icon: 'database',
    title: 'We got a bad response upstream',
    message: 'A service this page depends on answered with something we could not use. This is on our side, not yours.',
    tips: [
      'Try again in a moment — upstream blips are usually short.',
      'Check the status page to see whether it is a known incident.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT],
    showReference: true,
    showStatus: true,
    autoRetrySeconds: 20,
  },

  '503': {
    key: '503', code: '503', label: 'Unavailable', tone: 'warning', icon: 'pause',
    title: 'Service temporarily unavailable',
    message: "We're experiencing heavy load or a short deploy window. This usually clears up within a few minutes.",
    tips: [
      'Nothing you did caused this, and nothing you saved was lost.',
      'The status page has the live picture.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT],
    showStatus: true,
    autoRetrySeconds: 30,
  },

  '504': {
    key: '504', code: '504', label: 'Gateway timeout', tone: 'warning', icon: 'clock',
    title: 'The server took too long to answer',
    message: 'A service behind this page did not respond in time. Your request may or may not have completed.',
    // ★ It says "may or may not have completed", because that is the truth of a
    // 504 — and telling somebody to blindly retry a payment is how they pay twice.
    tips: [
      'Before retrying anything that charges or sends, check whether it went through.',
      'For everything else, try again in a minute.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT],
    showReference: true,
    showStatus: true,
  },

  offline: {
    key: 'offline', code: '', label: 'Offline', tone: 'warning', icon: 'x-circle',
    title: "You're offline",
    message: 'We cannot reach the network from this device. Everything unsaved is still here in the browser.',
    tips: [
      'Check Wi-Fi, or a cable, or whether flight mode is on.',
      'This page will notice by itself the moment you are back.',
    ],
    actions: [TRY_AGAIN, GO_HOME_ALT],
    watchConnection: true,
  },

  maintenance: {
    key: 'maintenance', code: '', label: 'Maintenance', tone: 'info', icon: 'settings',
    title: 'Down for scheduled maintenance',
    message: "We're making some improvements. We'll be back shortly — thanks for your patience.",
    tips: [
      'Nothing is lost; work saved before now is safe.',
      'Leave your email below and we will tell you the moment we are back.',
    ],
    actions: [{ id: 'status', label: 'Live status', style: 'primary' }],
    showNotify: true,
    notifyDone: "We'll email you the moment we're back.",
    showStatus: true,
  },

  'coming-soon': {
    key: 'coming-soon', code: '', label: 'Coming soon', tone: 'info', icon: 'rocket',
    title: 'Something new is coming',
    message: "We're putting the finishing touches on this. Leave your email and we'll let you know the moment it's live.",
    tips: [],
    actions: [GO_HOME],
    showNotify: true,
    notifyDone: "You're on the list — we'll email you at launch.",
  },
};

/** The status-page URL, re-exported so a page needs one import, not two. */
export const errorsStatusUrl = ERRORS_STATUS_URL;

/**
 * A "mention this to support" reference.
 *
 * ★★★ IN A REAL APP THIS COMES FROM THE SERVER — it is the id in your error
 * tracker, and it is only worth showing because somebody can look it up. A
 * value minted in the browser correlates with nothing; this one exists so the
 * demo shows the shape, and `CUSTOMIZING.md` says to replace it.
 *
 * ★ Generated on demand from a browser-only path, never in a field
 * initialiser: a value that differs between the server render and the client
 * hydration is a mismatch, and a random one differs every single time.
 */
export function newReferenceId(now: number, seed: number): string {
  const stamp = now.toString(36).toUpperCase().slice(-6);
  const tail = (seed % 46_656).toString(36).toUpperCase().padStart(3, '0');
  return `ERR-${stamp}-${tail}`;
}

/** The mailto a "Report it" button opens, pre-filled with the reference. */
export function supportMailto(reference: string, key: ErrorKey): string {
  const subject = `[${key}] Error report${reference ? ` — ${reference}` : ''}`;
  const body = [
    'What I was doing:',
    '',
    '',
    '— — —',
    `Error: ${key}`,
    reference ? `Reference: ${reference}` : '',
  ].filter(Boolean).join('\n');
  return `mailto:${ERRORS_BRAND.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
