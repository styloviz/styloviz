export {
  SvSelectDropdownComponent,
  SelectSize,
  SelectVariant,
  SelectOption,
  SelectGroup,
} from './lib/select-dropdown.component';
// `FI-23-M1` — the search feature as a content child, registering through
// `SV_SELECT_FEATURE` (from `@styloviz/core`). The adapter for where the
// options come from, `svSelectSource`, is in `@styloviz/core` too. Free has no
// windowing or bulk selection, so it ships no `svSelectVirtual` /
// `svSelectBulk` — and the Pro ones, being on the same shared token, are
// accepted and ignored here rather than failing to compile.
export { SvSelectSearchDirective } from './lib/select-search.directive';
export { SV_SELECT_DROPDOWN_LABELS } from './lib/select-dropdown-free.labels';
export type { SvSelectDropdownLabels } from './lib/select-dropdown-free.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/select-dropdown-free.labels.packs';
