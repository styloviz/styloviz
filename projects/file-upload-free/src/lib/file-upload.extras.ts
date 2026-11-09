/**
 * The parts of a file upload a real form needs that are not the queue itself
 * (`SR-27`): files already on the server, every word the component says, a
 * host's own check, form-level rules, and a ready XHR uploader.
 *
 * Shared by `sv-file-upload` and `sv-file-upload-pro`, so the two twins say the
 * same things and validate the same way — a Pro upgrade changes the chrome,
 * never the rules.
 */
import type { ValidationErrors } from '@angular/forms';
import { svFormatLabel, type SvLabelParams } from '@styloviz/core/i18n';
import { SV_FILE_UPLOAD_TRIGGER_LABELS, type SvFileUploadTriggerLabels } from './file-upload.labels';

// ─── Files already on the server ──────────────────────────────────────────────

/**
 * A file the server already has — the attachments of the record being edited.
 * Rendered as an uploaded row, never re-sent, and never in the form value
 * (there are no bytes to put there): a removal is reported through
 * `fileRemoved` with this `id`, which is what the host tells its server.
 */
export interface SvStoredFile {
  /** The server's identifier; also the row's id. */
  readonly id: string;
  readonly name: string;
  /** In bytes. */
  readonly size: number;
  /** MIME type, for the icon and the badge. @default '' */
  readonly type?: string;
  /** Where the file can be opened or downloaded from. */
  readonly url?: string;
  /** A thumbnail URL for an image. */
  readonly preview?: string;
}

// ─── Words ────────────────────────────────────────────────────────────────────

/**
 * Every sentence the upload says, so a host can translate it.
 *
 * ★★ COUNTS ARE FUNCTIONS, NOT STRINGS WITH A PLURAL "s". `file{{ n === 1 ? '' :
 *    's' }}` is English grammar baked into a template; Polish has three plural
 *    forms and Japanese none. A function hands the whole phrase to the host.
 */
export interface SvFileUploadLabels {
  /** The list's accessible name. */
  readonly fileList: string;
  readonly overallProgress: string;
  readonly uploadingSummary: (count: number) => string;
  readonly pending: string;
  readonly uploaded: string;
  /** A file that was already on the server when the form opened. */
  readonly stored: string;
  readonly uploadFailed: string;
  readonly blocked: string;
  readonly scanning: string;
  readonly awaitingScan: string;
  readonly checking: string;
  readonly uploadingFile: (name: string) => string;
  readonly retryFile: (name: string) => string;
  readonly cancelFile: (name: string) => string;
  readonly removeFile: (name: string) => string;
  readonly openFile: (name: string) => string;
  readonly fileCount: (count: number) => string;
  readonly uploadedCount: (count: number) => string;
  readonly awaitingScanCount: (count: number) => string;
  readonly blockedCount: (count: number) => string;
  readonly failedCount: (count: number) => string;
  readonly clearAll: string;
  readonly clearAllLabel: string;
  readonly uploadAll: string;
  readonly cancelAll: string;
  readonly retryFailed: string;
  /** Row errors, set at intake. */
  readonly tooLarge: (limit: string) => string;
  readonly tooSmall: (limit: string) => string;
  readonly totalTooLarge: (limit: string) => string;
  readonly typeNotAllowed: string;
  /** Screen-reader summary. */
  readonly statusSelected: (count: number) => string;
  readonly statusUploading: (count: number, percent: number) => string;
  readonly statusBlocked: (count: number) => string;
  readonly statusAwaitingScan: (count: number) => string;
  readonly statusCropping: (count: number) => string;
  /** Pro: the drop zone. */
  readonly dropHere: string;
  readonly dragOrBrowse: string;
  readonly browse: string;
  readonly chooseFiles: string;
  readonly maxReached: string;
  readonly maxPerFile: (limit: string) => string;
  readonly upToFiles: (count: number) => string;
  readonly dropRejected: string;
  readonly waitingToCrop: string;
  readonly skipCrop: string;
  readonly skipCropFile: (name: string) => string;
  readonly imageTooSmall: (width: number, height: number) => string;
  readonly imageTooLarge: (width: number, height: number) => string;
}

/**
 * The function-shaped labels from the registry's templates — pass the
 * component's `fileUpload` labels and locale (the plural forms pick their
 * category in it), or `SV_FILE_UPLOAD_TRIGGER_LABELS` and `''` for English.
 * Pixel sizes arrive as raw digits, exactly as these strings always showed them.
 */
export function svFileUploadLabels(t: SvFileUploadTriggerLabels, locale: string): SvFileUploadLabels {
  const f = (template: string, params: SvLabelParams) => svFormatLabel(template, params, locale);
  return {
    fileList: t.fileList,
    overallProgress: t.overallProgress,
    uploadingSummary: (count) => f(t.uploadingSummary, { count }),
    pending: t.pending,
    uploaded: t.uploaded,
    stored: t.stored,
    uploadFailed: t.uploadFailed,
    blocked: t.blocked,
    scanning: t.scanning,
    awaitingScan: t.awaitingScan,
    checking: t.checking,
    uploadingFile: (name) => f(t.uploadingFile, { name }),
    retryFile: (name) => f(t.retryFile, { name }),
    cancelFile: (name) => f(t.cancelFile, { name }),
    removeFile: (name) => f(t.removeFile, { name }),
    openFile: (name) => f(t.openFile, { name }),
    fileCount: (count) => f(t.fileCount, { count }),
    uploadedCount: (count) => f(t.uploadedCount, { count }),
    awaitingScanCount: (count) => f(t.awaitingScanCount, { count }),
    blockedCount: (count) => f(t.blockedCount, { count }),
    failedCount: (count) => f(t.failedCount, { count }),
    clearAll: t.clearAll,
    clearAllLabel: t.clearAllLabel,
    uploadAll: t.uploadAll,
    cancelAll: t.cancelAll,
    retryFailed: t.retryFailed,
    tooLarge: (limit) => f(t.tooLarge, { limit }),
    tooSmall: (limit) => f(t.tooSmall, { limit }),
    totalTooLarge: (limit) => f(t.totalTooLarge, { limit }),
    typeNotAllowed: t.typeNotAllowed,
    statusSelected: (count) => f(t.statusSelected, { count }),
    statusUploading: (count, percent) => f(t.statusUploading, { count, percent }),
    statusBlocked: (count) => f(t.statusBlocked, { count }),
    statusAwaitingScan: (count) => f(t.statusAwaitingScan, { count }),
    statusCropping: (count) => f(t.statusCropping, { count }),
    dropHere: t.dropHere,
    dragOrBrowse: t.dragOrBrowse,
    browse: t.browse,
    chooseFiles: t.chooseFiles,
    maxReached: t.maxReached,
    maxPerFile: (limit) => f(t.maxPerFile, { limit }),
    upToFiles: (count) => f(t.upToFiles, { count }),
    dropRejected: t.dropRejected,
    waitingToCrop: t.waitingToCrop,
    skipCrop: t.skipCrop,
    skipCropFile: (name) => f(t.skipCropFile, { name }),
    imageTooSmall: (width, height) => f(t.imageTooSmall, { width: String(width), height: String(height) }),
    imageTooLarge: (width, height) => f(t.imageTooLarge, { width: String(width), height: String(height) }),
  };
}

/** Every word the upload says, in English — `svFileUploadLabels(SV_FILE_UPLOAD_TRIGGER_LABELS, '')`. */
export const SV_FILE_UPLOAD_LABELS: SvFileUploadLabels = svFileUploadLabels(SV_FILE_UPLOAD_TRIGGER_LABELS, '');

// ─── A host's own check ───────────────────────────────────────────────────────

/**
 * A host's check on one file: return a message to refuse it, `null` to let it
 * through. May be async — a file is held at "Checking…" and never uploaded
 * until the answer arrives. A thrown error or a rejected promise refuses the
 * file with that error's message.
 *
 * ★ For what the browser can know: a filename pattern, a page count from a
 *   PDF header, a duplicate the server already has. It is a convenience, not
 *   a security boundary — the server checks again.
 */
export type SvFileValidator = (file: File) => string | null | Promise<string | null>;

/** Turn a validator's throw into a sentence. */
export function svValidatorMessage(reason: unknown, fallback: string): string {
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  if (reason instanceof Error && reason.message.trim()) return reason.message.trim();
  return fallback;
}

// ─── Form-level rules ─────────────────────────────────────────────────────────

/** The rules `NG_VALIDATORS` applies to the control as a whole. */
export interface SvFileUploadRules {
  readonly required: boolean;
  readonly minFiles: number;
  /** In bytes; 0 for no cap. */
  readonly maxTotalBytes: number;
}

/**
 * The control's errors, from what is in the list (stored files included — an
 * edit form that already has its document satisfies `required`).
 *
 * `{ required: true }`, `{ minFiles: { required, actual } }`,
 * `{ maxTotalSize: { max, actual } }` — the same shapes Angular's own
 * validators use, so `control.hasError('minFiles')` reads naturally.
 */
export function svFileUploadErrors(
  files: readonly { readonly size: number; readonly status: string; readonly scan?: string }[],
  rules: SvFileUploadRules,
): ValidationErrors | null {
  const usable = files.filter((f) => f.status !== 'error' && f.scan !== 'flagged');
  const errors: Record<string, unknown> = {};
  if (rules.required && usable.length === 0) errors['required'] = true;
  if (rules.minFiles > 0 && usable.length < rules.minFiles) {
    errors['minFiles'] = { required: rules.minFiles, actual: usable.length };
  }
  const total = usable.reduce((sum, f) => sum + f.size, 0);
  if (rules.maxTotalBytes > 0 && total > rules.maxTotalBytes) {
    errors['maxTotalSize'] = { max: rules.maxTotalBytes, actual: total };
  }
  return Object.keys(errors).length ? errors : null;
}

// ─── A ready uploader ─────────────────────────────────────────────────────────

/** Options for `svHttpUploader`. */
export interface SvHttpUploaderOptions {
  /** Where to POST (or PUT) the file. A function gets the file, for per-file URLs. */
  readonly url: string | ((file: File) => string);
  /** @default 'POST' */
  readonly method?: 'POST' | 'PUT';
  /** The multipart field name. @default 'file' */
  readonly fieldName?: string;
  /** Extra headers — an auth token, a CSRF header. A function is read per file. */
  readonly headers?: Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>);
  /** Extra multipart fields sent with each file. */
  readonly fields?: Readonly<Record<string, string>>;
  /** Send cookies cross-origin. @default false */
  readonly withCredentials?: boolean;
  /**
   * Send the bytes as the request body instead of multipart — what an S3
   * pre-signed PUT wants. @default false
   */
  readonly raw?: boolean;
  /** Read the server's JSON reply into `{ id, url }`. Default: the reply's own `id` and `url`. */
  readonly parse?: (response: unknown) => { id?: string; url?: string };
}

interface SvHttpUploadContext {
  readonly file: File;
  readonly onProgress: (percent: number) => void;
  readonly signal: AbortSignal;
  /** Per-file details (the Pro twin's `metadataFields`), sent as multipart fields (`SR-27b`). */
  readonly meta?: Readonly<Record<string, string>>;
}

/**
 * An uploader over `XMLHttpRequest`, for real progress.
 *
 * ★★ XHR, NOT `fetch`, BECAUSE `fetch` HAS NO UPLOAD PROGRESS. A `fetch` body
 *    stream can report what was handed to the network stack, not what reached
 *    the server, and only in Chromium; `xhr.upload.onprogress` is the one
 *    portable source. The abort signal is wired to `xhr.abort()`, so Cancel
 *    really stops the request.
 *
 * ```ts
 * readonly upload = svHttpUploader({ url: '/api/files', headers: () => ({ Authorization: `Bearer ${token()}` }) });
 * // <sv-file-upload [uploader]="upload" />
 * ```
 */
export function svHttpUploader(options: SvHttpUploaderOptions) {
  return ({ file, onProgress, signal, meta }: SvHttpUploadContext): Promise<{ id?: string; url?: string }> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Cancelled'));
        return;
      }
      const xhr = new XMLHttpRequest();
      const url = typeof options.url === 'function' ? options.url(file) : options.url;
      xhr.open(options.method ?? 'POST', url);
      xhr.withCredentials = options.withCredentials ?? false;
      const headers = typeof options.headers === 'function' ? options.headers() : options.headers ?? {};
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress((e.loaded / e.total) * 100);
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Upload failed (${xhr.status}${xhr.statusText ? ' ' + xhr.statusText : ''})`));
          return;
        }
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          body = null; // A reply that is not JSON is still a success.
        }
        const read = options.parse ?? ((r: unknown) => {
          const o = (r ?? {}) as { id?: unknown; url?: unknown };
          return {
            id: typeof o.id === 'string' || typeof o.id === 'number' ? String(o.id) : undefined,
            url: typeof o.url === 'string' ? o.url : undefined,
          };
        });
        resolve(read(body));
      };
      xhr.onerror = () => reject(new Error('Network error — the upload did not reach the server.'));
      xhr.onabort = () => reject(new Error('Cancelled'));
      signal.addEventListener('abort', () => xhr.abort(), { once: true });

      if (options.raw) {
        if (file.type) xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
        return;
      }
      const body = new FormData();
      for (const [name, value] of Object.entries(options.fields ?? {})) body.append(name, value);
      // A file's own details after the shared fields, so they win on a clash.
      for (const [name, value] of Object.entries(meta ?? {})) body.append(name, value);
      body.append(options.fieldName ?? 'file', file, file.name);
      xhr.send(body);
    });
}

// ─── Deterministic demo outcomes ──────────────────────────────────────────────

/**
 * A stable number in [0, 1) for a string — FNV-1a, so the same file name
 * always lands in the same place.
 *
 * ★★ WHY THE DEMO NEEDS IT. `Math.random()` failed a different file on every
 *    run, so a screenshot, a test and a reader trying to retry "the one that
 *    failed" each saw a different one. Hashing the file means `demoFailureRate`
 *    picks the same files every time.
 */
export function svStableUnit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x1_0000_0000;
}

/** Does the demo fail this file, at `rate`? Same file, same answer. */
export function svDemoFails(file: Pick<File, 'name' | 'size'>, rate: number): boolean {
  const r = Math.min(1, Math.max(0, Number.isFinite(rate) ? rate : 0));
  return r > 0 && svStableUnit(`${file.name}\u0000${file.size}`) < r;
}
