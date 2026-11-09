/**
 * Translatable accessible names (FL-B1b).
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 *
 * ★★★ `aria-label="Close"` IS ENGLISH FOREVER. 312 accessible names sat as
 *     literals in 74 library templates — the rich editor's toolbar, the data
 *     table's checkboxes, the gantt's controls — so a screen-reader user of a
 *     German app heard English buttons, and the buyer's only way to change
 *     that was to fork the component.
 *
 * ★★ ONE REGISTRY, OWNED BY THE PACKAGES. Core does not know any component's
 *    strings: each package declares its English defaults in its own
 *    `labels.ts` and adds its namespace to `SvLabelRegistry` by module
 *    augmentation. A Pro package's strings therefore stay in the Pro package,
 *    and `provideSvLabels()` is type-checked against exactly the namespaces the
 *    app has installed:
 *
 *      provideSvLabels({ dataTable: { selectRow: 'Zeile auswählen' } })
 *
 *    Overrides are partial at both levels and merge in provider order, so a
 *    language pack plus a few app-specific corrections compose.
 *
 * ★ NAMES ONLY. A label here is the string a component would otherwise type;
 *   a host that names one instance differently still has that component's own
 *   `ariaLabel`-style input, which wins.
 */
import { InjectionToken, inject, type Provider } from '@angular/core';
import type { SvCoreLabels } from './core.labels';

/**
 * Every package's label namespace, added by module augmentation:
 *
 * ```ts
 * declare module '@styloviz/core/i18n' {
 *   interface SvLabelRegistry { dataTable: SvDataTableLabels }
 * }
 * ```
 */
export interface SvLabelRegistry {
  /** Core's own shells and status texts (`core.labels.ts`); every other namespace is a package's augmentation. */
  core: SvCoreLabels;
}

/** A partial override of any registered namespace, any subset of its keys. */
export type SvLabelOverrides = {
  readonly [K in keyof SvLabelRegistry]?: Partial<SvLabelRegistry[K]>;
};

/** Every `provideSvLabels()` call, in provider order. */
export const SV_LABEL_OVERRIDES = new InjectionToken<readonly SvLabelOverrides[]>('SV_LABEL_OVERRIDES');

/**
 * Replace some of the kit's labels — language packs, or a few corrections.
 * Pass several (one pack per installed package) or call it more than once;
 * later ones win key by key:
 *
 * ```ts
 * provideSvLabels(SV_DATA_TABLE_LABELS_DE, SV_CORE_LABELS_DE, { dataTable: { searchTable: 'Suchen' } })
 * ```
 */
export function provideSvLabels(...overrides: SvLabelOverrides[]): Provider {
  return overrides.map((useValue) => ({ provide: SV_LABEL_OVERRIDES, useValue, multi: true }));
}

/**
 * The labels a component renders: its package's English `defaults`, with every
 * `provideSvLabels()` override for `namespace` applied in order. Call in an
 * injection context (a field initializer). A non-string override is ignored,
 * so a malformed pack cannot blank a button's name.
 */
export function injectSvLabels<K extends keyof SvLabelRegistry>(
  namespace: K,
  defaults: SvLabelRegistry[K],
): SvLabelRegistry[K] {
  const overrides = inject(SV_LABEL_OVERRIDES, { optional: true }) ?? [];
  const merged: Record<string, unknown> = { ...(defaults as unknown as Record<string, unknown>) };
  for (const layer of overrides) {
    const patch = layer[namespace] as unknown as Record<string, unknown> | undefined;
    if (!patch) continue;
    for (const [key, value] of Object.entries(patch)) {
      if (key in merged && typeof value === 'string' && value.trim() !== '') merged[key] = value;
    }
  }
  return Object.freeze(merged) as unknown as SvLabelRegistry[K];
}
