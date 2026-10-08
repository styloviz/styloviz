# @styloviz/notification-center

> 6 premium variants: dropdown, drawer, inline, activity feed, compact and grouped — with mark-as-read, dismiss, search, tab filtering and inline actions.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/notification-center
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
import { SvNotificationCenterComponent } from '@styloviz/notification-center';

@Component({
  standalone: true,
  imports: [SvNotificationCenterComponent],
  template: `
    <sv-notification-center [notifications]="notifications" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `NotificationCenterVariant` | `'dropdown'` | Presentation: dropdown, drawer, inline, feed, compact or grouped. |
| `notifications` | `NotificationItem[]` | `[]` | The notifications to display. |
| `maxHeight` | `string` | `'400px'` | Max height of the scrollable list (CSS length). |
| `tabs` | `string[]` | `['All', 'Unread', 'Mentions', 'System']` | Filter tab labels. |
| `panelTitle` | `string` | `'Notifications'` | Panel heading text. |
| `showSearch` | `boolean` | `true` | Show the search box. |
| `animateBell` | `boolean` | `true` | Animate the bell icon on new notifications. |
| `showViewAll` | `boolean` | `false` | Render the panel's "View all" control. Off by default, and that default is the fix. The control used to be unconditional markup with no handler on it — a link to the notifications page that went nowhere, which is worse than no link because a user who presses it concludes the page is broken rather than absent. A host that has somewhere to send them opts in and handles `viewAll`; a host that does not never shows the control. |
| `loading` | `boolean` | `false` | True while notifications are being fetched. Shows a placeholder in place of the list when there is nothing to show yet. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `unreadTotal` | `number \| null` | `null` | The server's unread total for the WHOLE feed. `null` counts the rows in hand instead. |
| `redactedLabel` | `string` | `'This notification is no longer availab…` | What a redacted row shows instead of its title. |
| `hasMore` | `boolean` | `false` | More notifications exist on the server. Renders the "Load more" control. A notification feed is unbounded — without this a host has to send the user's entire history to render a dropdown. |
| `loadingMore` | `boolean` | `false` | True while the next page is being fetched. |
| `pendingIds` | `readonly string[] \| ReadonlySet<string>` | `[]` | Ids with a write in flight. Those rows dim and stop responding, so a second click cannot race the first and leave `rollback()` ambiguous. |
| `itemErrors` | `Readonly<Record<string, string>> \| ReadonlyMap<string, string>` | `{}` | Ids whose last write FAILED, mapped to the message to show on that row. `pendingIds` HAD NO COUNTERPART, AND THAT IS Optimistic read/dismiss rolls back correctly — the row reverts, and the user is told nothing. A notification that silently un-dismissed itself looks like the click never landed, so they click again, and again, against an endpoint that is refusing. PER ROW, not one banner. `error` above is for the FEED — "could not load notifications" — and putting a single row's failure there says the whole list is broken. The two are different facts and the audit's own reasoning for `role="alert"` vs `role="status"` applies: scope the message to what actually failed. ```ts this.itemErrors.set({ 'n-14': 'Could not mark as read.' }); ``` |
| `debounceMs` | `number` | `300` | Delay before `queryChange` fires, in milliseconds. `0` emits immediately. |
| `serverSide` | `boolean` | `false` | Filter and search on the server instead of in the component. Leaves the supplied `notifications` untouched — the host is responsible for returning only matching rows. Required for a real feed: filtering client-side can only ever search the page you already downloaded. |
| `open` | `boolean (two-way)` | `false` | Whether the panel is open. Two-way bindable, so a host can open the centre from a route or a keyboard shortcut. Ignored by the always-visible `inline` and `feed` variants. |
| `activeTab` | `string (two-way)` | `'All'` | The selected tab label. Two-way bindable, so the tab survives a reload. |
| `search` | `string (two-way)` | `''` | The search box contents. Two-way bindable. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `notificationClick` | `NotificationClickEvent` | Emitted when a notification row is clicked. |
| `actionClick` | `NotificationActionClickEvent` | Emitted when an inline action on a notification is clicked. |
| `markAllRead` | `NotificationMarkAllReadEvent` | Emitted when "mark all as read" is triggered. |
| `dismiss` | `NotificationDismissEvent` | Emitted when a notification is dismissed. |
| `queryChange` | `NotificationQuery` | The tab or search term changed — fetch the matching notifications. Debounced by `debounceMs`, and never emitted twice for the same query. |
| `loadMore` | `NotificationLoadMoreEvent` | The user asked for the next page. |
| `retry` | `void` | The host should re-run the failed load. |
| `viewAll` | `void` | The user asked for the full notifications surface — navigate there. Only reachable when `showViewAll` is set; the panel closes first, because leaving a floating panel open over the page it just navigated to is how a dropdown ends up covering its own destination. |
| `retryItem` | `NotificationItem` | The row's "Try again" was pressed. |
| `openChange` | `boolean` | Emits the new `open` whenever it changes — the output half of `[(open)]`. |
| `activeTabChange` | `string` | Emits the new `activeTab` whenever it changes — the output half of `[(activeTab)]`. |
| `searchChange` | `string` | Emits the new `search` whenever it changes — the output half of `[(search)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/notification-center

## License

MIT
