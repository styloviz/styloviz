/**
 * @styloviz/commerce — Public API
 *
 * Storefront building blocks. `cart-line-item` and `product-card` compose
 * `sv-price` from this same package, and both reach into `@styloviz/forms`
 * for the quantity stepper and the rating — the one cross-package dependency.
 */

// ── Money ────────────────────────────────────────────────────────────────────
export { SvPriceComponent } from './price/price.component';
export type { PriceSize, PriceAlign, PriceDiscount } from './price/price.component';
// ── Checkout & account ───────────────────────────────────────────────────────
export { SvAddressCardComponent } from './address-card/address-card.component';
export { SvAddressFormComponent } from './address-card/address-form.component';
export type {
  Address,
  AddressActionEvent,
  AddressKind,
  AddressMaskLevel,
} from './address-card/address-card.component';
export {
  DEFAULT_ADDRESS_SCHEMAS,
  GENERIC_ADDRESS_SCHEMA,
  resolveAddressSchema,
} from './address-card/address-schema';
export type {
  AddressFieldName,
  AddressFieldSchema,
  AddressSaveEvent,
  AddressSchema,
  AddressVerification,
  AddressVerificationStatus,
} from './address-card/address-schema';
// ── Fulfilment ───────────────────────────────────────────────────────────────
export { SvFileDisplayComponent } from './file-display/file-display.component';
export type { FileStatus, FileVariant, FileScanState, FileRemoveEvent, FileRetryEvent } from './file-display/file-display.component';
export { SvQrCodeComponent } from './qr-code/qr-code.component';
export type { QrErrorCorrection } from './qr-code/qr-code.component';
export {
  SV_QR_MIN_CONTRAST,
  SV_QR_MIN_QUIET_ZONE,
  SV_QR_RECOVERY,
  svQrContrast,
  svQrScannability,
} from './qr-code/qr-scannability';
export type { SvQrEcLevel, SvQrScanCheck, SvQrWarning } from './qr-code/qr-scannability';
export { SV_QR_MAX_VERSION, svQrCapacityBytes, svQrOverCapacity, svQrPayloadBytes } from './qr-code/qr-encoder.util';
