# Customizing the Errors template

## 1. Branding

Edit **`errors.config.ts`** — wordmark, home link, and the support email
shown on the 500 page:

```ts
export const ERRORS_BRAND = {
  name: 'styloviz', nameAccent: '',
  logoSrc: 'logo-icon-sm.svg', logoAlt: 'styloviz logo',
  homeLink: '/',
  supportEmail: 'support@styloviz.example',
};

// "Check system status" on the 500 / 503 pages — your status page, which
// opens in a new tab. The demo points at an invented `.example` host.
export const ERRORS_STATUS_URL = 'https://status.styloviz.example';

// "Sign in" on the 401 page — your sign-in route.
export const ERRORS_SIGN_IN_URL = '/auth/login';
```

## 2. Colours / theme

The slate/amber accent lives in a **scoped block** in `src/styles.css`,
between the `>>> template-tokens: errors` markers:

```css
/* >>> template-tokens: errors */
.tpl-errors {
  --color-brand-500: #64748b;       /* your primary accent ramp   */
  --color-brandaccent-500: #f59e0b; /* secondary / gradient ramp */
}
/* <<< template-tokens: errors */
```

Note each page's actual status colour (red for 500, amber for 503, …) comes
from `sv-result`'s own `status` input, not from this palette — the shell
accent only touches the logo link and any focus rings.

## 3. Wiring these as your real error pages

See the "Using these as your app's actual error pages" section in
`README.md` — the routes here are a browsing index, not production wiring.

## 4. Wiring a real backend for "notify me"

Set `ERRORS_API.baseUrl` in `errors.config.ts`:

```ts
export const ERRORS_API: ErrorsApiConfig = {
  baseUrl: '/api',      // ← was ''
  demoLatencyMs: 400,   // ignored once baseUrl is set
};
```

`maintenance` and `coming-soon` then `POST /api/notify { email }` through
`notifySubscribe()` in `errors.data.ts` instead of the demo delay.

---

## Adding an error page

Two edits. There is no third.

**1. A row in `ERROR_CATALOGUE` (`errors.data.ts`)**

```ts
'451': {
  key: '451', code: '451', label: 'Unavailable for legal reasons',
  tone: 'warning', icon: 'lock',
  title: 'We cannot show you this here',
  message: 'This content is blocked in your region.',
  tips: ['If you believe this is wrong, contact support.'],
  actions: [GO_HOME, { id: 'support', label: 'Contact us', style: 'secondary' }],
},
```

Add `'451'` to the `ErrorKey` union — TypeScript then refuses to compile until
`ERROR_CATALOGUE` has the row, because it is a `Record<ErrorKey, …>`.

**2. A route in `errors.routes.ts`**

```ts
codeRoute('451', '451', '451 · Unavailable for legal reasons'),
```

…and add the key to `ErrorsLayoutComponent.pages` if you want it in the demo
index. `errors-pages.spec.ts` asserts the catalogue and the routes match in
both directions, so a missed step fails the suite rather than shipping a page
nobody can reach.

### The rules a new entry has to keep

| Rule | Enforced by |
|---|---|
| Exactly one `style: 'primary'` action | `gives every page exactly one primary action` |
| `showReference` on 5xx only | `only offers a support reference where there is something to look up` |
| `autoRetrySeconds` implies a manual retry action | `auto-retries only what a retry can fix` |
| A title, a message, an icon and at least one action | `gives every entry the copy a person needs` |

⚠️ **Icons must be in the FREE registry** (`projects/icons-free`). This template
ships with zero Pro dependencies, and `icon` is bound dynamically
(`[name]="error().icon"`), so `npm run check:icons` cannot see it — a Pro-only
name renders blank with nothing failing.

## Tones

`tone` picks the colour and nothing else: `neutral` · `info` · `warning` ·
`danger`. The classes live in one `TONES` map in `error-page.component.ts`,
written out in full because Tailwind scans source text — a class assembled at
runtime (`` `bg-${tone}-50` ``) is not in the stylesheet.

## The support reference

```ts
newReferenceId(now: number, seed: number): string   // → "ERR-72X1YR-001"
```

⚠️ **Replace this.** In a real app the reference is the id in your error
tracker, and it is only worth showing because somebody can look it up. A value
minted in the browser correlates with nothing. Set it from your error handler
and pass it in.

It is generated inside `afterNextRender` — never a field initialiser. A random
value differs between the server render and the client hydration, and a value
that changes between the two is a mismatch.

## Wiring 404 into your own app

```ts
{ path: '**', loadComponent: () =>
    import('./templates/errors/pages/not-found.component')
      .then(m => m.ErrorsNotFoundComponent) }
```

The five named components exist for exactly this: a `**` wildcard reads better
as `ErrorsNotFoundComponent` than as a route carrying a data bag. Everything
else uses `codeRoute(...)`.

## Deleting the demo chrome

`errors-layout.component.html` ends with a `<footer>` listing every page in the
template. It exists because fourteen pages nobody can find are fourteen pages
nobody evaluates — **delete that one element** when the shell goes into a real
app.

## Offline detection

The `offline` entry sets `watchConnection: true`, which makes the presenter
listen for the window's `online` / `offline` events and flip the banner by
itself. The listeners are added inside `afterNextRender` (there is no window on
a server) and removed through `DestroyRef.onDestroy`.

For an app-wide version, hoist the same two listeners into a service and route
to `/templates/errors/offline` when `navigator.onLine` goes false.
