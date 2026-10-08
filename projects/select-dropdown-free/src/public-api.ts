export {
  SvSelectDropdownComponent,
  SelectSize,
  SelectVariant,
  SelectOption,
  SelectGroup,
  SvSelectOptionSource,
} from './lib/select-dropdown.component';
// `FI-23-M1` — the search feature as a content child, registering through
// `SV_SELECT_FEATURE` (from `@styloviz/core`). The adapter for where the
// options come from, `svSelectSource`, is in `@styloviz/core` too. Free has no
// windowing or bulk selection, so it ships no `svSelectVirtual` /
// `svSelectBulk` — and the Pro ones, being on the same shared token, are
// accepted and ignored here rather than failing to compile.
export { SvSelectSearchDirective } from './lib/select-search.directive';
