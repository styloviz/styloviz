import { Injectable, inject, DestroyRef } from '@angular/core';

/**
 * How loudly a message is announced.
 *
 * - `polite` — waits for the screen reader to finish what it is saying.
 * - `assertive` — interrupts mid-sentence.
 */
export type SvAnnouncePriority = 'polite' | 'assertive';

export interface SvAnnounceOptions {
  /** @default 'polite' */
  readonly priority?: SvAnnouncePriority;
  /**
   * Groups messages that supersede one another.
   *
   * ★★ THIS IS WHAT "PROGRESS SUPERSEDES ITS OWN LAST VALUE" MEANS in code. A
   *    progress bar moving 41% → 42% → 43% inside one throttle window should
   *    announce "43%" once, not three values the user has already passed.
   *    Messages sharing a key replace each other while pending; those without
   *    one are independent and all get through.
   */
  readonly key?: string;
  /**
   * Minimum gap between two announcements sharing this key. @default 0
   *
   * With a key, a message arriving inside the window is held and replaces
   * whatever was already waiting, so the user hears the LATEST value once the
   * window closes — never a backlog of stale ones.
   */
  readonly throttleMs?: number;
  /**
   * Say it even if it is identical to the last message on this region.
   * @default false
   *
   * ★ The default suppression is `OF-01-I4`: a banner re-rendered on every
   *   change re-announced the same sentence each time. But a REPEAT is
   *   sometimes the information — "no results" after a second failed search
   *   has to be heard again — so it is one flag away.
   */
  readonly force?: boolean;
}

/** How long two identical messages count as the same announcement. */
const DEDUPE_WINDOW_MS = 1_000;

/**
 * One message that actually reached a region — the record `history()` keeps.
 */
export interface SvAnnouncement {
  readonly message: string;
  readonly priority: SvAnnouncePriority;
  /** `Date.now()` at the moment it was written. */
  readonly at: number;
}

/** How many written messages `history()` remembers. Oldest drop first. */
const HISTORY_LIMIT = 50;

/**
 * ★★★ SEMANTIC VARIANT → POLITENESS, IN ONE PLACE, because the kit had two
 *     answers. Toast announced `warning` ASSERTIVELY and Alert Banner
 *     announced it POLITELY — the same severity, the same word, interrupting
 *     the user in one component and not the other. Measured, not assumed:
 *     `toast-host.component.ts` and `alert-banner.component.ts` each carried
 *     their own two-line mapping.
 *
 * ★★ ASSERTIVE IS FOR ERRORS, AND WARNING IS NOT ONE. `assertive` cuts the
 *    screen reader off mid-word, so it is reserved for the cases where
 *    carrying on would cost the user something: a failure, a timeout, a
 *    destructive result. A warning the user is not blocked by does not earn
 *    an interruption. Where the two families disagreed, the quieter answer is
 *    also the correct one.
 */
export function svAnnouncePriorityFor(variant: string | null | undefined): SvAnnouncePriority {
  switch (variant) {
    case 'error':
    case 'danger':
    case 'critical':
      return 'assertive';
    default:
      return 'polite';
  }
}

interface Pending {
  /** Mutable: a later message for the same key overwrites it in place. */
  message: string;
  priority: SvAnnouncePriority;
  /** Owned by the FIRST held message for this key, and never replaced. */
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * The one place that speaks to a screen reader.
 *
 * ★★★ THE REGION HAS TO EXIST BEFORE THE TEXT DOES, and that is the defect
 *     this service is built around. Toast and Alert Banner both INSERTED a
 *     node that already carried `aria-live` and its own message — each toast
 *     *was* its own live region, created with the text already inside it.
 *     Assistive technology watches an existing region for changes; a region
 *     that arrives with its content is at the mercy of when the AT happened
 *     to scan, which is why it is the least reliable announcement pattern
 *     there is. Two regions created once, mutated forever, is the pattern
 *     that works. `X-9` / `OF-19-I8`.
 *
 * ★★ AND IT HAS TO OUTLIVE THE COMPONENT. A toast that auto-dismisses after
 *    four seconds takes its own region with it, mid-sentence. These regions
 *    belong to the service, which belongs to the application.
 *
 * ★ Six capabilities, because `X-9` names six: priority (two regions),
 *   deduplication (`DEDUPE_WINDOW_MS`), throttling and replacement (`key` +
 *   `throttleMs`), cancellation (`cancel`, and automatic on the caller's
 *   destruction via `scoped()`), and ownership — which is a RULE, not code:
 *   exactly one owner speaks per event. See `T0-8`: two voices for one wait
 *   is worse than one, because the user hears the same thing twice and
 *   neither says when it ended.
 */
@Injectable({ providedIn: 'root' })
export class SvLiveAnnouncer {
  private _regions: Record<SvAnnouncePriority, HTMLElement> | null = null;
  /** Which of a region's two slots holds the current message. */
  private readonly _slot: Record<SvAnnouncePriority, 0 | 1> = { polite: 0, assertive: 0 };
  private readonly _last: Record<SvAnnouncePriority, { message: string; at: number }> = {
    polite: { message: '', at: 0 },
    assertive: { message: '', at: 0 },
  };
  private readonly _pending = new Map<string, Pending>();
  private readonly _lastKeyed = new Map<string, number>();
  private readonly _history: SvAnnouncement[] = [];

  /**
   * Say something.
   *
   * Returns `true` when the message reached a region now, `false` when it was
   * suppressed as a duplicate or held for a throttle window. Tests assert on
   * this; callers can ignore it.
   */
  announce(message: string, options: SvAnnounceOptions = {}): boolean {
    const text = message.trim();
    if (!text) return false;

    const priority = options.priority ?? 'polite';
    const key = options.key;
    const throttleMs = options.throttleMs ?? 0;

    if (key && throttleMs > 0) {
      const now = Date.now();
      const last = this._lastKeyed.get(key) ?? 0;
      const wait = last + throttleMs - now;
      if (wait > 0) {
        // ★★ REPLACE, DO NOT QUEUE — and one timer per key, not one per
        //    message. The first held message owns the timer, because the
        //    window started when the message before it was spoken; each later
        //    one only overwrites the TEXT that timer will read. Writing a new
        //    timer each time and cancelling the old one behaves identically
        //    and I had it that way first — the mutation test could not tell
        //    the two apart, which is how I noticed that the cancel was doing
        //    nothing the map overwrite was not already doing. One timer is
        //    the version with no stray timers to reason about.
        const existing = this._pending.get(key);
        if (existing) {
          existing.message = text;
          existing.priority = priority;
          return false;
        }
        this._pending.set(key, {
          message: text,
          priority,
          timer: setTimeout(() => {
            const held = this._pending.get(key);
            this._pending.delete(key);
            if (held) this._write(held.message, held.priority, true);
            this._lastKeyed.set(key, Date.now());
          }, wait),
        });
        return false;
      }
      this._lastKeyed.set(key, now);
    }

    return this._write(text, priority, options.force ?? false);
  }

  /** Drop a keyed message that has not been spoken yet. Idempotent. */
  cancel(key: string): void {
    const pending = this._pending.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this._pending.delete(key);
  }

  /**
   * An announcer bound to the caller's lifetime.
   *
   * ★★ CANCELLATION IS THE CAPABILITY PEOPLE FORGET, and a throttled message
   *    is exactly where it bites: a progress bar destroyed 200 ms into its
   *    500 ms window would otherwise announce a percentage for a component
   *    that no longer exists, about an operation the user has navigated away
   *    from. Everything this handle holds back is dropped on destroy.
   *
   * Must be called in an injection context (a field initializer is ideal).
   */
  scoped(): SvScopedAnnouncer {
    const keys = new Set<string>();
    inject(DestroyRef).onDestroy(() => {
      for (const key of keys) this.cancel(key);
      keys.clear();
    });
    return {
      announce: (message, options = {}) => {
        if (options.key) keys.add(options.key);
        return this.announce(message, options);
      },
      cancel: (key) => { keys.delete(key); this.cancel(key); },
    };
  }

  /** Clear both regions and forget every pending message. Tests and teardown. */
  reset(): void {
    for (const [, pending] of this._pending) clearTimeout(pending.timer);
    this._pending.clear();
    this._lastKeyed.clear();
    this._history.length = 0;
    this._last.polite = { message: '', at: 0 };
    this._last.assertive = { message: '', at: 0 };
    if (this._regions) {
      for (const region of Object.values(this._regions)) region.remove();
      this._regions = null;
    }
  }

  /**
   * Every message that actually reached a region, oldest first (`N-2`'s test
   * hook).
   *
   * ★★★ "WHAT DID THE SCREEN READER HEAR" WAS UNASSERTABLE. `regionFor()`
   *     shows only the region's CURRENT text, so a burst — three toasts, a
   *     progress update and an error in one tick — could only ever be checked
   *     for its last word. Dedupe, throttling and replacement are all claims
   *     about what was NOT spoken, and a claim about absence needs the whole
   *     record. This is that record: a dropped duplicate, a throttled value
   *     that was superseded, and a cancelled held message never appear in it.
   *
   * Bounded (the last 50) so a long-lived app does not grow it forever.
   */
  history(): readonly SvAnnouncement[] {
    return this._history.slice();
  }

  /** Forget the record `history()` keeps, leaving the regions in place. */
  clearHistory(): void {
    this._history.length = 0;
  }

  /** The live region for a priority, for tests. `null` before the first announce. */
  regionFor(priority: SvAnnouncePriority): HTMLElement | null {
    return this._regions?.[priority] ?? null;
  }

  private _write(text: string, priority: SvAnnouncePriority, force: boolean): boolean {
    const regions = this._ensureRegions();
    if (!regions) return false;

    const last = this._last[priority];
    const now = Date.now();
    if (!force && last.message === text && now - last.at < DEDUPE_WINDOW_MS) return false;

    const region = regions[priority];
    // ★★ ALTERNATING SLOTS, and the reason is not tidiness. Writing the SAME
    //    string over a region's text is not a DOM change, so an AT has nothing
    //    to react to and a deliberate repeat is silently swallowed. Moving the
    //    text between two child nodes is always a mutation, and `aria-atomic`
    //    makes the region re-read as a whole either way.
    //
    // ⚠️ That the AT then speaks is the one thing no test here can prove —
    //    jsdom has no accessibility tree. The tests assert the mechanism (the
    //    text is in the region, the mutation happened, the right region got
    //    it); the behaviour above is why the mechanism is shaped like this.
    const next = this._slot[priority] === 0 ? 1 : 0;
    region.children[next].textContent = text;
    region.children[this._slot[priority]].textContent = '';
    this._slot[priority] = next;

    this._last[priority] = { message: text, at: now };
    this._history.push({ message: text, priority, at: now });
    if (this._history.length > HISTORY_LIMIT) this._history.shift();
    return true;
  }

  private _ensureRegions(): Record<SvAnnouncePriority, HTMLElement> | null {
    if (this._regions) return this._regions;
    if (typeof document === 'undefined' || !document.body) return null;   // SSR

    const make = (priority: SvAnnouncePriority): HTMLElement => {
      const el = document.createElement('div');
      el.setAttribute('aria-live', priority);
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('data-sv-live-region', priority);
      // ★ Not `display: none` and not `visibility: hidden` — both remove the
      //   element from the accessibility tree, which would make the region
      //   silent. This is the standard visually-hidden clip.
      el.style.cssText =
        'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;' +
        'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;';
      el.appendChild(document.createElement('span'));
      el.appendChild(document.createElement('span'));
      document.body.appendChild(el);
      return el;
    };

    this._regions = { polite: make('polite'), assertive: make('assertive') };
    return this._regions;
  }
}

/** An announcer that forgets its pending messages when its owner is destroyed. */
export interface SvScopedAnnouncer {
  announce(message: string, options?: SvAnnounceOptions): boolean;
  cancel(key: string): void;
}
