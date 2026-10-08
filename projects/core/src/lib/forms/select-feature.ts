import { InjectionToken, type Signal } from '@angular/core';

/**
 * `FI-23-M1` — the contract between a select and the feature children that
 * configure it.
 *
 * ★★★ WHY A TOKEN AND NOT THE DIRECTIVE CLASSES. The point of the split
 *     (`docs/select-dropdown-split-adr.md`) is that the component depends on
 *     this interface and on no feature. A select that imported
 *     `SvSelectVirtualDirective` to read its inputs would be the same coupling
 *     the 38-input API already has, moved one file over.
 *
 * ★★ WHY IN CORE AND NOT IN EACH PACKAGE. The free and Pro selects are twins,
 *    and the Pro package peer-depends on the free one — so a host can easily
 *    end up with `svSelectSearch` from one tier inside the other tier's
 *    component. With one token per package that combination would compile and
 *    silently do nothing. With one shared token it works, and a feature the
 *    receiving tier does not implement (virtualization in free) is ignored,
 *    which is the no-op the ADR asks for.
 */

/**
 * Everything a feature child may configure. Every member is optional, and an
 * `undefined` member means "not set here" — the component falls through to its
 * own legacy input of the same name, so a feature child only overrides what it
 * actually binds.
 */
export interface SvSelectFeatureConfig {
  // ── Search (`svSelectSearch`) ──────────────────────────────────────────────
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly noResultsText?: string;
  readonly loadingText?: string;
  readonly minChars?: number;
  readonly debounceMs?: number;
  readonly serverSide?: boolean;
  // ── Virtualization (`svSelectVirtual`) ─────────────────────────────────────
  readonly virtualThreshold?: number;
  readonly optionHeight?: number;
  readonly virtualViewportHeight?: number;
  // ── Bulk selection (`svSelectBulk`) ────────────────────────────────────────
  readonly showSelectAll?: boolean;
  readonly selectAllLabel?: string;
}

/** A feature child, as the select sees it. */
export interface SvSelectFeature {
  /** What this feature contributes. Read reactively. */
  readonly config: Signal<SvSelectFeatureConfig>;
  /** Called with each settled search term the select emits as `searchChange`. */
  searchChanged?(term: string): void;
}

/**
 * Provided by every feature child (`useExisting`), queried by the select with
 * `contentChildren(SV_SELECT_FEATURE, { descendants: true })`.
 */
export const SV_SELECT_FEATURE = new InjectionToken<SvSelectFeature>('SV_SELECT_FEATURE');

/**
 * Merge the registered features into one config. Later children win for a key
 * they both set; an `undefined` member never overwrites a defined one.
 */
export function svMergeSelectFeatures(
  features: readonly SvSelectFeature[],
): SvSelectFeatureConfig {
  if (features.length === 0) return {};
  const merged: Record<string, unknown> = {};
  for (const feature of features) {
    for (const [key, value] of Object.entries(feature.config())) {
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged as SvSelectFeatureConfig;
}
