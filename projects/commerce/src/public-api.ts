/**
 * @styloviz/commerce — Public API
 *
 * Storefront building blocks. `cart-line-item` and `product-card` compose
 * `sv-price` from this same package, and both reach into `@styloviz/forms`
 * for the quantity stepper and the rating — the one cross-package dependency.
 * `sv-pricing-table` lays out subscription plans, with the annual figures
 * derived by the exported `svAnnual*` helpers.
 */

// ── Money ────────────────────────────────────────────────────────────────────
export { SvPriceComponent, svCurrencySymbolIsAmbiguous } from './price/price.component';
export type { PriceSize, PriceAlign, PriceDiscount, PriceCurrencyName } from './price/price.component';
// ── Plans ────────────────────────────────────────────────────────────────────
export { SvPricingTableComponent } from './pricing-table/pricing-table.component';
export type {
  SvPricingBilling,
  SvPricingCta,
  SvPricingFeature,
  SvPricingHeadingLevel,
  SvPricingPlan,
  SvPricingPlanSelect,
  SvPricingTableLabels,
  SvPricingTableLayout,
} from './pricing-table/pricing-table.component';
export {
  svAnnualMonthly,
  svAnnualSaving,
  svAnnualSavingPercent,
  svAnnualTotal,
  svClampDiscount,
  svFormatPlanPrice,
  svPricingHeadlineSaving,
} from './pricing-table/pricing-math';
export type { SvPricingAmount } from './pricing-table/pricing-math';
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
  svAddressSchemas,
  svGenericAddressSchema,
} from './address-card/address-schema';
export type {
  AddressFieldName,
  AddressFieldSchema,
  AddressSaveEvent,
  AddressSchema,
  AddressVerification,
  AddressVerificationStatus,
  SvAddressSchemaLabels,
} from './address-card/address-schema';
// ── Fulfilment ───────────────────────────────────────────────────────────────
export { SvFileDisplayComponent, svFormatBytes } from './file-display/file-display.component';
export type { FileStatus, FileVariant, FileScanState, FileRemoveEvent, FileRetryEvent } from './file-display/file-display.component';
export { SvQrCodeComponent, svQrModuleLayout } from './qr-code/qr-code.component';
export type { QrErrorCorrection } from './qr-code/qr-code.component';
export {
  SV_QR_MIN_CONTRAST,
  SV_QR_MIN_QUIET_ZONE,
  SV_QR_RECOVERY,
  svQrContrast,
  svQrScannability,
} from './qr-code/qr-scannability';
export type { SvQrEcLevel, SvQrScanCheck, SvQrScanLabels, SvQrWarning } from './qr-code/qr-scannability';
export { SV_QR_MAX_VERSION, svQrCapacityBytes, svQrOverCapacity, svQrPayloadBytes } from './qr-code/qr-encoder.util';

export { SV_COMMERCE_LABELS } from './commerce.labels';
export type { SvCommerceLabels } from './commerce.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './commerce.labels.packs';
