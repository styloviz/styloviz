/**
 * ============================================================
 *  Auth Template — Central Configuration
 * ============================================================
 *  Single edit point for branding the forgot/reset-password shell.
 *
 *  To recolour the shell, edit the `.tpl-auth` accent tokens in
 *  `src/styles.css` (brand = indigo, brandaccent = sky).
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
export const AUTH_BASE = '/templates/auth';

/** Branding shown on both auth pages. */
export interface AuthBrand {
  /** Primary wordmark text, e.g. "styloviz". */
  readonly name: string;
  /** Accented suffix rendered in the brand colour. */
  readonly nameAccent: string;
  /** Logo asset path, relative to the app's public/ folder. */
  readonly logoSrc: string;
  readonly logoAlt: string;
  /** Router link the logo (and "Return home") navigates to. */
  readonly homeLink: string;
}

export const AUTH_BRAND: AuthBrand = {
  name: 'styloviz',
  nameAccent: 'id',
  logoSrc: 'logo-icon-sm.svg',
  logoAlt: 'styloviz logo',
  homeLink: '/',
};

/** One selling point on the brand panel. */
export interface AuthPanelPoint {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

/**
 * The half of the screen that is not the form.
 *
 * ★★ IT IS CONTENT, NOT DECORATION — which is why it lives in config rather
 * than being hard-coded in the layout. A buyer's sign-in page is one of the
 * few pages every single user sees; leaving it as a stock gradient wastes the
 * one moment they are looking at nothing else.
 *
 * ★ It is also the first thing to delete. `AUTH_PANEL.points = []` drops the
 * feature list, and the layout falls back to a centred card on a plain canvas
 * — see CUSTOMIZING.md.
 */
export interface AuthPanel {
  readonly headline: string;
  readonly subhead: string;
  readonly points: readonly AuthPanelPoint[];
  /** Short reassurance chips along the bottom. */
  readonly trust: readonly string[];
}

export const AUTH_PANEL: AuthPanel = {
  headline: 'Get in, safely.',
  subhead:
    'Signing in should take a moment and tell you exactly what is happening at every step.',
  points: [
    {
      icon: 'shield-check',
      title: 'We never say who has an account',
      body: 'Sign-in and password reset answer identically whether or not the address is registered.',
    },
    {
      icon: 'lock',
      title: 'A second factor, when it matters',
      body: 'Codes and recovery codes, with a way through when the phone is not to hand.',
    },
    {
      icon: 'landmark',
      title: 'Single sign-on by domain',
      body: 'Enter a work email and we find the provider — nobody has to know their tenant id.',
    },
    {
      icon: 'lock',
      title: 'Your other sessions end',
      body: 'Changing a password signs out every device that was already signed in.',
    },
  ],
  trust: ['SSO ready', '2FA supported', 'SOC 2 Type II'],
};

/**
 * Where "I still cannot get in" goes.
 *
 * ★ Point both at destinations your product really has. The demo used to ship
 *   `/support` and `/status` — app routes that exist in no app, so on the live
 *   demo both links fell through to the kit's home page, and in a downloaded
 *   project to whatever the host's wildcard route does. The defaults are now
 *   real destinations of the invented brand: a `mailto:` that opens the
 *   visitor's mail client, and a status page on a reserved `.example` host
 *   (the convention every template uses for invented addresses), opened in a
 *   new tab because a status page is a different site.
 */
export interface AuthSupport {
  readonly helpLabel: string;
  readonly helpHref: string;
  readonly statusLabel: string;
  readonly statusHref: string;
}

export const AUTH_SUPPORT: AuthSupport = {
  helpLabel: 'Contact support',
  helpHref: 'mailto:support@styloviz.example',
  statusLabel: 'System status',
  statusHref: 'https://status.styloviz.example',
};

/**
 * ============================================================
 *  What counts as an acceptable password
 * ============================================================
 *  ★★★ ONE SOURCE FOR THE RULES.
 *
 *  The checklist the user reads, the thing that enables the submit button and
 *  the copy under the field all derive from this object. Written separately —
 *  a regex in the component, a sentence in the template, a hint in the field —
 *  they drift, and the first person to meet the drift is somebody staring at a
 *  disabled button that the checklist says should be enabled.
 *
 *  Mirror it on the server. A client-side policy is a courtesy, not a control.
 * ============================================================
 */
export interface PasswordPolicy {
  readonly minLength: number;
  readonly requireLetter: boolean;
  readonly requireNumber: boolean;
  readonly requireSymbol: boolean;
}

export const AUTH_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireLetter: true,
  requireNumber: true,
  requireSymbol: false,
};

/**
 * How long the "Resend" button stays disabled, in seconds.
 *
 * ★ A resend with no cooldown is a send button somebody presses four times and
 * then wonders which of the four links is the live one. (Only the newest is —
 * which is exactly why the countdown is worth the code.)
 */
export const AUTH_RESEND_COOLDOWN_SECONDS = 30;

/**
 * ============================================================
 *  Where the data comes from
 * ============================================================
 *  Leave `baseUrl` empty and both pages resolve after `demoLatencyMs` without
 *  ever leaving the browser — safe to click through in a demo. Point it at
 *  your API and the two requests below hit it instead; nothing else in
 *  `pages/` changes.
 * ============================================================
 */
export interface AuthApiConfig {
  /** API root. Empty string keeps the demo-only mock flow. @default '' */
  readonly baseUrl: string;
  /** Artificial delay applied to the mock flow only, in ms. @default 500 */
  readonly demoLatencyMs: number;
}

export const AUTH_API: AuthApiConfig = {
  baseUrl: '',
  demoLatencyMs: 500,
};

/**
 * ============================================================
 *  Sign-in, registration and the screens either side of them
 * ============================================================
 */

/** One identity provider offered on the sign-in and enterprise screens. */
export interface AuthSsoProvider {
  /** Stable id sent to your backend, e.g. `'google'`. */
  readonly id: string;
  readonly label: string;
  /** Name of an icon in `@styloviz/icons`. */
  readonly icon: string;
}

/**
 * ★ Order matters more than count. The provider most of your users actually
 * have should be first — a sign-in screen offering six equal buttons makes
 * everybody stop and choose, which is the opposite of the point.
 */
export const AUTH_SSO_PROVIDERS: readonly AuthSsoProvider[] = [
  { id: 'google', label: 'Continue with Google', icon: 'google' },
  { id: 'github', label: 'Continue with GitHub', icon: 'github' },
  { id: 'saml', label: 'Continue with SSO', icon: 'landmark' },
];

/** How many digits the verification code has. */
export const AUTH_OTP_LENGTH = 6;

/**
 * The identity the lock screen shows.
 *
 * ★★ A lock screen knows who it locked. Asking for an email again would make
 * it a sign-in page wearing the wrong title — the whole affordance is "it is
 * still you, just prove it", and the way that is communicated is by naming the
 * person before asking for anything.
 */
export interface AuthLockedUser {
  readonly name: string;
  readonly email: string;
  /** Two letters, shown when there is no avatar to load. */
  readonly initials: string;
}

export const AUTH_LOCKED_USER: AuthLockedUser = {
  name: 'Ava Chen',
  email: 'ava.chen@northwind.example',
  initials: 'AC',
};

/**
 * Email domains already enrolled in enterprise SSO.
 *
 * ★ The enterprise screen asks for an email and then routes on the DOMAIN, so
 * a user never has to know whether their company bought SSO. Replace this with
 * a lookup against your own tenant table; the page does not care where the
 * answer comes from.
 */
export const AUTH_SSO_DOMAINS: Readonly<Record<string, string>> = {
  'northwind.example': 'Northwind Labs',
  'vireo.example': 'Vireo Health',
  'glenrock.example': 'Glenrock Energy',
};
