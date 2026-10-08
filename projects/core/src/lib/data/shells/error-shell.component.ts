import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { isRetryable } from '../errors';
import type { SvDataError } from '../types';

/**
 * ErrorShell — what a data component renders when the fetch failed.
 *
 * The gap this closes: before it, no component in the kit had any load-failure
 * state at all. A buyer wiring a real API had to build the error card, the
 * retry button and the announcement themselves, outside the component, where it
 * would not match anything else in the kit.
 *
 * Accessibility is the point of the component, not decoration. The block is a
 * live `role="alert"`, so the failure is announced rather than silently
 * replacing a spinner, and `focusRetry()` lets the host move focus to the one
 * control that can recover — important when the failure was triggered by a
 * keyboard action and focus is now on a button that no longer exists.
 *
 * Icons are projected rather than drawn: `@styloviz/core` ships no SVG, so the
 * host passes one from `@styloviz/icons` and the kit keeps a single icon source.
 *
 * ```html
 * <sv-error-shell [error]="error()" (retry)="load()">
 *   <sv-icon svShellIcon name="alert-triangle" cssClass="h-8 w-8" />
 * </sv-error-shell>
 * ```
 */
@Component({
  selector: 'sv-error-shell',
  standalone: true,
  templateUrl: './error-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Conditional, unlike the other two shells: this component renders nothing
  // when `error` is null, and a host element permanently advertising
  // `data-sv-state="error"` would make every component look broken to any
  // check that reads it.
  //
  // `data-sv-retryable` is published separately because "a 404 gets no Try
  // again" is a rule worth asserting, and the absence of a button is also what
  // a genuinely broken template looks like.
  host: {
    '[attr.data-sv-state]': "normalized() ? 'error' : null",
    '[attr.data-sv-retryable]': "normalized() ? (canRetry() ? 'true' : 'false') : null",
  },
})
export class SvErrorShellComponent {
  /**
   * The failure. A bare string is accepted for convenience and normalized to a
   * retryable error. `null` renders nothing.
   */
  readonly error = input<SvDataError | string | null>(null);

  /**
   * Heading above the message.
   * @default 'Something went wrong'
   */
  readonly title = input<string>('Something went wrong');

  /**
   * Label of the recovery button.
   * @default 'Try again'
   */
  readonly retryLabel = input<string>('Try again');

  /**
   * Show the retry button. Forced off for errors marked `retryable: false` —
   * offering to retry a 404 is a dead end dressed up as a recovery.
   * @default true
   */
  readonly retryable = input<boolean>(true);

  /**
   * Render as a single inline row instead of a centred block. Use inside a
   * table cell, a dropdown panel or a card header.
   * @default false
   */
  readonly compact = input<boolean>(false);

  /**
   * Status code shown beside the message, when the error carries one.
   * @default true
   */
  readonly showStatus = input<boolean>(true);

  /** Extra classes for the outer wrapper. @default '' */
  readonly customClass = input<string>('');

  /** The host should re-run the failed request. */
  readonly retry = output<void>();

  private readonly retryButton = viewChild<ElementRef<HTMLButtonElement>>('retryButton');

  /** Normalized error, or `null` when there is nothing to show. */
  protected readonly normalized = computed<SvDataError | null>(() => {
    const raw = this.error();
    if (!raw) return null;
    return typeof raw === 'string' ? { message: raw, retryable: true } : raw;
  });

  protected readonly message = computed(() => this.normalized()?.message ?? '');

  protected readonly status = computed(() => {
    const code = this.normalized()?.status;
    return this.showStatus() && typeof code === 'number' && code > 0 ? code : null;
  });

  protected readonly canRetry = computed(() => this.retryable() && isRetryable(this.normalized()));

  /**
   * Move focus to the retry button.
   *
   * Call this after the error appears in response to a keyboard action, so the
   * user is not left with focus on a control that has been replaced.
   */
  focusRetry(): void {
    this.retryButton()?.nativeElement.focus();
  }
}
