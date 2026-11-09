/**
 * The icon package's console sink (FL-I2).
 *
 * `@styloviz/core` owns the kit's diagnostics switch (`provideSvDiagnostics`),
 * but this package sits below core and cannot import it. Both read the same
 * registered-symbol key on `globalThis`, so one provider silences or routes
 * this package's warning too.
 */
interface SvDiagnosticsLike {
  readonly silent?: boolean;
  readonly handler?: (level: 'warn' | 'error', message: string, detail: readonly unknown[]) => void;
}

const KEY = Symbol.for('styloviz.diagnostics');

/** Report a warning the way `svWarn` in `@styloviz/core` does. @internal */
export function svIconWarn(message: string): void {
  const { silent, handler } = ((globalThis as Record<symbol, unknown>)[KEY] as SvDiagnosticsLike | undefined) ?? {};
  if (silent) return;
  if (handler) return handler('warn', message, []);
  console.warn(message);
}
