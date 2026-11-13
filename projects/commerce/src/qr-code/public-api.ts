// The @styloviz/commerce/qr-code entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvQrCodeComponent, svQrModuleLayout } from './qr-code.component';
export type { QrErrorCorrection } from './qr-code.component';
export {
  SV_QR_MIN_CONTRAST,
  SV_QR_MIN_QUIET_ZONE,
  SV_QR_RECOVERY,
  svQrContrast,
  svQrScannability,
} from './qr-scannability';
export type { SvQrEcLevel, SvQrScanCheck, SvQrScanLabels, SvQrWarning } from './qr-scannability';
export { SV_QR_MAX_VERSION, svQrCapacityBytes, svQrOverCapacity, svQrPayloadBytes } from './qr-encoder.util';
