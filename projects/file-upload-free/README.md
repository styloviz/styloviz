# @styloviz/file-upload

> Drag-and-drop and button-style file uploaders with type/size constraints and progress.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/icons @styloviz/core @styloviz/file-upload
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
import { SvFileUploadComponent } from '@styloviz/file-upload';

@Component({
  standalone: true,
  imports: [SvFileUploadComponent],
  template: `
    <sv-file-upload
      [accept]="'image/*'"
      (filesChange)="onFiles($event)" />
  `,
})
export class DemoComponent {}
```

## Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `FileUploadVariant` | `'button'` | Trigger style: button or drag-and-drop dropzone. |
| `size` | `FileUploadSize` | `'md'` | Control size: sm, md or lg. |
| `accept` | `string` | `''` | Accepted file types — which files the picker offers and the queue keeps — `"image/*,.pdf"`. THIS IS A CONVENIENCE FILTER. IT IS NOT A SECURITY CHECK. It matches an extension out of a filename the user chose, or a `File.type` the browser derived from that same extension — so `payload.exe` renamed `photo.png` passes `accept=".png"` and reports `image/png`, because it is called `.png`. Nothing here reads the bytes. AND THE FILE NEED NOT COME THROUGH THIS COMPONENT AT ALL. Your upload endpoint accepts requests; `curl` is not running this filter. Every check here runs in a browser belonging to a user who is not the attacker in the case that matters. What it is genuinely for: keeping the OS picker tidy and keeping junk out of the queue. Both are about the honest user's experience, which is the whole job. ⚠️ **Validate the type on the server, from the bytes, at the point of storage** — with a size limit the client cannot raise and a malware scan. `markScanned` is how the verdict gets back here. |
| `multiple` | `boolean` | `true` | Allow selecting multiple files. |
| `maxFiles` | `number` | `10` | Maximum number of files. |
| `maxSizeMb` | `number` | `10` | Per-file size limit in MB. |
| `disabled` | `boolean` | `false` | Disable the uploader. |
| `uploader` | `SvUploader \| null` | `null` | The function that actually sends a file. Without one the component only collects files — it has no way to store them, and `autoUpload` does nothing. |
| `autoUpload` | `boolean` | `true` | Start uploading as soon as files are added. Set false to collect first and call `uploadAll()` from a submit button. |
| `concurrency` | `number` | `3` | Maximum uploads in flight at once. The rest queue. Firing ten parallel uploads saturates the connection and makes every one of them slower. Clamped to at least 1. |
| `demoMode` | `boolean` | `false` | Fake the upload with a progress animation and an occasional random failure. For demos and screenshots only — never in a real app. Replaces the former `autoSimulate` input, and is ignored whenever an `uploader` is supplied. |
| `label` | `string` | `'Upload files'` | Trigger/label text. |
| `hint` | `string` | `''` | Helper text shown under the trigger. |
| `customClass` | `string` | `''` | Extra CSS classes for the root. |
| `errorMessage` | `string` | `''` | Client-side validation message. |
| `serverError` | `SvServerError` | `null` | A rejection reported by the server about this value. Self-expiring. |

## Outputs

| Output | Type | Description |
| --- | --- | --- |
| `filesChange` | `UploadFile[]` | Emitted with the full file list whenever it changes. |
| `fileAdded` | `UploadFile` | Emitted when a single file is added. |
| `fileRemoved` | `string` | Emitted with the id of a removed file. |
| `uploadComplete` | `UploadFile[]` | The run has settled: every file finished uploading or failed. Fires once per run with the full file list. |
| `uploadError` | `UploadFile` | Emitted when a file fails validation or upload. |
| `uploadCancelled` | `UploadFile` | A file's upload was cancelled by the user. |
| `scanChange` | `UploadFile` | A file's malware-scan verdict changed. Carries the whole entry. Fires for every transition the host drives, `'pending'` included, so a toast or an audit line can be written when it happens rather than by diffing `files()`. |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/file-upload

## License

MIT
