/**
 * @styloviz/core/persist — versioned state a component writes to storage and
 * reads back: `svPersistState` / `svRestoreState`, and `svPersistedStore` over
 * `svLocalStorage`.
 *
 * Its own entry point because an app's first screen often restores something —
 * a session, a consent, a layout — and importing these from
 * `@styloviz/core/data` would bring the data shells and chart frames along.
 * `@styloviz/core/data` and `@styloviz/core` re-export everything here.
 */
export {
  svPersistState,
  svRestoreState,
  svRestoreParams,
  svWarnRestoreRefused,
} from './persisted-state';
export type {
  SvPersistedState,
  SvRestoreReason,
  SvRestoreResult,
  SvRestoreSpec,
  SvRestoreParamsSpec,
  SvRestoreLabels,
} from './persisted-state';
export { svPersistedStore, svLocalStorage } from './persisted-store';
export type {
  SvPersistedStore,
  SvPersistedStoreLoad,
  SvPersistedStoreOptions,
  SvPersistedStoreRefusal,
} from './persisted-store';
