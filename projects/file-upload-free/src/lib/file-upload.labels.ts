import { injectSvLabels } from '@styloviz/core/i18n';

/**
 * The registry-backed text `sv-file-upload` renders, in English. Override any
 * of them with `provideSvLabels({ fileUpload: { … } })` from `@styloviz/core`.
 *
 * The row and status strings are templates here; `svFileUploadLabels()` turns
 * them into the function-shaped `SvFileUploadLabels` the component's own
 * `labels` input takes (shared with the Pro twin), filled in the kit's locale.
 * A `labels` input still wins key by key.
 */
export interface SvFileUploadTriggerLabels {
  readonly uploadFiles: string;
  readonly fileList: string;
  readonly overallProgress: string;
  /** `{count}` files. */
  readonly uploadingSummary: string;
  readonly pending: string;
  readonly uploaded: string;
  readonly stored: string;
  readonly uploadFailed: string;
  /** A failed upload's row message when the uploader's error carries none. */
  readonly uploadFailedMessage: string;
  /** The simulated server error `demoMode` shows. */
  readonly demoServerError: string;
  readonly blocked: string;
  readonly scanning: string;
  readonly awaitingScan: string;
  readonly checking: string;
  /** `{name}` is the file name. */
  readonly uploadingFile: string;
  readonly retryFile: string;
  readonly cancelFile: string;
  readonly removeFile: string;
  readonly openFile: string;
  /** `{count}` is a number of files. */
  readonly fileCount: string;
  readonly uploadedCount: string;
  readonly awaitingScanCount: string;
  readonly blockedCount: string;
  readonly failedCount: string;
  readonly clearAll: string;
  readonly clearAllLabel: string;
  readonly uploadAll: string;
  readonly cancelAll: string;
  readonly retryFailed: string;
  /** `{limit}` is a formatted size, e.g. `10 MB`. */
  readonly tooLarge: string;
  readonly tooSmall: string;
  readonly totalTooLarge: string;
  readonly typeNotAllowed: string;
  /** Screen-reader summary; `{count}` files, `{percent}` whole percent. */
  readonly statusSelected: string;
  readonly statusUploading: string;
  readonly statusBlocked: string;
  readonly statusAwaitingScan: string;
  readonly statusCropping: string;
  /** Pro: the drop zone. */
  readonly dropHere: string;
  readonly dragOrBrowse: string;
  readonly browse: string;
  readonly chooseFiles: string;
  readonly maxReached: string;
  readonly maxPerFile: string;
  readonly upToFiles: string;
  readonly dropRejected: string;
  readonly waitingToCrop: string;
  readonly skipCrop: string;
  readonly skipCropFile: string;
  /** `{width}` × `{height}` in pixels. */
  readonly imageTooSmall: string;
  readonly imageTooLarge: string;
}

export const SV_FILE_UPLOAD_TRIGGER_LABELS: SvFileUploadTriggerLabels = {
  uploadFiles: 'Upload files',
  fileList: 'Uploaded files',
  overallProgress: 'Overall upload progress',
  uploadingSummary: '{count, plural, one {Uploading # file…} other {Uploading # files…}}',
  pending: 'Pending',
  uploaded: 'Uploaded',
  stored: 'On the server',
  uploadFailed: 'Upload failed',
  uploadFailedMessage: 'Upload failed.',
  demoServerError: 'Upload failed — server error',
  blocked: 'Blocked by a security scan',
  scanning: 'Scanning for malware…',
  awaitingScan: 'Awaiting a security scan',
  checking: 'Checking…',
  uploadingFile: 'Uploading {name}',
  retryFile: 'Retry {name}',
  cancelFile: 'Cancel upload of {name}',
  removeFile: 'Remove {name}',
  openFile: 'Open {name}',
  fileCount: '{count, plural, one {# file} other {# files}}',
  uploadedCount: '{count} uploaded',
  awaitingScanCount: '{count} awaiting scan',
  blockedCount: '{count} blocked',
  failedCount: '{count} failed',
  clearAll: 'Clear all',
  clearAllLabel: 'Remove all files',
  uploadAll: 'Upload all',
  cancelAll: 'Cancel all',
  retryFailed: 'Retry failed',
  tooLarge: 'File exceeds {limit} limit',
  tooSmall: 'File is smaller than {limit}',
  totalTooLarge: 'Exceeds the {limit} total',
  typeNotAllowed: 'File type not allowed',
  statusSelected: '{count, plural, one {# file selected} other {# files selected}}',
  statusUploading: '{count, plural, one {Uploading # file} other {Uploading # files}}, {percent} percent',
  statusBlocked: '{count} blocked by a security scan',
  statusAwaitingScan: '{count} awaiting a security scan',
  statusCropping: '{count} waiting to be cropped',
  dropHere: 'Drop files here',
  dragOrBrowse: 'Drag & drop files, or ',
  browse: 'browse',
  chooseFiles: 'Choose files',
  maxReached: 'Max files reached',
  maxPerFile: 'Max {limit} per file',
  upToFiles: 'Up to {count} files',
  dropRejected: 'These files can’t be added here',
  waitingToCrop: 'Waiting to be cropped',
  skipCrop: 'Skip crop',
  skipCropFile: 'Upload {name} without cropping',
  imageTooSmall: 'Image must be at least {width} × {height} px',
  imageTooLarge: 'Image must be at most {width} × {height} px',
};

/**
 * The app's `fileUpload` labels, for a component in another package that
 * renders the free upload's words (the Pro twin) — a package injects only its
 * own namespace, so it borrows these through this package. Call in an
 * injection context.
 */
export function injectSvFileUploadLabels(): SvFileUploadTriggerLabels {
  return injectSvLabels('fileUpload', SV_FILE_UPLOAD_TRIGGER_LABELS);
}

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    fileUpload: SvFileUploadTriggerLabels;
  }
}
