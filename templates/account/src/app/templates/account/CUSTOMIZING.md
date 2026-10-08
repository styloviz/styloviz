# Customizing the Account template

## 1. Branding

Edit **`account.config.ts`** — one place changes the top-bar wordmark, footer,
and the demo signed-in member:

```ts
export const ACCOUNT_BRAND = {
  name: 'styloviz', nameAccent: ' Account',
  logoSrc: 'logo-icon-sm.svg', logoAlt: 'styloviz Account logo',
  homeLink: '/', copyright: 'styloviz',
};
```

## 2. Colours / theme

The teal/cyan accent lives in a **scoped block** in `src/styles.css`, between
the `>>> template-tokens: account` markers. The shell carries the
`tpl-account` class, so every `brand-*` / `brandaccent-*` utility inside
resolves to this palette — change the values, not the markup:

```css
/* >>> template-tokens: account */
.tpl-account {
  --color-brand-500: #14b8a6;       /* your primary accent ramp   */
  --color-brandaccent-500: #06b6d4; /* secondary / gradient ramp */
}
/* <<< template-tokens: account */
```

Dark mode uses `ThemeService` from `@styloviz/core` directly (see
`account-layout.component.ts`) — the same toggle a host app almost certainly
already has, rather than a second, template-local one.

## 3. Tabs

`AccountLayoutComponent.tabs` (in `account-layout.component.ts`) is the whole
top nav. Add, remove, or relabel entries there; each just needs a route under
`account.routes.ts`.

## 4. Wiring a real backend

### One constant

Set `ACCOUNT_API.baseUrl` in `account.config.ts`:

```ts
export const ACCOUNT_API: AccountApiConfig = {
  baseUrl: '/api',       // ← was ''
  demoLatencyMs: 400,    // ignored once baseUrl is set
};
```

Both pages read exclusively through `account.data.ts` (`accountSource`,
`accountRecord`, `accountUpdate`) — nothing in `pages/` changes. With
`baseUrl` set:

- `GET  /api/account/settings` → the profile/security/notifications record
- `PATCH /api/account/notifications/:key` → one notification toggle
- `GET  /api/account/team?offset=0&limit=500` → the team roster
- `PATCH /api/account/password/password` `{ currentPassword, newPassword }` → change the password
- `POST /api/account/recovery-codes` → `{ codes: string[] }`, a fresh set (the old ones stop working)
- `POST /api/team` `{ email, role }` → the invited member; `POST /api/team/:id/resend`; `DELETE /api/team/:id`
- `GET  /api/account/billing` → plan, payment method and invoices (each invoice may carry a `pdfUrl`)

Billing actions — change plan, cancel, seats, card — go to your provider's
hosted portal: set `ACCOUNT_BILLING.portalUrl` (https) in `account.config.ts`.
Left empty, those buttons are not rendered. `invoiceArchiveUrl` does the same
for "Download all", and an invoice without a `pdfUrl` shows no PDF button.

Adjust the paths by editing the string literals passed to `accountRecord(...)`
/ `accountSource(...)` in `pages/profile.component.ts` and
`pages/team.component.ts`.

### Replacing the fixtures

`fixtures/profile.fixture.ts` and `fixtures/team.fixture.ts` are only served
while `baseUrl` is empty. Edit them to change what the demo shows; they are
never read once a backend is configured.

See `/docs/connecting-to-a-backend` for pagination presets if your API
paginates differently than offset/limit.

---

## Adding a page

Three edits: a fixture, a route, a tab.

```ts
// account.routes.ts
{ path: 'api-keys', title: 'API keys · Account',
  loadComponent: () => import('./pages/api-keys.component').then(m => m.AccountApiKeysComponent) },

// account-layout.component.ts
{ link: '/templates/account/api-keys', exact: false, label: 'API keys', icon: 'lock' },
```

Wrap the page body in `<sv-account-async>` and read through `accountRecord` /
`accountSource` — that is what gives it the same loading, failure and retry
frames as every other page, for free.

⚠️ **Icons must be in the FREE registry** (`projects/icons-free`). This
template ships with zero Pro dependencies, and `icon` is bound dynamically in
the layout (`[name]="t.icon"`), so `npm run check:icons` cannot see it — a
Pro-only name renders blank with nothing failing.

## Profile completeness

```ts
profileChecks(account): readonly ProfileCheck[]   // every check, with a `done` flag
profileCompleteness(account): number              // the ticked fraction, 0–100
```

Both live in `fixtures/profile.fixture.ts`. **Add a check in one place** and the
meter, the percentage and the checklist all pick it up. A spec asserts the
percentage is always exactly the ticked fraction, so the two cannot drift.

## The notification matrix

`AccountNotifPref.enabled` is the **email** channel and keeps that name on
purpose — it is the field a wired backend already sends, and renaming it would
break every consumer for a cosmetic gain. `push` and `inApp` are optional, so a
payload from an older API renders as email-only rather than throwing.

Each switch commits `{ [channel]: next }` for one key, so the PATCH body stays
the smallest thing that describes the change:

```ts
toggleChannel(key: string, channel: NotifChannel): void
```

Add a channel by extending `NotifChannel` and adding a column to `CHANNELS` in
`profile.component.ts`.

## Billing quotas

```ts
quotaPercent(q): number | null   // null = uncapped; capped values clamp at 100
quotaTone(q): 'ok' | 'warn' | 'over'
```

⚠️ **`null` is not zero.** An uncapped quota renders as a number with no rail —
drawing a bar at 0% invents a limit, and at 100% invents a full one.

## Sessions

`revokeOtherSessions()` filters on `session.current` and never revokes it.
Signing the member out of the page they are standing on, mid-task, from a
button that looked like housekeeping is the failure mode this avoids. Wire the
current session's id from your own session endpoint.

## Button colour

Every `sv-button` variant paints from a token family, so `variant="primary"`
follows the `primary-*` remap in `src/styles.css` and comes out teal here —
same as `sv-tabs`, `sv-input-field`, `sv-toggle-switch` and
`sv-password-strength`.

This template's primary CTAs still use `variant="neutral"`, but now as a
**design choice** rather than a workaround: a dark button reads deliberate
beside a teal accent and clears AA comfortably. Switch them to
`variant="primary"` if you would rather the CTAs carry the accent.

The one exception is `btnStyle="gradient"`, whose far stop stays a literal hue
on `success`, `warning` and `info` — a gradient needs two colours that differ,
and folding both ends into one family would paint them identically the moment
you remap it.
