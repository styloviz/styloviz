import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { SvConnectionState } from '../types';

/**
 * ConnectionStatus — says out loud whether a live feed is still live.
 *
 * A streamed list that stops growing looks identical whether the agent is
 * thinking, has finished, or the socket died four minutes ago. Users resolve
 * that ambiguity by reloading the page, which on a stream means losing
 * everything that already arrived. This badge removes the guess.
 *
 * It renders nothing at all for `idle` and `connecting` — a badge that flashes
 * on every page load is noise, and the skeleton already covers the first fetch.
 * `open` gets a quiet dot. `reconnecting` and `closed` are the states worth
 * interrupting for, so they are announced politely and, for `reconnecting`,
 * carry the retry the host may want to expose.
 */
@Component({
  selector: 'sv-connection-status',
  standalone: true,
  templateUrl: './connection-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvConnectionStatusComponent {
  /** The host's feed state. @default 'idle' */
  readonly state = input<SvConnectionState>('idle');

  /** Overrides the label for the current state. @default '' */
  readonly label = input<string>('');

  /**
   * Offer a reconnect button while `reconnecting` or `closed`. Off by default:
   * most hosts retry automatically and a second manual trigger opens a second
   * socket.
   * @default false
   */
  readonly reconnectable = input<boolean>(false);

  /** Extra classes for the wrapper. @default '' */
  readonly customClass = input<string>('');

  /** The user asked to re-open the feed. */
  readonly reconnect = output<void>();

  /** `idle` and `connecting` render nothing — see the class comment. */
  protected readonly visible = computed(
    () => this.state() === 'open' || this.state() === 'reconnecting' || this.state() === 'closed',
  );

  /** Only a degraded feed is worth announcing; a healthy one is just a dot. */
  protected readonly announce = computed(() => this.state() !== 'open');

  protected readonly resolvedLabel = computed(() => {
    if (this.label()) return this.label();
    switch (this.state()) {
      case 'open':         return 'Live';
      case 'reconnecting': return 'Reconnecting…';
      case 'closed':       return 'Disconnected';
      default:             return '';
    }
  });

  protected readonly dotClass = computed(() => {
    switch (this.state()) {
      case 'open':         return 'bg-accent-500';
      case 'reconnecting': return 'bg-warning-500 animate-pulse';
      case 'closed':       return 'bg-gray-400 dark:bg-gray-500';
      default:             return 'bg-transparent';
    }
  });

  protected readonly wrapperClass = computed(() => {
    switch (this.state()) {
      case 'open':
        return 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300';
      case 'reconnecting':
        return 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300';
      case 'closed':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      default:
        return '';
    }
  });
}
