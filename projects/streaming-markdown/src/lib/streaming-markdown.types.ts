// ─── Inline ───────────────────────────────────────────────────────────────────

/** Semantic class of an inline span. */
export type MdInlineKind =
  | 'text'
  | 'strong'
  | 'em'
  | 'code'
  | 'strike'
  | 'link'
  | 'image';

/**
 * One inline span. `strong` / `em` / `strike` / `link` carry `children`, so the
 * tree is arbitrarily nestable and the template renders it recursively.
 *
 * ★ `image` is a LEAF even though its syntax looks like a link's. `![a **b**](u)`
 *   has no rendered inner markup — the alt text lands in an attribute, and an
 *   attribute cannot hold a `<strong>`. So `children` is deliberately absent for
 *   images and `text` carries the alt text verbatim, un-parsed. A renderer that
 *   recursed into image children would emit the alt text twice.
 */
export interface MdInline {
  readonly kind: MdInlineKind;
  /** Literal text for `text` and `code`; the visible label for `link`; the alt text for `image`. */
  readonly text: string;
  /** Nested spans for the container kinds. Never set on `image`. */
  readonly children?: readonly MdInline[];
  /** Resolved, scheme-checked URL. Absent when the URL was rejected. */
  readonly href?: string;
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export type MdBlockKind =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'code'
  | 'quote'
  | 'table'
  | 'hr';

/** One item in an ordered or unordered list. */
export interface MdListItem {
  /** Nesting depth, 0-based. Rendered as indentation rather than nested lists. */
  readonly depth: number;
  /** `null` for a normal bullet; `true`/`false` for a `- [x]` / `- [ ]` task. */
  readonly checked: boolean | null;
  readonly inlines: readonly MdInline[];
}

/** One row of a table — a list of cells, each a list of inline spans. */
export type MdTableRow = readonly (readonly MdInline[])[];

/** Column alignment parsed from the header separator row. */
export type MdAlign = 'left' | 'center' | 'right';

/** A parsed top-level block. */
export interface MdBlock {
  readonly kind: MdBlockKind;

  /** `heading` — 1–6. */
  readonly level?: number;

  /** `paragraph`, `heading`, `quote`. */
  readonly inlines?: readonly MdInline[];

  /** `list`. */
  readonly items?: readonly MdListItem[];
  readonly ordered?: boolean;
  readonly start?: number;

  /** `code`. */
  readonly code?: string;
  readonly language?: string;
  /**
   * `false` when the fence was still open at the end of the buffer — i.e. the
   * response is mid-stream. Render it, but don't treat it as final.
   */
  readonly complete?: boolean;

  /** `table`. */
  readonly head?: MdTableRow;
  readonly rows?: readonly MdTableRow[];
  readonly align?: readonly MdAlign[];
}
