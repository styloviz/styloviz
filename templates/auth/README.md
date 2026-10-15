# Styloviz Auth Template

The complete set of pre-session screens — sign in with providers, register with a live policy checklist, two-step verification with recovery codes, single sign-on discovered from the email domain, a lock screen that knows who it locked, and the forgot / reset-password pair. Indigo/sky shell, mock-or-live data switch.

| | |
|---|---|
| Version | **1.0.2** |
| Tier | **Free** |
| Built with | Angular 22.2.0, Tailwind CSS 4, TypeScript (strict), standalone components, signals, zoneless change detection |
| Opens at | `http://localhost:4200/templates/auth/login` |

This download is a **complete Angular project**. Install the dependencies, start
it, and you are looking at the same template as the live demo — then make it
yours. Every file is editable source.

---

## Quick start

### 1. Requirements

- **Node.js ^22.22.3 || ^24.15.0 || >=26.0.0** — check with `node -v`. (The Angular CLI refuses to
  run on other versions. [nvm](https://github.com/nvm-sh/nvm) or
  [fnm](https://github.com/Schniz/fnm) make switching easy.)
- **npm 10+** (ships with those Node versions). pnpm and yarn work too.

### 2. No license key needed

This template uses only **free** Styloviz packages from the public npm registry,
so there is no `.npmrc` and nothing to configure.

### 3. Install and run

```bash
npm install
npm start
```

Open **http://localhost:4200** — it redirects to `/templates/auth/login`. The dev server
reloads as you edit.

### 4. Build for production

```bash
npm run build
```

The optimized site is written to `dist/styloviz-auth-template/browser/`. See
[Deploying](#deploying) below.

---

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server on http://localhost:4200 with live reload |
| `npm run build` | Production build into `dist/styloviz-auth-template/browser/` |
| `npm run watch` | Development build that rebuilds on every change |
| `npm run ng -- <args>` | Any Angular CLI command, e.g. `npm run ng -- generate component my-widget` |

---

## Project structure

```
styloviz-auth-template/
├── README.md                 ← this guide
├── INSTALL.md                ← adding the template to an app you already have
├── LICENSE.txt
├── template.manifest.json    ← machine-readable package list (for support)
├── styles.auth-tokens.css  ← the template's colour tokens on their own
├── package.json · angular.json · tsconfig*.json · .postcssrc.json
├── public/                   ← fonts, favicon and the demo images the template shows
└── src/
    ├── index.html
    ├── main.ts               ← bootstraps the app
    ├── styles.css            ← Tailwind entry: theme tokens, dark mode, fonts, animations
    └── app/
        ├── app.ts            ← root component (just a router outlet)
        ├── app.config.ts     ← providers: router, zoneless change detection, Styloviz integration
        ├── app.routes.ts     ← mounts the template at /templates/auth
        └── templates/auth/ ← THE TEMPLATE — pages, layout, config, mock data
```

Start in **`src/app/templates/auth/`**. Its [README.md](src/app/templates/auth/README.md) describes every page and where its data comes from. [CUSTOMIZING.md](src/app/templates/auth/CUSTOMIZING.md) is the step-by-step guide to rebranding, navigation, adding pages and wiring a real backend.

---

## Using the template

### Rename, rebrand, recolour

- **Name, logo, navigation, links** — `src/app/templates/auth/auth.config.ts`. The template reads its
  brand and menus from this one file.
- **Colours** — the `.tpl-auth` block in `src/styles.css`. It sets the
  `brand-*` accent scale (and any neutral remap) for everything inside the
  template, Styloviz components included. Change the hex values; nothing else
  needs to move.
- **Site-wide design tokens** — the `@theme` block in `src/styles.css`
  (primary/semantic colours, radius, shadows, font).
- **Font** — Manrope is self-hosted from `public/fonts/`. Swap the files and the
  `@font-face` rules in `src/styles.css`, then update `--font-sans`.

### Dark mode

Dark styles apply whenever `<html>` has the `dark` class. The template's own
theme toggle manages that for you; to force a mode, add `class="dark"` (or
remove it) on `<html>` in `src/index.html`.

### Replace the demo data

All data is **demo-safe mock data** shipped inside the template — no network
calls, no API keys. It is loaded through the template's data/config files, so you
can swap in a real backend without touching the pages. See the *Data* section of the [template README](src/app/templates/auth/README.md).

### Change the URL it lives at

The template is mounted at `/templates/auth` — the same URL as the live demo. To
serve it from somewhere else (for example the site root `/app`), change two
things together:

1. `path` in `src/app/app.routes.ts`, e.g. `path: 'app'`
2. `AUTH_BASE` in `src/app/templates/auth/auth.config.ts`, e.g. `export const AUTH_BASE = '/app';`

Every internal link is built from that constant, so this is the whole change.

### Add your own pages

Generate a component and add it to the template's routes file
(`src/app/templates/auth/auth.routes.ts`) so it renders inside the template's
layout:

```bash
npm run ng -- generate component templates/auth/pages/my-page
```

---

## Deploying

`npm run build` produces a static single-page app in `dist/styloviz-auth-template/browser/`.
Upload that folder to any static host. Because the app uses client-side routing,
the host must serve `index.html` for unknown paths:

| Host | Setting |
|---|---|
| Netlify / Cloudflare Pages | add `public/_redirects` containing `/*  /index.html  200` |
| Vercel | `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` |
| Firebase Hosting | `"rewrites": [{ "source": "**", "destination": "/index.html" }]` |
| nginx | `try_files $uri $uri/ /index.html;` |
| Apache | `FallbackResource /index.html` |

To deploy under a sub-path (e.g. `https://example.com/admin/`), build with
`npm run build -- --base-href /admin/`.

---

## Styloviz packages in this project

| Package | Source |
|---|---|
| `@styloviz/alert-banner` | Free — public npm |
| `@styloviz/button` | Free — public npm |
| `@styloviz/core` | Free — public npm |
| `@styloviz/forms` | Free — public npm |
| `@styloviz/icons` | Free — public npm |
| `@styloviz/input-field` | Free — public npm |
| `@styloviz/layout` | Free — public npm |
| `@styloviz/password-strength` | Free — public npm |
| `@styloviz/toast` | Free — public npm |

9 free · 0 Pro. They are ordinary npm dependencies —
upgrade with `npm install <package>@latest`. Component docs and live examples:
https://styloviz.dev/docs

---

## Troubleshooting

**`npm ERR! 401` / `403` for an `@styloviz-pro/*` package** — this template uses no Pro packages; check that no
`.npmrc` from another project is overriding the `@styloviz-pro` scope.

**`Failed to replace env in config: ${STYLOVIZ_TOKEN}`** — npm could not
find the variable. Set it (step 2) before running `npm install`.

**"Node.js version vX is not supported by the Angular CLI"** — switch to Node
^22.22.3 || ^24.15.0 || >=26.0.0.

**Components render without styles** — `src/styles.css` must keep the
`@source "../node_modules/@styloviz"` lines. Tailwind does not scan
`node_modules` otherwise, so the classes the components use are never generated.

**Images or fonts return 404** — the files live in `public/` and are served
from the site root (`/demo/…`, `/fonts/…`). Keep the `assets` entry for
`public` in `angular.json`.

**A page is blank after deploying but works locally** — the host is not
falling back to `index.html`; see [Deploying](#deploying).

---

## Support & license

Licensed under the terms in `LICENSE.txt`. Documentation lives at
https://styloviz.dev/docs; for help, contact support from your Styloviz account
and include `template.manifest.json` — it lists the exact packages and version
this download was built from.
