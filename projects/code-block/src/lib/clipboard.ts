/**
 * Write text to the clipboard and say whether it landed.
 *
 * ★★ `navigator.clipboard` is absent on the server and over plain HTTP, and
 *    `writeText` REJECTS when permission is denied. A component that confirmed
 *    "Copied" without awaiting this shows success over an empty clipboard; one
 *    that let the rejection escape shows a dead button. The boolean is what the
 *    caller branches on, so both failures get a visible state.
 */
export async function svWriteClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
