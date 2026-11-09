export {
  SvFileUploadComponent,
  FileUploadVariant,
  FileUploadSize,
  UploadFileStatus,
  UploadFile,
} from './lib/file-upload.component';
export type { SvUploadContext, SvUploadResult, SvUploader } from './lib/file-upload.component';
// Malware-scan state (`FI-10-M1`). A separate axis from `UploadFileStatus` —
// a flagged file uploaded successfully; the content is the problem.
export type { SvScanVerdict } from './lib/file-upload.component';
// Intake reporting and duplicate handling (`SR-17`).
export type { FileUploadDuplicates, SvIntakeSkipped } from './lib/file-upload.component';
// Edit forms, translation, host checks, form rules and a ready XHR uploader
// (`SR-27`) — shared with the Pro twin, so both say and check the same things.
export type {
  SvFileUploadLabels,
  SvFileUploadRules,
  SvFileValidator,
  SvHttpUploaderOptions,
  SvStoredFile,
} from './lib/file-upload.extras';
export {
  SV_FILE_UPLOAD_LABELS,
  svDemoFails,
  svFileUploadLabels,
  svFileUploadErrors,
  svHttpUploader,
  svStableUnit,
  svValidatorMessage,
} from './lib/file-upload.extras';
export { SV_FILE_UPLOAD_TRIGGER_LABELS, injectSvFileUploadLabels } from './lib/file-upload.labels';
export type { SvFileUploadTriggerLabels } from './lib/file-upload.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/file-upload.labels.packs';
