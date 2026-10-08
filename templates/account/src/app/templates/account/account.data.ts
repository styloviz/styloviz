import {
  inject,
  linkedSignal,
  Injector,
  PendingTasks,
  runInInjectionContext,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  createArrayDataSource,
  createHttpDataSource,
  withLatency,
  offsetLimitQuery,
  type SvDataSource,
  type SvQueryMapper,
} from '@styloviz/data';
import { toSvDataError, type SvDataError } from '@styloviz/core';
import { ACCOUNT_API } from './account.config';

/**
 * ============================================================
 *  Account Template — the one place data comes from
 * ============================================================
 *  Same shape as the admin template's `admin.data.ts` (see that file for the
 *  full rationale), trimmed to what this smaller template needs: a
 *  collection source for the team list, and a single editable record for
 *  profile/security/notifications. Point `ACCOUNT_API.baseUrl` in
 *  `account.config.ts` at your backend and both pages start talking to it —
 *  there is no second edit.
 * ============================================================
 */

function endpoint(path: string): string {
  const base = ACCOUNT_API.baseUrl.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

/** Whether a real backend is configured. Handy for demo-only affordances. */
export function isAccountWired(): boolean {
  return ACCOUNT_API.baseUrl !== '';
}

/**
 * The data source for one collection (e.g. team members).
 *
 * Call it from a field initializer so `inject()` resolves; pass an
 * `Injector` when you cannot.
 */
export function accountSource<T>(
  path: string,
  fixture: readonly T[],
  mapQuery: SvQueryMapper = offsetLimitQuery(),
  injector?: Injector,
): SvDataSource<T> {
  if (ACCOUNT_API.baseUrl) {
    const build = () => createHttpDataSource<T>({ url: endpoint(path), mapQuery });
    return injector ? runInInjectionContext(injector, build) : build();
  }
  return withLatency(
    createArrayDataSource<T>(fixture),
    () => ACCOUNT_API.demoLatencyMs,
  );
}

/** What a page needs from a single fetched payload, and nothing more. */
export interface SvAccountResource<T> {
  readonly value: Signal<T | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<SvDataError | null>;
  readonly version: Signal<number>;
  reload(): void;
}

/**
 * One fetch, one payload. Until `ACCOUNT_API.baseUrl` is set it resolves the
 * bundled fixture through the same code path, after `demoLatencyMs` — so the
 * loading state is reachable in the demo rather than a state nobody has seen.
 */
function accountResource<T>(
  path: string,
  fixture: T,
  injector?: Injector,
): SvAccountResource<T> {
  const value = signal<T | null>(null);
  const loading = signal(false);
  const error = signal<SvDataError | null>(null);
  const version = signal(0);

  const http = ACCOUNT_API.baseUrl
    ? injector
      ? runInInjectionContext(injector, () => inject(HttpClient))
      : inject(HttpClient)
    : null;

  /**
   * The app is zoneless, so the latency timer below is invisible to Angular:
   * without this the page counts as settled while the payload is still
   * outstanding, and prerendering serialises the skeleton instead of the data.
   * Same wiring, same reason, as `admin.data.ts`.
   */
  const pendingTasks = injector
    ? runInInjectionContext(injector, () => inject(PendingTasks))
    : inject(PendingTasks);

  // Monotonic, so a slow first request cannot overwrite the reload that
  // replaced it.
  let token = 0;

  async function fetchOnce(): Promise<void> {
    const mine = ++token;
    loading.set(true);
    error.set(null);
    try {
      const body = http
        ? await firstValueFrom(http.get<T>(endpoint(path)))
        : await new Promise<T>((r) =>
            setTimeout(() => r(fixture), ACCOUNT_API.demoLatencyMs),
          );
      if (mine !== token) return;
      value.set(body);
      version.update((n) => n + 1);
    } catch (e) {
      if (mine !== token) return;
      // Keep whatever was already loaded — a page that blanks on a failed
      // refresh is worse than one showing figures a minute old and saying so.
      error.set(toSvDataError(e));
    } finally {
      if (mine === token) loading.set(false);
    }
  }

  // `add()` + try/finally, NOT `run()`: PendingTasks.run() is developer-preview
  // and returns void, so awaiting it resolves immediately and registers nothing.
  const run = async (): Promise<void> => {
    const done = pendingTasks.add();
    try {
      await fetchOnce();
    } finally {
      done();
    }
  };

  void run();

  return {
    value: value.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    version: version.asReadonly(),
    reload: () => void run(),
  };
}

/** A payload the page both loads and mutates in place. */
export interface SvAccountRecord<T> extends SvAccountResource<T> {
  readonly value: WritableSignal<T | null>;
  /** Keys with a write in flight — bind to disable the control being changed. */
  readonly pending: Signal<readonly string[]>;
  readonly writeError: Signal<SvDataError | null>;
  clearWriteError(): void;
  /**
   * Apply `change` immediately, run `write`, and put the record back if the
   * write rejects. Optimistic, because a toggle that waits for the round
   * trip reads as broken and gets pressed twice.
   */
  commit(id: string, change: (current: T) => T, write: () => Promise<unknown>): Promise<void>;
}

/** `accountResource`, for a page that edits what it loaded. */
export function accountRecord<T>(
  path: string,
  fixture: T,
  injector?: Injector,
): SvAccountRecord<T> {
  const base = accountResource<T>(path, fixture, injector);

  // linkedSignal, not signal: a plain one would latch `null` from the first
  // frame and never see the payload land. Keyed off `version`, not
  // `base.value`, so the reset happens once per *fetch*, not once per
  // changed object — a re-served fixture is not a signal change.
  const value = linkedSignal<number, T | null>({
    source: base.version,
    computation: () => untracked(base.value),
  });

  const pending = signal<readonly string[]>([]);
  const writeError = signal<SvDataError | null>(null);
  let seq = 0;

  async function commit(
    id: string,
    change: (current: T) => T,
    write: () => Promise<unknown>,
  ): Promise<void> {
    const before = value();
    if (before === null) return;

    const mine = ++seq;
    value.set(change(before));
    pending.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
    writeError.set(null);

    try {
      await write();
    } catch (e) {
      writeError.set(toSvDataError(e));
      if (mine === seq) {
        value.set(before);
      }
    } finally {
      pending.update((ids) => ids.filter((x) => x !== id));
    }
  }

  return {
    ...base,
    value,
    pending: pending.asReadonly(),
    writeError: writeError.asReadonly(),
    clearWriteError: () => writeError.set(null),
    commit,
  };
}

/** Update one record. PATCH, not PUT — see `admin.data.ts` for why. */
export async function accountUpdate<T>(
  path: string,
  id: string | number,
  changes: Partial<T>,
  injector?: Injector,
): Promise<void> {
  if (!ACCOUNT_API.baseUrl) {
    await new Promise((r) => setTimeout(r, ACCOUNT_API.demoLatencyMs));
    return;
  }
  const patch = () => inject(HttpClient).patch(endpoint(`${path}/${id}`), changes);
  const request$ = injector ? runInInjectionContext(injector, patch) : patch();
  await firstValueFrom(request$);
}

/**
 * POST one action and resolve with what the server answered.
 *
 * `demo` builds the answer the fixtures flow returns until `ACCOUNT_API.baseUrl`
 * is set — so an invite comes back as a member and a regeneration comes back
 * with codes, rather than as `undefined` the page has to special-case.
 */
export async function accountPost<R>(
  path: string,
  body: unknown,
  demo: () => R,
  injector?: Injector,
): Promise<R> {
  if (!ACCOUNT_API.baseUrl) {
    await new Promise((r) => setTimeout(r, ACCOUNT_API.demoLatencyMs));
    return demo();
  }
  const post = () => inject(HttpClient).post<R>(endpoint(path), body);
  const request$ = injector ? runInInjectionContext(injector, post) : post();
  return firstValueFrom(request$);
}

/** Delete one record. */
export async function accountDelete(
  path: string,
  id: string | number,
  injector?: Injector,
): Promise<void> {
  if (!ACCOUNT_API.baseUrl) {
    await new Promise((r) => setTimeout(r, ACCOUNT_API.demoLatencyMs));
    return;
  }
  const remove = () => inject(HttpClient).delete(endpoint(`${path}/${id}`));
  const request$ = injector ? runInInjectionContext(injector, remove) : remove();
  await firstValueFrom(request$);
}
