# @styloviz/tree-view

> 8 premium variants: collapsible tree, file explorer, tri-state checkboxes, org chart, tree table, searchable, drag & drop reordering and lazy load. Lazy loading, the tree-table columns and drag & drop reordering are Pro (`sv-tree-view-pro`); the free component renders the nodes you give it.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/tree-view
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
import { SvTreeViewComponent } from '@styloviz/tree-view';

@Component({
  standalone: true,
  imports: [SvTreeViewComponent],
  template: `
    <sv-tree-view ariaLabel="Project files" [nodes]="nodes" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` | `TreeNode[]` | `[]` | Tree node data (nested children, optional icons). |
| `selectable` | `boolean` | `true` | Enable single-row selection highlight. |
| `showLines` | `boolean` | `true` | Show vertical connector guide lines. |
| `ariaLabel` | `string` | `''` | What this tree is, e.g. `'Project files'` — names the `role="tree"` region. Two trees side by side both announce as an unnamed "tree" without this. Left unset, no name is invented: an `aria-label` of "Tree" only repeats the role. Matches `sv-tree-view-pro`'s input of the same name. |
| `loading` | `boolean` | `false` | True while the tree is being fetched. Replaces it with a placeholder. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyText` | `string` | `'No items to display'` | Copy for the empty state. |
| `expandedIds` | `Set<string> (two-way)` | `new Set()` | Expanded node ids. Two-way bindable, so an expansion state loaded from the server — or restored from a URL — survives a reload. |
| `selectedId` | `string \| null (two-way)` | `null` | The selected node id. Two-way bindable. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `nodeClick` | `TreeNodeClickEvent` | Fires when an enabled node is clicked or activated with Enter/Space while `selectable`; payload is the node and its depth (0 for roots). |
| `nodeExpand` | `TreeNode` | Fires with the node when an enabled parent is expanded, by its chevron or ArrowRight. |
| `nodeCollapse` | `TreeNode` | Fires with the node when an expanded parent is collapsed, by its chevron or ArrowLeft. |
| `nodeSelect` | `TreeNode` | Fires with the node when it becomes selected by click or Enter/Space; never fires while `selectable` is false. |
| `retry` | `void` | The host should re-run the failed load. |
| `expandedIdsChange` | `Set<string>` | Emits the new `expandedIds` whenever it changes — the output half of `[(expandedIds)]`. |
| `selectedIdChange` | `string \| null` | Emits the new `selectedId` whenever it changes — the output half of `[(selectedId)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/tree-view

## License

MIT
