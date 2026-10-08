import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
  forwardRef,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  SvFieldErrorComponent,
  SvSpinnerArcComponent,
  createFieldError,
  svDescribedBy,
  svRecoverFocus,
  svSuccessorIndex,
  type SvServerError,
  svUniqueId,
} from '@styloviz/core';

export type FileUploadVariant = 'button';
export type FileUploadSize    = 'sm' | 'md' | 'lg';
export type UploadFileStatus  = 'pending' | 'uploading' | 'success' | 'error';

/**
 * What a malware scanner has said about a file, if anything.
 *
 * ★★★ A SEPARATE AXIS FROM `status`, BECAUSE THE VERDICT ARRIVES AFTER THE
 *     UPLOAD SUCCEEDS. The thing that scans is the server, and it scans what it
 *     received — so `status: 'success'` with `scan: 'pending'` is a real state
 *     lasting several seconds, and `'flagged'` is not an upload failure at all:
 *     the upload worked, the CONTENT is the problem. Folding these into
 *     `status` would make `errorCount` count a successful upload and offer a
 *     Retry button for a file the server has already rejected on content.
 *
 * ★ `'unscanned'` is not absent. Absent means the host does not scan and this
 *   component should say nothing about safety; `'unscanned'` means the host
 *   does scan and nobody has looked at this one.
 *
 * Both tiers keep a `'flagged'` file out of the form value; the Pro twin's
 * `scanPolicy` can additionally hold back uploaded files nobody has cleared.
 */
export type SvScanVerdict = 'unscanned' | 'pending' | 'clean' | 'flagged';

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: UploadFileStatus;
  progress: number;
  /** The scanner's verdict, when the host reports one. */
  scan?: SvScanVerdict;
  /** What the scanner said, for a `'flagged'` file. Shown to the user as-is. */
  scanReason?: string;
  preview?: string;       // data-url for images
  errorMsg?: string;
  /** Identifier the server assigned, once the upload succeeded. */
  remoteId?: string;
  /** URL the server stored the file at, once the upload succeeded. */
  url?: string;
}

// ─── Upload transport ─────────────────────────────────────────────────────────

/** Everything an uploader needs for one file. */
export interface SvUploadContext {
  /** The entry's id in this component — matches `UploadFile.id`. */
  readonly id: string;
  /** The browser `File` to send. */
  readonly file: File;
  /** Report completion, 0–100. Out-of-range and non-finite values are clamped. */
  readonly onProgress: (percent: number) => void;
  /**
   * Aborted when the user cancels the file, removes it, or the component is
   * destroyed. Honour it — `fetch` takes it directly, and an XHR-based uploader
   * should call `xhr.abort()` from its `abort` listener. Ignoring it leaks the
   * request and lets a dead upload finish against a destroyed view.
   */
  readonly signal: AbortSignal;
}

/** What the server said about a stored file. Both fields are optional. */
export interface SvUploadResult {
  /** Identifier to reference the file by later. */
  readonly id?: string;
  /** URL the file is now served from. */
  readonly url?: string;
}

/**
 * Sends one file and resolves when it is stored.
 *
 * Transport-agnostic on purpose: the kit takes no dependency on `HttpClient`,
 * so this works with fetch, XHR, an S3 pre-signed PUT, or a resumable client.
 * Reject to fail the file — the rejection's message is shown to the user.
 *
 * With fetch:
 * ```ts
 * upload: SvUploader = async ({ file, signal }) => {
 *   const body = new FormData();
 *   body.append('file', file);
 *   const res = await fetch('/api/files', { method: 'POST', body, signal });
 *   if (!res.ok) throw new Error(`Upload failed (${res.status})`);
 *   return res.json();
 * };
 * ```
 *
 * With `HttpClient`, for real progress:
 * ```ts
 * upload: SvUploader = ({ file, onProgress, signal }) =>
 *   new Promise((resolve, reject) => {
 *     const body = new FormData();
 *     body.append('file', file);
 *     const sub = this.http
 *       .post<SvUploadResult>('/api/files', body, { reportProgress: true, observe: 'events' })
 *       .subscribe({
 *         next: (e) => {
 *           if (e.type === HttpEventType.UploadProgress && e.total) {
 *             onProgress((e.loaded / e.total) * 100);
 *           } else if (e.type === HttpEventType.Response) {
 *             resolve(e.body ?? {});
 *           }
 *         },
 *         error: reject,
 *       });
 *     signal.addEventListener('abort', () => { sub.unsubscribe(); reject(new Error('Cancelled')); });
 *   });
 * ```
 */
export type SvUploader = (ctx: SvUploadContext) => Promise<SvUploadResult | void>;

const FILE_ICONS: Record<string, string> = {
  // ★ Icon-library NAMES (were eight hand-drawn `d` strings — one page outline
  //   with a different inner mark each). The library's own `file-*` family is
  //   exactly that idea, so the five Pro members were moved into the free set
  //   rather than approximating them: a FREE file-upload cannot label its own
  //   file types otherwise.
  pdf:  'file-text',
  doc:  'files',
  xls:  'file-spreadsheet',
  zip:  'file-archive',
  img:  'image',
  vid:  'file-video',
  audio:'file-audio',
  file: 'file',
};

const EXT_MAP: Record<string, string> = {
  pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls',
  zip: 'zip', rar: 'zip', gz: 'zip',
  mp4: 'vid', mov: 'vid', avi: 'vid', webm: 'vid',
  mp3: 'audio', wav: 'audio', ogg: 'audio',
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
};

/**
 * ★★ A file-TYPE identity palette, not a set of roles, so it stays on literal
 *    Tailwind hues while the rest of this component paints from tokens. Two
 *    reasons. First, red-for-PDF and green-for-spreadsheet are conventions a
 *    reader already knows; they are not this kit’s danger and success. Second,
 *    the eight entries only work if they stay eight distinguishable colours —
 *    fold pdf into `danger` and xls into `accent` and a buyer who picks a
 *    warm green makes a spreadsheet badge look like a PDF badge.
 *
 * ★ `file` keeps `gray`, deliberately: the unknown-type badge is the one that
 *   should recede into whatever neutral the buyer set.
 */
const BADGE_COLOR: Record<string, string> = {
  pdf:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  doc:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  xls:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  zip:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  img:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  vid:   'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  audio: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  file:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** Turn a rejection into something safe to show next to the file name. */
function uploadErrorMessage(reason: unknown): string {
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  if (reason instanceof Error && reason.message.trim()) return reason.message.trim();
  if (reason && typeof reason === 'object') {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return 'Upload failed.';
}

@Component({
  selector: 'sv-file-upload',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvFieldErrorComponent, SvSpinnerArcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-upload.component.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SvFileUploadComponent), multi: true },
  ],
})
export class SvFileUploadComponent implements OnDestroy, ControlValueAccessor {
  private static idCounter = 0;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  private uid(): string {
    return `uf-${++SvFileUploadComponent.idCounter}`;
  }

  /** Reads an image into a data-URL thumbnail for the row with `id`. */
  private readPreview(id: string, file: File): void {
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.files.update(list =>
        list.map(f => f.id === id ? { ...f, preview: ev.target?.result as string } : f)
      );
    };
    reader.readAsDataURL(file);
  }

  // ── Inputs ─────────────────────────────────────────────────────────────────
  /** Trigger style: button or drag-and-drop dropzone. @default 'button' */
  variant = input<FileUploadVariant>('button');
  /** Control size: sm, md or lg. @default 'md' */
  size         = input<FileUploadSize>('md');
  /**
   * Accepted file types — which files the picker offers and the queue keeps — `"image/*,.pdf"`.
   *
   * ★★★ THIS IS A CONVENIENCE FILTER. IT IS NOT A SECURITY CHECK (`FI-10-I1`).
   *     It matches an extension out of a filename the user chose, or a
   *     `File.type` the browser derived from that same extension — so
   *     `payload.exe` renamed `photo.png` passes `accept=".png"` and reports
   *     `image/png`, because it is called `.png`. Nothing here reads the bytes.
   *
   * ★★ AND THE FILE NEED NOT COME THROUGH THIS COMPONENT AT ALL. Your upload
   *    endpoint accepts requests; `curl` is not running this filter. Every
   *    check here runs in a browser belonging to a user who is not the attacker
   *    in the case that matters.
   *
   * ★ What it is genuinely for: keeping the OS picker tidy and keeping junk out
   *   of the queue. Both are about the honest user's experience, which is the
   *   whole job.
   *
   * ⚠️ **Validate the type on the server, from the bytes, at the point of
   *    storage** — with a size limit the client cannot raise and a malware
   *    scan. `markScanned` is how the verdict gets back here.
   */
  accept       = input<string>('');          // e.g. "image/*,.pdf"
  /** Allow selecting multiple files. @default true */
  multiple     = input(true);
  /** Maximum number of files. @default 10 */
  maxFiles     = input(10);
  /** Per-file size limit in MB. @default 10 */
  maxSizeMb    = input(10);                  // per-file max in MB
  /** Disable the uploader. @default false */
  disabled     = input(false);
  /**
   * The function that actually sends a file. Without one the component only
   * collects files — it has no way to store them, and `autoUpload` does nothing.
   * @default null
   */
  uploader     = input<SvUploader | null>(null);

  /**
   * Start uploading as soon as files are added. Set false to collect first and
   * call `uploadAll()` from a submit button.
   * @default true
   */
  autoUpload   = input(true);

  /**
   * Maximum uploads in flight at once. The rest queue. Firing ten parallel
   * uploads saturates the connection and makes every one of them slower.
   * Clamped to at least 1.
   * @default 3
   */
  concurrency  = input(3);

  /**
   * Fake the upload with a progress animation and an occasional random failure.
   * For demos and screenshots only — never in a real app. Replaces the former
   * `autoSimulate` input, and is ignored whenever an `uploader` is supplied.
   * @default false
   */
  demoMode     = input(false);
  /** Trigger/label text. @default 'Upload files' */
  label        = input('Upload files');
  /** Helper text shown under the trigger. */
  hint         = input('');
  /** Extra CSS classes for the root. */
  customClass  = input('');

  // ── Outputs ────────────────────────────────────────────────────────────────
  /** Emitted with the full file list whenever it changes. */
  filesChange     = output<UploadFile[]>();
  /** Emitted when a single file is added. */
  fileAdded       = output<UploadFile>();
  /** Emitted with the id of a removed file. */
  fileRemoved     = output<string>();
  /** The run has settled: every file finished uploading or failed. Fires once per run with the full file list. */
  uploadComplete  = output<UploadFile[]>();
  /** Emitted when a file fails validation or upload. */
  uploadError     = output<UploadFile>();
  /** A file's upload was cancelled by the user. */
  uploadCancelled = output<UploadFile>();

  /**
   * A file's malware-scan verdict changed. Carries the whole entry.
   *
   * ★ Fires for every transition the host drives, `'pending'` included, so a
   *   toast or an audit line can be written when it happens rather than by
   *   diffing `files()`.
   */
  scanChange      = output<UploadFile>();

  // ── Internal state ─────────────────────────────────────────────────────────
  files      = signal<UploadFile[]>([]);
  isDragOver = signal(false);

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  /**
   * `ReturnType<typeof setTimeout>`, not `number`: the DOM overload returns a
   * number but the Node one returns a `Timeout`, so a bare `number[]` only
   * type-checks while @types/node is out of scope. This is the portable form.
   */
  private timers: ReturnType<typeof setTimeout>[] = [];

  // ── ControlValueAccessor ─────────────────────────────────────────────────
  // ★ The docs and the gallery have always bound the FREE upload with
  //   `[formControl]` / `formControlName` / `[(ngModel)]`, and only the Pro twin
  //   implemented the interface — so the documented binding threw NG01203 at
  //   runtime (1.0 release; found by `check:ui` form-binding-without-accessor).
  //   Same contract as `sv-file-upload-pro`: the control value is the native
  //   `File[]`, the event API stays intact, and a disabled control disables the
  //   field. A file the scanner flagged is never in the value.

  private _onChange: (value: File[]) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);

  /** `[disabled]` OR a disabled form control. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(value: File[] | null): void {
    const incoming = Array.isArray(value) ? value : [];
    this.files.set(incoming.map((file) => this.entryFromFile(file)));
  }
  registerOnChange(fn: (value: File[]) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this._formDisabled.set(isDisabled); }

  /** A File supplied through the form value, as a completed entry. */
  private entryFromFile(file: File): UploadFile {
    const entry: UploadFile = {
      id: this.uid(), file, name: file.name, size: file.size,
      type: file.type, status: 'success', progress: 100,
    };
    if (file.type.startsWith('image/')) this.readPreview(entry.id, file);
    return entry;
  }

  /** Emits `filesChange` AND tells a bound form control. */
  private notifyChange(): void {
    const files = this.files();
    this.filesChange.emit(files);
    this._onChange(files.filter((f) => f.scan !== 'flagged').map((f) => f.file));
    this._onTouched();
  }

  // ── Computed helpers ───────────────────────────────────────────────────────
  hasFiles     = computed(() => this.files().length > 0);
  canAddMore   = computed(() => this.files().length < this.maxFiles());
  /**
   * Uploaded files nothing has held back. A file the host reported as
   * `'pending'` or `'unscanned'` is not counted — "1 uploaded" beside a row
   * saying "Scanning for malware…" is two answers to one question. Same rule as
   * the Pro twin's `isCleared`. With no verdicts reported, unchanged.
   */
  successCount = computed(() => this.files().filter(f => f.status === 'success' && !this.scanHolds(f)).length);
  /** Files the scanner rejected. `status` is still `'success'` — see `SvScanVerdict`. */
  flaggedCount = computed(() => this.files().filter(f => f.scan === 'flagged').length);
  /** Uploaded files the host reported as `'pending'` or `'unscanned'`. */
  scanningCount = computed(() => this.files().filter(f => f.status === 'success' && this.scanUnresolved(f)).length);

  /** A reported verdict that keeps an uploaded file from counting as done. */
  private scanHolds(f: UploadFile): boolean {
    return f.scan === 'flagged' || this.scanUnresolved(f);
  }

  /** `'pending'` or `'unscanned'` — the host scans, and has not cleared this one. */
  protected scanUnresolved(f: UploadFile): boolean {
    return f.scan === 'pending' || f.scan === 'unscanned';
  }
  errorCount   = computed(() => this.files().filter(f => f.status === 'error').length);
  uploadingCount = computed(() => this.files().filter(f => f.status === 'uploading').length);

  overallProgress = computed(() => {
    const all = this.files();
    if (!all.length) return 0;
    return Math.round(all.reduce((s, f) => s + f.progress, 0) / all.length);
  });

  /** Screen-reader status summary (announced politely via an aria-live region). */
  statusMessage = computed<string>(() => {
    const all = this.files();
    if (!all.length) return '';
    const up = this.uploadingCount();
    if (up > 0) return `Uploading ${up} file${up === 1 ? '' : 's'}, ${this.overallProgress()} percent`;
    const parts = [`${all.length} file${all.length === 1 ? '' : 's'} selected`];
    if (this.successCount()) parts.push(`${this.successCount()} uploaded`);
    /**
     * ★★ ANNOUNCED SEPARATELY FROM "FAILED", and before it. A screen reader
     *    user hearing "1 failed" about a file the scanner rejected would
     *    reasonably retry it — a failed upload and a quarantined one need
     *    different actions, so they need different words.
     */
    if (this.flaggedCount()) parts.push(`${this.flaggedCount()} blocked by a security scan`);
    if (this.scanningCount()) parts.push(`${this.scanningCount()} awaiting a security scan`);
    if (this.errorCount())   parts.push(`${this.errorCount()} failed`);
    return parts.join(', ');
  });

  // ── Zone classes ───────────────────────────────────────────────────────────
  zoneClasses = computed(() => {
    const drag = this.isDragOver();
    const dis  = this.resolvedDisabled();
    const base = [
      'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed',
      'transition-all duration-200 cursor-pointer outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
    ];
    const sizes: Record<FileUploadSize, string> = {
      sm: 'gap-2 px-6 py-8',
      md: 'gap-3 px-8 py-12',
      lg: 'gap-4 px-10 py-16',
    };
    base.push(sizes[this.size()]);
    if (dis) {
      base.push('border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800/40');
    } else if (drag) {
      base.push('border-primary-400 bg-primary-50/60 dark:border-primary-500 dark:bg-primary-900/20 scale-[1.01]');
    } else {
      base.push('border-gray-300 bg-gray-50/50 hover:border-primary-400 hover:bg-primary-50/30 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:border-primary-500 dark:hover:bg-primary-900/10');
    }
    return base.join(' ');
  });

  iconSize = computed(() => ({ sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' })[this.size()]);
  labelClass = computed(() => ({ sm: 'text-sm', md: 'text-base', lg: 'text-lg' })[this.size()]);
  hintClass  = computed(() => ({ sm: 'text-xs', md: 'text-sm',  lg: 'text-base' })[this.size()]);

  // ── Public helpers used in template ───────────────────────────────────────
  /** File → icon-library NAME (was a raw `d` string). */
  getIcon(file: UploadFile): string {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const kind = EXT_MAP[ext] ?? (file.type.startsWith('image/') ? 'img' : 'file');
    return FILE_ICONS[kind] ?? FILE_ICONS['file'];
  }

  getBadgeColor(file: UploadFile): string {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const kind = EXT_MAP[ext] ?? (file.type.startsWith('image/') ? 'img' : 'file');
    return BADGE_COLOR[kind] ?? BADGE_COLOR['file'];
  }

  getExtLabel(file: UploadFile): string {
    return (file.name.split('.').pop()?.toUpperCase() ?? 'FILE').slice(0, 5);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  isImage(file: UploadFile): boolean {
    return file.type.startsWith('image/') && !!file.preview;
  }

  // ── File input / drag ─────────────────────────────────────────────────────
  openFilePicker(): void {
    if (this.resolvedDisabled() || !this.canAddMore()) return;
    this.fileInput()?.nativeElement.click();
  }

  onFileInputChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!this.resolvedDisabled()) this.isDragOver.set(true);
  }

  onDragLeave(e: DragEvent): void {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      this.isDragOver.set(false);
    }
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(false);
    if (this.resolvedDisabled()) return;
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    this.addFiles(dropped);
  }

  onZoneKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openFilePicker(); }
  }

  /** Whether a file matches the `accept` filter (mime, mime/*, or .ext). */
  private isAccepted(file: File): boolean {
    const accept = this.accept().trim();
    if (!accept) return true;
    const tokens = accept.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (!tokens.length) return true;
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return tokens.some(tok => {
      if (tok.startsWith('.'))  return name.endsWith(tok);
      if (tok.endsWith('/*'))   return type.startsWith(tok.slice(0, -1));
      return type === tok;
    });
  }

  // ── Core file logic ────────────────────────────────────────────────────────
  private addFiles(rawFiles: File[]): void {
    const remaining = this.maxFiles() - this.files().length;
    const toAdd = this.multiple() ? rawFiles.slice(0, remaining) : rawFiles.slice(0, 1);

    const newEntries: UploadFile[] = [];

    for (const file of toAdd) {
      const sizeMb = file.size / 1024 / 1024;
      const entry: UploadFile = {
        id:       this.uid(),
        file,
        name:     file.name,
        size:     file.size,
        type:     file.type,
        status:   'pending',
        progress: 0,
      };

      if (sizeMb > this.maxSizeMb()) {
        entry.status  = 'error';
        entry.errorMsg = `File exceeds ${this.maxSizeMb()} MB limit`;
        entry.progress = 0;
        this.uploadError.emit(entry);
      } else if (!this.isAccepted(file)) {
        entry.status  = 'error';
        entry.errorMsg = 'File type not allowed';
        entry.progress = 0;
        this.uploadError.emit(entry);
      }

      // Generate preview for images
      if (file.type.startsWith('image/') && entry.status !== 'error') this.readPreview(entry.id, file);

      newEntries.push(entry);
    }

    this.files.update(list => [...list, ...newEntries]);

    const startable = this.autoUpload() && (this.uploader() !== null || this.demoMode());
    for (const entry of newEntries) {
      this.fileAdded.emit(entry);
      // A file rejected by validation never reaches the server.
      if (entry.status !== 'error' && startable) this.enqueue(entry.id);
    }
    if (startable) this.pump();

    this.notifyChange();
  }

  // ── Upload engine ───────────────────────────────────────────────────────────

  /** Abort controllers for uploads in flight, keyed by entry id. */
  private readonly controllers = new Map<string, AbortController>();

  /** Entry ids waiting for a concurrency slot. */
  private queue: string[] = [];

  /** An upload has started since `uploadComplete` was last reported. */
  private completionOwed = false;

  /** Whether anything is still in flight or waiting. */
  readonly isUploading = computed(() => this.uploadingCount() > 0);

  /**
   * Upload every pending file.
   *
   * Safe to call repeatedly — files already uploading, queued or finished are
   * skipped, so a double-clicked submit button cannot send anything twice.
   */
  uploadAll(): void {
    if (this.resolvedDisabled()) return;
    for (const entry of this.files()) {
      if (entry.status === 'pending') this.enqueue(entry.id);
    }
    this.pump();
  }

  /** Cancel one upload. The entry stays in the list, reset to `pending`. */
  cancelUpload(id: string): void {
    this.cancelOne(id, this.queue.includes(id));
    this.pump();
  }

  /**
   * Cancel everything in flight and everything queued.
   *
   * ★ The queue is emptied BEFORE anything is cancelled. `cancelUpload` pumps
   * when it is done, so freeing the slot held by file 1 immediately STARTED
   * file 4 — which the loop then reached, aborted, and freed a slot for file 5.
   * Cancelling ten queued uploads opened and aborted all ten requests, on a
   * connection the user had just asked it to stop using.
   */
  cancelAll(): void {
    const queued = new Set(this.queue);
    const ids = [...this.controllers.keys(), ...queued];
    this.queue = [];
    for (const id of ids) this.cancelOne(id, queued.has(id));
    this.pump();
  }

  /**
   * The body of a cancel, without the pump.
   *
   * `wasQueued` is passed in rather than read from `this.queue`, so `cancelAll`
   * can clear the queue up front and still report the queued files it cancelled.
   */
  private cancelOne(id: string, wasQueued: boolean): void {
    this.queue = this.queue.filter((q) => q !== id);
    const controller = this.controllers.get(id);
    controller?.abort();
    this.controllers.delete(id);

    const entry = this.files().find((f) => f.id === id);
    if (!entry || (entry.status !== 'uploading' && !wasQueued)) return;

    this.patch(id, { status: 'pending', progress: 0, errorMsg: undefined });
    const cancelled = this.files().find((f) => f.id === id);
    if (cancelled) this.uploadCancelled.emit(cancelled);
  }

  /** Add an entry to the queue unless it is already there or already running. */
  private enqueue(id: string): void {
    if (this.controllers.has(id) || this.queue.includes(id)) return;
    this.queue.push(id);
  }

  /** Start as many queued uploads as the concurrency limit allows. */
  private pump(): void {
    const limit = Math.max(1, Math.floor(this.concurrency()) || 1);
    while (this.controllers.size < limit && this.queue.length) {
      const id = this.queue.shift();
      if (id) this.startUpload(id);
    }
  }

  /** Apply a partial update to one entry. */
  private patch(id: string, changes: Partial<UploadFile>): void {
    this.files.update((list) => list.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  }

  // ── Malware scanning (`FI-10-M1`) ──────────────────────────────────────────

  /**
   * Mark a file as being scanned. Call when the scan starts.
   *
   * ★ Id-tolerant: an id that has been removed does nothing rather than
   *   throwing. A scan is asynchronous and the user is free to delete the row
   *   while it runs, which makes "the file is gone" an ordinary outcome.
   */
  markScanning(id: string): void {
    this.setScan(id, 'pending');
  }

  /**
   * Record a scanner's verdict.
   *
   * @param reason shown to the user verbatim for a `'flagged'` file — so pass
   * something a person can act on, not an internal code.
   *
   * ★★ IT DOES NOT CHANGE `status`. A flagged file uploaded successfully; the
   *    bytes are on the server and the content is the problem. Turning it into
   *    an `'error'` would offer a Retry for a file the server has already looked
   *    at and rejected.
   */
  markScanned(id: string, verdict: SvScanVerdict, reason?: string): void {
    this.setScan(id, verdict, reason);
  }

  private setScan(id: string, verdict: SvScanVerdict, reason?: string): void {
    if (!this.files().some((f) => f.id === id)) return;
    this.patch(id, {
      scan: verdict,
      // A file re-scanned clean must not keep the sentence explaining why it
      // was not.
      scanReason: verdict === 'flagged' ? reason : undefined,
    });
    const after = this.files().find((f) => f.id === id);
    if (after) this.scanChange.emit(after);
    this.notifyChange();
  }

  /**
   * Send one file through the host's `uploader`, or through the demo animation
   * when there is none and `demoMode` is on.
   */
  private startUpload(id: string): void {
    const entry = this.files().find((f) => f.id === id);
    if (!entry || entry.status === 'success') return;

    const uploader = this.uploader();
    if (!uploader) {
      if (this.demoMode()) this.simulateUpload(id);
      return;
    }

    const controller = new AbortController();
    this.controllers.set(id, controller);
    this.completionOwed = true;
    this.patch(id, { status: 'uploading', progress: 0, errorMsg: undefined });

    const ctx: SvUploadContext = {
      id,
      file: entry.file,
      signal: controller.signal,
      onProgress: (percent) => {
        // A late progress callback from an aborted upload must not resurrect a
        // cancelled row, and a NaN from a zero-byte file must not blank the bar.
        if (controller.signal.aborted) return;
        const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0;
        this.patch(id, { progress: clamped });
      },
    };

    void Promise.resolve()
      .then(() => uploader(ctx))
      .then(
        (result) => this.finishUpload(id, controller, result ?? undefined),
        (reason: unknown) => this.failUpload(id, controller, reason),
      );
  }

  /** Mark an upload successful, unless it was cancelled while in flight. */
  private finishUpload(id: string, controller: AbortController, result?: SvUploadResult): void {
    if (controller.signal.aborted) return;
    this.controllers.delete(id);
    this.patch(id, {
      status: 'success',
      progress: 100,
      errorMsg: undefined,
      remoteId: result?.id,
      url: result?.url,
    });
    this.notifyChange();
    this.settle();
  }

  /** Mark an upload failed. A cancellation is not a failure. */
  private failUpload(id: string, controller: AbortController, reason: unknown): void {
    if (controller.signal.aborted) return;
    this.controllers.delete(id);
    this.patch(id, { status: 'error', errorMsg: uploadErrorMessage(reason) });
    const failed = this.files().find((f) => f.id === id);
    if (failed) this.uploadError.emit(failed);
    this.settle();
  }

  /** Start the next queued upload and announce completion when the run is done. */
  private settle(): void {
    this.pump();
    this.reportCompletionIfDone();
  }

  /**
   * Report `uploadComplete` — once — when the run that is owed it has settled.
   *
   * ★★ ONCE PER RUN. `completionOwed` is set when an upload starts and cleared
   *    when completion is reported, so removing a file from an already-reported
   *    list does not announce the run again.
   *
   * ★ Removing the last unfinished file also settles a run. Before, removing an
   *   in-flight upload neither started the next queued file nor reported the
   *   run, so a batch whose stuck file the user deleted never completed.
   */
  private reportCompletionIfDone(): void {
    if (!this.completionOwed || this.controllers.size || this.queue.length) return;
    const all = this.files();
    if (!all.length || !all.every((f) => f.status === 'success' || f.status === 'error')) return;
    this.completionOwed = false;
    this.uploadComplete.emit(all);
  }

  // ── Demo mode ───────────────────────────────────────────────────────────────

  /**
   * Fake progress with a random failure. Reachable only via `demoMode`, and
   * only when no real `uploader` is bound — it exists so the showcase can
   * demonstrate the progress and error states without a server.
   */
  private simulateUpload(id: string): void {
    // Skip simulation in SSR environments where setTimeout is unreliable.
    if (!isPlatformBrowser(this.platformId)) return;

    this.files.update(list =>
      list.map(f => f.id === id ? { ...f, status: 'uploading' as const } : f)
    );
    this.completionOwed = true;

    const duration = 1200 + Math.random() * 1800;
    const interval = 80;
    const steps    = Math.round(duration / interval);
    let   step     = 0;

    const tick = () => {
      step++;
      const progress = Math.min(100, Math.round((step / steps) * 100));
      const isDone   = step >= steps;
      const hasErr   = Math.random() < 0.08 && progress > 40 && !isDone; // 8% random error

      this.files.update(list =>
        list.map(f => {
          if (f.id !== id) return f;
          if (hasErr)  return { ...f, status: 'error'   as const, progress, errorMsg: 'Upload failed — server error' };
          if (isDone)  return { ...f, status: 'success' as const, progress: 100 };
          return { ...f, progress };
        })
      );

      if (hasErr) {
        const errFile = this.files().find(f => f.id === id);
        if (errFile) this.uploadError.emit(errFile);
        this.reportCompletionIfDone();
        return;
      }

      if (isDone) {
        this.reportCompletionIfDone();
        return;
      }

      const t = setTimeout(tick, interval);
      this.timers.push(t);
    };

    const t0 = setTimeout(tick, interval);
    this.timers.push(t0);
  }

  retryFile(id: string): void {
    if (this.resolvedDisabled()) return;
    this.patch(id, { status: 'pending', progress: 0, errorMsg: undefined });
    if (this.uploader() || this.demoMode()) {
      this.enqueue(id);
      this.pump();
    }
  }

  removeFile(id: string): void {
    if (this.resolvedDisabled()) return;
    const index = this.files().findIndex(f => f.id === id);
    const hadFocus = this._focusIsIn(`[data-sv-file-id]`, id);
    // Abort first: dropping the row while its request is still on the wire
    // leaks the upload and lets it complete against an entry that is gone.
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.queue = this.queue.filter((q) => q !== id);
    this.files.update(list => list.filter(f => f.id !== id));
    if (hadFocus) this._recoverFocusAfterRemoval(index);
    this.fileRemoved.emit(id);
    this.notifyChange();
    // The removed file may have held a concurrency slot or been the last one
    // the run was waiting on — start the next queued file, settle the run.
    this.pump();
    this.reportCompletionIfDone();
  }

  clearAll(): void {
    if (this.resolvedDisabled()) return;
    const hadFocus = this._focusIsIn('[data-sv-file-list], [data-sv-file-clear]');
    this.cancelAll();
    this.completionOwed = false;
    this.files.set([]);
    if (hadFocus) this._recoverFocusAfterRemoval(-1);
    this.notifyChange();
  }

  // ── Focus after a file is removed (X-12) ─────────────────────────────────
  //
  // The kit's mutation rule: the Remove button of the file that slid into the
  // removed one's place, else the one before it, else the control that adds
  // files — never `<body>`. Only when focus was in the removed row: a host
  // calling `removeFile()` from elsewhere does not get focus stolen.

  /** Whether focus is inside the element matching `selector` (and `id`, when given). */
  private _focusIsIn(selector: string, id?: string): boolean {
    if (typeof document === 'undefined') return false;
    const holder = (document.activeElement as HTMLElement | null)?.closest?.(selector);
    if (!holder || !(this._host.nativeElement).contains(holder)) return false;
    return id === undefined || holder.getAttribute('data-sv-file-id') === id;
  }

  private _recoverFocusAfterRemoval(index: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const root = this._host.nativeElement;
      const removes = [...root.querySelectorAll<HTMLElement>('[data-sv-file-remove]')];
      svRecoverFocus({
        to: [removes[svSuccessorIndex(index, removes.length)], root.querySelector('[data-sv-upload-trigger]')],
        fallback: root.firstElementChild,
      });
    }, 0);
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => clearTimeout(t));
    // An upload outliving its component writes progress into a destroyed view.
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.queue = [];
  }

  // ── Validation error ─────────────────────────────────────────────────────
  //
  // Per-file upload failures already render on the file rows. This is the
  // form's verdict on the FIELD — "a document is required", "at least two
  // files" — which had nowhere to go.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.files, this.serverError, this.errorMessage);
  protected readonly validationErrorId = svUniqueId('sv-file-upload-error');
  protected readonly hintId = svUniqueId('sv-file-upload-hint');

  /**
   * Everything under the control that describes it, in reading order.
   *
   * ★ This used to be `fieldError.showError() ? validationErrorId : null` —
   * which is not "describe this control", it is "describe it with the error
   * INSTEAD of the hint". The hint carries the size limit and the accepted
   * types, so the moment a file was rejected the user lost the one sentence
   * that says which files are allowed. `svDescribedBy` keeps both, in one
   * order fixed across the kit.
   *
   * The `button` variant renders its hint only when the host supplies one; the
   * other two always render a paragraph, falling back to the size limit.
   */
  protected readonly describedBy = computed<string | null>(() =>
    svDescribedBy({
      hint: (this.variant() !== 'button' || !!this.hint()) && this.hintId,
      error: this.fieldError.showError() && this.validationErrorId,
    }),
  );

}
