import { InjectionToken, type Provider } from '@angular/core';
import type { IconNode } from './icon.types';

/** A map of icon name → primitives, resolvable by `<sv-icon name="...">`. */
export type IconRegistry = Readonly<Record<string, readonly IconNode[]>>;

/**
 * DI token holding user-registered custom icons. When present, `SvIconComponent`
 * resolves a `name` against these first, then falls back to the built-in set.
 */
export const SV_ICON_REGISTRY = new InjectionToken<IconRegistry>('SV_ICON_REGISTRY');

/**
 * Register custom icons so they resolve through `<sv-icon name="...">`.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideSvIcons({ 'my-logo': [{ tag: 'path', d: '…' }] })],
 * });
 * ```
 */
export function provideSvIcons(icons: IconRegistry): Provider {
  return { provide: SV_ICON_REGISTRY, useValue: icons };
}
