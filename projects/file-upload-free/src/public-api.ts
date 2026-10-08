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
