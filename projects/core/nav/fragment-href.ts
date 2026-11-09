/**
 * ============================================================================
 *  An in-page link that stays on the page — FL-J3-NV-03 (`X-19`)
 * ============================================================================
 *
 * A bare `href="#section"` resolves against the document's BASE URL, not the
 * page. Every Angular app ships `<base href="/">`, so on `/docs/anchor` the link
 * `#section` means `/#section` — the home page. With JavaScript the kit's click
 * handlers scroll instead and nobody notices; without it (a prerendered page
 * before hydration, a reader with scripting off) the link leaves the page.
 *
 * The fix is to write the page's own path in front of the fragment. That resolves
 * to the same document under any base, so the browser just scrolls.
 *
 * ★ Read from the document's location, which `@angular/platform-server` sets to
 *   the request URL — so a server-rendered link already carries the right path.
 *   With no location (a detached document) it falls back to the bare fragment.
 */
export function svFragmentHref(doc: Document | null | undefined, id: string): string {
  const loc = doc?.location;
  if (!loc || !loc.pathname) return `#${id}`;
  return `${loc.pathname}${loc.search}#${id}`;
}
