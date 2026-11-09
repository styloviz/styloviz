import { makeEnvironmentProviders, provideEnvironmentInitializer, type EnvironmentProviders } from '@angular/core';

declare const ngDevMode: boolean | undefined;

/** How severe a kit diagnostic is. */
export type SvDiagnosticLevel = 'warn' | 'error';

/**
 * Where the kit's diagnostics go — `provideSvDiagnostics`.
 *
 * Every warning and error the kit writes passes through `svWarn` / `svError`,
 * so this one setting governs all of them.
 */
export interface SvDiagnosticsConfig {
  /** Write nothing at all. @default false */
  readonly silent?: boolean;
  /**
   * Receive each diagnostic instead of the console — to forward it to your
   * error tracker, or to fail a test on one. `message` already carries the
   * `[styloviz]` prefix; `detail` is whatever the kit passed with it (an
   * `Error` from a failed export, for instance).
   */
  readonly handler?: (level: SvDiagnosticLevel, message: string, detail: readonly unknown[]) => void;
}

/**
 * ★ Kept on `globalThis` under a registered symbol, not in this module: the
 *   icon package sits below core and cannot import it, yet its "unregistered
 *   glyph" warning has to obey the same switch (`@styloviz/icons` reads the
 *   same key). One app, one setting, whichever package wrote the warning.
 */
const KEY = Symbol.for('styloviz.diagnostics');

function config(): SvDiagnosticsConfig {
  return ((globalThis as Record<symbol, unknown>)[KEY] as SvDiagnosticsConfig | undefined) ?? {};
}

/** Set where the kit's diagnostics go. Prefer `provideSvDiagnostics` in an app. */
export function svSetDiagnostics(next: SvDiagnosticsConfig): void {
  (globalThis as Record<symbol, unknown>)[KEY] = next;
}

/**
 * Silence the kit's console output, or route it, with one provider (FL-I2).
 *
 * ```ts
 * providers: [provideSvDiagnostics({ handler: (level, message, detail) => tracker.capture(message, detail) })]
 * ```
 */
export function provideSvDiagnostics(next: SvDiagnosticsConfig): EnvironmentProviders {
  return makeEnvironmentProviders([provideEnvironmentInitializer(() => svSetDiagnostics(next))]);
}

function report(level: SvDiagnosticLevel, message: string, detail: readonly unknown[]): void {
  const { silent, handler } = config();
  if (silent) return;
  const text = message.startsWith('[') ? message : `[styloviz] ${message}`;
  if (handler) return handler(level, text, detail);
  // The kit's one console sink — every other package reports through here.
  if (level === 'error') console.error(text, ...detail);
  else console.warn(text, ...detail);
}

/**
 * A kit warning: something the host should know and the kit cannot fix.
 * Written in every build — gate it on `isDevMode()` at the call site when it
 * is a development aid.
 */
export function svWarn(message: string, ...detail: unknown[]): void {
  report('warn', message, detail);
}

/** A kit error: an operation failed (an export, a print) and the UI has already said so. */
export function svError(message: string, ...detail: unknown[]): void {
  report('error', message, detail);
}

/** One warning per key, so a grid of twelve controls logs once. */
const warned = new Set<string>();

/**
 * A dev-only warning, emitted at most once per key. Silent in production.
 *
 * ★★ THE `Set` IS THE POINT, NOT THE CONSOLE. A warning that fires on every
 *    change detection in a list of two hundred rows is noise somebody turns
 *    off, and then the next warning is invisible too.
 *
 * ⚠️ NOT A REPLACEMENT FOR A TYPE OR A TEST. It is for the case where the
 *    component can SEE the host has done something contradictory but cannot
 *    fix it, because the thing to fix is on the host's side.
 */
export function svWarnOnce(key: string, message: string): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (warned.has(key)) return;
  warned.add(key);
  svWarn(message);
}

/** Test-only: forget what has already been warned about. */
export function svResetWarnOnce(): void { warned.clear(); }
