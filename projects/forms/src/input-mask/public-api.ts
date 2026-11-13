// The @styloviz/forms/input-mask entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvInputMaskComponent, svDateMaskFormat, svTimeMaskSeparator } from './input-mask.component';
export type {
  InputMaskPreset,
  InputMaskSize,
  InputMaskVariant,
  // Whether the field carries a regulated value — suppresses autofill and opts
  // out of every session-replay recorder. `FI-13-I1`; see `docs/pci-scope.md`.
  InputMaskSensitivity,
  InputMaskDateOrder,
} from './input-mask.component';
