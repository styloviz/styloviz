# @styloviz/toast

> Imperative toast stack with 4 variants, 6 anchor positions, action callbacks and an auto-dismiss timer.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/core @styloviz/toast
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/icons`, `@styloviz/core` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

## Styles (required)

Styloviz components are Tailwind CSS 4 utilities. If the project does not use
Tailwind yet, add it and its PostCSS plugin (the Angular CLI reads
`.postcssrc.json` from the project root):

```sh
npm i -D tailwindcss @tailwindcss/postcss postcss
echo '{ "plugins": { "@tailwindcss/postcss": {} } }' > .postcssrc.json
```

Then, in your global stylesheet (usually `src/styles.css`), import the kit's
tokens and let Tailwind scan the installed packages — it skips `node_modules`
otherwise:

```css
@import "tailwindcss";
@import "@styloviz/core/styles/styloviz.css";
@source "../node_modules/@styloviz";
@source "../node_modules/@styloviz-pro";   /* Pro only */
```

The stylesheet ships in `@styloviz/core` — add it to your install if it is not
there already. Dark mode is class-based (`class="dark"` on `<html>`). Rebrand by
redeclaring a token after the import: `@theme { --color-primary-600: #0f766e; }`.

## Usage

```ts
import { SvToastHostComponent } from '@styloviz/toast';

@Component({
  standalone: true,
  imports: [SvToastHostComponent],
  template: `
    // place one host, then call the service
    <sv-toast-host position="top-right" />
    
    toast.success('Saved!');
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `ToastPosition` | `'top-right'` | Where the stack is anchored on screen. |
| `maxVisible` | `number` | `5` | Maximum number of toasts visible simultaneously. |
| `portal` | `boolean` | `false` | Move the region to `<body>` so it stays usable above a modal. `inert` IS INHERITED AND CANNOT BE UNDONE BY A DESCENDANT. A modal makes the page behind it inert, and a host mounted inside the app shell is part of that page: its toasts are still announced (speech goes through the shared announcer) but an "Undo" button on one cannot be pressed until the dialog closes. Portalled, the region is a `<body>` child the stack keeps live at any depth. Off by default because it moves the region's DOM (and its `data-sv-toast-*` hooks) out of the host. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/toast

## License

MIT
