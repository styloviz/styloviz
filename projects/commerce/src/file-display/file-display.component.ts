import {
  Component,
  input,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
  afterNextRender,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  svFirstFocusableWithin,
  svIsFocusable,
  svRecoverFocus,
  svRequestKey,
  toSvDataError,
  type SvDataError,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileStatus  = 'idle' | 'uploading' | 'success' | 'error';
export type FileVariant = 'card' | 'row' | 'compact';

/**
 * What the host knows about this file's safety.
 *
 * ★ `'unscanned'` is the DEFAULT and it is not a synonym for `'clean'`. Most
 * hosts scan nothing, and a component that renders an unlabelled one-click
 * download for every file is asserting, on the host's behalf, that the file is
 * safe to open — which is the one claim a file viewer must never make by
 * omission. `'unscanned'` says the question was never asked; `'clean'` says it
 * was asked and answered.
 */
export type FileScanState = 'unscanned' | 'pending' | 'clean' | 'flagged';

/**
 * The user asked to retry a failed upload.
 *
 * ★ `resumeFrom` is why this is an object and not a bare `void`. A retry that
 * silently restarts a 900 MB upload from zero on a metered connection is a
 * different act from resuming it, and the two must not share a button that says
 * the same word. The component labels the control from what it has been told —
 * `resumable` plus `uploadedBytes` — so the user reads *Resume from 412 MB* or
 * *Retry from the start*, and `resumeFrom` carries the number the host needs to
 * honour it.
 */
export interface FileRetryEvent {
  /** The file whose upload failed. */
  readonly fileName: string;
  /**
   * Byte offset to resume from — `0` when the upload must start over, because
   * the host did not say it was resumable or did not say how far it got.
   */
  readonly resumeFrom: number;
  /**
   * Client-generated key for this attempt, stable across transport-level
   * retries of it, so a resumed upload cannot be committed twice.
   */
  readonly requestKey: string;
}

/**
 * The user asked for this file to be deleted, and meant it.
 *
 * ★ There is deliberately NO `rollback()` here, unlike every other write in the
 *   kit. This component renders ONE file; the list it sits in belongs to the
 *   host, so the component cannot put itself back — it has nothing to put itself
 *   back into. What it owes instead is the step before: a confirmation, so the
 *   irreversible act is never one stray click. `removeError` reports a delete
 *   that failed, and the row is still there because the host never took it out.
 */
export interface FileRemoveEvent {
  /** The file the user confirmed deleting. */
  readonly fileName: string;
  /**
   * Client-generated key for this delete, stable across retries of it. Send it
   * and ignore a key already applied, so a retried request cannot delete a
   * second file that has since taken the same name.
   */
  readonly requestKey: string;
}

/** Where focus goes if the host removes this file while it held focus (X-12). */
interface RemovalNeighbours {
  readonly next: Element | null;
  readonly previous: Element | null;
  readonly container: Element | null;
}

/** An element itself when it takes focus, else the first control inside it. */
function focusTarget(el: Element | null): HTMLElement | null {
  return svIsFocusable(el) ? el : svFirstFocusableWithin(el);
}

/** Bytes as a short human string. Shared by the size line and the resume label. */
function formatBytes(size: number): string {
  if (size < 1024)       return `${size} B`;
  if (size < 1048576)    return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1073741824) return `${(size / 1048576).toFixed(1)} MB`;
  return `${(size / 1073741824).toFixed(1)} GB`;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvFileDisplayComponent — Displays a file with icon, name, status and actions.
 *
 * Features:
 * - MIME-type-aware icon
 * - Image preview thumbnail
 * - Upload progress bar
 * - 3 layout variants: card, row, compact
 * - Removable and downloadable actions
 * - Dark mode
 */
@Component({
  selector: 'sv-file-display',
  standalone: true,
  imports: [SvIconComponent, NgClass],
  templateUrl: './file-display.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvFileDisplayComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** File name including extension. */
  fileName = input<string>('');

  /** File size in bytes (auto-formatted). */
  fileSize = input<number | undefined>(undefined);

  /** MIME type string for icon selection. */
  mimeType = input<string>('');

  /** Current file status. @default 'idle' */
  status = input<FileStatus>('idle');

  /** Upload progress 0–100. Only shown when status = 'uploading'. */
  progress = input<number | undefined>(undefined);

  /** Image preview URL (shown for image MIME types). */
  previewUrl = input<string>('');

  /** Show remove button. @default true */
  removable = input<boolean>(true);

  /** Show download button. @default true */
  downloadable = input<boolean>(true);

  /** Layout variant. @default 'card' */
  variant = input<FileVariant>('card');

  // ── Is it safe to open? ─────────────────────────────────────────────────────

  /**
   * What the host knows about this file's safety. @default 'unscanned'
   *
   * See {@link FileScanState}: the default is *nobody asked*, not *it is fine*.
   */
  scan = input<FileScanState>('unscanned');

  /**
   * The host's own wording for a `'flagged'` file — what the scanner matched,
   * or which policy it broke. Shown in place of the generic sentence, because
   * "Contains a macro that writes to disk" is actionable and "Flagged as
   * unsafe" is not. @default ''
   */
  scanNote = input<string>('');

  /**
   * Whether a `'flagged'` file may be downloaded at all, behind a confirmation.
   *
   * ★ Off by default, and the override is a HOST decision rather than a user
   * one: an analyst triaging a quarantine queue needs the bytes, and an ordinary
   * user of a file list does not. When it is off there is no button to press, no
   * disabled control to hover, and no ambiguity about whether pressing harder
   * would work — just the reason the file is blocked.
   * @default false
   */
  allowUnsafeDownload = input<boolean>(false);

  // ── Uploads that did not finish ─────────────────────────────────────────────

  /**
   * Why the upload failed. Shown beside the retry control when
   * `status` is `'error'`. @default null
   */
  uploadError = input<SvDataError | string | null>(null);

  /**
   * Whether the host can resume this upload rather than starting over.
   * @default false
   */
  resumable = input<boolean>(false);

  /**
   * Bytes already accepted by the server. Only meaningful with `resumable`, and
   * it is what turns *Retry* into *Resume from 412 MB*. @default undefined
   */
  uploadedBytes = input<number | undefined>(undefined);

  // ── Deleting the file ───────────────────────────────────────────────────────

  /**
   * Ask before deleting.
   *
   * ★ Defaults to ON, and the previous behaviour was a single click that emitted
   *   straight through. Deleting a file is not undoable by anything the
   *   component can offer — see {@link FileRemoveEvent} — and the button is a
   *   28px × next to a download button of the same size, so the guard is the
   *   only thing standing between a misplaced click and a lost upload. Turn it
   *   off only where the host runs its own confirmation dialog.
   * @default true
   */
  confirmRemove = input<boolean>(true);

  /**
   * True while the delete is being sent. Both the confirm and cancel buttons
   * stop responding, so the request cannot be fired twice.
   * @default false
   */
  removing = input<boolean>(false);

  /**
   * The delete failed. Reported in place, because the row is still here — the
   * host never took it out.
   * @default null
   */
  removeError = input<SvDataError | string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * The user confirmed deleting the file. Bind this or nothing happens: the
   * component only asks, it never deletes.
   */
  remove = output<FileRemoveEvent>();

  /** Emitted when the download button is clicked. */
  download = output<void>();

  /**
   * Retry (or resume) a failed upload. Carries `resumeFrom`, which is `0`
   * unless the host declared the upload resumable and said how far it got.
   */
  retryUpload = output<FileRetryEvent>();

  /** Abandon an upload that is still running. */
  cancelUpload = output<{ fileName: string }>();

  // ── Focus (X-12) ────────────────────────────────────────────────────────────

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly rootEl = viewChild<ElementRef<HTMLElement>>('root');
  private readonly removeButtonEl = viewChild<ElementRef<HTMLButtonElement>>('removeButton');
  private readonly downloadButtonEl = viewChild<ElementRef<HTMLButtonElement>>('downloadButton');

  /**
   * Captured when a remove is emitted from inside this file. If the host then
   * takes the file out, the element holding focus goes with it — so focus moves
   * to the next file, else the previous one, else the list; never <body>.
   */
  private removalNeighbours: RemovalNeighbours | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const neighbours = this.removalNeighbours;
      if (!neighbours) return;
      const doc = this.host.nativeElement.ownerDocument;
      // After the host's view has been detached, so we can see where focus fell.
      queueMicrotask(() => {
        const active = doc.activeElement;
        if (active && active !== doc.body && active.isConnected) return;
        svRecoverFocus({
          to: [focusTarget(neighbours.next), focusTarget(neighbours.previous)],
          fallback: neighbours.container,
        });
      });
    });
  }

  /**
   * A confirm strip just closed and took the focused button with it: hand focus
   * back to the control that opened it, else this file's own group.
   */
  private restoreFocusTo(opener: () => HTMLElement | undefined): void {
    const active = this.host.nativeElement.ownerDocument.activeElement;
    if (!active || !this.host.nativeElement.contains(active)) return;
    afterNextRender(
      () => svRecoverFocus({ to: [opener()], fallback: this.rootEl()?.nativeElement }),
      { injector: this.injector },
    );
  }

  // ── Confirmation ────────────────────────────────────────────────────────────

  /** True once the × has been pressed and the confirm strip is showing. */
  readonly awaitingConfirm = signal(false);

  /**
   * The × pressed. Discloses the confirmation, or withdraws it on a second press.
   *
   * The button stays put rather than being swapped for the confirm strip, so the
   * keyboard focus that pressed it still has somewhere to be — and the strip
   * that follows it in the DOM is the very next tab stop.
   */
  toggleConfirm(): void {
    if (this.removing()) return;
    if (!this.confirmRemove()) {
      this.emitRemove();
      return;
    }
    this.awaitingConfirm.update(open => !open);
  }

  /** "Keep" pressed, or the × pressed a second time. */
  cancelRemove(): void {
    if (this.removing()) return;
    this.restoreFocusTo(() => this.removeButtonEl()?.nativeElement);
    this.awaitingConfirm.set(false);
  }

  /** "Remove" pressed inside the confirm strip. */
  confirmRemoval(): void {
    if (this.removing()) return;
    this.restoreFocusTo(() => this.removeButtonEl()?.nativeElement);
    this.awaitingConfirm.set(false);
    this.emitRemove();
  }

  private emitRemove(): void {
    const el = this.host.nativeElement;
    const active = el.ownerDocument.activeElement;
    this.removalNeighbours =
      active && el.contains(active)
        ? { next: el.nextElementSibling, previous: el.previousElementSibling, container: el.parentElement }
        : null;
    this.remove.emit({ fileName: this.fileName(), requestKey: svRequestKey('file-del') });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  /** The failed delete's message, normalized from either accepted shape. */
  readonly removeErrorMessage = computed<string>(() => {
    const error = this.removeError();
    return error ? toSvDataError(error).message : '';
  });

  readonly isImage = computed(() => this.mimeType().startsWith('image/'));

  readonly showPreview = computed(() => this.isImage() && !!this.previewUrl());

  readonly formattedSize = computed(() => {
    const size = this.fileSize();
    return size === undefined ? '' : formatBytes(size);
  });

  readonly fileExtension = computed(() => {
    const name = this.fileName();
    const idx  = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx + 1).toUpperCase() : '';
  });

  readonly iconType = computed<'image' | 'pdf' | 'archive' | 'video' | 'audio' | 'code' | 'doc' | 'sheet' | 'generic'>(() => {
    const mime = this.mimeType().toLowerCase();
    if (mime.startsWith('image/'))                                   return 'image';
    if (mime === 'application/pdf')                                  return 'pdf';
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return 'archive';
    if (mime.startsWith('video/'))                                   return 'video';
    if (mime.startsWith('audio/'))                                   return 'audio';
    if (mime.includes('javascript') || mime.includes('html') || mime.includes('css') || mime.includes('json')) return 'code';
    // Spreadsheets before documents, and not the other way round. The official
    // XLSX type is `application/vnd.openxmlformats-officedocument.spreadsheetml
    // .sheet`, which contains the substring `document` — so with `doc` tested
    // first, every .xlsx in the kit showed the Word icon in Word blue.
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'sheet';
    if (mime.includes('word') || mime.includes('document'))         return 'doc';
    return 'generic';
  });

  /**
   * ★ A FILE-TYPE PALETTE, SO IT STAYS LITERAL — and it is the closest thing in
   *   the kit to a hue that is already spoken for outside it. A spreadsheet is
   *   green and a PDF is red everywhere a user has ever seen one; that is
   *   recognition, not a role, and `text-danger-500` on a PDF icon would tell a
   *   reader the file had failed. Under a rebrand these must NOT move: eight file
   *   kinds need eight tellable-apart icons, and any token family would fold
   *   several of them into one. The upload OUTCOME beside the icon — done, failed
   *   — was swept, because that genuinely is a state.
   *   Recorded in `scripts/theme-literal.allow.json`.
   */
  /**
   * ★★ STEP 700 IN LIGHT, 400 IN DARK, AND EVERY ARM NEEDS BOTH.
   *
   *    This paints the extension label — `text-[10px] font-bold`, which is 7.5pt
   *    and so plain text for AA purposes, not large — over `iconBgClass()`'s
   *    matching tint. At the old 500/600 steps six of the eight missed 4.5:1 on
   *    the light tint: green 3.07, amber 3.08, emerald 3.48, pink 4.16, rose
   *    4.10, blue 4.82 only just clearing. 700 clears all eight, worst green at
   *    4.72.
   *
   *    Only `generic` had a `dark:` arm, so in dark mode the other eight kept
   *    their light colour over a `-950/40` tint — `doc` measured 3.16:1 there.
   *    400 clears all eight in dark, worst violet at 6.01.
   */
  readonly iconColorClass = computed<string>(() => {
    const map: Record<string, string> = {
      image:   'text-violet-700 dark:text-violet-400',
      pdf:     'text-rose-700 dark:text-rose-400',
      archive: 'text-amber-700 dark:text-amber-400',
      video:   'text-blue-700 dark:text-blue-400',
      audio:   'text-pink-700 dark:text-pink-400',
      code:    'text-emerald-700 dark:text-emerald-400',
      doc:     'text-blue-700 dark:text-blue-400',
      sheet:   'text-green-700 dark:text-green-400',
      generic: 'text-gray-700 dark:text-gray-400',
    };
    return map[this.iconType()];
  });

  readonly iconBgClass = computed<string>(() => {
    const map: Record<string, string> = {
      image:   'bg-violet-50 dark:bg-violet-950/40',
      pdf:     'bg-rose-50 dark:bg-rose-950/40',
      archive: 'bg-amber-50 dark:bg-amber-950/40',
      video:   'bg-blue-50 dark:bg-blue-950/40',
      audio:   'bg-pink-50 dark:bg-pink-950/40',
      code:    'bg-emerald-50 dark:bg-emerald-950/40',
      doc:     'bg-blue-50 dark:bg-blue-950/40',
      sheet:   'bg-green-50 dark:bg-green-950/40',
      generic: 'bg-gray-100 dark:bg-gray-800',
    };
    return map[this.iconType()];
  });

  readonly statusIcon = computed<'check' | 'x' | null>(() => {
    if (this.status() === 'success') return 'check';
    if (this.status() === 'error')   return 'x';
    return null;
  });

  // ── Is it safe to hand over? ────────────────────────────────────────────────
  //
  // ★★ THE DOWNLOAD BUTTON USED TO BE AN UNCONDITIONAL ASSERTION. It rendered
  //    for every file in every state, so pressing it on a file the host had
  //    never scanned looked exactly like pressing it on one that had come back
  //    clean — and it rendered on a file whose upload had FAILED, where there
  //    are no bytes on the server to fetch at all. A file viewer's one job at
  //    this moment is not to imply a safety claim nobody made.

  /** True once Download has been pressed on a flagged file. */
  readonly awaitingUnsafeConfirm = signal(false);

  /** There is nothing on the server yet, or not any more. */
  private readonly noBytesYet = computed(
    () => this.status() === 'uploading' || this.status() === 'error',
  );

  /** Why the download is withheld — empty when it is not. */
  readonly downloadBlockedReason = computed<string>(() => {
    if (!this.downloadable()) return '';
    if (this.status() === 'uploading') return 'Still uploading.';
    if (this.status() === 'error') return 'The upload failed, so there is nothing to download yet.';
    if (this.scan() === 'pending') return 'Being checked for threats. Download opens when the check finishes.';
    if (this.scan() === 'flagged' && !this.allowUnsafeDownload()) {
      return this.scanNote() || 'Flagged as unsafe, so it cannot be downloaded.';
    }
    return '';
  });

  /** Whether a download control is offered at all. */
  readonly canDownload = computed<boolean>(() => {
    if (!this.downloadable() || this.noBytesYet()) return false;
    if (this.scan() === 'pending') return false;
    if (this.scan() === 'flagged') return this.allowUnsafeDownload();
    return true;
  });

  /** Whether pressing Download opens a confirmation rather than downloading. */
  readonly downloadNeedsConfirm = computed(
    () => this.canDownload() && this.scan() === 'flagged',
  );

  /**
   * Whether to disclose that nobody checked this file.
   *
   * Only when a download is on offer — that is the exact moment the button
   * would otherwise stand in for a safety claim. A file with no download
   * control makes no such claim, and stamping "Not scanned" on every row of a
   * list nobody can download from is noise that trains people to ignore it.
   */
  readonly showScanState = computed<boolean>(
    () => this.scan() !== 'unscanned' || (this.downloadable() && !this.noBytesYet()),
  );

  readonly scanLabel = computed<string>(() => {
    switch (this.scan()) {
      case 'clean':   return 'Checked — no threats found';
      case 'pending': return 'Checking for threats…';
      case 'flagged': return this.scanNote() || 'Flagged as unsafe';
      default:        return 'Not checked for threats';
    }
  });

  readonly scanIcon = computed<'shield-check' | 'clock' | 'alert-triangle' | 'info'>(() => {
    switch (this.scan()) {
      case 'clean':   return 'shield-check';
      case 'pending': return 'clock';
      case 'flagged': return 'alert-triangle';
      default:        return 'info';
    }
  });

  readonly scanToneClass = computed<string>(() => {
    switch (this.scan()) {
      case 'clean':   return 'text-accent-700 dark:text-accent-400';
      case 'flagged': return 'text-danger-700 dark:text-danger-300';
      // Unscanned and pending are not warnings — they are the absence of an
      // answer, and painting them amber would cry wolf on every ordinary file.
      default:        return 'text-gray-600 dark:text-gray-400';
    }
  });

  /** Download pressed. A flagged file asks first; everything else goes. */
  onDownload(): void {
    if (!this.canDownload()) return;
    if (this.downloadNeedsConfirm()) {
      this.awaitingUnsafeConfirm.update(open => !open);
      return;
    }
    this.download.emit();
  }

  confirmUnsafeDownload(): void {
    this.restoreFocusTo(() => this.downloadButtonEl()?.nativeElement);
    this.awaitingUnsafeConfirm.set(false);
    this.download.emit();
  }

  cancelUnsafeDownload(): void {
    this.restoreFocusTo(() => this.downloadButtonEl()?.nativeElement);
    this.awaitingUnsafeConfirm.set(false);
  }

  // ── An upload that did not finish ───────────────────────────────────────────

  /** The failed upload's message, normalized from either accepted shape. */
  readonly uploadErrorMessage = computed<string>(() => {
    const error = this.uploadError();
    return error ? toSvDataError(error).message : '';
  });

  /**
   * Where a retry would start.
   *
   * Zero unless the host said BOTH that the upload is resumable and how far it
   * got. Either half missing means the bytes have to go again, and the label
   * below says so rather than letting the user assume otherwise.
   */
  readonly resumeFrom = computed<number>(() => {
    if (!this.resumable()) return 0;
    const done = this.uploadedBytes();
    if (done === undefined || !Number.isFinite(done) || done <= 0) return 0;
    const total = this.fileSize();
    // A stale offset past the end of the file would resume into nothing.
    return total !== undefined && done >= total ? 0 : Math.floor(done);
  });

  /**
   * ★ The label states which of the two acts the button performs. A "Retry"
   * that silently re-sends 900 MB over a metered connection is not the same
   * offer as resuming, and one word covering both is how a user pays for it.
   */
  readonly retryLabel = computed<string>(() => {
    const from = this.resumeFrom();
    return from > 0 ? `Resume from ${formatBytes(from)}` : 'Retry from the start';
  });

  onRetryUpload(): void {
    this.retryUpload.emit({
      fileName: this.fileName(),
      resumeFrom: this.resumeFrom(),
      requestKey: svRequestKey('file-up'),
    });
  }

  onCancelUpload(): void {
    this.cancelUpload.emit({ fileName: this.fileName() });
  }

  readonly isCompact = computed(() => this.variant() === 'compact');
  readonly isRow     = computed(() => this.variant() === 'row');
  readonly isCard    = computed(() => this.variant() === 'card');
}
