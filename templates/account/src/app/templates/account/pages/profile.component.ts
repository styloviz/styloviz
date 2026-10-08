import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  linkedSignal,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { SvButtonComponent } from '@styloviz/button';
import { SvAvatarComponent } from '@styloviz/avatar';
import { SvTabsComponent, type TabItem } from '@styloviz/tabs';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvToggleSwitchComponent } from '@styloviz/toggle-switch';
import { SvBadgeComponent } from '@styloviz/badge';
import { SvIconComponent } from '@styloviz/icons';
import { SvPasswordStrengthComponent } from '@styloviz/password-strength';
import { SvEmptyShellComponent } from '@styloviz/core';
import { SvModalComponent } from '@styloviz/modal';
import { accountPost, accountRecord, accountUpdate } from '../account.data';
import { SvAccountAsyncComponent } from '../account-async.component';
import {
  ACCOUNT_SETTINGS_FIXTURE,
  formatRelative,
  profileChecks,
  profileCompleteness,
  type AccountNotifPref,
  type AccountProfile,
  type AccountSession,
  type AccountSettings,
  type NotifChannel,
  type ProfileCheck,
} from '../fixtures/profile.fixture';

type Tab = 'profile' | 'security' | 'notifications';

/** The editable half of the profile — what the form owns and nothing else. */
interface ProfileDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  location: string;
  bio: string;
}

const EMPTY_DRAFT: ProfileDraft = {
  firstName: '', lastName: '', email: '', phone: '', jobTitle: '', location: '', bio: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** What regenerating recovery codes answers with. */
interface RecoveryCodes {
  readonly codes: readonly string[];
}

/** Demo only: ten `xxxx-xxxx` codes. A real backend generates and stores its own. */
function demoRecoveryCodes(): RecoveryCodes {
  const part = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => (b % 36).toString(36)).join('');
  return { codes: Array.from({ length: 10 }, () => `${part()}-${part()}`) };
}

/** One column of the notification matrix. */
interface ChannelColumn {
  readonly key: NotifChannel;
  readonly label: string;
  readonly icon: string;
}

const CHANNELS: readonly ChannelColumn[] = [
  { key: 'enabled', label: 'Email', icon: 'mail' },
  { key: 'push', label: 'Push', icon: 'phone' },
  { key: 'inApp', label: 'In-app', icon: 'bell' },
];

/**
 * AccountProfileComponent
 *
 * Profile, security and notification preferences in one page, in tabs — this
 * is the "settings / account / profile" trio the release TODO found shipping
 * three times over (`admin/pages/settings`, `admin/pages/users/*`,
 * `store/pages/account/*`). Packaged here as its own standalone, drop-in
 * template rather than a fourth bespoke build.
 */
@Component({
  selector: 'sv-account-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SvAccountAsyncComponent,
    SvEmptyShellComponent,
    SvButtonComponent,
    SvBadgeComponent,
    SvTabsComponent,
    SvInputFieldComponent,
    SvToggleSwitchComponent,
    SvAvatarComponent,
    SvIconComponent,
    SvPasswordStrengthComponent,
    SvModalComponent,
  ],
  templateUrl: './profile.component.html',
})
export class AccountProfileComponent {
  readonly tabs: readonly { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: 'notifications', label: 'Notifications' },
  ];
  readonly tabItems: TabItem[] = this.tabs.map((t) => ({ id: t.key, label: t.label }));
  readonly tab = signal<Tab>('profile');
  setTab(id: string): void {
    this.tab.set(id as Tab);
  }

  private readonly injector = inject(Injector);
  private readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');

  // The whole page is one record the member edits in place — the toggles are
  // writes, not local state.
  protected readonly record = accountRecord<AccountSettings>('account/settings', ACCOUNT_SETTINGS_FIXTURE);
  readonly profile = computed<AccountProfile | null>(() => this.record.value()?.profile ?? null);
  readonly twoFactorEnabled = computed(() => this.record.value()?.twoFactorEnabled ?? false);
  readonly notifications = computed<readonly AccountNotifPref[]>(() => this.record.value()?.notifications ?? []);
  readonly sessions = computed<readonly AccountSession[]>(() => this.record.value()?.sessions ?? []);
  readonly recoveryCodesLeft = computed(() => this.record.value()?.recoveryCodesLeft ?? 0);
  readonly emailVerified = computed(() => this.record.value()?.emailVerified === true);

  readonly channels = CHANNELS;

  // ── Completeness ──────────────────────────────────────────────────────────

  /**
   * ★★ THE METER AND THE CHECKLIST READ ONE FUNCTION. A percentage computed
   * one way beside a list written another is a card that says "80% complete"
   * over four ticked rows, and no way for the reader to tell which is lying.
   */
  readonly checks = computed<readonly ProfileCheck[]>(() => profileChecks(this.record.value()));
  readonly completeness = computed<number>(() => profileCompleteness(this.record.value()));
  readonly nextStep = computed<ProfileCheck | null>(() => this.checks().find((c) => !c.done) ?? null);

  // ── The profile form ──────────────────────────────────────────────────────

  /**
   * ★★★ `linkedSignal` ON THE RECORD, not a copy taken in a lifecycle hook.
   *
   * The record reloads — after a save, after a retry, after a websocket push —
   * and a draft seeded once would still be showing the values from before.
   * Deriving from the source makes the reset automatic instead of a hook
   * somebody has to remember.
   */
  private readonly draft = linkedSignal<AccountProfile | null, ProfileDraft>({
    source: () => this.profile(),
    computation: (p) => (p ? {
      firstName: p.firstName ?? '', lastName: p.lastName ?? '', email: p.email ?? '',
      phone: p.phone ?? '', jobTitle: p.jobTitle ?? '', location: p.location ?? '',
      bio: p.bio ?? '',
    } : { ...EMPTY_DRAFT }),
  });

  readonly form = computed<ProfileDraft>(() => this.draft());

  private readonly pristine = computed<ProfileDraft>(() => {
    const p = this.profile();
    return p ? {
      firstName: p.firstName ?? '', lastName: p.lastName ?? '', email: p.email ?? '',
      phone: p.phone ?? '', jobTitle: p.jobTitle ?? '', location: p.location ?? '',
      bio: p.bio ?? '',
    } : { ...EMPTY_DRAFT };
  });

  /**
   * ★★ SAVE IS DISABLED UNTIL SOMETHING CHANGED. The old page had a Save
   * button wired to nothing at all — it looked identical whether or not it
   * would do anything, which is the worst of both.
   */
  readonly dirty = computed<boolean>(() => {
    const a = this.draft(), b = this.pristine();
    return (Object.keys(b) as (keyof ProfileDraft)[]).some((k) => a[k].trim() !== b[k].trim());
  });

  readonly nameError = computed(() => (this.draft().firstName.trim() ? '' : 'A first name is required.'));
  readonly emailError = computed(() => {
    const e = this.draft().email.trim();
    if (!e) return 'An email address is required.';
    return EMAIL_RE.test(e) ? '' : 'That does not look like an email address.';
  });
  readonly formValid = computed(() => !this.nameError() && !this.emailError());

  readonly savedAt = signal<number>(0);
  readonly showSaved = computed(() => this.savedAt() > 0);

  protected patch<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
    this.savedAt.set(0);
  }

  protected cancelEdits(): void {
    this.draft.set({ ...this.pristine() });
    this.savedAt.set(0);
  }

  /**
   * Save the profile.
   *
   * ★ Optimistic, through the same `commit` the toggles use — one write path
   * means one rollback path and one write-error banner, rather than a second
   * kind of failure the page handles differently.
   */
  protected async saveProfile(): Promise<void> {
    if (!this.dirty() || !this.formValid()) return;
    const next = this.draft();
    await this.record.commit(
      'profile',
      (account) => ({ ...account, profile: { ...account.profile, ...next } }),
      () => accountUpdate('account/profile', 'profile', { ...next }, this.injector),
    );
    // ★ `commit` resolves `void` whether it succeeded or rolled back, so the
    // only honest success signal is that it left no write error behind. Taking
    // the resolve itself as success shows "Saved" over a save that failed.
    if (!this.record.writeError()) this.savedAt.set(Date.now());
  }

  // ── Avatar ────────────────────────────────────────────────────────────────

  protected pickAvatar(): void {
    this.avatarInput()?.nativeElement.click();
  }

  /**
   * ★★ THE FILE IS NEVER READ. The template has no upload endpoint; it records
   * that a photo was chosen and shows it from an object URL. Swap this for
   * your upload call — see CUSTOMIZING.md.
   */
  protected onAvatarPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so picking the same file twice still fires `change`
    if (!file) return;
    const url = URL.createObjectURL(file);
    void this.record.commit(
      'avatar',
      (account) => ({ ...account, profile: { ...account.profile, avatar: url } }),
      () => accountUpdate('account/avatar', 'avatar', { name: file.name, size: file.size }, this.injector),
    );
  }

  protected removeAvatar(): void {
    void this.record.commit(
      'avatar',
      (account) => ({ ...account, profile: { ...account.profile, avatar: '' } }),
      () => accountUpdate('account/avatar', 'avatar', { avatar: null }, this.injector),
    );
  }

  // ── Security ──────────────────────────────────────────────────────────────

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');

  readonly passwordLongEnough = computed(() => this.newPassword().length >= MIN_PASSWORD);
  readonly passwordsMatch = computed(() => this.newPassword() === this.confirmPassword());
  readonly confirmError = computed(() =>
    this.confirmPassword().length > 0 && !this.passwordsMatch() ? 'Passwords do not match.' : '',
  );
  readonly canUpdatePassword = computed(
    () => this.currentPassword().length > 0 && this.passwordLongEnough() && this.passwordsMatch(),
  );
  readonly minPassword = MIN_PASSWORD;

  readonly passwordSaving = signal(false);
  readonly passwordStatus = signal<'idle' | 'saved' | 'failed'>('idle');

  /**
   * ★★ THE BUTTON USED TO HAVE NO HANDLER. It enabled itself once the three
   * fields agreed and then did nothing when pressed — the dead Save this page
   * was rebuilt to get rid of, one tab over. Not optimistic like the toggles:
   * there is nothing on screen to update, only an answer to wait for. The
   * fields clear on success so the password does not outlive the request.
   */
  protected async updatePassword(): Promise<void> {
    if (!this.canUpdatePassword() || this.passwordSaving()) return;
    this.passwordSaving.set(true);
    this.passwordStatus.set('idle');
    try {
      await accountUpdate(
        'account/password',
        'password',
        { currentPassword: this.currentPassword(), newPassword: this.newPassword() },
        this.injector,
      );
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.passwordStatus.set('saved');
    } catch {
      this.passwordStatus.set('failed');
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected toggleTwoFactor(): void {
    const next = !this.twoFactorEnabled();
    void this.record.commit(
      'twoFactor',
      (account) => ({ ...account, twoFactorEnabled: next }),
      () => accountUpdate('account/security', 'twoFactor', { enabled: next }, this.injector),
    );
  }

  // ── Recovery codes ────────────────────────────────────────────────────────

  readonly regenerateOpen = signal(false);
  readonly regenerating = signal(false);
  readonly regenerateError = signal('');
  /** The codes just issued — shown once, and gone when the page is left. */
  readonly newCodes = signal<readonly string[]>([]);

  /**
   * ★ Confirmed first: every code the member already saved stops working the
   *   moment new ones exist, and that is not obvious from the word
   *   "Regenerate".
   */
  protected async regenerateCodes(): Promise<void> {
    if (this.regenerating()) return;
    this.regenerateOpen.set(false);
    this.regenerating.set(true);
    this.regenerateError.set('');
    try {
      const { codes } = await accountPost<RecoveryCodes>(
        'account/recovery-codes',
        {},
        demoRecoveryCodes,
        this.injector,
      );
      this.newCodes.set(codes);
      this.record.value.update((account) =>
        account ? { ...account, recoveryCodesLeft: codes.length } : account,
      );
    } catch {
      this.regenerateError.set('Could not create new codes. Your existing codes still work.');
    } finally {
      this.regenerating.set(false);
    }
  }

  protected revokeSession(id: string): void {
    void this.record.commit(
      `session:${id}`,
      (account) => ({ ...account, sessions: (account.sessions ?? []).filter((s) => s.id !== id) }),
      () => accountUpdate('account/sessions', id, { revoked: true }, this.injector),
    );
  }

  /**
   * ★★★ SIGNING OUT EVERYWHERE KEEPS THE CURRENT SESSION.
   *
   * Revoking every session including this one signs the member out of the page
   * they are standing on, mid-task, with no warning — and the button that did
   * it looked like housekeeping. The current session is filtered out, and the
   * copy says so.
   */
  protected revokeOtherSessions(): void {
    void this.record.commit(
      'sessions',
      (account) => ({ ...account, sessions: (account.sessions ?? []).filter((s) => s.current) }),
      () => accountUpdate('account/sessions', 'all-others', { revoked: true }, this.injector),
    );
  }

  readonly otherSessionCount = computed(() => this.sessions().filter((s) => !s.current).length);

  protected sessionAge(session: AccountSession): string {
    return formatRelative(session.lastActiveAt);
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  isPending(key: string): boolean {
    return this.record.pending().includes(key);
  }

  protected channelOn(pref: AccountNotifPref, channel: NotifChannel): boolean {
    return pref[channel] === true;
  }

  /**
   * Flip one preference on one channel. Optimistic: the switch moves now and
   * moves back if the write is refused — a toggle that waits for the round
   * trip reads as broken and gets pressed twice, which is exactly the race
   * `pending` closes.
   */
  toggleChannel(key: string, channel: NotifChannel): void {
    const current = this.notifications().find((n) => n.key === key);
    if (!current) return;
    const next = current[channel] !== true;

    void this.record.commit(
      `${key}:${channel}`,
      (account) => ({
        ...account,
        notifications: account.notifications.map((n) => (n.key === key ? { ...n, [channel]: next } : n)),
      }),
      () => accountUpdate('account/notifications', key, { [channel]: next }, this.injector),
    );
  }

  /** Kept so an existing integration calling the old name still works. */
  toggleNotif(key: string): void {
    this.toggleChannel(key, 'enabled');
  }
}
