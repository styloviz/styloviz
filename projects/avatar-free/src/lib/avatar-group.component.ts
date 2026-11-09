import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SvLabelPipe, injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { SvAvatarComponent, type AvatarColor, type AvatarShape, type AvatarSize, type AvatarStatus } from './avatar.component';
import { SV_AVATAR_LABELS } from './avatar-free.labels';

/** One person in an avatar group. */
export interface AvatarGroupMember {
  /** Stable key for the `@for` track; falls back to `name`. */
  readonly id?: string;
  /** Full name — the avatar's accessible name and its initials. */
  readonly name: string;
  readonly src?: string;
  readonly color?: AvatarColor;
  readonly status?: AvatarStatus;
}

/**
 * SvAvatarGroupComponent — a stack of avatars with a counted, named overflow.
 *
 * The docs used to tell hosts to "stack avatars to show a group", and every
 * host hand-built it with `-space-x-2`: no limit, no "+N", and no name for the
 * group, so a screen reader heard five disconnected names with no idea they
 * were one thing — or how many more there were.
 *
 * - `max` avatars are drawn; the rest collapse into a "+N" chip whose
 *   accessible name lists who they are ("3 more: Ada, Grace, Linus").
 * - The stack is a named list (`label`, else "Group of 8 people").
 * - `overflowAction` turns the chip into a button that emits `overflowClick`,
 *   for a host that opens the full list.
 */
@Component({
  selector: 'sv-avatar-group',
  standalone: true,
  imports: [SvAvatarComponent, SvLabelPipe],
  templateUrl: './avatar-group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAvatarGroupComponent {
  /** @internal Accessible names — English unless `provideSvLabels({ avatar })` says otherwise. */
  protected readonly labels = injectSvLabels('avatar', SV_AVATAR_LABELS);

  /** The people in the group, in display order. @default [] */
  readonly members = input<readonly AvatarGroupMember[]>([]);

  /**
   * The most avatars drawn before the rest collapse into "+N". Values below 1
   * count as 1. When exactly one would be hidden it is drawn instead — a "+1"
   * chip takes the same room as the avatar it hides.
   * @default 4
   */
  readonly max = input<number>(4);

  /** Avatar size. @default 'sm' */
  readonly size = input<AvatarSize>('sm');

  /** Avatar shape. @default 'circle' */
  readonly shape = input<AvatarShape>('circle');

  /** The group's accessible name, e.g. "Reviewers". Empty uses "Group of N people". @default '' */
  readonly label = input<string>('');

  /** Render the "+N" chip as a button that emits `overflowClick`. @default false */
  readonly overflowAction = input<boolean>(false);

  /** BCP 47 locale for the counts. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /** The "+N" chip was activated (only with `overflowAction`); payload is the hidden members. */
  readonly overflowClick = output<readonly AvatarGroupMember[]>();

  private readonly limit = computed(() => {
    const n = Math.max(1, Math.floor(this.max() || 1));
    return this.members().length === n + 1 ? n + 1 : n;
  });

  /** The avatars drawn. */
  readonly visible = computed(() => this.members().slice(0, this.limit()));

  /** The members behind "+N". */
  readonly hidden = computed(() => this.members().slice(this.limit()));

  /** The group's accessible name. */
  readonly groupName = computed(
    () => this.label() || svFormatLabel(this.labels.avatarGroup, { count: this.members().length }, this.locale()),
  );

  /** The chip's accessible name: the count and who. */
  readonly overflowName = computed(() => {
    const hidden = this.hidden();
    return svFormatLabel(
      this.labels.avatarGroupMore,
      { count: hidden.length, names: hidden.map((m) => m.name).join(', ') },
      this.locale(),
    );
  });

  /** The chip's tooltip: who is hidden, for a mouse user. */
  readonly overflowTitle = computed(() => this.hidden().map((m) => m.name).join(', '));

  /** The chip's box, matched to the avatar size so the stack lines up. */
  readonly chipClass = computed(() => {
    const box: Record<AvatarSize, string> = {
      xs: 'h-6 min-w-6 text-[10px]',
      sm: 'h-8 min-w-8 text-xs',
      md: 'h-10 min-w-10 text-sm',
      lg: 'h-12 min-w-12 text-sm',
      xl: 'h-16 min-w-16 text-base',
      '2xl': 'h-20 min-w-20 text-lg',
    };
    return `${box[this.size()]} ${this.roundClass()}`;
  });

  /** The corner radius that matches the avatars' `shape`, for the chip and the separating ring. */
  readonly roundClass = computed(() =>
    this.shape() === 'circle' ? 'rounded-full' : this.shape() === 'rounded' ? 'rounded-lg' : 'rounded-none',
  );

  memberKey(m: AvatarGroupMember): string {
    return m.id ?? m.name;
  }
}
