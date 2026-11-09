# @styloviz/file-upload

> Button-style file uploader with type/size constraints and progress; the drag-and-drop dropzone and compact variants are in the Pro package.

Part of the **Styloviz UI Kit** — an Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

> **Free tier — MIT licensed.** Use it in personal and commercial projects at no cost, with no account or key. Styloviz Pro (`@styloviz-pro/*`) is a separate tier under a commercial license, installed from its own registry; nothing in this package requires it. Licensing: https://styloviz.dev/license · Pro: https://styloviz.dev/pricing

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
| `variant` | `FileUploadVariant` | `'button'` | Trigger style. Free ships the button; the dropzone and compact variants are `sv-file-upload-pro`. |
| `size` | `FileUploadSize` | `'md'` | Control size: sm, md or lg. |
| `accept` | `string` | `''` | Accepted file types — which files the picker offers and the queue keeps — `"image/*,.pdf"`. This is a convenience filter. It is not a security check. It matches an extension out of a filename the user chose, or a `File.type` the browser derived from that same extension — so `payload.exe` renamed `photo.png` passes `accept=".png"` and reports `image/png`, because it is called `.png`. Nothing here reads the bytes. And the file need not come through this component at all. Your upload endpoint accepts requests; `curl` is not running this filter. Every check here runs in a browser belonging to a user who is not the attacker in the case that matters. What it is genuinely for: keeping the OS picker tidy and keeping junk out of the queue. Both are about the honest user's experience, which is the whole job. **Validate the type on the server, from the bytes, at the point of storage** — with a size limit the client cannot raise and a malware scan. `markScanned` is how the verdict gets back here. |
| `multiple` | `boolean` | `true` | Allow selecting multiple files. |
| `maxFiles` | `number` | `10` | Maximum number of files. |
| `duplicates` | `FileUploadDuplicates` | `'allow'` | What to do with a file that is already in the queue — same name, size and modification time. `'skip'` leaves it out and reports it through `intakeSkipped` (`reason: 'duplicate'`); `'replace'` removes the queued one first. |
| `maxSizeMb` | `number` | `10` | Per-file size limit in MB. |
| `disabled` | `boolean` | `false` | Disable the uploader. |
| `uploader` | `SvUploader \| null` | `null` | The function that actually sends a file. Without one the component only collects files — it has no way to store them, and `autoUpload` does nothing. |
| `autoUpload` | `boolean` | `true` | Start uploading as soon as files are added. Set false to collect first and call `uploadAll()` from a submit button. |
| `concurrency` | `number` | `3` | Maximum uploads in flight at once. The rest queue. Firing ten parallel uploads saturates the connection and makes every one of them slower. Clamped to at least 1. |
| `demoMode` | `boolean` | `false` | Fake the upload with a progress animation and an occasional random failure. For demos and screenshots only — never in a real app. Replaces the former `autoSimulate` input, and is ignored whenever an `uploader` is supplied. |
| `demoFailureRate` | `number` | `0.08` | In `demoMode`, the share of files that fail — chosen by hashing the file, so the same files fail on every run. |
| `label` | `string` | `'Upload files'` | Trigger/label text. |
| `hint` | `string` | `''` | Helper text shown under the trigger. |
| `customClass` | `string` | `''` | Extra CSS classes for the root. |
| `initialFiles` | `readonly SvStoredFile[]` | `[]` | Files the server already has — the attachments of the record being edited. Shown as uploaded rows, never re-sent, never in the form value; removing one fires `fileRemoved` with its `id`. Replacing the array replaces those rows and keeps anything the user added. |
| `labels` | `Partial<SvFileUploadLabels>` | `{}` | Every word the component says, merged over the registry's `fileUpload` labels (English: `SV_FILE_UPLOAD_LABELS`). |
| `validator` | `SvFileValidator \| null` | `null` | A host's own check on each added file: return a message to refuse it, `null` to accept. May be async; the file waits at "Checking…" and is not uploaded until it clears. |
| `required` | `boolean` | `false` | The control needs at least one file (`{ required: true }`); also sets `aria-required`. With a form control Angular's own `RequiredValidator` runs too, and it reads the value — which never holds `initialFiles` — so for "an attachment, already there or new" use `[minFiles]="1"`, which counts them. |
| `minFiles` | `number` | `0` | The control needs at least this many usable files (`{ minFiles }`). |
| `minSizeMb` | `number` | `0` | Per-file minimum in MB; a smaller file is refused at intake. 0 sets none. |
| `maxTotalSizeMb` | `number` | `0` | Cap on all files together, in MB. A file that would push the total over is refused at intake, and the control reports `{ maxTotalSize }`. 0 sets none. |
| `actions` | `'auto' \| 'show' \| 'hide'` | `'auto'` | The Upload all / Cancel all / Retry failed row. `'auto'` shows it when files are collected first (`autoUpload` off) and something can send them (`uploader` or `demoMode`). |
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
| `intakeSkipped` | `SvIntakeSkipped` | Files an intake left out, and why: the queue was full (`'max-files'`), or the file was already queued under `duplicates="skip"` (`'duplicate'`). Fires once per cause per intake, so nothing is dropped silently. |

## Forms integration

A **ControlValueAccessor** works with `[formControl]`, `formControlName`, `[(ngModel)]` and Signal Forms `[formField]`. An **output-driven** component is bound through its own inputs and outputs instead — the reason is given for each.

| Component | Forms integration |
| --- | --- |
| `sv-file-upload` | ControlValueAccessor |

## Browser support — folders and paste

`sv-file-upload-pro` accepts files three ways besides the picker: a picked
**folder** (`[directory]="true"`), a dropped **folder** (always on), and a
**paste** (`pasteToUpload="zone" | "page"`). All three lean on browser APIs
that are not equally available, so this is what each engine does with them.

| Intake | API it uses | Chrome / Edge | Firefox | Safari (macOS) | Safari (iOS / iPadOS) | Chrome (Android) |
| --- | --- | --- | --- | --- | --- | --- |
| Pick a folder | `<input webkitdirectory>` | ✅ | ✅ | ✅ | ❌ — opens the normal file picker | ❌ — opens the normal file picker |
| Drop a folder | `DataTransferItem.webkitGetAsEntry()` + `readEntries()` | ✅ | ✅ | ✅ | ❌ — no folder drag source | ❌ — no folder drag source |
| Paste an image (screenshot, copied picture) | `paste` → `clipboardData.files` | ✅ | ✅ | ✅ | ✅ — from the Paste menu | ✅ — keyboards that paste images |
| Paste a file copied in the OS file manager | `paste` → `clipboardData.files` | ✅ | ✅ | ✅ | ❌ | ❌ |

What the component does where an API is missing:

- **No folder picker** — the picker opens as a file picker and the user can
  still choose files; nothing is broken, the folder structure is simply not
  available. Do not make a folder the only way to submit a set.
- **No folder drop** — a dropped folder arrives as nothing (there is no file to
  read); dropped files still work. The zone does not claim a folder it could
  not open.
- **No file paste** — a text paste is never touched (`page` mode ignores any
  paste aimed at an input, textarea or `contenteditable`), so the only cost is
  that the shortcut does nothing.

Two behaviours are the same everywhere because the component makes them so:
`readEntries()` is called until it returns an empty batch (it returns at most
100 entries per call), and every pasted screenshot — which browsers all name
`image.png` — is renamed from the clock and its ordinal so three pastes do not
collide on the server.

The free `sv-file-upload` (`@styloviz/file-upload`) has the picker and file
drop only; folder intake and paste ship in `@styloviz-pro/file-upload`.

## Documentation

Full API reference and live demos: https://styloviz.dev/docs/file-upload

## License

MIT — see https://styloviz.dev/license. Styloviz Pro (`@styloviz-pro/*`) is licensed separately.
