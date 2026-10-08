# @styloviz/avatar

> User avatar with initials fallback, status indicator, size and shape variants.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/avatar
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/icons` — listed above so no extra step is required on npm (on pnpm/yarn, list it yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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
import { SvAvatarComponent } from '@styloviz/avatar';

@Component({
  standalone: true,
  imports: [SvAvatarComponent],
  template: `
    <sv-avatar name="Alex Johnson" status="online" size="md" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` | `''` | URL of the avatar image. When blank or broken, falls back to initials/icon. |
| `name` | `string` | `''` | Full name — used to generate initials and auto-assign a palette color. |
| `alt` | `string` | `''` | Alt text for the image; falls back to `name`. |
| `size` | `AvatarSize` | `'md'` | Avatar size. |
| `shape` | `AvatarShape` | `'circle'` | Border-radius style. |
| `status` | `AvatarStatus` | `'none'` | Presence status indicator rendered as a small dot. Set to `'none'` to hide it entirely. |
| `statusLabel` | `string` | `''` | Wording for the presence state — "In a meeting", "Back at 3pm", "Do not disturb". Falls back to the capitalised `status`. |
| `showStatusText` | `boolean` | `false` | Render the presence state in words beside the avatar. |
| `color` | `AvatarColor` | `'auto'` | Color palette for the initials background. `'auto'` derives a consistent hue from the name string. |
| `verified` | `boolean` | `false` | Show a verified checkmark badge in the bottom-right corner. Overridden by `badgeCount` when that is > 0. |
| `badgeCount` | `number` | `0` | Notification count shown in the top-right corner. Set to 0 to hide. |
| `badgeMax` | `number` | `9` | Cap for the badge count display (e.g. 9 → shows "9+"). |
| `customClass` | `string` | `''` | Additional CSS classes merged onto the root wrapper. |
| `clickable` | `boolean` | `false` | Makes the avatar interactive (adds cursor-pointer, hover/focus styles, and emits `avatarClick`). |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `avatarClick` | `Event` | Emitted when the avatar is activated (click or keyboard) and `clickable` is true. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/avatar

## License

MIT
