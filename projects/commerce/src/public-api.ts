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
export { SvPriceComponent, svCurrencySymbolIsAmbiguous } from '@styloviz/commerce/price';
export type { PriceSize, PriceAlign, PriceDiscount, PriceCurrencyName } from '@styloviz/commerce/price';
// ── Plans ────────────────────────────────────────────────────────────────────
export { SvPricingTableComponent } from '@styloviz/commerce/pricing-table';
export type {
  SvPricingBilling,
  SvPricingCta,
  SvPricingFeature,
  SvPricingHeadingLevel,
  SvPricingPlan,
  SvPricingPlanSelect,
  SvPricingTableLabels,
  SvPricingTableLayout,
} from '@styloviz/commerce/pricing-table';
export {
  svAnnualMonthly,
  svAnnualSaving,
  svAnnualSavingPercent,
  svAnnualTotal,
  svClampDiscount,
  svFormatPlanPrice,
  svPricingHeadlineSaving,
} from '@styloviz/commerce/pricing-table';
export type { SvPricingAmount } from '@styloviz/commerce/pricing-table';
// ── Checkout & account ───────────────────────────────────────────────────────
export { SvAddressCardComponent } from '@styloviz/commerce/address-card';
export { SvAddressFormComponent } from '@styloviz/commerce/address-card';
export type {
  Address,
  AddressActionEvent,
  AddressKind,
  AddressMaskLevel,
} from '@styloviz/commerce/address-card';
export {
  DEFAULT_ADDRESS_SCHEMAS,
  GENERIC_ADDRESS_SCHEMA,
  resolveAddressSchema,
  svAddressSchemas,
  svGenericAddressSchema,
} from '@styloviz/commerce/address-card';
export type {
  AddressFieldName,
  AddressFieldSchema,
  AddressSaveEvent,
  AddressSchema,
  AddressVerification,
  AddressVerificationStatus,
  SvAddressSchemaLabels,
} from '@styloviz/commerce/address-card';
// ── Fulfilment ───────────────────────────────────────────────────────────────
export { SvFileDisplayComponent, svFormatBytes } from '@styloviz/commerce/file-display';
export type { FileStatus, FileVariant, FileScanState, FileRemoveEvent, FileRetryEvent } from '@styloviz/commerce/file-display';
export { SvQrCodeComponent, svQrModuleLayout } from '@styloviz/commerce/qr-code';
export type { QrErrorCorrection } from '@styloviz/commerce/qr-code';
export {
  SV_QR_MIN_CONTRAST,
  SV_QR_MIN_QUIET_ZONE,
  SV_QR_RECOVERY,
  svQrContrast,
  svQrScannability,
} from '@styloviz/commerce/qr-code';
export type { SvQrEcLevel, SvQrScanCheck, SvQrScanLabels, SvQrWarning } from '@styloviz/commerce/qr-code';
export { SV_QR_MAX_VERSION, svQrCapacityBytes, svQrOverCapacity, svQrPayloadBytes } from '@styloviz/commerce/qr-code';

export { SV_COMMERCE_LABELS } from '@styloviz/commerce/labels';
export type { SvCommerceLabels } from '@styloviz/commerce/labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/commerce/labels';
