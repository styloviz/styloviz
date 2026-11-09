# @styloviz/tree-view

> 8 variants: collapsible tree, file explorer, tri-state checkboxes, org chart, tree table, searchable, drag & drop reordering and lazy load. Lazy loading, the tree-table columns and drag & drop reordering are Pro (`sv-tree-view-pro`); the free component renders the nodes you give it. Both draw as an indented list or, with `layout="org"`, as a top-down org chart of boxes joined by connector lines.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

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
| `showLines` | `boolean` | `true` | Show vertical connector guide lines in the `list` layout. The `org` layout always draws its connectors — they are what make it a chart. |
| `layout` | `TreeViewLayout` | `'list'` | How the tree is drawn: `list` (indented rows) or `org` (top-down boxes joined by connector lines, each parent centred over its children). Same tree, same keyboard model, same outputs — only the picture changes. `org` shows each node's `role` and `department` and scrolls sideways inside a labelled region when it is wider than its container. |
| `ariaLabel` | `string` | `''` | What this tree is, e.g. `'Project files'` — names the `role="tree"` region. Two trees side by side both announce as an unnamed "tree" without this. Left unset, no name is invented: an `aria-label` of "Tree" only repeats the role. Matches `sv-tree-view-pro`'s input of the same name. |
| `loading` | `boolean` | `false` | True while the tree is being fetched. Replaces it with a placeholder. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `iconTemplate` | `TemplateRef<TreeIconContext> \| null` | `null` | A template for the glyph before each label in the `list` layout, drawn in place of the text `icon`. Stamped with TreeIconContext — the node as `$implicit`, plus `expanded` and `depth` — so a host can draw an icon-library glyph per node (`sv-file-tree` draws a file-type glyph this way). Decorative: the row's name is its label. The `org` layout keeps its initials avatar. Same input on `sv-tree-view-pro`. |
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

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
