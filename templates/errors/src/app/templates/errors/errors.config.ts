/**
 * ============================================================
 *  Errors Template — Central Configuration
 * ============================================================
 *  Single edit point for branding the 404/500/503/maintenance/
 *  coming-soon pages.
 *
 *  To recolour the shell, edit the `.tpl-errors` accent tokens in
 *  `src/styles.css` (brand = slate, brandaccent = amber).
 * ============================================================
 */

/**
 * ★★★ WHERE THIS TEMPLATE IS MOUNTED — the one line to change when you move it.
 *
 *     Every internal link composes from this. The prefix used to be spelled
 *     out at each of hundreds of call sites, which quietly made
 *     INSTALL.md's "register its routes under any base path" untrue: mounting
 *     the folder anywhere else left every one of those links pointing at a
 *     route that no longer existed, with nothing to say so.
 *
 *     Change it here, add the matching route, and the whole template follows.
 */
export const ERRORS_BASE = '/templates/errors';

export interface ErrorsBrand {
  readonly name: string;
  readonly nameAccent: string;
  readonly logoSrc: string;
  readonly logoAlt: string;
  /** Where "Go home" / the logo link to. */
  readonly homeLink: string;
  /** Shown on the 500/503 pages as somewhere to report the problem. */
  readonly supportEmail: string;
}

export const ERRORS_BRAND: ErrorsBrand = {
  name: 'styloviz',
  nameAccent: '',
  logoSrc: 'logo-icon-sm.svg',
  logoAlt: 'styloviz logo',
  homeLink: '/',
  supportEmail: 'support@styloviz.example',
};

/**
 * Somewhere a visitor can check whether it is just them — your status page.
 *
 * ★ Was `/status`, an app route no app has: on the live demo it fell through
 *   to the kit's home page. A status page is normally its own site, so the
 *   default is one on the invented brand's reserved `.example` host and the
 *   link opens in a new tab.
 */
export const ERRORS_STATUS_URL = 'https://status.styloviz.example';

/**
 * Where the 401 page's "Sign in" button goes — your sign-in route.
 *
 * ★ Was a literal inside `error-page.component.ts`, so pointing it at a real
 *   sign-in page meant editing a component rather than this file. The default
 *   matches the Auth template's route in the kit gallery.
 */
export const ERRORS_SIGN_IN_URL = '/auth/login';

/**
 * Where the 404 page's search box sends people.
 *
 * ★ A query string, not a search API. The 404 page is the one page in an app
 * that must render when everything else is broken — giving it a data
 * dependency of its own is how you get a 404 page that itself fails.
 */
export const ERRORS_SEARCH_URL = '/search';

/** One suggested destination on the 404 page. */
export interface ErrorsSuggestion {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

/**
 * Where people usually meant to go.
 *
 * ★★ THE MOST USEFUL THING A 404 CAN DO is not apologise, it is offer the
 * places the visitor was probably heading. Static by design — see the
 * note on `ERRORS_SEARCH_URL`.
 */
export const ERRORS_SUGGESTIONS: readonly ErrorsSuggestion[] = [
  /**
   * ★ These point OUT of the template, at the host app — so they are the one
   *   link set here that deliberately does NOT compose from `ERRORS_BASE`.
   *   Replace them with the places YOUR visitors look for; this is the line to
   *   change.
   *
   * ★ There is no "home" entry: the pages that show these (404, 410) already
   *   lead with a "Go home" button bound to `ERRORS_BRAND.homeLink`. The list
   *   used to open with "Dashboard" → `/templates/admin`, the kit gallery's own
   *   dashboard — a route that does not exist in a downloaded project or in
   *   your app, so the most prominent suggestion was the one link guaranteed
   *   to miss.
   */
  { label: 'Documentation', href: '/docs', icon: 'book-open' },
  { label: 'Components', href: '/components', icon: 'grid' },
];

/**
 * ============================================================
 *  Where the data comes from
 * ============================================================
 *  The maintenance and coming-soon pages each offer a "notify me" email
 *  capture. Leave `baseUrl` empty and it resolves after `demoLatencyMs`
 *  without leaving the browser; point it at your API and it POSTs there.
 * ============================================================
 */
export interface ErrorsApiConfig {
  readonly baseUrl: string;
  readonly demoLatencyMs: number;
}

export const ERRORS_API: ErrorsApiConfig = {
  baseUrl: '',
  demoLatencyMs: 400,
};
