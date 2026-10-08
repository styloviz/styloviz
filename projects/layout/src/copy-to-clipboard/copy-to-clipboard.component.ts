import {
  Component,
  input,
  output,
  computed,
  signal,
  inject,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  injectSvSensitivePrivacy,
  svMaskTail,
  type SvSensitiveCopyEvent,
} from '@styloviz/core';
import { SV_CLIPBOARD, SvClipboardError, type SvClipboardFailureReason } from './clipboard.adapter';

/** Default for `copyTimeout`: a write still pending after this long is abandoned. */
export const SV_COPY_TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CopyVariant = 'inline' | 'block' | 'icon-only';
export type CopySize    = 'sm' | 'md' | 'lg';

/**
 * How a `sensitive` value's `label` is shown.
 * - `masked` — always masked; the value can be copied but not read on screen.
 * - `revealable` — masked, with a show/hide toggle (gated by `requireAuthorization`).
 * - `visible` — shown in full; only the copy warning and audit apply.
 */
export type CopySensitiveReveal = 'masked' | 'revealable' | 'visible';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvCopyToClipboardComponent — Displays text with a copy-to-clipboard button.
 *
 * Features:
 * - 3 variants: inline (text + icon), block (full row), icon-only
 * - 3 sizes
 * - Success feedback with auto-revert, only after the clipboard confirmed
 * - Clipboard API with `execCommand` fallback, behind the `SV_CLIPBOARD` adapter
 * - A busy state: a click while a copy is in flight is ignored (`aria-busy`)
 * - An opt-in sensitive-value mode (`sensitive`) on the kit-wide policy
 * - Accessible: aria-label toggles on copy state
 *
 * This component is **display-only**: it copies a value the host already holds
 * and never captures one. With `sensitive` on, the shown `label` is masked
 * (unless `sensitiveReveal="visible"`), a reveal is gated by
 * `requireAuthorization` / `revealAuthorized` / `(revealRequest)`, the success
 * announcement carries `sensitiveWarning`, and every copy is audited through
 * `copyAudited` — an `SvSensitiveCopyEvent` that never carries the value. An
 * app-wide `provideSvSensitivePrivacy()` re-masks it while the screen is shared.
 * ⚠️ Projected content is the host's own markup and is NOT masked — in
 * sensitive mode pass the display text through `label`, not `<ng-content>`.
 */
@Component({
  selector: 'sv-copy-to-clipboard',
  standalone: true,
  imports: [SvIconComponent, NgClass, NgTemplateOutlet],
  templateUrl: './copy-to-clipboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvCopyToClipboardComponent implements OnDestroy {
  private readonly clipboard = inject(SV_CLIPBOARD);
  readonly #sessionPrivacy = injectSvSensitivePrivacy();

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Text to copy to clipboard. */
  text = input<string>('');

  /** Label shown after successful copy. @default 'Copied!' */
  successLabel = input<string>('Copied!');

  /** Duration in ms before reverting to default state. @default 2000 */
  successDuration = input<number>(2000);

  /** Display variant. @default 'inline' */
  variant = input<CopyVariant>('inline');

  /** Component size. @default 'md' */
  size = input<CopySize>('md');

  /** Placeholder shown when no text content is provided via ng-content. */
  label = input<string>('');
  /**
   * Accessible name of the copy button — the only name `icon-only` has. Name
   * WHAT is copied ("Copy API key"), and localise it here. Never derived from
   * `label`, which may be the (sensitive) value itself.
   * @default 'Copy to clipboard'
   */
  ariaLabel = input<string>('Copy to clipboard');

  /**
   * Treat the value as a secret — an API key, a recovery code, a token.
   *
   * ★★★ A COPIED SECRET LEAVES NO TRACE AND GETS NO WARNING from a generic copy
   * button. On: the `label` is masked, the success announcement becomes
   * `sensitiveWarning`, and every copy emits `copyAudited`. Off by default —
   * the common use is a command or an id, and masking those would break them.
   * @default false
   */
  sensitive = input<boolean>(false);

  /** How a `sensitive` label is shown: `masked`, `revealable` (toggle) or `visible`. @default 'masked' */
  sensitiveReveal = input<CopySensitiveReveal>('masked');

  /** Which field was copied, for the audit event's `field`. @default 'value' */
  sensitiveField = input<string>('value');

  /** Announced (and shown in the block variant) after a sensitive copy. @default 'Copied. This value is secret — do not paste it anywhere shared.' */
  sensitiveWarning = input<string>('Copied. This value is secret — do not paste it anywhere shared.');

  /**
   * Whether revealing a `sensitiveReveal="revealable"` value needs the host's
   * authorization first. While on and `revealAuthorized` is off, the toggle
   * emits `revealRequest` instead of revealing — step up, then set
   * `revealAuthorized`.
   * @default true
   */
  requireAuthorization = input<boolean>(true);

  /** The host has re-authenticated the user; the reveal toggle may reveal. @default false */
  revealAuthorized = input<boolean>(false);

  /**
   * How long (ms) a clipboard write may stay pending before it is abandoned as
   * `failed` and `busy` clears. A write that never settles — a permission
   * prompt left open, a native bridge that never answers — would otherwise
   * leave the button busy forever. A late answer after the timeout is ignored.
   * An invalid value (`0`, negative, `NaN`, `Infinity`) uses the default.
   * @default 10000
   */
  copyTimeout = input<number>(SV_COPY_TIMEOUT_MS);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted after text is successfully copied. */
  copied = output<void>();

  /**
   * Emitted when copying fails (both the Clipboard API and the fallback), or
   * when the write did not settle within `copyTimeout`.
   *
   * The payload is an `SvClipboardError`: `reason` classifies it — `denied`,
   * `insecure-context`, `unavailable` or `failed` (also used for a timeout).
   * When both paths ran and failed, `cause` (and so `message`) is the
   * FALLBACK's error — the last one thrown — while `reason` is derived from the
   * Clipboard API's rejection. Typed `unknown` for compatibility; narrow with
   * `instanceof SvClipboardError`.
   */
  copyError = output<unknown>();

  /**
   * A `sensitive` value reached the clipboard. The event says who, which field
   * and when — never the value itself. Log it.
   */
  copyAudited = output<SvSensitiveCopyEvent>();

  /** The user asked to reveal while `requireAuthorization` was on and `revealAuthorized` off. */
  revealRequest = output<void>();

  // ── State ─────────────────────────────────────────────────────────────────

  readonly isCopied = signal(false);
  /** A copy is in flight; further clicks are ignored until it settles. */
  readonly busy = signal(false);
  /** Why the last copy failed, or `null`. Cleared by the next attempt. */
  readonly failureReason = signal<SvClipboardFailureReason | null>(null);
  /** Polite live-region message announced to assistive tech after a copy. */
  readonly srStatus = signal('');
  /** The user revealed a `revealable` sensitive label. */
  readonly shown = signal(false);
  private revertTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly buttonAriaLabel = computed(() =>
    this.isCopied() ? this.successLabel() : this.ariaLabel()
  );

  /** The session is declared shared/recorded: force the mask, hide the reveal. */
  readonly privacyActive = computed(() => this.sensitive() && this.#sessionPrivacy());

  /** Whether the shown label is masked right now. */
  readonly masked = computed(() => {
    if (!this.sensitive()) return false;
    if (this.privacyActive()) return true;
    const reveal = this.sensitiveReveal();
    if (reveal === 'visible') return false;
    return !(reveal === 'revealable' && this.shown());
  });

  /** Whether the reveal toggle renders. */
  readonly showRevealToggle = computed(() =>
    this.sensitive() && this.sensitiveReveal() === 'revealable' && !this.privacyActive() && this.variant() !== 'icon-only'
  );

  /**
   * The label as shown: masked when `masked()`. A value of fewer than 8
   * significant characters is masked completely; a longer one keeps at most
   * its last four — and never more than a quarter of them.
   *
   * ★ A fixed "last four" shows most of a short secret: a 6-digit recovery code
   *   `123-456` became `••3-456`, and a 4-character PIN was shown in full.
   */
  readonly displayLabel = computed(() => {
    const label = this.label();
    if (!this.masked()) return label;
    const significant = [...label].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
    const visible = significant < 8 ? 0 : Math.min(4, Math.floor(significant / 4));
    return svMaskTail(label, visible);
  });

  /** What the live region says after a failed copy — specific enough to act on. */
  readonly failureMessage = computed(() => {
    switch (this.failureReason()) {
      case 'denied': return 'Copy blocked by the browser. Select the text and copy it manually.';
      case 'insecure-context': return 'Copying needs a secure (HTTPS) page. Select the text and copy it manually.';
      case 'unavailable': return 'Clipboard unavailable. Select the text and copy it manually.';
      case 'failed': return 'Copy failed';
      default: return '';
    }
  });

  readonly iconSize = computed<string>(() => {
    const map: Record<CopySize, string> = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };
    return map[this.size()];
  });

  readonly textSize = computed<string>(() => {
    const map: Record<CopySize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
    return map[this.size()];
  });

  readonly buttonClass = computed<string>(() => {
    const base = 'inline-flex items-center justify-center shrink-0 rounded transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';
    const sizeMap: Record<CopySize, string> = {
      sm: 'h-6 w-6',
      md: 'h-7 w-7',
      lg: 'h-8 w-8',
    };
    const stateClass = this.isCopied()
      ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-400'
      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-300';
    const busyClass = this.busy() ? ' cursor-progress opacity-70' : '';
    return `${base} ${sizeMap[this.size()]} ${stateClass}${busyClass}`;
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Copy `text`. Ignored while a previous copy is still in flight (`busy`), so a
   * double-click writes once and announces once.
   */
  async copy(): Promise<void> {
    const textToCopy = this.text();
    if (!textToCopy || this.busy() || this.destroyed) return;

    this.busy.set(true);
    this.failureReason.set(null);
    // ★ A new attempt ends the previous success: otherwise a failure right after
    //   it kept the check icon and "Copied!" label, and the old revert timer
    //   then wiped the failure announcement.
    if (this.revertTimer) clearTimeout(this.revertTimer);
    this.revertTimer = null;
    this.isCopied.set(false);
    this.srStatus.set('');
    try {
      await this.withTimeout(this.clipboard.writeText(textToCopy));
    } catch (err) {
      // ★★ DESTROYED WHILE WAITING: the clipboard promise can outlive the
      //    component (a permission prompt, a route change). Nothing may be set,
      //    emitted or scheduled against a destroyed instance.
      if (this.destroyed) return;
      this.busy.set(false);
      // Both strategies failed — surface the error, don't fake success.
      const error = err instanceof SvClipboardError ? err : new SvClipboardError('failed', err);
      this.failureReason.set(error.reason);
      this.srStatus.set(this.failureMessage());
      this.copyError.emit(error);
      return;
    }
    if (this.destroyed) return;
    this.busy.set(false);

    this.isCopied.set(true);
    this.srStatus.set(this.sensitive() ? this.sensitiveWarning() : this.successLabel());
    this.copied.emit();
    if (this.sensitive()) {
      this.copyAudited.emit({ source: 'sv-copy-to-clipboard', field: this.sensitiveField(), redacted: false, at: Date.now() });
    }

    if (this.revertTimer) clearTimeout(this.revertTimer);
    this.revertTimer = setTimeout(() => {
      this.revertTimer = null;
      this.isCopied.set(false);
      this.srStatus.set('');
    }, this.successDuration());
  }

  /**
   * A pending write, abandoned as `failed` after `copyTimeout`. The timer is
   * always cleared, whichever side wins.
   */
  private withTimeout(write: Promise<void>): Promise<void> {
    // ★ An invalid timeout (0, negative, NaN, Infinity) falls back to the
    //   default instead of disabling it — otherwise a write that never settles
    //   leaves `busy` on for good.
    const raw = this.copyTimeout();
    const ms = raw > 0 && Number.isFinite(raw) ? raw : SV_COPY_TIMEOUT_MS;
    const timeout = new Promise<never>((_, reject) => {
      this.timeoutTimer = setTimeout(() => {
        this.timeoutTimer = null;
        reject(new SvClipboardError('failed', new Error(`Clipboard write timed out after ${ms} ms`)));
      }, ms);
    });
    return Promise.race([write, timeout]).finally(() => this.clearTimeoutTimer());
  }

  private clearTimeoutTimer(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = null;
  }

  /** Show or hide a `revealable` sensitive label, asking the host first when required. */
  toggleShown(): void {
    if (this.privacyActive()) return;
    if (!this.shown() && this.requireAuthorization() && !this.revealAuthorized()) {
      this.revealRequest.emit();
      return;
    }
    this.shown.update((v) => !v);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTimeoutTimer();
    if (this.revertTimer) clearTimeout(this.revertTimer);
    this.revertTimer = null;
  }
}
