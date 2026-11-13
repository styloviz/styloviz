import {
  Component,
  input,
  model,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { prefersReducedMotion, svUniqueId } from '@styloviz/core/a11y';
import { createOptimisticEdit, svRequestKey, toSvDataError, type SvDataError } from '@styloviz/core/data';
import { injectSvLabels, svFormatCount, svLocale, SvLabelPipe } from '@styloviz/core/i18n';
import { SV_FORMS_LABELS } from '@styloviz/forms/labels';
import { SvIconComponent } from '@styloviz/icons/core';

import { registerLikeIcons } from './like.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

export type LikeVariant = 'heart' | 'thumbs-up' | 'star' | 'clap';
export type LikeSize    = 'sm' | 'md' | 'lg';

/**
 * One toggle of the reaction, with everything the write needs.
 *
 * The payload used to be a bare `boolean`, which said what the user wanted and
 * nothing about how to do it safely: no way to undo a rejected like except a
 * `ViewChild` call, and no key to make a retry idempotent.
 */
export interface LikeToggleEvent {
  /** The state the user asked for. */
  readonly liked: boolean;
  /** The count as shown right now, with this toggle already applied. */
  readonly count: number;
  /**
   * Client-generated key for this toggle, stable across retries of it.
   *
   * Send it with the write and have the server ignore a key it has already
   * applied. Without one, a flaky connection retried by an interceptor turns
   * one like into two, and a double-tap turns into like-unlike-like against a
   * server that may apply them in any order.
   */
  readonly requestKey: string;
  /**
   * Put the button back the way it was — the icon and the count together.
   *
   * Refused, with a dev-mode warning, once the user has toggled again: the
   * value it is holding predates that toggle, so writing it back would silently
   * revert what they just did. Bind `pending` so that cannot arise.
   */
  readonly rollback: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvLikeComponent — Reaction button with animated count and burst effect.
 *
 * Features:
 * - 4 icon variants: heart, thumbs-up, star, clap
 * - Burst particle animation on toggle, suppressed under reduced motion
 * - Optimistic local state, with a guarded rollback for a write that fails
 * - Pending and failed states, and a defined answer for a signed-out user
 * - 3 sizes
 * - Accessible: aria-pressed + aria-label + aria-busy, and the failure is named
 */
@Component({
  selector: 'sv-like',
  standalone: true,
  imports: [SvIconComponent, NgClass, SvLabelPipe],
  templateUrl: './like.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvLikeComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerLikeIcons();

  protected readonly labels = injectSvLabels('forms', SV_FORMS_LABELS);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * The reaction count (two-way).
   *
   * A `model`, because the count is the thing the toggle changes: it moves the
   * instant the button is clicked, and the host's next value — the number the
   * server actually recorded — wins over whatever was shown optimistically.
   * @default 0
   */
  readonly count = model<number>(0);

  /**
   * Whether the current user has reacted (two-way: `[(liked)]`).
   *
   * Bind it two-way, not one-way. The button flips the state itself, and being
   * a `model` is what pushes that back into your signal, so the two never drift
   * and a later correction is always a real change. With a one-way `[liked]`, a
   * host undoing a rejected like by re-asserting `[liked]="false"` changes
   * nothing — Angular skips a binding whose expression has not changed — and
   * the like stays on screen.
   * @default false
   */
  readonly liked = model<boolean>(false);

  /** Icon variant. @default 'heart' */
  readonly variant = input<LikeVariant>('heart');

  /** Size. @default 'md' */
  readonly size = input<LikeSize>('md');

  /** Show the count next to the icon. @default true */
  readonly showCount = input<boolean>(true);

  /**
   * How the visible count is written: `'compact'` — "1.2K", "12K", "1.2M" in
   * the locale's own compact form — or `'standard'` — "1,234". The accessible
   * name always carries the FULL number, grouped for the locale, so "1.2K"
   * never reaches a screen reader as the count. Under 1,000 both read the same.
   * @default 'compact'
   */
  readonly countNotation = input<'compact' | 'standard'>('compact');

  /** BCP 47 locale for the count. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  /** Disabled state. @default false */
  readonly disabled = input<boolean>(false);

  /**
   * True while the toggle is being written.
   *
   * The button stops responding, which is what keeps `rollback()` unambiguous —
   * and it is also the answer to a double-tap producing two requests.
   * @default false
   */
  readonly pending = input<boolean>(false);

  /**
   * The last write failed.
   *
   * Rendered as a danger ring, a triangle glyph and the message as visible text
   * under the button — tied to it with `aria-describedby` — so the state is not
   * conveyed by colour alone. Roll the value back as well — this input
   * reports the failure, it does not undo it.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /**
   * Whether the viewer is signed in. When false the button does not toggle;
   * it emits `authRequired` so the host can prompt for sign-in.
   *
   * A reaction control shown to a signed-out user had no defined behaviour: it
   * toggled, looked saved, and the write it reported could not succeed.
   * @default true
   */
  readonly signedIn = input<boolean>(true);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** The user toggled the reaction. */
  readonly likeChange = output<LikeToggleEvent>();

  /** A signed-out viewer tried to react. */
  readonly authRequired = output<void>();

  // ── State ─────────────────────────────────────────────────────────────────

  readonly isBursting = signal(false);

  /** Per-instance id prefix, so two buttons on one page never share an id. */
  private readonly uid = svUniqueId('sv-like');

  /** Id of the visible failure text, referenced by the button's `aria-describedby`. */
  readonly errorId = `${this.uid}-error`;

  /** Monotonic toggle counter guarding stale `rollback()` handles. */
  private _toggleSeq = 0;

  private readonly _edit = createOptimisticEdit({
    revision: () => this._toggleSeq,
    selector: 'sv-like',
    superseded:
      'the reaction has been toggled again since. Writing the old value back would ' + // sv-i18n-ignore: developer message
      'revert that. Bind [pending] so it cannot be toggled while the write is in flight.', // sv-i18n-ignore: developer message
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  /** The failure message, normalized from either accepted shape. */
  readonly errorMessage = computed<string>(() => {
    const error = this.error();
    if (!error) return '';
    return toSvDataError(error).message;
  });

  /** Nothing responds while a write is in flight, or when told not to. */
  readonly isInert = computed<boolean>(() => this.disabled() || this.pending());

  /** Stable action verb per variant (state is conveyed by aria-pressed). */
  readonly reactionVerb = computed<string>(() => {
    const map: Record<LikeVariant, string> = {
      heart:       'Like',
      'thumbs-up': 'Like',
      star:        'Star',
      clap:        'Applaud',
    };
    return map[this.variant()];
  });

  /**
   * Accessible name — stable verb, the live count when shown, and "not saved"
   * when the last write failed.
   *
   * The failure is in the NAME rather than only in a ring, because a red border
   * is not available to a screen reader and "colour alone" is not a state. The
   * message itself is the button's DESCRIPTION (`aria-describedby` → the visible
   * text), so it is read once rather than twice.
   */
  readonly ariaLabel = computed<string>(() => {
    const parts = [this.reactionVerb()];
    if (this.showCount()) parts.push(svFormatCount(this.count(), this.locale()) || String(this.count()));
    if (this.errorMessage()) parts.push(this.labels.likeNotSavedState);
    return parts.join(', ');
  });

  /** The count as drawn — compact or standard, per `countNotation`, in `locale`. */
  readonly displayCount = computed<string>(() => {
    const n = this.count();
    if (this.countNotation() === 'standard') return svFormatCount(n, this.locale()) || String(n);
    try {
      return new Intl.NumberFormat(this.locale() || undefined, { notation: 'compact' }).format(n);
    } catch {
      return String(n);
    }
  });

  readonly buttonSize = computed<string>(() => {
    const map: Record<LikeSize, string> = {
      sm: 'gap-1 px-2.5 py-1 text-xs rounded-lg',
      md: 'gap-1.5 px-3 py-1.5 text-sm rounded-xl',
      lg: 'gap-2 px-4 py-2 text-base rounded-2xl',
    };
    return map[this.size()];
  });

  readonly iconSize = computed<string>(() => {
    const map: Record<LikeSize, string> = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };
    return map[this.size()];
  });

  /**
   * Library icon name for the variant.
   *
   * This used to be a `RATING_PATH`-style map of raw `<path d="…">` strings —
   * four hand-copied Heroicons living in a reaction button. One of them was
   * silently WRONG: the `clap` entry was a bell, and had been since the
   * variant shipped. A name resolves against the registry, so `check:icons`
   * catches a typo the eye does not.
   */
  readonly iconName = computed<string>(() => {
    const map: Record<LikeVariant, string> = {
      'heart': 'heart',
      'thumbs-up': 'thumbs-up',
      'star': 'star',
      'clap': 'clap',
    };
    return map[this.variant()];
  });

  /**
   * Liked-state chrome, per variant.
   *
   * ★★ FOUR VARIANTS MEAN FOUR CONVENTIONS, NOT ONE HUE FOUR TIMES.
   *    A single rose served all of them, so a **starred** item rendered a red
   *    star where every product that has ever shipped a star renders gold. The
   *    hue is the reaction's identity — a red thumb reads as a downvote and a
   *    red star as a warning — so it belongs to the variant, not to the
   *    component.
   *
   * ★ Deliberately literal, and the one place in the token sweep where a state
   *   colour opts out. `danger`/`info`/`warning`/`brand` would hand these to a
   *   buyer's semantic palette, and a buyer who picks blue for errors would get
   *   a blue heart. `scripts/theme-literal.allow.json` records that as
   *   categorical, alongside the burst particles.
   *
   * Every arm is a tint plus dark ink (`-50`/`-700`), never a solid fill: white
   * on `amber-500` is ~2:1, which is what makes gold unusable as a background
   * here and readable as one.
   */
  readonly likedClass = computed<string>(() => {
    const map: Record<LikeVariant, string> = {
      heart:
        'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-400 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-900/40',
      'thumbs-up':
        'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 focus-visible:ring-sky-400 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-400 dark:hover:bg-sky-900/40',
      star:
        'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400 dark:hover:bg-amber-900/40',
      clap:
        'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 focus-visible:ring-violet-400 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-400 dark:hover:bg-violet-900/40',
    };
    return map[this.variant()];
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Toggle the reaction, applying it immediately.
   *
   * A reaction that waits for a round trip feels broken, so the icon and the
   * count move first and the host is told after — which leaves the host owing a
   * way back when the write fails, and `rollback()` in the payload is it.
   *
   * ```ts
   * onLike(e: LikeToggleEvent) {
   *   this.saving.set(true);                       // bind to [pending]
   *   this.api.react(this.id, e.liked, e.requestKey).subscribe({
   *     next:  () => this.saving.set(false),
   *     error: (err) => { e.rollback(); this.failure.set(err); this.saving.set(false); },
   *   });
   * }
   * ```
   */
  toggle(): void {
    if (this.isInert()) return;
    if (!this.signedIn()) {
      this.authRequired.emit();
      return;
    }

    const wasLiked = this.liked();
    const wasCount = this.count();
    const liked = !wasLiked;

    this.liked.set(liked);
    // Clamped, because a host can seed a count of 0 with `liked` already true —
    // an unlike would otherwise render "-1" reactions.
    this.count.set(liked ? wasCount + 1 : Math.max(0, wasCount - 1));
    if (liked) this.burst();

    this._toggleSeq++;
    this.likeChange.emit({
      liked,
      count: this.count(),
      requestKey: svRequestKey('like'),
      rollback: this._edit.begin(() => {
        this.liked.set(wasLiked);
        this.count.set(wasCount);
        this.isBursting.set(false);
      }),
    });
  }

  /** The running burst's end. One at a time: a second like restarts it. */
  private _burstTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this._clearBurst());
  }

  private _clearBurst(): void {
    if (this._burstTimer !== null) clearTimeout(this._burstTimer);
    this._burstTimer = null;
  }

  private burst(): void {
    // ★ Under reduced motion the burst is not rendered at all, rather than
    //   rendered and frozen — the template's `motion-reduce:hidden` covers a
    //   preference that changes mid-burst.
    if (prefersReducedMotion()) return;
    // ★ The previous timer is cleared first: a quick unlike → like used to let
    //   the FIRST burst's timer end the second one early.
    this._clearBurst();
    this.isBursting.set(true);
    this._burstTimer = setTimeout(() => {
      this._burstTimer = null;
      this.isBursting.set(false);
    }, 600);
  }
}
