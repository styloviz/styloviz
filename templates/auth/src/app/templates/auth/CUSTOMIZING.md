# Customizing the Auth template

## 1. Branding

Edit **`auth.config.ts`**:

```ts
export const AUTH_BRAND = {
  name: 'styloviz', nameAccent: '',
  logoSrc: 'logo-icon-sm.svg', logoAlt: 'styloviz logo',
  homeLink: '/',
};

// The "I still cannot get in" links in the footer and on the reset pages.
// Point them at your real help desk and status page; the status link opens
// in a new tab. The demo uses an invented `.example` brand.
export const AUTH_SUPPORT = {
  helpLabel: 'Contact support', helpHref: 'mailto:support@styloviz.example',
  statusLabel: 'System status', statusHref: 'https://status.styloviz.example',
};
```

## 2. Colours / theme

The indigo/sky accent lives in a **scoped block** in `src/styles.css`,
between the `>>> template-tokens: auth` markers. The shell carries the
`tpl-auth` class, so every `brand-*` / `brandaccent-*` utility inside
resolves to this palette:

```css
/* >>> template-tokens: auth */
.tpl-auth {
  --color-brand-500: #6366f1;       /* your primary accent ramp   */
  --color-brandaccent-500: #0ea5e9; /* secondary / gradient ramp */
}
/* <<< template-tokens: auth */
```

Dark mode uses `ThemeService` from `@styloviz/core` directly — no
template-local theme service to duplicate for two pages.

## 3. Wiring a real backend

### One constant

Set `AUTH_API.baseUrl` in `auth.config.ts`:

```ts
export const AUTH_API: AuthApiConfig = {
  baseUrl: '/api',      // ← was ''
  demoLatencyMs: 500,   // ignored once baseUrl is set
};
```

With `baseUrl` set:

- `POST /api/auth/forgot-password` `{ email }` — issue a reset email.
  Respond identically whether or not the address has an account; the page
  never distinguishes the two, and neither should your API.
- `POST /api/auth/reset-password` `{ token, password }` — consume the token
  and set the new password. Reject an expired/used token with a 4xx; the
  page renders "That link has expired or was already used."
- `POST /api/auth/sign-in` `{ email, password, remember }` — answer
  `{ requiresTwoFactor }`, and the same 4xx for "no such user" as for "wrong
  password". `remember` is the "Keep me signed in" box.
- `POST /api/auth/register` `{ name, email, password }` — create the account.
- `POST /api/auth/verify` `{ code }` and `POST /api/auth/verify/resend` `{}` —
  check a second-factor code, and send a fresh one.
- `POST /api/auth/unlock` `{ password }` — reopen a locked session.

The demo-only **"Continue to reset password (demo)"** button on the
forgot-password success screen is gated on `isAuthWired()` and disappears
automatically once `baseUrl` is set — there is nothing to remove by hand.

### Password rules

Client-side validation (`MIN_LENGTH = 8`, "passwords match") lives in
`pages/reset-password.component.ts`. Keep it in sync with whatever your API
actually enforces, and always re-check server-side — the client check is a
UX nicety, not the security boundary.

---

## 6. The brand panel

The left half is content, and it lives in `auth.config.ts` so it is edited in
one place rather than in the layout's markup:

```ts
export const AUTH_PANEL: AuthPanel = {
  headline: 'Get back in, safely.',
  subhead:  'Resetting a password should take a minute and tell you exactly …',
  points: [
    { icon: 'shield-check', title: 'We never say who has an account', body: '…' },
    { icon: 'clock',        title: 'Links expire',                     body: '…' },
    { icon: 'lock',         title: 'Your other sessions end',          body: '…' },
  ],
  trust: ['SSO ready', '2FA supported', 'SOC 2 Type II'],
};
```

**To drop the panel entirely**, set `points: []`. The layout falls back to the
form column alone on a plain canvas — no markup to delete.

The wash is two radial gradients plus a grid, all in CSS: no image to download,
and nothing that needs a second asset for dark mode.

⚠️ **`AUTH_PANEL.points[].icon` is bound dynamically** (`[name]="point.icon"`),
so `npm run check:icons` cannot see it — it only reads literal
`<sv-icon name="…">`. This template renders through the **free** `sv-icon`, so a
Pro-only name here renders blank with nothing failing. Check a new name against
`projects/icons-free` before using it. (The same blind spot applies to `icon="…"`
attributes on `sv-button`, `sv-badge` and friends.)

## 7. The password policy

One object decides what counts as acceptable, and both the checklist and the
submit button read it:

```ts
export const AUTH_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireLetter: true,
  requireNumber: true,
  requireSymbol: false,
};
```

`passwordRules(password, policy?)` returns **every** rule with a `met` flag —
that is what the `<li>`s render from — and `passwordMeetsPolicy()` is "all of
them", which is what enables Save. Add a rule by adding a flag to
`PasswordPolicy` and a branch to `passwordRules`; the UI follows for free.

⚠️ **Mirror it on the server.** A client-side policy is a courtesy. The button
being disabled is not a control over anything.

The strength meter (`sv-password-strength`) is deliberately **advice, not a
gate** — it scores what you typed, it does not block. The policy blocks.

## 8. Resend cooldown

```ts
export const AUTH_RESEND_COOLDOWN_SECONDS = 30;
```

The timer is started from the click handler, never a lifecycle hook: hooks run
during a prerender, where there is no `setInterval` and no user to count down
for. It is cleared through `DestroyRef.onDestroy` behind a null check, so the
server — which never starts one — never calls `clearInterval` either.

## 9. Webmail shortcuts

`MAIL_PROVIDERS` in `forgot-password.component.ts` maps a domain to an inbox
URL. Only add providers whose URL is stable: a shortcut that guesses wrong sends
somebody to a login page for an account they do not have, which is worse than
offering nothing. Unknown domains simply get no button.

## 10. Spacing around `sv-*` components

Use `flex flex-col gap-*`, **not** `space-y-*`.

`sv-input-field`, `sv-button` and `sv-toggle-switch` declare no host `display`,
so they compute to `display: inline` — and vertical margins do nothing on a
non-replaced inline element. `space-y-*` sets `margin-top` on subsequent
children, so it applies cleanly, passes every check, and produces no gap at all.
`gap` is set on the container instead, and flex blockifies its items.
