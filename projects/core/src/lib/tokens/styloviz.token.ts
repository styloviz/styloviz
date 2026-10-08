import {
  InjectionToken,
  makeEnvironmentProviders,
  EnvironmentProviders,
} from '@angular/core';

// ─── Config interface ─────────────────────────────────────────────────────────

export interface StylovizConfig {
  /**
   * Default color scheme when the visitor has not chosen one with
   * `ThemeService.setTheme()`. `'system'` follows the OS preference.
   * @default 'system'
   */
  readonly colorScheme?: 'light' | 'dark' | 'system';

  /**
   * ⚠️ Not read by any component — Pro access is granted at INSTALL time by
   * the license key in your `.npmrc` (it is the registry token), never at
   * runtime, so there is nothing to put here and nothing ships a key into
   * your bundle. Kept so existing configs still compile.
   * @deprecated Has no effect. Remove it from your config.
   */
  readonly licenseKey?: string;
}

/**
 * @deprecated Misspelled — use {@link StylovizConfig}. Kept as an alias so
 * existing code compiles; it will be removed in the next major version.
 */
export type StyloVizConfig = StylovizConfig;

// ─── Token ────────────────────────────────────────────────────────────────────

export const STYLOVIZ_CONFIG = new InjectionToken<StylovizConfig>('StylovizConfig');

// ─── Provider factory ─────────────────────────────────────────────────────────

/**
 * Register Styloviz in your root app config.
 *
 * @example
 * // app.config.ts
 * import { provideStyloviz } from '@styloviz/core';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideStyloviz({ colorScheme: 'system' }),
 *   ],
 * };
 */
export function provideStyloviz(config: StylovizConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: STYLOVIZ_CONFIG, useValue: config },
  ]);
}

/**
 * @deprecated Misspelled — use {@link provideStyloviz}. Kept as an alias so
 * existing code compiles; it will be removed in the next major version.
 */
export function provideStylviz(config: StylovizConfig = {}): EnvironmentProviders {
  return provideStyloviz(config);
}
