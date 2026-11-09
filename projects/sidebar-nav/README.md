# @styloviz/sidebar-nav

> The reusable navigation of a dashboard, with no router dependency and no brand welded in — a sidebar (grouped items, click-to-expand sub-navigation with an active trail, a collapsed rail and a mobile drawer) and a phone bottom navigation bar, both rendered from the same MenuItem model.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/overlays @styloviz/scroll-area @styloviz/sidebar-nav
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core`, `@styloviz/icons`, `@styloviz/overlays`, `@styloviz/scroll-area` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `menuGroups` | `readonly MenuGroup[]` | `[]` | Grouped navigation items. |
| `activeRoute` | `string` | `''` | The path the reader is on, so one item can be marked current. Controlled rather than derived: matching a route is the router's job, and a component that guessed at it would be wrong in a different way in every app. `[activeRoute]="router.url"` is the whole wiring for a routed app. |
| `childKey` | `string \| null` | `'c'` | URL parameter naming the open sub-item — the same `?c=…` parameter `sv-sidebar` uses. Read through `SvNavLocation`, so it is inert until the app provides one. `null` turns sub-item tracking off. |
| `activeChildId` | `string \| null` | `null` | Pin the open sub-item, ignoring the URL. For a host that keeps this in its own state rather than in the address. |
| `collapsed` | `boolean (two-way)` | `false` | Icon-only rail. Two-way via `[(collapsed)]`. |
| `mobileOpen` | `boolean (two-way)` | `false` | Mobile drawer open. Two-way via `[(mobileOpen)]`. |
| `mobileBreakpoint` | `number` | `1024` | Viewport width below which the sidebar becomes an off-canvas drawer driven by `mobileOpen`. Set to `0` to keep it docked at every size — e.g. when it is embedded in a panel rather than used as the page's shell. |
| `ariaLabel` | `string` | `'Main navigation'` | Accessible name of the `<nav>` landmark. A page with two of these — a primary sidebar and a secondary panel — needs them told apart. |
| `showHeader` | `boolean` | `true` | Render the header / footer slots at all. A rail with no chrome is a common shape and an empty bordered box is not. |
| `showFooter` | `boolean` | `true` | Render the footer area holding the `[slot=footer]` content and, outside the mobile drawer, the collapse toggle. |
| `surfaceId` | `string \| null` | `null` | Names this sidebar in the shared navigation-analytics stream. Ignored unless `provideSvNavTelemetry()` is wired up. |
| `customClass` | `string` | `''` | Additional CSS classes on the `<aside>`. |
| `expandMode` | `SidebarNavExpandMode` | `'multiple'` | Whether opening one section closes the others. |
| `expandedIds` | `readonly string[] (two-way)` | `[]` | Keys (`item.id`, else the route) of the items whose sub-pages are open, and `<item key>::<sub-item id>` for an open third level. The section the reader is inside opens on its own, and closes again when they leave unless they opened it themselves. Two-way. |
| `collapsedGroups` | `readonly string[] (two-way)` | `[]` | Keys (`group.id`, else its label) of `collapsible` groups folded away. Two-way. |
| `activeStyle` | `SidebarNavActiveStyle` | `'fill'` | The active row's look. |
| `badgeVariant` | `SidebarNavBadgeVariant` | `'pill'` | How badges are drawn. |
| `density` | `SidebarNavDensity` | `'comfortable'` | Row height. |
| `labels` | `Partial<SvSidebarNavLabels>` | `{}` | Every string the sidebar renders. |
| `scrollFade` | `SidebarNavScrollFade` | `'gradient'` | Fades at the list's edges while there is more to scroll. `'gradient'` fades to the sidebar's surface (`--sv-sa-fade` to change it); `'shadow'` suits a tinted or translucent sidebar. |
| `drawerMode` | `SidebarNavDrawerMode` | `'overlay'` | The drawer below `mobileBreakpoint`: over the page, or pushing it aside. |
| `swipeToClose` | `boolean` | `true` | Swipe the open drawer toward its edge to close it (touch and pen). |
| `edgeSwipe` | `boolean` | `false` | Swipe in from the start edge of the screen to open the drawer. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `itemSelected` | `SidebarNavSelection` | Something was picked. Carries the group and, for a sub-item, the child — a host closing a drawer needs the event, and a host doing its own analytics needs to know *which* thing was clicked, not just that one was. |
| `mobileClose` | `void` | The drawer should close. Emitted alongside `mobileOpen` being set to `false`, for a host that has its own shell state to keep in step. |
| `toggleCollapse` | `boolean` | The rail toggle was pressed. `collapsed` is already flipped. |
| `collapsedChange` | `boolean` | Emits the new `collapsed` whenever it changes — the output half of `[(collapsed)]`. |
| `mobileOpenChange` | `boolean` | Emits the new `mobileOpen` whenever it changes — the output half of `[(mobileOpen)]`. |
| `expandedIdsChange` | `readonly string[]` | Emits the new `expandedIds` whenever it changes — the output half of `[(expandedIds)]`. |
| `collapsedGroupsChange` | `readonly string[]` | Emits the new `collapsedGroups` whenever it changes — the output half of `[(collapsedGroups)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/sidebar-nav

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
