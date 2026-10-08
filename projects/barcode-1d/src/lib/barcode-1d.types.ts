export type BarcodeSymbology =
  /** Code 128, subset B and C, with the mod-103 check character. */
  | 'code128'
  /** EAN-13 retail article number, with the mod-10 check digit. */
  | 'ean13'
  /** EAN-8, the short form. */
  | 'ean8';

export type BarcodeVariant =
  /** The bars, with the human-readable text below. */
  | 'labelled'
  /** The bars alone. */
  | 'bare'
  /** The bars, the text, and what the encoder actually did. */
  | 'inspect';

/** One drawn bar or space, in modules. */
export interface BarcodeModule {
  /** Offset from the left edge of the symbol, in modules. */
  readonly at: number;
  /** Width in modules. */
  readonly width: number;
  /** False for a space. Spaces are emitted so a renderer can assert coverage. */
  readonly bar: boolean;
}
