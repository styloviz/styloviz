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
}

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

