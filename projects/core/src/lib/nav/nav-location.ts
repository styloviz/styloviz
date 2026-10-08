import {
  DestroyRef,
  InjectionToken,
  type EnvironmentProviders,
  type Signal,
  computed,
  inject,
  makeEnvironmentProviders,
  signal,
} from '@angular/core';

declare const ngDevMode: boolean | undefined;

/**
 * ============================================================================
 *  The navigation location seam — `X-8`
 * ============================================================================
 *
 * Five navigation families independently ask for the same thing: put my state in
 * the URL. Tabs (`NV-06-M3`), Breadcrumb (`NV-03-M1`), Pagination (`NV-04-M4`),
 * Stepper (`NV-05-M2`) and Mega Menu (`NV-07-M4`), plus Accordion (`NV-01-M1`)
 * and Anchor (`NV-02-M2`) wanting the hash half. Seven implementations of one
 * idea is how seven subtly different answers to "does back undo this?" get
 * shipped.
 *
 * ── Why a seam and not a router dependency ──────────────────────────────────
 * **Optional is the load-bearing word.** A kit that hard-depends on
 * `@angular/router` is unusable in a hybrid app, in a non-routed widget, or
 * inside another framework's shell — and we had the proof in-tree: `sv-sidebar`
 * imports `RouterLink` directly (as `sv-breadcrumb` and `sv-sidebar-nav` did
 * until they moved to `SvLinkAdapter`), which is exactly why it cannot be
 * dropped into a consumer's app that routes some other way.
 *
 * So `@styloviz/core` deliberately does **not** import `@angular/router`. The
 * router implementation is fifteen lines the consumer writes, and it is in the
 * documentation rather than in this package. What ships here is the seam plus
 * the three implementations that need no router at all.
 *
 * ── Why the default does nothing ────────────────────────────────────────────
 * {@link svNoopNavLocation} is the default, and that is not laziness. A
 * component that starts writing to the address bar because the consumer upgraded
 * a package has changed their app's behaviour without being asked — their
 * analytics see new URLs, their back button gains entries, and a shared link
 * means something different than it did last week. Addressability is opt-in.
 *
 * ── Why `replace` is the default write mode ─────────────────────────────────
 * `NV-02-I3` is the cautionary case: a scrollspy that pushes a history entry for
 * every section the reader scrolls past fills the back stack until back stops
 * being a way out of the page. That is the single most common defect in this
 * category in the wild. Pushing is a deliberate act — "this was a navigation the
 * user should be able to undo" — so it has to be asked for.
 */

/** What a write does to browser history. */
export type SvNavWriteMode =
  /** Rewrite the current entry. The default: no new back-stack entry. */
  | 'replace'
  /** Add an entry, so the browser's back button undoes this change. */
  | 'push';

/**
 * Where a component reads and writes its addressable state.
 *
 * Implementations are keyed stores over *something the browser already has* — a
 * query string, the hash, a router's state. They are deliberately synchronous
 * and string-valued: a component that needs a number parses it, because the URL
 * only ever held text.
 */
export interface SvNavLocation {
  /** Names the implementation, for diagnostics only. */
  readonly kind: string;

  /**
   * The current value for `key`, or `null` when absent.
   *
   * Returns `null` on the server for every browser-backed implementation, which
   * is the answer to `X-9`'s "what renders before any measurement runs": the
   * component's own default, not a guess at the URL.
   */
  read(key: string): string | null;

  /**
   * Store `value` under `key`; `null` removes the key entirely.
   *
   * Removing rather than storing an empty string matters — `?tab=` and no `tab`
   * at all are different URLs, and only one of them is what "no selection"
   * means.
   */
  write(key: string, value: string | null, mode?: SvNavWriteMode): void;

  /**
   * Observe changes made by anything else — the back button, another component
   * sharing this location, or the consumer's own router. Returns the
   * unsubscribe.
   *
   * Listeners fire on external navigation **and** on {@link write}, so two
   * components sharing one location cannot drift apart. That makes a listener's
   * job idempotent by design: read the value, compare, do nothing if unchanged.
   */
  subscribe(listener: () => void): () => void;
}

/** True only in a browser with a usable History API. */
function browserHistoryAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.history !== 'undefined' &&
    typeof window.location !== 'undefined'
  );
}

/**
 * A listener registry shared by the browser-backed implementations.
 *
 * `popstate` fires for back and forward but **not** for `pushState` or
 * `replaceState`, so a location that only forwarded `popstate` would let two
 * components on one page disagree the moment either of them wrote. Writes
 * notify too.
 */
function createListeners(): {
  add(listener: () => void): () => void;
  notify(): void;
  readonly size: () => number;
} {
  const listeners = new Set<() => void>();
  return {
    add(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      // Copied, so a listener that unsubscribes during notification cannot
      // shorten the set mid-iteration and skip the next one.
      for (const listener of [...listeners]) listener();
    },
    size: () => listeners.size,
  };
}

/**
 * The default: reads nothing, writes nothing, notifies nobody.
 *
 * Every component that adopts the seam works with this in place — which is the
 * test that the seam is genuinely optional. If a component only behaves
 * correctly with a real location wired up, it has made routing mandatory
 * through the back door.
 */
export function svNoopNavLocation(): SvNavLocation {
  return {
    kind: 'noop',
    read: () => null,
    write: () => undefined,
    subscribe: () => () => undefined,
  };
}

/**
 * Query-string state: `?tab=billing&page=3`.
 *
 * The general-purpose implementation, and the right one for anything that is one
 * of several independent pieces of state on a page. Multiple components share it
 * safely because each owns its own key.
 */
export function svQueryParamNavLocation(): SvNavLocation {
  const listeners = createListeners();
  let detach: (() => void) | null = null;

  const params = (): URLSearchParams =>
    new URLSearchParams(browserHistoryAvailable() ? window.location.search : '');

  return {
    kind: 'query',

    read(key) {
      return params().get(key);
    },

    write(key, value, mode = 'replace') {
      if (!browserHistoryAvailable()) return;

      const next = params();
      if (value === null) next.delete(key);
      else next.set(key, value);

      const query = next.toString();
      const url =
        window.location.pathname + (query ? `?${query}` : '') + window.location.hash;

      // Same URL, same history: writing it again would add a duplicate back
      // entry for a change that did not happen.
      if (url === window.location.pathname + window.location.search + window.location.hash) {
        return;
      }

      if (mode === 'push') window.history.pushState(window.history.state, '', url);
      else window.history.replaceState(window.history.state, '', url);

      listeners.notify();
    },

    subscribe(listener) {
      const remove = listeners.add(listener);

      if (browserHistoryAvailable() && !detach) {
        const onPopState = () => listeners.notify();
        window.addEventListener('popstate', onPopState);
        detach = () => window.removeEventListener('popstate', onPopState);
      }

      return () => {
        remove();
        if (listeners.size() === 0 && detach) {
          detach();
          detach = null;
        }
      };
    },
  };
}

/**
 * Hash state: `#installation`.
 *
 * ★ **The hash is one slot, so this location owns exactly one key.** That is a
 * fact about URLs, not a limitation of this implementation: `#a` and `#b` cannot
 * both be true. An accordion deep-link and an anchor rail on the same page are
 * competing for the same slot, and the honest answer is that one of them owns it
 * — which is why `boundKey` is required rather than inferred. `read` and `write`
 * ignore any other key, so a second component wired here fails visibly instead
 * of silently stealing the first one's state.
 *
 * Use it for the thing a reader would paste into a message: a section, an FAQ
 * answer. Anything else belongs in {@link svQueryParamNavLocation}.
 */
export function svHashNavLocation(boundKey: string): SvNavLocation {
  const listeners = createListeners();
  let detach: (() => void) | null = null;

  const warnForeignKey = (key: string): void => {
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      console.warn(
        `[styloviz] svHashNavLocation is bound to "${boundKey}" and was asked for ` +
          `"${key}". The hash holds one value, so one component owns it — give the ` +
          `other one svQueryParamNavLocation() instead.`,
      );
    }
  };

  return {
    kind: `hash:${boundKey}`,

    read(key) {
      if (key !== boundKey) {
        warnForeignKey(key);
        return null;
      }
      if (!browserHistoryAvailable()) return null;
      const raw = window.location.hash.replace(/^#/, '');
      if (raw === '') return null;
      // ★ The hash is typed by people and pasted from chat, so a malformed
      //   escape (`#%E0%A4`) is ordinary input. `decodeURIComponent` throws
      //   `URIError` on it — inside the `computed` of every `svNavParam` bound
      //   here — so the raw text is returned instead of taking the page down.
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    },

    write(key, value, mode = 'replace') {
      if (key !== boundKey) {
        warnForeignKey(key);
        return;
      }
      if (!browserHistoryAvailable()) return;

      const hash = value === null ? '' : `#${encodeURIComponent(value)}`;
      const url = window.location.pathname + window.location.search + hash;
      if (hash === window.location.hash) return;

      if (mode === 'push') window.history.pushState(window.history.state, '', url);
      else window.history.replaceState(window.history.state, '', url);

      listeners.notify();
    },

    subscribe(listener) {
      const remove = listeners.add(listener);

      if (browserHistoryAvailable() && !detach) {
        const onChange = () => listeners.notify();
        // Both: `hashchange` covers a user editing the address bar or following
        // a plain `#` link, `popstate` covers back and forward.
        window.addEventListener('hashchange', onChange);
        window.addEventListener('popstate', onChange);
        detach = () => {
          window.removeEventListener('hashchange', onChange);
          window.removeEventListener('popstate', onChange);
        };
      }

      return () => {
        remove();
        if (listeners.size() === 0 && detach) {
          detach();
          detach = null;
        }
      };
    },
  };
}

/**
 * Where components look for their location.
 *
 * Defaults to {@link svNoopNavLocation}, so nothing touches the URL until a
 * consumer asks. Provided once at the root, which is also what lets two
 * components share one location and stay in step.
 */
export const SV_NAV_LOCATION = new InjectionToken<SvNavLocation>('SvNavLocation', {
  providedIn: 'root',
  factory: svNoopNavLocation,
});

/**
 * Wire a location in — as a value, or as a factory when it needs injection.
 *
 * ★ **The factory form is the one a router adapter needs.** `inject()` inside
 * `read`, `write` or `subscribe` runs when a component calls them, which is
 * outside any injection context, and throws `NG0203` at interaction time rather
 * than at startup. A factory injects once, where it is legal, and the returned
 * closure uses what it captured. (The first draft of the example below got this
 * wrong, which is why the note is here rather than in a changelog.)
 *
 * @example
 * // app.config.ts — put tab, page and step state in the query string
 * providers: [provideSvNavLocation(svQueryParamNavLocation())]
 *
 * @example
 * // Your own router adapter. `@styloviz/core` cannot import `@angular/router`,
 * // which is the whole point — so this lives in your app, in fifteen lines.
 * providers: [
 *   provideSvNavLocation(() => {
 *     const router = inject(Router);
 *     return {
 *       kind: 'angular-router',
 *       read: (key) => router.parseUrl(router.url).queryParams[key] ?? null,
 *       write: (key, value, mode) => {
 *         void router.navigate([], {
 *           queryParams: { [key]: value },
 *           queryParamsHandling: 'merge',
 *           replaceUrl: mode !== 'push',
 *         });
 *       },
 *       subscribe: (fn) => { const s = router.events.subscribe(fn); return () => s.unsubscribe(); },
 *     };
 *   }),
 * ]
 */
export function provideSvNavLocation(
  location: SvNavLocation | (() => SvNavLocation),
): EnvironmentProviders {
  return makeEnvironmentProviders([
    typeof location === 'function'
      ? { provide: SV_NAV_LOCATION, useFactory: location }
      : { provide: SV_NAV_LOCATION, useValue: location },
  ]);
}

/** Options for {@link svNavParam}. */
export interface SvNavParamOptions {
  /**
   * History behaviour for writes from this parameter. Default `'replace'`.
   *
   * A single write can override it — see {@link SvNavParam.set} — for the case
   * where the same key means "the user navigated" from one call site and "the
   * view drifted" from another.
   */
  readonly mode?: SvNavWriteMode;
}

/**
 * The key a parameter is bound to.
 *
 * A plain string for state the component always owns. A function when the key
 * comes from an `input()` — which is the normal case, because **the key has to be
 * per-instance.** Two paginators on one page cannot both own `?page`, and a
 * component that hard-coded its key would make the second one a collision the
 * consumer cannot fix. `null` means "do not synchronise", which is the default a
 * component should ship: the location being wired up says the app opted in, and
 * the key says *this instance* did.
 */
export type SvNavKey = string | (() => string | null);

/** One piece of addressable state, as a signal plus a setter. */
export interface SvNavParam {
  /** The current value, `null` when the location does not hold it or no key is set. */
  readonly value: Signal<string | null>;
  /**
   * Store a value, or `null` to remove it. A no-op when not {@link addressable}.
   *
   * `mode` overrides this parameter's configured write mode for one call.
   *
   * ★ It exists because **one key can honestly have two write modes**, decided
   * per write rather than per parameter. `sv-anchor` is the case that named it:
   * reflecting the scroll position must `replace`, or the back stack fills with
   * every section the reader scrolled past — `NV-02-I3`'s defect exactly — while
   * a *click* on "API reference" in the same nav is a navigation the reader
   * expects back to undo. Same key, same parameter, two different claims about
   * what the user did, and only the call site knows which one it is.
   */
  set(value: string | null, mode?: SvNavWriteMode): void;
  /**
   * Whether this parameter actually reaches a URL — a real location is provided
   * *and* this instance has a key. A component can branch on it to skip work it
   * would only need in order to synchronise.
   */
  readonly addressable: Signal<boolean>;
}

/**
 * Bind one key of the injected location to a signal.
 *
 * Call it in a field initializer, inside an injection context:
 *
 * ```ts
 * // Key from an input, so each instance owns its own parameter.
 * urlKey = input<string | null>(null);
 * private readonly pageParam = svNavParam(() => this.urlKey(), { mode: 'push' });
 * ```
 *
 * It exists so the seven families do not each write the same `subscribe` /
 * `read` / cleanup dance seven slightly different ways.
 *
 * ── Why a `computed` over a revision counter ────────────────────────────────
 * The obvious shape — a writable signal seeded from `location.read()` and
 * updated from `subscribe` — cannot read an `input()`. A field initializer runs
 * before inputs are set, so it would capture the *default* key and bind to the
 * wrong parameter forever, silently.
 *
 * Deriving instead means the key is read at the moment the value is, so an
 * input-driven key works with no lifecycle hook, and the first read is still
 * synchronous — which is the deep-link case arriving for free. The counter is
 * what turns an imperative notification back into something a `computed` can
 * depend on.
 *
 * An external change to somebody else's key does bump the counter and recompute
 * this value, but `computed` only propagates when the result actually differs —
 * so nothing downstream wakes for a parameter that did not change.
 *
 * ── ★ A parameter is a PROJECTION, not storage ──────────────────────────────
 * `value` reads the location. It is not a cache of what was last `set`, and with
 * the no-op location in place it stays `null` no matter how often it is written.
 *
 * That is the correct shape, and getting it wrong is how the seam would stop
 * being optional. A component keeps its own state — Pagination has
 * `currentPage`, Tabs has `activeId` — and the parameter is the *projection* of
 * that state into the URL. If the parameter held the value itself, a component
 * would read its own state back out of a location that may not exist, and with
 * the default no-op it would read `null` and break. Optional means the component
 * still works when nothing is listening, so the state has to live in the
 * component and the parameter has to be a mirror.
 */
export function svNavParam(key: SvNavKey, options: SvNavParamOptions = {}): SvNavParam {
  const location = inject(SV_NAV_LOCATION);
  const mode = options.mode ?? 'replace';
  const resolveKey = typeof key === 'function' ? key : () => key;

  /** Bumped by anything that changes the location, so `value` can depend on it. */
  const revision = signal(0);

  const value = computed<string | null>(() => {
    const k = resolveKey();
    revision();
    return k === null ? null : location.read(k);
  });

  const addressable = computed(() => location.kind !== 'noop' && resolveKey() !== null);

  const unsubscribe = location.subscribe(() => revision.update((n) => n + 1));
  inject(DestroyRef).onDestroy(unsubscribe);

  return {
    value,
    addressable,
    set(next, override) {
      const k = resolveKey();
      if (k === null) return;
      location.write(k, next, override ?? mode);
      // A no-op location never notifies, so nothing would recompute without this.
      revision.update((n) => n + 1);
    },
  };
}
