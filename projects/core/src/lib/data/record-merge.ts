/**
 * record-merge.ts — identity, version and order for a list that arrives in
 * pieces (`X-12`, `OF-10-M1`, `OF-10-M5`).
 *
 * ★★★ EVERY REALTIME LIST IN A DASHBOARD HAS THE SAME FOUR QUESTIONS, AND
 *     WRITING THEM PER FEATURE MEANS WRITING THEM WRONG SOMEWHERE: which
 *     record is this one (identity), is what just arrived NEWER than what I
 *     have (version), are these two rows the same event (deduplication), and
 *     what order do they go in (sequence). A notification centre asks all
 *     four; so does an activity feed, an audit log and an inbox.
 *
 * ★★ PURE ARITHMETIC ON ARRAYS — no Angular, no DOM, no signals. That is what
 *    lets it be tested exhaustively (`.node.spec.ts`) and used from a host's
 *    own store, which is where a realtime list actually lives. The components
 *    take `[items]` as an INPUT: merging is the host's job, and this is the
 *    thing the host would otherwise have to get right alone.
 */

/** The shape a mergeable record has to have. Everything but `id` is optional. */
export interface SvMergeableRecord {
  /** Stable server identity. Two records with the same `id` are one record. */
  readonly id: string;
  /**
   * Monotonic per-record revision. A lower one is stale and is rejected.
   *
   * ★ WITHOUT THIS A STALE UPDATE CANNOT BE DETECTED AT ALL, which is the
   *   finding: an out-of-order delivery — two sockets, a retry, a replay after
   *   a reconnect — overwrote a newer row with an older copy of itself, and
   *   the row silently went backwards in time.
   */
  readonly version?: number;
  /**
   * Monotonic position in the STREAM, not in this record's history.
   *
   * ★★ A DIFFERENT AXIS FROM `version`, and both are needed. `version` orders
   *    a record against its own past; `seq` orders records against each other
   *    when timestamps tie or the clocks disagree — which they do, because
   *    `timestamp` is a string somebody's server rendered.
   */
  readonly seq?: number;
  /** ISO timestamp. The ordering fallback when the stream has no `seq`. */
  readonly timestamp?: string;
  /**
   * Two records with the same key are the same EVENT and collapse into one.
   *
   * ★ Different from `id`, which is the same RECORD. Three comments on one
   *   ticket are three records and, for a notification list, one event.
   */
  readonly dedupeKey?: string;
  /** Pinned records sort before everything else, whatever the order rule. */
  readonly pinned?: boolean;
}

/** What {@link svMergeRecords} did, for a host that wants to react to it. */
export interface SvMergeReport<T> {
  /** The merged list, ordered by {@link svOrderRecords}. */
  readonly items: readonly T[];
  /** Records that were not present before. */
  readonly added: readonly T[];
  /** Records that replaced an existing one. */
  readonly updated: readonly T[];
  /**
   * Records refused as STALE — an equal or lower `version` than the copy held.
   *
   * ★ Reported rather than swallowed. A stream that keeps delivering stale
   *   revisions is a bug in something, and the only party that can see the
   *   pattern is the host.
   */
  readonly rejected: readonly T[];
  /**
   * Records dropped because another record shares their `dedupeKey`.
   *
   * ★ No count is written onto the survivor. A collapsed group's headline is
   *   copy — "3 new comments on TICKET-14" — and copy is the host's, not a
   *   number this function can invent a wording for. The dropped records are
   *   handed back so the host can write it.
   */
  readonly collapsed: readonly T[];
}

/** Options for {@link svMergeRecords}. */
export interface SvMergeOptions {
  /**
   * Collapse records that share a `dedupeKey`. @default true
   *
   * ★ On by default, because a `dedupeKey` is only ever set deliberately: a
   *   record that carries one is asking to be collapsed.
   */
  readonly collapse?: boolean;
}

const MISSING_TIME = Number.NEGATIVE_INFINITY;

/** Epoch ms, or `-Infinity` for a missing or unparseable timestamp. */
function timeOf(record: SvMergeableRecord): number {
  const raw = record.timestamp;
  if (!raw) return MISSING_TIME;
  const ms = new Date(raw).getTime();
  // ★★ `NaN` IS THE WHOLE REASON THIS FUNCTION EXISTS. `new Date('n/a')`
  //    gives an Invalid Date, whose `getTime()` is NaN, and a comparator that
  //    returns NaN makes the sort's result implementation-defined — rows
  //    change places between two renders of the same data. One unparsed
  //    timestamp from one integration was enough. Undated records sort last,
  //    which is at least a decision.
  return Number.isNaN(ms) ? MISSING_TIME : ms;
}

/**
 * Order a list: pinned first, then newest first, then by id.
 *
 * ★★★ `seq` IS USED ONLY WHEN EVERY RECORD HAS ONE, and this is deliberate
 *     rather than lenient. Deciding per PAIR — "use seq if both have it, else
 *     timestamp" — builds an intransitive comparator: a beats b on seq, b
 *     beats c on timestamp, and c beats a. A sort given an intransitive
 *     comparator does not merely order things oddly; it produces a different
 *     answer depending on the array's starting arrangement. A sequence is a
 *     property of the STREAM, so it is decided once for the list.
 *
 * ★ The final tiebreak is `id`, so two records that are equal by every other
 *   measure still have ONE order. Without it, "equal" rows swap places
 *   whenever anything else about the list changes, and a user watching a live
 *   list sees rows twitch.
 */
export function svOrderRecords<T extends SvMergeableRecord>(
  records: readonly T[],
): readonly T[] {
  const sequenced = records.length > 0 && records.every((r) => typeof r.seq === 'number');
  return [...records].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (sequenced) {
      const bySeq = (b.seq as number) - (a.seq as number);
      if (bySeq !== 0) return bySeq;
    } else {
      const byTime = timeOf(b) - timeOf(a);
      if (byTime !== 0) return byTime;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Is `incoming` newer than `held`?
 *
 * ★★ THE ASYMMETRY IS THE DECISION. Both versioned: higher wins, and EQUAL
 *    loses — a redelivery of the same revision is not news, and accepting it
 *    would replace the object for no reason, which re-renders a row the user
 *    may be interacting with.
 *
 * ★ Incoming with no version wins. "No version" means the source does not
 *   version, not that the record is old — refusing it would freeze that row
 *   for the life of the session. Held-without-version, incoming-with: the
 *   incoming wins too, for the same reason read the other way.
 */
function isNewer(incoming: SvMergeableRecord, held: SvMergeableRecord): boolean {
  if (typeof incoming.version !== 'number') return true;
  if (typeof held.version !== 'number') return true;
  return incoming.version > held.version;
}

/**
 * Fold `incoming` into `current`: same id replaces (if newer), new id adds,
 * shared `dedupeKey` collapses, and the result is ordered.
 *
 * ★ `current` is not mutated, and neither are the records. The result is a new
 *   array of the same object references wherever nothing changed, so a
 *   `track`-by-identity render only re-creates the rows that actually moved.
 */
export function svMergeRecords<T extends SvMergeableRecord>(
  current: readonly T[],
  incoming: readonly T[],
  options: SvMergeOptions = {},
): SvMergeReport<T> {
  const byId = new Map<string, T>();
  // ★★ A duplicate id inside `current` is not the host being careless — it is
  //    what a naive append produces, and Angular's `@for` THROWS on a
  //    duplicate track key, so the list is already unrenderable by the time it
  //    reaches here. Collapsing it is therefore not tidying: it is the
  //    difference between a panel and an exception.
  //
  // ★ The same version rule decides which copy survives, rather than "last
  //   wins": a replay that appended an older revision after a newer one is the
  //   exact case this function exists for, and position is not evidence.
  for (const record of current) {
    const held = byId.get(record.id);
    if (!held || isNewer(record, held)) byId.set(record.id, record);
  }

  const added:    T[] = [];
  const updated:  T[] = [];
  const rejected: T[] = [];

  for (const record of incoming) {
    const held = byId.get(record.id);
    if (!held) {
      byId.set(record.id, record);
      added.push(record);
      continue;
    }
    if (!isNewer(record, held)) {
      rejected.push(record);
      continue;
    }
    byId.set(record.id, record);
    updated.push(record);
  }

  const ordered = svOrderRecords([...byId.values()]);

  if (options.collapse === false) {
    return { items: ordered, added, updated, rejected, collapsed: [] };
  }

  // ★ Collapse AFTER ordering, so the survivor is the first in the order the
  //   user will see — the newest, or the pinned one — rather than whichever
  //   arrived first.
  const seen = new Set<string>();
  const kept: T[] = [];
  const collapsed: T[] = [];
  for (const record of ordered) {
    const key = record.dedupeKey;
    if (key === undefined) {
      kept.push(record);
      continue;
    }
    if (seen.has(key)) {
      collapsed.push(record);
      continue;
    }
    seen.add(key);
    kept.push(record);
  }

  return { items: kept, added, updated, rejected, collapsed };
}
