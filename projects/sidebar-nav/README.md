# @styloviz/sidebar-nav

> The reusable half of a dashboard sidebar: grouped items, sub-navigation, a collapsed rail and a mobile drawer — with no router dependency and no brand welded in. Bring your own header and footer.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/sidebar-nav
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core`, `@styloviz/icons` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvSidebarNavComponent } from '@styloviz/sidebar-nav';

@Component({
  standalone: true,
  imports: [SvSidebarNavComponent],
  template: `
    <sv-sidebar-nav [menuGroups]="groups" [activeRoute]="router.url" [(collapsed)]="railed" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `menuGroups` | `readonly MenuGroup[]` | `[]` | Grouped navigation items. |
| `activeRoute` | `string` | `''` | The path the reader is on, so one item can be marked current. Controlled rather than derived. See the class note: matching a route is the router's job, and a component that guessed at it would be wrong in a different way in every app. `[activeRoute]="router.url"` is the whole wiring for a routed app. |
| `childKey` | `string \| null` | `'c'` | URL parameter naming the open sub-item — the `?c=…` `sv-sidebar` has always used. Read through `SvNavLocation`, so it is inert until the app provides one. `null` turns sub-item tracking off. |
| `activeChildId` | `string \| null` | `null` | Pin the open sub-item, ignoring the URL. For a host that keeps this in its own state rather than in the address. |
| `collapsed` | `boolean (two-way)` | `false` | Icon-only rail. Two-way via `[(collapsed)]`. |
| `mobileOpen` | `boolean (two-way)` | `false` | Mobile drawer open. Two-way via `[(mobileOpen)]`. |
| `mobileBreakpoint` | `number` | `1024` | Viewport width below which the sidebar becomes an off-canvas drawer driven by `mobileOpen`. Set to `0` to keep it docked at every size — e.g. when it is embedded in a panel rather than used as the page's shell. |
| `ariaLabel` | `string` | `'Main navigation'` | Accessible name of the `<nav>` landmark. A page with two of these — a primary sidebar and a secondary panel — needs them told apart. |
| `showHeader` | `boolean` | `true` | Render the header / footer slots at all. A rail with no chrome is a common shape and an empty bordered box is not. |
| `showFooter` | `boolean` | `true` | Render the footer area holding the `[slot=footer]` content and, outside the mobile drawer, the collapse toggle. |
| `surfaceId` | `string \| null` | `null` | Names this sidebar in the shared navigation-analytics stream. Ignored unless `provideSvNavTelemetry()` is wired up. |
| `customClass` | `string` | `''` | Additional CSS classes on the `<aside>`. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `itemSelected` | `SidebarNavSelection` | Something was picked. Carries the group and, for a sub-item, the child — a host closing a drawer needs the event, and a host doing its own analytics needs to know *which* thing was clicked, not just that one was. |
| `mobileClose` | `void` | The drawer should close. Emitted alongside `mobileOpen` being set to `false`, for a host that has its own shell state to keep in step. |
| `toggleCollapse` | `boolean` | The rail toggle was pressed. `collapsed` is already flipped. |
| `collapsedChange` | `boolean` | Emits the new `collapsed` whenever it changes — the output half of `[(collapsed)]`. |
| `mobileOpenChange` | `boolean` | Emits the new `mobileOpen` whenever it changes — the output half of `[(mobileOpen)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/sidebar-nav

## License

MIT
