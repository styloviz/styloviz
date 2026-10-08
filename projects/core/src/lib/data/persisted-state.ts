declare const ngDevMode: boolean | undefined;

/**
 * A blob the host has stored, and the schema it was written against.
 *
 * Six families in the kit hand the host state to keep — a dashboard layout, a
 * table's columns, a saved pivot view, a query, a set of facets, a project plan.
 * Every one of them was handed over as a bare object, which is a migration
 * nobody has written yet: the first release that renames a field reads the old
 * blob as if it were the new one, and a user's saved dashboard comes back
 * subtly wrong with nothing reported.
 *
 * The envelope is deliberately the smallest thing that fixes that. `kind` says
 * whose it is, `version` says which schema, `state` is the payload — and the
 * component that wrote it is the only thing that gets to interpret it.
 */
export interface SvPersistedState<T> {
  /** Who wrote it: `'sv-widget-grid/layout'`. Namespaced by selector. */
  readonly kind: string;
  /** The schema version. Integer, starts at 1, bumped on any breaking change. */
  readonly version: number;
  /** The state itself. Must be JSON-safe — see {@link svPersistState}. */
  readonly state: T;
}

/** Why a stored blob could not be restored. */
export type SvRestoreReason =
  /** Not an envelope, and not adoptable as a pre-envelope blob either. */
  | 'malformed'
  /** An envelope, but another component's — a query pasted into a table. */
  | 'foreign'
  /** Written by a later release of the kit than the one reading it. */
  | 'too-new'
  /** Older, and the component offers no way to bring it forward. */
  | 'unmigratable';

/** The outcome of {@link svRestoreState}. */
export type SvRestoreResult<T> =
  | {
      readonly ok: true;
      /** The state, at the current version. */
      readonly state: T;
      /**
       * The version it was stored at. `0` means a pre-envelope blob that
       * {@link SvRestoreSpec.adoptLegacy} accepted. When this is below the
       * component's current version the host should re-save, or every load pays
       * the migration again.
       */
      readonly from: number;
    }
  | {
      readonly ok: false;
      readonly reason: SvRestoreReason;
      /** One sentence, safe to show a user. */
      readonly detail: string;
    };

/** How a component reads its own stored state back. */
export interface SvRestoreSpec<T> {
  /** Must equal the `kind` the component writes. */
  readonly kind: string;
  /** The schema version the component understands now. */
  readonly version: number;
  /**
   * Parse a payload written at the current `version`, or return `null` if it is
   * not one.
   *
   * ★ Required, not optional, because the alternative is a cast — and what comes
   *   back out of `localStorage` or a URL is whatever anyone with devtools
   *   decided to put there. A matching `kind` and `version` say which schema the
   *   payload CLAIMS; only this says it holds.
   */
  readonly read: (state: unknown) => T | null;
  /**
   * Bring a `from`-version payload up to `version`, or return `null` when it
   * cannot be brought forward. Only called for `from < version`, and responsible
   * for validating what it reads exactly as `read` is.
   *
   * Written by the component, not the host: the component owns the schema, and
   * a host asked to migrate a shape it did not design will guess.
   */
  readonly migrate?: (state: unknown, from: number) => T | null;
  /**
   * What to do with a blob that has no envelope at all.
   *
   * Not hypothetical, and the reason `from` can be `0`: every one of these
   * families shipped its state bare before this contract existed, so there are
   * stored dashboards and saved views in the wild with no `kind` and no
   * `version`. Return `0` to hand the whole blob to `migrate` as the
   * pre-versioning shape, or `null` to refuse it.
   *
   * A component that never shipped an unversioned form must leave this out. A
   * blanket "assume it is current" would make `malformed` unreachable and let
   * any object at all through.
   */
  readonly adoptLegacy?: (blob: Readonly<Record<string, unknown>>) => number | null;
}

/**
 * Wrap state for the host to store.
 *
 * The state must survive `JSON.stringify` → `JSON.parse` unchanged, which is
 * the one rule the type system will not enforce for you: a `Set` becomes `{}`,
 * a `Map` becomes `{}`, and a function member — `rollback` on an event payload
 * — vanishes without a word. So a component serializes a SNAPSHOT type of its
 * own, never the event payload it happens to have to hand.
 * `scripts/check-persisted-state.mjs` holds that line.
 */
export function svPersistState<T>(kind: string, version: number, state: T): SvPersistedState<T> {
  return { kind, version, state };
}

/**
 * Read stored state back, or say precisely why it cannot be.
 *
 * ★ A blob from a NEWER version is refused, not read as far as it parses. This
 *   is the case a "best effort" restore gets wrong: the same field name means
 *   something different in v3, so a partial read does not fail — it silently
 *   produces a layout the user never arranged. Someone who arranges their
 *   dashboard in the current release and then loads last month's build on
 *   another machine should get their default view and a sentence saying why,
 *   not a mangled one.
 *
 * The host's side of this is three lines:
 *
 * ```ts
 * const restored = grid.restoreLayout(JSON.parse(raw));
 * if (!restored.ok) this.notice.set(restored.detail);
 * else if (restored.from < SV_WIDGET_GRID_LAYOUT_VERSION) this.save(grid.serializeLayout());
 * ```
 *
 * @param blob Whatever came out of storage. Untrusted: any shape, or none.
 */
export function svRestoreState<T>(blob: unknown, spec: SvRestoreSpec<T>): SvRestoreResult<T> {
  const { kind, version, adoptLegacy } = spec;

  if (!blob || typeof blob !== 'object' || Array.isArray(blob)) {
    return { ok: false, reason: 'malformed', detail: 'The saved data is not readable.' };
  }

  const record = blob as Record<string, unknown>;
  const envelope = typeof record['kind'] === 'string' && typeof record['version'] === 'number';

  if (!envelope) {
    const from = adoptLegacy?.(record) ?? null;
    if (from === null) {
      return {
        ok: false,
        reason: 'malformed',
        detail: 'The saved data does not say what wrote it, so it cannot be trusted.',
      };
    }
    return readAt(record, from, spec);
  }

  if (record['kind'] !== kind) {
    return {
      ok: false,
      reason: 'foreign',
      detail: `That saved data belongs to ${String(record['kind'])}, not ${kind}.`,
    };
  }

  const from = record['version'] as number;
  if (!Number.isInteger(from) || from < 1) {
    return { ok: false, reason: 'malformed', detail: 'The saved data has no usable version.' };
  }
  if (from > version) {
    return {
      ok: false,
      reason: 'too-new',
      detail:
        `That view was saved by a newer version of this component (v${from}, this is v${version}), ` +
        'so it cannot be read here.',
    };
  }

  return readAt(record['state'], from, spec);
}

function readAt<T>(state: unknown, from: number, spec: SvRestoreSpec<T>): SvRestoreResult<T> {
  if (from === spec.version) {
    const parsed = spec.read(state);
    return parsed === null
      ? { ok: false, reason: 'malformed', detail: 'The saved data is not in the expected shape.' }
      : { ok: true, state: parsed, from };
  }

  const migrated = spec.migrate?.(state, from) ?? null;
  if (migrated === null) {
    return {
      ok: false,
      reason: 'unmigratable',
      detail: `That view was saved in an older format (v${from}) that can no longer be read.`,
    };
  }
  return { ok: true, state: migrated, from };
}

/** How a component reads its own state back out of a URL. */
export interface SvRestoreParamsSpec<T> {
  /** The parameter carrying the schema version: `'fv'`. */
  readonly versionParam: string;
  /** The schema version the component writes now. */
  readonly version: number;
  /**
   * Read parameters written at `from` (always below `version`), or `null` when
   * they cannot be brought forward.
   */
  readonly migrate?: (params: URLSearchParams, from: number) => T | null;
  /**
   * The version to read a link that carries no version parameter as, or `null`
   * to ignore its filters entirely. Links predating the version parameter are
   * already pasted into other people's chat windows, so this is the case that
   * actually happens.
   */
  readonly legacyVersion?: number | null;
}

/**
 * The same versioning contract over URL query parameters, for state whose whole
 * point is being shareable.
 *
 * A filtered listing has to survive being pasted into a chat window, so it
 * belongs in the URL rather than in storage — and a URL is read by people, so
 * base64-ing an envelope into one parameter is the wrong answer. The component
 * writes readable parameters plus one version parameter instead, and this
 * decides whether they can be trusted before `read` is ever called, so `read`
 * never has to guess which release wrote them.
 *
 * There is no `kind` here: a URL is scoped by its route already, and a second
 * component on the same page namespaces its own parameter names.
 *
 * @param params What came in from `location.search`. Untrusted.
 * @param read   Builds the state from parameters known to be current.
 */
export function svRestoreParams<T>(
  params: URLSearchParams,
  spec: SvRestoreParamsSpec<T>,
  read: (params: URLSearchParams) => T,
): SvRestoreResult<T> {
  const { versionParam, version, migrate, legacyVersion } = spec;
  const raw = params.get(versionParam);

  let from: number;
  if (raw === null) {
    if (legacyVersion == null) {
      return {
        ok: false,
        reason: 'malformed',
        detail: 'That link does not say which version of the filters it holds.',
      };
    }
    from = legacyVersion;
  } else {
    from = Number(raw);
    if (!Number.isInteger(from) || from < 1) {
      return { ok: false, reason: 'malformed', detail: 'That link has no usable version.' };
    }
  }

  if (from > version) {
    return {
      ok: false,
      reason: 'too-new',
      detail:
        `That link was made by a newer version of this page (v${from}, this is v${version}), ` +
        'so its filters cannot be applied.',
    };
  }
  if (from === version) return { ok: true, state: read(params), from };

  const migrated = migrate?.(params, from) ?? null;
  if (migrated === null) {
    return {
      ok: false,
      reason: 'unmigratable',
      detail: `That link uses an older format (v${from}) that can no longer be read.`,
    };
  }
  return { ok: true, state: migrated, from };
}

/**
 * Warn, in dev mode only, that a restore was refused.
 *
 * A refused restore is silent by design — the component shows its default view,
 * which is the correct thing for the user to see. But during development that
 * looks exactly like the restore never being wired up, so this says which it
 * was.
 */
export function svWarnRestoreRefused(selector: string, result: { ok: false; reason: SvRestoreReason; detail: string }): void {
  if (typeof ngDevMode !== 'undefined' && ngDevMode) {
    console.warn(`[styloviz] ${selector}: saved state ignored (${result.reason}) — ${result.detail}`);
  }
}
