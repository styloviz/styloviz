/*
 * @styloviz/core/virtual — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// Virtualization
export { createVariableVirtualizer, createVirtualizer } from './virtualizer';
export type {
  NearEndOptions,
  Virtualizer,
  VirtualizerOptions,
  VariableVirtualizerOptions,
  VirtualRange,
} from './virtualizer';
