import { Injectable, signal, type OnDestroy } from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant  = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-right'    | 'top-left'    | 'top-center'
  | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface ToastAction {
  readonly label:    string;
  readonly callback: () => void;
}

/**
 * How long a toast is allowed to outlive the page it was raised on (`X-13`,
 * `OF-19-I5`).
 *
 * ★★★ THE OBVIOUS ANSWER — "close everything on navigation" — IS WRONG HERE,
 *     and it is wrong in the one case toasts exist for. `toast.success('Saved')`
 *     followed by `router.navigate(['/invoices'])` is THE canonical success
 *     toast: the whole point is that it survives the navigation the save
 *     triggered. A blanket route-close would delete every confirmation the user
 *     is meant to read, and it would do it in the flow that matters most.
 *
 * ★★ WHAT IS ACTUALLY STALE IS A TOAST ABOUT THE PAGE, not about the action.
 *    "3 filters could not be applied to this view", "This report is still
 *    loading" — those refer to something the user has left, and reading them
 *    two pages later is worse than not seeing them. So the staleness is a
 *    property of the MESSAGE, which only the caller knows, and it is declared
 *    per toast rather than guessed globally.
 *
 * | Scope             | Survives navigation | Use for                          |
 * |-------------------|---------------------|----------------------------------|
 * | `'global'` (default) | yes              | outcomes: saved, deleted, sent   |
 * | `'route'`         | no                  | statements about the current page |
 */
export type ToastScope = 'global' | 'route';

export interface Toast {
  readonly id:          string;
  readonly variant:     ToastVariant;
  readonly title?:      string;
  readonly message:     string;
  readonly duration:    number;     // ms — 0 = persist until dismissed
  readonly dismissible: boolean;
  readonly action?:     ToastAction;
  readonly position:    ToastPosition;
  /** Whether this toast survives a route change. Defaults to `'global'`. */
  readonly scope:       ToastScope;
  /**
   * Identity for deduplication (`X-12`, `OF-19-I1`). `null` opted out.
   *
   * Derived from variant + title + message + position when the caller does not
   * supply one, so two calls that would render the identical toast are the
   * same toast.
   */
  readonly dedupeKey:   string | null;
  /**
   * How many times this toast has been raised. `1` for a first occurrence.
   *
   * ★ A repeat is COUNTED, not dropped and not duplicated. Dropping it hides
   *   that the thing is still happening — the difference between one failed
   *   save and a retry loop failing eleven times is the whole diagnosis —
   *   and duplicating it buries the rest of the stack under one message.
   */
  readonly count:       number;
}

export interface ToastOptions {
  readonly title?:       string;
  readonly duration?:    number;
  readonly dismissible?: boolean;
  readonly action?:      ToastAction;
  readonly position?:    ToastPosition;
  /**
   * `'route'` dismisses this toast on the next navigation; `'global'` (the
   * default) keeps it. See {@link ToastScope} — the default is `'global'`
   * because the commonest toast of all is raised BY a navigating action.
   */
  readonly scope?:       ToastScope;
  /**
   * Deduplication identity (`X-12`, `OF-19-I1`).
   *
   * | Value       | Meaning                                                    |
   * |-------------|------------------------------------------------------------|
   * | omitted     | derive one from variant + title + message + position       |
   * | a string    | dedupe on that, whatever the text — e.g. `'sync-failed'`   |
   * | `null`      | never dedupe; this call always adds a toast                |
   *
   * ★★ THE DEFAULT IS ON, because "no deduplication" is the defect: a retry
   *    loop that fails eleven times filled the screen with eleven identical
   *    toasts and pushed every other message out of a bounded stack. A repeat
   *    now refreshes the one that is up, increments its `count`, and restarts
   *    its countdown.
   *
   * ★ An EXPLICIT key is the interesting one: it makes "Saving…" and "Saved"
   *   for the same record replace each other, and it makes two different
   *   records' failures two toasts even when the wording is identical.
   */
  readonly dedupeKey?:   string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

// module-id-counter: data id — never rendered as a DOM id during a server render.
let _idCounter = 0;

/**
 * ToastService — Imperative notification API.
 *
 * Inject anywhere and call convenience methods:
 *   toast.success('Saved!');
 *   toast.error('Failed', { title: 'Error', duration: 0 });
 *
 * Pair with `<sv-toast-host>` from `@styloviz/toast` in your root layout.
 */
interface ToastTimer {
  /**
   * The live `setTimeout` handle, or `undefined` while paused.
   *
   * ★ `undefined` is the pause flag, and both `pause()` and `resume()` guard on
   *   it. A paused entry is KEPT (rather than deleted) so `resume()` can restart
   *   from `remaining`; the absent handle is what distinguishes "paused" from
   *   "running" without a second boolean that could disagree with it.
   */
  handle?:   ReturnType<typeof setTimeout>;
  /** ms remaining when the timer was last (re)started. */
  remaining: number;
  /** wall-clock time the timer was last started. */
  startedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  readonly toasts = signal<Toast[]>([]);

  /** Active auto-dismiss timers keyed by toast id (enables pause/resume). */
  private readonly timers = new Map<string, ToastTimer>();

  success(message: string, opts?: ToastOptions): string {
    return this.show('success', message, opts);
  }

  error(message: string, opts?: ToastOptions): string {
    return this.show('error', message, { duration: 6000, ...opts });
  }

  warning(message: string, opts?: ToastOptions): string {
    return this.show('warning', message, opts);
  }

  info(message: string, opts?: ToastOptions): string {
    return this.show('info', message, opts);
  }

  show(variant: ToastVariant, message: string, opts: ToastOptions = {}): string {
    const duration    = opts.duration ?? 4000;
    const dismissible = opts.dismissible ?? true;
    const position    = opts.position ?? 'top-right';
    const scope       = opts.scope ?? 'global';
    const dedupeKey   =
      opts.dedupeKey === null
        ? null
        : opts.dedupeKey ??
          // ★ `\u0000` as the separator, not `|`: a message may contain any
          //   printable character, and a joined key that a message can forge
          //   is a key that can collide with a different message on purpose.
          //   Position is part of it because two hosts render two stacks —
          //   the same text top-right and bottom-left is two toasts.
          [variant, opts.title ?? '', message, position].join('\u0000');

    if (dedupeKey !== null) {
      const existing = this.toasts().find((t) => t.dedupeKey === dedupeKey);
      if (existing) {
        return this._refresh(existing, {
          variant,
          message,
          title: opts.title,
          duration,
          dismissible,
          action: opts.action,
          position,
          scope,
          dedupeKey,
        });
      }
    }

    const id = `svz-toast-${++_idCounter}`;
    const toast: Toast = {
      id,
      variant,
      message,
      title:       opts.title,
      duration,
      dismissible,
      action:      opts.action,
      position,
      scope,
      dedupeKey,
      count:       1,
    };

    this.toasts.update(list => [...list, toast]);

    if (toast.duration > 0) {
      this.startTimer(id, toast.duration);
    }

    return id;
  }

  /**
   * A repeat of a toast that is already up (`X-12`, `OF-19-I1`).
   *
   * ★★★ IT KEEPS ITS PLACE IN THE STACK. Moving a repeat to the newest slot
   *     displaces every toast below it — under a pointer that is, by design,
   *     hovering the stack to pause it, which is how a user clicks Dismiss on
   *     the wrong message. The count and the restarted countdown already say
   *     "again, now". The cost, stated rather than hidden: a repeat of a toast
   *     that `maxVisible` has already pushed out of view stays out of view.
   *
   * ★★ IT KEEPS ITS ID, and returns it. The caller's handle from the first
   *    call still dismisses, pauses and resumes the thing on screen — and the
   *    host's "already announced" set is keyed by id, so a repeat does not
   *    shout the same sentence at a screen-reader user a second time.
   *
   * ★ The newer call's text, action and duration WIN. With a derived key they
   *   are identical by construction; with an explicit key the newer wording is
   *   the fresher truth — that is what makes `'Saving…'` → `'Saved'` on one key
   *   a replacement rather than two toasts.
   */
  private _refresh(existing: Toast, next: Omit<Toast, 'id' | 'count'>): string {
    const refreshed: Toast = { ...next, id: existing.id, count: existing.count + 1 };
    this.toasts.update(list => list.map(t => (t.id === existing.id ? refreshed : t)));
    this.clearTimer(existing.id);
    if (refreshed.duration > 0) this.startTimer(existing.id, refreshed.duration);
    return existing.id;
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  dismissAll(): void {
    this.timers.forEach(t => clearTimeout(t.handle));
    this.timers.clear();
    this.toasts.set([]);
  }

  /**
   * The app navigated — drop the toasts that were about the page just left
   * (`X-13`, `OF-19-I5`).
   *
   * Router-agnostic on purpose, exactly like `SvOverlayRouteService.navigated()`:
   * core does not depend on `@angular/router`. `provideSvOverlayRouteClose()`
   * from `@styloviz/layout` calls this on `NavigationEnd`; an app on a different
   * router calls it itself.
   *
   * ★★ IT IS A POINT IN TIME, NOT A MODE. Only the toasts standing when it is
   *    called are considered; a `'route'` toast raised afterwards belongs to the
   *    page just arrived at and is not retroactively stale. That is what makes
   *    `toast.error('Could not load this view', { scope: 'route' })` usable from
   *    a route resolver or a landing-page effect.
   *
   * ★ Each one goes through `dismiss()` rather than a bulk `set([])`, so its
   *   auto-dismiss timer is cleared with it. A surviving timer would later fire
   *   `dismiss(id)` for an id nothing holds — harmless today, and exactly the
   *   kind of leak that stops being harmless once ids are reused for dedupe
   *   (`T6`).
   */
  navigated(): void {
    for (const toast of this.toasts()) {
      if (toast.scope === 'route') this.dismiss(toast.id);
    }
  }

  /**
   * Pause a toast's auto-dismiss countdown (e.g. while the pointer hovers the
   * stack), preserving the time that was left. No-op for persistent toasts.
   *
   * ★ The `!timer.handle` guard is load-bearing, not defensive tidiness.
   *   `sv-toast-host` calls `pauseAll()` from BOTH `mouseenter` and `focusin`,
   *   and hovering a toast then tabbing into it fires both. Without the guard
   *   the second call subtracts the SAME elapsed span from `remaining` a second
   *   time, so the toast dismisses at roughly half the time it had left —
   *   under the user's pointer, while they are reading it. `resume()` has
   *   always had the mirror-image guard; this one was missing.
   */
  pause(id: string): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.handle) return;
    clearTimeout(timer.handle);
    // Keep the entry (with no live handle) so resume() can restart it.
    this.timers.set(id, {
      ...timer,
      handle: undefined,
      remaining: timer.remaining - (Date.now() - timer.startedAt),
    });
  }

  /** Resume a previously paused auto-dismiss countdown with its remaining time. */
  resume(id: string): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle) return;
    this.startTimer(id, Math.max(timer.remaining, 0));
  }

  // ── Internal timer helpers ──────────────────────────────────────────────────

  private startTimer(id: string, duration: number): void {
    const handle = setTimeout(() => this.dismiss(id), duration);
    this.timers.set(id, { handle, remaining: duration, startedAt: Date.now() });
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
  }

  /**
   * Clear every pending auto-dismiss timer when the injector goes (`OF-19-I4`,
   * and the same defect class as the Alert Banner's `X-2`).
   *
   * ★★★ A PENDING `setTimeout` IS A STRONG REFERENCE HELD BY THE RUNTIME. Its
   *     closure holds this service, which holds every toast in the signal, and
   *     nothing can collect any of it until the timer fires — up to six
   *     seconds after the injector that owned it was destroyed. On the server
   *     that is once per REQUEST: a per-request root injector with a toast in
   *     flight stays alive, and the callback then calls `dismiss()` on a
   *     service nothing will ever read again.
   *
   * ★★ `ngOnDestroy` RATHER THAN `inject(DestroyRef)`, and the reason is
   *    testability rather than taste: this service is constructed directly
   *    (`new ToastService()`) by its own specs and by hosts that want an
   *    isolated stack, and `inject()` outside an injection context throws.
   *    Angular calls `ngOnDestroy` on a `providedIn: 'root'` service when its
   *    injector is destroyed, so both paths work.
   *
   * ★ The toasts themselves are left alone. Nothing will read the signal after
   *   this, and clearing it would be work done for an observer that does not
   *   exist; the timers are the leak.
   */
  ngOnDestroy(): void {
    this.timers.forEach(t => { if (t.handle) clearTimeout(t.handle); });
    this.timers.clear();
  }
}
