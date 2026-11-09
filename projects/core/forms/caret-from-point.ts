/**
 * The caret position under a viewport point, as a collapsed `Range` — what a
 * drop handler needs once it has cancelled the browser's own drop and has to
 * put the content where the pointer let go (`X-4`, `FI-14-M3`).
 *
 * ★★ TWO ENGINE APIS, ONE WRITER. `caretPositionFromPoint` is the standard
 *    (Gecko, and Blink/WebKit since 2024); `caretRangeFromPoint` is what older
 *    WebKit and Blink have. Shared by `sv-mention` and `sv-rich-text-editor`
 *    so the fallback order is decided once. Browser-sensitive: registered in
 *    `mention.dom-deps.ts` and watched by `check:ui`.
 *
 * ⚠️ `null` WHEN NEITHER EXISTS (jsdom, SSR) or the point hits nothing. The
 *    caller decides what "no drop point" means — both callers fall back to the
 *    current caret, which is where a paste would go.
 */
export function svCaretRangeFromPoint(x: number, y: number, doc: Document = document): Range | null {
  const d = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof d.caretPositionFromPoint === 'function') {
    const pos = d.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const range = doc.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }
  return typeof d.caretRangeFromPoint === 'function' ? d.caretRangeFromPoint(x, y) : null;
}
