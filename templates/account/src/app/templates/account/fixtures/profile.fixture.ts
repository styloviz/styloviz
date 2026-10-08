/**
 * One notification preference.
 *
 * ★★ `enabled` IS THE EMAIL CHANNEL, and it keeps that name on purpose.
 *
 * It is the field a wired backend already sends, and renaming it to `email`
 * would break every consumer for a cosmetic gain. `push` and `inApp` are
 * optional so a payload from an older API renders as "email only" rather than
 * throwing — the matrix degrades, the page does not.
 */
export interface AccountNotifPref {
  readonly key: string;
  readonly label: string;
  readonly desc: string;
  /** Email — the channel every account has. */
  enabled: boolean;
  push?: boolean;
  inApp?: boolean;
}

/** Which column of the matrix a toggle belongs to. */
export type NotifChannel = 'enabled' | 'push' | 'inApp';

/** A device or browser currently holding a session. */
export interface AccountSession {
  readonly id: string;
  readonly device: string;
  readonly browser: string;
  readonly location: string;
  /** ISO timestamp of the last request on this session. */
  readonly lastActiveAt: string;
  /** The session this page is being viewed from — it cannot be revoked here. */
  readonly current?: boolean;
  /** `phone` renders the mobile glyph; anything else gets the browser one. */
  readonly kind: 'browser' | 'phone';
}

export interface AccountProfile {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly bio: string;
  readonly avatar: string;
  /** Optional extras — absent on an older payload, and simply not scored. */
  readonly jobTitle?: string;
  readonly location?: string;
  readonly timezone?: string;
}

/** The signed-in member's whole account — profile, security, notifications. */
export interface AccountSettings {
  readonly profile: AccountProfile;
  readonly twoFactorEnabled: boolean;
  readonly notifications: readonly AccountNotifPref[];
  /** Optional so a payload from an older API still renders. */
  readonly sessions?: readonly AccountSession[];
  /** How many single-use recovery codes remain unspent. */
  readonly recoveryCodesLeft?: number;
  readonly emailVerified?: boolean;
}

/** Bundled sample account, served until `ACCOUNT_API.baseUrl` is set. */
export const ACCOUNT_SETTINGS_FIXTURE: AccountSettings = {
  profile: {
    firstName: 'Sophie',
    lastName: 'Lang',
    email: 'sophie@acme.com',
    phone: '+1 415 555 0132',
    bio: 'Front-end lead focused on design systems and accessible UI.',
    avatar: '/demo/avatar-1.svg',
    jobTitle: 'Front-end Lead',
    location: 'San Francisco, CA',
    timezone: 'America/Los_Angeles',
  },
  twoFactorEnabled: true,
  emailVerified: true,
  recoveryCodesLeft: 8,
  notifications: [
    { key: 'mentions', label: 'Mentions', desc: 'When someone @mentions you in a comment.', enabled: true, push: true, inApp: true },
    { key: 'assigned', label: 'Task assignments', desc: 'When a task is assigned to you.', enabled: true, push: false, inApp: true },
    { key: 'comments', label: 'Replies', desc: 'When someone replies to a thread you are in.', enabled: false, push: false, inApp: true },
    { key: 'digest', label: 'Weekly digest', desc: 'A summary of your week, every Monday.', enabled: false, push: false, inApp: false },
    { key: 'product', label: 'Product updates', desc: 'News about features and improvements.', enabled: false, push: false, inApp: false },
    { key: 'security', label: 'Security alerts', desc: 'New sign-ins and password changes.', enabled: true, push: true, inApp: true },
  ],
  sessions: [
    { id: 's1', device: 'MacBook Pro', browser: 'Chrome 141', location: 'San Francisco, US', lastActiveAt: '2026-08-24T09:40:00.000Z', current: true, kind: 'browser' },
    { id: 's2', device: 'iPhone 17', browser: 'Safari', location: 'San Francisco, US', lastActiveAt: '2026-08-24T07:10:00.000Z', kind: 'phone' },
    { id: 's3', device: 'Windows 11', browser: 'Edge 140', location: 'Berlin, DE', lastActiveAt: '2026-08-21T16:22:00.000Z', kind: 'browser' },
  ],
};

/**
 * ★★★ WHAT "COMPLETE" MEANS, IN ONE PLACE.
 *
 * The meter, the checklist under it and the percentage all read this list. A
 * meter computed one way and a checklist written another is a page that says
 * "80% complete" above four ticked rows — and there is no way for the reader
 * to work out which half is lying.
 */
export interface ProfileCheck {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
}

export function profileChecks(account: AccountSettings | null): readonly ProfileCheck[] {
  const p = account?.profile;
  return [
    { id: 'name', label: 'Add your name', done: Boolean(p?.firstName?.trim() && p?.lastName?.trim()) },
    { id: 'avatar', label: 'Upload a photo', done: Boolean(p?.avatar?.trim()) },
    { id: 'title', label: 'Add a job title', done: Boolean(p?.jobTitle?.trim()) },
    { id: 'bio', label: 'Write a short bio', done: Boolean(p?.bio?.trim()) },
    { id: 'verified', label: 'Verify your email', done: account?.emailVerified === true },
    { id: '2fa', label: 'Turn on two-factor auth', done: account?.twoFactorEnabled === true },
  ];
}

/** 0–100. Rounded once, here, so every surface shows the same number. */
export function profileCompleteness(account: AccountSettings | null): number {
  const checks = profileChecks(account);
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
}

/**
 * "3 days ago" — for the sessions list.
 *
 * ★ Duplicated across templates on purpose: each one is packed and sold as a
 * self-contained folder, so a shared import is a relative path that does not
 * exist in the buyer's copy.
 */
export function formatRelative(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return 'Never';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'Active now';
  const steps: readonly (readonly [number, Intl.RelativeTimeFormatUnit])[] = [
    [31_536_000, 'year'], [2_592_000, 'month'], [604_800, 'week'],
    [86_400, 'day'], [3_600, 'hour'], [60, 'minute'],
  ];
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [size, unit] of steps) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return 'Active now';
}
