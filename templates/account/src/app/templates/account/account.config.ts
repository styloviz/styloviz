/**
 * ============================================================
 *  Account Template — Central Configuration
 * ============================================================
 *  Single edit point for branding the account/settings shell.
 *  Change the values below to rebrand the header wordmark and
 *  the default signed-in member.
 *
 *  To recolour the shell, edit the `.tpl-account` accent tokens in
 *  `src/styles.css` (brand = teal, brandaccent = cyan).
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
export const ACCOUNT_BASE = '/templates/account';

/** Branding shown throughout the account shell. */
export interface AccountBrand {
  /** Primary wordmark text, e.g. "styloviz". */
  readonly name: string;
  /** Accented suffix rendered in the brand colour, e.g. " Account". */
  readonly nameAccent: string;
  /** Logo asset path, relative to the app's public/ folder. */
  readonly logoSrc: string;
  readonly logoAlt: string;
  /** Router link the logo (and any "back to app" affordance) navigates to. */
  readonly homeLink: string;
  /** Company / product name shown in the footer copyright line. */
  readonly copyright: string;
}

export const ACCOUNT_BRAND: AccountBrand = {
  name: 'styloviz',
  nameAccent: ' Account',
  logoSrc: 'logo-icon-sm.svg',
  logoAlt: 'styloviz Account logo',
  homeLink: '/',
  copyright: 'styloviz',
};

/** Default signed-in member shown in the header (demo data). */
export interface AccountUser {
  readonly name: string;
  readonly email: string;
  readonly avatar: string;
}

export const ACCOUNT_USER: AccountUser = {
  name: 'Sophie Lang',
  email: 'sophie@acme.com',
  avatar: '/demo/avatar-1.svg',
};

/**
 * Where billing actions go.
 *
 * ★★ THIS TEMPLATE DOES NOT TAKE PAYMENTS, AND IT DOES NOT PRETEND TO. Plan
 *    changes, cancellations, seats and cards belong to your billing provider's
 *    hosted portal. Set `portalUrl` and those five buttons open it in a new
 *    tab; leave it empty and they are not rendered at all — a button that
 *    looks like it changes your plan and does nothing is worse than no button.
 */
export interface AccountBillingConfig {
  /** Your provider's customer portal (https). Empty hides the portal buttons. @default '' */
  readonly portalUrl: string;
  /** A download of every invoice at once (https). Empty hides "Download all". @default '' */
  readonly invoiceArchiveUrl: string;
}

export const ACCOUNT_BILLING: AccountBillingConfig = {
  portalUrl: '',
  invoiceArchiveUrl: '',
};

/**
 * ============================================================
 *  Where the data comes from
 * ============================================================
 *  Leave `baseUrl` empty and the profile/security/notifications page and the
 *  team page both serve bundled fixtures through `@styloviz/data`'s array
 *  source — same filtering/paging semantics a server would apply. Point it at
 *  your API and every page on this template starts talking to it; nothing
 *  else changes. See `/docs/connecting-to-a-backend`.
 * ============================================================
 */
export interface AccountApiConfig {
  /** API root. Empty string keeps the bundled fixtures. @default '' */
  readonly baseUrl: string;
  /**
   * Artificial delay applied to the fixtures only, in ms. Not padding — a
   * template that answers instantly hides every skeleton it has. Ignored
   * once `baseUrl` is set.
   * @default 400
   */
  readonly demoLatencyMs: number;
}

export const ACCOUNT_API: AccountApiConfig = {
  baseUrl: '',
  demoLatencyMs: 400,
};
