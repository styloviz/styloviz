import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  evaluatePassword,
  type PasswordBreachStatus,
  type PasswordGuidance,
  type PasswordStrengthBand,
} from './password-strength';

export type PasswordStrengthSize = 'sm' | 'md';

/**
 * SvPasswordStrengthComponent — live password *guidance* that pairs alongside a
 * password field, not around it.
 *
 * ★ IT IS ADVICE, AND IT NEVER GATES SUBMISSION. There is no `disabled` output
 *   and no valid/invalid state here on purpose. A client-side heuristic cannot
 *   know how hard a password is to guess, so blocking on it rejects good
 *   passwords (a long passphrase with no symbols) while waving through bad ones
 *   (`Password1!`). Enforce your policy — minimum length, and a server-side
 *   breach check — in the form and on the server; use this to help someone do
 *   better before they get there.
 *
 * ```html
 * <sv-input-field label="Password" type="password" [(value)]="password" />
 * <sv-password-strength [value]="password()" [breach]="breach()" />
 * ```
 */
@Component({
  selector: 'sv-password-strength',
  standalone: true,
  imports: [NgClass],
  templateUrl: './password-strength.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPasswordStrengthComponent {
  /** The password to advise on — bind it to the same signal driving your text input. */
  value = input<string>('');

  /**
   * Your own minimum length, which the advice is measured against.
   *
   * Defaults to 12 rather than 8: length is the lever that actually matters, and
   * a component that calls eight characters "enough" is teaching the wrong thing.
   * @default 12
   */
  minLength = input<number>(12);

  /**
   * What your breach check knows. An input, never a network call from here — the
   * component has no business choosing your provider, sending a hash of a
   * password to a third party, or firing a request per keystroke.
   *
   * `unavailable` exists so an outage can be reported as an outage. Whatever the
   * status, nothing here blocks anything.
   * @default 'unknown'
   */
  breach = input<PasswordBreachStatus>('unknown');

  /** Show the improvement-suggestion list below the meter. @default true */
  showSuggestions = input<boolean>(true);

  /** Density preset. @default 'md' */
  size = input<PasswordStrengthSize>('md');

  /** Accessible group label, also used to open the announcement. */
  label = input<string>('Password strength');

  /**
   * Quiet period before an announcement, in milliseconds.
   *
   * ★ The reason this exists: the visible label used to be the live region, so
   *   every keystroke interrupted a screen-reader user mid-word and read the
   *   band again. Announcements now wait for typing to stop and only fire when
   *   the band actually changed. Set 0 in tests.
   * @default 700
   */
  announceDelay = input<number>(700);

  /**
   * The guidance changed. Renamed from `scoreChange`: it emits advice, and
   * calling it a score invited hosts to threshold on it.
   */
  readonly guidanceChange = output<PasswordGuidance>();

  protected readonly segmentIndexes = [0, 1, 2, 3] as const;

  readonly guidance = computed<PasswordGuidance>(() =>
    evaluatePassword(this.value(), { minLength: this.minLength(), breach: this.breach() }),
  );

  /** Bars filled: 0 while empty, otherwise at least 1 so the weakest band still reads as a signal. */
  protected readonly filledSegments = computed(() =>
    this.value() ? Math.max(1, this.guidance().band) : 0,
  );

  protected readonly displayLabel = computed(() =>
    this.value() ? this.guidance().label : 'No password entered',
  );

  /** What the polite live region currently holds. Empty until there is something new to say. */
  private readonly _announcement = signal('');
  protected readonly announcement = this._announcement.asReadonly();

  // ── Breach notice ─────────────────────────────────────────────────────────

  /** One sentence about the host's breach check, or '' when it is not running one. */
  protected readonly breachNotice = computed<string>(() => {
    switch (this.breach()) {
      case 'checking': return 'Checking this against known breaches…';
      case 'safe': return 'Not found in the breach list we checked.';
      case 'breached': return 'This password has appeared in a data breach. Choose a different one.';
      case 'unavailable': return 'We could not check this against known breaches right now.';
      default: return '';
    }
  });

  /** Tone of the breach notice. `unavailable` is a notice, not a rejection. */
  protected readonly breachClass = computed<string>(() => {
    switch (this.breach()) {
      case 'breached':
        return 'bg-danger-50 text-danger-800 ring-danger-200 dark:bg-danger-950/40 dark:text-danger-200 dark:ring-danger-900';
      case 'safe':
        return 'bg-accent-50 text-accent-800 ring-accent-200 dark:bg-accent-950/40 dark:text-accent-200 dark:ring-accent-900';
      case 'unavailable':
        return 'bg-warning-50 text-warning-800 ring-warning-200 dark:bg-warning-950/40 dark:text-warning-200 dark:ring-warning-900';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10';
    }
  });

  // ── Segment / label colours ───────────────────────────────────────────────

  private static readonly SEGMENT_COLORS: readonly string[] = [
    'bg-danger-500',
    'bg-orange-500',
    'bg-warning-500',
    'bg-accent-500',
  ];

  private static readonly LABEL_COLORS: readonly string[] = [
    'text-danger-600 dark:text-danger-400',
    'text-orange-600 dark:text-orange-400',
    'text-warning-700 dark:text-warning-400',
    'text-accent-700 dark:text-accent-400',
    'text-accent-700 dark:text-accent-400',
  ];

  protected segmentClass(index: number): string {
    if (index >= this.filledSegments()) return 'bg-gray-200 dark:bg-gray-700';
    const colorIndex = Math.max(0, this.guidance().band - 1);
    return SvPasswordStrengthComponent.SEGMENT_COLORS[colorIndex];
  }

  protected readonly labelColorClass = computed(
    () => SvPasswordStrengthComponent.LABEL_COLORS[this.guidance().band],
  );

  constructor() {
    // afterRenderEffect, not effect(): it runs in the browser only, so the
    // announcement timer cannot hold up server-side rendering.
    let emittedBand: PasswordStrengthBand | null = null;
    let emittedFromBreach = false;
    // Band AND breach status: a breach finding for an unchanged password is news
    // even though the band did not move (a heuristic "Very weak" and a confirmed
    // breach are both band 0).
    let announcedKey: string | null = null;

    afterRenderEffect((onCleanup) => {
      const current = this.guidance();
      if (emittedBand === null || current.band !== emittedBand || current.fromBreachCheck !== emittedFromBreach) {
        emittedBand = current.band;
        emittedFromBreach = current.fromBreachCheck;
        this.guidanceChange.emit(current);
      }

      const delay = this.announceDelay();
      const opener = this.label();
      const breach = this.breach();
      const notice = this.breachNotice();

      // Nothing typed yet is not news. Clearing the region also resets the
      // band, so the first real band announces once the field is filled again.
      if (!this.value()) {
        announcedKey = null;
        this._announcement.set('');
        return;
      }
      const key = `${current.band}|${breach}`;
      if (key === announcedKey) return;

      const timer = setTimeout(() => {
        announcedKey = key;
        // The breach notice is spoken with the band: it is shown on screen, and a
        // screen-reader user who is told only "Very weak" never learns why.
        this._announcement.set(notice ? `${opener}: ${current.label}. ${notice}` : `${opener}: ${current.label}.`);
      }, delay);
      // Cleanup runs before the next pass, so a keystroke cancels the pending
      // announcement — that IS the quiet period.
      onCleanup(() => clearTimeout(timer));
    });
  }
}
