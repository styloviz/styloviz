export { SvBarcode1dComponent } from './barcode-1d.component';
export type { BarcodeModule, BarcodeSymbology, BarcodeVariant } from './barcode-1d.types';
export {
  SV_QUIET_CODE128,
  SV_QUIET_EAN_LEFT,
  SV_QUIET_EAN_RIGHT,
  svBarcodeWidth,
  svCode128Check,
  svCode128Savings,
  svCode128Values,
  svEncode,
  svEncodingLabel,
  svGtinCheckDigit,
  svIsGuardModule,
  svSnapModuleWidth,
  svValidate,
} from './barcode-1d.encode';
export type { SvEncoded } from './barcode-1d.encode';
export {
  SV_BARCODE_MIN_X_MM,
  SV_BARCODE_NOMINAL_X_MM,
  SV_MM_PER_CSS_PX,
  svScanSize,
} from './barcode-1d.scan';
export type { SvBarcodeScanSize } from './barcode-1d.scan';
