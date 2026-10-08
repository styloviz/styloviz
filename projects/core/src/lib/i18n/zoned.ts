/**
 * Putting a calendar date and a wall-clock time together, in a real timezone.
 *
 * ── The defect this exists for (`FI-28-I2` / `FI-28-M2`) ────────────────────
 *
 * ★★★ `sv-date-picker` HOLDS A CALENDAR DATE AND `sv-time-picker` HOLDS A
 *     WALL-CLOCK TIME. Neither is an instant, and the kit said so about
 *     neither — so a host composing the two reached for
 *     `new Date(\`${date}T${time}\`)`, which is an instant in the BROWSER'S
 *     zone, silently, and a booking made in London reads an hour out in Dublin.
 *
 * ★★★ AND THE COMPOSITION IS NOT ALWAYS POSSIBLE. A wall-clock time is not a
 *     bijection with an instant twice a year:
 *
 *       • **The gap.** London, 2026-03-29: the clocks go 01:00 → 02:00, so
 *         **01:30 does not exist that day**. `new Date('2026-03-29T01:30')`
 *         does not throw — it silently returns 02:30, an hour the user did not
 *         choose, and the appointment moves.
 *       • **The overlap.** London, 2026-10-25: the clocks go 02:00 → 01:00, so
 *         **01:30 happens twice**, an hour apart. One of them is right and the
 *         constructor picks one without telling you which.
 *
 * ★★ THE TRANSITION IS NOT ALWAYS AN HOUR. Measured for 2026:
 *      Europe/London     2026-03-29T01:00Z  +0 → +60    (gap 01:00–01:59)
 *      America/New_York  2026-03-08T07:00Z  -300 → -240 (gap 02:00–02:59)
 *      Australia/Lord_Howe 2026-10-03T15:30Z +630 → +660  — **a 30-MINUTE gap,
 *        02:00–02:29** — and 2026-04-04T15:00Z +660 → +630, a 30-minute overlap.
 *    Any implementation that assumes a one-hour shift is wrong on Lord Howe and
 *    nowhere else, which is exactly the kind of wrong that ships.
 *
 * ── ★★★ WHY THERE IS NO TIMEZONE DATABASE HERE ─────────────────────────────
 *
 * `Intl.DateTimeFormat` already carries the IANA rules the platform ships and
 * keeps updated. The only thing missing is the inverse direction — wall clock
 * back to instant — and that is arithmetic over two probes, not data. A bundled
 * offset table would be wrong the first time a government moves a transition,
 * which several do every year and usually at short notice.
 */

/**
 * The UTC offset in effect at `instant`, in minutes EAST of UTC.
 *
 * `+330` is Asia/Kolkata, `-300` is New York in winter — the opposite sign
 * convention from `Date#getTimezoneOffset()`, and deliberately so: this returns
 * what the zone's name means ("UTC+05:30"), rather than what has to be
 * subtracted to get back to UTC.
 *
 * ★ Reads the parts back out of a formatter and re-assembles them as if they
 *   were UTC. The difference between that and the real instant IS the offset;
 *   there is no API that reports it directly.
 */
/**
 * One formatter per zone, kept.
 *
 * ★★★ `new Intl.DateTimeFormat` IS THE EXPENSIVE PART OF THIS FILE, BY A LARGE
 *     MARGIN — it resolves a locale and loads the zone's transition table — and
 *     it was being constructed on **every call**. `svComposeDateTime` probes
 *     the offset several times per composition, so a calendar laying out a
 *     month of slots built hundreds of them to answer a question whose answer
 *     was already in the first one.
 *
 * ★ Safe to share: `formatToParts` is pure, the instance carries no per-call
 *   state, and the options are fixed here rather than taken from the caller.
 *   Same shape as `VALUE_CACHE` in `digits.ts`.
 *
 * ⚠️ Unbounded in principle and bounded in practice: the key space is the IANA
 *    zone list (~600), an application uses a handful of them, and the values
 *    are shared platform objects. There is no eviction because there is nothing
 *    to evict — a cache that can hold every possible key is not a leak.
 */
const ZONE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = ZONE_FORMATTERS.get(timeZone);
  if (cached !== undefined) return cached;

  const made = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  ZONE_FORMATTERS.set(timeZone, made);
  return made;
}

export function svZoneOffsetMinutes(instant: Date | number, timeZone: string): number {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  const parts = zoneFormatter(timeZone).formatToParts(new Date(ms));

  const f: Record<string, string> = {};
  for (const p of parts) f[p.type] = p.value;

  // ⚠️ `hourCycle: 'h23'` and not `hour12: false`. The latter still yields "24"
  //    for midnight on some ICU builds, which reassembles as the next day and
  //    puts the offset out by 24 hours for exactly one minute a day.
  const asIfUtc = Date.UTC(
    Number(f['year']), Number(f['month']) - 1, Number(f['day']),
    Number(f['hour']), Number(f['minute']), Number(f['second']),
  );
  return Math.round((asIfUtc - ms) / 60000);
}

export type SvWallClockStatus = 'ok' | 'gap' | 'ambiguous';

export interface SvComposedDateTime {
  /**
   * `ok` — one instant. `gap` — the wall clock does not exist that day.
   * `ambiguous` — it happens twice.
   */
  readonly status: SvWallClockStatus;
  /**
   * The instant, or the FIRST of the two when ambiguous (the earlier offset,
   * i.e. before the clocks went back). `null` only when `status` is `gap`.
   */
  readonly instant: Date | null;
  /** Both candidates when ambiguous; a single entry when `ok`; empty on a gap. */
  readonly instants: readonly Date[];
  /** Offset in minutes east of UTC for `instant`, or `null` on a gap. */
  readonly offsetMinutes: number | null;
  /**
   * On a `gap`, the instant the clocks jumped TO — what the wall clock the user
   * asked for becomes if you push it forward past the transition.
   *
   * ⚠️ OFFERED, NOT APPLIED. Silently advancing is what `new Date()` already
   *    does and is the behaviour this function exists to make visible. A host
   *    that wants it can take it; a booking flow should probably say "that hour
   *    does not exist on this date" instead.
   */
  readonly gapResolution: Date | null;
}

/**
 * Compose a `'YYYY-MM-DD'` and an `'HH:mm'`/`'HH:mm:ss'` into an instant.
 *
 * @param timeZone IANA zone. Omit it and the composition is done in the
 *   RUNTIME's zone, which is what a host gets from `new Date()` anyway — but
 *   the gap and overlap are still reported, which is the part that was missing.
 *
 * ★★★ THE ALGORITHM PROBES EITHER SIDE OF THE DAY, NOT THE WALL CLOCK ITSELF,
 *     and the difference is the whole correctness of the overlap case.
 *
 *     The obvious version — read the wall clock as if it were UTC, ask the
 *     offset there, subtract, ask again, subtract again — **finds gaps
 *     correctly and misses every overlap**, which is why it looks right. Its
 *     two probes land on the same side of the transition: for London on
 *     2026-10-25 at 01:30, both probes report GMT, both candidates are the same
 *     instant, and the second real 01:30 — the BST one, an hour earlier — is
 *     never generated to be checked. `status: 'ok'`, silently, for the exact
 *     hour the function exists to flag. Caught by this module's own spec, which
 *     is the argument for asserting the overlap separately from the gap.
 *
 *     So: take the offset a DAY BEFORE and a DAY AFTER, which straddles any
 *     transition in between, and subtract each from the wall clock to get one
 *     candidate per side. Then verify each by formatting it back — both
 *     surviving means the hour happens twice, neither means it does not happen
 *     at all, one means an ordinary day.
 *
 * ⚠️ ±24 h IS SAFE BECAUSE NO ZONE TRANSITIONS TWICE IN A DAY, and offsets move
 *    by at most a couple of hours when they do. It is not safe to narrow it to
 *    the transition's own size, because that size is what we are trying to
 *    discover.
 */
export function svComposeDateTime(
  date: string,
  time: string,
  timeZone?: string,
): SvComposedDateTime {
  const none: SvComposedDateTime = {
    status: 'gap', instant: null, instants: [], offsetMinutes: null, gapResolution: null,
  };

  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date ?? '').trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((time ?? '').trim());
  if (!d || !t) return none;

  const [Y, Mo, D] = [Number(d[1]), Number(d[2]) - 1, Number(d[3])];
  const [H, Mi, S] = [Number(t[1]), Number(t[2]), Number(t[3] ?? '0')];
  if (Mo > 11 || D > 31 || H > 23 || Mi > 59 || S > 59) return none;

  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wallAsUtc = Date.UTC(Y, Mo, D, H, Mi, S);

  const probe = (ms: number): number => svZoneOffsetMinutes(ms, zone);
  const DAY = 86_400_000;

  // One candidate per side of any transition inside this day.
  const before = wallAsUtc - probe(wallAsUtc - DAY) * 60000;
  const after = wallAsUtc - probe(wallAsUtc + DAY) * 60000;

  /** Does this instant actually show the wall clock we were asked for? */
  const shows = (ms: number): boolean => wallAsUtc - probe(ms) * 60000 === ms;

  const candidates = before === after ? [before] : [before, after];
  const real = [...new Set(candidates.filter(shows))].sort((a, b) => a - b);

  if (real.length === 0) {
    /**
     * ★★ THE GAP. The requested wall clock is inside the jump. `gapResolution`
     *    is where the clock lands if you push through it — computed from the
     *    LATER offset rather than by adding an hour, because Lord Howe's jump
     *    is thirty minutes and the next zone to change its rules might be
     *    neither.
     */
    return { ...none, gapResolution: new Date(Math.max(before, after)) };
  }

  if (real.length === 1) {
    return {
      status: 'ok',
      instant: new Date(real[0]),
      instants: [new Date(real[0])],
      offsetMinutes: probe(real[0]),
      gapResolution: null,
    };
  }

  // ★★ THE OVERLAP. Two real instants an offset-difference apart. The earlier
  //    one is returned as `instant` — it is the reading before the clocks went
  //    back, which is what a user writing "01:30" on that date almost always
  //    means, because they wrote it while living through the first one.
  return {
    status: 'ambiguous',
    instant: new Date(real[0]),
    instants: real.map((ms) => new Date(ms)),
    offsetMinutes: probe(real[0]),
    gapResolution: null,
  };
}
