# Styloviz Auth Template

A standalone **forgot-password / reset-password** flow — the two auth pages
every app needs and that don't belong to any one product template. It is a
**self-contained folder** you can copy into your own app: its own shell,
theme, routes, and mock/live data switch.

Mounted at **`/templates/auth`**, themed with an **indigo / sky** identity, and laid out
as a split screen: a brand panel that explains what is happening to the account
beside the form that does it.

## Why only these two pages

`auth-login`, `auth-register` and `auth-otp` already ship inside the store
template (`src/app/templates/store/pages/auth`) — a full sign-in flow makes
sense bundled with a storefront that has accounts to sign into. Forgot/reset
password is different: it is reached from an email link, often *before* the
visitor has any session with the app, so it is packaged here on its own for
buyers who want just this piece next to whatever auth they already have.

## What's inside

```
auth/
  auth-layout.component.*   split shell: brand panel + form column + footer
  auth.config.ts            AUTH_BRAND · AUTH_PANEL · AUTH_SUPPORT ·
                            AUTH_PASSWORD_POLICY · AUTH_API (single edit point)
  auth.data.ts              authRequestReset / authConfirmReset,
                            passwordRules / passwordMeetsPolicy, maskEmail
  auth.routes.ts            AUTH_ROUTES (lazy child routes)
  pages/
    forgot-password.component.*  email → "check your inbox" (masked, with resend)
    reset-password.component.*   token + new password → confirmation
```

## What these pages do

| Surface | What it is for |
| --- | --- |
| **Brand panel** | The half of the screen that is not the form — what happens to the account and what protects it. Content, from `AUTH_PANEL`, not decoration |
| **Ask** | Email with a leading icon; submit stays disabled until the address parses |
| **Sent** | Masked address, conditional wording, a **resend cooldown**, and a webmail shortcut for domains we know |
| **Reset** | Strength meter, a **live policy checklist**, a Caps Lock warning, match confirmation |
| **No token** | Says the link is single-use and expired, and offers a new one |
| **Done** | Confirms, and says that every other session was signed out |

## Three things this flow gets right

**It never says who has an account.** The response is identical whether or not
the address is registered — and the confirmation screen says "*if* an account
exists" and shows the address **masked**. A page that says "we sent a link to
sophie@acme.com" has just confirmed that sophie@acme.com is a user; account
lists leak exactly that way, one guess at a time.

**One function decides what a valid password is.** `passwordRules()` returns
every rule with its met/unmet flag. The checklist renders from it and
`passwordMeetsPolicy` is "all of them" — so the button and the ticks cannot
disagree. Written separately, they drift, and the person who meets the drift is
staring at a disabled button above a list of green ticks with no way to tell
which one is lying.

**Resend is rate-limited in the UI.** Four presses produce four links of which
only the newest works; whoever clicks the oldest gets an "expired" page they
have no way to explain. The cooldown is `AUTH_RESEND_COOLDOWN_SECONDS`.

## One bug worth knowing about

The old form used `space-y-4` around `<sv-input-field>` and `<sv-button>`, and
the button rendered **welded to the bottom of the input**. Neither component
declares a host `display`, so both compute to `display: inline` — and vertical
margins do nothing on a non-replaced inline element. `space-y-*` sets
`margin-top` on the second child, so the class applied, passed every check, and
did nothing.

Both forms now use `flex flex-col gap-*`: `gap` is set on the container rather
than on the children, and flex blockifies its items on the way past. **Use
`flex`+`gap` around `sv-*` components, not `space-y-*`.**

## Pages

| Route | Page |
|---|---|
| `/templates/auth/forgot-password` | Request a reset link by email |
| `/templates/auth/reset-password?token=…` | Set a new password against that token |

## Mounting it

Already wired in `src/app/app.routes.ts`:

```ts
{
  path: 'auth',
  loadChildren: () =>
    import('./templates/auth/auth.routes').then(m => m.AUTH_ROUTES),
}
```

## Demo behaviour (read before going live)

With `AUTH_API.baseUrl` empty, `/templates/auth/forgot-password` never emails anyone —
there is no backend to. Instead, after "sending," the page offers a
**"Continue to reset password (demo)"** button that links straight to
`/templates/auth/reset-password?token=demo-<email>`, so the whole flow is click-through
demoable with no server. That button disappears the moment you set
`AUTH_API.baseUrl` — see `CUSTOMIZING.md`.

The forgot-password response never reveals whether the email has an account;
keep that property when you wire a real backend (see `auth.data.ts`).

`AUTH_PASSWORD_POLICY` is a **courtesy, not a control** — mirror it on the
server. A client that decides what a valid password is, is a client an attacker
does not have to use.
