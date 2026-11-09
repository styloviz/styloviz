/**
 * The accessible names and visible text `sv-address-card`, `sv-file-display`, `sv-qr-code`, `sv-price` and `sv-pricing-table` render, in English. Override any of
 * them with `provideSvLabels({ commerce: { … } })` from `@styloviz/core`.
 */
export interface SvCommerceLabels {
  readonly editAddress: string;
  readonly removeAddress: string;
  readonly confirmRemoveAddress: string;
  readonly uploadSuccessful: string;
  readonly uploadFailed: string;
  readonly selectAddressFor: string;
  readonly cannotEncode: string;
  readonly payloadSize: string;
  readonly percentOff: string;
  readonly cancelUploadingFile: string;
  readonly downloadFile: string;
  readonly downloadUnsafeFile: string;
  readonly removeFile: string;
  readonly cancelRemovingFile: string;
  readonly confirmDownloadingFile: string;
  readonly confirmRemovingFile: string;
  readonly retryUploadOfFile: string;
  readonly uploadProgressFor: string;
  // sv-address-card
  readonly defaultBadge: string;
  readonly confirmRemoveDefaultPrompt: string;
  readonly confirmRemovePrompt: string;
  readonly newDefaultLabel: string;
  readonly losingDefault: string;
  readonly removeButton: string;
  readonly keepButton: string;
  readonly setAsDefault: string;
  // sv-address-form
  readonly countryLabel: string;
  readonly selectCountry: string;
  readonly optionalField: string;
  readonly selectField: string;
  readonly setAsDefaultAddress: string;
  readonly useSuggestedAddress: string;
  readonly saveAddress: string;
  readonly cancelButton: string;
  // sv-file-display
  readonly flaggedUnsafe: string;
  readonly downloadAnywayPrompt: string;
  readonly downloadAnyway: string;
  readonly confirmRemoveFilePrompt: string;
  readonly removingFile: string;
  readonly uploadingStatus: string;
  // sv-qr-code
  readonly payloadTooLong: string;
  readonly payloadBytes: string;
  // sv-price
  readonly salePrice: string;
  readonly credit: string;
  readonly rangeTo: string;
  readonly regularPrice: string;
  readonly saveDiscount: string;
  readonly fromPrice: string;
  readonly taxName: string;
  readonly taxInclusive: string;
  readonly taxExclusive: string;
  /** sv-address-card: the address kind badge. */
  readonly kindShipping: string;
  readonly kindBilling: string;
  readonly kindShippingBilling: string;
  /** sv-address-form: the default verification sentence per status (`verification.message` overrides it). */
  readonly verificationVerifying: string;
  readonly verificationVerified: string;
  readonly verificationCorrected: string;
  readonly verificationUnavailable: string;
  readonly verificationFailed: string;
  /** Field labels and placeholders of the built-in address schemas (`svAddressSchemas`). */
  readonly addressFieldLabel: string;
  readonly addressFieldLabelPlaceholder: string;
  readonly addressFieldFirstName: string;
  readonly addressFieldLastName: string;
  readonly addressFieldLine1: string;
  readonly addressFieldLine1Placeholder: string;
  readonly addressFieldLine2: string;
  readonly addressFieldPhone: string;
  readonly addressFieldCity: string;
  readonly addressFieldTownOrCity: string;
  readonly addressFieldSuburb: string;
  readonly addressFieldCityOrWard: string;
  readonly addressFieldArea: string;
  readonly addressFieldState: string;
  readonly addressFieldProvince: string;
  readonly addressFieldCounty: string;
  readonly addressFieldPrefecture: string;
  readonly addressFieldDistrict: string;
  readonly addressFieldEmirate: string;
  /** The region field before a country is chosen. */
  readonly addressFieldRegion: string;
  readonly addressFieldZipCode: string;
  readonly addressFieldPostalCode: string;
  readonly addressFieldPostcode: string;
  readonly addressFieldEircode: string;
  readonly addressFieldPinCode: string;
  /** sv-file-display: why the download is withheld. */
  readonly downloadBlockedUploading: string;
  readonly downloadBlockedFailed: string;
  readonly downloadBlockedScanning: string;
  readonly downloadBlockedUnsafe: string;
  /** sv-file-display: the scan-state line. */
  readonly scanClean: string;
  readonly scanPending: string;
  readonly scanFlagged: string;
  readonly scanUnscanned: string;
  /** sv-file-display: the retry button. `{size}` is already formatted ("12.5 MB"). */
  readonly resumeFrom: string;
  readonly retryFromStart: string;
  /** sv-qr-code: the default accessible name. `{value}` is the encoded value. */
  readonly qrCodeFor: string;
  readonly qrCodeEmpty: string;
  /** sv-qr-code / `svQrScannability`: the scannability warnings. */
  readonly qrWarningCapacity: string;
  readonly qrWarningContrastUnreadable: string;
  readonly qrWarningContrastLow: string;
  readonly qrWarningInverted: string;
  readonly qrWarningQuietZone: string;
  readonly qrWarningLogo: string;
  /** sv-pricing-table: the billing toggle's group name and options. */
  readonly pricingBillingLegend: string;
  readonly pricingMonthly: string;
  readonly pricingAnnual: string;
  /** Beside the toggle — `{pct}` is the smallest saving any paid plan gives, so it is true of all of them. */
  readonly pricingAnnualSaving: string;
  /** After the figure: read to a screen reader, and the visible short form (hidden from it). */
  readonly pricingPerMonth: string;
  readonly pricingPerMonthShort: string;
  /** What is actually charged, and when — `{amount}` arrives formatted ("$1,428"). */
  readonly pricingBilledMonthly: string;
  readonly pricingBilledAnnually: string;
  /** The annual saving — `{amount}` arrives formatted, `{pct}` as a number. */
  readonly pricingSaving: string;
  readonly pricingSavingPercent: string;
  /** A zero price, and a plan quoted rather than priced. */
  readonly pricingFree: string;
  readonly pricingCustom: string;
  /** The highlighted plan's badge when it names none of its own. */
  readonly pricingPopular: string;
  /** A plan's call to action — `{plan}` is its name — and the one for the plan already chosen. */
  readonly pricingChoose: string;
  readonly pricingSelected: string;
  /** A comparison cell's state, read in place of its icon. */
  readonly pricingIncluded: string;
  readonly pricingNotIncluded: string;
  /** The comparison table's caption, its corner header and its price row. */
  readonly pricingCaption: string;
  readonly pricingFeatureHeader: string;
  readonly pricingPriceRow: string;
}

export const SV_COMMERCE_LABELS: SvCommerceLabels = {
  editAddress: 'Edit address',
  removeAddress: 'Remove address',
  confirmRemoveAddress: 'Confirm removing this address',
  uploadSuccessful: 'Upload successful',
  uploadFailed: 'Upload failed',
  selectAddressFor: 'Select address for {name}',
  /** `{size}` is `sv-qr-code`'s `payloadLabel()` ("180 / 250 bytes"), the same text the meter shows. */
  cannotEncode: 'Cannot encode: {size}',
  payloadSize: 'Payload size: {size}',
  percentOff: '{percent}% off',
  cancelUploadingFile: 'Cancel uploading {name}',
  downloadFile: 'Download {name}',
  downloadUnsafeFile: 'Download {name}, flagged as unsafe',
  removeFile: 'Remove {name}',
  cancelRemovingFile: 'Cancel removing {name}',
  confirmDownloadingFile: 'Confirm downloading {name}',
  confirmRemovingFile: 'Confirm removing {name}',
  /** `{action}` is the retry button's visible text, so the name starts with what the button says. */
  retryUploadOfFile: '{action} — {name}',
  uploadProgressFor: 'Upload progress for {name}',
  // sv-address-card
  defaultBadge: 'Default',
  confirmRemoveDefaultPrompt: 'Remove your default address?',
  confirmRemovePrompt: 'Remove this address?',
  newDefaultLabel: 'Make this the new default',
  losingDefault: 'You will be left with no default address.',
  removeButton: 'Remove',
  keepButton: 'Keep',
  setAsDefault: 'Set as default',
  // sv-address-form
  countryLabel: 'Country',
  selectCountry: 'Select a country',
  optionalField: '(optional)',
  selectField: 'Select {field}',
  setAsDefaultAddress: 'Set as default address',
  useSuggestedAddress: 'Use this address',
  saveAddress: 'Save address',
  cancelButton: 'Cancel',
  // sv-file-display
  flaggedUnsafe: 'This file was flagged as unsafe.',
  downloadAnywayPrompt: '{note} Download it anyway?',
  downloadAnyway: 'Download anyway',
  confirmRemoveFilePrompt: 'Remove this file? This cannot be undone.',
  removingFile: 'Removing…',
  uploadingStatus: 'Uploading…',
  // sv-qr-code
  payloadTooLong: 'Payload too long',
  payloadBytes: '{bytes} / {capacity} bytes',
  // sv-price
  salePrice: 'Sale price',
  credit: 'Credit',
  rangeTo: 'to',
  regularPrice: 'Regular price',
  saveDiscount: 'Save {percent}%',
  fromPrice: 'From',
  taxName: 'tax',
  taxInclusive: 'incl. {tax}',
  taxExclusive: 'excl. {tax}',
  kindShipping: 'Shipping',
  kindBilling: 'Billing',
  kindShippingBilling: 'Shipping & billing',
  verificationVerifying: 'Checking this address…',
  verificationVerified: 'Address confirmed.',
  verificationCorrected: 'We found a close match. Use it, or keep what you entered.',
  verificationUnavailable: 'We could not check this address right now. You can save it as entered.',
  verificationFailed: 'We could not match this address. Check it, or save it as entered.',
  addressFieldLabel: 'Label',
  addressFieldLabelPlaceholder: 'Home, Work…',
  addressFieldFirstName: 'First name',
  addressFieldLastName: 'Last name',
  addressFieldLine1: 'Address',
  addressFieldLine1Placeholder: 'Street address',
  addressFieldLine2: 'Apartment, suite, etc.',
  addressFieldPhone: 'Phone',
  addressFieldCity: 'City',
  addressFieldTownOrCity: 'Town or city',
  addressFieldSuburb: 'Suburb',
  addressFieldCityOrWard: 'City or ward',
  addressFieldArea: 'Area',
  addressFieldState: 'State',
  addressFieldProvince: 'Province',
  addressFieldCounty: 'County',
  addressFieldPrefecture: 'Prefecture',
  addressFieldDistrict: 'District',
  addressFieldEmirate: 'Emirate',
  addressFieldRegion: 'State / Province / Region',
  addressFieldZipCode: 'ZIP code',
  addressFieldPostalCode: 'Postal code',
  addressFieldPostcode: 'Postcode',
  addressFieldEircode: 'Eircode',
  addressFieldPinCode: 'PIN code',
  downloadBlockedUploading: 'Still uploading.',
  downloadBlockedFailed: 'The upload failed, so there is nothing to download yet.',
  downloadBlockedScanning: 'Being checked for threats. Download opens when the check finishes.',
  downloadBlockedUnsafe: 'Flagged as unsafe, so it cannot be downloaded.',
  scanClean: 'Checked — no threats found',
  scanPending: 'Checking for threats…',
  scanFlagged: 'Flagged as unsafe',
  scanUnscanned: 'Not checked for threats',
  resumeFrom: 'Resume from {size}',
  retryFromStart: 'Retry from the start',
  qrCodeFor: 'QR code for: {value}',
  qrCodeEmpty: 'QR code: no value',
  qrWarningCapacity: 'The payload is {bytes} bytes and only {capacity} fit at correction level {level}. It would be truncated, producing a code that scans cleanly and returns the wrong data, so nothing is drawn.',
  qrWarningContrastUnreadable: 'The foreground or background is not a plain hex colour, so the contrast a scanner needs cannot be checked.',
  qrWarningContrastLow: 'Contrast between the modules and the background is {contrast}:1, below the {min}:1 a camera needs to separate them. The code will look fine and may not scan.',
  qrWarningInverted: 'The modules are lighter than the background. Many scanners assume dark on light and will not read an inverted code, even though its contrast is fine.',
  qrWarningQuietZone: "The quiet zone is {modules} modules; the specification requires {min}. Without it a scanner cannot find the symbol's edges against whatever surrounds it.",
  qrWarningLogo: 'The logo covers {coverage}% of the code, and level {level} can only recover {budget}%. Raise the correction level or shrink the logo — a code that cannot self-repair is not a code with a logo on it, it is a broken code.',
  pricingBillingLegend: 'Billing period',
  pricingMonthly: 'Monthly',
  pricingAnnual: 'Annual',
  pricingAnnualSaving: 'Save at least {pct}%',
  pricingPerMonth: 'per month',
  pricingPerMonthShort: '/ month',
  pricingBilledMonthly: '{amount} billed every month',
  pricingBilledAnnually: '{amount} billed once a year',
  pricingSaving: 'Save {amount} a year',
  pricingSavingPercent: '{pct}% off',
  pricingFree: 'Free',
  pricingCustom: 'Custom',
  pricingPopular: 'Most popular',
  pricingChoose: 'Choose {plan}',
  pricingSelected: 'Selected',
  pricingIncluded: 'Included',
  pricingNotIncluded: 'Not included',
  pricingCaption: 'Compare plans',
  pricingFeatureHeader: 'Feature',
  pricingPriceRow: 'Price',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    commerce: SvCommerceLabels;
  }
}
