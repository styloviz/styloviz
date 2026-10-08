import { APP_ID, Injectable, inject } from '@angular/core';

/**
 * ============================================================================
 *  Per-application element ids — `X-10`'s SSR half, `T0-2`
 * ============================================================================
 *
 * ── The defect, reproduced rather than assumed ──────────────────────────────
 * Seven navigation packages minted their DOM ids from a **module-level
 * counter** — `let _svTabsUid = 0` and `++_svTabsUid` in a field. Within one
 * instance the two halves of each `aria-controls` / `id` pair always agree, so
 * this was never a live accessibility bug, and `T0-2` was careful to say the SSR
 * exposure was *unproven either way*.
 *
 * It is proven now, and `unique-id.spec.ts` holds the reproduction:
 *
 * ```
 * same module, two renders: sv-tabs-1-tab-x   sv-tabs-2-tab-x
 * fresh module:             sv-tabs-1-tab-x
 * ```
 *
 * A long-lived server process shares that counter across requests, so the second
 * page it renders emits `sv-tabs-2-…` while the browser — which just loaded the
 * module for the first time — emits `sv-tabs-1-…`. Server HTML and first client
 * render disagree, which is a hydration mismatch: Angular discards the
 * prerendered DOM and re-renders, and any `aria-controls` an assistive
 * technology read in between pointed at an element that no longer exists.
 *
 * ── The fix, and why it is a counter per INJECTOR ───────────────────────────
 * ★ The instinct is a random id, and it is wrong: random is different on the
 * server and the client **by construction**, which is the very mismatch being
 * fixed. The id has to be *deterministic per render pass* and *independent
 * between passes* — which is exactly what a counter owned by the root injector
 * gives, because Angular SSR bootstraps a fresh application per request. Both
 * sides start at 1 and agree, and two components in one app still differ.
 */

/** The counter itself. Root-provided, so its lifetime is one application. */
@Injectable({ providedIn: 'root' })
export class SvIdSequence {
  private n = 0;

  /** The next number in this application's sequence. */
  next(): number {
    return ++this.n;
  }
}

/**
 * A DOM id prefix unique within this application and stable across hydration.
 *
 * Call it in a field initializer, inside an injection context:
 *
 * ```ts
 * private readonly uid = svUniqueId('sv-tabs');
 * tabDomId = (id: string) => `${this.uid}-tab-${id}`;
 * ```
 *
 * ★★ **`APP_ID` is always folded in, and that is not belt-and-braces — it repairs
 * a regression this very change would otherwise introduce.** The module counter
 * had one virtue: two Angular applications on one page *shared* it, so their ids
 * could not collide. A counter per injector gives each application its own, both
 * restart at 1, and suddenly two `sv-tabs-1-tab-x` elements exist and
 * `aria-controls` resolves into the wrong app — the same defect this repo has
 * already fixed twice for two tab strips and two speed dials.
 *
 * `APP_ID` is the right discriminator because Angular *already* requires distinct
 * values there for hydration and styles when two apps share a page, so nothing
 * new has to be configured. It costs `-ng-` in the common single-app case, which
 * is a few bytes in an attribute nobody reads by hand.
 *
 * ⚠️ Do not "tidy" this by skipping Angular's default: the first draft did, and
 * the default is `'ng'` when bootstrapping and `'a'` under `TestBed`, so the
 * special case was both magic and wrong.
 */
export function svUniqueId(prefix: string): string {
  const appId = inject(APP_ID);
  const n = inject(SvIdSequence).next();
  return `${prefix}-${appId}-${n}`;
}
