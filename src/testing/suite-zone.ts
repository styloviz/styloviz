/**
 * The time zone the unit suite runs in, and the guard that proves it does.
 *
 * `vitest.config.ts` sets `process.env.TZ` before any worker is forked, which
 * is the only point where it takes (see the long note there). This module is
 * the other half: every worker checks that the zone it actually resolved is the
 * one the config asked for, so the timezone defence cannot be switched off
 * without a red run saying so.
 *
 * ★★ WHY A CHECK AND NOT TRUST (DA-15). The config used `TZ ??= …`, so any
 *    runner that already exported `TZ` — a container image, a CI preset, a
 *    developer shell — silently ran the whole suite in its own zone. East of
 *    UTC that HIDES the commonest date bug the suite exists to catch, and four
 *    date specs went red with plain assertion diffs that read like component
 *    regressions. The config now forces the suite zone and only an explicit
 *    `SV_TEST_TZ` changes it; this guard catches anything that still gets
 *    between the config and the worker.
 */

/** The default suite zone: −09:30, west of UTC, not a whole hour, no DST. */
export const SUITE_TIME_ZONE = 'Pacific/Marquesas';

/** The zone this run asked for: `SV_TEST_TZ` when set, else the suite default. */
export function requestedTimeZone(env: Record<string, string | undefined> = process.env): string {
  return env['SV_TEST_TZ']?.trim() || SUITE_TIME_ZONE;
}

/** The zone the runtime actually resolved. */
export function runtimeTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Throw, naming the config, when the runtime zone is not the requested one.
 * Called once per worker from the setup files.
 */
export function assertSuiteTimeZone(
  requested: string = requestedTimeZone(),
  actual: string = runtimeTimeZone(),
): void {
  if (actual === requested) return;
  throw new Error(
    `The unit suite must run in ${requested}, but this worker resolved ${actual}. ` +
      'vitest.config.ts sets process.env.TZ before workers start; something replaced it ' +
      '(a TZ set after the config ran, or a runner that does not inherit the parent env). ' +
      'To run in another zone on purpose, use SV_TEST_TZ=<zone> instead of TZ.',
  );
}

/** Whether this run uses the default suite zone (specs with zone-specific literals check this). */
export function inSuiteTimeZone(): boolean {
  return runtimeTimeZone() === SUITE_TIME_ZONE;
}
