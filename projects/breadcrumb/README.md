# @styloviz/breadcrumb

> 4 visual variants, 5 separator styles, a sibling-page dropdown switcher, badges, disabled crumbs, collapsible middle crumbs, a loading skeleton, and full keyboard support.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/breadcrumb
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
import { SvBreadcrumbComponent } from '@styloviz/breadcrumb';

@Component({
  standalone: true,
  imports: [SvBreadcrumbComponent],
  template: `
    <sv-breadcrumb [items]="crumbs" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `items` | `BreadcrumbItem[]` | `[]` | Ordered list of crumbs. The last item is treated as the current page. |
| `separator` | `BreadcrumbSeparator` | `'chevron'` | Separator style between crumbs. Use `custom` with `customSeparatorIcon`. |
| `customSeparatorIcon` | `string` | `''` | Icon-library NAME used when `separator="custom"` — e.g. `'chevron-right'`. Was `customSeparatorPath`, a raw `<path d="…">`, and it was written as a STATIC attribute at every call site, so the rename could not error: the custom-separator demo silently fell back to the default chevron until the sites were rewritten by hand. |
| `variant` | `BreadcrumbVariant` | `'plain'` | Visual style of the crumb trail. |
| `size` | `BreadcrumbSize` | `'md'` | Size of the breadcrumb text and icons. |
| `maxVisible` | `number` | `0` | Maximum number of crumbs to show before collapsing the middle ones. Set to `0` to always show all. |
| `responsive` | `boolean` | `false` | Collapse to fit the available width instead of to a fixed count. Overrides `maxVisible` when on. |
| `expandable` | `boolean` | `true` | Allow the collapsed ellipsis to be clicked to reveal the hidden middle crumbs. When `false` the ellipsis is purely decorative. |
| `showHomeIcon` | `boolean` | `false` | Prepends a home icon to the first crumb when it has no explicit `icon`. |
| `truncateLabels` | `boolean` | `false` | Clips long labels to a fixed width with an ellipsis and a title tooltip. |
| `collapseOnMobile` | `boolean` | `false` | Hides middle crumbs below the `sm` breakpoint (pure CSS) to keep long trails compact on phones. |
| `loading` | `boolean` | `false` | Shows an animated skeleton in place of the crumb trail while data is loading. |
| `skeletonCount` | `number` | `3` | Number of skeleton segments rendered when `loading` is `true`. |
| `ariaLabel` | `string` | `'Breadcrumb'` | Accessible label for the breadcrumb navigation landmark. |
| `customClass` | `string` | `''` | Additional CSS classes on the root `<nav>` element. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `crumbClick` | `BreadcrumbItem` | Emitted when a crumb with a `routerLink` is clicked. |
| `expand` | `void` | Emitted when the collapsed ellipsis is expanded to reveal hidden crumbs. |
| `collapse` | `void` | Emitted when an expanded trail is collapsed back via the toggle. |
| `menuItemSelect` | `BreadcrumbMenuItem` | Emitted when a sibling page is chosen from a crumb's dropdown switcher. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/breadcrumb

## License

MIT
