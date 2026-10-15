# Adding the Styloviz Auth Template to an existing app

Version: **1.0.2**

> **Just want to run it?** You don't need this file. This download is a complete
> Angular project — see **README.md** (`npm install && npm start`).

Use this guide when you already have an Angular app and want the template inside
it. The template is **editable source**: copy it in and make it yours.

## 1. Requirements

- Angular **21 or 22** (this download was built with ^22.2.0), standalone
  APIs, TypeScript strict mode.
- Tailwind CSS **4** set up in the app (`@tailwindcss/postcss` + a
  `.postcssrc.json`, as in this project).

## 2. Install the Styloviz packages

The template needs these packages (derived from its source, including their
Styloviz peer dependencies):

**Free** — from public npm:
```bash
npm i \
  @styloviz/alert-banner \
  @styloviz/button \
  @styloviz/core \
  @styloviz/forms \
  @styloviz/icons \
  @styloviz/input-field \
  @styloviz/layout \
  @styloviz/password-strength \
  @styloviz/toast
```

## 3. Copy the files

| From this download | To your app |
|---|---|
| `src/app/templates/auth/` | `src/app/templates/auth/` (any folder works; keep it together) |
| `public/demo/`, `public/fonts/` | your `public/` folder (skip fonts if you use your own) |

## 4. Register the route

```ts
// app.routes.ts
export const routes: Routes = [
  {
    path: 'templates/auth',
    loadChildren: () =>
      import('./templates/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
];
```

`AUTH_BASE` in `src/app/templates/auth/auth.config.ts` must match that path —
every internal link is built from it:

```ts
export const AUTH_BASE = '/templates/auth';   // mount it anywhere; keep this in step
```

## 5. Wire up the styles

In your global Tailwind stylesheet (usually `src/styles.css`):

1. **Let Tailwind see the Styloviz components.** Tailwind v4 skips
   `node_modules`, so without these lines every component renders unstyled:

   ```css
   @source "../node_modules/@styloviz";
   @source "../node_modules/@styloviz-pro";
   ```

2. **Class-based dark mode**, if your app does not already have it:

   ```css
   @custom-variant dark (&:where(.dark, .dark *));
   ```

3. **The template's colours** — paste both blocks from
   `styles.auth-tokens.css`.

4. **Kit design tokens and animations** — the components use the `@theme`
   tokens (primary/semantic colours, radius, shadows) and the keyframes defined in
   this download's `src/styles.css`. The simplest route is to start from that
   file and merge in your own rules.

## 6. Providers (recommended)

Copy the `provideSvLinkAdapter(...)` and `provideSvOverlayRouteClose(...)`
providers from `src/app/app.config.ts`. Without them, Styloviz breadcrumbs and
menus fall back to full page loads, and open dialogs stay open across navigation.

## 7. Run it

Start your app and visit `/templates/auth`.

## Make it yours

See `src/app/templates/auth/CUSTOMIZING.md` for rebranding (name, logo, colours),
navigation, adding pages, wiring real data, and theming.

---

_Package manifest: `template.manifest.json`. Licence: `LICENSE.txt`._
