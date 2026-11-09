# @styloviz/empty-state

> Full-page or inline empty states with icons or illustrations, titles and action buttons — dashed, ghost-preview and glow variants, five sizes, an onboarding checklist, a search echo with suggestions, and a reason (no data, no results, error, no access) that picks the right copy.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/avatar @styloviz/core @styloviz/icons @styloviz/kbd @styloviz/empty-state
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/avatar`, `@styloviz/core`, `@styloviz/icons`, `@styloviz/kbd` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvEmptyStateComponent } from '@styloviz/empty-state';

@Component({
  standalone: true,
  imports: [SvEmptyStateComponent],
  template: `
    <sv-empty-state icon="inbox" title="No messages" />
  `,
})
export class DemoComponent {}
```

> **Icons you name are registered once, in the app config.** `icon="plus"` draws only after `provideSvIcons([plusIcon])` (`import { plusIcon } from '@styloviz/icons/glyph/plus'`), or `provideSvIcons(svAllIcons)` from `@styloviz/icons` to start with every free glyph. The same goes for a name inside the items you pass. An unregistered name warns in the console with the line to add.

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Main heading text. Falls back to copy chosen from `reason`. Empty by default, so the heading matches the reason: a filtered list says nothing matched the filters rather than `'Nothing here yet'`. |
| `message` | `string` | `''` | Supporting message under the title. Falls back to copy from `reason`. |
| `reason` | `EmptyStateReason` | `'no-data'` | Why this container has nothing in it. Drive it from whether a filter or search is active — not from the row count. |
| `activeFilters` | `readonly string[]` | `[]` | The filters currently narrowing the list, in the user's words — `['Status: Overdue', 'Owner: Dana']`. Echoing them turns a dead end into one click. "No matching results" is unanswerable on its own: the user cannot see WHY, and the filter that is hiding everything is usually one they set three screens ago and have forgotten. Naming them, with a way to drop them, is the whole fix. Strings, not a filter model. Only the host can render a date range or a facet id as words a person recognises, and a kit that tried would print `status_id: 4`. |
| `clearFiltersLabel` | `string \| null` | `'Clear filters'` | Label for the built-in clear-filters button. `null` renders none. |
| `offline` | `boolean` | `false` | The device is offline. Takes precedence over `reason`. |
| `retryLabel` | `string \| null` | `null` | Label for the preset's retry button, offered for `reason="error"` and for `offline` — the two causes a second attempt can fix. `null` renders none. |
| `icon` | `EmptyStateIcon` | `'inbox'` | Built-in icon preset. Set to `'custom'` and provide `customIcon` to use your own SVG. |
| `customIcon` | `string` | `''` | Icon-library NAME — required when `icon === 'custom'`, ignored otherwise. An unresolved name draws no `<svg>` at all, so the decorative ring keeps its shape. |
| `showRings` | `boolean` | `true` | Show the decorative concentric-ring background behind the icon. |
| `size` | `EmptyStateSize` | `'md'` | Overall size. |
| `layout` | `EmptyStateLayout` | `'vertical'` | Content stacking axis. |
| `bordered` | `boolean` | `true` | Whether to render a card surface (border + background + rounded corners) or let the component blend into its parent. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `actions` | `EmptyStateAction[]` | `[]` | CTA buttons rendered below the message. Maximum 3 — first one is typically primary, rest secondary/ghost. |
| `variant` | `EmptyStateVariant` | `'default'` | The card's treatment: plain, dashed, ghost preview, or glow. |
| `align` | `EmptyStateAlign` | `'center'` | Centred, or aligned to the start of its box. |
| `illustration` | `EmptyStateIllustration \| null` | `null` | A built-in illustration in place of the ring stack — or `'auto'` to pick one by `reason`. Projected `[svIllustration]` content wins over this. |
| `steps` | `readonly EmptyStateStep[]` | `[]` | An onboarding checklist: numbered steps, a check on the done ones. |
| `query` | `string` | `''` | The search that found nothing. With `reason="no-results"` and no `title`, the title says "No results for «query»", and a Clear search button appears. |
| `suggestions` | `readonly string[]` | `[]` | "Did you mean" chips for a search with no results. |
| `errorDetails` | `string` | `''` | Technical detail for an error, behind a "Show details" disclosure. |
| `requestAccessLabel` | `string` | `''` | With `reason="no-access"`, a button to ask for access. |
| `secondaryLink` | `EmptyStateLink \| null` | `null` | A quiet link under the actions — documentation, a guide. |
| `avatars` | `readonly EmptyStateAvatar[]` | `[]` | People to show in an "invite teammates" stack. |
| `maxAvatars` | `number` | `4` | How many avatars to draw before a "+N" chip. |
| `shortcut` | `string` | `''` | A keyboard shortcut to mention — `'mod+n'` — drawn as keys. |
| `shortcutHint` | `string` | `''` | What the shortcut does, after it: "to create a project". |
| `labels` | `Partial<SvEmptyStateLabels>` | `{}` | Every string the component renders itself. Merged over `SV_EMPTY_STATE_LABELS`. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `actionClick` | `string` | Emitted when any action button is clicked, carrying the action's `id`. |
| `clearFilters` | `void` | The built-in clear-filters button was pressed. |
| `retry` | `void` | The preset retry button was pressed (`retryLabel`). |
| `stepClick` | `EmptyStateStep` | A checklist step was chosen. |
| `suggestionClick` | `string` | A "Did you mean" suggestion was chosen. |
| `clearQuery` | `void` | The Clear search button. |
| `requestAccess` | `void` | The request-access button. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/empty-state

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
