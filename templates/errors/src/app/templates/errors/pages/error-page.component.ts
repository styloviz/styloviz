import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SvButtonComponent } from '@styloviz/button';
import { SvIconComponent } from '@styloviz/icons';
import { SvInputFieldComponent } from '@styloviz/input-field';
import {
  ERRORS_BRAND,
  ERRORS_SEARCH_URL,
  ERRORS_SIGN_IN_URL,
  ERRORS_STATUS_URL,
  ERRORS_SUGGESTIONS,
} from '../errors.config';
import {
  newReferenceId,
  notifySubscribe,
  supportMailto,
  type ErrorAction,
  type ErrorDefinition,
  type ErrorTone,
} from '../errors.data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Distinguishes two references minted in the same millisecond. */
let REFERENCE_SEQ = 0;

/** Per-tone classes, written out in full because Tailwind scans source text. */
interface ToneClasses {
  readonly badge: string;
  readonly ink: string;
  readonly glow: string;
  readonly ghost: string;
}

const TONES: Record<ErrorTone, ToneClasses> = {
  neutral: {
    badge: 'bg-gray-100 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/60',
    ink: 'text-gray-600 dark:text-gray-300',
    glow: 'from-gray-300/40 dark:from-gray-600/25',
    ghost: 'text-gray-900/[0.04] dark:text-white/[0.05]',
  },
  info: {
    badge: 'bg-sky-50 ring-sky-100 dark:bg-sky-500/10 dark:ring-sky-500/20',
    ink: 'text-sky-700 dark:text-sky-400',
    glow: 'from-sky-300/40 dark:from-sky-500/25',
    ghost: 'text-sky-900/[0.05] dark:text-sky-300/[0.06]',
  },
  warning: {
    badge: 'bg-amber-50 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20',
    ink: 'text-amber-700 dark:text-amber-400',
    glow: 'from-amber-300/40 dark:from-amber-500/25',
    ghost: 'text-amber-900/[0.05] dark:text-amber-300/[0.06]',
  },
  danger: {
    badge: 'bg-rose-50 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20',
    ink: 'text-rose-700 dark:text-rose-400',
    glow: 'from-rose-300/40 dark:from-rose-500/25',
    ghost: 'text-rose-900/[0.05] dark:text-rose-300/[0.06]',
  },
};

/**
 * ErrorPageComponent — one presenter for every entry in the catalogue.
 *
 * ★★★ THE PAGES ARE DATA, NOT COMPONENTS.
 *
 * Five near-identical components meant the sixth error anybody needed was a
 * sixth copy of the same markup — which is how a kit ends up with a 403 whose
 * actions are worded differently from its 401, and a 502 nobody remembered to
 * give a retry button. Everything specific to one error lives in
 * `ERROR_CATALOGUE`; this file is the only place that knows what an error page
 * looks like.
 */
@Component({
  selector: 'sv-error-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SvButtonComponent, SvIconComponent, SvInputFieldComponent],
  templateUrl: './error-page.component.html',
})
export class ErrorPageComponent {
  readonly error = input.required<ErrorDefinition>();

  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * ★★★ Reached through `DOCUMENT`, not the bare `location` global.
   *
   * Two reasons, and the second is the one that bites:
   *
   * 1. `inject(DOCUMENT)` is the SSR-safe way to reach the window. Angular
   *    supplies a server-side document during a prerender, so nothing here
   *    depends on a global that only exists in a browser.
   *
   * 2. **`location` cannot be intercepted in a test.** As of jsdom 26 both
   *    `window.location` (`configurable: false`) and `location.reload`
   *    (`writable: false, configurable: false`) are unforgeable, so `vi.spyOn`
   *    and `Object.defineProperty` both throw. `Document.prototype.defaultView`
   *    IS configurable, which makes this the one seam a spec can reach.
   *
   * `defaultView` is null only for a detached document, so the optional call is
   * a real guard rather than ceremony.
   */
  private readonly document = inject(DOCUMENT);

  protected readonly brand = ERRORS_BRAND;
  protected readonly suggestions = ERRORS_SUGGESTIONS;
  protected readonly statusUrl = ERRORS_STATUS_URL;

  protected readonly tone = computed<ToneClasses>(() => TONES[this.error().tone]);

  // ── Support reference ─────────────────────────────────────────────────────

  /**
   * ★★ EMPTY UNTIL THE BROWSER FILLS IT. A reference minted in a field
   * initialiser is a different string on the server than on the client, and a
   * value that changes between render and hydration is a mismatch. The server
   * renders nothing here; the client fills it in on the next frame.
   */
  protected readonly reference = signal('');
  protected readonly copied = signal(false);
  protected readonly copyFailed = signal(false);

  // ── Auto-retry ────────────────────────────────────────────────────────────

  protected readonly countdown = signal(0);
  /**
   * What the live region says about the auto-retry.
   *
   * ★ Set on the three moments that matter — it starts, it fires, it is
   *   stopped — and never per tick. A `role="status"` wrapped around the ticking
   *   number read "Trying again in 29s, 28s, 27s…" over everything else on the
   *   page for as long as the countdown ran.
   */
  protected readonly retryAnnouncement = signal('');
  private timer: ReturnType<typeof setInterval> | null = null;

  // ── Connection ────────────────────────────────────────────────────────────

  /** `true` once the browser reports the connection is back. */
  protected readonly backOnline = signal(false);

  // ── Notify-me ─────────────────────────────────────────────────────────────

  protected readonly email = signal('');
  protected readonly submitting = signal(false);
  protected readonly subscribed = signal(false);
  /**
   * ★ Said, not swallowed. Once `ERRORS_API.baseUrl` points at a real endpoint
   *   the POST can fail, and a button that stops spinning with nothing to show
   *   for it reads as "you're on the list" to somebody who is not.
   */
  protected readonly notifyFailed = signal(false);
  protected readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));

  // ── Search (404) ──────────────────────────────────────────────────────────

  protected readonly query = signal('');

  /** The path that was asked for, echoed back so the typo is visible. */
  protected readonly requestedPath = signal('');

  protected readonly mailto = computed(() => supportMailto(this.reference(), this.error().key));

  constructor() {
    /**
     * ★ `afterNextRender` runs in the browser only — never during a prerender.
     * Everything in here touches something a server does not have.
     */
    afterNextRender(() => {
      const view = this.document.defaultView;
      const def = this.error();

      if (def.showReference) {
        REFERENCE_SEQ += 1;
        this.reference.set(newReferenceId(Date.now(), REFERENCE_SEQ));
      }
      if (def.showSearch) {
        this.requestedPath.set(view?.location.pathname ?? '');
      }
      if (def.autoRetrySeconds) {
        this.startCountdown(def.autoRetrySeconds);
      }
      if (def.watchConnection && view) {
        const onOnline = () => this.backOnline.set(true);
        const onOffline = () => this.backOnline.set(false);
        this.backOnline.set(view.navigator.onLine);
        view.addEventListener('online', onOnline);
        view.addEventListener('offline', onOffline);
        this.destroyRef.onDestroy(() => {
          view.removeEventListener('online', onOnline);
          view.removeEventListener('offline', onOffline);
        });
      }
    });

    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected onAction(action: ErrorAction): void {
    switch (action.id) {
      case 'home': void this.router.navigateByUrl(ERRORS_BRAND.homeLink); break;
      case 'back': this.document.defaultView?.history.back(); break;
      case 'retry': this.reload(); break;
      case 'signin': void this.router.navigateByUrl(ERRORS_SIGN_IN_URL); break;
      case 'support': this.document.defaultView?.open(this.mailto(), '_self'); break;
      case 'status': this.document.defaultView?.open(this.statusUrl, '_self'); break;
      default: break;
    }
  }

  reload(): void {
    this.document.defaultView?.location.reload();
  }

  protected search(): void {
    const q = this.query().trim();
    if (!q) return;
    void this.router.navigate([ERRORS_SEARCH_URL], { queryParams: { q } });
  }

  protected async copyReference(): Promise<void> {
    const text = this.reference();
    if (!text) return;
    // ★ Guarded, not assumed: `navigator.clipboard` is undefined on a server
    // render and blocked outside a secure context. A copy that cannot happen
    // must not take the page down with it — least of all the error page.
    try {
      const clipboard = this.document.defaultView?.navigator?.clipboard;
      if (!clipboard) throw new Error('no clipboard');
      await clipboard.writeText(text);
      this.copied.set(true);
      this.copyFailed.set(false);
    } catch {
      // ★ Said, not swallowed. The reference being on screen is only useful
      //   advice if something gives it — an unchanged button reads as broken,
      //   and this is the page a visitor is already on because something broke.
      this.copied.set(false);
      this.copyFailed.set(true);
    }
  }

  protected async notify(): Promise<void> {
    if (!this.emailValid() || this.submitting()) return;
    this.submitting.set(true);
    this.notifyFailed.set(false);
    try {
      await notifySubscribe(this.email().trim(), this.injector);
      this.subscribed.set(true);
    } catch {
      this.notifyFailed.set(true);
    } finally {
      this.submitting.set(false);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * ★★ THE COUNTDOWN RELOADS BY ITSELF, which is the whole point: a 503 that
   * clears in forty seconds should not need the visitor to keep pressing a
   * button to find out.
   */
  private startCountdown(seconds: number): void {
    this.stopTimer();
    this.countdown.set(seconds);
    this.retryAnnouncement.set(`Trying again automatically in ${seconds} seconds.`);
    this.timer = setInterval(() => {
      this.countdown.update((n) => Math.max(0, n - 1));
      if (this.countdown() === 0) {
        this.stopTimer();
        this.retryAnnouncement.set('Trying again now.');
        this.reload();
      }
    }, 1000);
  }

  protected cancelCountdown(): void {
    this.stopTimer();
    this.countdown.set(0);
    this.retryAnnouncement.set('Automatic retry stopped.');
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
