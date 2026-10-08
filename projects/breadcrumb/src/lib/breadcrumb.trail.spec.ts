import { svTrailFromPath } from './breadcrumb.trail';

/**
 * ============================================================================
 *  Deriving a trail from a path — `NV-03-M1`, first half
 * ============================================================================
 *
 * A breadcrumb **is** the route, and a hand-passed `items` array next to it is a
 * second source of truth for the same fact. The whole *"the breadcrumb says the
 * wrong thing"* bug class lives in the gap: a route renamed and the array not, a
 * redirect the array never hears about, a page that forgot to set it.
 *
 * ★ This takes a PATH, not a router. Reading the current URL is one line in any
 * router; turning it into a trail is thirty lines of decisions. The decisions
 * ship — pure, testable, and with no dependency on `@angular/router`, which is
 * the same package this item is removing one from.
 */

describe('svTrailFromPath', () => {
  it('turns each segment into a crumb', () => {
    expect(svTrailFromPath('/orders/1042')).toEqual([
      { label: 'Orders', routerLink: '/orders' },
      { label: '1042' },
    ]);
  });

  /**
   * ★ The last crumb gets no `routerLink`, which is what makes `sv-breadcrumb`
   * render it as the current page rather than as a link to where you already are.
   * `NV-03-I3` is the same rule enforced from the other end.
   */
  it('leaves the last crumb unlinked', () => {
    const trail = svTrailFromPath('/a/b/c');
    expect(trail.at(-1)).toEqual({ label: 'C' });
    expect(trail.slice(0, -1).every((c) => c.routerLink)).toBe(true);
  });

  it('builds each link from the path so far, not from the segment', () => {
    expect(svTrailFromPath('/admin/orders/1042/items').map((c) => c.routerLink)).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/orders/1042',
      undefined,
    ]);
  });

  describe('labels', () => {
    /** Only the host knows what `1042` is called. */
    it('takes a label for a segment', () => {
      expect(svTrailFromPath('/orders/1042', { labels: { '1042': 'Order #1042' } }).at(-1))
        .toEqual({ label: 'Order #1042' });
    });

    /**
     * ★ A label may be keyed by the full path, which is how two different
     * `settings` segments under different parents get two different labels.
     */
    it('prefers a path-keyed label over a segment-keyed one', () => {
      const trail = svTrailFromPath('/team/settings', {
        labels: { settings: 'Settings', '/team/settings': 'Team settings' },
      });
      expect(trail.at(-1)).toEqual({ label: 'Team settings' });
    });

    it('title-cases what is left, hyphens and underscores alike', () => {
      expect(svTrailFromPath('/order-history/last_quarter').map((c) => c.label))
        .toEqual(['Order history', 'Last quarter']);
    });

    it('leaves segments alone when asked to', () => {
      expect(svTrailFromPath('/order-history', { titleCase: false }).map((c) => c.label))
        .toEqual(['order-history']);
    });
  });

  describe('the root crumb', () => {
    it('is prepended, and keeps its own link', () => {
      const trail = svTrailFromPath('/orders/1042', {
        root: { label: 'Dashboard', routerLink: '/' },
      });
      expect(trail[0]).toEqual({ label: 'Dashboard', routerLink: '/' });
      expect(trail).toHaveLength(3);
    });

    /** On the root page itself the root IS the current page, so it loses its link. */
    it('loses its link when it is the only crumb', () => {
      expect(svTrailFromPath('/', { root: { label: 'Dashboard', routerLink: '/' } }))
        .toEqual([{ label: 'Dashboard', routerLink: undefined }]);
    });
  });

  describe('a base path', () => {
    /**
     * ★ Segments inside the base produce no crumbs but stay in every link — a
     * link that dropped the prefix would not resolve.
     */
    it('produces no crumbs for itself, and keeps itself in the links', () => {
      expect(svTrailFromPath('/admin/orders/1042', { base: '/admin' })).toEqual([
        { label: 'Orders', routerLink: '/admin/orders' },
        { label: '1042' },
      ]);
    });

    /**
     * ★ Only a real prefix is trimmed. A path that does not start with the base is
     * not inside it, and trimming matching segments from the middle would build a
     * trail to somewhere that does not exist.
     */
    it('is ignored when the path does not start with it', () => {
      expect(svTrailFromPath('/store/admin/orders', { base: '/admin' }).map((c) => c.label))
        .toEqual(['Store', 'Admin', 'Orders']);
    });
  });

  describe('what is not part of a trail', () => {
    /** `?page=2` is a view of the page the last crumb already names. */
    it('ignores the query and the hash', () => {
      expect(svTrailFromPath('/orders?page=2#top').map((c) => c.label)).toEqual(['Orders']);
    });

    it('survives a path with no segments at all', () => {
      expect(svTrailFromPath('/')).toEqual([]);
      expect(svTrailFromPath('')).toEqual([]);
    });

    it('ignores repeated and trailing slashes', () => {
      expect(svTrailFromPath('//orders//1042/').map((c) => c.label)).toEqual(['Orders', '1042']);
    });
  });
});
