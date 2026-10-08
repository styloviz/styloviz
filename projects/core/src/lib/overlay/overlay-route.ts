import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SvCloseReason } from './close-guard';

/**
 * What a dismissible surface tells this service about itself.
 *
 * Both flags are getters, so a component can hand over its own inputs and a
 * host can change its mind while the surface is open.
 */
export interface SvRouteAwareOptions {
  /** Close the surface. The reason is `'route'` or `'history'`. */
  readonly close: (reason: SvCloseReason) => void;
  /**
   * Does a navigation close it?
   *
   * ★★ THE DEFAULT IS YES, AND THE AUDIT IS BLUNT ABOUT WHY: a modal that
   *    outlives its route and floats over an unrelated page is the most
   *    common overlay bug in shipped dashboards. A surface that genuinely
   *    belongs to the shell rather than the page — a global command palette,
   *    a support widget — says so by returning false.
   */
  readonly closeOnNavigation?: () => boolean;
  /**
   * Does the browser Back button close it?
   *
   * ★★ THE DEFAULT IS NO, AND THAT IS THE OPPOSITE DECISION FROM THE ONE
   *    ABOVE. Back closing a dialog is right when the dialog is a
   *    destination the user navigated TO — a details panel, a wizard step —
   *    and wrong when it is a transient question, where it would eat a Back
   *    press the user meant for the page. Opting in is a statement about what
   *    the surface IS, so the surface cannot make it for the host.
   */
  readonly backCloses?: () => boolean;
  /** For diagnostics only. */
  readonly label?: string;
  /**
   * Does the surface hold unsaved work right now? Consulted by `requestLeave`.
   * Optional: a surface without it is never asked to hold a navigation.
   */
  readonly dirty?: () => boolean;
  /**
   * A navigation wants to leave the page this surface belongs to, and the
   * surface is dirty. Raise the surface's own unsaved-changes prompt and
   * return `true` to hold the navigation; call `proceed` once the user chose
   * to discard (after starting the close). Return `false` to let it through.
   *
   * ★ Optional and additive — it is what `svOverlayCanDeactivate` in
   *   `@styloviz/layout` calls, so core itself never touches the router.
   */
  readonly requestLeave?: (proceed: () => void) => boolean;
}

export interface SvRouteAwareHandle {
  /**
   * The surface closed. Call it on every close path, including the ones this
   * service triggered.
   *
   * ★ It is what pops the history entry a `backCloses` surface pushed — a
   *   dialog closed with its own × button must not leave the user one Back
   *   press away from reopening it.
   */
  release(): void;
}

/** Marker key on `history.state`, namespaced so a host's own state survives. */
const SV_HISTORY_KEY = '__svOverlay';

interface Entry {
  readonly id: number;
  readonly options: SvRouteAwareOptions;
  /** Token written into `history.state`, or `null` when none was pushed. */
  readonly token: number | null;
  /** True once this surface has been closed BY a navigation or a Back press. */
  closedByHistory: boolean;
  released: boolean;
  /** True once the user discarded to let a held navigation through. */
  leaving?: boolean;
}

/**
 * Route and history integration for dismissible surfaces (`X-13`).
 *
 * ── Why this service and not `inject(Router)` in each component ─────────────
 *
 * ★★★ `@styloviz/core` DOES NOT DEPEND ON `@angular/router`, AND MUST NOT.
 *     Core is the base every other package builds on, including in apps that
 *     never route; a hard peer on the router to answer "did we navigate?"
 *     would be the tail wagging the dog. So the service owns the POLICY and
 *     the history plumbing, which need no router at all, and takes the one
 *     fact it cannot observe — that a navigation happened — as a call.
 *
 * ★★ `provideSvOverlayRouteClose()` in `@styloviz/layout` is the router half:
 *     three lines subscribing to `NavigationEnd`. Layout already has the
 *     router as a peer and is where an app's shell lives. An app that wires
 *     nothing keeps today's behaviour exactly, which is why this is safe to
 *     land in a published kit.
 *
 * ★ The Back button needs no router either: an overlay that wants Back to
 *   close it pushes a marked history entry and listens for `popstate`. That
 *   is the whole mechanism, and it is why `backCloses` works with any router
 *   or none.
 */
@Injectable({ providedIn: 'root' })
export class SvOverlayRouteService {
  private readonly _platformId = inject(PLATFORM_ID);
  private readonly _entries: Entry[] = [];
  private _nextId = 1;
  /**
   * How many `popstate` events this service caused itself.
   *
   * ★★ WITHOUT THIS THE SERVICE CLOSES SURFACES IT IS ALREADY CLOSING. A
   *    surface that pops its own entry on `release()` gets the `popstate`
   *    back a moment later, sees a state without its marker, and calls
   *    `close()` a second time — which for a family that emits `dismissed` on
   *    close means two dismissals for one action.
   */
  private _selfPops = 0;
  private _listening = false;

  /** Register an open surface. Release the handle when it closes. */
  register(options: SvRouteAwareOptions): SvRouteAwareHandle {
    const browser = isPlatformBrowser(this._platformId) && typeof window !== 'undefined';
    const wantsHistory = browser && (options.backCloses?.() ?? false);

    const id = this._nextId++;
    let token: number | null = null;

    if (wantsHistory) {
      token = id;
      // ★ The host's own state is preserved and the URL is untouched: this is
      //   a history ENTRY, not a route. A surface that wanted its own URL
      //   would be a page, and `X-13` is explicit that routing overlays is
      //   the host's decision, not the kit's.
      window.history.pushState(
        { ...(window.history.state as object | null), [SV_HISTORY_KEY]: token },
        '',
      );
    }

    const entry: Entry = { id, options, token, closedByHistory: false, released: false };
    this._entries.push(entry);
    if (browser) this._listen();

    return {
      release: (): void => this._release(entry),
    };
  }

  /**
   * The application navigated. Closes every surface that says a navigation
   * should close it.
   *
   * ★ Iterates a SNAPSHOT: `close()` normally leads straight to `release()`,
   *   which mutates the list being walked.
   */
  /**
   * A navigation is about to leave the page: does an open, dirty surface want
   * to hold it? Returns `true` when one raised its unsaved-changes prompt (the
   * caller cancels the navigation); `proceed` re-issues it after Discard.
   * Keep editing simply never calls it. Topmost surface first.
   *
   * ★★ WITHOUT THIS THE PROMPT ARRIVED TOO LATE: `navigated()` runs on
   *    `NavigationEnd`, so a dirty dialog asked "discard?" over a page the user
   *    had already been taken to, and Keep editing kept a form about a page
   *    that was gone. Used by `svOverlayCanDeactivate` (`@styloviz/layout`).
   */
  requestLeave(proceed: () => void): boolean {
    for (const entry of [...this._entries].reverse()) {
      if (entry.released || entry.leaving || !entry.options.requestLeave) continue;
      if (!(entry.options.closeOnNavigation?.() ?? true)) continue;
      if (!(entry.options.dirty?.() ?? false)) continue;
      const held = entry.options.requestLeave(() => {
        // ★ The navigation about to be re-issued supersedes this surface's
        //   history entry: popping it now would race the new navigation and
        //   the router would read the pop as a Back press.
        entry.leaving = true;
        entry.closedByHistory = true;
        proceed();
      });
      if (held) return true;
    }
    return false;
  }

  navigated(): void {
    // ★ No `released` check in this loop, nor in the `popstate` one: release
    //   SPLICES the entry out, so a released surface is not in the list to
    //   begin with. I wrote the check in both places, a mutation deleting it
    //   stayed green in both, and the flag now earns its keep only inside
    //   `_release`, where it stops a second release popping a second entry.
    for (const entry of [...this._entries]) {
      if (!(entry.options.closeOnNavigation?.() ?? true)) continue;
      // ★ Marked BEFORE the close, because the close calls back into
      //   `release()` synchronously — and `release()` has to know not to pop a
      //   history entry the navigation has already left behind.
      entry.closedByHistory = true;
      entry.options.close('route');
    }
  }

  /** Test seam: how many surfaces are currently registered. */
  get openCount(): number {
    return this._entries.filter((e) => !e.released).length;
  }

  private _release(entry: Entry): void {
    if (entry.released) return;
    entry.released = true;
    const index = this._entries.indexOf(entry);
    if (index >= 0) this._entries.splice(index, 1);

    if (entry.token === null) return;
    if (entry.closedByHistory) return;
    if (typeof window === 'undefined') return;

    // ★★ ONLY IF OUR ENTRY IS STILL THE CURRENT ONE. The user may have
    //    navigated three pages on since; calling `back()` then would take
    //    them somewhere they never asked to go, which is a far worse bug than
    //    a stale history entry.
    const state = window.history.state as Record<string, unknown> | null;
    if (state?.[SV_HISTORY_KEY] !== entry.token) return;

    this._selfPops++;
    window.history.back();
  }

  private _listen(): void {
    if (this._listening) return;
    this._listening = true;
    window.addEventListener('popstate', this._onPopState);
  }

  private readonly _onPopState = (): void => {
    if (this._selfPops > 0) {
      this._selfPops--;
      return;
    }

    const state = window.history.state as Record<string, unknown> | null;
    const marker = state?.[SV_HISTORY_KEY];

    // Topmost first: a Back press dismisses the surface the user opened last.
    for (const entry of [...this._entries].reverse()) {
      if (entry.token === null) continue;
      if (marker === entry.token) break;   // its entry is still there
      entry.closedByHistory = true;
      entry.options.close('history');
      break;                               // one Back press, one surface
    }
  };
}
