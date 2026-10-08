import type { SvRtlScrollType } from './scroll-area.geometry';

/**
 * One answer per document, INCLUDING the no-layout fallback.
 *
 * ★★ The component reads the convention on every scroll event, so an
 *    uncached fallback meant inserting and removing a probe `<div>` per scroll
 *    frame wherever layout was missing. A document that cannot lay out now
 *    (the server DOM, jsdom, a detached `createHTMLDocument`) does not gain
 *    layout later, so caching its fallback loses nothing.
 */
const cache = new WeakMap<Document, SvRtlScrollType>();

/**
 * Which `scrollLeft` convention this engine uses in RTL — probed once per
 * document, cached.
 *
 * ★ PROBED, NOT SNIFFED. A throwaway RTL scroller is appended off-screen: if it
 *   starts with a positive `scrollLeft` the engine is legacy `'default'`;
 *   otherwise a write of `+1` is clamped back to `0` by a spec (`'negative'`)
 *   engine and kept by a legacy `'reverse'` one.
 *
 * ⚠️ Returns `'negative'` — the spec answer, and every current engine's — on
 *    the server and anywhere it cannot measure (no `body`, no layout). That is
 *    also what jsdom reports, where `scrollLeft` never moves.
 */
export function svRtlScrollType(doc: Document | null | undefined): SvRtlScrollType {
  if (!doc) return 'negative';
  const known = cache.get(doc);
  if (known) return known;
  const body = doc.body;
  if (!body) return 'negative';

  const probe = doc.createElement('div');
  probe.dir = 'rtl';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;top:-9999px;width:4px;height:1px;overflow:scroll;visibility:hidden;';
  const inner = doc.createElement('div');
  inner.style.cssText = 'width:8px;height:1px;';
  probe.appendChild(inner);
  body.appendChild(probe);

  // ⚠️ NO OVERFLOW, NO ANSWER. Without layout (jsdom, a `display: none`
  //    document) the probe does not scroll at all, and an engine that merely
  //    STORES the write — jsdom does — would read as legacy `'reverse'` and
  //    flip every RTL position. Report the spec answer — and cache it, so the
  //    probe runs once per document rather than once per scroll.
  if (probe.scrollWidth <= probe.clientWidth) {
    probe.remove();
    cache.set(doc, 'negative');
    return 'negative';
  }

  let type: SvRtlScrollType = 'negative';
  if (probe.scrollLeft > 0) {
    type = 'default';
  } else {
    probe.scrollLeft = 1;
    type = probe.scrollLeft === 0 ? 'negative' : 'reverse';
  }
  probe.remove();

  cache.set(doc, type);
  return type;
}
