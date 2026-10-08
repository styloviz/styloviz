# Styloviz Account Template

A standalone **profile / settings / team / billing** template — the part of an
app every SaaS product needs and almost none should have to design from
scratch. It is a **self-contained folder** you can copy into your own app: its
own shell, theme, routes, and data wiring — no dependency on the
marketing/showcase shell or on the admin/store templates.

Mounted at **`/templates/account`**, themed with a calm **teal / cyan** identity.

| Route | Page |
|---|---|
| `/templates/account` | Profile · Security · Notifications, in tabs |
| `/templates/account/team` | The roster — search, role filters, pending invites |
| `/templates/account/billing` | Plan, usage, seats, payment method, invoices |

## Four rules this template keeps

**One function decides what "complete" means.** `profileChecks()` returns every
check with a done flag; `profileCompleteness()` is the ticked fraction. The
meter, the percentage and the checklist all read it, so they cannot disagree —
a card that says "80% complete" over four ticked rows is undebuggable from the
outside, and a test asserts the two can never drift.

**Unlimited is not a bar.** A rail is a promise there is a ceiling to run into.
`quotaPercent()` returns `null` for an uncapped quota so the template renders
the number alone, and clamps an over-limit one to 100 — a 140%-wide bar
overflows its rail and paints over whatever is beside it.

**The last owner cannot be removed — and a second one can.** The old page
disabled Remove for *every* Owner, which is the neighbouring mistake: with two
owners either should be removable, and an account that can never demote its
founder is one nobody can hand over.

**Signing out everywhere keeps the current session.** Revoking every session
including this one signs the member out of the page they are standing on,
mid-task, from a button that looked like housekeeping.

## Why this template exists

The release backlog found "settings / account / profile / team" shipping
**three times over** — once in the admin template's own settings page, again
across `admin/pages/users/*`, and a third time in `store/pages/account/*`.
Rather than a fourth bespoke build, this template packages the same
well-tested composition (tabs, optimistic toggles, a member roster) as its
own drop-in unit for buyers who want *only* this piece.

## What's inside

```
account/
  account-layout.component.*    shell: top bar (tabs, identity, theme) + mobile nav
  account.config.ts             ACCOUNT_BRAND · ACCOUNT_USER · ACCOUNT_API
  account.data.ts               accountSource / accountRecord / accountUpdate
  account-async.component.*     shared loading / error frame for this template
  account.routes.ts             ACCOUNT_ROUTES (lazy child routes)
  fixtures/
    profile.fixture.ts          account, sessions, notification matrix,
                                ★ profileChecks / profileCompleteness
    team.fixture.ts             the roster
    billing.fixture.ts          plan, quotas, payment method, invoices
  pages/
    profile.component.*         identity header, profile form, security, notifications
    team.component.*            stat strip, search, role filters, roster
    billing.component.*         plan card, usage bars, seats, invoices
```

## What each page does

**Profile** — an identity header with a **profile-strength meter**, the
editable form beneath it, and an avatar picker. Save is disabled until
something changes, validates before it fires, and reports success only when
the write actually succeeded.

**Security** — password with a live **strength meter**, two-factor with a real
toggle and a recovery-code count, and **active sessions** with per-device sign
out. Sessions are the only thing on this page that answers *"is someone else
in my account?"* — which is the question that brings people here.

**Notifications** — a **channel matrix** (Email · Push · In-app) rather than a
single column. The old page had one switch per event and called it "Email
Notifications", so the only answer it could give was all-or-nothing. People
want the mention on their phone and the digest in their inbox.

**Team** — a stat strip, search across name *and* email, role filters, pending
invites with a resend, and the owner rule below.

**Billing** — plan, usage bars, seats, payment method with an expiry warning,
and invoices.

## Pages

| Route | Page |
|---|---|
| `/templates/account` | Profile, security (password + 2FA), notification preferences |
| `/templates/account/team` | Team roster — avatar, email, role, invited/active status |

## Mounting it

Already wired in `src/app/app.routes.ts`:

```ts
{
  path: 'account',
  loadChildren: () =>
    import('./templates/account/account.routes').then(m => m.ACCOUNT_ROUTES),
}
```

## Data

Both pages read through `account.data.ts`. Leave `ACCOUNT_API.baseUrl` empty
and they serve the bundled fixtures with realistic latency; set it and every
page starts talking to your API — see `CUSTOMIZING.md` and
`/docs/connecting-to-a-backend`.

See `CUSTOMIZING.md` for rebranding, theming, and wiring a real backend.
