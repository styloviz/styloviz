import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { injectSvLabels, svFormatLabel, svLocale } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_AI_LABELS, type SvAiLabels } from '@styloviz/ai/labels';

import { registerMessageActionsIcons } from './message-actions.component.icons';
/** A built-in action `sv-message-actions` can render. */
export type SvMessageAction = 'copy' | 'like' | 'dislike' | 'regenerate';

/** The reader's verdict on a message: thumbs up, thumbs down, or none. */
export type SvMessageFeedback = 'up' | 'down' | null;

/** Where the copy button is in its round trip to the clipboard. */
export type SvMessageCopyState = 'idle' | 'copied' | 'failed';

/**
 * `sv-message-actions` — the row of actions under a chat message: copy,
 * thumbs up / down and regenerate.
 *
 * Copy confirms only once the clipboard write RESOLVES. `navigator.clipboard`
 * is absent on a server render and over plain HTTP, and `writeText` rejects
 * when the permission is denied — a tick over a clipboard that still holds the
 * old text is a lie, so a refusal shows its own state, says which keys to
 * press, and emits `copyFailed` for the host to do better.
 *
 * Anything projected (a timestamp, a token count) renders before the buttons.
 *
 * ```html
 * <sv-message-actions [text]="message.content" [(feedback)]="message.feedback" (regenerate)="retry()">
 *   <span class="text-[10px] text-gray-500">2m ago</span>
 * </sv-message-actions>
 * ```
 */
@Component({
  selector: 'sv-message-actions',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './message-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvMessageActionsComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerMessageActionsIcons();

  private readonly registryText = injectSvLabels('ai', SV_AI_LABELS);
  private readonly locale = svLocale();
  private readonly destroyRef = inject(DestroyRef);

  /** The text the copy action writes to the clipboard. @default '' */
  readonly text = input<string>('');

  /** Which built-in actions to show, in this order. @default ['copy', 'like', 'dislike'] */
  readonly actions = input<readonly SvMessageAction[]>(['copy', 'like', 'dislike']);

  /**
   * The reader's verdict. Two-way: the thumbs are mutually exclusive, and
   * pressing the active one again clears it.
   * @default null
   */
  readonly feedback = model<SvMessageFeedback>(null);

  /** How long the "Copied" confirmation stays, in milliseconds. @default 2000 */
  readonly copyResetMs = input<number>(2000);

  /** The group's accessible name; `null` uses the `messageActions` label. @default null */
  readonly ariaLabel = input<string | null>(null);

  /** Per-instance text, merged over the registry's `ai` labels. @default {} */
  readonly labels = input<Partial<SvAiLabels>>({});

  /** The text reached the clipboard. The payload is that text. */
  readonly copied = output<string>();

  /**
   * The clipboard refused. The button shows its failed state and the hint
   * names the shortcut; offer the text another way if you can.
   */
  readonly copyFailed = output<void>();

  /** The user asked for another answer. */
  readonly regenerate = output<void>();

  /** @internal The labels in effect. */
  protected readonly t = computed<SvAiLabels>(() => ({ ...this.registryText, ...this.labels() }));

  /** Where the copy button is in its round trip. */
  readonly copyState = signal<SvMessageCopyState>('idle');

  /** @internal Each action flagged, so the template reads fields rather than calling. */
  protected readonly shown = computed(() => {
    const a = this.actions();
    return {
      copy: a.includes('copy'),
      like: a.includes('like'),
      dislike: a.includes('dislike'),
      regenerate: a.includes('regenerate'),
    };
  });

  /** @internal The copy shortcut, named for the platform the reader is on. */
  protected readonly shortcut = ((): string => {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    return nav && /mac|iphone|ipad/i.test(nav.platform || nav.userAgent || '') ? '⌘C' : 'Ctrl+C';
  })();

  /** @internal The copy button's accessible name for its current state. */
  protected readonly copyLabel = computed(() => {
    const t = this.t();
    switch (this.copyState()) {
      case 'copied':
        return t.copied;
      case 'failed':
        return svFormatLabel(t.copyFailed, { shortcut: this.shortcut }, this.locale);
      default:
        return t.copyMessage;
    }
  });

  /** @internal The line shown beside the button when the clipboard refused. */
  protected readonly fallbackHint = computed(() =>
    svFormatLabel(this.t().copyFallbackHint, { shortcut: this.shortcut }, this.locale),
  );

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearReset());
  }

  /**
   * Copy {@link text} to the clipboard. Resolves `true` once the write has
   * actually landed, `false` when the clipboard refused.
   */
  async copy(): Promise<boolean> {
    const value = this.text();
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
    } catch {
      this.showState('failed', 8000);
      this.copyFailed.emit();
      return false;
    }
    this.showState('copied', this.copyResetMs());
    this.copied.emit(value);
    return true;
  }

  /** @internal Toggle a thumb; the other one clears. */
  protected rate(verdict: 'up' | 'down'): void {
    this.feedback.update((current) => (current === verdict ? null : verdict));
  }

  private showState(state: SvMessageCopyState, ms: number): void {
    this.clearReset();
    this.copyState.set(state);
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    this.resetTimer = setTimeout(() => {
      this.resetTimer = null;
      this.copyState.set('idle');
    }, delay);
  }

  private clearReset(): void {
    if (this.resetTimer !== null) clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }
}
