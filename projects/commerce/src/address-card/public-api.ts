// The @styloviz/commerce/address-card entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvAddressCardComponent } from './address-card.component';
export { SvAddressFormComponent } from './address-form.component';
export type {
  Address,
  AddressActionEvent,
  AddressKind,
  AddressMaskLevel,
} from './address-card.component';
export {
  DEFAULT_ADDRESS_SCHEMAS,
  GENERIC_ADDRESS_SCHEMA,
  resolveAddressSchema,
  svAddressSchemas,
  svGenericAddressSchema,
} from './address-schema';
export type {
  AddressFieldName,
  AddressFieldSchema,
  AddressSaveEvent,
  AddressSchema,
  AddressVerification,
  AddressVerificationStatus,
  SvAddressSchemaLabels,
} from './address-schema';
