import {
  svPersistState,
  svRestoreState,
  type SvRestoreReason,
  type SvRestoreSpec,
} from './persisted-state';

/**
 * ============================================================================
 *  Storage glue around the persisted-state envelope — `X-6`
 * ============================================================================
 *
 * `svPersistState` / `svRestoreState` decide what a blob MEANS. Every component
 * that keeps a layout in `localStorage` then needs the same five pieces of glue
 * around them, and each one it hand-rolls is a place to get one wrong:
 *
 *  1. **An SSR guard.** `localStorage` does not exist on the server, and merely
 *     reading the global throws a `SecurityError` in some privacy modes.
 *  2. **Legacy keys.** A renamed storage key is a lost layout unless the old
 *     key is tried — EACH old key, in order, not just the first one that holds
 *     something — and the winner is moved so the migration runs once.
 *  3. **Refusal reporting.** A refused blob falls back to defaults, which is
 *     right for the user and silent for the developer. Every refusal is
 *     returned, with the key it came from.
 *  4. **Cross-tab sync.** A `storage` event from another tab is validated like
 *     any other untrusted blob, and adopting it must not echo it back.
 *  5. **Not writing back what storage already holds.** Loading is not a
 *     change, a reset is not a change, and an adopted value is not a change.
 *
 * ★★ (5) is a BASELINE, not a one-shot "skip the next write" flag. The flag
 * version — "the next save carrying exactly this value is a no-op" — is only
 * cleared by a save of that exact value. When the value never changes (a reset
 * of a layout that was already at its default) the flag outlives the moment it
 * was set for, and swallows the user's LATER change back to that value. A
 * baseline is simply "what storage is known to represent": a save equal to it
 * is skipped, and every save that is written becomes the new baseline — so no
 * earlier call can ever suppress a real change.
 *
 * Deliberately NOT Angular: no injection, no listener. The component owns its
 * `window:storage` listener and hands the event to {@link SvPersistedStore.adopt},
 * which keeps this usable from any lifecycle and trivially testable.
 *
 * Consumers: `sv-splitter`. Widget Grid and Query Builder write the same
 * envelope through their own host-driven `serialize…`/`restore…` pair and can
 * adopt this store unchanged when they take on storage themselves.
 */

/** A stored blob that could not be applied, and where it came from. */
export interface SvPersistedStoreRefusal {
  /** The storage key the refused blob was read from. */
  readonly key: string;
  /** Machine-readable reason: `malformed`, `foreign`, `too-new` or `unmigratable`. */
  readonly reason: SvRestoreReason;
  /** One sentence, safe to show a user. */
  readonly detail: string;
}

/** What {@link SvPersistedStore.load} found. */
export interface SvPersistedStoreLoad<T> {
  /** The restored state, at the current version — or `null` when nothing restored. */
  readonly state: T | null;
  /** The key it came from: the primary key, a legacy key, or `null`. */
  readonly from: string | null;
  /** Every stored blob that was refused on the way, in the order tried. */
  readonly refusals: readonly SvPersistedStoreRefusal[];
}

/** Options for {@link svPersistedStore}. */
export interface SvPersistedStoreOptions<T> {
  /** The storage key. A function when the key is itself an input that can change. */
  readonly key: string | (() => string);
  /** The envelope schema: `kind`, `version`, `read`, and any `migrate`/`adoptLegacy`. */
  readonly spec: SvRestoreSpec<T>;
  /**
   * Keys an earlier release wrote this state under. Tried in order ONLY when the
   * primary key holds nothing; the first that restores is copied to the primary
   * key and removed. Refused ones are reported and left where they are.
   * @default []
   */
  readonly legacyKeys?: readonly string[] | (() => readonly string[]);
  /**
   * The storage to use, or `null` where there is none. The test seam, and the
   * SSR guard: the default returns `localStorage` in a browser and `null` on the
   * server or when access to it throws.
   */
  readonly storage?: () => Storage | null;
}

/** A versioned, SSR-safe, cross-tab-aware home for one piece of state. */
export interface SvPersistedStore<T> {
  /**
   * Read the stored state: the primary key, else each legacy key in order.
   * The result becomes the baseline, so the first save of the same value is
   * not written back.
   */
  load(): SvPersistedStoreLoad<T>;
  /**
   * Write `state` in its envelope — unless storage already represents exactly
   * this value (the baseline), in which case nothing is written. `false` when
   * storage is unavailable or refused the write (quota, privacy mode).
   */
  save(state: T): boolean;
  /**
   * Declare that storage already represents `state` without writing it — what
   * a component calls after a load that restored nothing, so its defaults are
   * not written over a blob it refused (a newer release's, say).
   */
  markSynced(state: T): void;
  /**
   * Remove the stored value. `represents` is what an empty key now means (the
   * default the component resets to), so saving that default is not written
   * straight back; the next different value is.
   */
  clear(represents?: T): void;
  /**
   * Validate another tab's write. Returns the state to apply, or `null` when
   * the event is for another key or storage area, is a removal, or is refused.
   * An adopted value becomes the baseline, so applying it does not echo back.
   */
  adopt(event: StorageEvent): T | null;
}

function defaultStorage(): Storage | null {
  return svLocalStorage();
}

/**
 * `localStorage`, or `null` when there is none (a server) or it is blocked.
 *
 * ★★ USE THIS, NOT `typeof localStorage === 'undefined'`. With site data
 *    blocked, evaluating the global — `typeof` included — throws a
 *    `SecurityError`, so a guard written that way is itself the crash
 *    (1.0 audit, M4: stepper, product tour and widget grid all had it).
 */
export function svLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Create a store for one piece of versioned state. See the file header. */
export function svPersistedStore<T>(options: SvPersistedStoreOptions<T>): SvPersistedStore<T> {
  const { spec, storage = defaultStorage } = options;
  const keyOf = (): string => (typeof options.key === 'function' ? options.key() : options.key);
  const legacyOf = (): readonly string[] => {
    const legacy = options.legacyKeys;
    return (typeof legacy === 'function' ? legacy() : legacy) ?? [];
  };

  /**
   * The serialized value storage is known to represent — and UNDER WHICH KEY.
   *
   * ★ Keyed, because the key can change (`persistKey` bound to an account id):
   *   a bare value made a save under a new key look "already written" whenever
   *   the layout happened to match, so nothing ever reached the new key.
   */
  let baseline: { key: string; value: string } | null = null;
  const synced = (key: string, value: string): boolean =>
    baseline !== null && baseline.key === key && baseline.value === value;

  const serialize = (state: T): string =>
    JSON.stringify(svPersistState(spec.kind, spec.version, state));

  /** `null` for absent, unparseable or unavailable — none is a refusal worth reporting. */
  const readJson = (store: Storage, key: string): unknown => {
    try {
      const raw = store.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  };

  const write = (store: Storage, key: string, serialized: string): boolean => {
    try {
      store.setItem(key, serialized);
      return true;
    } catch {
      return false; // quota / privacy mode
    }
  };

  const remove = (store: Storage, key: string): void => {
    try { store.removeItem(key); } catch { /* storage unavailable */ }
  };

  return {
    load() {
      const store = storage();
      const key = keyOf();
      const refusals: SvPersistedStoreRefusal[] = [];
      if (!store || !key) return { state: null, from: null, refusals };

      const primary = readJson(store, key);
      if (primary !== null) {
        const restored = svRestoreState(primary, spec);
        if (!restored.ok) {
          refusals.push({ key, reason: restored.reason, detail: restored.detail });
          return { state: null, from: null, refusals };
        }
        baseline = { key, value: serialize(restored.state) };
        return { state: restored.state, from: key, refusals };
      }

      // ★ EACH legacy key, in order: an unreadable one is reported and skipped,
      //   not the end of the search.
      for (const legacy of legacyOf()) {
        if (!legacy || legacy === key) continue;
        const blob = readJson(store, legacy);
        if (blob === null) continue;
        const restored = svRestoreState(blob, spec);
        if (!restored.ok) {
          refusals.push({ key: legacy, reason: restored.reason, detail: restored.detail });
          continue;
        }
        const serialized = serialize(restored.state);
        if (write(store, key, serialized)) {
          baseline = { key, value: serialized };
          remove(store, legacy);
        }
        return { state: restored.state, from: legacy, refusals };
      }
      return { state: null, from: null, refusals };
    },

    save(state) {
      const serialized = serialize(state);
      const key = keyOf();
      if (synced(key, serialized)) return true;
      const store = storage();
      if (!store || !key) return false;
      if (!write(store, key, serialized)) return false;
      baseline = { key, value: serialized };
      return true;
    },

    markSynced(state) {
      baseline = { key: keyOf(), value: serialize(state) };
    },

    clear(represents) {
      const store = storage();
      const key = keyOf();
      if (store && key) remove(store, key);
      baseline = represents === undefined ? null : { key, value: serialize(represents) };
    },

    adopt(event) {
      const key = keyOf();
      if (!key || event.key !== key) return null;
      const store = storage();
      if (store && event.storageArea && event.storageArea !== store) return null;
      // ★ Another tab removed the value (its reset): storage no longer holds
      //   our baseline, so the next save must write even if it matches.
      if (event.newValue === null) {
        baseline = null;
        return null;
      }
      let blob: unknown;
      try { blob = JSON.parse(event.newValue) as unknown; } catch { return null; }
      const restored = svRestoreState(blob, spec);
      if (!restored.ok) return null;
      baseline = { key, value: serialize(restored.state) };
      return restored.state;
    },
  };
}
