import type { BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  Deriving a trail from a path — `NV-03-M1`, first half
 * ============================================================================
 *
 * A breadcrumb **is** the route, and hand-passing an `items` array next to it
 * creates a second source of truth for the same fact. The whole *"the breadcrumb
 * says the wrong thing"* bug class lives in the gap between the two: a route
 * renamed and the array not, a redirect the array never hears about, a page that
 * forgot to set it at all.
 *
 * ── ★ Why this takes a PATH and not a router ────────────────────────────────
 * Reading the current URL is one line in any router. Turning a path into a trail
 * — segment splitting, label resolution, the parameter segments that must not be
 * title-cased, the base path that is not a crumb — is thirty lines of decisions,
 * and it is the part that is worth testing and easy to get wrong.
 *
 * So the derivation ships and the reading does not. `@styloviz/breadcrumb` keeps
 * no dependency on `@angular/router`, this function is pure, and the host writes
 * one line:
 *
 * ```ts
 * readonly crumbs = computed(() => svTrailFromPath(this.url(), {
 *   labels: { orders: 'Orders', '1042': 'Order #1042' },
 *   root: { label: 'Dashboard', routerLink: '/admin' },
 *   base: '/admin',
 * }));
 * ```
 */

/** How {@link svTrailFromPath} turns a path into crumbs. */
export interface SvTrailOptions {
  /**
   * Labels for segments that should not be derived from their own text, keyed by
   * segment. An id segment belongs here — `{ '1042': 'Order #1042' }` — because
   * only the host knows what `1042` is called.
   *
   * A key may also be the full path to that crumb (`'/admin/orders/1042'`), which
   * is how two different `settings` segments under different parents get two
   * different labels.
   */
  readonly labels?: Readonly<Record<string, string>>;

  /**
   * A crumb prepended to every trail — the app root, which is not a path segment
   * of anything. Omit it and the trail starts at the first real segment.
   */
  readonly root?: BreadcrumbItem;

  /**
   * A path prefix that is scaffolding rather than navigation: `'/admin'` in an
   * app mounted there. Segments inside it produce no crumbs, but they stay in
   * every crumb's `routerLink`, because a link that dropped the prefix would not
   * resolve.
   */
  readonly base?: string;

  /**
   * Turn `order-history` into `Order history` for segments with no entry in
   * `labels`. @default true
   */
  readonly titleCase?: boolean;
}

/** `order-history` → `Order history`. Hyphens and underscores both. */
function titleCaseSegment(segment: string): string {
  const spaced = segment.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return segment;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function segmentsOf(path: string): string[] {
  // The query and hash are not part of the trail: `?page=2` is a view of the
  // page the last crumb already names, not a place below it.
  const withoutQuery = path.split('?')[0].split('#')[0];
  return withoutQuery.split('/').filter(Boolean);
}

/**
 * Turn a URL path into a breadcrumb trail.
 *
 * Pure: no router, no DOM, no injection context. Give it `router.url`, a
 * `location.pathname`, or a string from a test.
 *
 * ★ **The last crumb gets no `routerLink`**, which is what makes
 * `sv-breadcrumb` render it as the current page rather than as a link to where
 * you already are. `NV-03-I3` is the same rule enforced from the other end.
 *
 * @param path Anything URL-shaped. Query and hash are ignored.
 */
export function svTrailFromPath(
  path: string,
  options: SvTrailOptions = {},
): BreadcrumbItem[] {
  const { labels = {}, root, base = '', titleCase = true } = options;

  const all = segmentsOf(path);
  const baseSegments = segmentsOf(base);

  // The base is a prefix only when the path actually starts with it. A path that
  // does not is not "inside" the base, and silently trimming matching segments
  // from the middle would build a trail to somewhere that does not exist.
  const inBase = baseSegments.every((segment, i) => all[i] === segment);
  const skip = inBase ? baseSegments.length : 0;

  const trail: BreadcrumbItem[] = root ? [{ ...root }] : [];

  for (let i = skip; i < all.length; i += 1) {
    const segment = all[i];
    const href = '/' + all.slice(0, i + 1).join('/');
    const label =
      labels[href] ?? labels[segment] ?? (titleCase ? titleCaseSegment(segment) : segment);

    trail.push(
      i === all.length - 1
        ? { label }
        : { label, routerLink: href },
    );
  }

  // Every segment was scaffolding, so the root — if there is one — is the page.
  // It must lose its link for the same reason the last crumb does.
  if (trail.length === 1 && root) return [{ ...root, routerLink: undefined }];

  return trail;
}
