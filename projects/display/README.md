# @styloviz/display

> Content display components — carousel, image gallery, drag-and-drop list, description lists, a JSON tree viewer, line clamp, overflow lists, a status / uptime page and a video / audio media player.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

## Installation

```bash
npm install @styloviz/core @styloviz/icons @styloviz/select-dropdown @styloviz/timeline @styloviz/display
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core`, `@styloviz/icons`, `@styloviz/select-dropdown`, `@styloviz/timeline` — listed above so no extra step is required on npm (on pnpm/yarn, list them yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

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

Every component in `@styloviz/display` has its own entry point, like `@styloviz/display/audio-device-select`. Import from the entry point, not from `@styloviz/display`: bundlers put everything an import reaches in the same chunk, and the package entry reaches every component in it. Both work, but only the entry point keeps your bundle to the components you use.

```ts
import { SvAudioDeviceSelectComponent } from '@styloviz/display/audio-device-select';

@Component({
  standalone: true,
  imports: [SvAudioDeviceSelectComponent],
  template: `
    <sv-audio-device-select [(deviceId)]="mic" [(outputDeviceId)]="speaker" [showOutput]="true" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `deviceId` | `string (two-way)` | `''` | The chosen microphone's `deviceId` (two-way). `''` is the system default. |
| `outputDeviceId` | `string (two-way)` | `''` | The chosen speaker's `deviceId` (two-way) — bind it to `sv-media-player`'s `sinkId`. `''` is the system default. |
| `showOutput` | `boolean` | `false` | Also offer a speaker list, where the browser can route sound (`setSinkId`). |
| `meter` | `boolean` | `true` | Offer **Test microphone** and the input-level meter. |
| `disabled` | `boolean` | `false` | Disable both lists and every button. |
| `size` | `SelectSize` | `'md'` | Size of the lists. |
| `ariaLabel` | `string \| null` | `null` | The group's accessible name. |
| `locale` | `string` | `svLocale()` | BCP-47 locale for the numbered fallback names and the meter value. |
| `labels` | `Partial<SvAudioDeviceSelectLabels>` | `{}` | Per-instance text, merged over the registry's `display` labels. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `inputChange` | `SvAudioDeviceChange` | A microphone was chosen — from the list, or as the fallback when the chosen one was unplugged. |
| `outputChange` | `SvAudioDeviceChange` | A speaker was chosen — from the list, or as the fallback when the chosen one was unplugged. |
| `permissionChange` | `SvMicPermission` | Microphone access changed state (`prompt`, `denied`, `granted`, …) — including when it was first read. |
| `devicesChange` | `readonly SvAudioDevice[]` | The device list was read or changed (a device was plugged in or removed). |
| `accessError` | `SvMicError` | Opening the microphone failed — blocked, missing, or busy in another app. |
| `testChange` | `boolean` | The level test started (the microphone is open) or stopped (it is closed again). |
| `deviceIdChange` | `string` | Emits the new `deviceId` whenever it changes — the output half of `[(deviceId)]`. |
| `outputDeviceIdChange` | `string` | Emits the new `outputDeviceId` whenever it changes — the output half of `[(outputDeviceId)]`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/audio-device-select

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
