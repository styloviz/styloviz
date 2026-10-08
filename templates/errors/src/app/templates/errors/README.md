# Styloviz Errors Template

**Fourteen** system pages every app eventually needs and none should have to
design from scratch — every common 4xx and 5xx, plus offline, maintenance and
coming-soon. A **self-contained folder** you can copy into your own app: its own
shell, routes, and a catalogue that makes a fifteenth page a five-line change.

| | | | |
|---|---|---|---|
| `400` Bad request | `401` Not signed in | `403` Forbidden | `404` Not found |
| `408` Timed out | `410` Gone | `429` Rate limited | `500` Server error |
| `502` Bad gateway | `503` Unavailable | `504` Gateway timeout | `offline` |
| `maintenance` | `coming-soon` | | |

Mounted at **`/templates/errors`** (for browsing), themed with a calm **slate / amber**
identity; each page's severity colour comes from its own catalogue entry.

## What's inside

```
errors/
  errors-layout.component.*   shell: logo, theme toggle, and a demo page index
  errors.config.ts            ERRORS_BRAND · ERRORS_SUGGESTIONS · ERRORS_API
  errors.data.ts              ★ ERROR_CATALOGUE — every page, as data
                              + notifySubscribe / newReferenceId / supportMailto
  errors.routes.ts            ERRORS_ROUTES (lazy child routes, for browsing)
  pages/
    error-page.component.*    ★ the one presenter every page renders through
    code-page.component.*     resolves a catalogue entry from route data
    not-found / server-error / unavailable / maintenance / coming-soon
                              named wrappers, for the routes an app wires directly
```

## The pages are data, not components

The template used to ship five near-identical components, so the sixth error
anybody needed was a sixth copy of the same markup — which is how a kit ends up
with a 403 whose actions are worded differently from its 401, and a 502 nobody
remembered to give a retry button.

Now every page is a row in `ERROR_CATALOGUE`:

```ts
'403': {
  key: '403', code: '403', label: 'Forbidden', tone: 'warning', icon: 'lock',
  title: 'You do not have access to this',
  message: 'Your account is signed in, but it does not have permission…',
  tips: ['Ask a workspace admin to grant you access.', …],
  actions: [GO_BACK_PRIMARY, { id: 'support', label: 'Request access', style: 'secondary' }],
},
```

**Adding a page is a catalogue row plus a `codeRoute(...)` line.** A spec
asserts the two stay in step in both directions — an entry with no route is a
page nobody can reach, and a route with no entry renders the 404 fallback while
claiming to be something else.

## What each page can do

| Capability | Where it shows up | Why |
|---|---|---|
| **What you can try** | every page with tips | "Something went wrong" tells somebody what they already knew |
| **Support reference** + copy | 5xx only | the only part of a 500 that shortens the conversation with support |
| **Auto-retry countdown** | 408 · 429 · 502 · 503 | a 503 that clears in 40s shouldn't need someone pressing a button to find out — with a **Stop**, because a countdown you can't cancel reloads while you read |
| **Search + suggestions** | 404 · 410 | the most useful thing a 404 can do is offer the three places you probably meant |
| **Requested path, echoed** | 404 · 410 | on a 404 the typo is in the URL, and the URL is the one thing you can no longer see |
| **Live connection watch** | offline | listens for `online` and flips by itself, so nobody wonders if it's safe to press anything |
| **Notify me** | maintenance · coming-soon | the one write this template makes |

## Three rules the catalogue enforces

**Exactly one primary action per page.** Two solid buttons side by side is two
things claiming to be the obvious next step, which is the same as none. The 500
page shipped with "Try again" and "Go home" both solid until a test existed for
it.

**A reference is for 5xx only.** On a 404 it is noise, and it teaches people to
quote a number that means nothing to whoever picks up the ticket.

**Auto-retry only where a retry can fix it.** A 403 that reloads every twenty
seconds is a page that will never stop being forbidden — and any page that
retries by itself must also offer a manual retry.

## 410 is not 404, and 504 is not 500

Two entries earn their place by being careful about wording:

- **410 Gone** promises that looking again will not help. That is the one thing
  that stops somebody retrying the same dead link all afternoon.
- **504 Gateway timeout** says the request *may or may not* have completed —
  because that is the truth of a 504, and telling somebody to blindly retry a
  payment is how they pay twice.

## Using these as your app's actual error pages

The routes in `errors.routes.ts` are for browsing the five pages in one
place; they are **not** how a real app reaches them. Wire each page where it
actually belongs:

- **404** — your root routes' wildcard (`{ path: '**', loadComponent: () => import('./templates/errors/pages/not-found.component')... }`), not a redirect to `''`.
- **500 / 503** — your global `ErrorHandler` or an HTTP interceptor that
  navigates here on an unrecoverable response.
- **maintenance** — a route guard fed by a feature flag / health check.
- **coming-soon** — a route guard fed by a launch-date flag.

See `CUSTOMIZING.md`.
