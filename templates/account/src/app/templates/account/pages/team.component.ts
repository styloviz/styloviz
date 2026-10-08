import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent } from '@styloviz/core';
import { svDataController } from '@styloviz/data';
import { SvButtonComponent } from '@styloviz/button';
import { SvBadgeComponent } from '@styloviz/badge';
import { SvAvatarComponent } from '@styloviz/avatar';
import { SvIconComponent } from '@styloviz/icons';
import { SvInputFieldComponent } from '@styloviz/input-field';
import { SvSegmentedControlComponent, type SegmentOption } from '@styloviz/forms';
import { SvModalComponent } from '@styloviz/modal';
import { accountDelete, accountPost, accountSource } from '../account.data';
import { TEAM_FIXTURE, type TeamMember } from '../fixtures/team.fixture';

/**
 * ★★ ROLE COLOUR IS A HIERARCHY, NOT A VERDICT.
 *
 * Owner was `primary` — which `sv-badge` renders as a literal blue, so the
 * highest-privilege role wore the one colour that had nothing to do with this
 * template's teal. Admin was `success`, which reads as "this is going well"
 * rather than "this account can manage people". Amber → sky → grey is a ramp
 * that says how much power the role carries, and nothing else.
 */
const ROLE_BADGE: Record<TeamMember['role'], 'info' | 'neutral' | 'warning'> = {
  Owner: 'warning',
  Admin: 'info',
  Member: 'neutral',
  Viewer: 'neutral',
};

/** What each role is allowed to do — shown beside the role, not in a doc. */
const ROLE_BLURB: Record<TeamMember['role'], string> = {
  Owner: 'Full control, including billing and deleting the account.',
  Admin: 'Manages people and settings, but not billing.',
  Member: 'Creates and edits content.',
  Viewer: 'Read-only access.',
};

type RoleFilter = TeamMember['role'] | 'all';

/** Roles an invite can grant. Ownership is handed over, never invited into. */
type InviteRole = Exclude<TeamMember['role'], 'Owner'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One line saying how the last action went. */
interface TeamNotice {
  readonly tone: 'success' | 'error';
  readonly text: string;
}

/**
 * AccountTeamComponent
 *
 * Who has access, and at what level — the "team" quarter of the packaging
 * job. Deliberately a flat member list rather than the admin template's
 * separate Roles/Permissions pages: this template ships standalone, so it
 * keeps the smallest UI that still answers "who's on this account and what
 * can they do."
 */
@Component({
  selector: 'sv-account-team',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SvSkeletonShellComponent,
    SvErrorShellComponent,
    SvEmptyShellComponent,
    SvButtonComponent,
    SvBadgeComponent,
    SvAvatarComponent,
    SvIconComponent,
    SvInputFieldComponent,
    SvSegmentedControlComponent,
    SvModalComponent,
  ],
  templateUrl: './team.component.html',
})
export class AccountTeamComponent {
  protected readonly data = svDataController<TeamMember>(
    accountSource('team', TEAM_FIXTURE),
    // The whole roster renders at once (no pagination UI on this page), so
    // ask for it all rather than a page — a page size here would silently
    // hide members past the first slice.
    { initialQuery: { pageSize: 500 } },
  );

  private readonly injector = inject(Injector);

  /**
   * ★ The loaded roster plus this visit's writes. The controller holds what the
   *   server sent; an invite that succeeded is appended and a removal is hidden
   *   straight away (and put back if the DELETE fails). Deduped by id, so the
   *   next reload — which carries the invite itself — does not list it twice.
   */
  private readonly added = signal<readonly TeamMember[]>([]);
  private readonly removed = signal<readonly string[]>([]);

  readonly members = computed<readonly TeamMember[]>(() => {
    const loaded = this.data.items();
    const gone = new Set(this.removed());
    const extra = this.added().filter((a) => !loaded.some((m) => m.id === a.id));
    return [...loaded, ...extra].filter((m) => !gone.has(m.id));
  });

  /** Row actions in flight, as `resend:<id>` / `remove:<id>`. */
  readonly pending = signal<readonly string[]>([]);
  readonly notice = signal<TeamNotice | null>(null);

  isPending(key: string): boolean {
    return this.pending().includes(key);
  }

  private setPending(key: string, on: boolean): void {
    this.pending.update((keys) => (on ? [...keys, key] : keys.filter((k) => k !== key)));
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  readonly query = signal('');
  readonly roleFilter = signal<RoleFilter>('all');

  readonly roleFilters: readonly { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'Everyone' },
    { id: 'Owner', label: 'Owners' },
    { id: 'Admin', label: 'Admins' },
    { id: 'Member', label: 'Members' },
    { id: 'Viewer', label: 'Viewers' },
  ];

  /**
   * ★★ THE SEARCH MATCHES NAME **AND** EMAIL. People look for a colleague by
   * whichever they have to hand — the name from a conversation, the address
   * from a ticket — and a box that searches only one comes back empty for
   * somebody plainly on the list.
   */
  readonly visible = computed<readonly TeamMember[]>(() => {
    const q = this.query().trim().toLowerCase();
    const role = this.roleFilter();
    return this.members().filter((m) => {
      if (role !== 'all' && m.role !== role) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  });

  readonly isFiltered = computed(() => this.query().trim() !== '' || this.roleFilter() !== 'all');

  /** Counted over the WHOLE roster, never the filtered set — see the stat-strip note in crud. */
  readonly stats = computed(() => {
    const all = this.members();
    return {
      total: all.length,
      active: all.filter((m) => m.status === 'active').length,
      invited: all.filter((m) => m.status === 'invited').length,
      admins: all.filter((m) => m.role === 'Owner' || m.role === 'Admin').length,
    };
  });

  clearFilters(): void {
    this.query.set('');
    this.roleFilter.set('all');
  }

  badgeVariant(role: TeamMember['role']): 'info' | 'neutral' | 'warning' {
    return ROLE_BADGE[role];
  }

  roleBlurb(role: TeamMember['role']): string {
    return ROLE_BLURB[role];
  }

  /**
   * ★★★ THE LAST OWNER CANNOT BE REMOVED.
   *
   * An account with no owner is one nobody can administer, and the removal
   * that produces it looks perfectly ordinary at the moment it is made. The
   * old page disabled Remove for *every* Owner, which is the neighbouring
   * mistake: with two owners, either one should be removable.
   */
  canRemove(member: TeamMember): boolean {
    if (member.role !== 'Owner') return true;
    return this.members().filter((m) => m.role === 'Owner').length > 1;
  }

  // ── Resend ────────────────────────────────────────────────────────────────

  protected async resendInvite(member: TeamMember): Promise<void> {
    const key = `resend:${member.id}`;
    if (this.isPending(key)) return;
    this.setPending(key, true);
    try {
      await accountPost(`team/${member.id}/resend`, {}, () => undefined, this.injector);
      this.notice.set({ tone: 'success', text: `Invite sent again to ${member.email}.` });
    } catch {
      this.notice.set({ tone: 'error', text: `Could not resend the invite to ${member.email}.` });
    } finally {
      this.setPending(key, false);
    }
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  /** The member the confirmation is asking about. */
  readonly removeTarget = signal<TeamMember | null>(null);
  readonly removeOpen = signal(false);

  protected askRemove(member: TeamMember): void {
    if (!this.canRemove(member)) return;
    this.removeTarget.set(member);
    this.removeOpen.set(true);
  }

  /**
   * ★ Confirmed first, then optimistic: the row goes the moment the member is
   *   sure, and comes back — with a message — if the server refuses.
   */
  protected async confirmRemove(): Promise<void> {
    const member = this.removeTarget();
    this.removeOpen.set(false);
    if (!member) return;
    const key = `remove:${member.id}`;
    this.setPending(key, true);
    this.removed.update((ids) => [...ids, member.id]);
    try {
      await accountDelete('team', member.id, this.injector);
      this.notice.set({ tone: 'success', text: `${member.name} no longer has access.` });
    } catch {
      this.removed.update((ids) => ids.filter((id) => id !== member.id));
      this.notice.set({ tone: 'error', text: `Could not remove ${member.name}. Nothing was changed.` });
    } finally {
      this.setPending(key, false);
    }
  }

  // ── Invite ────────────────────────────────────────────────────────────────

  readonly inviteOpen = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteRole = signal<InviteRole>('Member');
  readonly inviteSubmitted = signal(false);
  readonly inviteSaving = signal(false);
  readonly inviteError = signal('');

  readonly inviteRoles: readonly SegmentOption[] = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Member', label: 'Member' },
    { value: 'Viewer', label: 'Viewer' },
  ];

  /** Shown after the first attempt, like every other form in the kit. */
  readonly inviteEmailError = computed(() => {
    if (!this.inviteSubmitted()) return '';
    const email = this.inviteEmail().trim().toLowerCase();
    if (!email) return 'Enter an email address.';
    if (!EMAIL_RE.test(email)) return 'That does not look like an email address.';
    if (this.members().some((m) => m.email.toLowerCase() === email)) return 'They are already on this team.';
    return '';
  });

  readonly inviteRoleBlurb = computed(() => ROLE_BLURB[this.inviteRole()]);

  protected openInvite(): void {
    this.inviteEmail.set('');
    this.inviteRole.set('Member');
    this.inviteSubmitted.set(false);
    this.inviteError.set('');
    this.inviteOpen.set(true);
  }

  protected setInviteRole(value: string): void {
    if (value === 'Admin' || value === 'Member' || value === 'Viewer') this.inviteRole.set(value);
  }

  protected async sendInvite(): Promise<void> {
    this.inviteSubmitted.set(true);
    if (this.inviteEmailError() || this.inviteSaving()) return;
    const email = this.inviteEmail().trim();
    const role = this.inviteRole();
    this.inviteSaving.set(true);
    this.inviteError.set('');
    try {
      const member = await accountPost<TeamMember>(
        'team',
        { email, role },
        () => ({
          id: `u-${Date.now().toString(36)}`,
          name: email.split('@')[0],
          email,
          avatar: '',
          role,
          status: 'invited',
        }),
        this.injector,
      );
      this.added.update((list) => [...list, member]);
      this.inviteOpen.set(false);
      this.notice.set({ tone: 'success', text: `Invite sent to ${email}.` });
    } catch {
      // In the dialog, not behind it: the form is still open and can be fixed.
      this.inviteError.set('Could not send that invite. Please try again.');
    } finally {
      this.inviteSaving.set(false);
    }
  }
}
